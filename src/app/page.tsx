import prisma from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { AppointmentsList } from "@/components/dashboard/appointments-list";

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  // Fetch real data from Supabase
  const appointments = await prisma.appointment.findMany({
    include: { patient: true, doctor: true },
    orderBy: { date: 'asc' }
  });

  const events = appointments.map(app => ({
    id: app.id,
    title: `${app.patient.name || app.patient.phone} with ${app.doctor.name} - ${app.symptoms || 'General'}`,
    start: app.date.toISOString(),
    end: new Date(new Date(app.date).getTime() + 30 * 60000).toISOString(),
    patientName: app.patient.name || app.patient.phone,
    doctorName: app.doctor.name,
    status: app.status
  }));

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard overview</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 pb-6">
        <Card className="col-span-4 lg:col-span-5 flex flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>View all upcoming AI booked slots (Live Data).</CardDescription>
          </CardHeader>
          <CardContent className="h-[600px] flex-1">
            <CalendarView initialEvents={events} />
          </CardContent>
        </Card>
        <Card className="col-span-3 lg:col-span-2">
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
            <CardDescription>Next appointments for today.</CardDescription>
          </CardHeader>
          <CardContent>
            <AppointmentsList initialAppointments={events} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
