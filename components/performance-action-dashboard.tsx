"use client";

import { useState } from "react";
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
import {
  PerformanceFindingDetail,
  PerformanceFindingSpiRow,
  PerformanceReportModel,
  PerformanceThroughputPoint
} from "@/lib/performance-report-model";

type DashboardTab = "performance" | "findings" | "coverage" | "throughput";

interface DrillPanelState {
  title: string;
  subtitle: string;
  headers: string[];
  rows: string[][];
}

const tabs: Array<{ id: DashboardTab; label: string }> = [
  { id: "performance", label: "Performance" },
  { id: "findings", label: "Findings" },
  { id: "coverage", label: "Coverage & Modelling" },
  { id: "throughput", label: "Throughput" }
];

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function scoreToneClass(score: number): string {
  if (score >= 95) {
    return "text-emerald-100";
  }
  if (score >= 80) {
    return "text-amber-100";
  }
  return "text-red-100";
}

function scoreCellClass(score: number): string {
  if (score >= 95) {
    return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
  }
  if (score >= 80) {
    return "border-amber-300/20 bg-amber-500/10 text-amber-100";
  }
  return "border-red-300/20 bg-red-500/10 text-red-100";
}

function MetricCard({
  label,
  value,
  context
}: {
  label: string;
  value: string | number;
  context: string;
}) {
  return (
    <article
      className="flex min-h-9 min-w-0 items-center justify-between gap-2 rounded-md border border-sky-300/20 bg-slate-950/55 px-2 py-1.5 text-slate-100"
      title={context}
    >
      <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300/80">{label}</p>
      <p className="shrink-0 text-base font-semibold leading-none">{value}</p>
    </article>
  );
}

function findingsRows(findings: PerformanceFindingDetail[]): string[][] {
  return findings.map((finding) => [
    finding.id,
    finding.spiLabel,
    finding.severity,
    `P${finding.priorityRank}`,
    finding.entityName,
    finding.securityDomain,
    finding.assetName,
    `${finding.ageDays}`,
    finding.openedDate,
    finding.title
  ]);
}

