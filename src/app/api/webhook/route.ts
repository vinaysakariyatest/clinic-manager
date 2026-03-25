import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { speechToText } from '@/lib/stt';

// 11za Verify Webhook (GET) - Optional for some providers, but kept for compatibility
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "clinicmanager_secret";

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    } else {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }
  return new NextResponse('Bad Request', { status: 400 });
}

// Handle Incoming WhatsApp Messages from 11za (POST)
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log("Incoming 11za Payload:", JSON.stringify(payload, null, 2));

    // 1. Persist message to DB
    await prisma.whatsAppMessage.create({
      data: {
        messageId: payload.messageId || `msg-${Date.now()}`,
        channel: payload.channel,
        fromNumber: payload.from,
        toNumber: payload.to,
        senderName: payload.whatsapp?.senderName || null,
        contentType: payload.content?.contentType,
        contentText: payload.content?.text || null,
        eventType: payload.event,
        rawPayload: payload,
      },
    });

    // 2. Only process customer messages
    if (payload.event !== "MoMessage") {
      return NextResponse.json({ success: true });
    }

    /* --------------------------------------------------
     * 3️⃣ NORMALIZE MESSAGE (Handle Text & Voice)
     * -------------------------------------------------- */
    let finalText: string | null = null;
    let mediaUrl: string | null = null;

    if (payload.content?.contentType === "text") {
      finalText = payload.content.text?.trim() || null;
    }

    if (payload.content?.contentType === "media") {
      mediaUrl = payload.content.media?.url || null;

      // Handle Voice/Audio Messages
      if (
        payload.content.media?.type === "voice" ||
        payload.content.media?.type === "audio"
      ) {
        console.log("🎤 Voice message detected, starting Gemini STT...");
        const stt = await speechToText(mediaUrl!);
        finalText = stt?.text?.trim() || null;
        console.log("📝 Transcription result:", finalText);
      }
    }

    if (!finalText) {
      return NextResponse.json({ success: true });
    }

    /* --------------------------------------------------
     * 4️⃣ PROCESS WITH AI (GEMINI)
     * -------------------------------------------------- */
    const apiKey = process.env.AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    
    console.log("AI API Key Diagnostic:", {
      hasKey: !!apiKey,
      keyLength: apiKey?.length,
      envUsed: process.env.AI_API_KEY ? "AI_API_KEY" : (process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "GOOGLE_GENERATIVE_AI_API_KEY" : (process.env.GEMINI_API_KEY ? "GEMINI_API_KEY" : "NONE"))
    });

    if (!apiKey) {
      console.error("CRITICAL: AI API Key is missing in all expected environment variables (AI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_API_KEY)!");
      return NextResponse.json({ error: "Configuration Error: AI API Key missing" }, { status: 500 });
    }

    // Ensure patient exists in DB
    const phone = payload.from;
    let patient = await prisma.patient.findUnique({ where: { phone } });
    if (!patient) {
      patient = await prisma.patient.create({ 
        data: { 
          phone, 
          name: payload.whatsapp?.senderName || "New Patient" 
        } 
      });
    }

    // Fetch all available doctors for context
    const doctors = await prisma.doctor.findMany();
    const doctorsContext = doctors.map(d => `${d.name} (${d.specialization})`).join(', ');

    const google = createGoogleGenerativeAI({
      apiKey: apiKey
    });

    const { object: aiResponse } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: z.object({
        intent: z.enum(['GENERAL_REPLY', 'SUGGEST_DOCTOR', 'CONFIRM_DOCTOR', 'PROVIDE_TIME', 'BOOK_APPOINTMENT', 'CANCEL_APPOINTMENT']),
        symptoms: z.string().optional().describe('Patient symptoms if mentioned'),
        suggested_doctor: z.string().optional().describe('Name of the suggested doctor among the available doctors'),
        time_preference: z.string().optional().describe('Preferred time mentioned by patient in ISO format if possible, otherwise keep empty'),
        reply_message: z.string().describe('Friendly reply in Hinglish. Be helpful and professional. Max 2 sentences.'),
      }),
      prompt: `You are clinical assistant "ClinicManager". Current time is ${new Date().toISOString()}.
      Analyze patient message and determine next steps based on state.
      
      Patient: ${patient.name}
      Message: "${finalText}"
      Current State: ${(patient as any).conversationState}
      Last Suggested Doctor ID: ${(patient as any).lastSuggestedDoctorId || 'None'}
      Last Proposed Time: ${(patient as any).lastProposedTime?.toISOString() || 'None'}
      Available Doctors: ${doctorsContext}
      
      Flow Instructions:
      1. If state is IDLE and patient mentions symptoms/booking -> intent: SUGGEST_DOCTOR. Suggest a doctor.
      2. If state is DOCTOR_SUGGESTED and patient confirms (yes/ok) -> intent: CONFIRM_DOCTOR. Ask for date/time.
      3. If state is AWAITING_TIME and patient provides time -> intent: PROVIDE_TIME. Extract time in time_preference.
      4. If state is AWAITING_CONFIRMATION and patient confirms -> intent: BOOK_APPOINTMENT.
      5. If patient cancels or says no -> intent: CANCEL_APPOINTMENT.
      
      Special Case: If user provides symptoms AND time in one go, you can suggest doctor and jump to PROVIDE_TIME if appropriate.
      Always reply in Hinglish. Be concise.`,
    });

    console.log("AI Response for WhatsApp:", aiResponse);

    // 5. Logical Branching
    let replyMessage = aiResponse.reply_message;

    if (aiResponse.intent === 'SUGGEST_DOCTOR') {
        const doctor = await prisma.doctor.findFirst({
          where: { name: { contains: aiResponse.suggested_doctor || "", mode: 'insensitive' } }
        });
        
        const targetDoctorId = doctor?.id || (doctors.length > 0 ? doctors[0].id : null);

        if (targetDoctorId) {
            await prisma.patient.update({
              where: { id: patient.id },
              data: {
                conversationState: 'DOCTOR_SUGGESTED',
                lastSuggestedDoctorId: targetDoctorId,
                lastSymptoms: aiResponse.symptoms || finalText
              } as any
            });
        }
    } else if (aiResponse.intent === 'CONFIRM_DOCTOR' && (patient as any).conversationState === 'DOCTOR_SUGGESTED') {
        await prisma.patient.update({
          where: { id: patient.id },
          data: { conversationState: 'AWAITING_TIME' } as any
        });
    } else if (aiResponse.intent === 'PROVIDE_TIME' || (aiResponse.time_preference && (patient as any).conversationState === 'AWAITING_TIME')) {
        if (aiResponse.time_preference && (patient as any).lastSuggestedDoctorId) {
            const proposedTime = new Date(aiResponse.time_preference);
            
            // Availability Check (30 min window)
            const thirtyMins = 30 * 60 * 1000;
            const existingAppointment = await prisma.appointment.findFirst({
              where: {
                doctorId: (patient as any).lastSuggestedDoctorId,
                date: {
                  gte: new Date(proposedTime.getTime() - thirtyMins),
                  lte: new Date(proposedTime.getTime() + thirtyMins),
                },
                status: { not: 'CANCELLED' }
              }
            });

            if (existingAppointment) {
                replyMessage = `I'm sorry, that slot is already taken. Dr. ke paas dusra time available hai. Kya aap koi aur time choose kar sakte hain?`;
                // Keep state as AWAITING_TIME
            } else {
                await prisma.patient.update({
                  where: { id: patient.id },
                  data: {
                    conversationState: 'AWAITING_CONFIRMATION',
                    lastProposedTime: proposedTime
                  } as any
                });
                replyMessage = `Theek hai, ${proposedTime.toLocaleString()} par slot khali hai. Kya main aapka appointment pakka (confirm) kar du?`;
            }
        } else {
            replyMessage = "Kripya karke sahi date aur time batayein.";
        }
    } else if (aiResponse.intent === 'BOOK_APPOINTMENT' && (patient as any).conversationState === 'AWAITING_CONFIRMATION') {
        if ((patient as any).lastSuggestedDoctorId && (patient as any).lastProposedTime) {
          await prisma.appointment.create({
            data: {
              patientId: patient.id,
              doctorId: (patient as any).lastSuggestedDoctorId,
              date: (patient as any).lastProposedTime,
              symptoms: (patient as any).lastSymptoms || finalText,
              status: "CONFIRMED"
            }
          });

          await prisma.patient.update({
            where: { id: patient.id },
            data: {
              conversationState: 'IDLE',
              lastSuggestedDoctorId: null,
              lastSymptoms: null,
              lastProposedTime: null
            } as any
          });
          replyMessage = "Aapka appointment successfully book ho gaya hai! See you soon.";
        }
    } else if (aiResponse.intent === 'CANCEL_APPOINTMENT') {
        await prisma.patient.update({
          where: { id: patient.id },
          data: {
            conversationState: 'IDLE',
            lastSuggestedDoctorId: null,
            lastSymptoms: null,
            lastProposedTime: null
          } as any
        });
    }

    // 6. Send Reply
    await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, replyMessage);
    
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
