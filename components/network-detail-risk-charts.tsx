"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { FindingSeverity } from "@/lib/types";

export interface NetworkDetailRiskSeveritySummary {
  severity: FindingSeverity;
  count: number;
}

export interface NetworkDetailWeeklyRiskPoint {
  weekLabel: string;
  highRiskCount: number;
  criticalExposureCount: number;
}

const severityColors: Record<FindingSeverity, string> = {
  "Critical Exposure": "#ef4444",
  "High Risk": "#f97316",
  Major: "#f59e0b",
  Moderate: "#38bdf8",
  "Data Gap": "#94a3b8"
};

export function NetworkDetailRiskCharts({
  riskProfile
}: {
  riskProfile: {
    openFindings: number;
    p1p2Count: number;
    highRiskOpenCount: number;
    criticalExposureOpenCount: number;
    severitySummary: NetworkDetailRiskSeveritySummary[];
    weeklyTrend: NetworkDetailWeeklyRiskPoint[];
  };
}) {
  return (
    <div className="grid min-h-0 gap-3 lg:grid-cols-2">
      <section className="panel-alt flex h-[clamp(285px,36vh,340px)] min-h-0 flex-col p-2.5">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Risk Profile</h3>
        <p className="mt-1 text-xs text-slate-300/80">Open findings by severity in current network detail scope.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-sky-300/25 bg-slate-950/50 p-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Open Findings</p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">{riskProfile.openFindings}</p>
          </div>
          <div className="rounded-lg border border-sky-300/25 bg-slate-950/50 p-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">P1-P2 Findings</p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">{riskProfile.p1p2Count}</p>
          </div>
          <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Critical Exposure (Open)</p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{riskProfile.criticalExposureOpenCount}</p>
          </div>
          <div className="rounded-lg border border-orange-400/25 bg-orange-500/10 p-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">High Risk (Open)</p>
            <p className="mt-1 text-2xl font-semibold text-orange-100">{riskProfile.highRiskOpenCount}</p>
          </div>
        </div>
        <div className="mt-1.5 min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riskProfile.severitySummary} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(120,180,210,0.14)" />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
              <YAxis dataKey="severity" type="category" width={112} tick={{ fill: "#d2e6f4", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
                formatter={(value) => [value, "Open Findings"]}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                <LabelList dataKey="count" position="right" fill="#e2e8f0" fontSize={11} />
                {riskProfile.severitySummary.map((entry) => (
                  <Cell key={entry.severity} fill={severityColors[entry.severity]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel-alt flex h-[clamp(285px,36vh,340px)] min-h-0 flex-col p-2.5">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Risk Trend (3 Months)</h3>
        <p className="mt-1 text-xs text-slate-300/80">
          Weekly open finding counts for Critical Exposure and High Risk.
        </p>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-300/80">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
            High Risk
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            Critical Exposure
          </span>
        </div>
        <div className="mt-1.5 min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={riskProfile.weeklyTrend} margin={{ top: 2, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(120,180,210,0.14)" />
              <XAxis dataKey="weekLabel" minTickGap={14} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} width={30} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
                formatter={(value, name) => [value, name === "highRiskCount" ? "High Risk" : "Critical Exposure"]}
              />
              <Line type="monotone" dataKey="highRiskCount" stroke="#f97316" strokeWidth={2.2} dot={false} isAnimationActive={false} />
              <Line
                type="monotone"
                dataKey="criticalExposureCount"
                stroke="#ef4444"
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
