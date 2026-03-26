import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 1. Define time range: Appointments starting in 25 to 40 minutes from now
    const now = new Date();
    const reminderWindowStart = new Date(now.getTime() + 25 * 60 * 1000);
    const reminderWindowEnd = new Date(now.getTime() + 40 * 60 * 1000);

    // 2. Find eligible appointments
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
        reminderSent: false,
        date: {
          gte: reminderWindowStart,
          lte: reminderWindowEnd,
        },
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (upcomingAppointments.length === 0) {
      return NextResponse.json({ message: "No reminders to send." });
    }

    // 3. Fetch Clinic config for address/name
    const config = await prisma.clinicConfig.findUnique({ where: { id: 'default' } });
    
    const results = [];

    // 4. Send reminders
    for (const app of upcomingAppointments) {
      const formattedTime = new Date(app.date).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });

      const message = `🔔 *Appointment Reminder*\n\nDear *${app.patient.name || 'Patient'}*,\n\nThis is a friendly reminder that you have an upcoming appointment.\n\n⏰ *Time:* ${formattedTime}\n👨‍⚕️ *Doctor:* ${app.doctor.name}\n📍 *Address:* ${config?.address || "Clinic Address"}\n\nPlease reach on time. See you soon!\n\n*${config?.name || "ClinicManager"} Team*`;


      try {
        await sendWhatsAppMessage("11za-channel", app.patient.phone, message);
        
        // 5. Update reminder status
        await prisma.appointment.update({
          where: { id: app.id },
          data: { reminderSent: true }
        });
        
        results.push({ id: app.id, phone: app.patient.phone, success: true });
      } catch (err) {
        console.error(`Failed to send reminder for ${app.id}:`, err);
        results.push({ id: app.id, phone: app.patient.phone, success: false });
      }
    }

    return NextResponse.json({ 
      processedCount: upcomingAppointments.length,
      results 
    });

  } catch (error) {
    console.error("Reminder Routine Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
