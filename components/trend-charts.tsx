"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Legend
} from "recharts";
import { TrendPoint } from "@/lib/types";

function MiniKpiTrend({
  points,
  title,
  dataKey,
  color
}: {
  points: TrendPoint[];
  title: string;
  dataKey: keyof TrendPoint;
  color: string;
}) {
  return (
    <div className="panel-alt p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-300/80">{title}</p>
      <div className="mt-2 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <CartesianGrid stroke="rgba(120,180,210,0.12)" />
            <XAxis dataKey="weekLabel" hide />
            <YAxis hide />
            <Tooltip />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TrendCharts({ points }: { points: TrendPoint[] }) {
  const monthlyMockPoints = useMemo(() => {
    const latestPoint = points[points.length - 1];
    const baselineCompliance = latestPoint?.compliancePercent ?? 78;
    const baselineHighRisk = latestPoint?.highRiskCount ?? 12;
    const baselineCriticalExposure = latestPoint?.criticalExposureCount ?? 7;

    const complianceOffsets = [-7.8, -7.1, -6.4, -5.7, -5.1, -4.4, -3.8, -3.2, -2.5, -1.8, -0.9, 0];
    const highRiskOffsets = [7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 1, 0];
    const criticalExposureOffsets = [5, 5, 4, 4, 3, 3, 2, 2, 2, 1, 1, 0];

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const now = new Date();
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    return Array.from({ length: 12 }, (_, index) => {
      const monthOffset = 11 - index;
      const monthDate = new Date(
        Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - monthOffset, 1)
      );

      return {
        monthLabel: monthDate.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
        compliancePercent: Number(clamp(baselineCompliance + complianceOffsets[index], 40, 100).toFixed(1)),
        highRiskCount: Math.max(0, Math.round(baselineHighRisk + highRiskOffsets[index])),
        criticalExposureCount: Math.max(0, Math.round(baselineCriticalExposure + criticalExposureOffsets[index]))
      };
    });
  }, [points]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <h3 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">12 MONTHS COMPLIANCE TREND</h3>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyMockPoints}>
                <CartesianGrid stroke="rgba(120,180,210,0.15)" />
                <XAxis dataKey="monthLabel" tick={{ fill: "#a2c2d4", fontSize: 10 }} interval={0} />
                <YAxis tick={{ fill: "#a2c2d4", fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="compliancePercent" stroke="#46c0de" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <h3 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Risk Trend</h3>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyMockPoints}>
                <CartesianGrid stroke="rgba(120,180,210,0.15)" />
                <XAxis dataKey="monthLabel" tick={{ fill: "#a2c2d4", fontSize: 10 }} interval={0} />
                <YAxis tick={{ fill: "#a2c2d4", fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="highRiskCount" fill="#ff5a40" radius={[4, 4, 0, 0]} />
                <Bar dataKey="criticalExposureCount" fill="#f2ae2e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}

export function KpiTrendPanel({ points }: { points: TrendPoint[] }) {
  return (
    <div className="panel p-4">
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">All Executive KPI Trends (8 Weeks)</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MiniKpiTrend
          points={points}
          title="Overall Compliance %"
          dataKey="compliancePercent"
          color="#46c0de"
        />
        <MiniKpiTrend
          points={points}
          title="Non-compliant Checks"
          dataKey="nonCompliantCount"
          color="#ff5a40"
        />
        <MiniKpiTrend points={points} title="Unknown Checks" dataKey="unknownCount" color="#f2ae2e" />
        <MiniKpiTrend points={points} title="High Risk Findings" dataKey="highRiskCount" color="#ff4f4f" />
        <MiniKpiTrend
          points={points}
          title="Critical Exposure"
          dataKey="criticalExposureCount"
          color="#ff9e2c"
        />
        <MiniKpiTrend
          points={points}
          title="Mission Capabilities Immediate Action"
          dataKey="immediateActionCount"
          color="#ff6f5e"
        />
      </div>
    </div>
  );
}
