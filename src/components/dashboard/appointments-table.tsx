import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AppointmentWithDetails {
  id: string;
  date: Date | string;
  patient: { name: string | null; phone: string };
  doctor: { name: string };
  symptoms: string | null;
  status: string;
}

export function AppointmentsTable({ appointments }: { appointments: AppointmentWithDetails[] }) {
  if (appointments.length === 0) {
    return (
      <div className="flex h-[450px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No appointments found.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date & Time</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Doctor</TableHead>
            <TableHead>Symptoms</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((appointment) => (
            <TableRow key={appointment.id}>
              <TableCell className="font-medium">
                {format(new Date(appointment.date), "MMM dd, yyyy - hh:mm a")}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{appointment.patient.name || "Anonymous"}</span>
                  <span className="text-xs text-muted-foreground">{appointment.patient.phone}</span>
                </div>
              </TableCell>
              <TableCell>{appointment.doctor.name}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={appointment.symptoms || "N/A"}>
                {appointment.symptoms || "N/A"}
              </TableCell>
              <TableCell>
                <Badge
                  className={
                    appointment.status === "CONFIRMED"
                      ? "bg-green-100 text-green-700 hover:bg-green-200 border-none px-3"
                      : appointment.status === "CANCELLED"
                      ? "bg-red-100 text-red-700 hover:bg-red-200 border-none px-3"
                      : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-none px-3"
                  }
                >
                  {appointment.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
