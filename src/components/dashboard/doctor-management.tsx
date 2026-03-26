'use client';

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddDoctorForm } from "./add-doctor-form";
import { EditDoctorForm } from "./edit-doctor-form";
import { DeleteDoctorButton } from "./delete-doctor-button";

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  openTime: number;
  closeTime: number;
}

export function DoctorManagement({ doctors }: { doctors: Doctor[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<Doctor | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Doctor Management</CardTitle>
          <CardDescription>
            Register and manage doctors working in your clinic.
          </CardDescription>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Doctor
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Doctor</DialogTitle>
              <DialogDescription>
                Enter the details of the doctor to add them to the clinic's roster.
              </DialogDescription>
            </DialogHeader>
            <AddDoctorForm onSuccess={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.map((doctor) => (
                <TableRow key={doctor.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{doctor.name}</TableCell>
                  <TableCell>{doctor.specialization}</TableCell>
                  <TableCell className="text-sm">
                    {doctor.openTime}:00 - {doctor.closeTime}:00
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Dialog open={!!editDoc && editDoc.id === doctor.id} onOpenChange={(open) => !open && setEditDoc(null)}>
                      <DialogTrigger render={
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="hover:text-primary"
                          onClick={() => setEditDoc(doctor)}
                        />
                      }>
                        <Pencil className="h-4 w-4" />
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Doctor</DialogTitle>
                          <DialogDescription>
                            Update the information for {doctor.name}.
                          </DialogDescription>
                        </DialogHeader>
                        {editDoc && (
                          <EditDoctorForm 
                            doctor={editDoc} 
                            onSuccess={() => setEditDoc(null)} 
                          />
                        )}
                      </DialogContent>
                    </Dialog>
                    
                    <DeleteDoctorButton id={doctor.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
