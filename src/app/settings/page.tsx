import prisma from "@/lib/prisma";
import { ClinicProfile } from "@/components/dashboard/clinic-profile";
import { DoctorManagement } from "@/components/dashboard/doctor-management";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

export default async function SettingsPage() {
  const doctors = await prisma.doctor.findMany({
    orderBy: { name: "asc" },
  });

  const aiStatus = !!process.env.OPENAI_API_KEY || !!process.env.GEMINI_API_KEY;
  const whatsappStatus = !!process.env.WHATSAPP_TOKEN;

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
          <ClinicProfile />
          
          <Card>
            <CardHeader>
              <CardTitle>System Integrations</CardTitle>
              <CardDescription>Status of your AI and communication services.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">AI Agent (GPT-4o/Gemini)</span>
                  <span className="text-xs text-muted-foreground">Used for intent extraction and symptom analysis.</span>
                </div>
                {aiStatus ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-3">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                    <XCircle className="mr-1 h-3 w-3" /> Missing API Key
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">WhatsApp Cloud API</span>
                  <span className="text-xs text-muted-foreground">Integration for receiving and sending messages.</span>
                </div>
                {whatsappStatus ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-3">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                    <XCircle className="mr-1 h-3 w-3" /> Disconnected
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <DoctorManagement doctors={doctors} />
        </div>
      </div>
    </div>
  );
}
