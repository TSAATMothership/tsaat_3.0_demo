import "server-only";
import { loadPersonaSettings, savePersonaSettings } from "./persona-settings";
import { normalizeDatasetSecurityDomains, matchesSecurityDomain } from "@/lib/security-domain.mjs";
import type * as SqlLoader from "@/lib/sql-data-loader";
import type { Dataset, Finding, ICTSystem, ManagedNetwork, ReferenceVersions, StoredKpiEvaluation } from "@/lib/types";
import { normalizeSpiDefinitions, normalizeSeverityDefinitions } from "@/lib/spi-definitions";
import { normalizeKpiDefinitions, type KpiDefinition } from "@/lib/kpi-definitions";
import { normalizeMeasuresSettings, normalizePriorityDefinitions, applyMeasuresSeveritySettings, applyMeasuresPrioritySettings } from "@/lib/measures-settings";
import { normalizeDiscoveryToolsSettings, normalizeDiscoveryToolsScopeUpdate } from "@/lib/discovery-tools-settings";
import { normalizeFindingDisplayConfiguration } from "@/lib/findings-config";
import { clearAnalyticsCache } from "@/lib/analytics-cache";
import { clearAppDataCaches } from "@/lib/app-data-cache";
import { normalizeDataDate, todayDateKey, subtractCalendarMonthsDateKey } from "@/lib/data-date";
import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { buildSecurityVulnerabilityRows } from "@/lib/security-vulnerability-explorer";
import { buildPatchManagementRows, type PatchManagementData } from "@/lib/patch-management-explorer";
import { readJson, fileVersion, loadStoreManifest, atomicWriteJson, withStoreWriteLock, jsonStoreDirectory } from "./files";
import { reference, spiReferenceRows, kpiReferenceRows, clearReferenceCaches } from "./references";
import { evaluateSpi, evaluateDiscovery, type DetectionRule } from "./evaluations";

