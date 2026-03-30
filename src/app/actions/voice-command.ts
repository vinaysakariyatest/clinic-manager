"use server";

import { generateObject } from 'ai';
import { z } from 'zod';
import { geminiModel } from "@/lib/gemini";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const VoiceActionSchema = z.object({
  action: z.enum(["NAVIGATE", "CANCEL", "SEARCH", "THEME", "REFRESH", "LOGOUT", "UNKNOWN"]),
  target: z.string().optional(),
  patientName: z.string().optional(),
  query: z.string().optional(),
  message: z.string(),
});

type VoiceCommandResponse = 
  | { success: true; action: "NAVIGATE" | "CANCEL" | "SEARCH" | "THEME" | "REFRESH" | "LOGOUT" | "UNKNOWN"; message: string; target?: string }

  | { success: false; action: "UNKNOWN"; message: string };

export async function processVoiceCommand(text: string): Promise<VoiceCommandResponse> {

  try {
    const { object } = await generateObject({
      model: geminiModel,
      schema: VoiceActionSchema,
      prompt: `
        You are an AI Dashboard Assistant for a Medical Clinic. 
        Your task is to parse a voice-to-text string and determine the administrative action.
        
        Rules:
        - If the user wants to see "queue" or "dashboard", action is "NAVIGATE" and target is "/".
        - If they want to see "patients", action is "NAVIGATE" and target is "/patients".
        - If they want to see "appointments", action is "NAVIGATE" and target is "/appointments".
        - If they want to cancel an appointment (e.g., "Cancel Vinay's appointment"), action is "CANCEL" and patientName is "Vinay".
        - If they want to search for something, action is "SEARCH" and query is the search term.
        - If they want to logout, action is "LOGOUT".
        - For any other dashboard interaction, pick the closest fit.
        - The "message" field should be a friendly confirmation in English (e.g., "Sure, navigating to patients list.").
        
        User input: "${text}"
      `,
    });

    // Special handling for CANCEL to find the ID if possible? 
    // For now, we return the intent and let the client handle it or just show a message.
    // Let's try to find an app for the patient to cancel if it's high confidence.
    if (object.action === "CANCEL" && object.patientName) {
        const appointment = await prisma.appointment.findFirst({
            where: {
                patient: {
                    name: { contains: object.patientName, mode: 'insensitive' }
                },
                status: 'CONFIRMED'
            },
            orderBy: { date: 'asc' }
        });
        
        if (appointment) {
            // We could auto-cancel here, but it's safer to just return a confirmation
            // and let the client-side show a "Found it, should I cancel?" or just do it.
            // User requested "Cancel Vinay's appointment", so let's do it if found.
            await prisma.appointment.update({
                where: { id: appointment.id },
                data: { status: 'CANCELLED' }
            });
            object.message = `Successfully cancelled appointment for ${object.patientName}.`;
            revalidatePath('/');
        } else {
            object.message = `I couldn't find a confirmed appointment for ${object.patientName}.`;
        }
    }

    return { 
        success: true, 
        action: object.action, 
        target: object.target, 
        message: object.message 
    };
  } catch (error) {
    console.error("AI Voice Error:", error);
    return { 
        success: false, 
        action: "UNKNOWN" as const, 
        message: "Sorry, I couldn't understand that." 
    };
  }
}

