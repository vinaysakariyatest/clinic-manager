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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { XIcon, Loader2, CheckCircle2, AlertCircle, LockIcon } from "lucide-react";
import { cancelAppointment, updateAppointmentStatus } from "@/app/appointments/actions";
import { Pagination } from "./pagination";
import { toast } from "sonner";

interface AppointmentWithDetails {
  id: string;
  date: Date | string;
  patient: { name: string | null; phone: string };
  doctor: { name: string };
  symptoms: string | null;
  status: string;
}

interface AppointmentsTableProps {
  appointments: AppointmentWithDetails[];
  totalPages?: number;
  currentPage?: number;
}

export function AppointmentsTable({ 
  appointments, 
  totalPages = 1, 
  currentPage = 1 
}: AppointmentsTableProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
      const res = await cancelAppointment(cancellingId, reason);
      if (res.success) {
        toast.success("Appointment cancelled and patient notified.");
        setCancellingId(null);
        setReason("");
      } else {
        toast.error("Failed to cancel appointment.");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await updateAppointmentStatus(id, newStatus);
      if (res.success) {
        toast.success(`Status updated to ${newStatus}`);
      } else {
        toast.error("Failed to update status.");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <div className="rounded-md border bg-card overflow-hidden">
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
            {appointments.map((appointment) => {
              const itemUpdating = updatingId === appointment.id;
              const isLocked = appointment.status === "CANCELLED" || appointment.status === "COMPLETED";

              return (
                <TableRow key={appointment.id} className={isLocked ? "bg-muted/5 opacity-80" : ""}>
                  <TableCell className="font-medium whitespace-nowrap">
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
                      <span className="font-semibold text-foreground">{appointment.patient.name || "Anonymous"}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{appointment.patient.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-primary italic">DR</span>
                      </div>
                      <span className="text-sm font-medium">{appointment.doctor.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={appointment.symptoms || "N/A"}>
                    <span className="text-xs text-muted-foreground italic">{appointment.symptoms || "N/A"}</span>
                  </TableCell>
                  <TableCell>
                    {isLocked ? (
                        /* READONLY BADGE FOR LOCKED STATUS */
                        <Badge
                            className={`h-8 border-none shadow-none font-bold text-[11px] rounded-full px-4 flex items-center gap-2 uppercase tracking-wide cursor-default ${
                                appointment.status === "CANCELLED" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                            }`}
                        >
                            <LockIcon className="h-3 w-3 opacity-40" />
                            {appointment.status}
                        </Badge>
                    ) : (
                        /* EDITABLE SELECT FOR OPEN STATUS */
                        <Select 
                            value={appointment.status} 
                            onValueChange={(value) => handleStatusChange(appointment.id, value)}
                            disabled={itemUpdating}
                        >
                            <SelectTrigger className={`h-8 w-[130px] border-none shadow-none font-bold text-[11px] rounded-full px-3 transition-all ${
                                appointment.status === "CONFIRMED" ? "bg-green-100 text-green-700 hover:bg-green-200" :
                                "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                            }`}>
                                <div className="flex items-center gap-2 uppercase tracking-wide">
                                    {itemUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                    <SelectValue placeholder="Select Status" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/40 shadow-xl">
                                <SelectItem value="CONFIRMED" className="text-[11px] font-bold text-green-700 uppercase focus:bg-green-50">Confirmed</SelectItem>
                                <SelectItem value="COMPLETED" className="text-[11px] font-bold text-blue-700 uppercase focus:bg-blue-50">Completed</SelectItem>
                                <SelectItem value="CANCELLED" className="text-[11px] font-bold text-red-700 uppercase focus:bg-red-50">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Completely disable actions for LOCKED entries */}
                    {!isLocked ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-red-600 h-8 w-8 rounded-lg hover:bg-red-50 transition-colors"
                        onClick={() => setCancellingId(appointment.id)}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="h-8 w-8 flex items-center justify-center opacity-30 select-none grayscale">
                          {appointment.status === "COMPLETED" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-rose-500" />}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
        {/* PAGINATION COMPONENT */}
        <Pagination totalPages={totalPages} currentPage={currentPage} />
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
