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
    patientPhone: app.patient.phone,
    doctorName: app.doctor.name,
    status: app.status
  }));

  const stats = {
    total: todayAppointments.length,
    completed: todayAppointments.filter(a => a.status === 'COMPLETED').length,
    noShow: todayAppointments.filter(a => a.status === 'NO_SHOW').length,
    pending: todayAppointments.filter(a => a.status === 'CONFIRMED' || a.status === 'PENDING').length
  };

  return (
    <div className="flex flex-col gap-6 h-full p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Clinic Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Scheduled appointments</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Checked-In</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.completed}</div>
            <p className="text-xs text-muted-foreground mt-1 text-green-600/70">Patients arrived</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Missed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.noShow}</div>
            <p className="text-xs text-muted-foreground mt-1 text-red-600/70">Appointments missed</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-100 dark:border-yellow-900/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-1 text-yellow-600/70">Awaiting check-in</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 pb-6">
        <Card className="col-span-4 lg:col-span-5 flex flex-col overflow-hidden shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle>Weekly Schedule</CardTitle>
            <CardDescription>View and manage all booked slots.</CardDescription>
          </CardHeader>
          <CardContent className="h-[650px] flex-1 p-0">
            <CalendarView 
                initialEvents={weekEvents} 
                openTime={openTime} 
                closeTime={closeTime} 
            />
          </CardContent>
        </Card>
        <Card className="col-span-3 lg:col-span-2 shadow-sm border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle>Upcoming List</CardTitle>
            <CardDescription>Manage today's arrivals.</CardDescription>
          </CardHeader>
          <CardContent>
            <AppointmentsList initialAppointments={todayEvents} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
