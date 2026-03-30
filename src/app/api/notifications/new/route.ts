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
    // Get the most recent confirmed appointment created in the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    console.log("[Notifications API] Checking for appointments since:", thirtyMinutesAgo.toISOString());

    const latestAppointment = await prisma.appointment.findFirst({
      where: {
        status: { in: ["CONFIRMED", "PENDING", "PENDING_CONFIRMATION"] },
        createdAt: { gte: thirtyMinutesAgo },
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
      console.log("[Notifications API] No recent appointments found.");
      return NextResponse.json({ success: true, appointment: null });
    }

    console.log("[Notifications API] Found latest appointment:", latestAppointment.id);

    return NextResponse.json({ 
      success: true, 
      appointment: {
        id: latestAppointment.id,
        patientName: latestAppointment.patient.name || "Unknown Patient",
        doctorName: latestAppointment.doctor.name,
        time: latestAppointment.date.toISOString(),
        createdAt: latestAppointment.createdAt.toISOString(),
      }
    });
  } catch (error) {
    console.error("[Notifications API] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

