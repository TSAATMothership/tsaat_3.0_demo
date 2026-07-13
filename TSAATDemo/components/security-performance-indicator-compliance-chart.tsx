"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";

export interface CompliancePoint {
  label: string;
  description: string;
  possibleCompliancePercent: number;
  actualCompliancePercent: number;
  possibleCompliance: number;
  actualCompliance: number;
}

function possibleComplianceDisplay(point: CompliancePoint | undefined): string {
  if (!point || point.possibleCompliance === 0) {
    return "0 (N/A)";
  }
  return `${point.possibleCompliance} (100%)`;
}

function ComplianceRadarChart({
  title,
  subtitle,
  data
}: {
  title: string;
  subtitle: string;
  data: CompliancePoint[];
}) {
  const panelClassName = "panel flex h-full min-h-[28rem] min-w-0 flex-col overflow-hidden p-4";

  if (!data.length) {
    return (
      <div className={panelClassName}>
        <h3 className="shrink-0 text-sm uppercase tracking-[0.14em] text-slate-200/85">{title}</h3>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <p className="text-sm text-slate-300/80">No compliance data in the current filter scope.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={panelClassName}>
      <h3 className="shrink-0 text-sm uppercase tracking-[0.14em] text-slate-200/85">{title}</h3>
      <div className="mt-3 flex min-h-[20rem] flex-1 items-center justify-center overflow-hidden">
        <div className="h-full min-h-[20rem] w-full min-w-[20rem]">
          <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={320}>
            <RadarChart
              data={data}
              cx="50%"
              cy="50%"
              outerRadius="84%"
              margin={{ top: 8, right: 18, bottom: 8, left: 18 }}
            >
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
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as CompliancePoint | undefined;
                  if (!point) {
                    return "Metric";
                  }
                  return `${point.label} - ${point.description}`;
                }}
                formatter={(value, name, payload) => {
                  if (name === "Target 100%") {
                    return [
                      <span key="target-value" style={{ color: "#46c0de" }}>
                        {possibleComplianceDisplay(payload?.payload)}
                      </span>,
                      <span key="target-name" style={{ color: "#46c0de" }}>
                        Target 100%
                      </span>
                    ];
                  }
                  if (name === "Compliance Score") {
                    const raw = payload?.payload?.actualCompliance ?? 0;
                    return [
                      <span key="score-value" style={{ color: "#ff5a40" }}>
                        {`${raw} (${value}%)`}
                      </span>,
                      <span key="score-name" style={{ color: "#ff5a40" }}>
                        Compliance Score
                      </span>
                    ];
                  }
                  return [value, name];
                }}
              />
              <Legend />
              <Radar
                name="Target 100%"
                dataKey="possibleCompliancePercent"
                stroke="#46c0de"
                fill="#46c0de"
                fillOpacity={0.18}
                isAnimationActive={false}
              />
              <Radar
                name="Compliance Score"
                dataKey="actualCompliancePercent"
                stroke="#ff5a40"
                fill="#ff5a40"
                fillOpacity={0.28}
                isAnimationActive={false}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="mt-2 shrink-0 text-xs text-slate-300/75">{subtitle}</p>
    </div>
  );
}

export function SecurityPerformanceIndicatorComplianceChart({
  data
}: {
  data: CompliancePoint[];
}) {
  return (
    <ComplianceRadarChart
      title="Findings Measures - Security Performance Indicator Compliance"
      subtitle="Each point is a database-defined SPI, comparing total possible compliance against actual compliant checks."
      data={data}
    />
  );
}

export function KpiComplianceChart({ data }: { data: CompliancePoint[] }) {
  return (
    <ComplianceRadarChart
      title="Key Performance Indicator Compliance"
      subtitle="Each point is a database-defined KPI, comparing target performance against actual score in current filter scope."
      data={data}
    />
  );
}
