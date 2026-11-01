import { buildHighRiskCveIndexByAssetId } from "@/lib/cve";
import { applyAssetFilters, filterSystems } from "@/lib/selectors";
import { findingDurationDays } from "@/lib/findings-duration";
import { scopeIds } from "@/lib/workspace-navigation";
import type { SpiDefinition, SeverityDefinition } from "@/lib/spi-definitions";
import type { AnalyticsResult, Asset, Criticality, Dataset, Filters, HighRiskCveDetail } from "@/lib/types";

export interface ServiceImpactEntity {
  id: string; name: string; criticality: Criticality; systemIds: string[];
}
export interface ServiceImpactSystem { id: string; name: string; criticality: Criticality; appId: string }
export interface ServiceImpactAsset {
  id: string; name: string; ip: string; model: string; lastDiscovered: string; discoveredBy: string;
  type: Asset["type"]; systemId: string; systemName: string; environment: string; securityDomain: string;
  vulnerabilities: HighRiskCveDetail[];
}
export interface ServiceImpactFinding {
  id: string; spiId: number; spiName: string; title: string; priority: number; severity: string;
  assetId: string; systemId: string; environment: string; timestamp: string; duration: number | null;
  recommendedAction: string;
}
export interface ServiceImpactModel {
  snapshotDate: string; systems: ServiceImpactSystem[]; business: ServiceImpactEntity[]; mission: ServiceImpactEntity[];
  assets: ServiceImpactAsset[]; findings: ServiceImpactFinding[]; unattributedFindings: number;
  severities: Array<{ key: string; label: string }>;
}
export interface ServiceImpactCounts {
  findings: number; critical: number; high: number; affectedCis: number; severities: Record<string, number>;
}
export type ServiceImpactRow = ServiceImpactEntity & ServiceImpactCounts;

export function impactCounts(findings: ServiceImpactFinding[]): ServiceImpactCounts {
  const severities: Record<string, number> = {};
  for (const finding of findings) severities[finding.severity] = (severities[finding.severity] ?? 0) + 1;
  return { findings: findings.length, critical: severities["Critical Exposure"] ?? 0, high: severities["High Risk"] ?? 0,
    affectedCis: new Set(findings.map(finding => finding.assetId)).size, severities };
}

export const compareServiceImpact = (a: ServiceImpactCounts & { name: string }, b: ServiceImpactCounts & { name: string }) =>
  b.critical - a.critical || b.high - a.high || b.findings - a.findings || a.name.localeCompare(b.name, "en-AU", { numeric: true });

/** Counts use each finding and CI once within an entity; related entities may share the same finding. */
export function serviceImpactRows(entities: ServiceImpactEntity[], findings: ServiceImpactFinding[], systemIds?: string[]): ServiceImpactRow[] {
  const allowed = systemIds ? new Set(systemIds) : null;
  const bySystem = new Map<string, ServiceImpactFinding[]>();
  for (const finding of findings) {
    if (allowed && !allowed.has(finding.systemId)) continue;
    const rows = bySystem.get(finding.systemId) ?? []; rows.push(finding); bySystem.set(finding.systemId, rows);
  }
  return entities.map(entity => {
    const ids = [...new Set(entity.systemIds)].filter(id => !allowed || allowed.has(id));
    const unique = new Map(ids.flatMap(id => bySystem.get(id) ?? []).map(finding => [finding.id, finding]));
    return { ...entity, systemIds: ids, ...impactCounts([...unique.values()]) };
  }).filter(entity => !allowed || entity.systemIds.length > 0).sort(compareServiceImpact);
}

export function selectServiceImpact(model: ServiceImpactModel, systemIds: string[]) {
  const allowed = new Set(systemIds);
  const findings = model.findings.filter(finding => allowed.has(finding.systemId));
  return { findingRows: findings, assets: model.assets.filter(asset => allowed.has(asset.systemId)), ...impactCounts(findings),
    business: serviceImpactRows(model.business, findings, systemIds), mission: serviceImpactRows(model.mission, findings, systemIds) };
}

