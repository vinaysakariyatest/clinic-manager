'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDoctor } from "@/app/settings/actions";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Doctor"}
    </Button>
  );
}

export function AddDoctorForm({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState<string | null>(null);

  async function clientAction(formData: FormData) {
    try {
      setError(null);
      await addDoctor(formData);
      toast.success("Doctor added successfully!");
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      toast.error(e.message || "Failed to add doctor.");
    }
  }

  return (
    <form action={clientAction} className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Full Name</Label>
        <Input id="name" name="name" placeholder="Dr. Jane Smith" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="specialization">Specialization</Label>
        <Input id="specialization" name="specialization" placeholder="Cardiology, General, etc." required />
      </div>
      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
      <div className="flex justify-end pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
