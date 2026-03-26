import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

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

    if (payload.event !== "MoMessage") return NextResponse.json({ success: true });

    let finalText: string | null = null;
    if (payload.content?.contentType === "text") {
      finalText = payload.content.text?.trim() || null;
    } else if (payload.content?.contentType === "media") {
      await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, "I'm sorry, voice messages are currently not supported.");
      return NextResponse.json({ success: true });
    }

    if (!finalText) return NextResponse.json({ success: true });

    const phone = payload.from;
    let patient = await prisma.patient.findUnique({ where: { phone } });
    if (!patient) {
      patient = await prisma.patient.create({ 
        data: { phone, name: payload.whatsapp?.senderName || "New Patient" } 
      });
    }

    // 1. HANDLE NUMERIC PICK (1-5)
    const currentState = (patient as any).conversationState;
    const canPickSlot = ['AWAITING_TIME', 'DOCTOR_SUGGESTED','AWAITING_CONFIRMATION'].includes(currentState);
    const canPickCancel = currentState === 'AWAITING_CANCEL_PICK';

    if ((canPickSlot || canPickCancel) && /^[1-5]$/.test(finalText)) {
        const index = parseInt(finalText) - 1;
        const items = (patient as any).lastSuggestedSlots as string[];
        
        if (items && items[index]) {
            if (canPickCancel) {
                const appId = items[index];
                const cancelledApp = await prisma.appointment.update({
                    where: { id: appId },
                    data: { status: 'CANCELLED' },
                    include: { doctor: true }
                });
                await prisma.patient.update({
                    where: { id: patient.id },
                    data: { conversationState: 'IDLE', lastSuggestedSlots: [] } as any
                });
                const formattedTime = new Date(cancelledApp.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
                await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, `Aapka ${cancelledApp.doctor.name} ke saath ${formattedTime} ka appointment cancel kar diya gaya hai.`);
                return NextResponse.json({ success: true });
            } else {
                const chosenTime = new Date(items[index]);
                
                // CHECK FOR PATIENT BUSY AT THIS TIME
                const patientBusy = await prisma.appointment.findFirst({
                    where: { 
                        patientId: patient.id, 
                        date: chosenTime, 
                        status: 'CONFIRMED' 
                    },
                    include: { doctor: true }
                });

                if (patientBusy) {
                    const timeStr = chosenTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
                    await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, `Aapka is samay (${timeStr}) par already ${patientBusy.doctor.name} ke saath appointment hai. Kripya koi aur option choose karein.`);
                    return NextResponse.json({ success: true });
                }

                await prisma.patient.update({
                  where: { id: patient.id },
                  data: { conversationState: 'AWAITING_CONFIRMATION', lastProposedTime: chosenTime } as any
                });
                const formattedTime = chosenTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
                const doc = await prisma.doctor.findUnique({ where: { id: (patient as any).lastSuggestedDoctorId } });
                
                const msg = `Theek hai, aapne ${doc?.name || "Doctor"} ke liye option ${finalText} choose kiya hai: ${formattedTime}. Kya main ye appointment confirm kar du?`;
                await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, msg);
                return NextResponse.json({ success: true });
            }
        }
    }

    if (canPickCancel && (finalText.toLowerCase().includes('no') || finalText.toLowerCase().includes('exit') || finalText.toLowerCase().includes('back'))) {
        await prisma.patient.update({
            where: { id: patient.id },
            data: { conversationState: 'IDLE', lastSuggestedSlots: [] } as any
        });
        await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, "Theek hai, cancellation cancel kar di gayi hai.");
        return NextResponse.json({ success: true });
    }

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const startOfTodayIST = new Date(now.getTime() + istOffset);
    startOfTodayIST.setUTCHours(0, 0, 0, 0);
    const startOfTodayUTC = new Date(startOfTodayIST.getTime() - istOffset);
    const nextDayUTC = new Date(startOfTodayUTC.getTime() + 24 * 60 * 60 * 1000);

    // 2. AI INTENT DETECTION
    const doctors = await prisma.doctor.findMany();
    const doctorsContext = doctors.map(d => `ID: ${d.id}, Name: ${d.name} (${d.specialization})`).join('\n');
    let lastDoctorName = "None";
    if ((patient as any).lastSuggestedDoctorId) {
        lastDoctorName = doctors.find(d => d.id === (patient as any).lastSuggestedDoctorId)?.name || "None";
    }

    const { createMistral } = await import('@ai-sdk/mistral');
    const mistral = createMistral({ apiKey: process.env.MISTRAL_API_KEY! });

    const { object: aiResponse } = await generateObject({
      model: mistral('mistral-medium-latest'), 
      schema: z.object({
        intent: z.enum(['GENERAL_REPLY', 'SUGGEST_DOCTOR', 'CONFIRM_DOCTOR', 'PROVIDE_TIME', 'BOOK_APPOINTMENT', 'CANCEL_APPOINTMENT', 'RESTART', 'VIEW_APPOINTMENTS']),
        symptoms: z.string().optional(),
        suggested_doctor_id: z.string().optional(),
        suggested_doctor: z.string().optional(),
        time_preference: z.string().optional(),
        requested_date: z.string().optional(),
        reply_message: z.string(),
      }),
      prompt: `You are clinical assistant "ClinicManager". Current IST Time: ${new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})}.
      Patient: ${patient.name}, State: ${(patient as any).conversationState}, Last Doctor: ${lastDoctorName}
      Message: "${finalText}"
      Available: ${doctorsContext}
      - If state is IDLE/RESTART and symptoms mentioned -> SUGGEST_DOCTOR. Use the exact ID from the list below.
      - If user says YES/confirm to a doctor -> CONFIRM_DOCTOR (Stay with ${lastDoctorName}).
      - If user asks for time/date -> PROVIDE_TIME or extract requested_date.
      - If state is AWAITING_CONFIRMATION and user says YES/OK/Book -> BOOK_APPOINTMENT (With ${lastDoctorName}).
      - If user asks to see their booking/appointment/list -> VIEW_APPOINTMENTS.
      - If user wants to cancel an appointment -> CANCEL_APPOINTMENT.
      - IMPORTANT: When suggesting a doctor, you MUST return the correct "suggested_doctor_id" from the list.
      - Max 2-3 sentences. Hinglish only.`,
    });

    // 3. STATE MACHINE
    let nextState = (patient as any).conversationState;
    let finalDocId = (patient as any).lastSuggestedDoctorId;
    let finalProposedTime = (patient as any).lastProposedTime;

    const suggestedDoctor = aiResponse.suggested_doctor;
    const suggestedDoctorId = aiResponse.suggested_doctor_id;

    // Helper to get doctor display name
    const getDocDisplay = (id: string | null) => {
        if (!id) return "Doctor";
        const d = doctors.find(doc => doc.id === id);
        return d ? `${d.name} (${d.specialization})` : "Doctor";
    };

    if (aiResponse.intent === 'RESTART') {
        nextState = 'IDLE'; finalDocId = null; finalProposedTime = null;
        aiResponse.reply_message = "Theek hai, shuru se start karte hain. Aapko kya symptoms hain ya kis doctor se milna hai?";
    }

    const isConfirming = finalText && (finalText.toLowerCase().includes('yes') || finalText.toLowerCase().includes('haan') || finalText.toLowerCase().includes('ok') || finalText.toLowerCase().includes('confirm') || finalText.toLowerCase().includes('theek hai'));

    // Force CONFIRM_DOCTOR if user says "Yes" while in DOCTOR_SUGGESTED
    if (nextState === 'DOCTOR_SUGGESTED' && isConfirming) {
        aiResponse.intent = 'CONFIRM_DOCTOR';
    }

    if (aiResponse.intent === 'SUGGEST_DOCTOR' || (aiResponse.intent === 'RESTART' && (suggestedDoctor || suggestedDoctorId))) {
        if (suggestedDoctorId) {
            const doc = doctors.find(d => d.id === suggestedDoctorId);
            if (doc) finalDocId = doc.id;
        } else if (suggestedDoctor) {
            const doc = doctors.find(d => 
                d.name.toLowerCase().includes(suggestedDoctor.toLowerCase()) || 
                d.specialization.toLowerCase().includes(suggestedDoctor.toLowerCase())
            );
            if (doc) finalDocId = doc.id;
        }
        nextState = 'DOCTOR_SUGGESTED';
    } else if (aiResponse.intent === 'CONFIRM_DOCTOR' && nextState === 'DOCTOR_SUGGESTED') {
        nextState = 'AWAITING_TIME';
        aiResponse.reply_message = `${getDocDisplay(finalDocId)} ke saath appointment confirm karne ke liye aapko kaun sa time pasand hai? Main aapko available slots bata deta hoon.`;
    } else if ((aiResponse.intent === 'BOOK_APPOINTMENT' || (isConfirming && nextState === 'AWAITING_CONFIRMATION')) && nextState === 'AWAITING_CONFIRMATION') {
        const doc = doctors.find(d => d.id === finalDocId);
        const time = (patient as any).lastProposedTime;
        const formatted = time ? new Date(time).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "";
        await prisma.appointment.create({
            data: { patientId: patient!.id, doctorId: finalDocId!, date: time!, symptoms: (patient as any).lastSymptoms || finalText, status: "CONFIRMED" }
        });
        nextState = 'IDLE'; finalDocId = null; finalProposedTime = null;
        aiResponse.reply_message = `Aapka ${getDocDisplay((patient as any).lastSuggestedDoctorId)} ke saath ${formatted} ka appointment confirm ho gaya hai! Thank you.`;
    } else if (aiResponse.intent === 'CANCEL_APPOINTMENT') {
        const futureApps = await prisma.appointment.findMany({
            where: { patientId: patient!.id, status: 'CONFIRMED', date: { gte: startOfTodayUTC } },
            include: { doctor: true },
            orderBy: { date: 'asc' }
        });

        if (futureApps.length === 0) {
            aiResponse.reply_message = "Aapka koi upcoming confirmed appointment nahi mila.";
            nextState = 'IDLE';
        } else {
            const list = futureApps.map((a, i) => {
                const d = new Date(a.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
                return `${i + 1}. ${a.doctor.name} - ${d}`;
            }).join('\n');
            aiResponse.reply_message = `Aap kaun sa appointment cancel karna chahte hain? Please number choose karein (1-${futureApps.length}):\n\n${list}\n\nType "no" ya "exit" cancel karne ke liye.`;
            nextState = 'AWAITING_CANCEL_PICK';
            await prisma.patient.update({
                where: { id: patient!.id },
                data: { lastSuggestedSlots: futureApps.map(a => a.id), conversationState: 'AWAITING_CANCEL_PICK' } as any
            });
            await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, aiResponse.reply_message);
            return NextResponse.json({ success: true });
        }
    } else if (aiResponse.intent === 'VIEW_APPOINTMENTS') {
        const futureApps = await prisma.appointment.findMany({
            where: { patientId: patient!.id, status: 'CONFIRMED', date: { gte: startOfTodayUTC } },
            include: { doctor: true },
            orderBy: { date: 'asc' }
        });
        
        if (futureApps.length > 0) {
            const list = futureApps.map(a => {
                const d = new Date(a.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
                return `• ${a.doctor.name} - ${d}`;
            }).join('\n');
            aiResponse.reply_message = `Aapke upcoming appointments ye hain:\n\n${list}`;
        } else {
            aiResponse.reply_message = "Aapka koi upcoming appointment nahi mila. Kya main naya book karne mein madad karu?";
        }
        nextState = 'IDLE';
    } else if (aiResponse.intent === 'PROVIDE_TIME') {
        aiResponse.reply_message = `${getDocDisplay(finalDocId)} ke liye available slots ye rahi. Aap kaun sa samay chunna chahenge?`;
    }

    // Same symptom check
    if (aiResponse.intent === 'SUGGEST_DOCTOR' || aiResponse.intent === 'CONFIRM_DOCTOR') {
        const currentSymptom = (aiResponse.symptoms || finalText).toLowerCase();
        const existingAppWithSameSymptom = await prisma.appointment.findFirst({
            where: { 
                patientId: patient!.id, 
                status: 'CONFIRMED', 
                symptoms: { contains: currentSymptom, mode: 'insensitive' },
                date: { gte: startOfTodayUTC }
            },
            include: { doctor: true }
        });

        if (existingAppWithSameSymptom) {
            aiResponse.reply_message = `Aapka is problem (symptoms: ${existingAppWithSameSymptom.symptoms}) ke liye already ek upcoming appointment hai: ${existingAppWithSameSymptom.doctor.name} ke saath. Alag problem ke liye aap naya appointment book kar sakte hain.`;
            nextState = 'IDLE';
        }
    }

    patient = await prisma.patient.update({
        where: { id: patient!.id },
        data: { 
            conversationState: nextState, 
            lastSuggestedDoctorId: finalDocId, 
            lastProposedTime: finalProposedTime, 
            lastSymptoms: (aiResponse.symptoms || (nextState === 'DOCTOR_SUGGESTED' ? finalText : (patient as any).lastSymptoms))
        } as any
    });

    // 4. SLOT GEN
    let slotText = "";
    if (nextState === 'AWAITING_TIME' || aiResponse.intent === 'PROVIDE_TIME' || aiResponse.requested_date) {
        if (finalDocId) {
            // Fetch Doctor specific hours, fallback to Clinic Config
            const doc = await prisma.doctor.findUnique({ where: { id: finalDocId } });
            const clinicConfig = (await prisma.clinicConfig.findUnique({ where: { id: 'default' } })) || { openTime: 9, closeTime: 18 };
            
            const OPEN_H = doc?.openTime ?? clinicConfig.openTime;
            const CLOSE_H = doc?.closeTime ?? clinicConfig.closeTime;

            const now = new Date(); const istOffset = 5.5 * 60 * 60 * 1000;
            const nowIST = new Date(now.getTime() + istOffset);
            let checkTime = new Date(now.getTime());

            if (aiResponse.requested_date) {
                const d = new Date(aiResponse.requested_date);
                // Only jump to that day if it's NOT today
                if (d.getUTCDate() !== nowIST.getUTCDate() || d.getUTCMonth() !== nowIST.getUTCMonth()) {
                    if (d > now) {
                        checkTime = d;
                        const targetIST = new Date(checkTime.getTime() + istOffset);
                        targetIST.setUTCHours(OPEN_H, 0, 0, 0);
                        checkTime = new Date(targetIST.getTime() - istOffset);
                    }
                }
            }

            // Initialization final polish
            const currentIST = new Date(checkTime.getTime() + istOffset);
            if (currentIST.getUTCHours() < OPEN_H) {
                currentIST.setUTCHours(OPEN_H, 0, 0, 0);
                checkTime = new Date(currentIST.getTime() - istOffset);
            } else if (currentIST.getUTCHours() >= CLOSE_H) {
                currentIST.setDate(currentIST.getDate() + 1);
                currentIST.setUTCHours(OPEN_H, 0, 0, 0);
                checkTime = new Date(currentIST.getTime() - istOffset);
            } else {
                checkTime.setMinutes(checkTime.getMinutes() + (30 - (checkTime.getMinutes() % 30)), 0, 0);
            }
            checkTime.setSeconds(0, 0); checkTime.setMilliseconds(0);

            const bookedByDoctor = (await prisma.appointment.findMany({ where: { doctorId: finalDocId, date: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }, status: { not: 'CANCELLED' } } })).map(a => { const d = new Date(a.date); d.setSeconds(0,0); d.setMilliseconds(0); return d.getTime(); });
            const bookedByPatient = (await prisma.appointment.findMany({ where: { patientId: patient.id, date: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }, status: { not: 'CANCELLED' } } })).map(a => { const d = new Date(a.date); d.setSeconds(0,0); d.setMilliseconds(0); return d.getTime(); });
            const booked = Array.from(new Set([...bookedByDoctor, ...bookedByPatient]));
            
            const display: string[] = []; const isoSlots: string[] = [];
            while (display.length < 5) {
                const t = checkTime.getTime();
                const hIST = new Date(t + istOffset).getUTCHours();
                if (hIST >= OPEN_H && hIST < CLOSE_H) {
                    if (!booked.includes(t) && t >= (now.getTime() - 60000)) { 
                        display.push(`${display.length + 1}. ${checkTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true })}`);
                        isoSlots.push(checkTime.toISOString());
                    }
                } else if (hIST >= CLOSE_H) {
                    if (display.length > 0) break; // Found some slots today, STOP here
                    const nextD = new Date(new Date(t + istOffset).getTime() + 24*60*60*1000); nextD.setUTCHours(OPEN_H,0,0,0); checkTime = new Date(nextD.getTime() - istOffset); continue;
                }
                checkTime = new Date(checkTime.getTime() + 30 * 60 * 1000);
                checkTime.setSeconds(0, 0); checkTime.setMilliseconds(0);
            }
            if (display.length > 0) {
                slotText = `\n\nSlots:\n${display.join('\n')}\n\nReply number (1-5).`;
                await prisma.patient.update({ where: { id: patient.id }, data: { lastSuggestedSlots: isoSlots } as any });
            }
        }
    }

    let finalReply = aiResponse.reply_message;
    if (slotText) finalReply += slotText;
    await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, finalReply);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "clinicmanager_secret";
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return new NextResponse(challenge, { status: 200 });
  return new NextResponse('Forbidden', { status: 403 });
}
