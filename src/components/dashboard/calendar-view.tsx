"use client";

import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const CustomEvent = ({ event }: { event: any }) => {
  return (
    <div className="flex flex-col gap-0.5 leading-tight overflow-hidden">
      <span className="font-bold text-[0.7rem] truncate">{event.patientName}</span>
      <span className="text-[0.6rem] opacity-90 truncate">{event.doctorName}</span>
    </div>
  );
};

export function CalendarView({ 
  initialEvents, 
  openTime = 9, 
  closeTime = 18 
}: { 
  initialEvents: any[],
  openTime?: number,
  closeTime?: number
}) {
  const events = initialEvents.map(e => ({
    ...e,
    start: new Date(e.start),
    end: new Date(e.end)
  }));

  // Define working hours for the UI
  const min = new Date();
  min.setHours(openTime, 0, 0, 0);
  
  const max = new Date();
  max.setHours(closeTime, 0, 0, 0);

  return (
    <div className="h-full">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        tooltipAccessor={(event) => `${event.patientName} with ${event.doctorName} - ${event.symptoms || 'General'}`}
        style={{ height: "100%", fontFamily: "inherit" }}
        defaultView={Views.WORK_WEEK}
        views={[Views.MONTH, Views.WORK_WEEK, Views.DAY]}
        step={30}
        timeslots={2}
        min={min}
        max={max}
        components={{
          event: CustomEvent
        }}
        eventPropGetter={(event: any) => {
          let backgroundColor = "#3b82f6"; // Default Blue
          let borderColor = "#2563eb";
          
          if (event.status === "COMPLETED") {
            backgroundColor = "#10b981"; // Green
            borderColor = "#059669";
          } else if (event.status === "NO_SHOW") {
            backgroundColor = "#ef4444"; // Red
            borderColor = "#dc2626";
          }
          
          return {
            style: {
              backgroundColor,
              borderRadius: "6px",
              color: "white",
              border: `1px solid ${borderColor}`,
              display: "block",
              padding: "2px 4px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
            },
          };
        }}

      />
    </div>
  );
}
