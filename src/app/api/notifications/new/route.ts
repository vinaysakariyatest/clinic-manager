import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get the most recent confirmed appointment created in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const latestAppointment = await prisma.appointment.findFirst({
      where: {
        status: { in: ["CONFIRMED", "PENDING"] },
        createdAt: { gte: fiveMinutesAgo },
      },
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!latestAppointment) {
      return NextResponse.json({ success: true, appointment: null });
    }

    return NextResponse.json({ 
      success: true, 
      appointment: {
        id: latestAppointment.id,
        patientName: latestAppointment.patient.name,
        doctorName: latestAppointment.doctor.name,
        time: latestAppointment.date.toISOString(),
        createdAt: latestAppointment.createdAt.toISOString(),
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
