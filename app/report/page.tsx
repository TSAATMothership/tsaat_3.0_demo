import { FilterBar } from "@/components/filter-bar";
import { getCoreAppData } from "@/lib/app-data";
import { Filters } from "@/lib/types";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function toFilterQueryEntries(filters: Filters): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  if (filters.managedNetwork) entries.push(["network", filters.managedNetwork]);
  if (filters.ictSystem) entries.push(["system", filters.ictSystem]);
  if (filters.systemCriticality) entries.push(["criticality", filters.systemCriticality]);
  if (filters.securityDomain) entries.push(["securityDomain", filters.securityDomain]);
  if (filters.environment) entries.push(["environment", filters.environment]);
  if (filters.assetType) entries.push(["assetType", filters.assetType]);
  if (filters.severity) entries.push(["severity", filters.severity]);
  if (filters.missionCapability) entries.push(["mission", filters.missionCapability]);
  if (filters.businessService) entries.push(["service", filters.businessService]);
  return entries;
}

function hrefWithQuery(basePath: string, queryEntries: Array<[string, string]>): string {
  const params = new URLSearchParams();
  for (const [key, value] of queryEntries) {
    params.append(key, value);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export default async function ReportPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { dataset, filters, filterOptions } = await getCoreAppData(searchParams);
  const queryEntries = toFilterQueryEntries(filters);
  const selectedReportSearch = firstParam(searchParams.reportSearch)?.trim() ?? "";
  const normalizedReportSearch = selectedReportSearch.toLowerCase();

  const reportRows = [
    {
      id: "posture-summary",
      report: "Cyber Posture Summary (PDF)",
      description: "Scope-aligned briefing with compliance counts, top risks, and production exceptions.",
      audience: "Executives, risk analysts, integration tooling",
      href: hrefWithQuery(
        "/api/report/summary",
        [...queryEntries.filter(([key]) => key !== "format"), ["format", "pdf"]]
      )
    },
    {
      id: "networks-remediation",
      report: "Network Scope Remediation Report (PDF)",
      description: "Network-scoped remediation priorities, findings register excerpts, and discovery/tooling gap actions.",
      audience: "Network owners, remediation teams, cyber operations",
      href: hrefWithQuery("/api/networks/remediation-report", queryEntries)
    },
    {
      id: "systems-remediation",
      report: "ICT System Scope Remediation Report (PDF)",
      description: "System-scoped remediation brief for filtered ICT systems with findings, posture score, and action plan.",
      audience: "System owners, service delivery teams, security governance",
      href: hrefWithQuery("/api/systems/remediation-report", queryEntries)
    },
    {
      id: "systems-out-of-support-os",
      report: "ICT System out of support OS",
      description: "Server-focused brief listing ICT system assets that are non-compliant with SPI 1 operating system support requirements.",
      audience: "System owners, infrastructure operations, cyber assurance",
      href: hrefWithQuery("/api/systems/out-of-support-os-report", queryEntries)
    },
    {
      id: "systems-modelling-status",
      report: "ICT System Modelling Status",
      description: "DIIS registration versus modelling coverage with a scoped list of DIIS-registered ICT systems not yet modelled.",
      audience: "System owners, DIIS operations, architecture governance",
      href: hrefWithQuery("/api/systems/modelling-status-report", queryEntries)
    },
    {
      id: "discovery-remediation",
      report: "Discovery Coverage Remediation Report (PDF)",
      description: "Discovery coverage exceptions, missing tool mappings, and prioritized closure recommendations.",
      audience: "Discovery tool owners, CMDB teams, architecture and assurance",
      href: hrefWithQuery("/api/discovery-coverage/remediation-report", queryEntries)
    }
  ];
  const visibleReportRows = normalizedReportSearch
    ? reportRows.filter((row) =>
        [row.report, row.description, row.audience].join(" ").toLowerCase().includes(normalizedReportSearch)
      )
    : reportRows;
  const reportSearchClearHref = (() => {
    const params = new URLSearchParams();
    for (const [key, value] of queryEntries) {
      params.append(key, value);
    }
    const query = params.toString();
    return query ? `/report?${query}` : "/report";
  })();

  return (
    <div className="relative left-1/2 -my-5 flex h-[calc(100vh-11rem)] w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden md:-my-8 md:h-[calc(100vh-12rem)] md:w-[min(2100px,calc(100vw-3rem))]">
      <section className="panel shrink-0 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Briefs & Reports</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">Report Catalogue</h1>
        <p className="mt-1 text-sm text-slate-300/80">
          Load generated reports for the current scope. Snapshot date {dataset.snapshotDate}.
        </p>
      </section>

      <FilterBar options={filterOptions} filters={filters} enableLoadingOverlay />

      <div className="min-h-0 flex-1 overflow-hidden">
        <section className="panel flex h-full min-h-0 flex-col overflow-hidden">
          <div className="border-b border-sky-400/15 px-4 py-3">
            <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Available Reports</h2>
            <form action="/report" method="get" className="mt-3 flex flex-wrap items-end gap-2">
              {queryEntries.map(([key, value]) => (
                <input key={`${key}-${value}`} type="hidden" name={key} value={value} />
              ))}
              <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                <label htmlFor="report-search" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
                  Text Search Reports
                </label>
                <input
                  id="report-search"
                  name="reportSearch"
                  type="search"
                  defaultValue={selectedReportSearch}
                  placeholder="Search report name, description, audience..."
                  className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
                />
              </div>
              <button
                type="submit"
                className="rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100"
              >
                Apply
              </button>
              {selectedReportSearch ? (
                <a
                  href={reportSearchClearHref}
                  className="rounded-md border border-slate-500/40 px-3 py-2 text-xs font-semibold text-slate-200"
                >
                  Clear
                </a>
              ) : null}
            </form>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                <tr>
                  <th className="px-3 py-2">Report</th>
                  <th className="px-3 py-2">Report Description</th>
                  <th className="px-3 py-2">Audience</th>
                  <th className="px-3 py-2">Load Report</th>
                </tr>
              </thead>
              <tbody>
                {visibleReportRows.map((row) => (
                  <tr key={row.id} className="border-t border-sky-400/10 align-top">
                    <td className="px-3 py-3 text-slate-100">{row.report}</td>
                    <td className="px-3 py-3 text-slate-300/90">{row.description}</td>
                    <td className="px-3 py-3 text-slate-300/90">{row.audience}</td>
                    <td className="px-3 py-3">
                      <a
                        href={row.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-sky-100 transition hover:bg-sky-500/25"
                      >
                        Load Report
                      </a>
                    </td>
                  </tr>
                ))}
                {visibleReportRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-300/80">
                      No reports match the current text search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
