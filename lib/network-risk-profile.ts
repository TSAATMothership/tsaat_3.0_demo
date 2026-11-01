import { findingDurationDays, findingsByDuration } from "@/lib/findings-duration";
import { isRealNetworkId } from "@/lib/network-scope";
import { applyAssetFilters } from "@/lib/selectors";
import { measuresScopeParams } from "@/lib/measures-explorer";
import { scopeIds } from "@/lib/workspace-navigation";
import type { SeverityDefinition } from "@/lib/spi-definitions";
import type { AnalyticsResult, ComplianceStatus, Dataset, Finding, Filters } from "@/lib/types";

const DAY = 86_400_000;
const percent = (part: number, total: number) => total ? Math.round(part / total * 1000) / 10 : null;

function assessments(statuses: ComplianceStatus[]) {
  const compliant = statuses.filter(status => status === "Compliant").length;
  const nonCompliant = statuses.filter(status => status === "Non-compliant").length;
  const unknown = statuses.length - compliant - nonCompliant;
  return { compliant, nonCompliant, unknown, total: statuses.length, percent: percent(compliant, statuses.length) };
}

function dayNumber(timestamp?: string | null): number | null {
  if (!timestamp) return null;
  const value = Date.parse(timestamp);
  return Number.isFinite(value) ? Math.floor(value / DAY) : null;
}

function groupByNetwork<T>(items: T[], networkId: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const id = networkId(item);
    const group = groups.get(id) ?? [];
    group.push(item);
    groups.set(id, group);
  }
  return groups;
}

/** Reconstruct recorded open findings, with closure effective on the recorded UTC date. */
export function buildNetworkRiskTrend(findings: Finding[], snapshotDate: string) {
  const end = dayNumber(snapshotDate)!;
  const start = end - 364;
  const events = { critical: new Map<number, number>(), high: new Map<number, number>() };
  let undated = 0;
  for (const finding of findings) {
    const series = finding.severity === "Critical Exposure" ? events.critical : finding.severity === "High Risk" ? events.high : null;
    if (!series) continue;
    const opened = dayNumber(finding.timestamp);
    const closed = finding.status === "closed" ? dayNumber(finding.closedTimestamp) : null;
    if (opened === null || (finding.status === "closed" && (closed === null || closed < opened))) { undated += 1; continue; }
    if (opened > end || (closed !== null && closed < start)) continue;
    const first = Math.max(start, opened);
    series.set(first, (series.get(first) ?? 0) + 1);
    if (closed !== null && closed <= end) series.set(closed, (series.get(closed) ?? 0) - 1);
  }
  let critical = 0;
  let high = 0;
  const points = Array.from({ length: 365 }, (_, offset) => {
    const day = start + offset;
    critical += events.critical.get(day) ?? 0;
    high += events.high.get(day) ?? 0;
    return { date: new Date(day * DAY).toISOString().slice(0, 10), critical, high };
  });
  return { points, undated };
}

export function networkRiskHref(path: string, filters: Filters, snapshotDate: string, networkId?: string, extra: Record<string, string> = {}): string {
  const params = measuresScopeParams(filters, snapshotDate);
  if (networkId) params.set("network", networkId);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `${path}?${params}`;
}

