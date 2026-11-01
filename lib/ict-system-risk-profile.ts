import { buildComplianceHeatmap } from "@/lib/compliance-heatmap";
import type { MeasuresSettings } from "@/lib/measures-settings";
import { isRealNetworkId } from "@/lib/network-scope";
import { applyAssetFilters, filterSystems } from "@/lib/selectors";
import { scopeIds } from "@/lib/workspace-navigation";
import { compareRiskRows, groupRiskItems, riskProfileHref, summarizeRiskAssets, summarizeRiskFindings } from "@/lib/risk-profile";
import type { SeverityDefinition, SpiDefinition } from "@/lib/spi-definitions";
import type { AnalyticsResult, Dataset, Filters } from "@/lib/types";

export function ictSystemRiskHref(path: string, filters: Filters, snapshotDate: string, systemId?: string, extra: Record<string, string> = {}): string {
  return riskProfileHref(path, filters, snapshotDate, "system", systemId, extra);
}

export function buildIctSystemRiskProfile({ dataset, analytics, filters, severityDefinitions, spiDefinitions, measuresSettings }: {
  dataset: Dataset; analytics: AnalyticsResult; filters: Filters; severityDefinitions: SeverityDefinition[]; spiDefinitions: SpiDefinition[]; measuresSettings: MeasuresSettings;
}) {
  const networkIds = scopeIds(filters.managedNetwork);
  const candidateAssets = applyAssetFilters(dataset.assets, dataset.ictSystems, filters);
  const infrastructureSystems = new Set(candidateAssets.map(asset => asset.systemContext?.systemId).filter(Boolean));
  const systems = filterSystems(dataset.ictSystems, { ...filters, managedNetwork: undefined })
    .filter(system => !networkIds.length || networkIds.includes(system.networkId) || infrastructureSystems.has(system.id));
  const systemIds = new Set(systems.map(system => system.id));
  // Match the CI-to-system association used by findings, measures and endpoint drill-throughs.
  const assets = candidateAssets.filter(asset => asset.systemContext && systemIds.has(asset.systemContext.systemId));
  const assetById = new Map(assets.map(asset => [asset.id, asset]));
  const evaluations = analytics.evaluations.filter(evaluation => assetById.has(evaluation.assetId));
  const findings = analytics.findings.filter(finding => assetById.has(finding.scope.assetId));
  const assetsBySystem = groupRiskItems(assets, asset => asset.systemContext!.systemId);
  const evaluationsBySystem = groupRiskItems(evaluations, evaluation => assetById.get(evaluation.assetId)!.systemContext!.systemId);
  const findingsBySystem = groupRiskItems(findings, finding => assetById.get(finding.scope.assetId)!.systemContext!.systemId);
  const networksById = new Map(dataset.managedNetworks.filter(network => isRealNetworkId(network.id)).map(network => [network.id, network]));
  const hostNetworks = (scopedAssets: typeof assets) => [...new Set(scopedAssets.map(asset => asset.networkId))]
    .flatMap(id => networksById.has(id) ? [networksById.get(id)!] : []).sort((a, b) => a.name.localeCompare(b.name));
  const rows = systems.map(system => {
    const systemAssets = assetsBySystem.get(system.id) ?? [];
    const hosts = hostNetworks(systemAssets);
    const assignedNetwork = networksById.get(system.networkId);
    return {
      ...summarizeRiskAssets(systemAssets, evaluationsBySystem.get(system.id) ?? [], findingsBySystem.get(system.id) ?? [], dataset.snapshotDate),
      id: system.id, name: system.name, classification: system.securityDomain,
      criticality: system.criticality, modellingStatus: system.modellingStatus,
      owner: system.owner?.trim() || "Not recorded", description: system.description?.trim() || "",
      context: hosts.length ? hosts.map(network => network.name).join(", ") : assignedNetwork ? `${assignedNetwork.name} (assigned network)` : "No managed network recorded",
      networkCount: hosts.length, atoNumber: system.atoNumber?.trim() || "", diisId: system.diisId?.trim() || ""
    };
  }).sort(compareRiskRows);
  const modelled = systems.filter(system => system.modellingStatus).length;
  const atoProvided = rows.filter(row => row.atoNumber).length;
  const diisProvided = rows.filter(row => row.diisId).length;
  return {
    ...summarizeRiskAssets(assets, evaluations, findings, dataset.snapshotDate),
    ...summarizeRiskFindings(findings, dataset.snapshotDate, severityDefinitions),
    heatmap: buildComplianceHeatmap({ assets, evaluations, spiDefinitions, severityDefinitions, measuresSettings }),
    kind: "system" as const, snapshotDate: dataset.snapshotDate, rows, entityCount: systems.length,
    compliantCount: rows.filter(row => row.status === "Compliant").length,
    systemCount: systems.length, networkCount: hostNetworks(assets).length, modelled, atoProvided, diisProvided,
    metadata: [{ label: "ICT systems modelled", count: modelled, total: systems.length },
      { label: "ATO provided", count: atoProvided, total: systems.length }, { label: "DIIS provided", count: diisProvided, total: systems.length }]
  };
}

export type IctSystemRiskProfileModel = ReturnType<typeof buildIctSystemRiskProfile>;