export type DatasetLoadProfile = SqlLoader.DatasetLoadProfile;
export type KpiEvaluationScopeInput = SqlLoader.KpiEvaluationScopeInput;
export type WorkspaceFilterOptions = SqlLoader.WorkspaceFilterOptions;
export type EndpointExplorerData = SqlLoader.EndpointExplorerData;
export type InstalledSoftwareExplorerData = SqlLoader.InstalledSoftwareExplorerData;
export type ShadowItExplorerData = SqlLoader.ShadowItExplorerData;
type Options = { profile?: DatasetLoadProfile };
const datasets = new Map<string, Dataset>();
export function clearDataLoaderCaches() { datasets.clear(); clearReferenceCaches(); clearAnalyticsCache(); clearAppDataCaches(); }
export const __resetDataLoaderCachesForTest = clearDataLoaderCaches;
export async function loadSpiDefinitions() {
  const rows = await spiReferenceRows(), definitions = normalizeSpiDefinitions(rows);
  if (definitions.length !== rows.filter(row => row.enabled !== false).length) throw new Error("Invalid SPI definitions in JSON storage.");
  return definitions;
}
export async function loadKpiDefinitions() { return normalizeKpiDefinitions(await kpiReferenceRows()); }
export async function loadSeverityDefinitions() { return normalizeSeverityDefinitions(await reference("severity-definitions")); }
export async function loadFindingPriorityDefinitions() {
  const file = await reference<{ findingPriorities: unknown[] }>("spi-sql-calculations");
  return normalizePriorityDefinitions(file.findingPriorities);
}
export async function loadFindingDisplayConfiguration() {
  return normalizeFindingDisplayConfiguration(await reference<Parameters<typeof normalizeFindingDisplayConfiguration>[0]>("finding-definitions"));
}
export async function loadReferenceVersions() { return reference<ReferenceVersions>("reference-versions"); }
export async function loadMeasuresSettings(...args: Parameters<typeof SqlLoader.loadMeasuresSettings>) {
  const [spis = await loadSpiDefinitions(), severities = await loadSeverityDefinitions(), priorities = await loadFindingPriorityDefinitions()] = args;
  return normalizeMeasuresSettings(await readJson("settings/measures-settings.json"), spis, severities, priorities);
}
async function persistSettings<T extends { updatedAt: string }>(name: string, value: T): Promise<T> {
  return withStoreWriteLock(async () => {
    const previous = await readJson<{ updatedAt: string }>("settings/" + name + ".json");
    value.updatedAt = new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1 || 0)).toISOString();
    await atomicWriteJson("settings/history/" + name + "-" + value.updatedAt.replaceAll(":", "-") + ".json", value);
    await atomicWriteJson("settings/" + name + ".json", value);
    clearDataLoaderCaches();
    return value;
  });
}
export async function saveMeasuresSettings(input: unknown) {
  const settings = normalizeMeasuresSettings(input, await loadSpiDefinitions(), await loadSeverityDefinitions(), await loadFindingPriorityDefinitions());
  if (!Object.keys(settings.severityMatrix).length || !Object.keys(settings.priorityMatrix).length) throw new Error("No measures mappings were produced.");
  return persistSettings("measures-settings", settings);
}
export async function loadDiscoveryToolsSettings() { return normalizeDiscoveryToolsSettings(await readJson("settings/discovery-tools-settings.json")); }
export async function saveDiscoveryToolsSettings(input: unknown) {
  return persistSettings("discovery-tools-settings", normalizeDiscoveryToolsScopeUpdate(input, await loadDiscoveryToolsSettings()));
}
async function snapshot(id: number): Promise<Dataset> {
  const manifest = await loadStoreManifest(), source = manifest.snapshots.find(item => item.id === id);
  if (!source) throw new Error("Unknown JSON snapshot ID: " + id);
  const [spis, measures, discovery, rules, version] = await Promise.all([
    loadSpiDefinitions(), loadMeasuresSettings(), loadDiscoveryToolsSettings(),
    reference<{ detectionRules: DetectionRule[] }>("discovery-coverage-rules"), fileVersion(source.file)
  ]);
  const key = JSON.stringify([jsonStoreDirectory(), id, version, spis, measures, discovery, rules]);
  const cached = datasets.get(key);
  if (cached) return cached;
  const dataset = normalizeDatasetSecurityDomains(await readJson<Dataset>(source.file));
  if (dataset.snapshotDate !== source.date || !Array.isArray(dataset.assets) || !Array.isArray(dataset.managedNetworks) ||
      !Array.isArray(dataset.ictSystems) || !Array.isArray(dataset.findings)) throw new Error("Invalid snapshot data: " + source.file);
  const assetIds = new Set(dataset.assets.map(asset => asset.id));
  if (assetIds.size !== dataset.assets.length || dataset.findings.some(f => !assetIds.has(f.scope.assetId))) throw new Error("Invalid asset references in " + source.file);
  dataset.snapshotId = id;
  dataset.spiEvaluations = dataset.assets.flatMap(asset => spis.filter(def => def.applicableAssetTypes.includes(asset.type)).map(def => evaluateSpi(asset, def)));
  dataset.discoveryCoverageEvaluations = dataset.assets.map(asset => evaluateDiscovery(asset, discovery, rules.detectionRules));
  const persistedFindings = dataset.findings.map(finding => ({ ...finding,
    rawPriorityRank: finding.rawPriorityRank ?? finding.priorityRank,
    rawSeverity: finding.rawSeverity ?? finding.severity, sourceKind: finding.sourceKind ?? "persisted" as const }));
  dataset.findings = applyMeasuresPrioritySettings(applyMeasuresSeveritySettings(persistedFindings, dataset.assets, measures), measures);
  // A new file revision must invalidate the shared model caches, on subsequent loads.
  clearAnalyticsCache(); clearAppDataCaches();
  if (datasets.size >= 16) datasets.delete(datasets.keys().next().value!);
  datasets.set(key, dataset);
  return dataset;
}
export async function loadCurrentDataset(_options: Options = {}) { return snapshot((await loadStoreManifest()).snapshots.at(-1)!.id); }
export async function loadSnapshots(_options: Options = {}) { return Promise.all((await loadStoreManifest()).snapshots.map(item => snapshot(item.id))); }
export async function loadLatestSnapshots(limit = 12, _options: Options = {}) {
  return Promise.all((await loadStoreManifest()).snapshots.slice(-Math.max(0, limit)).map(item => snapshot(item.id)));
}
export const loadDatasetTimeline = loadSnapshots;
export async function loadDatasetForDate(requestedDate?: string, _options: Options = {}) {
  const sources = (await loadStoreManifest()).snapshots, target = normalizeDataDate(requestedDate) ?? todayDateKey();
  return snapshot((sources.filter(item => item.date <= target).at(-1) ?? sources[0]).id);
}
export async function loadLatestSnapshotsForDate(requestedDate: string | undefined, limit = 12, _options: Options = {}) {
  const target = normalizeDataDate(requestedDate) ?? todayDateKey();
  return Promise.all((await loadStoreManifest()).snapshots.filter(item => item.date <= target).slice(-Math.max(0, limit)).map(item => snapshot(item.id)));
}
export async function loadSnapshotsForDateWindow(requestedDate: string | undefined, monthsBack = 12, options: Options = {}) {
  const latest = await loadDatasetForDate(requestedDate, options), from = subtractCalendarMonthsDateKey(latest.snapshotDate, monthsBack);
  return Promise.all((await loadStoreManifest()).snapshots.filter(item => item.date >= from && item.date <= latest.snapshotDate).map(item => snapshot(item.id)));
}
export async function loadSnapshotEffectiveFindings(snapshotId: number, asOfDate?: string | null): Promise<Finding[]> {
  const dataset = await snapshot(snapshotId);
  if (!asOfDate) return dataset.findings ?? [];
  return (dataset.findings ?? []).filter(f => f.timestamp.slice(0, 10) <= asOfDate).map(f => ({
    ...f, status: f.closedTimestamp && f.closedTimestamp.slice(0, 10) <= asOfDate ? "closed" : "open"
  }));
}
export async function loadWorkspaceFilterOptionsForDate(date?: string) {
  const dataset = await loadDatasetForDate(date);
  return {
    networks: dataset.managedNetworks.filter(n => n.id !== "net-unassigned").map(n => ({ id: n.id, label: n.name, securityDomain: n.securityDomain })).sort((a,b) => a.label.localeCompare(b.label)),
    systems: dataset.ictSystems.map(s => ({ id: s.id, label: s.name, securityDomain: s.securityDomain })).sort((a,b) => a.label.localeCompare(b.label))
  };
}

