"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") || "ALL";

  const handleStatusChange = (status: string | null) => {
    if (!status) return;
    const params = new URLSearchParams(searchParams.toString());
    if (status === "ALL") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    router.push(`/appointments?${params.toString()}`);
  };

  return (
    <div className="w-[180px]">
      <Select value={currentStatus} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-full h-8 px-2.5 rounded-lg border-input bg-transparent text-sm focus:ring-ring">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Status</SelectItem>
          <SelectItem value="CONFIRMED">Confirmed</SelectItem>
          <SelectItem value="CANCELLED">Cancelled</SelectItem>
          <SelectItem value="PENDING">Pending</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
