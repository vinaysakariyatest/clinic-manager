import prisma from "@/lib/prisma";
import { ClinicProfile } from "@/components/dashboard/clinic-profile";
import { DoctorManagement } from "@/components/dashboard/doctor-management";
import { HolidayManagement } from "@/components/dashboard/holiday-management";

export default async function SettingsPage() {
  const [doctors, config, holidays] = await Promise.all([
    prisma.doctor.findMany({ orderBy: { name: "asc" } }),
    prisma.clinicConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' }
    }),
    prisma.holiday.findMany({ 
      where: { date: { gte: new Date() } },
      orderBy: { date: "asc" } 
    })
  ]);

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-800">Settings</h1>
        <p className="text-slate-500 font-medium">
          Configure clinical parameters, manage your team and scheduled holidays.
        </p>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-2 items-start pb-20">
        <div className="flex flex-col gap-8">
          <ClinicProfile key={config.updatedAt.toISOString()} config={config as any} />
        </div>

        <div className="flex flex-col gap-8">
          <DoctorManagement doctors={doctors} />
          <HolidayManagement holidays={holidays as any} />
        </div>
      </div>
    </div>
  );
}
