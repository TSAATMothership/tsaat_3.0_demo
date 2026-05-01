import { DiscoveryCoverageByToolSection } from "@/components/discovery-coverage-by-tool-section";
import {
  DiscoveryCoverageByNetworkSection,
  type DiscoveryCoverageByNetworkRow
} from "@/components/discovery-coverage-by-network-section";
import { DiscoveryCoverageTabs } from "@/components/discovery-coverage-tabs";
import { DiscoveryToolsSettingsPanel } from "@/components/discovery-tools-settings-panel";
import {
  NetworkDiscoverySummaryTableClient,
  type NetworkDiscoverySummaryTableRow
} from "@/components/network-discovery-summary-table-client";
import { FilterBar } from "@/components/filter-bar";
import { getCoreAppData } from "@/lib/app-data";
import { DiscoveryCoverageValue, evaluateDiscoveryCoverage } from "@/lib/discovery-coverage";
import { buildNetworkTargetStateSummary } from "@/lib/network-target-state";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";
import { resolveNetworkReferenceFields } from "@/lib/network-reference-fields";
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
  const scopedAssets = dataset.assets.filter((asset) => scopedAssetIds.has(asset.id));
  const rows: CoverageRow[] = scopedAssets
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
  const targetStateSummaryByNetworkId = buildNetworkTargetStateSummary(
    networks,
    scopedAssets.map((asset) => ({
      networkId: asset.networkId,
      assetType: asset.type,
      name: asset.name
    }))
  );

  const networkDetailFieldsById = new Map(networks.map((network) => [network.id, resolveNetworkDetailFields(network)]));
  const networkDiscoverySummaryRows: NetworkDiscoverySummaryTableRow[] = networks
    .map((network) => {
      const targetStateSummary = targetStateSummaryByNetworkId.get(network.id)!;
      return {
        id: network.id,
        name: network.name,
        ...networkDetailFieldsById.get(network.id)!,
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

  const managedNetworkById = new Map(dataset.managedNetworks.map((network) => [network.id, network]));
  const byNetworkAggregates = rows.reduce(
    (
      map,
      row
    ) => {
      const current = map.get(row.networkId) ?? {
        assetCount: 0,
        overallCoveredSlots: 0,
        overallApplicableSlots: 0,
        toolCoverage: new Map<string, { covered: number; missing: number; applicable: number }>()
      };
      current.assetCount += 1;

      for (const tool of toolColumns) {
        const value = row.coverage.toolValues[tool.key];
        if (value === null) {
          continue;
        }
        const toolCurrent = current.toolCoverage.get(tool.key) ?? { covered: 0, missing: 0, applicable: 0 };
        toolCurrent.applicable += 1;
        if (value === 1) {
          toolCurrent.covered += 1;
          current.overallCoveredSlots += 1;
        } else {
          toolCurrent.missing += 1;
        }
        current.overallApplicableSlots += 1;
        current.toolCoverage.set(tool.key, toolCurrent);
      }

      map.set(row.networkId, current);
      return map;
    },
    new Map<
      string,
      {
        assetCount: number;
        overallCoveredSlots: number;
        overallApplicableSlots: number;
        toolCoverage: Map<string, { covered: number; missing: number; applicable: number }>;
      }
    >()
  );

  const networkCoverageRows: DiscoveryCoverageByNetworkRow[] = Array.from(byNetworkAggregates.entries())
    .map(([networkId, aggregate]) => {
      const network = managedNetworkById.get(networkId);
      if (!network) {
        return null;
      }
      const details = resolveNetworkDetailFields(network);
      const referenceFields = resolveNetworkReferenceFields(network);
      const toolCoverage = toolColumns.map((tool) => {
        const summary = aggregate.toolCoverage.get(tool.key) ?? { covered: 0, missing: 0, applicable: 0 };
        return {
          toolId: tool.key,
          toolName: tool.label,
          covered: summary.covered,
          missing: summary.missing,
          applicable: summary.applicable,
          coveragePercent: summary.applicable
            ? Number(((summary.covered / summary.applicable) * 100).toFixed(1))
            : 0
        };
      });

      const row = {
        networkId: network.id,
        networkName: network.name,
        securityDomain: network.classification ?? "Unknown",
        modellingStatus: network.modellingStatus ? ("Modelled" as const) : ("Not Modelled" as const),
        discoveryEnabled: network.discoveryStatus === "Discovery Enabled",
        description: details.description,
        owner: details.owner,
        atoNumber: referenceFields.atoNumber,
        diisId: referenceFields.diisId,
        grcUrl: details.grcUrl,
        assetCount: aggregate.assetCount,
        overallCoveredSlots: aggregate.overallCoveredSlots,
        overallApplicableSlots: aggregate.overallApplicableSlots,
        overallCoveragePercent: aggregate.overallApplicableSlots
          ? Number(((aggregate.overallCoveredSlots / aggregate.overallApplicableSlots) * 100).toFixed(1))
          : 0,
        toolCoverage
      };

      return referenceFields.diisHref ? { ...row, diisUrl: referenceFields.diisHref } : row;
    })
    .filter((row): row is DiscoveryCoverageByNetworkRow => Boolean(row))
    .sort((a, b) => a.networkName.localeCompare(b.networkName));

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
                options={filterOptions}
                filters={filters}
                hiddenFields={["systemCriticality"]}
                enableLoadingOverlay
              />
            </div>

            <div
              id="discovery-coverage-summary-slideout-scope"
              className="relative grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2"
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
                className="min-h-0"
              />
            </div>
          </div>
        ) : activeTab === "coverage-by-network" ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            <div className="-mt-4">
              <FilterBar
                options={filterOptions}
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
                options={filterOptions}
                filters={filters}
                hiddenFields={["ictSystem", "environment", "systemCriticality"]}
                enableLoadingOverlay
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
