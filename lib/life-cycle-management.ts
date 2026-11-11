import { assetTypeLabel } from "@/lib/asset-taxonomy";
import { filterDiscoveryAssets } from "@/lib/discovery-filter-scope";
import { applyAssetFilters, parseFilters } from "@/lib/selectors";
import type { Dataset, OperatingSystem } from "@/lib/types";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export interface LifecycleAsset {
  id: string; name: string; type: string; typeLabel: string; model: string; network: string; system: string;
  domain: string; environment: string; critical: boolean; warranty: string; warrantyExpired: boolean;
  osName: string; osVersion: string; osSupport: string; nMinus: number | null; currentMajor: number | null;
  osApplicable: boolean; osIssue: boolean; softwareApplicable: boolean; softwareCount: number;
  unsupportedSoftware: number; unknownSoftware: number; softwareNames: string[];
  issueCount: number; issues: string[]; gaps: string[]; actions: string[];
}
export interface LifecycleSoftware {
  id: string; assetId: string; device: string; type: string; name: string; version: string; support: string;
  network: string; system: string; domain: string;
}
const recorded = (value?: string | null) => value?.trim() || "Not recorded";
export const lifecycleSupport = (value?: string) => value === "OutOfSupport" ? "Out of support" : value === "Supported" ? "Supported" : "Unknown";
export const lifecycleWarranty = (value?: string) => value === "OutOfWarranty" ? "Out of warranty" : value === "InWarranty" ? "In warranty" : "Unknown";
export function lifecycleLag(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}
export const lifecycleLagLabel = (lag: number | null) => lag === null ? "Unknown" : lag === 0 ? "N (current)" : `N-${lag}`;
export const lifecycleAttention = (row: LifecycleAsset) => row.issueCount ? `${row.issueCount} ${row.issueCount === 1 ? "area" : "areas"} affected`
  : row.gaps.length ? "Verify records" : "No recorded issue";

