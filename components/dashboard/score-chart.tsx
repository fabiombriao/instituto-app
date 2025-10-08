"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { weeklyScores } from "@/lib/mockData";
import { SectionCard } from "../ui/section-card";

const chartData = weeklyScores.map((item) => ({
  name: `S${item.weekIndex}`,
  score: item.scorePct
}));

export function ScoreChart() {
  return (
    <SectionCard title="Evolução do ciclo" description="Score semanal vs. 12 semanas">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6b95ff" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#6b95ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                background: "rgba(15,23,42,0.9)",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.2)",
                color: "white"
              }}
            />
            <Area type="monotone" dataKey="score" stroke="#6b95ff" fill="url(#colorScore)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
