'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddAppointmentForm } from "./add-appointment-form";

interface Doctor {
  id: string;
  name: string;
}

export function AddAppointmentDialog({ doctors }: { doctors: Doctor[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Add Appointment
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Appointment</DialogTitle>
          <DialogDescription>
            Schedule an appointment manually for a patient.
          </DialogDescription>
        </DialogHeader>
        <AddAppointmentForm 
          doctors={doctors} 
          onSuccess={() => setOpen(false)} 
        />
      </DialogContent>
    </Dialog>
  );
}
