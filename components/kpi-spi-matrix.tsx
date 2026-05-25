import type { ReactNode } from "react";
import { buildKpiReportModels } from "@/lib/kpi-report-model";
import { KpiDefinition } from "@/lib/kpi-definitions";
import { buildSpiReportModels } from "@/lib/spi-report-model";
import { buildTaskingReportHref } from "@/lib/tasking-report-links";
import { AnalyticsResult, Dataset, Filters, ICTSystem, ManagedNetwork, type SpiId } from "@/lib/types";

interface Option {
  id: string;
  label: string;
}

interface FilterOptions {
  networks: Option[];
  systems: Option[];
  securityDomains: Option[];
  missionCapabilities: Option[];
  businessServices: Option[];
}

function resolveOption(options: Option[], id: string | undefined): string {
  if (!id) {
    return "All";
  }
  return options.find((option) => option.id === id)?.label ?? id;
}

function summarizeFilterScope(filters: Filters, options: FilterOptions): string {
  return [
    `Network: ${resolveOption(options.networks, filters.managedNetwork)}`,
    `ICT System: ${resolveOption(options.systems, filters.ictSystem)}`,
    `Criticality: ${filters.systemCriticality ?? "All"}`,
    `Security Domain: ${resolveOption(options.securityDomains, filters.securityDomain)}`,
    `Environment: ${filters.environment ?? "All"}`,
    `Asset Type: ${filters.assetType ?? "All"}`,
    `Severity: ${filters.severity ?? "All"}`,
    `Mission Capability: ${resolveOption(options.missionCapabilities, filters.missionCapability)}`,
    `Business Service: ${resolveOption(options.businessServices, filters.businessService)}`
  ].join(" | ");
}

function SpiField({
  label,
  children,
  className = ""
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 px-4 py-3 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400/90">{label}</p>
      <div className="mt-1.5 text-sm leading-5 text-slate-200">{children}</div>
    </div>
  );
}

