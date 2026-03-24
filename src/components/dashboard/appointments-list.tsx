import { format } from "date-fns";

export function AppointmentsList({ initialAppointments }: { initialAppointments: any[] }) {
  if (initialAppointments.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-4">No upcoming appointments.</div>;
  }

  return (
    <div className="space-y-8 max-h-[500px] overflow-y-auto pr-2">
      {initialAppointments.map((appointment) => (
        <div key={appointment.id} className="flex items-center">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex shrink-0 items-center justify-center font-medium pr-[1px] text-primary">
            {appointment.patientName.charAt(0).toUpperCase()}
          </div>
          <div className="ml-4 space-y-1 overflow-hidden">
            <p className="text-sm font-medium leading-none truncate">{appointment.patientName}</p>
            <p className="text-sm text-muted-foreground truncate" title={appointment.title}>{appointment.title}</p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1 shrink-0">
            <div className="text-sm font-medium whitespace-nowrap">{format(new Date(appointment.start), "hh:mm a")}</div>
            <div
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                appointment.status === "CONFIRMED"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              }`}
            >
              {appointment.status}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
