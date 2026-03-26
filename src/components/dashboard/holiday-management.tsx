"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Trash2, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { addHoliday, deleteHoliday } from "@/app/settings/actions";
import { toast } from "sonner";

interface Holiday {
  id: string;
  date: Date;
  reason: string | null;
}

export function HolidayManagement({ holidays }: { holidays: Holiday[] }) {
  const [isPending, setIsPending] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return toast.error("Please select a date");
    
    setIsPending(true);
    const formData = new FormData();
    formData.append("date", date);
    formData.append("reason", reason);

    try {
      await addHoliday(formData);
      toast.success("Holiday added successfully!");
      setDate("");
      setReason("");
    } catch (e) {
      toast.error("Failed to add holiday");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteHoliday(id);
      toast.success("Holiday removed");
    } catch (e) {
      toast.error("Failed to delete holiday");
    }
  }

  const sortedHolidays = [...holidays].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <Card className="flex flex-col h-full border-2 border-slate-100 shadow-sm overflow-hidden text-slate-800">
      <CardHeader className="bg-white border-b py-4">
        <CardTitle className="flex items-center gap-2 text-slate-700 text-lg">
          <CalendarIcon className="h-5 w-5 text-primary" />
          Holiday Management
        </CardTitle>
        <CardDescription className="text-xs">
          Add specific dates when the clinic will be closed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <form onSubmit={handleSubmit} className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="holiday-date" className="text-xs font-bold uppercase tracking-wider text-primary/70">
              Select Holiday Date
            </Label>
            <Input 
              id="holiday-date" 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-white border-primary/20 focus-visible:ring-primary shadow-sm"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason" className="text-xs font-bold uppercase tracking-wider text-primary/70">
              Reason (Optional)
            </Label>
            <Input 
              id="reason" 
              placeholder="e.g., Diwali, Independence Day"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-white border-primary/20 focus-visible:ring-primary shadow-sm"
            />
          </div>
          <Button 
            type="submit" 
            disabled={isPending} 
            className="w-full bg-primary hover:bg-primary/90 shadow-md transition-all active:scale-[0.98]"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <><Plus className="h-4 w-4 mr-2" /> Add Holiday</>
            )}
          </Button>
        </form>

        <div className="space-y-3">
          <Label className="text-sm font-bold flex items-center justify-between">
            Upcoming Holidays
            <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full text-slate-600">
              {holidays.length} Active
            </span>
          </Label>
          <div className="max-h-[250px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {sortedHolidays.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 border-2 border-dashed rounded-xl border-slate-200">
                <p className="text-xs text-slate-400">No scheduled holidays.</p>
              </div>
            ) : (
              sortedHolidays.map((holiday) => (
                <div 
                  key={holiday.id} 
                  className="flex items-center justify-between p-3 bg-white border rounded-xl hover:border-red-100 hover:shadow-md transition-all group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700">
                      {new Date(holiday.date).toLocaleDateString("en-IN", { 
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' 
                      })}
                    </p>
                    {holiday.reason && (
                      <p className="text-[10px] text-primary font-medium truncate italic">
                        {holiday.reason}
                      </p>
                    )}
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(holiday.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-slate-50 border-t mt-auto py-3">
          <p className="text-[10px] text-muted-foreground text-center w-full italic">
            Appointments falling on these dates will be automatically blocked by AI.
          </p>
      </CardFooter>
    </Card>
  );
}
