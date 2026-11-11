import { assertRetainedDataset } from "@/lib/inventory-schema.mjs";
import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { normalizeDataDate,subtractCalendarMonthsDateKey,todayDateKey } from "@/lib/data-date";
import { normalizeDiscoveryToolsScopeUpdate,normalizeDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { matchesSecurityDomain,normalizeDatasetSecurityDomains } from "@/lib/security-domain.mjs";
import { buildSecurityVulnerabilityRows } from "@/lib/security-vulnerability-explorer";
import type * as SqlLoader from "@/lib/sql-data-loader";
import type { Dataset } from "@/lib/types";
import { scopeIds,type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import "server-only";
import { evaluateDiscovery,type DetectionRule } from "./evaluations";
import { atomicWriteJson,fileVersion,jsonStoreDirectory,loadStoreManifest,readJson,withStoreWriteLock } from "./files";
import { loadPersonaSettings,savePersonaSettings } from "./persona-settings";
import { clearReferenceCaches,reference } from "./references";

export type DatasetLoadProfile = SqlLoader.DatasetLoadProfile;
export type WorkspaceFilterOptions = SqlLoader.WorkspaceFilterOptions;
export type EndpointExplorerData = SqlLoader.EndpointExplorerData;
export type InstalledSoftwareExplorerData = SqlLoader.InstalledSoftwareExplorerData;
export type ShadowItExplorerData = SqlLoader.ShadowItExplorerData;
type Options = { profile?: DatasetLoadProfile };
const datasets = new Map<string, Dataset>();
export function clearDataLoaderCaches() { datasets.clear(); clearReferenceCaches();  }
export const __resetDataLoaderCachesForTest = clearDataLoaderCaches;
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
export async function loadDiscoveryToolsSettings() { return normalizeDiscoveryToolsSettings(await readJson("settings/discovery-tools-settings.json")); }
export async function saveDiscoveryToolsSettings(input: unknown) {
  return persistSettings("discovery-tools-settings", normalizeDiscoveryToolsScopeUpdate(input, await loadDiscoveryToolsSettings()));
}
async function snapshot(id: number): Promise<Dataset> {
  const manifest = await loadStoreManifest(), source = manifest.snapshots.find(item => item.id === id);
  if (!source) throw new Error("Unknown JSON snapshot ID: " + id);
  const [settings, rules, version] = await Promise.all([loadDiscoveryToolsSettings(),
    reference<{ detectionRules: DetectionRule[] }>("discovery-coverage-rules"), fileVersion(source.file)]);
  const key = JSON.stringify([jsonStoreDirectory(), id, version, settings, rules]);
  const cached = datasets.get(key); if (cached) return cached;
  const dataset = normalizeDatasetSecurityDomains(await readJson<Dataset>(source.file));
  if (dataset.snapshotDate !== source.date || !Array.isArray(dataset.assets) || !Array.isArray(dataset.managedNetworks) || !Array.isArray(dataset.ictSystems))
    throw new Error("Invalid snapshot data: " + source.file);
  if (new Set(dataset.assets.map(asset => asset.id)).size !== dataset.assets.length) throw new Error("Duplicate snapshot asset IDs.");
  assertRetainedDataset(dataset);
  dataset.snapshotId = id;
  dataset.discoveryCoverageEvaluations = dataset.assets.map(asset => evaluateDiscovery(asset, settings, rules.detectionRules));
  if (datasets.size >= 16) datasets.delete(datasets.keys().next().value!);
  datasets.set(key, dataset); return dataset;
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

export async function loadSecurityVulnerabilityExplorerData(params: WorkspaceSearchParams): Promise<SqlLoader.SecurityVulnerabilityExplorerData> {
  if (!scopeIds(params.network).length && !scopeIds(params.system).length) {
    const date = Array.isArray(params.dataDate) ? params.dataDate[0] : params.dataDate;
    return { snapshotDate: normalizeDataDate(date) ?? todayDateKey(), rows: [] };
  }
  const { dataset, assets } = await inventory(params);
  return { snapshotDate: dataset.snapshotDate, rows: buildSecurityVulnerabilityRows(assets.filter(asset => asset.networkId.trim()), dataset.snapshotDate) };
}

// Compile-time parity: adding a SQL provider operation requires its JSON implementation.
export const jsonDataProvider = {
  loadCurrentDataset,
  loadSnapshots,
  loadLatestSnapshots,
  loadDatasetTimeline,
  loadDatasetForDate,
  loadWorkspaceFilterOptionsForDate,
  loadEndpointExplorerData,
  loadInstalledSoftwareExplorerData,
  loadSecurityVulnerabilityExplorerData,
  loadShadowItExplorerData,
  loadLatestSnapshotsForDate,
  loadSnapshotsForDateWindow,
  loadDiscoveryToolsSettings,
  saveDiscoveryToolsSettings,
  loadPersonaSettings,
  savePersonaSettings,
  clearDataLoaderCaches,
  __resetDataLoaderCachesForTest
} satisfies typeof SqlLoader;