export function buildServiceImpactModel({ dataset, analytics, filters, spiDefinitions, severityDefinitions }: {
  dataset: Dataset; analytics: Pick<AnalyticsResult, "findings">; filters: Filters;
  spiDefinitions: SpiDefinition[]; severityDefinitions: SeverityDefinition[];
}): ServiceImpactModel {
  const candidates = applyAssetFilters(dataset.assets, dataset.ictSystems, filters);
  const infrastructureSystems = new Set(candidates.map(asset => asset.systemContext?.systemId).filter(Boolean));
  const networkIds = scopeIds(filters.managedNetwork);
  const systems = filterSystems(dataset.ictSystems, { ...filters, managedNetwork: undefined })
    .filter(system => !networkIds.length || networkIds.includes(system.networkId) || infrastructureSystems.has(system.id));
  const systemsById = new Map(systems.map(system => [system.id, system]));
  const assets = candidates.filter(asset => asset.systemContext && systemsById.has(asset.systemContext.systemId));
  const assetsById = new Map(assets.map(asset => [asset.id, asset]));
  const candidateIds = new Set(candidates.map(asset => asset.id));
  const definitions = new Map(spiDefinitions.map(spi => [spi.spiId, spi]));
  const cves = buildHighRiskCveIndexByAssetId(assets);
  const open = [...new Map(analytics.findings.filter(finding => finding.status === "open" && candidateIds.has(finding.scope.assetId))
    .map(finding => [finding.id, finding])).values()];
  const findings = open.flatMap(finding => {
    const asset = assetsById.get(finding.scope.assetId);
    if (!asset?.systemContext) return [];
    return [{ id: finding.id, spiId: finding.spiId, spiName: definitions.get(finding.spiId)?.name ?? `SPI-${finding.spiId}`,
      title: finding.title, priority: finding.priorityRank, severity: finding.severity, assetId: asset.id,
      systemId: asset.systemContext.systemId, environment: asset.systemContext.environmentType ?? "Unassigned",
      timestamp: finding.timestamp, duration: findingDurationDays(finding, dataset.snapshotDate), recommendedAction: finding.recommendedAction }];
  });
  const entities = (key: "businessServices" | "missionCapabilities") => {
    const map = new Map<string, ServiceImpactEntity>();
    for (const system of systems) for (const entity of system[key]) {
      const row = map.get(entity.id) ?? { id: entity.id, name: entity.name, criticality: entity.criticality, systemIds: [] };
      if (!row.systemIds.includes(system.id)) row.systemIds.push(system.id);
      if (entity.criticality === "Critical") row.criticality = "Critical";
      map.set(entity.id, row);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  };
  const severities = [...severityDefinitions].sort((a, b) => a.displayOrder - b.displayOrder)
    .map(severity => ({ key: severity.severityKey, label: severity.label }));
  for (const finding of findings) if (!severities.some(severity => severity.key === finding.severity))
    severities.push({ key: finding.severity, label: finding.severity });
  return { snapshotDate: dataset.snapshotDate,
    systems: systems.map(system => ({ id: system.id, name: system.name, criticality: system.criticality, appId: system.apmNumber?.trim() || "" })),
    business: entities("businessServices"), mission: entities("missionCapabilities"), findings, severities,
    unattributedFindings: open.length - findings.length,
    assets: assets.map(asset => ({ id: asset.id, name: asset.name || asset.hostname || asset.id,
      ip: asset.ipAddress?.trim() || "Not provided", model: asset.deviceModel?.trim() || "Not provided",
      lastDiscovered: asset.lastDiscoveredDate?.trim() || "Not provided", discoveredBy: asset.discoveredBy?.trim() || "Not provided",
      type: asset.type, systemId: asset.systemContext!.systemId, systemName: systemsById.get(asset.systemContext!.systemId)!.name,
      environment: asset.systemContext!.environmentType ?? "Unassigned", securityDomain: asset.securityDomain,
      vulnerabilities: cves[asset.id] ?? [] })) };
}
