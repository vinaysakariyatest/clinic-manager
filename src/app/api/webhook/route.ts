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
        intent: z.enum(['GENERAL_REPLY', 'SUGGEST_DOCTOR', 'BOOK_APPOINTMENT', 'CANCEL_APPOINTMENT']),
        symptoms: z.string().optional().describe('Patient symptoms if mentioned'),
        suggested_doctor: z.string().optional().describe('Name of the suggested doctor among the available doctors'),
        time_preference: z.string().optional().describe('Preferred time mentioned by patient in ISO format if possible, otherwise keep empty'),
        reply_message: z.string().describe('Friendly reply in Hinglish. Be helpful and professional. Max 2 sentences.'),
      }),
      prompt: `You are clinical assistant "ClinicManager". Analyze patient message and determine next steps.
      Context: Patient Name: ${patient.name}, Message: "${finalText}"
      Current Conversation State: ${patient.conversationState}
      Last Suggested Doctor ID: ${patient.lastSuggestedDoctorId || 'None'}
      Last Symptoms Mentioned: ${patient.lastSymptoms || 'None'}
      Available Doctors: ${doctorsContext}
      
      Instructions:
      - If state is IDLE and patient mentions symptoms or wants to book, suggest a doctor and ask to confirm (intent: SUGGEST_DOCTOR). Do NOT book the appointment yet.
      - If state is DOCTOR_SUGGESTED and patient confirms ("yes", "ok", "haan", "sure", "kardo"), book the appointment (intent: BOOK_APPOINTMENT). Note: confirm message must correspond to booking intent.
      - If state is DOCTOR_SUGGESTED and patient says "no" or asks for another, suggest someone else or say ok (intent: GENERAL_REPLY).
      - If patient is just greeting or asking general questions, just reply normally (intent: GENERAL_REPLY).
      - Always reply in Hinglish. Example reply for suggestion: "Aapke symptoms ke liye Dr. Sharma best rahenge. Kya main kal ka appointment book kar du?"`,
    });

    console.log("AI Response for WhatsApp:", aiResponse);

    // 5. Logical Branching
    if (aiResponse.intent === 'SUGGEST_DOCTOR') {
        const doctor = await prisma.doctor.findFirst({
          where: { name: { contains: aiResponse.suggested_doctor || "", mode: 'insensitive' } }
        });
        
        // If doctor found, store context. Otherwise fallback to first doctor
        let targetDoctorId = doctor?.id;
        if (!targetDoctorId && doctors.length > 0) {
            targetDoctorId = doctors[0].id;
        }

        if (targetDoctorId) {
            await prisma.patient.update({
              where: { id: patient.id },
              data: {
                conversationState: 'DOCTOR_SUGGESTED',
                lastSuggestedDoctorId: targetDoctorId,
                lastSymptoms: aiResponse.symptoms || finalText
              }
            });
        }
    } else if (aiResponse.intent === 'BOOK_APPOINTMENT' && patient.conversationState === 'DOCTOR_SUGGESTED') {
        if (patient.lastSuggestedDoctorId) {
          await prisma.appointment.create({
            data: {
              patientId: patient.id,
              doctorId: patient.lastSuggestedDoctorId,
              date: aiResponse.time_preference ? new Date(aiResponse.time_preference) : new Date(new Date().setHours(new Date().getHours() + 24)),
              symptoms: patient.lastSymptoms || finalText,
              status: "PENDING"
            }
          });

          await prisma.patient.update({
            where: { id: patient.id },
            data: {
              conversationState: 'IDLE',
              lastSuggestedDoctorId: null,
              lastSymptoms: null
            }
          });
        }
    } else if (aiResponse.intent === 'GENERAL_REPLY' || aiResponse.intent === 'CANCEL_APPOINTMENT') {
        // Reset state if they are chatting something else
        if (patient.conversationState !== 'IDLE') {
           await prisma.patient.update({
              where: { id: patient.id },
              data: {
                conversationState: 'IDLE',
                lastSuggestedDoctorId: null,
                lastSymptoms: null
              }
            });
        }
    }

    // 6. Send Reply (via 11za/Standard API)
    // Note: Use standard sender helper, adapter for 11za if needed later
    await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, aiResponse.reply_message);
    
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
