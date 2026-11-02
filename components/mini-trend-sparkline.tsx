"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

interface MiniTrendSparklinePoint {
  label: string;
  value: number;
}

export function MiniTrendSparkline({
  points,
  stroke,
  heightClassName = "h-24"
}: {
  points: MiniTrendSparklinePoint[];
  stroke: string;
  heightClassName?: string;
}) {
  if (!points.length) {
    return <p className="mt-2 text-[10px] text-slate-400/80">No trend data</p>;
  }

  return (
    <div className={`mt-2 rounded-sm border border-sky-400/15 bg-slate-950/40 p-1.5 ${heightClassName}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <CartesianGrid stroke="rgba(120,180,210,0.12)" />
          <XAxis dataKey="label" tick={{ fill: "#a2c2d4", fontSize: 10 }} />
          <YAxis allowDecimals={false} tick={{ fill: "#a2c2d4", fontSize: 10 }} width={24} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
