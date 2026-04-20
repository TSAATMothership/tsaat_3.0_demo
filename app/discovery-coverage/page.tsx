import { DiscoveryCoverageByToolSection } from "@/components/discovery-coverage-by-tool-section";
import { DiscoveryCoverageTabs } from "@/components/discovery-coverage-tabs";
import { DiscoveryToolsSettingsPanel } from "@/components/discovery-tools-settings-panel";
import {
  NetworkDiscoverySummaryTableClient,
  type NetworkDiscoverySummaryTableRow
} from "@/components/network-discovery-summary-table-client";
import {
  DiscoveryCoverageTargetStateSection,
  type TargetStateNetworkSummary
} from "@/components/discovery-coverage-target-state-section";
import { FilterBar } from "@/components/filter-bar";
import { getCoreAppData } from "@/lib/app-data";
import { ASSET_TYPES, createAssetTypeRecord } from "@/lib/asset-taxonomy";
import { DiscoveryCoverageValue, evaluateDiscoveryCoverage } from "@/lib/discovery-coverage";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";
import { Asset, AssetType } from "@/lib/types";

interface DiscoveryCoverageStatus {
  toolValues: Record<string, DiscoveryCoverageValue>;
  coverageCompliance: boolean;
  missingTools: string[];
}

interface CoverageRow {
  assetId: string;
  hostname: string;
  ipAddress: string;
  assetType: Asset["type"];
  networkId: string;
  systemId: string | null;
  environment: string;
  coverage: DiscoveryCoverageStatus;
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

function resolveAssetIpAddress(asset: Asset): string {
  const candidate = asset as Asset & {
    ipAddress?: string | null;
    ip?: string | null;
    ipv4?: string | null;
    ipv4Address?: string | null;
    primaryIp?: string | null;
  };
  const value =
    candidate.ipAddress ?? candidate.ip ?? candidate.ipv4 ?? candidate.ipv4Address ?? candidate.primaryIp ?? null;
  if (!value || !String(value).trim()) {
    return "N/A";
  }
  return String(value).trim();
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

function coveragePercent(actual: number, target: number): number {
  if (target <= 0) {
    return 0;
  }
  return Number(((actual / target) * 100).toFixed(1));
}

export default async function DiscoveryCoveragePage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const requestedTab = firstParam(searchParams.discoveryCoverageTab)?.trim().toLowerCase();
  const activeTab: "summary" | "target-state" | "tool-settings" =
    requestedTab === "target-state"
      ? "target-state"
      : requestedTab === "tool-settings"
        ? "tool-settings"
        : "summary";

  const discoveryDataSearchParams: Record<string, string | string[] | undefined> = { ...searchParams };
  delete discoveryDataSearchParams.criticality;
  if (activeTab === "target-state") {
    delete discoveryDataSearchParams.system;
    delete discoveryDataSearchParams.environment;
  }

  const { dataset, analytics, filters, filterOptions, networks, discoveryToolsSettings } = await getCoreAppData(
    discoveryDataSearchParams
  );
  const toolColumns = discoveryToolsSettings.tools.map((tool) => ({ key: tool.id, label: tool.name }));

  const scopedAssetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
  const rows: CoverageRow[] = dataset.assets
    .filter((asset) => scopedAssetIds.has(asset.id))
    .map((asset) => {
      const coverage = evaluateDiscoveryCoverage(asset, discoveryToolsSettings);
      return {
        assetId: asset.id,
        hostname: asset.hostname,
        ipAddress: resolveAssetIpAddress(asset),
        assetType: asset.type,
        networkId: asset.networkId,
        systemId: asset.systemContext?.systemId ?? null,
        environment: asset.systemContext?.environmentType ?? "-",
        coverage: {
          toolValues: coverage.toolValues,
          coverageCompliance: coverage.coverageCompliance,
          missingTools: coverage.missingToolNames
        }
      };
    })
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const queryEntries = toQueryEntries(discoveryDataSearchParams);
  const tabContentClass =
    activeTab === "summary" ? "min-h-0 flex-1 overflow-auto pr-1" : "min-h-0 flex-1 overflow-hidden pr-1";

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
  const toolSlots = rows.reduce((total, row) => {
    return (
      total +
      toolColumns.reduce((sum, toolColumn) => {
        return sum + (row.coverage.toolValues[toolColumn.key] === null ? 0 : 1);
      }, 0)
    );
  }, 0);
  const coveredToolSlots = rows.reduce((total, row) => {
    return (
      total +
      toolColumns.reduce((sum, toolColumn) => {
        return sum + (row.coverage.toolValues[toolColumn.key] === 1 ? 1 : 0);
      }, 0)
    );
  }, 0);
  const overallToolCoveragePercent = toolSlots ? Number(((coveredToolSlots / toolSlots) * 100).toFixed(1)) : 0;

  const toolStats = toolColumns.map(({ key, label }) => {
    const applicable = rows.filter((row) => row.coverage.toolValues[key] !== null).length;
    const covered = rows.filter((row) => row.coverage.toolValues[key] === 1).length;
    const missing = rows.filter((row) => row.coverage.toolValues[key] === 0).length;
    const coveragePercent = applicable ? Number(((covered / applicable) * 100).toFixed(1)) : 0;
    return { id: key, label, covered, missing, applicable, coveragePercent };
  });

  const assetTotalsByNetwork = rows.reduce((map, asset) => {
    const current = map.get(asset.networkId) ?? createAssetTypeRecord(() => 0);
    current[asset.assetType] += 1;
    map.set(asset.networkId, current);
    return map;
  }, new Map<string, Record<AssetType, number>>());

  const targetStateNetworks: TargetStateNetworkSummary[] = networks.map((network) => {
    const actualTotals = assetTotalsByNetwork.get(network.id) ?? createAssetTypeRecord(() => 0);
    const totals = createAssetTypeRecord((assetType) => {
      const actual = actualTotals[assetType];
      const percent = deterministicDiscoveryPercent(`${network.id}:${assetType}`);
      return {
        actual,
        target: targetCountForActual(actual, percent)
      };
    });

    return {
      id: network.id,
      name: network.name,
      isNewNetwork: network.discoveryStatus === "Discovery Non Enabled",
      discoveryStatus: network.discoveryStatus,
      totals
    };
  });

  const networkDetailFieldsById = new Map(networks.map((network) => [network.id, resolveNetworkDetailFields(network)]));
  const networkDiscoverySummaryRows: NetworkDiscoverySummaryTableRow[] = targetStateNetworks
    .map((network) => ({
      id: network.id,
      name: network.name,
      ...networkDetailFieldsById.get(network.id)!,
      discoveryEnabled:
        network.discoveryStatus === "Discovery Enabled"
          ? ("Enabled" as NetworkDiscoverySummaryTableRow["discoveryEnabled"])
          : ("Not Enabled" as NetworkDiscoverySummaryTableRow["discoveryEnabled"]),
      coverageByAssetType: Object.fromEntries(
        ASSET_TYPES.map((assetType) => [
          assetType,
          coveragePercent(network.totals[assetType].actual, network.totals[assetType].target)
        ])
      ) as Record<AssetType, number>
    }))
    .sort((a, b) => {
      if (a.discoveryEnabled !== b.discoveryEnabled) {
        return a.discoveryEnabled === "Enabled" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="relative left-1/2 -my-5 flex h-[calc(100vh-11rem)] w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden md:-my-8 md:h-[calc(100vh-12rem)] md:w-[min(2100px,calc(100vw-3rem))]">
      <section className="panel shrink-0 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Discovery Coverage View</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-100">Discovery</h1>
        <p className="mt-2 max-w-5xl text-sm text-slate-300/85">
          Breakdown of discovery tooling coverage issues across all assets within the Defence Cyber Terrain. Use filters
          to scope networks, ICT systems, criticality, environments, and security domains.
        </p>
      </section>

      <div className="shrink-0">
        <DiscoveryCoverageTabs activeTab={activeTab} />
      </div>

      <div className={tabContentClass}>
        {activeTab === "summary" ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <FilterBar
              options={filterOptions}
              filters={filters}
              hiddenFields={["systemCriticality"]}
              enableLoadingOverlay
            />

            <div
              id="discovery-coverage-summary-slideout-scope"
              className="relative grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4"
            >
              <section id="remediation-report" className="panel p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Remediation Report</h2>
                    <p className="mt-1 text-sm text-slate-300/85">
                      Generate a remediation report for discovery coverage gaps using the current Discovery Coverage page
                      filters and search terms.
                    </p>
                    <p className="mt-1 text-xs text-slate-300/75">
                      Includes scope summary, coverage score, filters applied, asset-level discovery gaps, and
                      recommended actions.
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
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                      Coverage Compliant Assets
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-100">{compliantCount}</p>
                  </div>
                  <div className="panel-alt border-red-400/25 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                      Assets With Coverage Gaps
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-red-100">{gapCount}</p>
                  </div>
                  <div className="panel-alt border-sky-400/25 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Overall Tool Coverage</p>
                    <p className="mt-1 text-2xl font-semibold text-sky-100">{overallToolCoveragePercent}%</p>
                  </div>
                </div>
              </section>

              <DiscoveryCoverageByToolSection
                toolStats={toolStats}
                slideoutScopeId="discovery-coverage-summary-slideout-scope"
                className="min-h-0 h-[calc(100%-10px)]"
              />
            </div>
          </div>
        ) : activeTab === "tool-settings" ? (
          <div className="h-full min-h-0">
            <DiscoveryToolsSettingsPanel initialSettings={discoveryToolsSettings} />
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-3 pb-[15px]">
            <FilterBar
              options={filterOptions}
              filters={filters}
              hiddenFields={["ictSystem", "environment", "systemCriticality"]}
              enableLoadingOverlay
            />
            <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <section className="panel flex min-h-0 flex-col overflow-hidden">
                <h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
                  Network Discovery Summary
                </h2>
                <NetworkDiscoverySummaryTableClient rows={networkDiscoverySummaryRows} />
              </section>

              <section className="panel flex min-h-0 flex-1 flex-col p-4">
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <DiscoveryCoverageTargetStateSection
                    targetStateNetworks={targetStateNetworks}
                    lastRefreshedAt={dataset.generatedAt}
                  />
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
