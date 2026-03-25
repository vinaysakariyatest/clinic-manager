'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDoctor } from "@/app/settings/actions";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Updating..." : "Update Doctor"}
    </Button>
  );
}

export function EditDoctorForm({ 
  doctor, 
  onSuccess 
}: { 
  doctor: { id: string; name: string; specialization: string }, 
  onSuccess: () => void 
}) {
  const [error, setError] = useState<string | null>(null);

  async function clientAction(formData: FormData) {
    try {
      setError(null);
      await updateDoctor(doctor.id, formData);
      toast.success("Doctor information updated!");
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      toast.error(e.message || "Failed to update doctor.");
    }
  }

  return (
    <form action={clientAction} className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="edit-name">Full Name</Label>
        <Input id="edit-name" name="name" defaultValue={doctor.name} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="edit-specialization">Specialization</Label>
        <Input id="edit-specialization" name="specialization" defaultValue={doctor.specialization} required />
      </div>
      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
      <div className="flex justify-end pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
