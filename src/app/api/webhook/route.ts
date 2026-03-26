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
    const nameFromWA = payload.whatsapp?.senderName || "New Patient";

    // FETCH OR CREATE CONVERSATION STATE (Don't create Patient yet)
    let pState = await prisma.patientState.upsert({
        where: { phone },
        update: {},
        create: { phone }
    });

    // CHECK IF ACTUAL PATIENT EXISTS
    let patient = await prisma.patient.findUnique({ where: { phone } });

    // 1. HANDLE NUMERIC PICK (1-5)
    const currentState = pState.conversationState;
    const canPickSlot = ['AWAITING_TIME', 'DOCTOR_SUGGESTED','AWAITING_CONFIRMATION'].includes(currentState);
    const canPickCancel = currentState === 'AWAITING_CANCEL_PICK';

    if ((canPickSlot || canPickCancel) && /^[1-5]$/.test(finalText)) {
        const index = parseInt(finalText) - 1;
        const items = pState.lastSuggestedSlots as string[];
        
        if (items && items[index]) {
            if (canPickCancel) {
                const appId = items[index];
                const cancelledApp = await prisma.appointment.update({
                    where: { id: appId },
                    data: { status: 'CANCELLED' },
                    include: { doctor: true, patient: true }
                });
                await prisma.patientState.update({
                    where: { phone },
                    data: { conversationState: 'IDLE', lastSuggestedSlots: [] }
                });
                const formattedTime = new Date(cancelledApp.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
                await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, `Aapka ${cancelledApp.doctor.name} ke saath ${formattedTime} ka appointment cancel kar diya gaya hai.`);
                return NextResponse.json({ success: true });
            } else {
                const chosenTime = new Date(items[index]);
                
                // CHECK FOR PATIENT BUSY AT THIS TIME (Only if patient already exists)
                if (patient) {
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
                }

                pState = await prisma.patientState.update({
                  where: { phone },
                  data: { conversationState: 'AWAITING_CONFIRMATION', lastProposedTime: chosenTime }
                });
                const formattedTime = chosenTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
                const doc = await prisma.doctor.findUnique({ where: { id: pState.lastSuggestedDoctorId || "" } });
                
                const msg = `Theek hai, aapne ${doc?.name || "Doctor"} ke liye option ${finalText} choose kiya hai: ${formattedTime}. Kya main ye appointment confirm kar du?`;
                await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, msg);
                return NextResponse.json({ success: true });
            }
        }
    }

    if (canPickCancel && (finalText.toLowerCase().includes('no') || finalText.toLowerCase().includes('exit') || finalText.toLowerCase().includes('back'))) {
        await prisma.patientState.update({
            where: { phone },
            data: { conversationState: 'IDLE', lastSuggestedSlots: [] }
        });
        await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, "Theek hai, cancellation cancel kar di gayi hai.");
        return NextResponse.json({ success: true });
    }

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const startOfTodayIST = new Date(now.getTime() + istOffset);
    startOfTodayIST.setUTCHours(0, 0, 0, 0);
    const startOfTodayUTC = new Date(startOfTodayIST.getTime() - istOffset);

    // 2. AI INTENT DETECTION
    const doctors = await prisma.doctor.findMany();
    const doctorsContext = doctors.map(d => `ID: ${d.id}, Name: ${d.name} (${d.specialization})`).join('\n');
    let lastDoctorName = "None";
    if (pState.lastSuggestedDoctorId) {
        lastDoctorName = doctors.find(d => d.id === pState.lastSuggestedDoctorId)?.name || "None";
    }

    const { createMistral } = await import('@ai-sdk/mistral');
    const mistral = createMistral({ apiKey: process.env.MISTRAL_API_KEY! });

    // Try to get patient name for prompt
    const patientNameForPrompt = patient?.name || nameFromWA || "Patient";

    const { object: aiResponse } = await generateObject({
      model: mistral('mistral-medium-latest'), 
      schema: z.object({
        intent: z.enum(['GENERAL_REPLY', 'SUGGEST_DOCTOR', 'CONFIRM_DOCTOR', 'PROVIDE_TIME', 'BOOK_APPOINTMENT', 'CANCEL_APPOINTMENT', 'RESTART', 'VIEW_APPOINTMENTS']),
        reply_message: z.string(),
        symptoms: z.string().optional(),
        suggested_doctor_id: z.string().optional(),
        suggested_doctor: z.string().optional(),
        specialization: z.string().optional(),
        suggested_time: z.string().optional(),
        requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Extracted date in YYYY-MM-DD. IMPORTANT: If user mentions a specific day like "28 March", extract it strictly.'),
      }),
      prompt: `You are clinical assistant "ClinicManager". Current IST Time: ${new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})}.
      Patient: ${patientNameForPrompt}, State: ${pState.conversationState}, Last Doctor: ${lastDoctorName}
      Message: "${finalText}"
      Available Doctors: ${doctorsContext}
      - If state is IDLE/RESTART and symptoms mentioned -> SUGGEST_DOCTOR. Use the exact ID from the list below.
      - If user says YES/confirm to a doctor -> CONFIRM_DOCTOR (Stay with ${lastDoctorName}).
      - If user asks for time/date (e.g., "28 March ka do") -> PROVIDE_TIME and extract requested_date.
      - If state is AWAITING_CONFIRMATION and user says YES/OK/Book -> BOOK_APPOINTMENT (With ${lastDoctorName}).
      - If user asks to see their booking/appointment/list -> VIEW_APPOINTMENTS.
      - If user wants to cancel an appointment -> CANCEL_APPOINTMENT.
      - IMPORTANT: When suggesting a doctor, you MUST return the correct "suggested_doctor_id" from the list.
      - Max 2-3 sentences. Hinglish only.`,
    });

    console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

    // 3. STATE MACHINE
    let nextState = pState.conversationState;
    let finalDocId = pState.lastSuggestedDoctorId;
    let finalProposedTime = pState.lastProposedTime;

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

    if (aiResponse.intent === 'SUGGEST_DOCTOR' || (aiResponse.intent === 'RESTART' && (suggestedDoctor || suggestedDoctorId || aiResponse.specialization))) {
        let matchFound = false;
        if (suggestedDoctorId) {
            const doc = doctors.find(d => d.id === suggestedDoctorId);
            if (doc) {
                finalDocId = doc.id;
                matchFound = true;
            }
        } else if (aiResponse.suggested_doctor || aiResponse.specialization) {
            const matched = doctors.find(d => 
                (aiResponse.suggested_doctor && d.name.toLowerCase().includes(aiResponse.suggested_doctor.toLowerCase())) ||
                (aiResponse.specialization && d.specialization.toLowerCase().includes(aiResponse.specialization.toLowerCase()))
            );
            if (matched) {
                finalDocId = matched.id;
                matchFound = true;
            }
        }

        if (!matchFound && (pState.conversationState === 'IDLE' || pState.conversationState === 'RESTART')) {
            // NO MATCH FOUND for the suggested specialization/doctor and it's a new request
            const body = `Maaf kijiye, hamare clinic par abhi *${aiResponse.specialization || aiResponse.suggested_doctor || 'aapki requirement'}* ke liye specialist doctor available nahi hain. Kripya kisi aur problem ke liye slots dekhein ya hamare reception par contact karein. धन्यवाद!`;
            await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, body);
            return NextResponse.json({ success: true });
        } else if (matchFound) {
            nextState = 'DOCTOR_SUGGESTED';
        }
    } else if (aiResponse.intent === 'CONFIRM_DOCTOR' && nextState === 'DOCTOR_SUGGESTED') {
        nextState = 'AWAITING_TIME';
        aiResponse.reply_message = `${getDocDisplay(finalDocId)} ke saath appointment confirm karne ke liye aapko kaun sa time pasand hai? Main aapko available slots bata deta hoon.`;
    } else if ((aiResponse.intent === 'BOOK_APPOINTMENT' || (isConfirming && nextState === 'AWAITING_CONFIRMATION')) && nextState === 'AWAITING_CONFIRMATION') {
        const doc = doctors.find(d => d.id === finalDocId);
        const config = await prisma.clinicConfig.findUnique({ where: { id: 'default' } });
        const time = pState.lastProposedTime;
        const formatted = time ? new Date(time).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long", timeStyle: "short" }) : "";
        
        // CREATE PATIENT ONLY NOW IF NOT EXISTS
        if (!patient) {
            patient = await prisma.patient.create({
                data: { phone, name: nameFromWA }
            });
        }

        await prisma.appointment.create({
            data: { 
                patientId: patient!.id, 
                doctorId: finalDocId!, 
                date: time!, 
                symptoms: pState.lastSymptoms || finalText, 
                status: "CONFIRMED" 
            }
        });
        
        nextState = 'IDLE'; finalDocId = null; finalProposedTime = null;
        
        aiResponse.reply_message = `✅ *Appointment Confirmed!*\n\nDear *${patient.name || 'Patient'}*,\n\nYour appointment has been successfully booked.\n\n📋 *Details:*\n👨‍⚕️ *Doctor:* ${getDocDisplay(pState.lastSuggestedDoctorId)}\n🗓 *Date & Time:* ${formatted}\n📍 *Address:* ${config?.address || "Clinic Address"}\n\nThank you,\n*${config?.name || "ClinicManager"} Team*`;

    } else if (aiResponse.intent === 'CANCEL_APPOINTMENT') {
        if (!patient) {
            aiResponse.reply_message = "Aapka koi appointment nahi mila kyuki aapne pehle kabhi booking nahi ki hai.";
            nextState = 'IDLE';
        } else {
            const futureApps = await prisma.appointment.findMany({
                where: { patientId: patient.id, status: 'CONFIRMED', date: { gte: startOfTodayUTC } },
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
                await prisma.patientState.update({
                    where: { phone },
                    data: { lastSuggestedSlots: futureApps.map(a => a.id), conversationState: 'AWAITING_CANCEL_PICK' }
                });
                await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, aiResponse.reply_message);
                return NextResponse.json({ success: true });
            }
        }
    } else if (aiResponse.intent === 'VIEW_APPOINTMENTS') {
        if (!patient) {
            aiResponse.reply_message = "Aapka koi upcoming appointment nahi mila. Kya main naya book karne mein madad karu?";
        } else {
            const futureApps = await prisma.appointment.findMany({
                where: { patientId: patient.id, status: 'CONFIRMED', date: { gte: startOfTodayUTC } },
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
        }
        nextState = 'IDLE';
    } else if (aiResponse.intent === 'PROVIDE_TIME') {
        aiResponse.reply_message = `${getDocDisplay(finalDocId)} ke liye available slots ye rahi. Aap kaun sa samay chunna chahenge?`;
    }

    // Same symptom check (only if patient already exists)
    if (patient && (aiResponse.intent === 'SUGGEST_DOCTOR' || aiResponse.intent === 'CONFIRM_DOCTOR')) {
        const currentSymptom = (aiResponse.symptoms || finalText).toLowerCase();
        const existingAppWithSameSymptom = await prisma.appointment.findFirst({
            where: { 
                patientId: patient.id, 
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

    // UPDATE STATE IN DB
    pState = await prisma.patientState.update({
        where: { phone },
        data: { 
            conversationState: nextState, 
            lastSuggestedDoctorId: finalDocId, 
            lastProposedTime: finalProposedTime, 
            lastSymptoms: (aiResponse.symptoms || (nextState === 'DOCTOR_SUGGESTED' ? finalText : pState.lastSymptoms))
        }
    });

    // 4. SLOT GEN
    let slotText = "";
    if (nextState === 'AWAITING_TIME' || aiResponse.intent === 'PROVIDE_TIME' || aiResponse.requested_date) {
        if (finalDocId) {
            const doc = await prisma.doctor.findUnique({ where: { id: finalDocId } });
            const clinicConfig = (await prisma.clinicConfig.findUnique({ where: { id: 'default' } })) || { openTime: 9, closeTime: 18, offDays: [0] };
            const OPEN_H = doc?.openTime ?? clinicConfig.openTime;
            const CLOSE_H = doc?.closeTime ?? clinicConfig.closeTime;
            const OFF_DAYS = (clinicConfig as any).offDays || [0];

            const upcomingHolidays = await prisma.holiday.findMany({ where: { date: { gte: startOfTodayUTC } } });
            const holidayDates = upcomingHolidays.map(h => {
                const d = new Date(h.date);
                return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
            });

            const istOffset = 5.5 * 60 * 60 * 1000;
            const nowTime = new Date();
            const nowIST = new Date(nowTime.getTime() + istOffset);
            
            // 1. Identify Target Date (IST)
            let targetDayIST: Date;
            if (aiResponse.requested_date) {
                const [y, m, d] = aiResponse.requested_date.split('-').map(Number);
                // Create IST date at opening hour
                targetDayIST = new Date(y, m - 1, d, OPEN_H, 0, 0, 0);
            } else {
                targetDayIST = new Date(nowIST);
                targetDayIST.setHours(OPEN_H, 0, 0, 0);
            }

            // 2. Define Bounds (IST)
            const openIST = new Date(targetDayIST);
            openIST.setHours(OPEN_H, 0, 0, 0);
            const closeIST = new Date(targetDayIST);
            closeIST.setHours(CLOSE_H, 0, 0, 0);

            // 3. Determine Start Point (IST)
            let currentPointerIST = new Date(openIST);
            if (targetDayIST.toDateString() === nowIST.toDateString()) {
                const bufferTime = new Date(nowIST.getTime() + 15 * 60000); 
                // Round UP to next 30 min
                const mins = bufferTime.getMinutes();
                if (mins > 0 && mins <= 30) bufferTime.setMinutes(30, 0, 0);
                else if (mins > 30) bufferTime.setHours(bufferTime.getHours() + 1, 0, 0, 0);
                else bufferTime.setMinutes(0, 0, 0);
                
                if (bufferTime > openIST) currentPointerIST = bufferTime;
            }

            // Booked slots in UTC for comparison
            const booked = (await prisma.appointment.findMany({ 
              where: { doctorId: finalDocId, date: { gte: nowTime, lte: new Date(nowTime.getTime() + 10*24*60*60*1000) }, status: { not: 'CANCELLED' } } 
            })).map(a => a.date.getTime());

            const dateKey = `${currentPointerIST.getFullYear()}-${currentPointerIST.getMonth()}-${currentPointerIST.getDate()}`;
            const isHoliday = holidayDates.includes(dateKey) || OFF_DAYS.includes(currentPointerIST.getDay());

            if (isHoliday && aiResponse.requested_date) {
                const dateHeader = currentPointerIST.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: 'long', day: 'numeric', month: 'long' });
                const body = `Maaf kijiye, clinic *${dateHeader}* ko band rahega (Holiday/Weekly Off). Kripya kisi aur din ka appointment select karein.`;
                await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, body);
                return NextResponse.json({ success: true });
            }

            const display: string[] = []; 
            const isoSlots: string[] = [];
            const targetDayStr = currentPointerIST.toDateString();

            // Loop through the entire day until clinic closes
            while (currentPointerIST < closeIST) {
                if (currentPointerIST.toDateString() !== targetDayStr) break;

                const utcTime = new Date(currentPointerIST.getTime() - istOffset);
                const t = utcTime.getTime();
                
                if (!isHoliday) {
                    // Filter: Not booked AND (if today, not in past)
                    if (!booked.includes(t) && t >= (nowTime.getTime() - 60000)) {
                        display.push(`${display.length + 1}. ${currentPointerIST.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`);
                        isoSlots.push(utcTime.toISOString());
                    }
                }
                currentPointerIST = new Date(currentPointerIST.getTime() + 30 * 60000);
            }

            if (display.length > 0) {
                const dateHeader = new Date(isoSlots[0]).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: 'long', day: 'numeric', month: 'long' });
                slotText = `\n\nAvailable Slots for *${dateHeader}*:\n${display.join('\n')}\n\nReply number (1-${display.length}).`;
                await prisma.patientState.update({ where: { phone }, data: { lastSuggestedSlots: isoSlots } });
            } else if (aiResponse.requested_date || aiResponse.intent === 'PROVIDE_TIME') {
                 const dateHeader = targetDayIST.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: 'long', day: 'numeric', month: 'long' });
                 const body = `Maaf kijiye, *${dateHeader}* ko koi available slots nahi mile. Kripya koi aur date try karein.`;
                 await sendWhatsAppMessage(payload.to || "11za-channel", payload.from, body);
                 return NextResponse.json({ success: true });
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
