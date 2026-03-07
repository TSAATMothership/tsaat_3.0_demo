import { buildKpiRows, buildSpiRows } from "@/lib/measures";
import { AnalyticsResult, Filters, ICTSystem, ManagedNetwork } from "@/lib/types";

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

function toTaskingHref(kind: "kpi" | "spi", id: string, filters: Filters): string {
  const params = new URLSearchParams();
  params.set("kind", kind);
  params.set("id", id);

  if (filters.managedNetwork) {
    params.set("network", filters.managedNetwork);
  }
  if (filters.ictSystem) {
    params.set("system", filters.ictSystem);
  }
  if (filters.systemCriticality) {
    params.set("criticality", filters.systemCriticality);
  }
  if (filters.securityDomain) {
    params.set("securityDomain", filters.securityDomain);
  }
  if (filters.environment) {
    params.set("environment", filters.environment);
  }
  if (filters.assetType) {
    params.set("assetType", filters.assetType);
  }
  if (filters.severity) {
    params.set("severity", filters.severity);
  }
  if (filters.missionCapability) {
    params.set("mission", filters.missionCapability);
  }
  if (filters.businessService) {
    params.set("service", filters.businessService);
  }

  return `/api/tasking-report?${params.toString()}`;
}

const KPI_TASKING_DISABLED = new Set(["KPI-1", "KPI-2", "KPI-3"]);

export function KpiSpiMatrix({
  analytics,
  systems,
  networks,
  filters,
  filterOptions
}: {
  analytics: AnalyticsResult;
  systems: ICTSystem[];
  networks: ManagedNetwork[];
  filters: Filters;
  filterOptions: FilterOptions;
}) {
  const kpiRows = buildKpiRows(analytics, systems, networks);
  const spiRows = buildSpiRows(analytics);

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-sky-400/15 px-4 py-4">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">KPI and SPI Performance Matrix</h2>
        <p className="mt-2 text-xs text-slate-300/80">Scores are computed on currently filtered scope.</p>
        <p className="mt-1 text-xs text-slate-300/70">{summarizeFilterScope(filters, filterOptions)}</p>
      </div>

      <div className="px-4 py-4">
        <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-300/85">Key Performance Indicators (KPI)</h3>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2">KPI</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Success Measure</th>
                <th className="px-3 py-2">Score</th>
                <th className="w-[150px] min-w-[150px] whitespace-nowrap px-3 py-2">Tasking Report</th>
              </tr>
            </thead>
            <tbody>
              {kpiRows.map((row) => (
                <tr key={row.id} className="border-t border-sky-400/10 align-top">
                  <td className="px-3 py-3 text-slate-100">
                    <p className="font-semibold">{row.id}</p>
                    <p className="text-xs text-slate-300/75">{row.name}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-300/90">{row.description}</td>
                  <td className="px-3 py-3 text-slate-300/90">{row.successMeasure}</td>
                  <td className="px-3 py-3 text-slate-100">{row.score}</td>
                  <td className="w-[150px] min-w-[150px] whitespace-nowrap px-3 py-3">
                    {KPI_TASKING_DISABLED.has(row.id) ? (
                      <span className="text-xs text-slate-400/80">Not available</span>
                    ) : (
                      <a
                        href={toTaskingHref("kpi", row.id, filters)}
                        className="text-xs font-semibold text-sky-200 underline"
                      >
                        Generate PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-sky-400/10 px-4 py-4">
        <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-300/85">Security Posture Indicators (SPI)</h3>
        <div className="max-h-[460px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="w-[110px] min-w-[110px] whitespace-nowrap px-3 py-2">SPI</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Success Measure</th>
                <th className="px-3 py-2">Score (%)</th>
                <th className="px-3 py-2">Compliant</th>
                <th className="px-3 py-2">Non-compliant</th>
                <th className="px-3 py-2">Unknown</th>
                <th className="px-3 py-2">Applicable</th>
                <th className="w-[150px] min-w-[150px] whitespace-nowrap px-3 py-2">Tasking Report</th>
              </tr>
            </thead>
            <tbody>
              {spiRows.map((row) => (
                <tr key={row.spiId} className="border-t border-sky-400/10 align-top">
                  <td className="w-[110px] min-w-[110px] whitespace-nowrap px-3 py-3 font-semibold text-slate-100">
                    SPI {row.spiId}
                  </td>
                  <td className="px-3 py-3 text-slate-300/90">{row.description}</td>
                  <td className="px-3 py-3 text-slate-300/90">{row.successMeasure}</td>
                  <td className="px-3 py-3 text-slate-100">{row.scorePercent}%</td>
                  <td className="px-3 py-3 text-emerald-200">{row.compliant}</td>
                  <td className="px-3 py-3 text-red-200">{row.nonCompliant}</td>
                  <td className="px-3 py-3 text-amber-100">{row.unknown}</td>
                  <td className="px-3 py-3 text-slate-200">{row.total}</td>
                  <td className="w-[150px] min-w-[150px] whitespace-nowrap px-3 py-3">
                    <a
                      href={toTaskingHref("spi", String(row.spiId), filters)}
                      className="text-xs font-semibold text-sky-200 underline"
                    >
                      Generate PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
