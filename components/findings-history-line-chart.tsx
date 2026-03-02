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

interface FindingsHistoryPoint {
  date: string;
  openFindings: number;
}

function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}:${month}:${year}`;
}

export function FindingsHistoryLineChart({
  points,
  status
}: {
  points: FindingsHistoryPoint[];
  status: "open" | "closed";
}) {
  const currentTotal = points[points.length - 1]?.openFindings ?? 0;
  const isClosed = status === "closed";
  const lineLabel = isClosed ? "Closed Findings" : "Open Findings";
  const lineStroke = isClosed ? "#ef4444" : "#46c0de";
  const subtitle = isClosed
    ? "Closed findings over time from two years ago to today."
    : "Open findings over time from two years ago to today.";

  return (
    <section className="panel p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Findings History (2 Years)</h2>
          <p className="mt-1 text-xs text-slate-300/80">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Total Findings (Current Date)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">{currentTotal.toLocaleString("en-US")}</p>
        </div>
      </div>
      <div className="mt-3 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <CartesianGrid stroke="rgba(120,180,210,0.15)" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#a2c2d4", fontSize: 10 }}
              minTickGap={50}
              tickFormatter={formatDisplayDate}
            />
            <YAxis allowDecimals={false} tick={{ fill: "#a2c2d4", fontSize: 11 }} />
            <Tooltip
              formatter={(value, name) => [value ?? 0, name ?? "Value"]}
              labelFormatter={(label: unknown) => `Date: ${formatDisplayDate(String(label ?? ""))}`}
            />
            <Line type="monotone" dataKey="openFindings" name={lineLabel} stroke={lineStroke} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
