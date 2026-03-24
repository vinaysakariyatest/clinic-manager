import prisma from "@/lib/prisma";
import { AppointmentsTable } from "@/components/dashboard/appointments-table";
import { SearchInput } from "@/components/dashboard/search-input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddAppointmentForm } from "@/components/dashboard/add-appointment-form";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = params.query || "";

  const [doctors, appointmentsSource] = await Promise.all([
    prisma.doctor.findMany({ orderBy: { name: "asc" } }),
    prisma.appointment.findMany({
      where: query ? {
        OR: [
          { patient: { name: { contains: query, mode: "insensitive" } } },
          { patient: { phone: { contains: query, mode: "insensitive" } } },
        ]
      } : {},
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: {
        date: "desc",
      },
    })
  ]);

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
        
        <Dialog>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Appointment
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Appointment</DialogTitle>
              <DialogDescription>
                Schedule an appointment manually for a patient.
              </DialogDescription>
            </DialogHeader>
            <AddAppointmentForm 
              doctors={doctors} 
              onSuccess={() => {/* Page will revalidate via Server Action */}} 
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <SearchInput placeholder="Search patients or phone..." />
      </div>

      <AppointmentsTable appointments={appointments} />
    </div>
  );
}
