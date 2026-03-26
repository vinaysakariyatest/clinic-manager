"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { updateClinicConfig } from "@/app/settings/actions";
import { useState } from "react";
import { Loader2, CalendarIcon } from "lucide-react";
import { toast } from "sonner";

interface ClinicConfig {
  name: string;
  address: string;
  openTime: number;
  closeTime: number;
  offDays: number[];
}

const DAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export function ClinicProfile({ config }: { config: ClinicConfig }) {
  const [isPending, setIsPending] = useState(false);
  const [formData, setFormData] = useState({
    name: config.name,
    address: config.address,
    openTime: config.openTime,
    closeTime: config.closeTime,
    offDays: config.offDays || [0],
  });

  async function clientAction(form: FormData) {
    setIsPending(true);
    // Add offDays to formData as they are handled manually in the state
    formData.offDays.forEach(day => form.append('offDays', day.toString()));
    
    try {
      await updateClinicConfig(form);
      toast.success("Clinic settings updated successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update clinic settings.");
    } finally {
      setIsPending(false);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
  };

  const toggleDay = (dayValue: number) => {
    setFormData(prev => ({
      ...prev,
      offDays: prev.offDays.includes(dayValue) 
        ? prev.offDays.filter(d => d !== dayValue) 
        : [...prev.offDays, dayValue]
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clinic Profile</CardTitle>
        <CardDescription>
          Manage your clinic's operational hours and weekly off-days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={clientAction} className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="name">Clinic Name</Label>
            <Input 
              id="name" 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              required 
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="address">Address</Label>
            <Input 
              id="address" 
              name="address" 
              value={formData.address} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="openTime">Opening Hour (0-23)</Label>
              <Input 
                id="openTime" 
                name="openTime" 
                type="number" 
                min="0" 
                max="23" 
                value={formData.openTime} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="closeTime">Closing Hour (0-23)</Label>
              <Input 
                id="closeTime" 
                name="closeTime" 
                type="number" 
                min="0" 
                max="23" 
                value={formData.closeTime} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <Label className="text-sm font-bold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              Weekly Off-Days
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {DAYS.map((day) => (
                <div key={day.value} className="flex items-center space-x-2 bg-slate-50 border rounded p-2">
                  <Checkbox 
                    id={`day-${day.value}`} 
                    checked={formData.offDays.includes(day.value)}
                    onCheckedChange={() => toggleDay(day.value)}
                  />
                  <Label 
                    htmlFor={`day-${day.value}`}
                    className="text-[10px] font-bold cursor-pointer"
                  >
                    {day.label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground italic">AI blocks these days automatically.</p>
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Clinic Settings"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
