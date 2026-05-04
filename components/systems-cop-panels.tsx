"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from "recharts";
import { NetworkDetailRiskCharts, NetworkDetailRiskFindingRow } from "@/components/network-detail-risk-charts";
import {
  dispatchSystemsBlastRadiusSelection,
  SYSTEMS_BLAST_RADIUS_SELECTION_EVENT,
  SystemsBlastRadiusSelectionDetail
} from "@/lib/systems-blast-radius-selection";
import { OverviewComplianceScoreStrip, type OverviewScoreCard } from "@/components/overview-compliance-score-strip";
import { FindingSeverity, HighRiskCveDetail } from "@/lib/types";

export interface SystemSeveritySummary {
  severity: FindingSeverity;
  count: number;
}

export interface SystemWeeklyRiskPoint {
  weekLabel: string;
  highRiskCount: number | null;
  criticalExposureCount: number | null;
}

export interface SystemDailyTrendPoint {
  date: string;
  label: string;
  count: number | null;
}

export interface SystemBlastRadiusPoint {
  systemId: string;
  systemName: string;
  endpointCount: number;
  highRiskP12FindingsCount: number;
}

function KpiBulletRow({
  title,
  primaryLabel,
  primaryValue,
  totalValue,
  tone
}: {
  title: string;
  primaryLabel: string;
  primaryValue: number;
  totalValue: number;
  tone: "good" | "watch" | "critical";
}) {
  const safeTotal = Math.max(0, totalValue);
  const safePrimary = Math.min(Math.max(0, primaryValue), safeTotal);
  const remainder = Math.max(0, safeTotal - safePrimary);
  const primaryPercent = safeTotal > 0 ? (safePrimary / safeTotal) * 100 : 0;
  const primaryToneClass =
    tone === "good" ? "bg-emerald-400/90" : tone === "watch" ? "bg-cyan-300/90" : "bg-orange-400/90";

  return (
    <tr className="border-t border-sky-300/10 align-top">
      <td className="px-3 py-2.5 text-sm text-slate-200">{title}</td>
      <td className="px-3 py-2.5">
        <p className="text-sm font-semibold text-slate-100">
          {safePrimary} / {safeTotal}
        </p>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full border border-sky-300/20 bg-slate-900/90">
          <div className="flex h-full w-full">
            <div className={`h-full ${primaryToneClass}`} style={{ width: `${primaryPercent}%` }} />
            <div className="h-full bg-slate-700/75" style={{ width: `${100 - primaryPercent}%` }} />
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-300/85">
          <span>{primaryLabel}: {safePrimary}</span>
          <span>Rest: {remainder}</span>
        </div>
      </td>
    </tr>
  );
}

function heatMapColorByHighRiskCount(value: number, maxValue: number): string {
  if (maxValue <= 0) {
    return "rgb(255, 255, 255)";
  }

  const ratio = Math.max(0, Math.min(1, value / maxValue));
  const start = { r: 255, g: 255, b: 255 };
  const end = { r: 220, g: 20, b: 60 }; // Crimson

  const r = Math.round(start.r + (end.r - start.r) * ratio);
  const g = Math.round(start.g + (end.g - start.g) * ratio);
  const b = Math.round(start.b + (end.b - start.b) * ratio);

  return `rgb(${r}, ${g}, ${b})`;
}

function BlastRadiusTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload: SystemBlastRadiusPoint }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="rounded border border-slate-400/50 bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="font-semibold text-white">{point.systemName}</p>
      <p className="mt-1 text-white">Endpoints: {point.endpointCount}</p>
      <p className="text-white">High Risk (P1-P2): {point.highRiskP12FindingsCount}</p>
    </div>
  );
}

