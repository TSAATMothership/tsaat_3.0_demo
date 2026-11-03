import type { Asset } from "@/lib/types";
import { scopeIds } from "@/lib/workspace-navigation";

export const NETWORK_IMPACT_ASSET_PARAM = "impactAssetId";

export interface NetworkImpactAssetFilter {
  assetId: string;
  assetName: string;
  networkId: string | null;
}

/** Null means no filter; malformed/blank selections remain an empty, restrictive filter. */
export function readNetworkImpactAssetId(value: string | string[] | null | undefined): string | null {
  return value == null ? null : typeof value === "string" ? value.trim() : "";
}

export function resolveNetworkImpactAssetFilter(
  value: string | string[] | undefined,
  scopedAssets: Asset[],
  availableNetworks: Array<{ id: string }>
): NetworkImpactAssetFilter | null {
  const assetId = readNetworkImpactAssetId(value);
  if (assetId === null) return null;
  const asset = scopedAssets.find(candidate => candidate.id === assetId);
  return {
    assetId,
    assetName: asset?.name || asset?.hostname || assetId,
    networkId: asset && availableNetworks.some(network => network.id === asset.networkId) ? asset.networkId : null
  };
}

export function filterNetworkImpactAssetRows<T extends { assetId: string }>(rows: T[], params: URLSearchParams): T[] {
  const values = params.getAll(NETWORK_IMPACT_ASSET_PARAM);
  const assetId = readNetworkImpactAssetId(values.length > 1 ? values : values[0]);
  return assetId === null ? rows : rows.filter(row => row.assetId === assetId);
}

export function buildNetworkImpactHref(
  asset: { assetId: string; networkId: string; snapshotDate: string },
  workspaceSearch: string
): string {
  const current = new URLSearchParams(workspaceSearch);
  const params = new URLSearchParams({ copView: "network-impact-analyser" });
  if (current.has("securityDomain")) params.set("securityDomain", current.getAll("securityDomain").join(","));
  const networks = scopeIds(current.getAll("network"));
  const systems = scopeIds(current.getAll("system"));
  if (networks.length) params.set("network", networks.join(","));
  else if (systems.length) params.set("system", systems.join(","));
  else params.set("network", asset.networkId);
  params.set("dataDate", asset.snapshotDate);
  params.set(NETWORK_IMPACT_ASSET_PARAM, asset.assetId);
  return `/cyber-cop?${params.toString()}`;
}