async function inventory(params: WorkspaceSearchParams) {
  const dataset = await loadDatasetForDate(Array.isArray(params.dataDate) ? params.dataDate[0] : params.dataDate);
  const networks = scopeIds(params.network), systems = scopeIds(params.system);
  const assets = dataset.assets.filter(a => matchesSecurityDomain(a.securityDomain, params.securityDomain) && (networks.length || systems.length) && a.networkId !== "net-unassigned" &&
    (!networks.length || networks.includes(a.networkId)) && (!systems.length || systems.includes(a.systemContext?.systemId ?? "")));
  return { dataset, assets };
}
export async function loadEndpointExplorerData(params: WorkspaceSearchParams): Promise<SqlLoader.EndpointExplorerData> {
  const { dataset, assets } = await inventory(params);
  return { snapshotDate: dataset.snapshotDate, rows: assets.map(a => ({
    assetId: a.id, name: a.name, securityDomain: a.securityDomain, ciType: formatAssetTypeLabel(a.type), ipAddress: a.ipAddress ?? null, macAddress: a.macAddress ?? null,
    deviceModel: a.deviceModel ?? null, lastDiscoveredDate: a.lastDiscoveredDate ?? null, discoveredBy: a.discoveredBy ?? null,
    managedNetwork: dataset.managedNetworks.find(n => n.id === a.networkId)?.name ?? a.networkId
  })) };
}
export async function loadInstalledSoftwareExplorerData(params: WorkspaceSearchParams): Promise<SqlLoader.InstalledSoftwareExplorerData> {
  const { dataset, assets } = await inventory(params);
  return { snapshotDate: dataset.snapshotDate, rows: assets.flatMap(a => "installedSoftware" in a ? a.installedSoftware.map((s, i) => ({
    assetId: a.id, softwareOrdinal: i + 1, softwareName: s.name, softwareVersion: s.version, filePath: s.filePath ?? null,
    lastDiscoveredDate: s.lastDiscoveredDate ?? null, discoveredBy: s.discoveredBy ?? null, deviceName: a.name, deviceModel: a.deviceModel ?? null,
    osName: a.operatingSystem?.family ?? null, osVersion: a.operatingSystem?.version ?? null, osPatchLevel: a.operatingSystem?.patchLevel ?? null
  })) : []) };
}
export async function loadShadowItExplorerData(params: WorkspaceSearchParams): Promise<SqlLoader.ShadowItExplorerData> {
  const dataset = await loadDatasetForDate(Array.isArray(params.dataDate) ? params.dataDate[0] : params.dataDate);
  const networks = scopeIds(params.network), systems = scopeIds(params.system);
  const byId = new Map(dataset.assets.map(asset => [asset.id, asset]));
  return { snapshotDate: dataset.snapshotDate, rows: dataset.assets.flatMap(a => {
    if (!matchesSecurityDomain(a.securityDomain, params.securityDomain) || a.type !== "ip-node" || (!networks.length && !systems.length) || !a.networkId.trim() || a.networkId === "net-unassigned") return [];
    const candidate = a.discoveryApproach === "ARP Table" ? byId.get(a.arpOwnerAssetId ?? "") : undefined;
    const owner = candidate?.networkId === a.networkId ? candidate : undefined;
    if (networks.length && !networks.includes(a.networkId)) return [];
    if (systems.length && !systems.includes(a.systemContext?.systemId ?? "") && !systems.includes(owner?.systemContext?.systemId ?? "")) return [];
    return [{ assetId: a.id, ownerAssetId: owner?.id ?? null, ipAddress: a.ipAddress ?? "", discoveryApproach: a.discoveryApproach,
      lastDiscoveredDate: a.lastDiscoveredDate ?? null, discoveredBy: a.discoveredBy ?? null, endpointName: owner?.name ?? null,
      endpointCiType: owner ? formatAssetTypeLabel(owner.type) : null, endpointIpAddress: owner?.ipAddress ?? null,
      endpointMacAddress: owner?.macAddress ?? null, endpointDeviceModel: owner?.deviceModel ?? null,
      endpointLastDiscoveredDate: owner?.lastDiscoveredDate ?? null, endpointDiscoveredBy: owner?.discoveredBy ?? null,
      endpointManagedNetwork: dataset.managedNetworks.find(n => n.id === owner?.networkId)?.name ?? null }];
  }) };
}
export async function loadPatchManagementExplorerData(params: WorkspaceSearchParams): Promise<PatchManagementData> {
  const date = Array.isArray(params.dataDate) ? params.dataDate[0] : params.dataDate;
  if (!scopeIds(params.network).length && !scopeIds(params.system).length) return { snapshotDate: normalizeDataDate(date) ?? todayDateKey(), rows: [] };
  const dataset = await loadDatasetForDate(date, { profile: "full" });
  return { snapshotDate: dataset.snapshotDate, rows: buildPatchManagementRows(dataset, params) };
}