export function SystemsPostureKpiSummary({
  compliantSystemsCount,
  systemsMeetingDiscoveryRequirementsCount,
  totalSystemsCount,
  highRiskP12FindingsCount,
  totalFindingsCount,
  blastRadiusPoints
}: {
  compliantSystemsCount: number;
  systemsMeetingDiscoveryRequirementsCount: number;
  totalSystemsCount: number;
  highRiskP12FindingsCount: number;
  totalFindingsCount: number;
  blastRadiusPoints: SystemBlastRadiusPoint[];
}) {
  const [selectedBlastRadiusSystemId, setSelectedBlastRadiusSystemId] = useState<string | null>(null);
  const scopedSystemsWithRisk = blastRadiusPoints.filter(
    (point) => point.endpointCount > 0 || point.highRiskP12FindingsCount > 0
  );
  const maxHighRiskCount = scopedSystemsWithRisk.reduce(
    (maxValue, point) => Math.max(maxValue, point.highRiskP12FindingsCount),
    0
  );

  useEffect(() => {
    const onSelectionChange = (event: Event) => {
      const { detail } = event as CustomEvent<SystemsBlastRadiusSelectionDetail>;
      setSelectedBlastRadiusSystemId(detail?.systemId ?? null);
    };

    window.addEventListener(SYSTEMS_BLAST_RADIUS_SELECTION_EVENT, onSelectionChange as EventListener);
    return () => {
      window.removeEventListener(SYSTEMS_BLAST_RADIUS_SELECTION_EVENT, onSelectionChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!selectedBlastRadiusSystemId) {
      return;
    }
    const stillVisible = scopedSystemsWithRisk.some((point) => point.systemId === selectedBlastRadiusSystemId);
    if (stillVisible) {
      return;
    }
    setSelectedBlastRadiusSystemId(null);
    dispatchSystemsBlastRadiusSelection({ systemId: null });
  }, [scopedSystemsWithRisk, selectedBlastRadiusSystemId]);

  const onBlastRadiusPointClick = (event: unknown) => {
    const point = (event as { payload?: SystemBlastRadiusPoint } | null)?.payload;
    if (!point) {
      return;
    }

    const nextSystemId = selectedBlastRadiusSystemId === point.systemId ? null : point.systemId;
    setSelectedBlastRadiusSystemId(nextSystemId);
    dispatchSystemsBlastRadiusSelection({ systemId: nextSystemId });
  };

  return (
    <section className="grid gap-2 lg:grid-cols-2">
      <article className="panel flex min-h-[17.5rem] flex-col p-3">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">KPI Statistics</h2>
        <p className="mt-1 text-xs text-slate-300/75">
          Current filtered ICT system outcomes for compliance, discovery, and high-risk pressure.
        </p>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-lg border border-sky-300/15 bg-slate-950/45">
          <table className="min-w-full">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2 text-left">KPI</th>
                <th className="px-3 py-2 text-left">Result</th>
              </tr>
            </thead>
            <tbody>
              <KpiBulletRow
                title="Total number of compliant ICT systems"
                primaryLabel="Compliant"
                primaryValue={compliantSystemsCount}
                totalValue={totalSystemsCount}
                tone="good"
              />
              <KpiBulletRow
                title="Total number of ICT systems meeting discovery requirements"
                primaryLabel="Discovery Compliant"
                primaryValue={systemsMeetingDiscoveryRequirementsCount}
                totalValue={totalSystemsCount}
                tone="watch"
              />
              <KpiBulletRow
                title="Total high risk findings (P1-P2)"
                primaryLabel="High Risk (P1-P2)"
                primaryValue={highRiskP12FindingsCount}
                totalValue={totalFindingsCount}
                tone="critical"
              />
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel flex min-h-[17.5rem] flex-col p-3">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">High Risk ICT Systems</h2>
        <p className="mt-1 text-xs text-slate-300/75">
          ICT systems by total endpoints versus total high risk findings (P1-P2).
        </p>
        <div className="mt-2 min-h-0 flex-1">
          {scopedSystemsWithRisk.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 6, right: 10, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="rgba(120,180,210,0.14)" />
                <XAxis
                  type="number"
                  dataKey="endpointCount"
                  name="Endpoints"
                  allowDecimals={false}
                  tick={{ fill: "#a8c6d8", fontSize: 11 }}
                  label={{ value: "Endpoints", position: "insideBottom", offset: -4, fill: "#a8c6d8", fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="highRiskP12FindingsCount"
                  name="High Risk (P1-P2)"
                  allowDecimals={false}
                  tick={{ fill: "#a8c6d8", fontSize: 11 }}
                  label={{
                    value: "High Risk (P1-P2)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#a8c6d8",
                    fontSize: 11
                  }}
                  width={40}
                />
                <ZAxis type="number" dataKey="highRiskP12FindingsCount" range={[80, 520]} />
                <Tooltip
                  cursor={{ stroke: "rgba(56,189,248,0.5)", strokeWidth: 1 }}
                  content={<BlastRadiusTooltip />}
                />
                <Scatter
                  name="ICT Systems"
                  data={scopedSystemsWithRisk}
                  isAnimationActive={false}
                  onClick={onBlastRadiusPointClick}
                >
                  {scopedSystemsWithRisk.map((point) => (
                    <Cell
                      key={point.systemId}
                      fill={heatMapColorByHighRiskCount(point.highRiskP12FindingsCount, maxHighRiskCount)}
                      fillOpacity={
                        selectedBlastRadiusSystemId && selectedBlastRadiusSystemId !== point.systemId ? 0.3 : 1
                      }
                      stroke={selectedBlastRadiusSystemId === point.systemId ? "#fef08a" : "rgba(248,250,252,0.88)"}
                      strokeWidth={selectedBlastRadiusSystemId === point.systemId ? 2 : 0.7}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-sky-300/15 bg-slate-950/45 px-4 text-center text-sm text-slate-300/75">
              No endpoint or P1-P2 high-risk data available in the current filter scope.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

function DailyTrendPanel({
  title,
  subtitle,
  color,
  data
}: {
  title: string;
  subtitle: string;
  color: string;
  data: SystemDailyTrendPoint[];
}) {
  return (
    <section className="panel flex h-full min-h-0 flex-col p-3">
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">{title}</h3>
      <p className="mt-1 text-xs text-slate-300/80">{subtitle}</p>
      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(120,180,210,0.14)" />
            <XAxis dataKey="label" minTickGap={36} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} width={28} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
              formatter={(value) => [value ?? "-", "Open Findings"]}
            />
            <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2.2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function SystemsOverviewPanel({
  snapshotDate,
  scoreCards,
  modellingCoverage,
  riskProfile,
  riskFindings,
  assetHighRiskCvesByAssetId = {},
  asOfDate,
  dailyHighRisk,
  dailyCriticalExposure
}: {
  snapshotDate: string;
  scoreCards: [OverviewScoreCard, OverviewScoreCard];
  modellingCoverage: {
    modelledPercent: number;
    notModelledPercent: number;
    modelledCount: number;
    notModelledCount: number;
    totalCount: number;
  };
  riskProfile: {
    openFindings: number;
    p1p2Count: number;
    highRiskOpenCount: number;
    criticalExposureOpenCount: number;
    severitySummary: SystemSeveritySummary[];
    weeklyTrend: SystemWeeklyRiskPoint[];
  };
  riskFindings: NetworkDetailRiskFindingRow[];
  assetHighRiskCvesByAssetId?: Record<string, HighRiskCveDetail[]>;
  asOfDate?: string;
  dailyHighRisk: SystemDailyTrendPoint[];
  dailyCriticalExposure: SystemDailyTrendPoint[];
}) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_minmax(0,0.82fr)] gap-2">
      <OverviewComplianceScoreStrip
        snapshotDate={snapshotDate}
        modellingGapLabel="ICT Systems not modelled"
        modellingEntityLabel="ICT systems"
        scoreCards={scoreCards}
        modellingCoverage={modellingCoverage}
      />

      <div className="min-h-0">
        <NetworkDetailRiskCharts
          asOfDate={asOfDate}
          scopeDescription="Open finding pressure by severity across scoped ICT systems."
          riskProfile={riskProfile}
          findings={riskFindings}
          assetHighRiskCvesByAssetId={assetHighRiskCvesByAssetId}
        />
      </div>

      <div className="grid min-h-0 gap-2 lg:grid-cols-2">
        <DailyTrendPanel
          title="Open High Risk Findings"
          subtitle="Daily open high-risk trajectory for the last 12 months. Right edge aligns to the selected date."
          color="#f97316"
          data={dailyHighRisk}
        />
        <DailyTrendPanel
          title="Open Critical Exposure Findings"
          subtitle="Daily open critical-exposure trajectory for the last 12 months. Right edge aligns to the selected date."
          color="#ef4444"
          data={dailyCriticalExposure}
        />
      </div>
    </div>
  );
}
