import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ClinicProfile() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clinic Profile</CardTitle>
        <CardDescription>
          Information about your clinic that will be used for AI responses and appointment details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="clinic-name">Clinic Name</Label>
          <Input id="clinic-name" placeholder="City Medical Center" defaultValue="City Medical Center" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" placeholder="123 Main St, New Delhi" defaultValue="123 Main St, New Delhi" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="whatsapp">WhatsApp Number ID</Label>
          <Input id="whatsapp" placeholder="e.g. 1048293028392" defaultValue={process.env.WHATSAPP_PHONE_NUMBER_ID || ""} />
          <p className="text-[10px] text-muted-foreground">This is used for the WhatsApp Meta Cloud API.</p>
        </div>
        <Button className="w-fit">Save Profile</Button>
      </CardContent>
    </Card>
  );
}
