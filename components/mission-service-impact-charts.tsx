"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ImpactProfile } from "@/lib/impact";

function chartColorByCriticality(criticality: string): string {
  if (criticality === "Critical") {
    return "#ff5a40";
  }
  return "#46c0de";
}

function ImpactBars({ title, data }: { title: string; data: ImpactProfile[] }) {
  if (!data.length) {
    return (
      <div className="panel p-4">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">{title}</h3>
        <p className="mt-3 text-sm text-slate-300/80">No impacted items in the current filter scope.</p>
      </div>
    );
  }

  const top = data.slice(0, 8).map((item) => ({
    ...item,
    shortName: item.name.length > 24 ? `${item.name.slice(0, 24)}...` : item.name
  }));

  return (
    <div className="panel p-4">
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">{title}</h3>
      <div className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top} layout="vertical" margin={{ left: 20, right: 18, top: 8, bottom: 8 }}>
            <CartesianGrid stroke="rgba(120,180,210,0.12)" />
            <XAxis type="number" tick={{ fill: "#a2c2d4", fontSize: 12 }} />
            <YAxis
              dataKey="shortName"
              type="category"
              tick={{ fill: "#c8ddec", fontSize: 11 }}
              width={165}
            />
            <Tooltip
              formatter={(value, name) => [value, name]}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.name ?? label}
            />
            <Legend />
            <Bar
              dataKey="findings"
              name="Findings"
              fill="#46c0de"
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="highPriority"
              name="High Priority"
              fill="#ff5a40"
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="impactedAssets"
              name="Impacted Assets"
              fill="#9ad77b"
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300/80">
        {top.map((item) => (
          <span
            key={item.id}
            className="rounded-full border px-2 py-1"
            style={{ borderColor: chartColorByCriticality(item.criticality) }}
            title={`${item.name} (${item.criticality})`}
          >
            {item.shortName} ({item.criticality})
          </span>
        ))}
      </div>
    </div>
  );
}

export function MissionServiceImpactCharts({
  services
}: {
  services: ImpactProfile[];
}) {
  return <ImpactBars title="Business Services Impacted" data={services} />;
}
