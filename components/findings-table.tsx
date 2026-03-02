import { Finding } from "@/lib/types";
import { SPI_DESCRIPTIONS } from "@/lib/constants";
import { workflowStatusAtAsOf } from "@/lib/finding-status";

function formatFindingTimestamp(timestamp: string): string {
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    return timestamp;
  }

  const [, year, month, day, hour, minute] = match;
  return `${day}:${month}:${year} ${hour}:${minute}`;
}

export function FindingsTable({
  findings,
  searchParams,
  selectedAsOf,
  selectedSpi,
  selectedStatus,
  selectedSearchTerm,
  spiOptions,
  pagination
}: {
  findings: Finding[];
  searchParams: Record<string, string | string[] | undefined>;
  selectedAsOf: string;
  selectedSpi?: number;
  selectedStatus?: string;
  selectedSearchTerm?: string;
  spiOptions: number[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
  };
}) {
  const preservedParams = Object.entries(searchParams).flatMap(([key, value]) => {
    if (key === "spi" || key === "search" || key === "status" || key === "page") {
      return [];
    }
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value.length ? [{ key, value: value[0] }] : [];
    }
    return [{ key, value }];
  });

  const clearFiltersHref = (() => {
    const params = new URLSearchParams();
    for (const param of preservedParams) {
      params.set(param.key, param.value);
    }
    const query = params.toString();
    return query ? `/findings?${query}` : "/findings";
  })();

  const exportHref = (format: "json" | "csv") => {
    const params = new URLSearchParams();
    for (const param of preservedParams) {
      params.set(param.key, param.value);
    }
    if (selectedSpi) {
      params.set("spi", String(selectedSpi));
    }
    if (selectedStatus) {
      params.set("status", selectedStatus);
    }
    if (selectedSearchTerm) {
      params.set("search", selectedSearchTerm);
    }
    params.set("format", format);
    return `/api/findings/export?${params.toString()}`;
  };

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (!value || key === "status") {
        continue;
      }
      params.set(key, Array.isArray(value) ? value[0] : value);
    }
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    const query = params.toString();
    return query ? `/findings?${query}` : "/findings";
  };

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-400/15 px-4 py-3">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Findings Register</h3>
        <div className="flex gap-2">
          <a
            className="rounded-md border border-sky-400/40 px-3 py-1 text-xs text-sky-100"
            href={exportHref("json")}
          >
            Export JSON
          </a>
          <a
            className="rounded-md border border-sky-400/40 px-3 py-1 text-xs text-sky-100"
            href={exportHref("csv")}
          >
            Export CSV
          </a>
        </div>
      </div>
      <div className="border-b border-sky-400/10 px-4 py-3">
        <form
          action="/findings"
          method="get"
          data-filter-loading="true"
          data-filter-loading-message="Applying filters..."
          className="flex flex-wrap items-end gap-3 xl:flex-nowrap"
        >
          {preservedParams.map((param) => (
            <input key={param.key} type="hidden" name={param.key} value={param.value} />
          ))}
          <div className="flex min-w-[300px] flex-col gap-1">
            <label htmlFor="findings-spi" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
              SPI
            </label>
            <select
              id="findings-spi"
              name="spi"
              defaultValue={selectedSpi ? String(selectedSpi) : ""}
              className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">All SPI</option>
              {spiOptions.map((option) => (
                <option key={option} value={option}>
                  SPI {option} - {SPI_DESCRIPTIONS[option as keyof typeof SPI_DESCRIPTIONS]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[160px] flex-1 flex-col gap-1">
            <label htmlFor="findings-search" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
              Text Search
            </label>
            <input
              id="findings-search"
              name="search"
              type="search"
              defaultValue={selectedSearchTerm ?? ""}
              placeholder="Search title, scope, evidence, action..."
              className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100"
          >
            Apply
          </button>
          {selectedSpi || selectedSearchTerm ? (
            <a
              href={clearFiltersHref}
              data-filter-loading="true"
              data-filter-loading-message="Applying filters..."
              className="shrink-0 rounded-md border border-slate-500/40 px-3 py-2 text-xs font-semibold text-slate-200"
            >
              Clear
            </a>
          ) : null}
        </form>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
            <tr>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">SPI</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">Evidence</th>
              <th className="px-3 py-2">Recommended Action</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((finding) => {
              const asOfStatus = workflowStatusAtAsOf(finding, selectedAsOf) ?? "open";
              return (
                <tr key={finding.id} className="border-t border-sky-400/10 align-top">
                  <td className="px-3 py-3 text-slate-100">{finding.priorityRank}</td>
                  <td className="px-3 py-3 text-slate-100">{finding.spiId}</td>
                  <td className="px-3 py-3 text-slate-200">{finding.severity}</td>
                  <td className="px-3 py-3 text-slate-300/90">{formatFindingTimestamp(finding.timestamp)}</td>
                  <td className="px-3 py-3 text-slate-300/90">
                    <p>Workflow: {asOfStatus}</p>
                    <p>Compliance: {finding.complianceStatus}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-300/90">
                    <p>Network: {finding.scope.networkId}</p>
                    <p>System: {finding.scope.systemId ?? "-"}</p>
                    <p>Env: {finding.scope.environmentType ?? "-"}</p>
                    <p>Asset: {finding.scope.assetId}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-300/90">
                    {Object.entries(finding.evidence)
                      .slice(0, 4)
                      .map(([key, value]) => (
                        <p key={key}>
                          {key}: {String(value)}
                        </p>
                      ))}
                  </td>
                  <td className="px-3 py-3 text-slate-300/90">{finding.recommendedAction}</td>
                </tr>
              );
            })}
            {findings.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-300/80">
                  No findings match the selected SPI, Priority, Severity, and text search filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {pagination && pagination.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-400/10 px-4 py-3 text-xs text-slate-300/85">
          <p>
            Showing {(pagination.currentPage - 1) * pagination.pageSize + 1}-
            {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems}
          </p>
          <div className="flex items-center gap-2">
            {pagination.currentPage > 1 ? (
              <a
                href={buildPageHref(pagination.currentPage - 1)}
                data-filter-loading="true"
                data-filter-loading-message="Loading findings page..."
                className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 hover:bg-slate-800/70"
              >
                Previous
              </a>
            ) : (
              <span className="rounded-md border border-slate-700/70 px-3 py-1 text-slate-500">Previous</span>
            )}
            <span>
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            {pagination.currentPage < pagination.totalPages ? (
              <a
                href={buildPageHref(pagination.currentPage + 1)}
                data-filter-loading="true"
                data-filter-loading-message="Loading findings page..."
                className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 hover:bg-slate-800/70"
              >
                Next
              </a>
            ) : (
              <span className="rounded-md border border-slate-700/70 px-3 py-1 text-slate-500">Next</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
