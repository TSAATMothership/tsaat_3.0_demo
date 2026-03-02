"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";

export interface CoverageByToolPoint {
  label: string;
  coveragePercent: number;
}

export function CoverageByToolRadar({ data }: { data: CoverageByToolPoint[] }) {
  if (!data.length) {
    return (
      <div className="panel-alt p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Coverage By Tool</p>
        <p className="mt-2 text-sm text-slate-300/80">No data in current scope.</p>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    targetPercent: 100
  }));

  return (
    <div className="panel-alt p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Coverage By Tool</p>
      <div className="mt-2 h-[22rem]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData}>
            <PolarGrid stroke="rgba(120,180,210,0.2)" />
            <PolarAngleAxis dataKey="label" tick={{ fill: "#c8ddec", fontSize: 11 }} />
            <PolarRadiusAxis
              domain={[0, 100]}
              tickCount={6}
              tick={{ fill: "#a2c2d4", fontSize: 10 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #94a3b8", color: "#000000" }}
              labelStyle={{ color: "#000000" }}
              formatter={(value, name) => {
                if (name === "Target 100%") {
                  return [`${value}%`, "Target 100%"];
                }
                if (name === "Coverage") {
                  return [`${value}%`, "Coverage"];
                }
                return [value, name];
              }}
            />
            <Radar
              name="Target 100%"
              dataKey="targetPercent"
              stroke="#46c0de"
              fill="#46c0de"
              fillOpacity={0.16}
              isAnimationActive={false}
            />
            <Radar
              name="Coverage"
              dataKey="coveragePercent"
              stroke="#ff5a40"
              fill="#ff5a40"
              fillOpacity={0.28}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
