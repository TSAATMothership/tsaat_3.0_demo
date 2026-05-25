import { buildAnalytics } from "@/lib/analytics";
import { ASSET_TYPES, formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { evaluateDiscoveryCoverage, type DiscoveryCoverageValue } from "@/lib/discovery-coverage";
import { type DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { isUnassignedNetworkId } from "@/lib/discovery-filter-scope";
import { type MeasuresSettings } from "@/lib/measures-settings";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";
import { resolveNetworkReferenceFields } from "@/lib/network-reference-fields";
import { buildNetworkTargetStateSummary, type NetworkTargetStateCellState } from "@/lib/network-target-state";
import type { SpiDefinition } from "@/lib/spi-definitions";
import type { Asset, AssetType, Dataset, Filters, ManagedNetwork } from "@/lib/types";

export interface NetworkDiscoveryToolCoverageRow {
  toolId: string;
  toolName: string;
  covered: number;
  missing: number;
  applicable: number;
  coveragePercent: number;
}

export interface NetworkDiscoveryTargetStateRow {
  assetType: AssetType;
  assetTypeLabel: string;
  targetTotal: number;
  discoveredTotal: number;
  matchedTotal: number;
  coveragePercent: number;
  status: string;
}

export interface NetworkDiscoveryAssetReportRow {
  assetId: string;
  name: string;
  hostname: string;
  assetType: AssetType;
  assetTypeLabel: string;
  ipAddress: string;
  systemName: string;
  environment: string;
  missingTools: string[];
  coverageStatus: "Complete" | "Gaps";
}

export interface NetworkDiscoveryReportModel {
  reportName: string;
  snapshotDate: string;
  filterText: string;
  network: {
    id: string;
    name: string;
    description: string;
    atoNumber: string;
    diisId: string;
    modellingStatus: "Modelled" | "Not Modelled";
  };
  summary: {
    assetsInScope: number;
    coverageCompliantAssets: number;
    assetsWithCoverageGaps: number;
    overallToolCoveragePercent: number;
  };
  targetStateRows: NetworkDiscoveryTargetStateRow[];
  toolCoverageRows: NetworkDiscoveryToolCoverageRow[];
  discoveredAssets: NetworkDiscoveryAssetReportRow[];
  assetsNotDiscovered: NetworkDiscoveryAssetReportRow[];
}

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(1));
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
  return value && String(value).trim() ? String(value).trim() : "N/A";
}

function targetStateStatusLabel(state: NetworkTargetStateCellState): string {
  switch (state) {
    case "ok":
      return "Matched";
    case "target-missing":
      return "Target State Missing";
    case "discovery-missing":
      return "Discovery Missing";
    case "target-and-discovery-missing":
      return "Target State Missing + Discovery Missing";
  }
}

export function formatNetworkDiscoveryFilterScope(filters: Filters): string {
  const parts = [
    `Network=${filters.managedNetwork ?? "All"}`,
    `ICT System=${filters.ictSystem ?? "All"}`,
    `Criticality=${filters.systemCriticality ?? "All"}`,
    `Security Domain=${filters.securityDomain ?? "All"}`,
    `Environment=${filters.environment ?? "All"}`,
    `Asset Type=${filters.assetType ?? "All"}`,
    `Severity=${filters.severity ?? "All"}`,
    `Mission Capability=${filters.missionCapability ?? "All"}`,
    `Business Service=${filters.businessService ?? "All"}`
  ];

  return parts.join(" | ");
}

