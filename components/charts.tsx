"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { fontSize: 12, fill: "var(--muted-foreground)" };
const tooltipStyle = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--foreground)" },
  cursor: { fill: "var(--muted)" },
};

export function OutcomeBarChart({ data, category }: { data: { name: string; correct: number; incorrect: number; notAttempted: number }[]; category: string }) {
  return (
    <div className="h-64 w-full" role="img" aria-label={`Correct, incorrect and not attempted by ${category}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          <Bar dataKey="correct" name="Correct" stackId="a" fill="var(--success)" />
          <Bar dataKey="incorrect" name="Incorrect" stackId="a" fill="var(--danger)" />
          <Bar dataKey="notAttempted" name="Not attempted" stackId="a" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreTrendChart({ data }: { data: { n: number; label: string; score: number }[] }) {
  const min = Math.min(0, Math.floor(Math.min(...data.map((d) => d.score))));
  const ticks = [...(min < 0 ? [min] : []), 0, 5, 10, 15, 20, 25];
  return (
    <div className="h-56 w-full" role="img" aria-label="Score trend across completed attempts">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
          <YAxis domain={[min, 25]} ticks={ticks} interval={0} tick={axis} tickLine={false} axisLine={false} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Tooltip {...tooltipStyle} cursor={{ stroke: "var(--border)" }} />
          <Line type="monotone" dataKey="score" name="Score" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--primary)" }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
