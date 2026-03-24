'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createAppointment(formData: FormData) {
  const patientPhone = formData.get('patientPhone') as string;
  const doctorId = formData.get('doctorId') as string;
  const date = formData.get('date') as string;
  const symptoms = formData.get('symptoms') as string;

  if (!patientPhone || !doctorId || !date) {
    throw new Error("Patient phone, doctor, and date are required");
  }

  // Find or create patient
  let patient = await prisma.patient.findUnique({
    where: { phone: patientPhone },
  });

  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        phone: patientPhone,
        name: formData.get('patientName') as string || "New Patient",
      },
    });
  }

  // Create appointment
  const id = 'apt-' + Math.random().toString(36).substring(2, 9);
  
  await prisma.appointment.create({
    data: {
      id,
      patientId: patient.id,
      doctorId: doctorId,
      date: new Date(date),
      symptoms: symptoms || "Regular Checkup",
      status: "CONFIRMED",
    },
  });

  revalidatePath('/appointments');
  revalidatePath('/');
}
