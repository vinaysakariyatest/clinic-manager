"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateClinicConfig } from "@/app/settings/actions";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ClinicConfig {
  name: string;
  address: string;
  openTime: number;
  closeTime: number;
}

export function ClinicProfile({ config }: { config: ClinicConfig }) {
  const [isPending, setIsPending] = useState(false);
  const [formData, setFormData] = useState({
    name: config.name,
    address: config.address,
    openTime: config.openTime,
    closeTime: config.closeTime,
  });

  async function clientAction(form: FormData) {
    setIsPending(true);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clinic Profile</CardTitle>
        <CardDescription>
          Manage your clinic's operational hours and basic information.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={clientAction} className="space-y-5">
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
