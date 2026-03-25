import prisma from "@/lib/prisma";
import { ClinicProfile } from "@/components/dashboard/clinic-profile";
import { DoctorManagement } from "@/components/dashboard/doctor-management";
export default async function SettingsPage() {
  const [doctors, config] = await Promise.all([
    prisma.doctor.findMany({ orderBy: { name: "asc" } }),
    prisma.clinicConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' }
    })
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure clinical parameters and manage your team.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <ClinicProfile key={config.updatedAt.toISOString()} config={config} />
        </div>

        <div className="space-y-6">
          <DoctorManagement doctors={doctors} />
        </div>
      </div>
    </div>
  );
}
