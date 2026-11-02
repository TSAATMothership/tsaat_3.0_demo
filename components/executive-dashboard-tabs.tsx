"use client";

import { useMemo, useState } from "react";
import { MiniTrendSparkline } from "@/components/mini-trend-sparkline";
import { TrendCharts } from "@/components/trend-charts";
import { ImpactProfile } from "@/lib/impact";
import { TrendPoint } from "@/lib/types";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";

interface SparklinePoint {
  label: string;
  value: number;
}

function healthStatusFor(profile: ImpactProfile): { label: string; className: string } {
  if (profile.highPriority > 0) {
    return {
      label: "At Risk",
      className: "border-red-400/45 bg-red-500/15 text-red-100"
    };
  }
  if (profile.findings > 0) {
    return {
      label: "Watch",
      className: "border-amber-400/45 bg-amber-500/15 text-amber-100"
    };
  }
  return {
    label: "Stable",
    className: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
  };
}

function ComplianceHealthTable({
  title,
  data,
  emptyMessage
}: {
  title: string;
  data: ImpactProfile[];
  emptyMessage: string;
}) {
  return (
    <section className="panel overflow-hidden">
      <h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
        {title}
      </h2>
      <div className="max-h-[380px] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Findings</th>
              <th className="px-3 py-2">High Priority</th>
              <th className="px-3 py-2">Impacted Assets</th>
              <th className="px-3 py-2">Health</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 12).map((item) => {
              const health = healthStatusFor(item);
              return (
                <tr key={item.id} className="border-t border-sky-400/10">
                  <td className="px-3 py-2 text-slate-100">{item.name}</td>
                  <td className="px-3 py-2 text-slate-200">{item.findings}</td>
                  <td className="px-3 py-2 text-red-100">{item.highPriority}</td>
                  <td className="px-3 py-2 text-slate-200">{item.impactedAssets}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${health.className}`}>{health.label}</span>
                  </td>
                </tr>
              );
            })}
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-300/80">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MissionHighPriorityRisksChart({ data }: { data: ImpactProfile[] }) {
  if (!data.length) {
    return (
      <section className="panel p-4">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">
          High Priority Risks by Mission Capability
        </h2>
        <p className="mt-3 text-sm text-slate-300/80">No mission capability risk data in the current filter scope.</p>
      </section>
    );
  }

  const chartData = data.slice(0, 12).map((item) => ({
    ...item,
    shortName: item.name.length > 22 ? `${item.name.slice(0, 22)}...` : item.name,
    size: item.highPriority > 0 ? item.highPriority : 1
  }));

  return (
    <section className="panel p-4">
      <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">
        High Priority Risks by Mission Capability
      </h2>
      <p className="mt-2 text-xs text-slate-300/80">
        Tile size represents high-priority risk count by mission capability.
      </p>
      <div className="mt-3 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={chartData}
            dataKey="size"
            nameKey="shortName"
            stroke="rgba(15,23,42,0.85)"
            fill="#2c7fb8"
            isAnimationActive={false}
          >
            <Tooltip
              contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #94a3b8", color: "#000000" }}
              labelStyle={{ color: "#000000" }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? "Mission Capability"}
              formatter={(value, _name, payload) => [payload?.payload?.highPriority ?? value, "High Priority Risks"]}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300/80">
        {chartData.map((item) => (
          <span key={item.id} className="rounded-full border border-red-300/35 px-2 py-1">
            {item.shortName}: {item.highPriority}
          </span>
        ))}
      </div>
    </section>
  );
}

function BusinessHighPriorityRisksChart({ data }: { data: ImpactProfile[] }) {
  if (!data.length) {
    return (
      <section className="panel p-4">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">
          High Priority Risks by Business Service
        </h2>
        <p className="mt-3 text-sm text-slate-300/80">No business service risk data in the current filter scope.</p>
      </section>
    );
  }

  const chartData = data.slice(0, 12).map((item) => ({
    ...item,
    shortName: item.name.length > 22 ? `${item.name.slice(0, 22)}...` : item.name,
    size: item.highPriority > 0 ? item.highPriority : 1
  }));

  return (
    <section className="panel p-4">
      <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">High Priority Risks by Business Service</h2>
      <p className="mt-2 text-xs text-slate-300/80">
        Tile size represents high-priority risk count by business service.
      </p>
      <div className="mt-3 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={chartData}
            dataKey="size"
            nameKey="shortName"
            stroke="rgba(15,23,42,0.85)"
            fill="#2c7fb8"
            isAnimationActive={false}
          >
            <Tooltip
              contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #94a3b8", color: "#000000" }}
              labelStyle={{ color: "#000000" }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? "Business Service"}
              formatter={(value, _name, payload) => [payload?.payload?.highPriority ?? value, "High Priority Risks"]}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300/80">
        {chartData.map((item) => (
          <span key={item.id} className="rounded-full border border-red-300/35 px-2 py-1">
            {item.shortName}: {item.highPriority}
          </span>
        ))}
      </div>
    </section>
  );
}

export function ExecutiveDashboardTabs({
  trendPoints,
  overallCompliance,
  dpeCompliance,
  dseCompliance,
  overallIctSystemCompliance,
  criticalIctSystemCompliance,
  overallNetworkCompliance,
  immediateCount,
  plannedRemediationCount,
  highRiskCount,
  nonCompliantDiscoveryCoverageCount,
  nonCompliantOsCount,
  overallComplianceTrend,
  dpeComplianceTrend,
  dseComplianceTrend,
  overallIctSystemComplianceTrend,
  criticalIctSystemComplianceTrend,
  overallNetworkComplianceTrend,
  immediateActionTrend,
  plannedRemediationTrend,
  highRiskFindingsTrend,
  nonCompliantDiscoveryCoverageTrend,
  nonCompliantOsTrend,
  missionCapabilities,
  businessServices
}: {
  trendPoints: TrendPoint[];
  overallCompliance: number;
  dpeCompliance: number;
  dseCompliance: number;
  overallIctSystemCompliance: number;
  criticalIctSystemCompliance: number;
  overallNetworkCompliance: number;
  immediateCount: number;
  plannedRemediationCount: number;
  highRiskCount: number;
  nonCompliantDiscoveryCoverageCount: number;
  nonCompliantOsCount: number;
  overallComplianceTrend: SparklinePoint[];
  dpeComplianceTrend: SparklinePoint[];
  dseComplianceTrend: SparklinePoint[];
  overallIctSystemComplianceTrend: SparklinePoint[];
  criticalIctSystemComplianceTrend: SparklinePoint[];
  overallNetworkComplianceTrend: SparklinePoint[];
  immediateActionTrend: SparklinePoint[];
  plannedRemediationTrend: SparklinePoint[];
  highRiskFindingsTrend: SparklinePoint[];
  nonCompliantDiscoveryCoverageTrend: SparklinePoint[];
  nonCompliantOsTrend: SparklinePoint[];
  missionCapabilities: ImpactProfile[];
  businessServices: ImpactProfile[];
}) {
  const tabs = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      { id: "mission", label: "Mission Capabilties Compliance Health" },
      { id: "business", label: "Business Services Comliance Health" }
    ],
    []
  );
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("overview");

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-sky-400/15 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.13em] transition ${
                activeTab === tab.id
                  ? "border-sky-200/60 bg-sky-500/20 text-sky-100"
                  : "border-sky-400/20 bg-slate-900/40 text-slate-200 hover:border-sky-300/45 hover:bg-slate-800/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {activeTab === "mission" ? (
          <>
            <MissionHighPriorityRisksChart data={missionCapabilities} />
            <ComplianceHealthTable
              title="Mission Capabilties Compliance Health"
              data={missionCapabilities}
              emptyMessage="No mission capability impact in the current filter scope."
            />
          </>
        ) : null}

        {activeTab === "business" ? (
          <>
            <BusinessHighPriorityRisksChart data={businessServices} />
            <ComplianceHealthTable
              title="Business Services Comliance Health"
              data={businessServices}
              emptyMessage="No business service impact in the current filter scope."
            />
          </>
        ) : null}

        {activeTab === "overview" ? (
          <>
            <TrendCharts points={trendPoints} />

            <section className="panel p-4">
              <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">KPI Snapshot</h2>
              <p className="mt-2 text-xs text-slate-300/75">
                KPI trends over the last 12 weeks in the current filtered scope.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="panel-alt border-emerald-400/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Overall Compliance</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-100">{overallCompliance}%</p>
                  <MiniTrendSparkline points={overallComplianceTrend} stroke="#22c55e" heightClassName="h-[116px]" />
                </div>
                <div className="panel-alt border-sky-400/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">DPE Compliance</p>
                  <p className="mt-1 text-2xl font-semibold text-sky-100">{dpeCompliance}%</p>
                  <MiniTrendSparkline points={dpeComplianceTrend} stroke="#38bdf8" heightClassName="h-[116px]" />
                </div>
                <div className="panel-alt border-cyan-400/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">DSE Compliance</p>
                  <p className="mt-1 text-2xl font-semibold text-cyan-100">{dseCompliance}%</p>
                  <MiniTrendSparkline points={dseComplianceTrend} stroke="#06b6d4" heightClassName="h-[116px]" />
                </div>
                <div className="panel-alt border-emerald-400/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Overall ICT System Compliance</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-100">{overallIctSystemCompliance}%</p>
                  <MiniTrendSparkline
                    points={overallIctSystemComplianceTrend}
                    stroke="#10b981"
                    heightClassName="h-[116px]"
                  />
                </div>
                <div className="panel-alt border-amber-400/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Critical ICT System Compliance</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-100">{criticalIctSystemCompliance}%</p>
                  <MiniTrendSparkline
                    points={criticalIctSystemComplianceTrend}
                    stroke="#f59e0b"
                    heightClassName="h-[116px]"
                  />
                </div>
                <div className="panel-alt border-sky-400/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Overall Network Compliance</p>
                  <p className="mt-1 text-2xl font-semibold text-sky-100">{overallNetworkCompliance}%</p>
                  <MiniTrendSparkline points={overallNetworkComplianceTrend} stroke="#0ea5e9" heightClassName="h-[116px]" />
                </div>
              </div>
            </section>

            <section className="panel p-4">
              <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Observations</h2>
              <p className="mt-2 text-xs text-slate-300/75">
                Observation trends over the last 12 weeks in the current filtered scope.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="panel-alt border-red-400/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Immediate Action</p>
                  <p className="mt-1 text-2xl font-semibold text-red-100">{immediateCount}</p>
                  <p className="text-[11px] text-slate-300/75">Total P1-P2 findings</p>
                  <MiniTrendSparkline points={immediateActionTrend} stroke="#ef4444" heightClassName="h-[116px]" />
                </div>
                <div className="panel-alt border-amber-400/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Planned Remediation</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-100">{plannedRemediationCount}</p>
                  <p className="text-[11px] text-slate-300/75">Total P3+ findings</p>
                  <MiniTrendSparkline points={plannedRemediationTrend} stroke="#f59e0b" heightClassName="h-[116px]" />
                </div>
                <div className="panel-alt border-red-400/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Total High Risk Findings</p>
                  <p className="mt-1 text-2xl font-semibold text-red-100">{highRiskCount}</p>
                  <MiniTrendSparkline points={highRiskFindingsTrend} stroke="#f97316" heightClassName="h-[116px]" />
                </div>
                <div className="panel-alt border-red-400/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                    Total Assets with non-compliant discovery coverage
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-red-100">{nonCompliantDiscoveryCoverageCount}</p>
                  <MiniTrendSparkline
                    points={nonCompliantDiscoveryCoverageTrend}
                    stroke="#dc2626"
                    heightClassName="h-[116px]"
                  />
                </div>
                <div className="panel-alt border-amber-400/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Total non-compliant OS</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-100">{nonCompliantOsCount}</p>
                  <MiniTrendSparkline points={nonCompliantOsTrend} stroke="#f59e0b" heightClassName="h-[116px]" />
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}
