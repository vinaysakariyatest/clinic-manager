"use client";

import { Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateAppointmentStatus } from "@/app/appointments/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface AppointmentEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  patientName: string;
  patientPhone?: string;
  doctorName: string;
  status: string;
}

export function AppointmentsList({ initialAppointments }: { initialAppointments: AppointmentEvent[] }) {
  const router = useRouter();

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const result = await updateAppointmentStatus(id, status);
      if (result.success) {
        toast.success(`Status updated to ${status}`);
        router.refresh();
      } else {
        toast.error("Failed to update status");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  if (initialAppointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
        <p className="text-sm">No arrivals today</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {initialAppointments.map((appointment) => (
        <div 
          key={appointment.id} 
          className={`p-4 rounded-xl border-2 transition-all duration-200 shadow-sm ${
            appointment.status === "COMPLETED" 
              ? "bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-900/20" 
              : appointment.status === "NO_SHOW"
              ? "bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/20"
              : "bg-background border-muted hover:border-primary/30"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner ${
                appointment.status === "COMPLETED" ? "bg-green-100 text-green-700" : 
                appointment.status === "NO_SHOW" ? "bg-red-100 text-red-700" : 
                "bg-muted text-muted-foreground"
              }`}>
                {appointment.patientName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold truncate text-foreground">{appointment.patientName}</p>
                  <div
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      appointment.status === "COMPLETED"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : appointment.status === "NO_SHOW"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                  >
                    {appointment.status === "NO_SHOW" ? "MISSED" : appointment.status.replace('_', ' ')}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {appointment.patientPhone && (
                    <div className="flex items-center text-[10px] text-primary/80 font-bold bg-primary/5 px-1.5 py-0.5 rounded w-fit italic">
                      {appointment.patientPhone}
                    </div>
                  )}
                  <div className="flex items-center text-[11px] text-muted-foreground font-medium ml-0.5">
                     <Clock className="h-3 w-3 mr-1.5 text-muted-foreground/70" />
                     {new Date(appointment.start).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground italic border-l-2 pl-3 py-1 mb-4 border-muted line-clamp-2">
            {appointment.title.split(' - ')[1] || 'No symptoms noted'}
          </p>
          
          {appointment.status !== "COMPLETED" && appointment.status !== "NO_SHOW" && (
            <div className="grid grid-cols-2 gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="h-9 text-xs font-semibold bg-white dark:bg-background border-green-200 hover:bg-green-500 hover:text-white dark:border-green-900/50 transition-colors"
                onClick={() => handleStatusChange(appointment.id, "COMPLETED")}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Check-In
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-9 text-xs font-semibold bg-white dark:bg-background border-red-200 hover:bg-red-500 hover:text-white dark:border-red-900/50 transition-colors"
                onClick={() => handleStatusChange(appointment.id, "NO_SHOW")}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Missed
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