function SpiMetric({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "good" | "danger" | "warning";
}) {
  const valueClass =
    tone === "good"
      ? "text-emerald-100"
      : tone === "danger"
        ? "text-red-100"
        : tone === "warning"
          ? "text-amber-100"
          : "text-sky-100";
  const cellClass =
    tone === "good"
      ? "bg-emerald-500/10 shadow-[inset_0_1px_0_rgba(110,231,183,0.08)]"
      : tone === "danger"
        ? "bg-red-500/10 shadow-[inset_0_1px_0_rgba(252,165,165,0.08)]"
        : tone === "warning"
          ? "bg-amber-500/10 shadow-[inset_0_1px_0_rgba(252,211,77,0.08)]"
          : "bg-sky-500/10 shadow-[inset_0_1px_0_rgba(125,211,252,0.08)]";
  const labelClass =
    tone === "good"
      ? "text-emerald-100/75"
      : tone === "danger"
        ? "text-red-100/75"
        : tone === "warning"
          ? "text-amber-100/75"
          : "text-sky-100/75";

  return (
    <div className={`min-w-0 px-4 py-3 ${cellClass}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${labelClass}`}>{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

function SpiAssetTypeCell({
  label,
  nonCompliant,
  unknown
}: {
  label: string;
  nonCompliant: number;
  unknown: number;
}) {
  return (
    <div className="min-w-0 border-r border-slate-600/30 bg-slate-800/45 px-4 py-3 last:border-r-0">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-slate-100">{label}</p>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="rounded-sm border border-red-300/20 bg-red-500/10 px-2 py-1 text-red-100">
          NC {nonCompliant}
        </span>
        <span className="rounded-sm border border-amber-200/20 bg-amber-500/10 px-2 py-1 text-amber-100">
          U {unknown}
        </span>
      </div>
    </div>
  );
}

export function KpiSpiMatrix({
  dataset,
  analytics,
  systems,
  networks,
  kpiDefinitions,
  filters,
  filterOptions,
  mode,
  selectedSpiId,
  searchValue = ""
}: {
  dataset: Dataset;
  analytics: AnalyticsResult;
  systems: ICTSystem[];
  networks: ManagedNetwork[];
  kpiDefinitions?: KpiDefinition[];
  filters: Filters;
  filterOptions: FilterOptions;
  mode: "kpi" | "spi";
  selectedSpiId?: SpiId;
  searchValue?: string;
}) {
  const kpiReports = mode === "kpi" ? buildKpiReportModels(analytics, systems, networks, kpiDefinitions ?? []) : [];
  const spiReports = mode === "spi" ? buildSpiReportModels(dataset, analytics) : [];
  const normalizedSearch = searchValue.trim().toLowerCase();
  const filteredSpiReports = spiReports.filter((report) => {
    if (selectedSpiId && report.spiId !== selectedSpiId) {
      return false;
    }
    if (!normalizedSearch) {
      return true;
    }

    return [
      report.indicatorLabel,
      `SPI ${report.spiId}`,
      report.name,
      report.description,
      report.successMeasure
    ].join(" ").toLowerCase().includes(normalizedSearch);
  });

  return (
    <section className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-sky-400/15 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">
              {mode === "kpi" ? "KPI Report" : "SPI Report"}
            </h2>
            <p className="mt-2 text-xs text-slate-300/80">Scores are computed on currently filtered scope.</p>
          </div>
          {mode === "spi" ? (
            <a
              href={buildTaskingReportHref({
                kind: "spi-all",
                id: "all",
                filters,
                dataDate: dataset.snapshotDate
              })}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-amber-200/45 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100 transition hover:border-amber-100/70 hover:bg-amber-500/20"
            >
              Generate SPI Report (All SPIs)
            </a>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-slate-300/70">{summarizeFilterScope(filters, filterOptions)}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {mode === "kpi" ? (
          <>
            <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-300/85">
              Key Performance Indicator Report Index
            </h3>
            <div className="grid min-w-[96rem] gap-4">
              {kpiReports.map((report) => (
                <article
                  key={report.id}
                  className="overflow-hidden rounded-lg border border-sky-400/20 bg-slate-950/45 shadow-[0_14px_34px_rgba(0,0,0,0.24)]"
                >
                  <div className="grid grid-cols-2 border-b border-sky-400/15">
                    <div className="grid grid-cols-[minmax(12rem,0.72fr)_minmax(17rem,1fr)_minmax(19rem,1.1fr)] divide-x divide-sky-400/10 bg-slate-900/30">
                      <SpiField label={report.indicatorLabel}>
                        <p className="text-base font-semibold text-sky-100">{report.name}</p>
                      </SpiField>
                      <SpiField label="Description">{report.description}</SpiField>
                      <SpiField label="Success Measure">{report.successMeasure}</SpiField>
                    </div>

                    <div className="grid grid-cols-[repeat(4,minmax(6.5rem,1fr))_minmax(13.5rem,1.2fr)] divide-x divide-sky-400/10 bg-slate-950/25">
                      <SpiMetric label="Score" value={`${report.scorePercent}%`} />
                      <SpiMetric label="Compliant" value={report.compliant} tone="good" />
                      <SpiMetric label="Non-Compliant" value={report.nonCompliant} tone="danger" />
                      <SpiMetric label="Unknown" value={report.unknown} tone="warning" />
                      <div className="flex min-w-0 items-center justify-center px-3 py-3">
                        {report.reportAvailable ? (
                          <div className="flex w-full min-w-0 flex-col items-stretch gap-2">
                            <a
                              href={buildTaskingReportHref({
                                kind: "kpi",
                                id: report.id,
                                filters,
                                dataDate: dataset.snapshotDate
                              })}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-10 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-md border border-sky-300/40 bg-sky-500/15 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-100 transition hover:border-sky-200/70 hover:bg-sky-500/25"
                            >
                              Generate KPI Report
                            </a>
                            <a
                              href={buildTaskingReportHref({
                                kind: "kpi-trend",
                                id: report.id,
                                filters,
                                dataDate: dataset.snapshotDate
                              })}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-10 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-md border border-emerald-300/35 bg-emerald-500/10 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-500/20"
                            >
                              Generate Trend Report
                            </a>
                          </div>
                        ) : (
                          <span className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-slate-500/35 bg-slate-800/50 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300/85">
                            Unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {!kpiReports.length ? (
                <div className="rounded-lg border border-sky-400/20 bg-slate-950/45 px-4 py-6 text-sm text-slate-300/80">
                  No KPI definitions are available in the current database.
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-300/85">
              Security Posture Indicator Report Index
            </h3>
            <div className="grid min-w-[96rem] gap-4">
              {filteredSpiReports.map((report) => (
                <article
                  key={report.spiId}
                  className="overflow-hidden rounded-lg border border-sky-400/20 bg-slate-950/45 shadow-[0_14px_34px_rgba(0,0,0,0.24)]"
                >
                  <div className="grid grid-cols-2 border-b border-sky-400/15">
                    <div className="grid grid-cols-[minmax(12rem,0.72fr)_minmax(17rem,1fr)_minmax(19rem,1.1fr)] divide-x divide-sky-400/10 bg-slate-900/30">
                      <SpiField label={report.indicatorLabel}>
                        <p className="text-base font-semibold text-sky-100">{report.name}</p>
                      </SpiField>
                      <SpiField label="Description">{report.description}</SpiField>
                      <SpiField label="Success Measure">{report.successMeasure}</SpiField>
                    </div>

                    <div className="grid grid-cols-[repeat(4,minmax(6.5rem,1fr))_minmax(13.5rem,1.2fr)] divide-x divide-sky-400/10 bg-slate-950/25">
                      <SpiMetric label="Score" value={`${report.scorePercent}%`} />
                      <SpiMetric label="Compliant" value={report.compliant} tone="good" />
                      <SpiMetric label="Non-Compliant" value={report.nonCompliant} tone="danger" />
                      <SpiMetric label="Unknown" value={report.unknown} tone="warning" />
                      <div className="flex min-w-0 items-center justify-center px-3 py-3">
                        <div className="flex w-full min-w-0 flex-col items-stretch gap-2">
                          <a
                            href={buildTaskingReportHref({
                              kind: "spi",
                              id: String(report.spiId),
                              filters,
                              dataDate: dataset.snapshotDate
                            })}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-10 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-md border border-sky-300/40 bg-sky-500/15 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-100 transition hover:border-sky-200/70 hover:bg-sky-500/25"
                          >
                            Generate SPI Report
                          </a>
                          <a
                            href={buildTaskingReportHref({
                              kind: "spi-trend",
                              id: String(report.spiId),
                              filters,
                              dataDate: dataset.snapshotDate
                            })}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-10 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-md border border-emerald-300/35 bg-emerald-500/10 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-500/20"
                          >
                            Generate Trend Report
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-6 bg-slate-900/20">
                    {report.assetTypeBreakdown.map((group) => (
                      <SpiAssetTypeCell
                        key={group.id}
                        label={group.label}
                        nonCompliant={group.nonCompliant}
                        unknown={group.unknown}
                      />
                    ))}
                  </div>
                </article>
              ))}
              {!filteredSpiReports.length ? (
                <div className="rounded-lg border border-sky-400/20 bg-slate-950/45 px-4 py-6 text-sm text-slate-300/80">
                  No SPI reports match the current SPI and text search filters.
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
