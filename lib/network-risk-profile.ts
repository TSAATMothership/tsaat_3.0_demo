import { buildComplianceHeatmap } from "@/lib/compliance-heatmap";
import { buildNetworkDetails } from "@/lib/network-details";
import type { MeasuresSettings } from "@/lib/measures-settings";
import { isRealNetworkId } from "@/lib/network-scope";
import { applyAssetFilters } from "@/lib/selectors";
import { matchesSecurityDomain } from "@/lib/security-domain.mjs";
import { scopeIds } from "@/lib/workspace-navigation";
import { compareRiskRows, groupRiskItems, riskProfileHref, summarizeRiskAssets, summarizeRiskFindings } from "@/lib/risk-profile";
import type { SeverityDefinition, SpiDefinition } from "@/lib/spi-definitions";
import type { AnalyticsResult, Dataset, Filters } from "@/lib/types";

export { buildRiskTrend as buildNetworkRiskTrend } from "@/lib/risk-profile";
export function networkRiskHref(path: string, filters: Filters, snapshotDate: string, networkId?: string, extra: Record<string, string> = {}): string {
  return riskProfileHref(path, filters, snapshotDate, "network", networkId, extra);
}

export function buildNetworkRiskProfile({ dataset, analytics, filters, severityDefinitions, spiDefinitions, measuresSettings }: {
  dataset: Dataset; analytics: AnalyticsResult; filters: Filters; severityDefinitions: SeverityDefinition[]; spiDefinitions: SpiDefinition[]; measuresSettings: MeasuresSettings;
}) {
  const networkIds = scopeIds(filters.managedNetwork);
  const systemIds = scopeIds(filters.ictSystem);
  const candidateAssets = applyAssetFilters(dataset.assets, dataset.ictSystems, filters).filter(asset => isRealNetworkId(asset.networkId));
  const systemNetworks = new Set(candidateAssets.map(asset => asset.networkId));
  for (const system of dataset.ictSystems) if (systemIds.includes(system.id)) systemNetworks.add(system.networkId);
  const networks = dataset.managedNetworks.filter(network => matchesSecurityDomain(network.securityDomain, filters.securityDomain) && isRealNetworkId(network.id)
    && (!networkIds.length || networkIds.includes(network.id)) && (!systemIds.length || systemNetworks.has(network.id)));
  const scopedNetworkIds = new Set(networks.map(network => network.id));
  const assets = candidateAssets.filter(asset => scopedNetworkIds.has(asset.networkId));
  const assetIds = new Set(assets.map(asset => asset.id));
  const evaluations = analytics.evaluations.filter(evaluation => assetIds.has(evaluation.assetId) && scopedNetworkIds.has(evaluation.networkId));
  const findings = analytics.findings.filter(finding => assetIds.has(finding.scope.assetId) && scopedNetworkIds.has(finding.scope.networkId));
  const assetsByNetwork = groupRiskItems(assets, asset => asset.networkId);
  const evaluationsByNetwork = groupRiskItems(evaluations, evaluation => evaluation.networkId);
  const findingsByNetwork = groupRiskItems(findings, finding => finding.scope.networkId);
  const systemsByAsset = new Map<string, Set<string>>();
  const addSystem = (assetId: string, systemId: string) => {
    if (!assetIds.has(assetId) || (systemIds.length && !systemIds.includes(systemId))) return;
    const ids = systemsByAsset.get(assetId) ?? new Set<string>();
    ids.add(systemId);
    systemsByAsset.set(assetId, ids);
  };
  for (const asset of assets) if (asset.systemContext) addSystem(asset.id, asset.systemContext.systemId);
  for (const system of dataset.ictSystems) for (const environment of system.environments) {
    for (const assetId of environment.assetIds) addSystem(assetId, system.id);
  }
  const systemCount = (scopedAssets: typeof assets) => new Set(scopedAssets.flatMap(asset => [...(systemsByAsset.get(asset.id) ?? [])])).size;
  const systemsById = new Map(dataset.ictSystems.map(system => [system.id, system]));
  const systemsByNetwork = groupRiskItems(dataset.ictSystems, system => system.networkId);
  const rows = networks.map(network => {
    const networkAssets = assetsByNetwork.get(network.id) ?? [];
    const linkedSystemIds = new Set([
      ...network.ictSystemIds,
      ...(systemsByNetwork.get(network.id) ?? []).map(system => system.id),
      ...networkAssets.flatMap(asset => [...(systemsByAsset.get(asset.id) ?? [])])
    ]);
    const linkedSystems = [...linkedSystemIds].filter(id => !systemIds.length || systemIds.includes(id))
      .flatMap(id => { const system = systemsById.get(id); return system ? [system] : []; });
    return {
      ...summarizeRiskAssets(networkAssets, evaluationsByNetwork.get(network.id) ?? [], findingsByNetwork.get(network.id) ?? [], dataset.snapshotDate),
      id: network.id, name: network.name, securityDomain: network.securityDomain, classification: network.classification?.trim() || "Not recorded",
      criticality: network.criticality, modellingStatus: network.modellingStatus, discoveryStatus: network.discoveryStatus,
      owner: network.owner?.trim() || "Not recorded", description: network.description?.trim() || "",
      context: network.discoveryStatus, systemCount: systemCount(networkAssets),
      networkDetails: buildNetworkDetails(network, networkAssets, linkedSystems)
    };
  }).sort(compareRiskRows);
  const modelled = networks.filter(network => network.modellingStatus).length;
  const discoveryEnabled = networks.filter(network => network.discoveryStatus === "Discovery Enabled").length;
  const compliantNetworks = rows.filter(row => row.status === "Compliant").length;
  return {
    ...summarizeRiskAssets(assets, evaluations, findings, dataset.snapshotDate),
    ...summarizeRiskFindings(findings, dataset.snapshotDate, severityDefinitions),
    heatmap: buildComplianceHeatmap({ assets, evaluations, spiDefinitions, severityDefinitions, measuresSettings }),
    kind: "network" as const, snapshotDate: dataset.snapshotDate, rows,
    entityCount: networks.length, compliantCount: compliantNetworks,
    networkCount: networks.length, systemCount: systemCount(assets), modelled, discoveryEnabled, compliantNetworks,
    metadata: [{ label: "networks modelled", count: modelled, total: networks.length },
      { label: "discovery enabled", count: discoveryEnabled, total: networks.length }]
  };
}

export type NetworkRiskProfileModel = ReturnType<typeof buildNetworkRiskProfile>;
export type NetworkRiskRow = NetworkRiskProfileModel["rows"][number];
