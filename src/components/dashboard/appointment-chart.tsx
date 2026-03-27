"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

interface ChartProps {
  data: {
    name: string;
    appointments: number;
  }[];
  className?: string;
}

export function AppointmentChart({ data, className }: ChartProps) {
  return (
    <Card className={`col-span-1 shadow-sm border-slate-200 overflow-hidden flex flex-col ${className}`}>
      <CardHeader className="bg-slate-50/50 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
            <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-indigo-600">Daily Bookings</CardTitle>
                <CardDescription className="text-xs text-slate-400 font-bold uppercase mt-1">Appointments per day</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 px-2 flex-1 min-h-0">
        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                }}
                itemStyle={{ color: '#4f46e5' }}
              />
              <Bar
                dataKey="appointments"
                fill="#4f46e5"
                radius={[4, 4, 0, 0]}
                barSize={32}
                animationDuration={1500}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
