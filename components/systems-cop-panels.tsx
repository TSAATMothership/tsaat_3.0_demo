"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
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

export interface SystemActionThroughputPoint {
  weekLabel: string;
  openedCount: number;
  closedCount: number;
  netChange: number;
}

export interface SystemActionAgeBucketRow {
  bucketLabel: string;
  criticalExposureCount: number;
  highRiskCount: number;
  otherCount: number;
  total: number;
}

export interface SystemActionOldestFindingRow {
  findingId: string;
  title: string;
  severity: FindingSeverity;
  spiLabel: string;
  systemName: string;
  impactedDevices: string;
  openedDate: string;
  ageDays: number;
}

export interface SystemActionQuickWinRow {
  actionText: string;
  criticalExposureCount: number;
  highRiskCount: number;
  otherCount: number;
  total: number;
  systemCount: number;
}

export interface SystemBlastRadiusPoint {
  systemId: string;
  systemName: string;
  endpointCount: number;
  highRiskP12FindingsCount: number;
}

function ActionTile({
  title,
  value,
  subtitle,
  tone
}: {
  title: string;
  value: number;
  subtitle: string;
  tone: "critical" | "warning" | "watch";
}) {
  const toneClass =
    tone === "critical"
      ? "border-red-400/35 text-red-100"
      : tone === "warning"
        ? "border-amber-300/35 text-amber-100"
        : "border-sky-300/35 text-sky-100";

  return (
    <article className={`panel-alt ${toneClass} p-3`}>
      <p className="text-[11px] uppercase tracking-[0.15em] text-slate-300/75">{title}</p>
      <p className="mt-1.5 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-300/80">{subtitle}</p>
    </article>
  );
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

function RemediationThroughputChart({ rows }: { rows: SystemActionThroughputPoint[] }) {
  const totalOpened = rows.reduce((accumulator, row) => accumulator + row.openedCount, 0);
  const totalClosed = rows.reduce((accumulator, row) => accumulator + row.closedCount, 0);

  return (
    <section className="panel flex min-h-0 flex-col p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Remediation Throughput (Weekly)</h3>
          <p className="mt-1 text-xs text-slate-300/80">Opened vs closed findings over the last 13 weeks.</p>
        </div>
        <p className="rounded-full border border-sky-300/30 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-200">
          Opened: {totalOpened} | Closed: {totalClosed}
        </p>
      </div>
      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
            <CartesianGrid stroke="rgba(120,180,210,0.14)" />
            <XAxis dataKey="weekLabel" minTickGap={18} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
              formatter={(value, name) => [value, name === "openedCount" ? "Opened" : "Closed"]}
            />
            <Legend
              formatter={(value) => (value === "openedCount" ? "Opened" : "Closed")}
              wrapperStyle={{ fontSize: "12px", color: "#d1e3ef" }}
            />
            <Bar dataKey="openedCount" fill="#f59e0b" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="closedCount" fill="#22c55e" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function FindingAgingBucketsChart({ rows }: { rows: SystemActionAgeBucketRow[] }) {
  return (
    <section className="panel flex min-h-0 flex-col p-3">
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Open Findings Aging Buckets</h3>
      <p className="mt-1 text-xs text-slate-300/80">Current open findings grouped by age and severity mix.</p>
      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
            <CartesianGrid stroke="rgba(120,180,210,0.14)" />
            <XAxis dataKey="bucketLabel" tick={{ fill: "#a8c6d8", fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
              formatter={(value, key) => {
                if (key === "criticalExposureCount") {
                  return [value, "Critical Exposure"];
                }
                if (key === "highRiskCount") {
                  return [value, "High Risk"];
                }
                return [value, "Other"];
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px", color: "#d1e3ef" }} />
            <Bar dataKey="criticalExposureCount" stackId="severity" name="Critical Exposure" fill="#ef4444" isAnimationActive={false} />
            <Bar dataKey="highRiskCount" stackId="severity" name="High Risk" fill="#f97316" isAnimationActive={false} />
            <Bar dataKey="otherCount" stackId="severity" name="Other" fill="#38bdf8" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function severityPillClass(severity: FindingSeverity): string {
  if (severity === "Critical Exposure") {
    return "border-red-400/35 text-red-100";
  }
  if (severity === "High Risk") {
    return "border-orange-400/35 text-orange-100";
  }
  if (severity === "Major") {
    return "border-amber-300/35 text-amber-100";
  }
  if (severity === "Moderate") {
    return "border-sky-300/35 text-sky-100";
  }
  return "border-slate-400/35 text-slate-200";
}

function OldestOpenFindingsTable({ rows }: { rows: SystemActionOldestFindingRow[] }) {
  return (
    <section className="panel flex h-full min-h-0 flex-col p-3">
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Oldest Open Findings</h3>
      <p className="mt-1 text-xs text-slate-300/80">Longest-running open findings requiring escalation or unblock.</p>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-lg border border-sky-300/15 bg-slate-950/45">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
            <tr>
              <th className="min-w-[11rem] px-3 py-2 text-left">Severity</th>
              <th className="px-3 py-2 text-right">Age (Days)</th>
              <th className="px-3 py-2 text-left">SPI</th>
              <th className="px-3 py-2 text-left">ICT System</th>
              <th className="px-3 py-2 text-left">Imacted Devices</th>
              <th className="px-3 py-2 text-left">Opened</th>
              <th className="px-3 py-2 text-left">Title</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.findingId} className="border-t border-sky-300/10">
                <td className="min-w-[11rem] px-3 py-2">
                  <span
                    className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${severityPillClass(row.severity)}`}
                  >
                    {row.severity}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-slate-100">{row.ageDays}</td>
                <td className="px-3 py-2 text-slate-200">{row.spiLabel}</td>
                <td className="px-3 py-2 text-slate-200">{row.systemName}</td>
                <td className="px-3 py-2 text-slate-200">{row.impactedDevices}</td>
                <td className="px-3 py-2 text-slate-300">{row.openedDate}</td>
                <td className="px-3 py-2 text-slate-200">{row.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionQuickWinsTable({ rows }: { rows: SystemActionQuickWinRow[] }) {
  return (
    <section className="panel flex h-full min-h-0 flex-col p-3">
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Quick Wins by Recommended Action</h3>
      <p className="mt-1 text-xs text-slate-300/80">Repeated remediation actions that can reduce severe findings fastest.</p>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-lg border border-sky-300/15 bg-slate-950/45">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
            <tr>
              <th className="px-3 py-2 text-left">Recommended Action</th>
              <th className="px-3 py-2 text-right">Critical Exposure</th>
              <th className="px-3 py-2 text-right">High Risk</th>
              <th className="px-3 py-2 text-right">Other</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">ICT Systems</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.actionText} className="border-t border-sky-300/10">
                <td className="px-3 py-2 text-slate-100">{row.actionText}</td>
                <td className="px-3 py-2 text-right text-red-100">{row.criticalExposureCount}</td>
                <td className="px-3 py-2 text-right text-orange-100">{row.highRiskCount}</td>
                <td className="px-3 py-2 text-right text-sky-100">{row.otherCount}</td>
                <td className="px-3 py-2 text-right text-slate-200">{row.total}</td>
                <td className="px-3 py-2 text-right text-slate-200">{row.systemCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

export function SystemsActionPanel({
  actionPlan,
  actionThroughput,
  actionAgeBuckets,
  actionOldestOpenFindings,
  actionQuickWins
}: {
  actionPlan: {
    immediateAction: number;
    plannedRemediation: number;
    nonCompliantOs: number;
    outOfWarranty: number;
    discoveryCoverageGaps: number;
    systemsNotModelled: number;
  };
  actionThroughput: SystemActionThroughputPoint[];
  actionAgeBuckets: SystemActionAgeBucketRow[];
  actionOldestOpenFindings: SystemActionOldestFindingRow[];
  actionQuickWins: SystemActionQuickWinRow[];
}) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_minmax(0,0.88fr)] gap-2">
      <section className="panel cyber-cop-pulse-border p-3">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-100">Action Plan Summary</h2>
        <p className="mt-1 text-xs text-slate-300/80">Focus of effort for immediate response and planned remediation.</p>
        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-6">
          <ActionTile
            title="Immediate Action"
            value={actionPlan.immediateAction}
            subtitle="Critical Exposure + High Risk findings"
            tone="critical"
          />
          <ActionTile
            title="Planned Remediation"
            value={actionPlan.plannedRemediation}
            subtitle="P3+ findings backlog"
            tone="warning"
          />
          <ActionTile
            title="Total Non-Compliant OS"
            value={actionPlan.nonCompliantOs}
            subtitle="Server/workstation OS SPI 1-2 non-compliance"
            tone="critical"
          />
          <ActionTile
            title="Assets Out of Warranty"
            value={actionPlan.outOfWarranty}
            subtitle="Physical assets beyond support coverage"
            tone="critical"
          />
          <ActionTile
            title="Discovery Coverage Gaps"
            value={actionPlan.discoveryCoverageGaps}
            subtitle="Assets not meeting discovery compliance"
            tone="watch"
          />
          <ActionTile
            title="ICT Systems Not Modelled"
            value={actionPlan.systemsNotModelled}
            subtitle="Scoped ICT systems with modelling status not enabled"
            tone="warning"
          />
        </div>
      </section>

      <div className="grid min-h-0 gap-2 lg:grid-cols-2">
        <RemediationThroughputChart rows={actionThroughput} />
        <FindingAgingBucketsChart rows={actionAgeBuckets} />
      </div>

      <div className="grid min-h-0 auto-rows-fr gap-2 lg:grid-cols-2 lg:grid-rows-1">
        <OldestOpenFindingsTable rows={actionOldestOpenFindings.slice(0, 6)} />
        <ActionQuickWinsTable rows={actionQuickWins.slice(0, 6)} />
      </div>
    </div>
  );
}
