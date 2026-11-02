import type * as SqlLoader from "@/lib/data-loader";
import type { Dataset, Finding, ICTSystem, ManagedNetwork, ReferenceVersions, StoredKpiEvaluation } from "@/lib/types";
import { normalizeSpiDefinitions, normalizeSeverityDefinitions } from "@/lib/spi-definitions";
import { normalizeKpiDefinitions, type KpiDefinition } from "@/lib/kpi-definitions";
import { normalizeMeasuresSettings, normalizePriorityDefinitions, applyMeasuresSeveritySettings, applyMeasuresPrioritySettings } from "@/lib/measures-settings";
import { normalizeDiscoveryToolsSettings, normalizeDiscoveryToolsScopeUpdate } from "@/lib/discovery-tools-settings";
import { normalizeFindingDisplayConfiguration } from "@/lib/findings-config";
import { clearAnalyticsCache } from "@/lib/analytics-cache";
import { clearAppDataCaches } from "@/lib/app-data-cache";
import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { demoPackage, unpackJson } from "./package";
import { enrichSampleData } from "./sample-data";
import { evaluateSpi, evaluateDiscovery, type DetectionRule } from "./evaluations";

export type DatasetLoadProfile = SqlLoader.DatasetLoadProfile;
export type KpiEvaluationScopeInput = SqlLoader.KpiEvaluationScopeInput;
type Options = { profile?: DatasetLoadProfile };
const datasets = new Map<number, Dataset>();
const settingsMemory = new Map<string, unknown>();
const storagePrefix = "tsaat-offline-demo-v1:";
export let storageNotice = "";
const ref = (name: string) => demoPackage().references[name];
function readSetting(name: string) {
  if (settingsMemory.has(name)) return settingsMemory.get(name);
  try { const value = localStorage.getItem(storagePrefix + name); if (value) return JSON.parse(value) as unknown; }
  catch { storageNotice = "Browser storage is unavailable. Settings apply for this session only."; }
  return ref(name);
}
function writeSetting(name: string, value: unknown) {
  settingsMemory.set(name, value);
  try { localStorage.setItem(storagePrefix + name, JSON.stringify(value)); }
  catch { storageNotice = "Browser storage is unavailable. Settings apply for this session only."; }
  clearDataLoaderCaches();
}
export function resetDemoSettings() {
  settingsMemory.clear();
  for (const key of ["measures-settings", "discovery-tools-settings"]) {
    try { localStorage.removeItem(storagePrefix + key); } catch { /* Session-only storage. */ }
  }
  clearDataLoaderCaches();
}
export function clearDataLoaderCaches() { datasets.clear(); clearAnalyticsCache(); clearAppDataCaches(); }
export const __resetDataLoaderCachesForTest = clearDataLoaderCaches;
export async function loadSpiDefinitions() { return normalizeSpiDefinitions(ref("spi-definitions")); }
export async function loadKpiDefinitions() { return normalizeKpiDefinitions(ref("kpi-definitions")); }
export async function loadSeverityDefinitions() { return normalizeSeverityDefinitions(ref("severity-definitions")); }
export async function loadFindingPriorityDefinitions() { return normalizePriorityDefinitions(ref("finding-priorities")); }
export async function loadFindingDisplayConfiguration() {
  return normalizeFindingDisplayConfiguration(ref("finding-definitions") as Parameters<typeof normalizeFindingDisplayConfiguration>[0]);
}
export async function loadReferenceVersions() { return ref("reference-versions") as ReferenceVersions; }
export async function loadMeasuresSettings(spis = normalizeSpiDefinitions(ref("spi-definitions")), severities = normalizeSeverityDefinitions(ref("severity-definitions")), priorities = normalizePriorityDefinitions(ref("finding-priorities"))) {
  return normalizeMeasuresSettings(readSetting("measures-settings"), spis, severities, priorities);
}
export async function saveMeasuresSettings(input: unknown) {
  const settings = normalizeMeasuresSettings(input, await loadSpiDefinitions(), await loadSeverityDefinitions(), await loadFindingPriorityDefinitions());
  settings.updatedAt = new Date().toISOString();
  writeSetting("measures-settings", settings);
  return settings;
}
export async function loadDiscoveryToolsSettings() { return normalizeDiscoveryToolsSettings(readSetting("discovery-tools-settings")); }
export async function saveDiscoveryToolsSettings(input: unknown) {
  const settings = normalizeDiscoveryToolsScopeUpdate(input, await loadDiscoveryToolsSettings());
  settings.updatedAt = new Date().toISOString();
  writeSetting("discovery-tools-settings", settings);
  return settings;
}

