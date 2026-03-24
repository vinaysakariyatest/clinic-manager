'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAppointment } from "@/app/appointments/actions";
import { useFormStatus } from "react-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Doctor {
  id: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Booking..." : "Confirm Appointment"}
    </Button>
  );
}

export function AddAppointmentForm({ 
  doctors, 
  onSuccess 
}: { 
  doctors: Doctor[], 
  onSuccess: () => void 
}) {
  const [error, setError] = useState<string | null>(null);

  async function clientAction(formData: FormData) {
    try {
      setError(null);
      await createAppointment(formData);
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    }
  }

  return (
    <form action={clientAction} className="grid gap-5 py-4">
      <div className="grid gap-2">
        <Label htmlFor="patientPhone">Patient Phone Number</Label>
        <Input 
          id="patientPhone" 
          name="patientPhone" 
          placeholder="919876543210" 
          required 
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="patientName">Patient Name (Optional)</Label>
        <Input 
          id="patientName" 
          name="patientName" 
          placeholder="John Doe" 
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="doctorId">Select Doctor</Label>
        <Select name="doctorId" required>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a doctor" />
          </SelectTrigger>
          <SelectContent>
            {doctors.map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                {doc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="date">Appointment Date & Time</Label>
        <Input 
          id="date" 
          name="date" 
          type="datetime-local" 
          required 
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="symptoms">Symptoms / Reason</Label>
        <Input 
          id="symptoms" 
          name="symptoms" 
          placeholder="e.g., Routine checkup, Fever" 
        />
      </div>

      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
      
      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
