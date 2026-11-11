import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import type { CmdbAssetDetails } from "@/lib/cmdb-drill-through";
import type { CmdbCiType } from "@/lib/cmdb-ci-types";
import type { CmdbModelCiDetails } from "@/lib/cmdb-model-ci";

// Approved canonical values. Labels, inclusion and ordering are controlled by the selected data provider.
export const CMDB_ATTRIBUTE_KEYS = [
  "assetId", "assetName", "assetHostname", "assetType", "assetIpAddress",
  "networkName", "systemName", "environmentType", "securityDomain",
  "lifecycleEolStatus", "lifecycleWarrantyStatus", "operatingSystemSummary",
  "networkOsSummary", "patchStateSummary", "installedSoftwareCount",
  "vulnerabilityCount", "criticalVulnerabilityCount", "cmdbRecordUrl"
] as const satisfies readonly (keyof CmdbAssetDetails)[];

export const CMDB_MODEL_ATTRIBUTE_KEYS = ["ciId", "ciName", "ciType", "criticality", "relatedSystems", "relatedNetworks", "relatedSecurityDomains"] as const satisfies readonly (keyof CmdbModelCiDetails)[];
export type CmdbAttributeKey = typeof CMDB_ATTRIBUTE_KEYS[number] | typeof CMDB_MODEL_ATTRIBUTE_KEYS[number];
const isEndpointKey = (key: CmdbAttributeKey): key is typeof CMDB_ATTRIBUTE_KEYS[number] => CMDB_ATTRIBUTE_KEYS.some(value => value === key);
const isModelKey = (key: CmdbAttributeKey): key is typeof CMDB_MODEL_ATTRIBUTE_KEYS[number] => CMDB_MODEL_ATTRIBUTE_KEYS.some(value => value === key);
export interface CmdbAttributeDefinition {
  key: CmdbAttributeKey;
  label: string;
  displayOrder: number;
}
export interface CmdbAttributeRow {
  key: CmdbAttributeKey;
  label: string;
  value: string;
  href?: string;
}
export interface CmdbAssetView extends Pick<CmdbAssetDetails, "snapshotDate" | "assetId" | "assetName" | "networkId"> {
  assetType: CmdbCiType;
  topologyId?: string;
  systemIds?: string[];
  attributes: CmdbAttributeRow[];
}

function safeExternalUrl(value: string | null): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Only mapped attributes are returned; an empty mapping deliberately produces no rows. */
export function buildCmdbAssetView(details: CmdbAssetDetails, definitions: CmdbAttributeDefinition[]): CmdbAssetView {
  const seen = new Set<string>();
  const attributes = [...definitions].sort((a, b) => a.displayOrder - b.displayOrder || a.key.localeCompare(b.key)).map(definition => {
    const { key, label } = definition;
    if (!isEndpointKey(key) || seen.has(key) ||
        !definition.label?.trim() || !Number.isInteger(definition.displayOrder) || definition.displayOrder < 0) {
      throw new Error("Invalid CMDB attribute configuration.");
    }
    seen.add(definition.key);
    if (key === "cmdbRecordUrl") {
      const href = safeExternalUrl(details.cmdbRecordUrl);
      return { key, label, value: href ? "Open CMDB record" : "Not supplied", ...(href ? { href } : {}) };
    }
    const value = key === "assetType" ? formatAssetTypeLabel(details.assetType)
      : key === "networkName" ? details.networkName || details.networkId
      : key === "systemName" ? (details.hasIctSystem ? details.systemName : "Not linked to ICT system")
      : key === "environmentType" ? details.environmentType ?? "Unassigned" : details[key];
    return { key, label, value: value === null || value === undefined || value === "" ? "Not supplied" : String(value) };
  });
  return { snapshotDate: details.snapshotDate, assetId: details.assetId, assetName: details.assetName, assetType: details.assetType, networkId: details.networkId, attributes };
}

/** Model CI mappings expose recorded associations, without fabricated endpoint attributes. */
export function buildCmdbModelCiView(details: CmdbModelCiDetails, definitions: CmdbAttributeDefinition[]): CmdbAssetView {
  const seen = new Set<string>();
  const attributes = [...definitions].sort((a, b) => a.displayOrder - b.displayOrder || a.key.localeCompare(b.key)).map(({ key, label, displayOrder }) => {
    if (!isModelKey(key) || seen.has(key) || !label?.trim() || !Number.isInteger(displayOrder) || displayOrder < 0) throw new Error("Invalid CMDB attribute configuration.");
    seen.add(key);
    return { key, label, value: key === "ciType" ? formatAssetTypeLabel(details.ciType) : details[key] || "Not recorded in this scope" };
  });
  return { snapshotDate: details.snapshotDate, assetId: details.ciId, assetName: details.ciName, assetType: details.ciType,
    networkId: "", topologyId: details.topologyId, systemIds: details.systemIds, attributes };
}