export async function loadSecurityVulnerabilityExplorerData(params: WorkspaceSearchParams): Promise<SqlLoader.SecurityVulnerabilityExplorerData> {
  if (!scopeIds(params.network).length && !scopeIds(params.system).length) {
    const date = Array.isArray(params.dataDate) ? params.dataDate[0] : params.dataDate;
    return { snapshotDate: normalizeDataDate(date) ?? todayDateKey(), rows: [] };
  }
  const { dataset, assets } = await inventory(params);
  return { snapshotDate: dataset.snapshotDate, rows: buildSecurityVulnerabilityRows(assets.filter(asset => asset.networkId.trim()), dataset.snapshotDate) };
}
export async function loadSnapshotKpiEvaluationsForScope(input: {
  snapshotId: number; assetIds: Iterable<string>; systemIds: Iterable<string>; networkIds: Iterable<string>; findings: Finding[]; kpiDefinitions?: KpiDefinition[];
}): Promise<StoredKpiEvaluation[]> {
  const dataset = await snapshot(input.snapshotId);
  const ids = new Set(input.systemIds), assetIds = new Set(input.assetIds);
  const systems = dataset.ictSystems.filter(s => ids.has(s.id));
  return (input.kpiDefinitions ?? await loadKpiDefinitions()).map(def => {
    function compliant(system: ICTSystem) {
      if (def.calculationKey === "active-ato-coverage") return Boolean(system.atoNumber?.trim());
      if (def.calculationKey === "diis-registration-coverage") return system.diisDefined;
      throw new Error("Unsupported JSON KPI calculation: " + def.calculationKey);
    }
    const nonCompliant = new Set(systems.filter(s => !compliant(s)).map(s => s.id));
    const applicableCount = systems.length, compliantCount = applicableCount - nonCompliant.size;
    const scorePercent = applicableCount ? Math.round(1000 * compliantCount / applicableCount) / 10 : 0;
    return { kpiId: def.id, displayOrder: def.displayOrder, calculationKey: def.calculationKey, score: scorePercent.toFixed(1) + "% (" + compliantCount + "/" + applicableCount + ")",
      scorePercent, applicableCount, compliantCount, nonCompliantCount: nonCompliant.size, unknownCount: 0,
      highPriorityCount: input.findings.filter(f => f.priorityRank <= 2 && assetIds.has(f.scope.assetId) && nonCompliant.has(dataset.assets.find(a => a.id === f.scope.assetId)?.systemContext?.systemId ?? "")).length };
  });
}
export async function loadSnapshotKpiEvaluationsForScopes(input: { snapshotId: number; scopes: KpiEvaluationScopeInput[]; kpiDefinitions?: KpiDefinition[] }) {
  const result = new Map<string, StoredKpiEvaluation[]>();
  for (const scope of input.scopes) result.set(scope.scopeKey, await loadSnapshotKpiEvaluationsForScope({ ...scope, snapshotId: input.snapshotId, kpiDefinitions: input.kpiDefinitions }));
  return result;
}
export async function loadSnapshotKpiEvaluationsForAnalyticsScope(input: {
  dataset: Dataset; analytics: { evaluations: Array<{ assetId: string }>; findings: Finding[] }; systems: ICTSystem[]; networks: ManagedNetwork[]; kpiDefinitions?: KpiDefinition[];
}) {
  return loadSnapshotKpiEvaluationsForScope({ snapshotId: input.dataset.snapshotId!, assetIds: input.analytics.evaluations.map(a => a.assetId),
    systemIds: input.systems.map(s => s.id), networkIds: input.networks.map(n => n.id), findings: input.analytics.findings, kpiDefinitions: input.kpiDefinitions });
}

