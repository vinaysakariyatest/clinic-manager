"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { XIcon, Loader2 } from "lucide-react";
import { cancelAppointment } from "@/app/appointments/actions";

interface AppointmentWithDetails {
  id: string;
  date: Date | string;
  patient: { name: string | null; phone: string };
  doctor: { name: string };
  symptoms: string | null;
  status: string;
}

export function AppointmentsTable({ appointments }: { appointments: AppointmentWithDetails[] }) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);

  if (appointments.length === 0) {
    return (
      <div className="flex h-[450px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No appointments found.
      </div>
    );
  }

  const handleCancelSubmit = async () => {
    if (!cancellingId) return;
    setIsPending(true);
    try {
      await cancelAppointment(cancellingId, reason);
      setCancellingId(null);
      setReason("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Symptoms</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((appointment) => (
              <TableRow key={appointment.id}>
                <TableCell className="font-medium">
                  {new Date(appointment.date).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true
                  })}
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
                    data-slot="badge"
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
                <TableCell className="text-right">
                  {appointment.status !== "CANCELLED" && (
                    <Button 
                      variant="ghost" 
                      size="icon-sm" 
                      className="text-muted-foreground hover:text-red-600 h-8 w-8"
                      onClick={() => setCancellingId(appointment.id)}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!cancellingId} onOpenChange={(open) => !open && setCancellingId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Cancel Appointment</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Are you sure you want to cancel this appointment? The patient will be notified automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <div className="space-y-1.5">
              <label htmlFor="reason" className="text-sm font-semibold text-foreground">
                Cancellation Reason (Shown to patient)
              </label>
              <Input
                id="reason"
                placeholder="E.g. Doctor is unavailable, Clinic is closing early..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
                className="h-10 px-3 focus-visible:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <div className="flex flex-row justify-end gap-3 px-4 py-4 -mx-4 -mb-4 border-t bg-muted/50 rounded-b-xl">
              <Button 
                variant="outline" 
                onClick={() => setCancellingId(null)} 
                disabled={isPending}
                className="h-10 px-6 font-medium"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCancelSubmit} 
                disabled={isPending || !reason}
                className="h-10 px-6 font-bold shadow-sm"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Confirm Cancellation"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
