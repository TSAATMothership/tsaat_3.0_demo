import { DiscoveryCoverageByToolSection } from "@/components/discovery-coverage-by-tool-section";
import { DiscoveryCoverageSearchForm } from "@/components/discovery-coverage-search-form";
import { DiscoveryCoverageTabs, type TargetStateNetworkSummary } from "@/components/discovery-coverage-tabs";
import { FilterBar } from "@/components/filter-bar";
import { ServerStreamHint } from "@/components/server-stream-hint";
import { getCoreAppData } from "@/lib/app-data";
import { paginate, parsePageState } from "@/lib/pagination";
import { Asset } from "@/lib/types";
import { Suspense } from "react";

interface DiscoveryCoverageStatus {
  ucmdb: number;
  tanium: number;
  tenable: number;
  snow: number;
  serviceNow: number;
  dsocSiem: number;
  elastic: number;
  coverageCompliance: boolean;
  missingTools: string[];
}

interface CoverageRow {
  assetId: string;
  hostname: string;
  assetType: Asset["type"];
  networkId: string;
  systemId: string | null;
  environment: string;
  coverage: DiscoveryCoverageStatus;
}

const TOOL_COLUMNS = [
  { key: "ucmdb", label: "UCMDB" },
  { key: "tanium", label: "Tanium" },
  { key: "tenable", label: "Tenable" },
  { key: "snow", label: "SNOW" },
  { key: "serviceNow", label: "ServiceNow" },
  { key: "dsocSiem", label: "DSOC SIEM" },
  { key: "elastic", label: "Elastic" }
] as const;

function discoveryCoverageForAsset(asset: Asset): DiscoveryCoverageStatus {
  const ucmdb = asset.systemContext?.systemId ? 1 : 0;
  const tanium = asset.type === "server" || asset.type === "workstation" ? 1 : 0;
  const tenable = asset.vulnerabilities.some((vulnerability) =>
    ["Nessus", "Qualys", "OpenVAS"].includes(vulnerability.source)
  )
    ? 1
    : 0;
  const snow = asset.lifecycle.warrantyStatus !== "Unknown" ? 1 : 0;
  const serviceNow = asset.lifecycle.eolStatus !== "Unknown" ? 1 : 0;
  const dsocSiem = asset.vulnerabilities.length > 0 ? 1 : 0;
  const elastic = asset.type === "server" || asset.type === "workstation" ? 1 : 0;

  const toolValues = {
    ucmdb,
    tanium,
    tenable,
    snow,
    serviceNow,
    dsocSiem,
    elastic
  } as const;

  const missingTools = TOOL_COLUMNS.filter(({ key }) => toolValues[key] === 0).map(({ label }) => label);
  const coverageCompliance = missingTools.length === 0;

  return {
    ...toolValues,
    coverageCompliance,
    missingTools
  };
}

