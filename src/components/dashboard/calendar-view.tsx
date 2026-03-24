"use client";

import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

export function CalendarView({ initialEvents }: { initialEvents: any[] }) {
  const events = initialEvents.map(e => ({
    ...e,
    start: new Date(e.start),
    end: new Date(e.end)
  }));

  return (
    <div className="h-full">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "100%", fontFamily: "inherit" }}
        defaultView={Views.WORK_WEEK}
        views={[Views.MONTH, Views.WORK_WEEK, Views.DAY]}
        step={15}
        timeslots={4}
      />
    </div>
  );
}
