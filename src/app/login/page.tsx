"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, User, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid credentials. Please try again.");
      } else {
        toast.success("Welcome back, Admin!");
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/80 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-repeat">
      {/* Subtle Background Blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />

      <Card className="w-full max-w-md border-white/40 bg-white/70 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden animate-in fade-in zoom-in duration-700 relative z-10">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-700" />
        
        <CardHeader className="space-y-1.5 pb-8 pt-8 text-center">
          <div className="mx-auto bg-indigo-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-indigo-200 transform hover:rotate-3 transition-transform">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-3xl font-black tracking-tight text-slate-900">ClinicManager</CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            Administrative Access Portal
          </CardDescription>
        </CardHeader>
        
        <CardContent className="px-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-700 text-sm font-semibold ml-1">Username</Label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-white border-slate-200 text-slate-900 pl-11 h-12 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 transition-all rounded-xl shadow-sm"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 text-sm font-semibold ml-1">Password</Label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white border-slate-200 text-slate-900 pl-11 h-12 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 transition-all rounded-xl shadow-sm"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 rounded-xl transition-all shadow-xl shadow-indigo-100 active:scale-[0.98] mt-2 text-base"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="flex flex-col border-t border-slate-100 bg-slate-50/50 pt-5 pb-6">
          <p className="text-xs text-center text-slate-400 font-medium tracking-wide uppercase">
            SECURE ACCESS ONLY
          </p>
        </CardFooter>
      </Card>
      
      {/* <div className="fixed bottom-10 text-center w-full">
        <p className="text-slate-400/60 text-[10px] font-bold tracking-[0.2em] uppercase">Powered by Antigravity AI Engine</p>
      </div> */}
    </div>
  );
}

