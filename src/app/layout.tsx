import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthProvider } from "@/components/providers/auth-provider";
import { auth } from "@/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClinicManager - AI Appointment System",
  description: "AI-Powered Medical Appointment & Clinic Manager",
};

import { NotificationPoller } from "@/components/dashboard/notification-poller";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen flex overflow-hidden`}>
        <AuthProvider>
          {session ? (
            <>
              <Sidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <Header />
                <main className="flex-1 overflow-auto bg-muted/20 p-4 lg:p-6">
                  {children}
                </main>
              </div>
              <NotificationPoller />
            </>
          ) : (
            <div className="flex-1 h-screen overflow-hidden">
               {children}
            </div>
          )}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}