function DrillPanel({
  panel,
  onClose
}: {
  panel: DrillPanelState | null;
  onClose: () => void;
}) {
  if (!panel) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[150]">
      <div className="absolute inset-0 bg-slate-950/88 backdrop-blur-[1px]" onClick={onClose} />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-[62rem] flex-col border-l border-sky-300/30 bg-slate-950 p-4 shadow-[-22px_0_42px_rgba(0,0,0,0.55)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="performance-drill-panel-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
        >
          Close
        </button>
        <div className="panel shrink-0 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Performance Drill-Through</p>
          <h3 id="performance-drill-panel-title" className="mt-1 pr-16 text-2xl font-semibold text-slate-100">
            {panel.title}
          </h3>
          <p className="mt-1 text-sm text-slate-300/80">{panel.subtitle}</p>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-sky-300/15 bg-slate-950/55">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                {panel.headers.map((header) => (
                  <th key={header} className="px-3 py-2 text-left">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {panel.rows.length ? (
                panel.rows.map((row, rowIndex) => (
                  <tr key={`${row.join("|")}-${rowIndex}`} className="border-t border-sky-300/10">
                    {row.map((cell, cellIndex) => (
                      <td key={`${cell}-${cellIndex}`} className="px-3 py-2 text-slate-200">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr className="border-t border-sky-300/10">
                  <td className="px-3 py-4 text-slate-300/80" colSpan={panel.headers.length}>
                    No rows in the current scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}

function PerformanceTab({
  model,
  openPanel
}: {
  model: PerformanceReportModel;
  openPanel: (panel: DrillPanelState) => void;
}) {
  const topKpiRows = model.kpiMatrixRows.slice(0, 18);

  return (
    <div className="grid h-full min-h-[42rem] gap-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)]">
      <section className="panel flex min-h-0 flex-col p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Domain x {model.entityLabelSingular}</h3>
            <p className="mt-1 text-xs text-slate-300/80">Compliance and discovery score by current scope.</p>
          </div>
          <p className="text-xs text-slate-300/80">{model.domainEntityRows.length} rows</p>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-lg border border-sky-300/15 bg-slate-950/45">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2 text-left">Security Domain</th>
                <th className="px-3 py-2 text-left">{model.entityLabelSingular}</th>
                <th className="px-3 py-2 text-right">Compliance</th>
                <th className="px-3 py-2 text-right">Discovery</th>
              </tr>
            </thead>
            <tbody>
              {model.domainEntityRows.map((row) => {
                const discovery = model.discoveryGapRows.find((item) => item.id === row.id);
                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-sky-300/10 transition hover:bg-sky-300/5"
                    onClick={() =>
                      openPanel({
                        title: `${row.securityDomain} / ${row.entityName}`,
                        subtitle: "Compliance and discovery score counts for this security-domain and entity pair.",
                        headers: ["Metric", "Score", "Compliant", "Non-compliant", "Unknown/Other", "Total"],
                        rows: [
                          [
                            "Compliance",
                            formatPercent(row.scorePercent),
                            `${row.compliant}`,
                            `${row.nonCompliant}`,
                            `${row.unknown}`,
                            `${row.total}`
                          ],
                          [
                            "Discovery",
                            formatPercent(discovery?.scorePercent ?? 0),
                            `${discovery?.compliant ?? 0}`,
                            `${discovery?.nonCompliant ?? 0}`,
                            `${discovery?.other ?? 0}`,
                            `${discovery?.total ?? 0}`
                          ]
                        ]
                      })
                    }
                  >
                    <td className="px-3 py-2 text-slate-200">{row.securityDomain}</td>
                    <td className="px-3 py-2 text-slate-100">{row.entityName}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${scoreToneClass(row.scorePercent)}`}>
                      {formatPercent(row.scorePercent)}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${scoreToneClass(discovery?.scorePercent ?? 0)}`}>
                      {formatPercent(discovery?.scorePercent ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel flex min-h-0 flex-col p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">KPI Heatmap</h3>
            <p className="mt-1 text-xs text-slate-300/80">KPI 1-10 by Security Domain x {model.entityLabelSingular}.</p>
          </div>
          <p className="text-xs text-slate-300/80">Click a score for counts</p>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-sky-300/15 bg-slate-950/45">
          <div className="sticky top-0 z-[1] hidden grid-cols-[minmax(4.75rem,0.6fr)_minmax(9rem,1.65fr)_repeat(10,minmax(0,0.3fr))] items-center gap-1 bg-slate-900/95 px-2 py-2 text-xs uppercase tracking-[0.12em] text-slate-300/80 lg:grid">
            <div className="min-w-0 px-1">Domain</div>
            <div className="min-w-0 px-1">{model.entityLabelSingular}</div>
            {Array.from({ length: 10 }, (_, index) => (
              <div key={`kpi-${index + 1}`} className="min-w-0 px-1 text-center">
                K{index + 1}
              </div>
            ))}
          </div>
          <div className="divide-y divide-sky-300/10">
            {topKpiRows.map((row) => (
              <div
                key={row.id}
                className="grid min-w-0 gap-1.5 px-2 py-2 lg:grid-cols-[minmax(4.75rem,0.6fr)_minmax(9rem,1.65fr)_repeat(10,minmax(0,0.3fr))] lg:items-center lg:gap-1"
              >
                <div className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.1em] text-slate-300 lg:px-1 lg:py-1 lg:text-[11px]">
                  {row.securityDomain}
                </div>
                <div className="min-w-0 truncate text-sm font-semibold text-slate-100 lg:px-1 lg:py-1 lg:text-xs">
                  {row.entityName}
                </div>
                <div className="col-span-full grid min-w-0 grid-cols-5 gap-1.5 sm:grid-cols-10 lg:contents">
                  {row.kpis.map((kpi) => (
                    <button
                      key={`${row.id}-${kpi.id}`}
                      type="button"
                      title={`${kpi.id}: ${kpi.name}`}
                      className={`min-w-0 rounded border px-1 py-1 text-center text-[11px] font-semibold leading-tight transition hover:border-sky-200/55 lg:text-xs ${scoreCellClass(kpi.scorePercent)}`}
                      onClick={() =>
                        openPanel({
                          title: `${kpi.id}: ${kpi.name}`,
                          subtitle: `${row.securityDomain} / ${row.entityName}`,
                          headers: ["Score", "Compliant", "Non-compliant", "Unknown", "Applicable", "High Priority"],
                          rows: [
                            [
                              formatPercent(kpi.scorePercent),
                              `${kpi.compliantCount}`,
                              `${kpi.nonCompliantCount}`,
                              `${kpi.unknownCount}`,
                              `${kpi.applicableCount}`,
                              `${kpi.highPriorityCount}`
                            ]
                          ]
                        })
                      }
                    >
                      <span className="block text-[9px] font-semibold uppercase tracking-normal text-slate-300/75 lg:hidden">
                        K{kpi.id.replace("KPI-", "")}
                      </span>
                      <span>{Math.round(kpi.scorePercent)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function FindingsTab({
  model,
  openPanel
}: {
  model: PerformanceReportModel;
  openPanel: (panel: DrillPanelState) => void;
}) {
  const ageChartRows = model.findingAgeThresholdRows.map((row) => ({
    label: row.label,
    Critical: row.criticalExposureCount,
    High: row.highRiskCount,
    Major: row.majorCount,
    Moderate: row.moderateCount,
    DataGap: row.dataGapCount
  }));

  return (
    <div className="grid h-full min-h-[38rem] gap-2 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <section className="panel flex min-h-0 flex-col p-3">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Open Findings by Age and Severity</h3>
        <p className="mt-1 text-xs text-slate-300/80">Cumulative thresholds: findings older than 90 days also count in earlier thresholds.</p>
        <div className="mt-2 min-h-[17rem] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ageChartRows} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
              <CartesianGrid stroke="rgba(120,180,210,0.14)" />
              <XAxis dataKey="label" tick={{ fill: "#a8c6d8", fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#d1e3ef" }} />
              <Bar dataKey="Critical" stackId="age" fill="#ef4444" isAnimationActive={false} />
              <Bar dataKey="High" stackId="age" fill="#f97316" isAnimationActive={false} />
              <Bar dataKey="Major" stackId="age" fill="#f59e0b" isAnimationActive={false} />
              <Bar dataKey="Moderate" stackId="age" fill="#38bdf8" isAnimationActive={false} />
              <Bar dataKey="DataGap" stackId="age" fill="#94a3b8" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
          {model.findingAgeThresholdRows.map((row) => (
            <button
              key={row.id}
              type="button"
              className="rounded-lg border border-sky-300/15 bg-slate-950/55 p-3 text-left transition hover:border-sky-200/40"
              onClick={() =>
                openPanel({
                  title: `Open Findings ${row.label}`,
                  subtitle: "Cumulative age-threshold finding detail.",
                  headers: ["ID", "SPI", "Severity", "Priority", model.entityLabelSingular, "Domain", "Asset", "Age", "Opened", "Title"],
                  rows: findingsRows(row.findings)
                })
              }
            >
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">{row.label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">{row.total}</p>
              <p className="mt-1 text-xs text-slate-300/80">CE {row.criticalExposureCount} | HR {row.highRiskCount}</p>
            </button>
          ))}
        </div>
      </section>

      <FindingSpiTable model={model} rows={model.findingSpiRows} openPanel={openPanel} />
    </div>
  );
}

function FindingSpiTable({
  model,
  rows,
  openPanel
}: {
  model: PerformanceReportModel;
  rows: PerformanceFindingSpiRow[];
  openPanel: (panel: DrillPanelState) => void;
}) {
  return (
    <section className="panel flex min-h-0 flex-col p-3">
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Open Findings by SPI</h3>
      <p className="mt-1 text-xs text-slate-300/80">Severity mix by Security Posture Indicator.</p>
      <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-lg border border-sky-300/15 bg-slate-950/45">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
            <tr>
              <th className="px-3 py-2 text-left">SPI</th>
              <th className="px-3 py-2 text-right">Critical</th>
              <th className="px-3 py-2 text-right">High</th>
              <th className="px-3 py-2 text-right">Major</th>
              <th className="px-3 py-2 text-right">Moderate</th>
              <th className="px-3 py-2 text-right">Data Gap</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-t border-sky-300/10 transition hover:bg-sky-300/5"
                onClick={() =>
                  openPanel({
                    title: `${row.spiLabel} Open Findings`,
                    subtitle: "Open finding detail for the selected SPI.",
                    headers: ["ID", "SPI", "Severity", "Priority", model.entityLabelSingular, "Domain", "Asset", "Age", "Opened", "Title"],
                    rows: findingsRows(row.findings)
                  })
                }
              >
                <td className="px-3 py-2 text-slate-100">{row.spiLabel}</td>
                <td className="px-3 py-2 text-right text-red-100">{row.criticalExposureCount}</td>
                <td className="px-3 py-2 text-right text-orange-100">{row.highRiskCount}</td>
                <td className="px-3 py-2 text-right text-amber-100">{row.majorCount}</td>
                <td className="px-3 py-2 text-right text-sky-100">{row.moderateCount}</td>
                <td className="px-3 py-2 text-right text-slate-300">{row.dataGapCount}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-100">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CoverageTab({
  model,
  openPanel
}: {
  model: PerformanceReportModel;
  openPanel: (panel: DrillPanelState) => void;
}) {
  return (
    <div className="grid h-full min-h-[38rem] gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.52fr)]">
      <section className="panel flex min-h-0 flex-col p-3">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Discovery Coverage Gaps</h3>
        <p className="mt-1 text-xs text-slate-300/80">Coverage score by Security Domain x {model.entityLabelSingular}.</p>
        <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-lg border border-sky-300/15 bg-slate-950/45">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2 text-left">Domain</th>
                <th className="px-3 py-2 text-left">{model.entityLabelSingular}</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-right">Compliant</th>
                <th className="px-3 py-2 text-right">Non-compliant</th>
                <th className="px-3 py-2 text-right">Other</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {model.discoveryGapRows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t border-sky-300/10 transition hover:bg-sky-300/5"
                  onClick={() =>
                    openPanel({
                      title: `${row.securityDomain} / ${row.entityName} Discovery Gaps`,
                      subtitle: "Assets counted as discovery non-compliant or other.",
                      headers: ["Asset ID", "Asset", "Type", model.entityLabelSingular, "Domain", "Gap Type"],
                      rows: row.gapAssets.map((asset) => [
                        asset.assetId,
                        asset.assetName,
                        asset.assetType,
                        asset.entityName,
                        asset.securityDomain,
                        asset.gapType
                      ])
                    })
                  }
                >
                  <td className="px-3 py-2 text-slate-200">{row.securityDomain}</td>
                  <td className="px-3 py-2 text-slate-100">{row.entityName}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${scoreToneClass(row.scorePercent)}`}>
                    {formatPercent(row.scorePercent)}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-100">{row.compliant}</td>
                  <td className="px-3 py-2 text-right text-red-100">{row.nonCompliant}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{row.other}</td>
                  <td className="px-3 py-2 text-right text-slate-200">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel flex min-h-0 flex-col p-3">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">{model.entityLabelPlural} Not Modelled</h3>
        <p className="mt-1 text-xs text-slate-300/80">Entities marked as not modelled in the current scope.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <MetricCard
            label="Not Modelled"
            value={model.modellingGapRows.length}
            context={`${model.entityLabelPlural.toLowerCase()} requiring modelling follow-up`}
          />
          <MetricCard
            label="Discovery Score"
            value={formatPercent(model.summary.discoveryScorePercent)}
            context={`${model.discoveryStatusMix.compliant}/${model.discoveryStatusMix.total} assets compliant`}
          />
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-lg border border-sky-300/15 bg-slate-950/45">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2 text-left">{model.entityLabelSingular}</th>
                <th className="px-3 py-2 text-left">Domain</th>
                <th className="px-3 py-2 text-left">Owner</th>
              </tr>
            </thead>
            <tbody>
              {model.modellingGapRows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t border-sky-300/10 transition hover:bg-sky-300/5"
                  onClick={() =>
                    openPanel({
                      title: `${row.entityName} Not Modelled`,
                      subtitle: "Modelling gap detail for the selected entity.",
                      headers: [model.entityLabelSingular, "Domain", "Owner", "Status"],
                      rows: [[row.entityName, row.securityDomain ?? "N/A", row.owner, row.status]]
                    })
                  }
                >
                  <td className="px-3 py-2 text-slate-100">{row.entityName}</td>
                  <td className="px-3 py-2 text-slate-300">{row.securityDomain ?? "N/A"}</td>
                  <td className="px-3 py-2 text-slate-300">{row.owner}</td>
                </tr>
              ))}
              {!model.modellingGapRows.length ? (
                <tr className="border-t border-sky-300/10">
                  <td className="px-3 py-4 text-slate-300/80" colSpan={3}>
                    All scoped {model.entityLabelPlural.toLowerCase()} are modelled.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ThroughputTab({
  rows,
  openPanel
}: {
  rows: PerformanceThroughputPoint[];
  openPanel: (panel: DrillPanelState) => void;
}) {
  const totalOpened = rows.reduce((total, row) => total + row.openedCount, 0);
  const totalClosed = rows.reduce((total, row) => total + row.closedCount, 0);

  return (
    <div className="grid h-full min-h-[36rem] gap-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.55fr)]">
      <section className="panel flex min-h-0 flex-col p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Remediation Throughput (Weekly)</h3>
            <p className="mt-1 text-xs text-slate-300/80">Opened vs closed findings over the last 13 weeks.</p>
          </div>
          <p className="text-xs text-slate-300/80">Opened {totalOpened} | Closed {totalClosed}</p>
        </div>
        <div className="mt-2 min-h-[21rem] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
              <CartesianGrid stroke="rgba(120,180,210,0.14)" />
              <XAxis dataKey="weekLabel" minTickGap={18} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#d1e3ef" }} />
              <Bar dataKey="openedCount" name="Opened" fill="#f59e0b" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="closedCount" name="Closed" fill="#22c55e" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel flex min-h-0 flex-col p-3">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Weekly Detail</h3>
        <p className="mt-1 text-xs text-slate-300/80">Click a week for the throughput values.</p>
        <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-lg border border-sky-300/15 bg-slate-950/45">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2 text-left">Week</th>
                <th className="px-3 py-2 text-right">Opened</th>
                <th className="px-3 py-2 text-right">Closed</th>
                <th className="px-3 py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.weekLabel}
                  className="cursor-pointer border-t border-sky-300/10 transition hover:bg-sky-300/5"
                  onClick={() =>
                    openPanel({
                      title: `${row.weekLabel} Throughput`,
                      subtitle: "Opened, closed, and net finding movement for the selected week.",
                      headers: ["Week", "Opened", "Closed", "Net Change"],
                      rows: [[row.weekLabel, `${row.openedCount}`, `${row.closedCount}`, `${row.netChange}`]]
                    })
                  }
                >
                  <td className="px-3 py-2 text-slate-100">{row.weekLabel}</td>
                  <td className="px-3 py-2 text-right text-amber-100">{row.openedCount}</td>
                  <td className="px-3 py-2 text-right text-emerald-100">{row.closedCount}</td>
                  <td className="px-3 py-2 text-right text-slate-200">{row.netChange}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function PerformanceActionDashboard({ model }: { model: PerformanceReportModel }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("performance");
  const [drillPanel, setDrillPanel] = useState<DrillPanelState | null>(null);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-1.5">
      <nav className="flex flex-wrap gap-1" aria-label="Performance action dashboard tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
              activeTab === tab.id
                ? "border-sky-200/65 bg-sky-400/15 text-sky-100"
                : "border-sky-300/20 bg-slate-950/45 text-slate-300/85 hover:border-sky-200/45 hover:text-sky-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 overflow-auto pr-1">
        {activeTab === "performance" ? (
          <PerformanceTab model={model} openPanel={setDrillPanel} />
        ) : activeTab === "findings" ? (
          <FindingsTab model={model} openPanel={setDrillPanel} />
        ) : activeTab === "coverage" ? (
          <CoverageTab model={model} openPanel={setDrillPanel} />
        ) : (
          <ThroughputTab rows={model.throughputRows} openPanel={setDrillPanel} />
        )}
      </div>

      <DrillPanel panel={drillPanel} onClose={() => setDrillPanel(null)} />
    </div>
  );
}