function OneZeroPill({ value }: { value: number }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs ${
        value === 1
          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
          : "border-red-400/45 bg-red-500/15 text-red-100"
      }`}
    >
      {value}
    </span>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function toQueryEntries(searchParams: Record<string, string | string[] | undefined>): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        entries.push([key, item]);
      }
    } else if (typeof value === "string") {
      entries.push([key, value]);
    }
  }
  return entries;
}

function deterministicDiscoveryPercent(seed: string): number {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return 90 + (hash % 11);
}

function targetCountForActual(actual: number, percentFound: number): number {
  if (actual <= 0) {
    return 0;
  }
  if (actual < 10) {
    return actual;
  }

  let target = Math.max(actual, Math.round(actual / (percentFound / 100)));
  while (target > actual && actual / target < 0.9) {
    target -= 1;
  }
  return target;
}

export default async function DiscoveryCoveragePage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { dataset, analytics, filters, filterOptions } = await getCoreAppData(searchParams);
  const networkNameById = new Map(dataset.managedNetworks.map((network) => [network.id, network.name]));
  const systemNameById = new Map(dataset.ictSystems.map((system) => [system.id, system.name]));

  const scopedAssetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
  const rows: CoverageRow[] = dataset.assets
    .filter((asset) => scopedAssetIds.has(asset.id))
    .map((asset) => ({
      assetId: asset.id,
      hostname: asset.hostname,
      assetType: asset.type,
      networkId: asset.networkId,
      systemId: asset.systemContext?.systemId ?? null,
      environment: asset.systemContext?.environmentType ?? "-",
      coverage: discoveryCoverageForAsset(asset)
    }))
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
  const queryEntries = toQueryEntries(searchParams);
  const gapPageState = parsePageState(searchParams, "page", "pageSize");
  const matrixPageState = parsePageState(searchParams, "matrixPage", "matrixPageSize");
  const gapSearchTerm = firstParam(searchParams.gapSearch)?.trim() ?? "";
  const matrixSearchTerm = firstParam(searchParams.matrixSearch)?.trim() ?? "";
  const normalizedGapSearchTerm = gapSearchTerm.toLowerCase();
  const normalizedMatrixSearchTerm = matrixSearchTerm.toLowerCase();
  const remediationReportHref = (() => {
    const params = new URLSearchParams();
    for (const [key, value] of queryEntries) {
      params.append(key, value);
    }
    const query = params.toString();
    return query ? `/api/discovery-coverage/remediation-report?${query}` : "/api/discovery-coverage/remediation-report";
  })();

  const compliantCount = rows.filter((row) => row.coverage.coverageCompliance).length;
  const gapCount = rows.length - compliantCount;
  const toolSlots = rows.length * TOOL_COLUMNS.length;
  const coveredToolSlots = rows.reduce((total, row) => {
    const toolSum = TOOL_COLUMNS.reduce((sum, { key }) => sum + row.coverage[key], 0);
    return total + toolSum;
  }, 0);
  const overallToolCoveragePercent = toolSlots ? Number(((coveredToolSlots / toolSlots) * 100).toFixed(1)) : 0;

  const toolStats = TOOL_COLUMNS.map(({ key, label }) => {
    const covered = rows.filter((row) => row.coverage[key] === 1).length;
    const missing = rows.length - covered;
    const coveragePercent = rows.length ? Number(((covered / rows.length) * 100).toFixed(1)) : 0;
    return { label, covered, missing, coveragePercent };
  });

  const nonCompliantRows = rows.filter((row) => !row.coverage.coverageCompliance);
  const gapRows = nonCompliantRows.filter((row) => {
    if (!normalizedGapSearchTerm) {
      return true;
    }
    const networkName = networkNameById.get(row.networkId) ?? row.networkId;
    const systemName = row.systemId ? (systemNameById.get(row.systemId) ?? row.systemId) : "";
    const haystack = [
      row.hostname,
      row.assetId,
      row.assetType,
      row.environment,
      networkName,
      systemName,
      row.coverage.missingTools.join(" ")
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedGapSearchTerm);
  });
  const matrixRows = rows.filter((row) => {
    if (!normalizedMatrixSearchTerm) {
      return true;
    }
    const networkName = networkNameById.get(row.networkId) ?? row.networkId;
    const systemName = row.systemId ? (systemNameById.get(row.systemId) ?? row.systemId) : "";
    const haystack = [row.hostname, row.assetId, row.assetType, row.environment, networkName, systemName]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedMatrixSearchTerm);
  });
  const gapRowsPage = paginate(gapRows, gapPageState.page, gapPageState.pageSize);
  const matrixRowsPage = paginate(matrixRows, matrixPageState.page, matrixPageState.pageSize);

  const pageHref = (updates: Record<string, string | undefined>): string => {
    const params = new URLSearchParams();
    for (const [key, value] of queryEntries) {
      params.append(key, value);
    }
    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    return query ? `/discovery-coverage?${query}` : "/discovery-coverage";
  };

  const assetTotalsByNetwork = dataset.assets.reduce(
    (map, asset) => {
      const current = map.get(asset.networkId) ?? { server: 0, workstation: 0, networkDevice: 0 };
      if (asset.type === "server") {
        current.server += 1;
      } else if (asset.type === "workstation") {
        current.workstation += 1;
      } else {
        current.networkDevice += 1;
      }
      map.set(asset.networkId, current);
      return map;
    },
    new Map<string, { server: number; workstation: number; networkDevice: number }>()
  );

  const targetStateNetworks: TargetStateNetworkSummary[] = dataset.managedNetworks.map((network) => {
      const actualTotals = assetTotalsByNetwork.get(network.id) ?? { server: 0, workstation: 0, networkDevice: 0 };
      const serverPercent = deterministicDiscoveryPercent(`${network.id}:server`);
      const workstationPercent = deterministicDiscoveryPercent(`${network.id}:workstation`);
      const networkDevicePercent = deterministicDiscoveryPercent(`${network.id}:network-device`);

      return {
        id: network.id,
        name: network.name,
        isNewNetwork: network.discoveryStatus === "Discovery Non Enabled",
        discoveryStatus: network.discoveryStatus,
        totals: {
          server: {
            actual: actualTotals.server,
            target: targetCountForActual(actualTotals.server, serverPercent)
          },
          workstation: {
            actual: actualTotals.workstation,
            target: targetCountForActual(actualTotals.workstation, workstationPercent)
          },
          networkDevice: {
            actual: actualTotals.networkDevice,
            target: targetCountForActual(actualTotals.networkDevice, networkDevicePercent)
          }
        }
      };
    });

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Discovery Coverage View</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-100">Discovery Coverage</h1>
        <p className="mt-2 max-w-5xl text-sm text-slate-300/85">
          Breakdown of discovery tooling coverage issues across all assets within the Defence Cyber Terrain. Use filters
          to scope networks, ICT systems, criticality, environments, and security domains.
        </p>
      </section>

      <DiscoveryCoverageTabs targetStateNetworks={targetStateNetworks}>
        <FilterBar options={filterOptions} filters={filters} enableLoadingOverlay />

      <section id="remediation-report" className="panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Remediation Report</h2>
            <p className="mt-1 text-sm text-slate-300/85">
              Generate a remediation report for discovery coverage gaps using the current Discovery Coverage page filters
              and search terms.
            </p>
            <p className="mt-1 text-xs text-slate-300/75">
              Includes scope summary, coverage score, filters applied, asset-level discovery gaps, and recommended actions.
            </p>
          </div>
          <a
            href={remediationReportHref}
            className="inline-flex items-center justify-center rounded-md border border-amber-300/45 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/25"
          >
            Generate Remediation Report
          </a>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Coverage Snapshot</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="panel-alt border-sky-300/25 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Total Assets In Scope</p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">{rows.length}</p>
          </div>
          <div className="panel-alt border-emerald-400/25 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Coverage Compliant Assets</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-100">{compliantCount}</p>
          </div>
          <div className="panel-alt border-red-400/25 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Assets With Coverage Gaps</p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{gapCount}</p>
          </div>
          <div className="panel-alt border-sky-400/25 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Overall Tool Coverage</p>
            <p className="mt-1 text-2xl font-semibold text-sky-100">{overallToolCoveragePercent}%</p>
          </div>
        </div>
      </section>

      <DiscoveryCoverageByToolSection toolStats={toolStats} />

      <Suspense
        fallback={
          <section className="panel p-4">
            <p className="text-sm text-slate-300/80">Loading coverage gaps...</p>
          </section>
        }
      >
        <ServerStreamHint />
        <section id="coverage-gaps" className="panel overflow-hidden">
        <div className="border-b border-sky-400/15 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Assets With Discovery Coverage Gaps</h2>
            <DiscoveryCoverageSearchForm
              searchParamKey="gapSearch"
              searchValue={gapSearchTerm}
              placeholder="Search assets, IDs, environment, or missing tools"
            />
          </div>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Network</th>
                <th className="px-3 py-2">ICT System</th>
                <th className="px-3 py-2">Environment</th>
                <th className="px-3 py-2">Missing Tools</th>
              </tr>
            </thead>
            <tbody>
              {gapRowsPage.items.map((row) => (
                <tr key={row.assetId} className="border-t border-sky-400/10">
                  <td className="px-3 py-2 text-slate-100">{row.hostname}</td>
                  <td className="px-3 py-2 text-slate-300">{row.assetType}</td>
                  <td className="px-3 py-2 text-slate-300">{networkNameById.get(row.networkId) ?? row.networkId}</td>
                  <td className="px-3 py-2 text-slate-300">
                    {row.systemId ? (systemNameById.get(row.systemId) ?? row.systemId) : "-"}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{row.environment}</td>
                  <td className="px-3 py-2 text-red-100">{row.coverage.missingTools.join(", ")}</td>
                </tr>
              ))}
              {gapRowsPage.totalItems === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-300/80">
                    {gapSearchTerm ? "No gap rows match this search in the current scope." : "No discovery coverage gaps in this scope."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {gapRowsPage.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-400/10 px-4 py-3 text-xs text-slate-300/85">
            <p>
              Showing {(gapRowsPage.currentPage - 1) * gapRowsPage.pageSize + 1}-
              {Math.min(gapRowsPage.currentPage * gapRowsPage.pageSize, gapRowsPage.totalItems)} of{" "}
              {gapRowsPage.totalItems}
            </p>
            <div className="flex items-center gap-2">
              {gapRowsPage.currentPage > 1 ? (
                <a
                  href={`${pageHref({ page: String(gapRowsPage.currentPage - 1) })}#coverage-gaps`}
                  data-filter-loading="true"
                  data-filter-loading-message="Loading coverage gaps..."
                  className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 hover:bg-slate-800/70"
                >
                  Previous
                </a>
              ) : (
                <span className="rounded-md border border-slate-700/70 px-3 py-1 text-slate-500">Previous</span>
              )}
              <span>
                Page {gapRowsPage.currentPage} of {gapRowsPage.totalPages}
              </span>
              {gapRowsPage.currentPage < gapRowsPage.totalPages ? (
                <a
                  href={`${pageHref({ page: String(gapRowsPage.currentPage + 1) })}#coverage-gaps`}
                  data-filter-loading="true"
                  data-filter-loading-message="Loading coverage gaps..."
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
        </section>
      </Suspense>

      <Suspense
        fallback={
          <section className="panel p-4">
            <p className="text-sm text-slate-300/80">Loading coverage matrix...</p>
          </section>
        }
      >
        <ServerStreamHint />
        <section id="coverage-matrix" className="panel overflow-hidden">
        <div className="border-b border-sky-400/15 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">
              Discovery Coverage Matrix (All Assets)
            </h2>
            <DiscoveryCoverageSearchForm
              searchParamKey="matrixSearch"
              searchValue={matrixSearchTerm}
              placeholder="Search assets, IDs, network, system, or environment"
            />
          </div>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Environment</th>
                <th className="px-3 py-2">UCMDB</th>
                <th className="px-3 py-2">Tanium</th>
                <th className="px-3 py-2">Tenable</th>
                <th className="px-3 py-2">SNOW</th>
                <th className="px-3 py-2">ServiceNow</th>
                <th className="px-3 py-2">DSOC SIEM</th>
                <th className="px-3 py-2">Elastic</th>
                <th className="px-3 py-2">Coverage Compliance</th>
              </tr>
            </thead>
            <tbody>
              {matrixRowsPage.items.map((row) => (
                <tr key={row.assetId} className="border-t border-sky-400/10">
                  <td className="px-3 py-2 text-slate-100">{row.hostname}</td>
                  <td className="px-3 py-2 text-slate-300">{row.assetType}</td>
                  <td className="px-3 py-2 text-slate-300">{row.environment}</td>
                  <td className="px-3 py-2">
                    <OneZeroPill value={row.coverage.ucmdb} />
                  </td>
                  <td className="px-3 py-2">
                    <OneZeroPill value={row.coverage.tanium} />
                  </td>
                  <td className="px-3 py-2">
                    <OneZeroPill value={row.coverage.tenable} />
                  </td>
                  <td className="px-3 py-2">
                    <OneZeroPill value={row.coverage.snow} />
                  </td>
                  <td className="px-3 py-2">
                    <OneZeroPill value={row.coverage.serviceNow} />
                  </td>
                  <td className="px-3 py-2">
                    <OneZeroPill value={row.coverage.dsocSiem} />
                  </td>
                  <td className="px-3 py-2">
                    <OneZeroPill value={row.coverage.elastic} />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        row.coverage.coverageCompliance
                          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                          : "border-red-400/45 bg-red-500/15 text-red-100"
                      }`}
                    >
                      {row.coverage.coverageCompliance ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              ))}
              {matrixRowsPage.totalItems === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-sm text-slate-300/80">
                    {matrixSearchTerm ? "No matrix rows match this search in the current scope." : "No assets in this scope."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {matrixRowsPage.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-400/10 px-4 py-3 text-xs text-slate-300/85">
            <p>
              Showing {(matrixRowsPage.currentPage - 1) * matrixRowsPage.pageSize + 1}-
              {Math.min(matrixRowsPage.currentPage * matrixRowsPage.pageSize, matrixRowsPage.totalItems)} of{" "}
              {matrixRowsPage.totalItems}
            </p>
            <div className="flex items-center gap-2">
              {matrixRowsPage.currentPage > 1 ? (
                <a
                  href={`${pageHref({ matrixPage: String(matrixRowsPage.currentPage - 1) })}#coverage-matrix`}
                  data-filter-loading="true"
                  data-filter-loading-message="Loading coverage matrix..."
                  className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 hover:bg-slate-800/70"
                >
                  Previous
                </a>
              ) : (
                <span className="rounded-md border border-slate-700/70 px-3 py-1 text-slate-500">Previous</span>
              )}
              <span>
                Page {matrixRowsPage.currentPage} of {matrixRowsPage.totalPages}
              </span>
              {matrixRowsPage.currentPage < matrixRowsPage.totalPages ? (
                <a
                  href={`${pageHref({ matrixPage: String(matrixRowsPage.currentPage + 1) })}#coverage-matrix`}
                  data-filter-loading="true"
                  data-filter-loading-message="Loading coverage matrix..."
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
        </section>
      </Suspense>
      </DiscoveryCoverageTabs>
    </div>
  );
}
