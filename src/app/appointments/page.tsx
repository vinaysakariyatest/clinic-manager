import prisma from "@/lib/prisma";
import { AppointmentsTable } from "@/components/dashboard/appointments-table";
import { SearchInput } from "@/components/dashboard/search-input";
import { AddAppointmentDialog } from "@/components/dashboard/add-appointment-dialog";
import { StatusFilter } from "@/components/dashboard/status-filter";
import { DateFilter } from "@/components/dashboard/date-filter";
import { Suspense } from "react";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; status?: string; date?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.query || "";
  const status = params.status || "ALL";
  const dateStr = params.date || "";
  const page = parseInt(params.page || "1", 10);
  const limit = 10;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (query) {
    where.OR = [
      { patient: { name: { contains: query, mode: "insensitive" } } },
      { patient: { phone: { contains: query, mode: "insensitive" } } },
    ];
  }
  if (status !== "ALL") {
    where.status = status;
  }
  if (dateStr) {
    const start = new Date(dateStr);
    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);
    where.date = {
      gte: start,
      lte: end
    };
  }

  const [doctors, appointmentsSource, totalCount] = await Promise.all([
    prisma.doctor.findMany({ orderBy: { name: "asc" } }),
    prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: {
        date: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.appointment.count({ where })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  const appointments = appointmentsSource.map((app: any) => ({
    id: app.id,
    date: app.date,
    patient: {
      name: app.patient.name,
      phone: app.patient.phone,
    },
    doctor: {
      name: app.doctor.name,
    },
    symptoms: app.symptoms,
    status: app.status,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground">
            View and manage all medical appointments scheduled in the clinic.
          </p>
        </div>
        
        <AddAppointmentDialog doctors={doctors} />
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <SearchInput placeholder="Search patients or phone..." />
        <Suspense>
          <DateFilter />
          <StatusFilter />
        </Suspense>
      </div>

      <AppointmentsTable 
        appointments={appointments} 
        totalPages={totalPages}
        currentPage={page}
      />
    </div>
  );
}