export function buildNetworkDiscoveryReportModel({
  dataset,
  discoveryToolsSettings,
  networkId,
  filters = {},
  measuresSettings,
  spiDefinitions
}: {
  dataset: Dataset;
  discoveryToolsSettings: DiscoveryToolsSettings;
  networkId: string;
  filters?: Filters;
  measuresSettings: MeasuresSettings;
  spiDefinitions: SpiDefinition[];
}): NetworkDiscoveryReportModel | null {
  if (isUnassignedNetworkId(networkId)) {
    return null;
  }

  const network = dataset.managedNetworks.find((candidate) => candidate.id === networkId);
  if (!network) {
    return null;
  }

  const reportFilters: Filters = { ...filters, managedNetwork: networkId };
  const analytics = buildAnalytics(
    dataset,
    dataset.ictSystems,
    reportFilters,
    spiDefinitions,
    measuresSettings,
    discoveryToolsSettings
  );
  const scopedAssetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
  const scopedAssets = dataset.assets.filter((asset) => scopedAssetIds.has(asset.id));
  const toolColumns = discoveryToolsSettings.tools.map((tool) => ({ key: tool.id, label: tool.name }));
  const systemNameById = new Map(dataset.ictSystems.map((system) => [system.id, system.name]));

  const discoveredAssets = scopedAssets
    .map((asset) => {
      const coverage = evaluateDiscoveryCoverage(asset, discoveryToolsSettings);
      const systemId = asset.systemContext?.systemId;
      const missingTools = [...coverage.missingToolNames].sort((a, b) => a.localeCompare(b));
      return {
        assetId: asset.id,
        name: asset.name,
        hostname: asset.hostname,
        assetType: asset.type,
        assetTypeLabel: formatAssetTypeLabel(asset.type),
        ipAddress: resolveAssetIpAddress(asset),
        systemName: systemId ? (systemNameById.get(systemId) ?? systemId) : "-",
        environment: asset.systemContext?.environmentType ?? "-",
        missingTools,
        coverageStatus: coverage.coverageCompliance ? "Complete" : "Gaps"
      } satisfies NetworkDiscoveryAssetReportRow;
    })
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const assetsNotDiscovered = discoveredAssets.filter((asset) => asset.coverageStatus === "Gaps");
  const overallToolSlots = discoveredAssets.reduce((total, asset) => {
    const sourceAsset = scopedAssets.find((candidate) => candidate.id === asset.assetId);
    if (!sourceAsset) {
      return total;
    }
    const coverage = evaluateDiscoveryCoverage(sourceAsset, discoveryToolsSettings);
    return total + Object.values(coverage.toolValues).filter((value): value is Exclude<DiscoveryCoverageValue, null> => value !== null).length;
  }, 0);
  const overallCoveredToolSlots = discoveredAssets.reduce((total, asset) => {
    const sourceAsset = scopedAssets.find((candidate) => candidate.id === asset.assetId);
    if (!sourceAsset) {
      return total;
    }
    const coverage = evaluateDiscoveryCoverage(sourceAsset, discoveryToolsSettings);
    return total + Object.values(coverage.toolValues).filter((value) => value === 1).length;
  }, 0);

  const toolCoverageRows = toolColumns.map((tool) => {
    const values = scopedAssets.map((asset) => evaluateDiscoveryCoverage(asset, discoveryToolsSettings).toolValues[tool.key]);
    const applicable = values.filter((value) => value !== null).length;
    const covered = values.filter((value) => value === 1).length;
    const missing = values.filter((value) => value === 0).length;
    return {
      toolId: tool.key,
      toolName: tool.label,
      covered,
      missing,
      applicable,
      coveragePercent: toPercent(covered, applicable)
    };
  });

  const targetStateSummary = buildNetworkTargetStateSummary(
    [network as Pick<ManagedNetwork, "id" | "targetStateAssets">],
    scopedAssets.map((asset) => ({
      networkId: asset.networkId,
      assetType: asset.type,
      name: asset.name
    }))
  ).get(network.id);

  const targetStateRows = ASSET_TYPES.map((assetType) => {
    const summary = targetStateSummary?.byAssetType[assetType];
    return {
      assetType,
      assetTypeLabel: formatAssetTypeLabel(assetType),
      targetTotal: summary?.targetTotal ?? 0,
      discoveredTotal: summary?.discoveredSetTotal ?? 0,
      matchedTotal: summary?.discoveredTotal ?? 0,
      coveragePercent: summary?.coveragePercent ?? 0,
      status: summary ? targetStateStatusLabel(summary.state) : "Target State Missing + Discovery Missing"
    };
  });

  const detailFields = resolveNetworkDetailFields(network);
  const referenceFields = resolveNetworkReferenceFields(network);

  return {
    reportName: `Network Discovery Tools Gaps Report - ${network.name}`,
    snapshotDate: dataset.snapshotDate,
    filterText: formatNetworkDiscoveryFilterScope(reportFilters),
    network: {
      id: network.id,
      name: network.name,
      description: detailFields.description,
      atoNumber: referenceFields.atoNumber,
      diisId: referenceFields.diisId,
      modellingStatus: network.modellingStatus ? "Modelled" : "Not Modelled"
    },
    summary: {
      assetsInScope: discoveredAssets.length,
      coverageCompliantAssets: discoveredAssets.length - assetsNotDiscovered.length,
      assetsWithCoverageGaps: assetsNotDiscovered.length,
      overallToolCoveragePercent: toPercent(overallCoveredToolSlots, overallToolSlots)
    },
    targetStateRows,
    toolCoverageRows,
    discoveredAssets,
    assetsNotDiscovered
  };
}
