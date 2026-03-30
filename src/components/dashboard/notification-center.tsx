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
        const { id, patientName, doctorName, time } = data.appointment;

        if (isFirstRun.current) {
          lastIdRef.current = id;
          isFirstRun.current = false;
          return;
        }

        if (id !== lastIdRef.current) {
          lastIdRef.current = id;
          
          // Add to notifications list
          setNotifications(prev => [data.appointment, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Still show toast for active feedback
          toast.success(`🎉 New Booking!`, {
            description: `${patientName} with ${doctorName}`,
            icon: <CalendarCheck className="h-5 w-5 text-indigo-600" />,
            duration: 5000,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    fetchLatest();
    const interval = setInterval(fetchLatest, 10000);
    return () => clearInterval(interval);
  }, []);

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return (
    <Popover onOpenChange={(open) => { if (open) setUnreadCount(0); }}>
      <PopoverTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-8 w-8 relative group border-slate-200 cursor-pointer")}>
          <Bell className="h-4 w-4 text-slate-600 group-hover:text-indigo-600 transition-colors" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-red-500 border-2 border-white hover:bg-red-600 animate-in zoom-in"
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
            Recent Activity
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
        <div className="max-h-[300px] overflow-y-auto overflow-x-hidden custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/50">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400 font-medium">No new notifications</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tight">System is live and waiting</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className="p-4 border-b border-slate-50 hover:bg-slate-50/80 transition-colors group cursor-default"
              >
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                    <CalendarCheck className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    <p className="text-sm font-bold text-slate-800 leading-tight">
                      Booking Confirmed
                    </p>
                    <p className="text-[12px] text-slate-500 line-clamp-1">
                      {notif.patientName} with {notif.doctorName}
                    </p>
                    <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">
                      {new Date(notif.time).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                    </p>
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
