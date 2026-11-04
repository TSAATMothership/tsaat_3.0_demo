// Retained for existing analyser data API callers; the Network Impact Analyser UI is retired.
export const NETWORK_IMPACT_ASSET_PARAM = "impactAssetId";

/** Null means no filter; malformed/blank selections remain an empty, restrictive filter. */
export function readNetworkImpactAssetId(value: string | string[] | null | undefined): string | null {
  return value == null ? null : typeof value === "string" ? value.trim() : "";
}

export function filterNetworkImpactAssetRows<T extends { assetId: string }>(rows: T[], params: URLSearchParams): T[] {
  const values = params.getAll(NETWORK_IMPACT_ASSET_PARAM);
  const assetId = readNetworkImpactAssetId(values.length > 1 ? values : values[0]);
  return assetId === null ? rows : rows.filter(row => row.assetId === assetId);
}
