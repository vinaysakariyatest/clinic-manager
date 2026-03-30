"use client";

import { useEffect, useState, useRef } from "react";
import { 
  Bell, 
  CalendarCheck, 
  Trash2, 
  Info 
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


interface AppointmentNotification {
  id: string;
  patientName: string;
  doctorName: string;
  time: string;
  createdAt: string;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<AppointmentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastIdRef = useRef<string | null>(null);
  const isFirstRun = useRef(true);

  const fetchLatest = async () => {
    try {
      const response = await fetch("/api/notifications/new");
      const data = await response.json();

      if (data.success && data.appointment) {
        const { id, patientName, doctorName, time, createdAt } = data.appointment;

        // If it's a completely new ID we haven't seen in this session
        if (id !== lastIdRef.current) {
          const isActuallyNew = lastIdRef.current !== null; // It's a brand new one during the session
          const isVeryRecent = (Date.now() - new Date(createdAt).getTime()) < 60000; // Less than 1 min old

          lastIdRef.current = id;
          
          // Add to the list
          setNotifications(prev => {
            if (prev.some(n => n.id === id)) return prev;
            return [data.appointment, ...prev].slice(0, 5); // Keep last 5
          });

          // Show UI alert IF (it's new during session) OR (it's very fresh on first load)
          if (isActuallyNew || isVeryRecent) {
            setUnreadCount(prev => prev + 1);
            
            // Voice Announcement
            if (typeof window !== "undefined") {
               try {
                 // 1. Play a subtle chime first
                 const chime = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
                 chime.volume = 0.6;
                 
                 const playPromise = chime.play();
                 if (playPromise !== undefined) {
                   playPromise.catch(e => {
                     console.warn("[NotificationCenter] Audio play blocked. Please click on the dashboard to enable sounds.", e);
                   });
                 }

                 // 2. Voice Announcement
                 // Cancel any pending speech to avoid queuing delays
                 window.speechSynthesis.cancel();
                 
                 const speech = new SpeechSynthesisUtterance();
                 speech.text = `Attention! New appointment booked from ${patientName} with ${doctorName}.`;
                 speech.lang = 'en-IN'; // Indian English for better accent
                 speech.rate = 1.0;
                 speech.pitch = 1.0;
                 window.speechSynthesis.speak(speech);
                 
                 console.log("[NotificationCenter] Sound and Speech triggered for:", id);
               } catch (err) {
                 console.error("[NotificationCenter] Voice error:", err);
               }
            }


            toast.success(`🎉 New Patient Booking!`, {
              description: `${patientName} with ${doctorName} (Booked at ${new Date(createdAt).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })})`,
              icon: <CalendarCheck className="h-5 w-5 text-indigo-600" />,
              duration: 10000,
            });
          }
        }

      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    fetchLatest();
    // Poll every 5 seconds for more responsiveness during testing
    const interval = setInterval(fetchLatest, 5000);
    return () => clearInterval(interval);
  }, []);

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return (
    <Popover onOpenChange={(open) => { if (open) setUnreadCount(0); }}>
      <PopoverTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-9 w-9 relative group border-slate-200 cursor-pointer shadow-sm")}>
          <Bell className="h-4.5 w-4.5 text-slate-600 group-hover:text-indigo-600 transition-colors" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center p-1 bg-rose-500 text-white border-2 border-white hover:bg-rose-600 animate-in zoom-in font-black text-[10px]"
            >
              {unreadCount}
            </Badge>
          )}
          <span className="sr-only">Toggle notifications</span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-2xl border-slate-200 bg-white/95 backdrop-blur-xl" align="end">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-600" />
            Recent Bookings
          </h3>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-[10px] uppercase font-bold tracking-wider text-slate-400 hover:text-red-500 transition-colors"
            onClick={clearNotifications}
            disabled={notifications.length === 0}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
        <div className="max-h-[350px] overflow-y-auto overflow-x-hidden custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/20">
              <div className="w-12 h-12 bg-slate-100/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400 font-medium">No new notifications</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tight">System is live and waiting</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className="p-4 border-b border-slate-50 hover:bg-indigo-50/30 transition-colors group cursor-default"
              >
                <div className="flex gap-3">
                  <div className="h-9 w-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                    <CalendarCheck className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    <p className="text-sm font-black text-slate-800 leading-tight">
                      Booking Confirmed
                    </p>
                    <p className="text-[12px] text-slate-500 line-clamp-1 font-medium">
                      {notif.patientName} with {notif.doctorName}
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 font-black px-1.5 py-0.5 rounded uppercase">
                        Booked at: {new Date(notif.createdAt).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded uppercase">
                        For: {new Date(notif.time).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {notifications.length > 0 && (

          <div className="p-2 bg-slate-50 border-t border-slate-100">
             <Button 
               variant="ghost" 
               className="w-full text-[11px] font-bold text-indigo-600 hover:bg-indigo-50"
               onClick={() => window.location.reload()}
             >
               REFRESH DASHBOARD DATA
             </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
