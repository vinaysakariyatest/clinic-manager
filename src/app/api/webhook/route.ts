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
    // Normalize finalText
    let finalText: string | null = null;
    if (payload.content?.contentType === "text") {
      finalText = payload.content.text?.trim() || null;
    } else if (payload.content?.contentType === "media") {
      await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, "I'm sorry, voice messages are currently not supported. Please send a text message.");
      return NextResponse.json({ success: true });
    }

    if (!finalText) return NextResponse.json({ success: true });

    // Ensure patient exists in DB
    const phone = payload.from;
    let patient = await prisma.patient.findUnique({ where: { phone } });
    if (!patient) {
      patient = await prisma.patient.create({ 
        data: { phone, name: payload.whatsapp?.senderName || "New Patient" } 
      });
    }

    // 1. HANDLE NUMERIC PICK (1-5) IMMEDIATELY (Only if we have suggestions)
    const canPickSlot = ['AWAITING_TIME', 'DOCTOR_SUGGESTED','AWAITING_CONFIRMATION'].includes((patient as any).conversationState);
    if (canPickSlot && /^[1-5]$/.test(finalText)) {
        const index = parseInt(finalText) - 1;
        const slots = (patient as any).lastSuggestedSlots as string[];
        if (slots && slots[index] && (patient as any).lastSuggestedDoctorId) {
            const chosenTime = new Date(slots[index]);
            const updatedPatient = await prisma.patient.update({
              where: { id: patient.id },
              data: { conversationState: 'AWAITING_CONFIRMATION', lastProposedTime: chosenTime } as any
            });
            const formattedTime = chosenTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
            const doc = await prisma.doctor.findUnique({ where: { id: (patient as any).lastSuggestedDoctorId } });
            
            const msg = `Theek hai, aapne ${doc?.name || "Doctor"} ke liye option ${finalText} choose kiya hai: ${formattedTime}. Kya main ye appointment confirm kar du? (HAAN/YES)`;
            await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, msg);
            return NextResponse.json({ success: true });
        }
    }

    // 2. AI INTENT DETECTION
    const doctors = await prisma.doctor.findMany();
    const doctorsContext = doctors.map(d => `${d.name} (${d.specialization})`).join(', ');
    
    let lastDoctorName = "None";
    if ((patient as any).lastSuggestedDoctorId) {
        const lastDoc = doctors.find(d => d.id === (patient as any).lastSuggestedDoctorId);
        lastDoctorName = lastDoc?.name || "None";
    }

    const { createMistral } = await import('@ai-sdk/mistral');
    const mistral = createMistral({ apiKey: process.env.MISTRAL_API_KEY! });

    const { object: aiResponse } = await generateObject({
      model: mistral('mistral-medium-latest'), 
      schema: z.object({
        intent: z.enum(['GENERAL_REPLY', 'SUGGEST_DOCTOR', 'CONFIRM_DOCTOR', 'PROVIDE_TIME', 'BOOK_APPOINTMENT', 'CANCEL_APPOINTMENT', 'RESTART']),
        symptoms: z.string().optional(),
        suggested_doctor: z.string().optional(),
        time_preference: z.string().optional(),
        requested_date: z.string().optional(),
        reply_message: z.string(),
      }),
      prompt: `You are clinical assistant "ClinicManager". Current IST Time: ${new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})}.
      Patient: ${patient.name}
      Message: "${finalText}"
      State: ${(patient as any).conversationState}
      Last Doctor: ${lastDoctorName}
      Available: ${doctorsContext}
      
      Instructions:
      - If state is IDLE/RESTART and symptoms mentioned -> SUGGEST_DOCTOR.
      - If state is DOCTOR_SUGGESTED and patient confirms -> CONFIRM_DOCTOR. (Stick to ${lastDoctorName}).
      - If user asks for time/date -> PROVIDE_TIME or extract requested_date.
      - If confirmed -> BOOK_APPOINTMENT.
      - Max 2-3 sentences. Hinglish only.`,
    });

    // 3. STATE MACHINE TRANSITIONS
    let nextState = (patient as any).conversationState;
    let finalDocId = (patient as any).lastSuggestedDoctorId;
    let finalProposedTime = (patient as any).lastProposedTime;

    if (aiResponse.intent === 'RESTART') {
        nextState = 'IDLE';
        finalDocId = null;
        finalProposedTime = null;
        // Proceed to let AI handle the next part if symptoms also provided
    }

    if (aiResponse.intent === 'SUGGEST_DOCTOR' || (aiResponse.intent === 'RESTART' && aiResponse.suggested_doctor)) {
        const doc = doctors.find(d => d.name.toLowerCase().includes(aiResponse.suggested_doctor?.toLowerCase() || ""));
        finalDocId = doc?.id || (doctors[0]?.id);
        nextState = 'DOCTOR_SUGGESTED';
    } else if (aiResponse.intent === 'CONFIRM_DOCTOR' && nextState === 'DOCTOR_SUGGESTED') {
        nextState = 'AWAITING_TIME';
    } else if (aiResponse.intent === 'BOOK_APPOINTMENT' && nextState === 'AWAITING_CONFIRMATION') {
        // Create actual appointment
        await prisma.appointment.create({
            data: {
              patientId: patient!.id,
              doctorId: (patient as any).lastSuggestedDoctorId,
              date: (patient as any).lastProposedTime,
              symptoms: (patient as any).lastSymptoms || finalText,
              status: "CONFIRMED"
            }
        });
        nextState = 'IDLE';
        finalDocId = null;
        finalProposedTime = null;
    } else if (aiResponse.intent === 'CANCEL_APPOINTMENT') {
        nextState = 'IDLE';
        finalDocId = null;
        finalProposedTime = null;
    }

    // Persist State
    patient = await prisma.patient.update({
        where: { id: patient!.id },
        data: {
            conversationState: nextState,
            lastSuggestedDoctorId: finalDocId,
            lastProposedTime: finalProposedTime,
            lastSymptoms: aiResponse.symptoms || (nextState === 'DOCTOR_SUGGESTED' ? finalText : (patient as any).lastSymptoms)
        } as any
    });

    // 4. GENERATE SLOT LIST IF IN AWAITING_TIME
    let slotText = "";
    if (nextState === 'AWAITING_TIME' || aiResponse.requested_date) {
        const docId = finalDocId;
        if (docId) {
            const now = new Date();
            const istOffset = 5.5 * 60 * 60 * 1000;
            let checkTime = new Date(now.getTime());
            
            if (aiResponse.requested_date) {
                const reqDate = new Date(aiResponse.requested_date);
                if (reqDate > now) checkTime = reqDate;
            }

            // Align to 9 AM IST if needed
            const currentIST = new Date(checkTime.getTime() + istOffset);
            if (currentIST.getUTCHours() < 9) {
                currentIST.setUTCHours(9, 0, 0, 0);
                checkTime = new Date(currentIST.getTime() - istOffset);
            } else {
                checkTime.setMinutes(checkTime.getMinutes() + (30 - (checkTime.getMinutes() % 30)), 0, 0);
            }

            const existing = await prisma.appointment.findMany({
                where: { doctorId: docId, date: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }, status: { not: 'CANCELLED' } }
            });
            const booked = existing.map(a => a.date.getTime());
            const display: string[] = [];
            const isoSlots: string[] = [];

            while (display.length < 5) {
                const hourIST = new Date(checkTime.getTime() + istOffset).getUTCHours();
                if (hourIST >= 9 && hourIST < 18) {
                    if (!booked.includes(checkTime.getTime())) {
                        display.push(`${display.length + 1}. ${checkTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true })}`);
                        isoSlots.push(checkTime.toISOString());
                    }
                } else if (hourIST >= 18) {
                    // Next day morning
                    const tomorrowIST = new Date(new Date(checkTime.getTime() + istOffset).getTime() + 24 * 60 * 60 * 1000);
                    tomorrowIST.setUTCHours(9, 0, 0, 0);
                    checkTime = new Date(tomorrowIST.getTime() - istOffset);
                    continue;
                }
                checkTime = new Date(checkTime.getTime() + 30 * 60 * 1000);
                if (checkTime.getTime() > now.getTime() + 14 * 24 * 60 * 60 * 1000) break;
            }
            
            if (display.length > 0) {
                slotText = `\n\nAb niche diye gaye slots mein se ek choose karein:\n${display.join('\n')}\n\nSirf number (1-5) reply karein.`;
                await prisma.patient.update({ where: { id: patient.id }, data: { lastSuggestedSlots: isoSlots } as any });
            }
        }
    }

    // 5. FINAL REPLY
    let finalReply = aiResponse.reply_message;
    if (slotText) finalReply += slotText;

    await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, finalReply);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
