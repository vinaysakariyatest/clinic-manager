"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { BellRing, CalendarCheck } from "lucide-react";

export function NotificationPoller() {
  const lastIdRef = useRef<string | null>(null);
  const isFirstRun = useRef(true);

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const response = await fetch("/api/notifications/new");
        const data = await response.json();

        if (data.success && data.appointment) {
          const { id, patientName, doctorName, time } = data.appointment;

          // On first run, we just establish the latest ID without showing notification
          if (isFirstRun.current) {
            lastIdRef.current = id;
            isFirstRun.current = false;
            return;
          }

          // If we find a new ID, show notification
          if (id !== lastIdRef.current) {
            lastIdRef.current = id;
            
            const timeStr = new Date(time).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });

            toast.success(`🎉 New Appointment!`, {
              description: `${patientName} with ${doctorName} at ${timeStr}`,
              icon: <CalendarCheck className="h-5 w-5 text-indigo-600" />,
              duration: 10000,
              action: {
                label: "Reload Dashboard",
                onClick: () => window.location.reload(),
              },
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    };

    // Immediate check
    fetchLatest();
    
    // Poll every 10 seconds
    const interval = setInterval(fetchLatest, 10000);
    return () => clearInterval(interval);
  }, []); // Run only once on mount

  return null;
}

