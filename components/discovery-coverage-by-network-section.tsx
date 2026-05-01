"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CoverageByToolRadar } from "@/components/coverage-by-tool-radar";
import { DATA_DATE_PARAM, normalizeDataDate, withDataDate } from "@/lib/data-date";
import { buildNetworkDiscoveryReportHref } from "@/lib/network-discovery-report-links";

interface NetworkToolCoverage {
  toolId: string;
  toolName: string;
  covered: number;
  missing: number;
  applicable: number;
  coveragePercent: number;
}

export interface DiscoveryCoverageByNetworkRow {
  networkId: string;
  networkName: string;
  securityDomain: string;
  modellingStatus: "Modelled" | "Not Modelled";
  discoveryEnabled: boolean;
  description: string;
  owner: string;
  atoNumber: string;
  diisId: string;
  diisUrl?: string;
  grcUrl: string;
  assetCount: number;
  overallCoveredSlots: number;
  overallApplicableSlots: number;
  overallCoveragePercent: number;
  toolCoverage: NetworkToolCoverage[];
}

function isExternalLink(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function DiscoveryCoverageByNetworkSection({ rows }: { rows: DiscoveryCoverageByNetworkRow[] }) {
  const searchParams = useSearchParams();
  const scopedDataDate = normalizeDataDate(searchParams?.get(DATA_DATE_PARAM));

  return (
    <section className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
        Discovery Tool Coverage - by Network
      </h2>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {rows.map((row) => {
            const drillDownHref = withDataDate(`/networks/${row.networkId}`, scopedDataDate);
            const networkReportHref = buildNetworkDiscoveryReportHref({
              networkId: row.networkId,
              searchParams
            });

            return (
              <article key={row.networkId} className="panel-alt border border-sky-400/20 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">{row.networkName}</h3>
                    <p className="mt-1 text-xs text-slate-300/75">{row.description}</p>
                    <Link
                      href={drillDownHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-sm text-sky-100 underline decoration-sky-300/60 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                    >
                      Drill Down
                    </Link>
                  </div>
                  <div className="flex max-w-full flex-col items-start gap-2 sm:items-end">
                    <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
                      <span className="rounded-full border border-sky-300/45 bg-sky-500/15 px-2 py-0.5 text-xs text-sky-100">
                        Security Domain: {row.securityDomain}
                      </span>
                      <span className="rounded-full border border-slate-400/35 bg-slate-700/35 px-2 py-0.5 text-xs text-slate-100">
                        Assets In Scope: {row.assetCount}
                      </span>
                      <span className="rounded-full border border-cyan-300/45 bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-100">
                        Overall Coverage: {row.overallCoveragePercent}%
                      </span>
                      <span
                        className={
                          row.modellingStatus === "Modelled"
                            ? "rounded-full border border-emerald-300/45 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-100"
                            : "rounded-full border border-amber-300/45 bg-amber-500/15 px-2 py-0.5 text-xs text-amber-100"
                        }
                      >
                        Modelling Status: {row.modellingStatus}
                      </span>
                      <span
                        className={
                          row.discoveryEnabled
                            ? "rounded-full border border-emerald-300/45 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-100"
                            : "rounded-full border border-red-300/45 bg-red-500/15 px-2 py-0.5 text-xs text-red-100"
                        }
                      >
                        Discovery Enabled: {row.discoveryEnabled ? "Yes" : "No"}
                      </span>
                    </div>
                    <a
                      href={networkReportHref}
                      className="inline-flex min-h-[38px] items-center justify-center whitespace-nowrap rounded-md border border-amber-300/45 bg-amber-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-amber-100 transition hover:bg-amber-500/25"
                    >
                      Generate Network Discovery Report
                    </a>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md border border-sky-400/15 bg-slate-950/55 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">Owner</p>
                    <p className="mt-1 text-sm text-slate-100">{row.owner}</p>
                  </div>
                  <div className="rounded-md border border-sky-400/15 bg-slate-950/55 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">ATO</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{row.atoNumber}</p>
                  </div>
                  <div className="rounded-md border border-sky-400/15 bg-slate-950/55 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">DIIS</p>
                    {row.diisUrl ? (
                      <Link
                        href={row.diisUrl}
                        className="mt-1 inline-block text-sm font-semibold text-sky-100 underline decoration-sky-300/60 underline-offset-2"
                        target={isExternalLink(row.diisUrl) ? "_blank" : undefined}
                        rel={isExternalLink(row.diisUrl) ? "noreferrer" : undefined}
                      >
                        {row.diisId}
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-slate-100">{row.diisId}</p>
                    )}
                  </div>
                  <div className="rounded-md border border-sky-400/15 bg-slate-950/55 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">Cyber GRC</p>
                    <Link
                      href={row.grcUrl}
                      className="mt-1 inline-block text-sm text-sky-100 underline decoration-sky-300/60 underline-offset-2"
                      target={isExternalLink(row.grcUrl) ? "_blank" : undefined}
                      rel={isExternalLink(row.grcUrl) ? "noreferrer" : undefined}
                    >
                      View in Cyber GRC
                    </Link>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
                  <CoverageByToolRadar
                    className="border border-sky-400/15"
                    chartHeightClassName="h-[16rem]"
                    data={row.toolCoverage.map((tool) => ({
                      label: tool.toolName,
                      coveragePercent: tool.coveragePercent
                    }))}
                  />

                  <section className="panel-alt flex min-h-0 flex-col border border-sky-400/15 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">Coverage By Tool</p>
                    <div className="mt-2 min-h-0 overflow-auto rounded-lg border border-sky-400/15">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                          <tr>
                            <th className="px-3 py-2">Tool</th>
                            <th className="px-3 py-2">Covered Assets</th>
                            <th className="px-3 py-2">Missing Coverage</th>
                            <th className="px-3 py-2">Coverage %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.toolCoverage.map((tool) => (
                            <tr key={`${row.networkId}:${tool.toolId}`} className="border-t border-sky-400/10">
                              <td className="px-3 py-2 text-slate-100">{tool.toolName}</td>
                              <td className="px-3 py-2 text-emerald-200">{tool.covered}</td>
                              <td className="px-3 py-2 text-red-200">{tool.missing}</td>
                              <td className="px-3 py-2 text-slate-200">{tool.coveragePercent}%</td>
                            </tr>
                          ))}
                          {row.toolCoverage.length === 0 ? (
                            <tr className="border-t border-sky-400/10">
                              <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-300/80">
                                No tool coverage data in this network scope.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              </article>
            );
          })}

          {rows.length === 0 ? (
            <section className="panel-alt border border-sky-400/20 p-4 text-sm text-slate-300/85">
              No networks match the current discovery coverage filters.
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