async function snapshot(id: number): Promise<Dataset> {
  const cached = datasets.get(id);
  if (cached) return cached;
  const source = demoPackage().snapshots[id - 1];
  if (!source) throw new Error("Unknown demo snapshot.");
  const dataset = enrichSampleData(unpackJson<Dataset>(source.json), id);
  const [spis, measures, discovery] = await Promise.all([loadSpiDefinitions(), loadMeasuresSettings(), loadDiscoveryToolsSettings()]);
  const rules = ref("discovery-coverage-rules") as { detectionRules: DetectionRule[] };
  dataset.spiEvaluations = dataset.assets.flatMap(asset => spis.filter(def => def.applicableAssetTypes.includes(asset.type)).map(def => evaluateSpi(asset, def)));
  dataset.discoveryCoverageEvaluations = dataset.assets.map(asset => evaluateDiscovery(asset, discovery, rules.detectionRules));
  dataset.findings = applyMeasuresPrioritySettings(applyMeasuresSeveritySettings(dataset.findings ?? [], dataset.assets, measures), measures);
  datasets.set(id, dataset);
  return dataset;
}
export async function loadCurrentDataset(_options: Options = {}) { return snapshot(demoPackage().snapshots.length); }
export async function loadSnapshots(_options: Options = {}) { return Promise.all(demoPackage().snapshots.map((_, i) => snapshot(i + 1))); }
export async function loadLatestSnapshots(limit = 12, options: Options = {}) { return (await loadSnapshots(options)).slice(-limit); }
export const loadDatasetTimeline = loadSnapshots;
export async function loadDatasetForDate(requestedDate?: string, _options: Options = {}) {
  const sources = demoPackage().snapshots;
  const index = requestedDate ? sources.reduce((selected, item, i) => item.date <= requestedDate ? i : selected, -1) : sources.length - 1;
  return snapshot(Math.max(0, index) + 1);
}
export async function loadLatestSnapshotsForDate(requestedDate?: string, limit = 12, options: Options = {}) {
  const latest = await loadDatasetForDate(requestedDate, options);
  return (await loadSnapshots(options)).filter(item => item.snapshotDate <= latest.snapshotDate).slice(-limit);
}
export async function loadSnapshotsForDateWindow(requestedDate?: string, monthsBack = 12, options: Options = {}) {
  const latest = await loadDatasetForDate(requestedDate, options);
  const from = new Date(latest.snapshotDate + "T00:00:00Z"); from.setUTCMonth(from.getUTCMonth() - monthsBack);
  return (await loadSnapshots(options)).filter(item => item.snapshotDate >= from.toISOString().slice(0, 10) && item.snapshotDate <= latest.snapshotDate);
}
export async function loadSnapshotEffectiveFindings(snapshotId: number, asOfDate?: string | null): Promise<Finding[]> {
  const dataset = await snapshot(snapshotId);
  const date = asOfDate ?? dataset.snapshotDate;
  return (dataset.findings ?? []).filter(f => f.timestamp.slice(0, 10) <= date).map(f => ({
    ...f, status: f.closedTimestamp && f.closedTimestamp.slice(0, 10) <= date ? "closed" : "open"
  }));
}
export async function loadWorkspaceFilterOptionsForDate(date?: string) {
  const dataset = await loadDatasetForDate(date);
  return {
    networks: dataset.managedNetworks.filter(n => n.id !== "net-unassigned").map(n => ({ id: n.id, label: n.name })).sort((a,b) => a.label.localeCompare(b.label)),
    systems: dataset.ictSystems.map(s => ({ id: s.id, label: s.name })).sort((a,b) => a.label.localeCompare(b.label))
  };
}
async function inventory(params: WorkspaceSearchParams) {
  const dataset = await loadDatasetForDate(Array.isArray(params.dataDate) ? params.dataDate[0] : params.dataDate);
  const networks = scopeIds(params.network), systems = scopeIds(params.system);
  const assets = dataset.assets.filter(a => (networks.length || systems.length) && a.networkId !== "net-unassigned" &&
    (!networks.length || networks.includes(a.networkId)) && (!systems.length || systems.includes(a.systemContext?.systemId ?? "")));
  return { dataset, assets };
}
export async function loadEndpointExplorerData(params: WorkspaceSearchParams): Promise<SqlLoader.EndpointExplorerData> {
  const { dataset, assets } = await inventory(params);
  return { snapshotDate: dataset.snapshotDate, rows: assets.map(a => ({
    assetId: a.id, name: a.name, ciType: formatAssetTypeLabel(a.type), ipAddress: a.ipAddress ?? null, macAddress: a.macAddress ?? null,
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
  const { dataset, assets } = await inventory(params);
  return { snapshotDate: dataset.snapshotDate, rows: assets.flatMap(a => {
    if (a.type !== "ip-node") return [];
    const owner = dataset.assets.find(item => item.id === a.arpOwnerAssetId);
    return [{ assetId: a.id, ownerAssetId: owner?.id ?? null, ipAddress: a.ipAddress ?? "", discoveryApproach: a.discoveryApproach,
      lastDiscoveredDate: a.lastDiscoveredDate ?? null, discoveredBy: a.discoveredBy ?? null, endpointName: owner?.name ?? null,
      endpointCiType: owner ? formatAssetTypeLabel(owner.type) : null, endpointIpAddress: owner?.ipAddress ?? null,
      endpointMacAddress: owner?.macAddress ?? null, endpointDeviceModel: owner?.deviceModel ?? null,
      endpointLastDiscoveredDate: owner?.lastDiscoveredDate ?? null, endpointDiscoveredBy: owner?.discoveredBy ?? null,
      endpointManagedNetwork: dataset.managedNetworks.find(n => n.id === owner?.networkId)?.name ?? null }];
  }) };
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
      throw new Error("Unsupported demo KPI calculation: " + def.calculationKey);
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