/** The queue ranks overlapping lifecycle areas, not configurable SPI risk or an invented score. */
export function compareLifecycleServers(a: LifecycleAsset, b: LifecycleAsset): number {
  return b.issueCount - a.issueCount || (!a.issueCount ? Number(Boolean(b.gaps.length)) - Number(Boolean(a.gaps.length)) : 0)
    || Number(b.critical) - Number(a.critical) || Number(b.environment === "Production") - Number(a.environment === "Production")
    || (b.nMinus ?? -1) - (a.nMinus ?? -1) || b.unsupportedSoftware - a.unsupportedSoftware || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

export function buildLifeCycleManagement(dataset: Dataset, searchParams: WorkspaceSearchParams) {
  // Only applied header scope affects this page; unrelated explorer filter parameters are ignored.
  const scope = { network: searchParams.network, system: searchParams.system, securityDomain: searchParams.securityDomain };
  const scopedAssets = filterDiscoveryAssets(applyAssetFilters(dataset.assets, dataset.ictSystems, parseFilters(scope)));
  const systems = new Map(dataset.ictSystems.map(system => [system.id, system]));
  const networks = new Map(dataset.managedNetworks.map(network => [network.id, network.name]));
  const software: LifecycleSoftware[] = [];
  const assets = scopedAssets.filter(asset => asset.type !== "ip-node").map((asset): LifecycleAsset => {
    const system = systems.get(asset.systemContext?.systemId ?? "");
    const os: OperatingSystem | null = "operatingSystem" in asset ? asset.operatingSystem : "networkOs" in asset ? asset.networkOs : null;
    const osApplicable = "operatingSystem" in asset || "networkOs" in asset;
    const softwareApplicable = "installedSoftware" in asset;
    const installations = softwareApplicable ? asset.installedSoftware : [];
    const unsupported = installations.filter(item => item.supportStatus === "OutOfSupport");
    const unknown = installations.filter(item => lifecycleSupport(item.supportStatus) === "Unknown");
    const nMinus = lifecycleLag(os?.nMinus);
    const warranty = lifecycleWarranty(asset.lifecycle.warrantyStatus), warrantyExpired = warranty === "Out of warranty";
    const osSupport = lifecycleSupport(os?.supportStatus);
    const osIssue = osApplicable && ((nMinus !== null && nMinus >= 2) || osSupport === "Out of support");
    const issues: string[] = [], gaps: string[] = [], actions: string[] = [];
    if (warrantyExpired) { issues.push("Out of warranty"); actions.push("Renew hardware cover or plan replacement"); }
    if (unsupported.length) { issues.push(`${unsupported.length} unsupported software ${unsupported.length === 1 ? "installation" : "installations"}`); actions.push("Upgrade or remove unsupported software"); }
    if (nMinus !== null && nMinus >= 2) issues.push(`OS ${lifecycleLagLabel(nMinus)}`);
    if (osApplicable && osSupport === "Out of support") issues.push("OS out of support");
    if (osIssue) actions.push("Plan migration to a supported OS release");
    if (warranty === "Unknown") gaps.push("Warranty status");
    if (osApplicable && !os) gaps.push("Operating system inventory");
    else if (osApplicable) {
      if (nMinus === null) gaps.push("OS version distance");
      if (osSupport === "Unknown") gaps.push("OS support status");
    }
    if (softwareApplicable && !installations.length) gaps.push("Software inventory");
    if (unknown.length) gaps.push(`${unknown.length} software support ${unknown.length === 1 ? "status" : "statuses"}`);
    if (gaps.length) actions.push("Verify missing lifecycle evidence");
    const base = { assetId: asset.id, device: recorded(asset.hostname || asset.name), type: assetTypeLabel(asset.type),
      network: networks.get(asset.networkId) ?? asset.networkId, system: system?.name ?? "Not associated", domain: asset.securityDomain };
    installations.forEach((item, ordinal) => software.push({ ...base, id: `${asset.id}:${ordinal}`, name: recorded(item.name), version: recorded(item.version), support: lifecycleSupport(item.supportStatus) }));
    return { id: asset.id, name: base.device, type: asset.type, typeLabel: base.type, model: recorded(asset.deviceModel), network: base.network,
      system: base.system, domain: base.domain, environment: asset.systemContext?.environmentType ?? "Not recorded", critical: system?.criticality === "Critical",
      warranty, warrantyExpired, osName: recorded(os?.family), osVersion: recorded(os?.version), osSupport, nMinus,
      currentMajor: os?.currentSupportedMajor ?? null, osApplicable, osIssue, softwareApplicable, softwareCount: installations.length,
      unsupportedSoftware: unsupported.length, unknownSoftware: unknown.length, softwareNames: unsupported.map(item => `${recorded(item.name)} ${recorded(item.version)}`),
      issueCount: Number(warrantyExpired) + Number(unsupported.length > 0) + Number(osIssue), issues, gaps, actions };
  });
  // The taxonomy has no physical/virtual marker; do not infer chassis type from names/models.
  const hardware = assets.filter(asset => asset.type !== "other");
  const servers = assets.filter(asset => asset.type === "server").sort(compareLifecycleServers);
  const operatingSystems = assets.filter(asset => asset.osApplicable);
  const unsupportedSoftware = software.filter(item => item.support === "Out of support");
  return { snapshotDate: dataset.snapshotDate, hardware, servers, software, operatingSystems,
    totals: { assets: assets.length, servers: servers.length, serversAtRisk: servers.filter(row => row.issueCount > 0).length,
      compoundedServers: servers.filter(row => row.issueCount >= 2).length, serversWithGaps: servers.filter(row => row.gaps.length > 0).length,
      warrantyExpired: hardware.filter(row => row.warrantyExpired).length, warrantyUnknown: hardware.filter(row => row.warranty === "Unknown").length,
      unsupportedInstallations: unsupportedSoftware.length, unsupportedDevices: new Set(unsupportedSoftware.map(item => item.assetId)).size,
      oldOperatingSystems: operatingSystems.filter(row => row.nMinus !== null && row.nMinus >= 2).length,
      unknownOsLag: operatingSystems.filter(row => row.nMinus === null).length } };
}
export type LifeCycleManagementModel = ReturnType<typeof buildLifeCycleManagement>;
