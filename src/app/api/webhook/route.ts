import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
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
    let replyMessage: string = "";

    if (payload.content?.contentType === "text") {
      finalText = payload.content.text?.trim() || null;
    }

    if (payload.content?.contentType === "media") {
      replyMessage = "I'm sorry, voice messages are currently not supported. Please send a text message.";
    }

    if (!finalText) {
      return NextResponse.json({ success: true });
    }

    /* --------------------------------------------------
     * 4️⃣ PROCESS WITH AI (MISTRAL)
     * -------------------------------------------------- */
    const mistralKey = process.env.MISTRAL_API_KEY;
    
    if (!mistralKey) {
      console.error("CRITICAL: MISTRAL_API_KEY is missing in environment variables!");
      return NextResponse.json({ error: "Configuration Error: Mistral API Key missing" }, { status: 500 });
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

    // 4.1 NUMERIC SELECTION HANDLING
    if ((patient as any).conversationState === 'AWAITING_TIME' && /^[1-5]$/.test(finalText || "")) {
        const index = parseInt(finalText!) - 1;
        const slots = (patient as any).lastSuggestedSlots as string[];
        if (slots && slots[index]) {
            const chosenTime = new Date(slots[index]);
            await prisma.patient.update({
              where: { id: patient.id },
              data: {
                conversationState: 'AWAITING_CONFIRMATION',
                lastProposedTime: chosenTime
              } as any
            });
            const formattedTime = chosenTime.toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              dateStyle: "medium",
              timeStyle: "short"
            });
            const msg = `Theek hai, aapne option ${finalText} choose kiya hai: ${formattedTime}. Kya main ye appointment confirm kar du?`;
            await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, msg);
            return NextResponse.json({ success: true }, { status: 200 });
        }
    }

    // 1. First, we need to know if the user is asking for a specific date
    // We'll do a quick pre-analysis or just let the AI tell us.
    // Let's update the main generateObject to include detected_date.

    const { createMistral } = await import('@ai-sdk/mistral');
    const mistral = createMistral({
      apiKey: mistralKey
    });

    // We'll calculate slots after the first AI pass if we want to be very precise, 
    // OR just pass the next 7 days of availability summary.
    // Let's refine the prompt and the logic.

    const { object: aiResponse } = await generateObject({
      model: mistral('mistral-medium-latest'), 
      schema: z.object({
        intent: z.enum(['GENERAL_REPLY', 'SUGGEST_DOCTOR', 'CONFIRM_DOCTOR', 'PROVIDE_TIME', 'BOOK_APPOINTMENT', 'CANCEL_APPOINTMENT']),
        symptoms: z.string().optional(),
        suggested_doctor: z.string().optional(),
        time_preference: z.string().optional().describe('ISO format if specific time mentioned'),
        requested_date: z.string().optional().describe('ISO date if user asks for a specific day (e.g. tomorrow)'),
        reply_message: z.string().describe('Friendly reply in Hinglish.'),
      }),
      prompt: `You are clinical assistant "ClinicManager". Current time: ${new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})} (IST).
      
      Patient: ${patient.name}
      Message: "${finalText}"
      State: ${(patient as any).conversationState}
      Available Doctors: ${doctorsContext}
      
      Instructions:
      1. If user asks for a specific day (e.g. "Kal", "Next Monday", "26 March"), extract it in requested_date.
      2. If user confirms doctor, we need to show slots.
      Always reply in Hinglish. Be concise.`,
    });

    console.log("AI Response for WhatsApp:", aiResponse);

    // 4. SLOT SUGGESTION LOGIC (Moved after AI detection)
    let availableSlotsContext = "";
    let suggestedSlotsISO: string[] = [];
    
    if ((patient as any).lastSuggestedDoctorId || aiResponse.suggested_doctor) {
        const docId = (patient as any).lastSuggestedDoctorId || (await prisma.doctor.findFirst({
            where: { name: { contains: aiResponse.suggested_doctor || "", mode: 'insensitive' } }
        }))?.id;

        if (docId) {
            const now = new Date();
            const istOffset = 5.5 * 60 * 60 * 1000;
            
            // If AI detected a specific date, start looking from there
            let checkTime = new Date(now.getTime());
            if (aiResponse.requested_date) {
                checkTime = new Date(aiResponse.requested_date);
                // Ensure it's not in the past relative to 'now'
                if (checkTime < now) checkTime = new Date(now.getTime());
            }
            
            // Start at 9 AM IST of the check day
            const checkIST = new Date(checkTime.getTime() + istOffset);
            if (checkIST.getUTCHours() < 9) {
                checkIST.setUTCHours(9, 0, 0, 0);
                checkTime = new Date(checkIST.getTime() - istOffset);
            } else {
                // Round to next 30 min
                checkTime.setMinutes(checkTime.getMinutes() + (30 - (checkTime.getMinutes() % 30)), 0, 0);
            }

            const existingDocs = await prisma.appointment.findMany({
              where: {
                doctorId: docId,
                date: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
                status: { not: 'CANCELLED' }
              }
            });
            const bookedTimes = existingDocs.map(d => d.date.getTime());
            const displaySlots: string[] = [];

            while (displaySlots.length < 5) {
              const istTime = new Date(checkTime.getTime() + istOffset);
              const hour = istTime.getUTCHours();
              
              if (hour >= 9 && hour < 18) {
                if (!bookedTimes.includes(checkTime.getTime())) {
                  displaySlots.push(`${displaySlots.length + 1}. ${checkTime.toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true
                  })}`);
                  suggestedSlotsISO.push(checkTime.toISOString());
                }
              } else if (hour >= 18) {
                // Next day 9 AM IST
                const nextDay = new Date(istTime.getTime() + 24 * 60 * 60 * 1000);
                nextDay.setUTCHours(9, 0, 0, 0);
                checkTime = new Date(nextDay.getTime() - istOffset);
                continue; // Re-check this new time
              }
              checkTime = new Date(checkTime.getTime() + 30 * 60 * 1000);
              if (checkTime.getTime() > now.getTime() + 14 * 24 * 60 * 60 * 1000) break;
            }
            availableSlotsContext = displaySlots.join("\n");
            
            await prisma.patient.update({
              where: { id: patient.id },
              data: { lastSuggestedSlots: suggestedSlotsISO } as any
            });

            // If the user just asked for slots or confirmed doc, overwrite the reply to show these slots
            if (aiResponse.intent === 'CONFIRM_DOCTOR' || aiResponse.requested_date) {
                aiResponse.reply_message += `\n\nAvailable slots:\n${availableSlotsContext}\n\nKripya 1 se 5 ke beech koi number bhejein.`;
            }
        }
    }

    console.log("AI Response for WhatsApp:", aiResponse);

    // 5. Logical Branching
    // (replyMessage is already initialized above)
    replyMessage = aiResponse.reply_message;

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
            let proposedTimeStr = aiResponse.time_preference;
            // Force +05:30 if it's missing
            if (!proposedTimeStr.includes('+') && !proposedTimeStr.includes('-') && !proposedTimeStr.endsWith('Z')) {
                proposedTimeStr += '+05:30';
            }
            const proposedTime = new Date(proposedTimeStr);
            
            // Past Date Blocking
            if (proposedTime < new Date()) {
                replyMessage = `I'm sorry, aap bite hue waqt (past time) ka appointment nahi le sakte. Kripya koi future time choose karein. Available slots: ${availableSlotsContext}`;
            } else {
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
            } else {
                await prisma.patient.update({
                  where: { id: patient.id },
                  data: {
                    conversationState: 'AWAITING_CONFIRMATION',
                    lastProposedTime: proposedTime
                  } as any
                });
                const formattedTime = proposedTime.toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  dateStyle: "medium",
                  timeStyle: "short"
                });
                replyMessage = `Theek hai, ${formattedTime} par slot khali hai. Kya main aapka appointment pakka (confirm) kar du?`;
            }
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
