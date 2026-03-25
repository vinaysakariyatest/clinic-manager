"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

export function DateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentDate = searchParams.get("date") || "";

  const handleDateChange = (date: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!date) {
      params.delete("date");
    } else {
      params.set("date", date);
    }
    router.push(`/appointments?${params.toString()}`);
  };

  const clearDate = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("date");
    router.push(`/appointments?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={currentDate}
        onChange={(e) => handleDateChange(e.target.value)}
        className="h-8 w-[160px] cursor-pointer"
      />
      {currentDate && (
        <Button 
          variant="ghost" 
          size="icon-sm" 
          onClick={clearDate}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
