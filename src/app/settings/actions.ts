'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addDoctor(formData: FormData) {
  const name = formData.get('name') as string;
  const specialization = formData.get('specialization') as string;
  const openTime = parseInt(formData.get('openTime') as string) || 9;
  const closeTime = parseInt(formData.get('closeTime') as string) || 18;

  if (!name || !specialization) {
    throw new Error("Name and specialization are required");
  }

  const id = 'doc-' + name.toLowerCase().replace(/\s/g, '-') + '-' + Math.random().toString(36).substring(2, 7);

  await prisma.doctor.create({
    data: {
      id,
      name,
      specialization,
      openTime,
      closeTime,
    },
  });

  revalidatePath('/settings');
}

export async function updateDoctor(id: string, formData: FormData) {
  const name = formData.get('name') as string;
  const specialization = formData.get('specialization') as string;
  const openTime = parseInt(formData.get('openTime') as string) || 9;
  const closeTime = parseInt(formData.get('closeTime') as string) || 18;

  if (!name || !specialization) {
    throw new Error("Name and specialization are required");
  }

  await prisma.doctor.update({
    where: { id },
    data: {
      name,
      specialization,
      openTime,
      closeTime,
    },
  });

  revalidatePath('/settings');
}

export async function deleteDoctor(id: string) {
  // Check if doctor has appointments
  const appointmentsCount = await prisma.appointment.count({
    where: { doctorId: id },
  });

  if (appointmentsCount > 0) {
    throw new Error("Cannot delete doctor with existing appointments");
  }

  await prisma.doctor.delete({
    where: { id: id },
  });

  revalidatePath('/settings');
}

export async function updateClinicConfig(formData: FormData) {
  const name = formData.get('name') as string;
  const address = formData.get('address') as string;
  const openTime = parseInt(formData.get('openTime') as string);
  const closeTime = parseInt(formData.get('closeTime') as string);

  await prisma.clinicConfig.upsert({
    where: { id: 'default' },
    update: { name, address, openTime, closeTime },
    create: { id: 'default', name, address, openTime, closeTime }
  });

  revalidatePath('/settings');
}
