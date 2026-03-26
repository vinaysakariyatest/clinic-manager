"use client";

import { format } from "date-fns";
import { updateAppointmentStatus } from "@/app/appointments/actions";
import { Button } from "@/components/ui/button";
import { Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

export function AppointmentsList({ initialAppointments }: { initialAppointments: any[] }) {
  if (initialAppointments.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-4">No upcoming appointments.</div>;
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await updateAppointmentStatus(id, newStatus);
      if (res.success) {
        toast.success(`Marked as ${newStatus.toLowerCase().replace('_', ' ')}`);
      } else {
        toast.error("Process failed. Please try again.");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
      {initialAppointments.map((appointment) => (
        <div 
          key={appointment.id} 
          className={`flex flex-col gap-3 p-4 border rounded-xl transition-all duration-200 ${
            appointment.status === 'COMPLETED' 
              ? 'bg-green-50/30 border-green-100 dark:bg-green-900/5 dark:border-green-900/20 opacity-80' 
              : appointment.status === 'NO_SHOW'
              ? 'bg-red-50/30 border-red-100 dark:bg-red-900/5 dark:border-red-900/20 opacity-80 shadow-inner'
              : 'bg-card hover:shadow-md border-border'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex shrink-0 items-center justify-center font-bold text-sm ${
                appointment.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                appointment.status === 'NO_SHOW' ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'
              }`}>
                {appointment.patientName.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-0.5 overflow-hidden">
                <p className="text-sm font-semibold truncate">{appointment.patientName}</p>
                <div className="flex items-center text-[11px] text-muted-foreground">
                   <Clock className="h-3 w-3 mr-1" />
                   {new Date(appointment.start).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true
                  })}
                </div>
              </div>
            </div>
            
            <div
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
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

          <p className="text-xs text-muted-foreground italic border-l-2 pl-2 border-muted">
            {appointment.title.split(' - ')[1] || 'No symptoms noted'}
          </p>
          
          {appointment.status !== "COMPLETED" && appointment.status !== "NO_SHOW" && (
            <div className="flex gap-2 pt-1">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 h-9 text-xs font-semibold bg-white dark:bg-background border-green-200 hover:bg-green-500 hover:text-white dark:border-green-900/50 transition-colors"
                onClick={() => handleStatusChange(appointment.id, "COMPLETED")}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Check-In
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 h-9 text-xs font-semibold bg-white dark:bg-background border-red-200 hover:bg-red-500 hover:text-white dark:border-red-900/50 transition-colors"
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

