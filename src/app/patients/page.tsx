import prisma from "@/lib/prisma";
import { PatientsTable } from "@/components/dashboard/patients-table";
import { SearchInput } from "@/components/dashboard/search-input";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const params = await searchParams;
  const query = params.query || "";

  const where: any = {};
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
    ];
  }

  const patients = await prisma.patient.findMany({
    where,
    include: {
      _count: {
        select: { appointments: true },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Patients</h1>
        <p className="text-muted-foreground">
          Manage your patient records and view their visit history.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <SearchInput placeholder="Search name or phone..." />
      </div>

      <PatientsTable patients={patients} />
    </div>
  );
}