export function buildNetworkRiskProfile({ dataset, analytics, filters, severityDefinitions }: {
  dataset: Dataset; analytics: AnalyticsResult; filters: Filters; severityDefinitions: SeverityDefinition[];
}) {
  const networkIds = scopeIds(filters.managedNetwork);
  const systemIds = scopeIds(filters.ictSystem);
  const candidateAssets = applyAssetFilters(dataset.assets, dataset.ictSystems, filters).filter(asset => isRealNetworkId(asset.networkId));
  const systemNetworks = new Set(candidateAssets.map(asset => asset.networkId));
  for (const system of dataset.ictSystems) if (systemIds.includes(system.id)) systemNetworks.add(system.networkId);
  const networks = dataset.managedNetworks.filter(network => isRealNetworkId(network.id)
    && (!networkIds.length || networkIds.includes(network.id)) && (!systemIds.length || systemNetworks.has(network.id)));
  const scopedNetworkIds = new Set(networks.map(network => network.id));
  const assets = candidateAssets.filter(asset => scopedNetworkIds.has(asset.networkId));
  const assetIds = new Set(assets.map(asset => asset.id));
  const evaluations = analytics.evaluations.filter(evaluation => assetIds.has(evaluation.assetId) && scopedNetworkIds.has(evaluation.networkId));
  const evaluationById = new Map(evaluations.map(evaluation => [evaluation.assetId, evaluation]));
  const findings = analytics.findings.filter(finding => assetIds.has(finding.scope.assetId) && scopedNetworkIds.has(finding.scope.networkId));
  const open = findings.filter(finding => finding.status === "open");
  const assetsByNetwork = groupByNetwork(assets, asset => asset.networkId);
  const evaluationsByNetwork = groupByNetwork(evaluations, evaluation => evaluation.networkId);
  const findingsByNetwork = groupByNetwork(open, finding => finding.scope.networkId);
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
  const unassessedCis = (scopedAssets: typeof assets) => scopedAssets.filter(asset => !evaluationById.get(asset.id)?.evaluations.length).length;
  const discoveryStatuses = (scopedAssets: typeof assets): ComplianceStatus[] => scopedAssets.map(asset => {
    const evaluation = evaluationById.get(asset.id);
    return !evaluation ? "Unknown" : evaluation.discoveryCoverageCompliant ? "Compliant" : "Non-compliant";
  });
  const rows = networks.map(network => {
    const networkAssets = assetsByNetwork.get(network.id) ?? [];
    const networkEvaluations = evaluationsByNetwork.get(network.id) ?? [];
    const networkFindings = findingsByNetwork.get(network.id) ?? [];
    const spi = assessments(networkEvaluations.flatMap(evaluation => evaluation.evaluations.map(item => item.status)));
    const discovery = assessments(discoveryStatuses(networkAssets));
    const ages = networkFindings.map(finding => findingDurationDays(finding, dataset.snapshotDate)).filter((age): age is number => age !== null);
    return {
      id: network.id, name: network.name, classification: network.classification?.trim() || "Not recorded",
      criticality: network.criticality, modellingStatus: network.modellingStatus, discoveryStatus: network.discoveryStatus,
      owner: network.owner?.trim() || "Not recorded", description: network.description?.trim() || "",
      ciCount: networkAssets.length, systemCount: systemCount(networkAssets), unassessedCis: unassessedCis(networkAssets),
      spi, discovery, status: !spi.total ? "No assessments" : spi.nonCompliant ? "Non-compliant" : spi.unknown || unassessedCis(networkAssets) ? "Unknown" : "Compliant",
      openFindings: networkFindings.length,
      critical: networkFindings.filter(finding => finding.severity === "Critical Exposure").length,
      high: networkFindings.filter(finding => finding.severity === "High Risk").length,
      overdue: ages.filter(age => age > 90).length,
      oldestDays: ages.length ? ages.reduce((maximum, age) => Math.max(maximum, age), 0) : null
    };
  }).sort((a, b) => b.critical - a.critical || b.high - a.high || b.overdue - a.overdue || b.openFindings - a.openFindings || a.name.localeCompare(b.name));
  const severities = [...severityDefinitions].sort((a, b) => a.displayOrder - b.displayOrder).map(definition => ({ key: definition.severityKey, label: definition.label, count: 0 }));
  for (const finding of open) {
    let severity = severities.find(item => item.key === finding.severity);
    if (!severity) { severity = { key: finding.severity, label: finding.severity, count: 0 }; severities.push(severity); }
    severity.count += 1;
  }
  return {
    snapshotDate: dataset.snapshotDate, rows, severities, findingsByDuration: findingsByDuration(open, dataset.snapshotDate),
    trend: buildNetworkRiskTrend(findings, dataset.snapshotDate),
    networkCount: networks.length, ciCount: assets.length,
    systemCount: systemCount(assets), unassessedCis: unassessedCis(assets),
    spi: assessments(evaluations.flatMap(evaluation => evaluation.evaluations.map(item => item.status))),
    discovery: assessments(discoveryStatuses(assets)),
    modelled: networks.filter(network => network.modellingStatus).length,
    discoveryEnabled: networks.filter(network => network.discoveryStatus === "Discovery Enabled").length,
    compliantNetworks: rows.filter(row => row.status === "Compliant").length,
    openFindings: open.length, severeFindings: rows.reduce((sum, row) => sum + row.critical + row.high, 0),
    overdueFindings: rows.reduce((sum, row) => sum + row.overdue, 0),
    p1p2: open.filter(finding => finding.priorityRank > 0 && finding.priorityRank <= 2).length
  };
}

export type NetworkRiskProfileModel = ReturnType<typeof buildNetworkRiskProfile>;
export type NetworkRiskRow = NetworkRiskProfileModel["rows"][number];
