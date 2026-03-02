"use client";

import { useId, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Criticality, FindingSeverity } from "@/lib/types";

export interface CyberCopImpactItem {
  id: string;
  name: string;
  criticality: Criticality;
  findings: number;
  highPriority: number;
  criticalExposureCount: number;
  highRiskCount: number;
  impactedAssets: number;
}

export interface CyberCopSeveritySummary {
  severity: FindingSeverity;
  count: number;
}

export interface CyberCopWeeklyRiskPoint {
  weekLabel: string;
  highRiskCount: number;
  criticalExposureCount: number;
}

export interface CyberCopDailyTrendPoint {
  date: string;
  label: string;
  count: number;
}

export interface CyberCopDashboardProps {
  snapshotDate: string;
  complianceScores: {
    overall: number;
    dse: number;
    dpe: number;
    ictSystems: number;
    networks: number;
  };
  riskProfile: {
    openFindings: number;
    p1p2Count: number;
    highRiskOpenCount: number;
    criticalExposureOpenCount: number;
    severitySummary: CyberCopSeveritySummary[];
    weeklyTrend: CyberCopWeeklyRiskPoint[];
  };
  impact: {
    business: CyberCopImpactItem[];
    mission: CyberCopImpactItem[];
    systems: CyberCopImpactItem[];
  };
  modellingSummary: {
    diisDefinedCount: number;
    modelledCount: number;
    modelledDiscoveryNonCompliantCount: number;
  };
  actionPlan: {
    immediateAction: number;
    plannedRemediation: number;
    nonCompliantOs: number;
    outOfWarranty: number;
    discoveryCoverageGaps: number;
    networkNotDiscovered: number;
    unmodelledIctSystems: number;
  };
  dailyHighRisk: CyberCopDailyTrendPoint[];
  dailyCriticalExposure: CyberCopDailyTrendPoint[];
}

const severityColors: Record<FindingSeverity, string> = {
  "Critical Exposure": "#ef4444",
  "High Risk": "#f97316",
  Major: "#f59e0b",
  Moderate: "#38bdf8",
  "Data Gap": "#94a3b8"
};

function formatDateKey(
  dateKey: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
): string {
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return dateKey;
  }
  return parsed.toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

function complianceTone(value: number): { borderClass: string; textClass: string; meterClass: string } {
  if (value >= 90) {
    return {
      borderClass: "border-emerald-300/35",
      textClass: "text-emerald-100",
      meterClass: "bg-emerald-400"
    };
  }
  if (value >= 75) {
    return {
      borderClass: "border-cyan-300/35",
      textClass: "text-cyan-100",
      meterClass: "bg-cyan-400"
    };
  }
  return {
    borderClass: "border-amber-300/35",
    textClass: "text-amber-100",
    meterClass: "bg-amber-400"
  };
}

function criticalityClass(criticality: Criticality): string {
  if (criticality === "Critical") {
    return "border-red-400/40 text-red-100";
  }
  return "border-sky-300/35 text-sky-100";
}

function ComplianceTile({ title, score }: { title: string; score: number }) {
  const tone = complianceTone(score);
  return (
    <article className={`panel-alt ${tone.borderClass} p-4`}>
      <p className="text-[11px] uppercase tracking-[0.15em] text-slate-300/80">{title}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone.textClass}`}>{score}%</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
        <div className={`h-full rounded-full ${tone.meterClass}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </article>
  );
}

