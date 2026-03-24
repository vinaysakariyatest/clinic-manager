import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PatientWithStats {
  id: string;
  name: string | null;
  phone: string;
  _count: {
    appointments: number;
  };
}

export function PatientsTable({ patients }: { patients: PatientWithStats[] }) {
  if (patients.length === 0) {
    return (
      <div className="flex h-[450px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No patients found.
      </div>
    );
  }

  return (
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
            <TableRow key={patient.id}>
              <TableCell className="font-medium">{patient.name || "Anonymous"}</TableCell>
              <TableCell>{patient.phone}</TableCell>
              <TableCell className="text-right">{patient._count.appointments}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
