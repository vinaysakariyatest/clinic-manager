"use server";

import prisma from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";

export async function createAppointment(formData: FormData) {
  const patientPhone = formData.get('patientPhone') as string;
  const patientName = formData.get('patientName') as string;
  const doctorId = formData.get('doctorId') as string;
  const dateStr = formData.get('date') as string;
  const symptoms = formData.get('symptoms') as string;

  if (!patientPhone || !doctorId || !dateStr) {
    throw new Error('Missing required fields');
  }

  // Find or create patient
  let patient = await prisma.patient.findUnique({
    where: { phone: patientPhone }
  });

  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        phone: patientPhone,
        name: patientName || "Anonymous",
      }
    });
  } else if (patientName && !patient.name) {
    await prisma.patient.update({
      where: { id: patient.id },
      data: { name: patientName }
    });
  }

  await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId,
      date: new Date(dateStr),
      status: "CONFIRMED",
      symptoms: symptoms || "Regular Checkup",
    }
  });

  revalidatePath('/appointments');
  revalidatePath('/patients');
  revalidatePath('/');
}

export async function cancelAppointment(appointmentId: string, reason: string) {
  try {
    const appointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CANCELLED" },
      include: {
        patient: true,
        doctor: true,
      },
    });

    const formattedTime = new Date(appointment.date).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "long",
      timeStyle: "short",
    });

    const message = `🔔 *Appointment Cancellation Notification*\n\nNamaste ${appointment.patient.name || 'Patient'},\n\nHum kshama chahte hain, lekin aapka aane wala appointment *cancel* kar diya gaya hai.\n\n📋 *Details:*\n🗓 *Date & Time:* ${formattedTime}\n👨‍⚕️ *Doctor:* ${appointment.doctor.name}\n❌ *Reason:* ${reason || "Operational Reasons"}\n\nAap naya appointment WhatsApp ya dashboard ke madhyam se book kar sakte hain.\n\nDhanyavaad,\n*ClinicManager Team*`;

    await sendWhatsAppMessage("11za-channel", appointment.patient.phone, message);

    revalidatePath("/appointments");
    revalidatePath("/patients");
    revalidatePath("/");
    
    return { success: true };
  } catch (error) {
    console.error("Cancellation Action Error:", error);
    return { success: false, error: "Something went wrong" };
  }
}

export async function updateAppointmentStatus(appointmentId: string, status: string) {
  try {
    const appointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status }
    });

    revalidatePath("/appointments");
    revalidatePath("/patients");
    revalidatePath("/");
    
    return { success: true, status: appointment.status };
  } catch (error) {
    console.error("Update Status Action Error:", error);
    return { success: false, error: "Something went wrong" };
  }
}

