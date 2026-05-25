import { DiscoveryCoverageByToolSection } from "@/components/discovery-coverage-by-tool-section";
import { DiscoveryCoverageByNetworkSection } from "@/components/discovery-coverage-by-network-section";
import { DiscoveryCoverageTabs } from "@/components/discovery-coverage-tabs";
import { DiscoveryToolsSettingsPanel } from "@/components/discovery-tools-settings-panel";
import {
  NetworkDiscoverySummaryTableClient,
  type NetworkDiscoverySummaryTableRow
} from "@/components/network-discovery-summary-table-client";
import { FilterBar } from "@/components/filter-bar";
import { getCoreAppData } from "@/lib/app-data";
import { buildDiscoveryCoverageByNetworkRows } from "@/lib/discovery-coverage-by-network-rows";
import {
  discoveryCoverageByAssetId,
  discoveryCoverageForAssetId,
  DiscoveryCoverageValue
} from "@/lib/discovery-coverage";
import {
  filterDiscoveryAssets,
  filterDiscoveryNetworks,
  filterDiscoveryNetworksByStatus,
  normalizeDiscoveryEnabled,
  normalizeDiscoveryNetworkModellingStatus,
  removeUnassignedNetworkOption,
  sanitizeDiscoverySearchParams
} from "@/lib/discovery-filter-scope";
import { buildNetworkTargetStateSummary } from "@/lib/network-target-state";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";
import { Asset } from "@/lib/types";

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