function ImpactLeaderboard({
  title,
  subtitle,
  items
}: {
  title: string;
  subtitle: string;
  items: CyberCopImpactItem[];
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const riskScopedItems = useMemo(
    () => items.filter((item) => item.criticalExposureCount > 0 || item.highRiskCount > 0),
    [items]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return riskScopedItems;
    }

    const exactMatch = riskScopedItems.find((item) => item.name.toLowerCase() === normalizedQuery);
    if (exactMatch) {
      return [exactMatch];
    }

    return riskScopedItems.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
  }, [riskScopedItems, normalizedQuery]);

  return (
    <section className="panel p-4">
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">{title}</h3>
      <p className="mt-1 text-xs text-slate-300/80">{subtitle}</p>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="search"
          list={listId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${title.toLowerCase()}`}
          className="w-full rounded-md border border-sky-300/25 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
        />
        <button
          type="button"
          onClick={() => setQuery("")}
          className="rounded-md border border-sky-300/25 bg-slate-900/80 px-3 py-2 text-xs uppercase tracking-[0.12em] text-slate-200 hover:bg-slate-800/90"
        >
          Clear
        </button>
        <datalist id={listId}>
          {riskScopedItems.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>
      </div>
      {riskScopedItems.length ? (
        <div className="mt-3 max-h-[256px] overflow-y-auto overflow-x-auto rounded-lg border border-sky-300/15 bg-slate-950/45">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Criticality</th>
                <th className="px-3 py-2 text-right">Critical Exposure</th>
                <th className="px-3 py-2 text-right">High Risk</th>
                <th className="px-3 py-2 text-right">Findings</th>
                <th className="px-3 py-2 text-right">Impacted Assets</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-t border-sky-300/10">
                  <td className="px-3 py-2 text-slate-100">{item.name}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${criticalityClass(item.criticality)}`}>
                      {item.criticality}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-red-100">{item.criticalExposureCount}</td>
                  <td className="px-3 py-2 text-right text-orange-100">{item.highRiskCount}</td>
                  <td className="px-3 py-2 text-right text-slate-200">{item.findings}</td>
                  <td className="px-3 py-2 text-right text-slate-200">{item.impactedAssets}</td>
                </tr>
              ))}
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-sm text-slate-300/80">
                    No matching rows.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-sky-300/15 bg-slate-950/45 p-3 text-sm text-slate-300/80">
          No critical exposure or high risk impact in current scope.
        </p>
      )}
    </section>
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
    <article className={`panel-alt ${toneClass} p-4`}>
      <p className="text-[11px] uppercase tracking-[0.15em] text-slate-300/75">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
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
  data: CyberCopDailyTrendPoint[];
}) {
  if (!data.length) {
    return (
      <section className="panel p-4">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">{title}</h3>
        <p className="mt-1 text-xs text-slate-300/80">{subtitle}</p>
        <p className="mt-3 text-sm text-slate-300/80">No daily trend data available.</p>
      </section>
    );
  }

  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">{title}</h3>
          <p className="mt-1 text-xs text-slate-300/80">{subtitle}</p>
        </div>
        <p className="rounded-full border border-sky-300/30 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-200">
          Latest: {data[data.length - 1]?.count} on{" "}
          {formatDateKey(data[data.length - 1]?.date ?? "", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 14, left: 6, bottom: 8 }}>
            <CartesianGrid stroke="rgba(120,180,210,0.14)" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDateKey(String(value))}
              minTickGap={42}
              tick={{ fill: "#a8c6d8", fontSize: 11 }}
            />
            <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
              formatter={(value) => [value, "Open Findings"]}
              labelFormatter={(label) =>
                formatDateKey(String(label), {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })
              }
            />
            <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2.2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function CyberCopDashboard({
  snapshotDate,
  complianceScores,
  riskProfile,
  impact,
  modellingSummary,
  actionPlan,
  dailyHighRisk,
  dailyCriticalExposure
}: CyberCopDashboardProps) {
  return (
    <div className="space-y-4">
      <section className="panel cop-reveal relative overflow-hidden p-5">
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
              Senior Cyber Operations Briefing
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <ComplianceTile title="Overall Compliance" score={complianceScores.overall} />
            <ComplianceTile title="DSE Compliance" score={complianceScores.dse} />
            <ComplianceTile title="DPE Compliance" score={complianceScores.dpe} />
            <ComplianceTile title="Critical ICT Systems Compliance" score={complianceScores.ictSystems} />
            <ComplianceTile title="Networks Compliance" score={complianceScores.networks} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
        <section className="panel cop-reveal cop-reveal-delay-1 p-4">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-100">Risk Profile</h2>
          <p className="mt-1 text-xs text-slate-300/80">Open finding pressure by severity across the Defence Cyber Terrain.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="panel-alt border-sky-300/25 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Open Findings</p>
              <p className="mt-1 text-3xl font-semibold text-slate-100">{riskProfile.openFindings}</p>
            </div>
            <div className="panel-alt border-sky-300/25 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">P1-P2 Findings</p>
              <p className="mt-1 text-3xl font-semibold text-slate-100">{riskProfile.p1p2Count}</p>
            </div>
            <div className="panel-alt border-red-400/25 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Critical Exposure (Open)</p>
              <p className="mt-1 text-3xl font-semibold text-red-100">{riskProfile.criticalExposureOpenCount}</p>
            </div>
            <div className="panel-alt border-orange-400/25 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">High Risk (Open)</p>
              <p className="mt-1 text-3xl font-semibold text-orange-100">{riskProfile.highRiskOpenCount}</p>
            </div>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskProfile.severitySummary} layout="vertical" margin={{ left: 0, right: 16, top: 10, bottom: 0 }}>
                <CartesianGrid stroke="rgba(120,180,210,0.14)" />
                <XAxis type="number" allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
                <YAxis dataKey="severity" type="category" width={124} tick={{ fill: "#d2e6f4", fontSize: 11 }} />
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

        <section className="panel cop-reveal cop-reveal-delay-1 p-4">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-100">Risk Trend (3 Months)</h2>
          <p className="mt-1 text-xs text-slate-300/80">Weekly open finding counts for Critical Exposure and High Risk.</p>
          <div className="mt-4 h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={riskProfile.weeklyTrend} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="rgba(120,180,210,0.14)" />
                <XAxis dataKey="weekLabel" tick={{ fill: "#a8c6d8", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
                  formatter={(value, name) => [value, name === "highRiskCount" ? "High Risk" : "Critical Exposure"]}
                />
                <Legend
                  formatter={(value) => (value === "highRiskCount" ? "High Risk" : "Critical Exposure")}
                  wrapperStyle={{ fontSize: "12px", color: "#d1e3ef" }}
                />
                <Line
                  type="monotone"
                  dataKey="highRiskCount"
                  stroke="#f97316"
                  strokeWidth={2.2}
                  dot={false}
                  isAnimationActive={false}
                />
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

      <div className="cop-reveal cop-reveal-delay-2 grid gap-4 xl:grid-cols-3">
        <ImpactLeaderboard
          title="Business Services Impact"
          subtitle="Services carrying concentrated findings."
          items={impact.business}
        />
        <ImpactLeaderboard
          title="Mission Capabilities Impact"
          subtitle="Capabilities affected by current findings."
          items={impact.mission}
        />
        <ImpactLeaderboard
          title="ICT Systems Impact"
          subtitle="Systems with highest open finding pressure."
          items={impact.systems}
        />
      </div>

      <section className="panel cop-reveal cop-reveal-delay-3 p-5">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-100">ICT System Modelling Summary</h2>
        <p className="mt-1 text-xs text-slate-300/80">
          DIIS ICT system inventory coverage versus modelling completeness and discovery readiness.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ActionTile
            title="DIIS ICT Systems Defined"
            value={modellingSummary.diisDefinedCount}
            subtitle="Total ICT systems defined in DIIS scope"
            tone="watch"
          />
          <ActionTile
            title="ICT Systems Modelled"
            value={modellingSummary.modelledCount}
            subtitle={`${modellingSummary.modelledCount}/${modellingSummary.diisDefinedCount} DIIS systems modelled`}
            tone="warning"
          />
          <ActionTile
            title="ICT Systems Modelled with Discovery Non-Compliant"
            value={modellingSummary.modelledDiscoveryNonCompliantCount}
            subtitle="Modelled systems with discovery coverage gaps"
            tone="critical"
          />
        </div>
      </section>

      <section className="panel cyber-cop-pulse-border p-5">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-100">Action Plan Summary</h2>
        <p className="mt-1 text-xs text-slate-300/80">Focus of effort for immediate response and planned remediation.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
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
            subtitle="Assets failing OS SPI controls"
            tone="warning"
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
            title="Network Not Discovered"
            value={actionPlan.networkNotDiscovered}
            subtitle="Managed networks with Discovery Non Enabled status"
            tone="warning"
          />
          <ActionTile
            title="ICT Systems Not Modelled"
            value={actionPlan.unmodelledIctSystems}
            subtitle="DIIS-defined systems without TSAAT models"
            tone="warning"
          />
        </div>
      </section>

      <div className="cop-reveal cop-reveal-delay-3 grid gap-4 xl:grid-cols-2">
        <DailyTrendPanel
          title="Open High Risk Findings"
          subtitle="Daily open high-risk trajectory for the last 12 months. Right edge is current date."
          color="#f97316"
          data={dailyHighRisk}
        />
        <DailyTrendPanel
          title="Open Critical Exposure Findings"
          subtitle="Daily open critical-exposure trajectory for the last 12 months. Right edge is current date."
          color="#ef4444"
          data={dailyCriticalExposure}
        />
      </div>
    </div>
  );
}
