"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { NetworkDetailRiskCharts, NetworkDetailRiskFindingRow } from "@/components/network-detail-risk-charts";
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

function ComplianceTile({ title, score }: { title: string; score: number }) {
  const toneClass =
    score >= 90
      ? "border-emerald-300/35 text-emerald-100 bg-emerald-500/8"
      : score >= 75
        ? "border-cyan-300/35 text-cyan-100 bg-cyan-500/8"
        : "border-amber-300/35 text-amber-100 bg-amber-500/8";
  return (
    <article className={`panel-alt p-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.15em] text-slate-300/80">{title}</p>
      <p className="mt-1.5 text-2xl font-semibold">{score}%</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
        <div className="h-full rounded-full bg-current" style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </article>
  );
}

function ModellingBulletTile({
  modelledPercent,
  notModelledPercent,
  modelledCount,
  notModelledCount,
  totalCount
}: {
  modelledPercent: number;
  notModelledPercent: number;
  modelledCount: number;
  notModelledCount: number;
  totalCount: number;
}) {
  return (
    <article className="panel-alt border-amber-300/35 bg-amber-500/10 p-3 text-amber-100">
      <p className="text-[11px] uppercase tracking-[0.15em] text-slate-200/90">ICT Systems not modelled</p>
      <p className="mt-1.5 text-2xl font-semibold">{notModelledPercent}%</p>
      <p className="mt-0.5 text-xs text-slate-300/90">
        {notModelledCount} of {totalCount} ICT systems
      </p>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full border border-sky-300/25 bg-slate-900/80">
        <div className="flex h-full w-full">
          <div className="h-full bg-emerald-400/90" style={{ width: `${modelledPercent}%` }} />
          <div className="h-full bg-amber-300/95" style={{ width: `${notModelledPercent}%` }} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-200/90">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Modelled: {modelledPercent}% ({modelledCount})
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-300" />
          Not Modelled: {notModelledPercent}% ({notModelledCount})
        </span>
      </div>
    </article>
  );
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
  complianceScores,
  modellingCoverage,
  riskProfile,
  riskFindings,
  assetHighRiskCvesByAssetId = {},
  asOfDate,
  dailyHighRisk,
  dailyCriticalExposure
}: {
  snapshotDate: string;
  complianceScores: {
    overall: number;
    dse: number;
    dpe: number;
    systems: number;
  };
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
      <section className="panel relative overflow-hidden p-3">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.22),transparent_44%),radial-gradient(circle_at_88%_16%,rgba(239,68,68,0.16),transparent_38%)]" />
        <div className="relative">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm uppercase tracking-[0.16em] text-slate-100">Compliance Scores</h2>
              <p className="mt-1 text-xs text-slate-300/80">
                Snapshot baseline for Defence Cyber Terrain posture at {snapshotDate}.
              </p>
            </div>
            <span className="rounded-full border border-sky-300/30 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-200">
              ICT System-Scoped Operational Briefing
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <ComplianceTile title="Overall Compliance" score={complianceScores.overall} />
            <ComplianceTile title="DSE Compliance" score={complianceScores.dse} />
            <ComplianceTile title="DPE Compliance" score={complianceScores.dpe} />
            <ModellingBulletTile
              modelledPercent={modellingCoverage.modelledPercent}
              notModelledPercent={modellingCoverage.notModelledPercent}
              modelledCount={modellingCoverage.modelledCount}
              notModelledCount={modellingCoverage.notModelledCount}
              totalCount={modellingCoverage.totalCount}
            />
          </div>
        </div>
      </section>

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

