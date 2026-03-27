"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "./pagination";

interface Appointment {
  id: string;
  date: Date;
  status: string;
  symptoms: string | null;
  doctor: {
    name: string;
    specialization: string;
  };
}

interface PatientWithStats {
  id: string;
  name: string | null;
  phone: string;
  appointments: Appointment[];
  _count: {
    appointments: number;
  };
}

interface PatientsTableProps {
  patients: PatientWithStats[];
  totalPages?: number;
  currentPage?: number;
}

export function PatientsTable({ 
  patients, 
  totalPages = 1, 
  currentPage = 1 
}: PatientsTableProps) {
  const [selectedPatient, setSelectedPatient] = useState<PatientWithStats | null>(null);

  if (patients.length === 0) {
    return (
      <div className="flex h-[450px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No patients found.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient Name</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead className="text-right">Total Appointments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((patient) => (
              <TableRow 
                key={patient.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedPatient(patient)}
              >
                <TableCell className="font-semibold">{patient.name || "Anonymous"}</TableCell>
                <TableCell>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{patient.phone}</span>
                </TableCell>
                <TableCell className="text-right">
                    <Badge variant="outline" className="font-bold border-primary/20 text-primary bg-primary/5">
                        {patient._count.appointments}
                    </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Pagination totalPages={totalPages} currentPage={currentPage} />
      </div>

      <Dialog open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedPatient?.name || "Patient Details"}</DialogTitle>
            <DialogDescription>
              Appointment history and details for phone: {selectedPatient?.phone}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {selectedPatient?.appointments.map((app) => (
                <div key={app.id} className="rounded-xl border p-4 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-base tracking-tight italic">
                      {new Date(app.date).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kolkata",
                      })}
                    </div>
                    <Badge className={
                      app.status === "CONFIRMED" ? "bg-green-100 text-green-700 border-none px-3 font-bold" :
                      app.status === "CANCELLED" ? "bg-red-100 text-red-700 border-none px-3 font-bold" :
                      "bg-yellow-100 text-yellow-700 border-none px-3 font-bold"
                    }>
                      {app.status}
                    </Badge>
                  </div>
                  <div className="text-sm">
                    <span className="font-black uppercase text-[10px] tracking-widest text-muted-foreground mr-2">Assigned Doctor:</span> 
                    <span className="font-semibold text-foreground">{app.doctor.name} ({app.doctor.specialization})</span>
                  </div>
                  {app.symptoms && (
                    <div className="text-sm bg-background/50 p-3 rounded-lg border border-border/10 italic text-muted-foreground">
                      <span className="font-black uppercase text-[9px] tracking-widest block mb-1 not-italic opacity-50">Reported Symptoms</span> 
                      "{app.symptoms}"
                    </div>
                  )}
                </div>
              ))}
              {selectedPatient?.appointments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No appointments found for this patient.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
