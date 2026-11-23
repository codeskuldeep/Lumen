"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Overview } from "@/lib/types";

export default function TrendChart({ data }: { data: Overview["trend"] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b6cff" stopOpacity={0.55} /><stop offset="100%" stopColor="#8b6cff" stopOpacity={0} /></linearGradient>
          <linearGradient id="s" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#9a7dff" /><stop offset="100%" stopColor="#38d6ff" /></linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" })} tick={{ fill: "#a6a3c4", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#a6a3c4", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ stroke: "rgba(255,255,255,.2)" }} contentStyle={{ background: "rgba(20,18,42,.92)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, backdropFilter: "blur(12px)", color: "#fff" }}
          labelFormatter={(d) => new Date(d as string).toLocaleDateString(undefined, { dateStyle: "medium" })} formatter={(v, _n, p) => [`${v}% (${p.payload.runs} answers)`, "Visibility"]} />
        <Area type="monotone" dataKey="visibility" stroke="url(#s)" strokeWidth={2.5} fill="url(#g)" animationDuration={900} dot={data.length < 15 ? { r: 3, fill: "#fff", strokeWidth: 0 } : false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
