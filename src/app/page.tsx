import prisma from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { AppointmentsList } from "@/components/dashboard/appointments-list";

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  // Calculate Current Week (Asia/Kolkata) range in UTC
  const istOffset = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + istOffset);
  
  // Start and End of TODAY for the side list
  const startOfTodayIST = new Date(nowIST);
  startOfTodayIST.setUTCHours(0, 0, 0, 0);
  const startOfTodayUTC = new Date(startOfTodayIST.getTime() - istOffset);
  const endOfTodayIST = new Date(nowIST);
  endOfTodayIST.setUTCHours(23, 59, 59, 999);
  const endOfTodayUTC = new Date(endOfTodayIST.getTime() - istOffset);

  // START and END of CURRENT WEEK for the Calendar
  const currentWeekStartIST = new Date(nowIST);
  const day = currentWeekStartIST.getUTCDay();
  const diff = currentWeekStartIST.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday start
  currentWeekStartIST.setUTCDate(diff);
  currentWeekStartIST.setUTCHours(0, 0, 0, 0);
  const startOfWeekUTC = new Date(currentWeekStartIST.getTime() - istOffset);

  const currentWeekEndIST = new Date(currentWeekStartIST);
  currentWeekEndIST.setUTCDate(currentWeekEndIST.getUTCDate() + 6);
  currentWeekEndIST.setUTCHours(23, 59, 59, 999);
  const endOfWeekUTC = new Date(currentWeekEndIST.getTime() - istOffset);

  const [allWeekAppointments, config] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        date: {
          gte: startOfWeekUTC,
          lte: endOfWeekUTC,
        },
        status: { not: 'CANCELLED' }
      },
      include: { patient: true, doctor: true },
      orderBy: { date: 'asc' }
    }),
    prisma.clinicConfig.findUnique({ where: { id: 'default' } })
  ]);

  const openTime = config?.openTime ?? 9;
  const closeTime = config?.closeTime ?? 18;

  // Filter today's appointments for the list
  const todayAppointments = allWeekAppointments.filter(app => 
    app.date >= startOfTodayUTC && app.date <= endOfTodayUTC
  );

  const weekEvents = allWeekAppointments.map((app: any) => ({
    id: app.id,
    title: `${app.patient.name || app.patient.phone} with ${app.doctor.name} - ${app.symptoms || 'General'}`,
    start: app.date.toISOString(),
    end: new Date(new Date(app.date).getTime() + 30 * 60000).toISOString(),
    patientName: app.patient.name || app.patient.phone,
    doctorName: app.doctor.name,
    status: app.status
  }));

  const todayEvents = todayAppointments.map((app: any) => ({
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
            <CalendarView 
                initialEvents={weekEvents} 
                openTime={openTime} 
                closeTime={closeTime} 
            />
          </CardContent>
        </Card>
        <Card className="col-span-3 lg:col-span-2">
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
            <CardDescription>Next appointments for today.</CardDescription>
          </CardHeader>
          <CardContent>
            <AppointmentsList initialAppointments={todayEvents} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
