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

export function PatientsTable({ patients }: { patients: PatientWithStats[] }) {
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
      <div className="rounded-md border bg-card">
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
                <TableCell className="font-medium">{patient.name || "Anonymous"}</TableCell>
                <TableCell>{patient.phone}</TableCell>
                <TableCell className="text-right">{patient._count.appointments}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">
              {selectedPatient?.appointments.map((app) => (
                <div key={app.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-base">
                      {new Date(app.date).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kolkata",
                      })}
                    </div>
                    <Badge className={
                      app.status === "CONFIRMED" ? "bg-green-100 text-green-700 border-green-200" :
                      app.status === "CANCELLED" ? "bg-red-100 text-red-700 border-red-200" :
                      "bg-yellow-100 text-yellow-700 border-yellow-200"
                    }>
                      {app.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Doctor:</span> {app.doctor.name} ({app.doctor.specialization})
                  </div>
                  {app.symptoms && (
                    <div className="text-sm text-muted-foreground italic">
                      <span className="font-medium text-foreground not-italic">Symptoms:</span> "{app.symptoms}"
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
