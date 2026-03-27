import prisma from "@/lib/prisma";
import { PatientsTable } from "@/components/dashboard/patients-table";
import { SearchInput } from "@/components/dashboard/search-input";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.query || "";
  const page = parseInt(params.page || "1", 10);
  const limit = 10;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
    ];
  }

  const [patients, totalCount] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: {
        appointments: {
          include: {
            doctor: true,
          },
          orderBy: {
            date: "desc",
          },
        },
        _count: {
          select: { appointments: true },
        },
      },
      orderBy: {
        name: "asc",
      },
      skip,
      take: limit,
    }),
    prisma.patient.count({ where })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

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

      <PatientsTable 
        patients={patients} 
        totalPages={totalPages} 
        currentPage={page} 
      />
    </div>
  );
}