// Compile-time parity: adding a SQL provider operation requires its JSON implementation.
export const jsonDataProvider = {
  loadSnapshotEffectiveFindings,
  loadCurrentDataset,
  loadSnapshots,
  loadLatestSnapshots,
  loadDatasetTimeline,
  loadDatasetForDate,
  loadWorkspaceFilterOptionsForDate,
  loadEndpointExplorerData,
  loadInstalledSoftwareExplorerData,
  loadSecurityVulnerabilityExplorerData,
  loadPatchManagementExplorerData,
  loadShadowItExplorerData,
  loadLatestSnapshotsForDate,
  loadSnapshotsForDateWindow,
  loadReferenceVersions,
  loadSeverityDefinitions,
  loadFindingPriorityDefinitions,
  loadFindingDisplayConfiguration,
  loadSpiDefinitions,
  loadKpiDefinitions,
  loadSnapshotKpiEvaluationsForScope,
  loadSnapshotKpiEvaluationsForScopes,
  loadSnapshotKpiEvaluationsForAnalyticsScope,
  loadMeasuresSettings,
  saveMeasuresSettings,
  loadDiscoveryToolsSettings,
  saveDiscoveryToolsSettings,
  loadPersonaSettings,
  savePersonaSettings,
  clearDataLoaderCaches,
  __resetDataLoaderCachesForTest
} satisfies typeof SqlLoader;
