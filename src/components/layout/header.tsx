"use client";

import { Search, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import { NotificationCenter } from "@/components/dashboard/notification-center";


export function Header() {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      <div className="w-full flex-1">
        <form>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search patients or appointments..."
              className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
            />
          </div>
        </form>
      </div>
      <div className="flex items-center gap-4 px-2">
        <NotificationCenter />
        <div className="h-6 w-px bg-slate-200 hidden md:block" />
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 gap-2 text-slate-500 border-slate-200 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all shadow-sm font-semibold px-4"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden md:inline">Sign Out</span>
        </Button>
      </div>
    </header>
  );
}


