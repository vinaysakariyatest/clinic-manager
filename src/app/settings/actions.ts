'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addDoctor(formData: FormData) {
  const name = formData.get('name') as string;
  const specialization = formData.get('specialization') as string;

  if (!name || !specialization) {
    throw new Error("Name and specialization are required");
  }

  const id = 'doc-' + name.toLowerCase().replace(/\s/g, '-') + '-' + Math.random().toString(36).substring(2, 7);

  await prisma.doctor.create({
    data: {
      id,
      name,
      specialization,
    },
  });

  revalidatePath('/settings');
}

export async function updateDoctor(id: string, formData: FormData) {
  const name = formData.get('name') as string;
  const specialization = formData.get('specialization') as string;

  if (!name || !specialization) {
    throw new Error("Name and specialization are required");
  }

  await prisma.doctor.update({
    where: { id },
    data: {
      name,
      specialization,
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
    where: { id },
  });

  revalidatePath('/settings');
}
