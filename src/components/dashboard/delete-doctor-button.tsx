'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteDoctor } from "@/app/settings/actions";
import { toast } from "sonner";

export function DeleteDoctorButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this doctor?")) return;

    try {
      setLoading(true);
      await deleteDoctor(id);
      toast.success("Doctor deleted successfully.");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete doctor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="text-red-500 hover:text-red-700 hover:bg-red-50"
      onClick={handleDelete}
      disabled={loading}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