export default async function DiscoveryCoveragePage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const requestedTab = firstParam(searchParams.discoveryCoverageTab)?.trim().toLowerCase();
  const activeTab: "summary" | "coverage-by-network" | "tool-settings" | "target-state" =
    requestedTab === "target-state"
      ? "target-state"
      : requestedTab === "coverage-by-network"
        ? "coverage-by-network"
      : requestedTab === "tool-settings"
        ? "tool-settings"
        : "summary";

  const discoveryDataSearchParams: Record<string, string | string[] | undefined> =
    sanitizeDiscoverySearchParams(searchParams);
  delete discoveryDataSearchParams.criticality;
  if (activeTab === "target-state") {
    delete discoveryDataSearchParams.system;
    delete discoveryDataSearchParams.environment;
  }

  const { dataset, analytics, filters, filterOptions, networks, discoveryToolsSettings } = await getCoreAppData(
    discoveryDataSearchParams,
    { profile: "summary" }
  );
  const discoveryNetworks = filterDiscoveryNetworks(networks);
  const modellingStatusFilter = normalizeDiscoveryNetworkModellingStatus(searchParams.modellingStatus);
  const discoveryEnabledFilter = normalizeDiscoveryEnabled(searchParams.discoveryEnabled);
  const targetStateNetworks = filterDiscoveryNetworksByStatus(discoveryNetworks, {
    modellingStatus: modellingStatusFilter,
    discoveryEnabled: discoveryEnabledFilter
  });
  const discoveryFilterOptions = removeUnassignedNetworkOption(filterOptions);
  const toolColumns = discoveryToolsSettings.tools.map((tool) => ({ key: tool.id, label: tool.name }));

  const scopedAssetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
  const scopedAssets = filterDiscoveryAssets(dataset.assets.filter((asset) => scopedAssetIds.has(asset.id)));
  const storedDiscoveryCoverageByAsset = discoveryCoverageByAssetId(dataset.discoveryCoverageEvaluations);
  const rows: CoverageRow[] = scopedAssets
    .map((asset) => {
      const coverage = discoveryCoverageForAssetId(asset.id, storedDiscoveryCoverageByAsset);
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
  const targetStateSummaryByNetworkId = buildNetworkTargetStateSummary(
    targetStateNetworks,
    scopedAssets.map((asset) => ({
      networkId: asset.networkId,
      assetType: asset.type,
      name: asset.name
    }))
  );

  const networkDetailFieldsById = new Map(
    targetStateNetworks.map((network) => [network.id, resolveNetworkDetailFields(network)])
  );
  const networkDiscoverySummaryRows: NetworkDiscoverySummaryTableRow[] = targetStateNetworks
    .map((network) => {
      const targetStateSummary = targetStateSummaryByNetworkId.get(network.id)!;
      return {
        id: network.id,
        name: network.name,
        ...networkDetailFieldsById.get(network.id)!,
        modellingStatus: network.modellingStatus
          ? ("Modelled" as NetworkDiscoverySummaryTableRow["modellingStatus"])
          : ("Not Modelled" as NetworkDiscoverySummaryTableRow["modellingStatus"]),
        discoveryEnabled:
          network.discoveryStatus === "Discovery Enabled"
            ? ("Enabled" as NetworkDiscoverySummaryTableRow["discoveryEnabled"])
            : ("Not Enabled" as NetworkDiscoverySummaryTableRow["discoveryEnabled"]),
        targetStateProvided: targetStateSummary.targetStateProvided
          ? ("Yes" as NetworkDiscoverySummaryTableRow["targetStateProvided"])
          : ("No" as NetworkDiscoverySummaryTableRow["targetStateProvided"]),
        targetStateByAssetType: targetStateSummary.byAssetType
      };
    })
    .sort((a, b) => {
      if (a.discoveryEnabled !== b.discoveryEnabled) {
        return a.discoveryEnabled === "Enabled" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  const networkCoverageRows = buildDiscoveryCoverageByNetworkRows({
    networks: discoveryNetworks,
    coverageRows: rows,
    toolColumns
  });

  return (
    <div className="relative left-1/2 -my-5 flex h-[calc(100vh-11rem)] w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden md:-my-8 md:h-[calc(100vh-12rem)] md:w-[min(2100px,calc(100vw-3rem))]">
      <section className="panel shrink-0 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Discovery Coverage View</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">Discovery</h1>
      </section>

      <DiscoveryCoverageTabs activeTab={activeTab} />

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "summary" ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            <div className="-mt-4">
              <FilterBar
                options={discoveryFilterOptions}
                filters={filters}
                hiddenFields={["systemCriticality"]}
                enableLoadingOverlay
              />
            </div>

            <div
              id="discovery-coverage-summary-slideout-scope"
              className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2"
            >
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
                className="min-h-0"
              />
            </div>
          </div>
        ) : activeTab === "coverage-by-network" ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            <div className="-mt-4">
              <FilterBar
                options={discoveryFilterOptions}
                filters={filters}
                hiddenFields={["ictSystem", "systemCriticality"]}
                enableLoadingOverlay
                actions={
                  <div className="flex min-w-[170px] flex-col gap-1">
                    <span aria-hidden className="text-[11px] uppercase tracking-[0.14em] text-transparent">
                      Totals
                    </span>
                    <div className="inline-flex h-[42px] items-center rounded-md border border-sky-300/35 bg-sky-500/15 px-3 text-sm text-sky-100">
                      Total Network:{" "}
                      <span className="ml-1 font-semibold text-sky-50">{networkCoverageRows.length}</span>
                    </div>
                  </div>
                }
              />
            </div>
            <div className="min-h-0">
              <DiscoveryCoverageByNetworkSection rows={networkCoverageRows} />
            </div>
          </div>
        ) : activeTab === "tool-settings" ? (
          <div className="h-full min-h-0">
            <DiscoveryToolsSettingsPanel initialSettings={discoveryToolsSettings} />
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            <div className="-mt-4">
              <FilterBar
                options={discoveryFilterOptions}
                filters={filters}
                hiddenFields={["ictSystem", "environment", "systemCriticality"]}
                enableLoadingOverlay
                extraSelectFields={[
                  {
                    key: "modellingStatus",
                    label: "Modelling Status",
                    value: modellingStatusFilter,
                    options: [
                      { id: "modelled", label: "Modelled" },
                      { id: "not-modelled", label: "Not Modelled" }
                    ]
                  },
                  {
                    key: "discoveryEnabled",
                    label: "Discovery Enabled",
                    value: discoveryEnabledFilter,
                    options: [
                      { id: "enabled", label: "Enabled" },
                      { id: "not-enabled", label: "Not Enabled" }
                    ]
                  }
                ]}
                actions={
                  <div className="flex min-w-[170px] flex-col gap-1">
                    <span aria-hidden className="text-[11px] uppercase tracking-[0.14em] text-transparent">
                      Totals
                    </span>
                    <div className="inline-flex h-[42px] items-center rounded-md border border-sky-300/35 bg-sky-500/15 px-3 text-sm text-sky-100">
                      Total Network:{" "}
                      <span className="ml-1 font-semibold text-sky-50">{networkDiscoverySummaryRows.length}</span>
                    </div>
                  </div>
                }
              />
            </div>
            <section className="panel flex min-h-0 flex-col overflow-hidden">
              <h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
                Network Discovery Summary
              </h2>
              <NetworkDiscoverySummaryTableClient rows={networkDiscoverySummaryRows} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
