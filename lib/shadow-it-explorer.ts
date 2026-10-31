import { discoveryAge, DISCOVERY_AGE_BUCKETS, NOT_RECORDED, type DiscoveryAge } from "@/lib/endpoint-explorer";

export type DiscoveryApproach = "IP Scan" | "ARP Table";
export const NOT_APPLICABLE = "N/A";
export interface ShadowItRecord {
  assetId: string;
  ownerAssetId: string | null;
  ipAddress: string;
  discoveryApproach: DiscoveryApproach;
  lastDiscoveredDate: string | null;
  discoveredBy: string | null;
  endpointName: string | null;
  endpointCiType: string | null;
  endpointIpAddress: string | null;
  endpointMacAddress: string | null;
  endpointDeviceModel: string | null;
  endpointLastDiscoveredDate: string | null;
  endpointDiscoveredBy: string | null;
  endpointManagedNetwork: string | null;
}
export const SHADOW_COLUMNS = [
  { key: "ipAddress", label: "IP Address" },
  { key: "discoveryApproach", label: "Discovery Approach" },
  { key: "lastDiscoveredDate", label: "Last Discovered Date" },
  { key: "discoveredBy", label: "Discovered By" },
  { key: "endpointName", label: "End Point Name" },
  { key: "endpointCiType", label: "End Point CI Type" },
  { key: "endpointIpAddress", label: "End Point IP Address" },
  { key: "endpointMacAddress", label: "End Point MAC Address" },
  { key: "endpointDeviceModel", label: "End Point Device Model" },
  { key: "endpointLastDiscoveredDate", label: "End Point Last Discovered Date" },
  { key: "endpointDiscoveredBy", label: "End Point Discovered By" },
  { key: "endpointManagedNetwork", label: "End Point Managed Network" }
] as const;
export type ShadowColumn = typeof SHADOW_COLUMNS[number]["key"];
export type ShadowOwnerColumn = Extract<ShadowColumn, `endpoint${string}`>;
export const isOwnerColumn = (column: ShadowColumn): column is ShadowOwnerColumn => column.startsWith("endpoint");
export interface ShadowFilters { search: string; columns: Partial<Record<ShadowColumn, string[]>>; recency: DiscoveryAge[] }
export const emptyShadowFilters = (): ShadowFilters => ({ search: "", columns: {}, recency: [] });

export function shadowValue(row: ShadowItRecord, column: ShadowColumn): string {
  if (row.discoveryApproach === "IP Scan" && isOwnerColumn(column)) return NOT_APPLICABLE;
  const value = row[column]?.trim();
  if (!value) return NOT_RECORDED;
  return column === "lastDiscoveredDate" || column === "endpointLastDiscoveredDate" ? value.slice(0, 10) : value;
}
export function filterShadowRows(rows: readonly ShadowItRecord[], filters: ShadowFilters, snapshotDate: string,
  exceptColumn?: ShadowColumn, ignoreRecency = false): ShadowItRecord[] {
  const search = filters.search.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (search && !SHADOW_COLUMNS.some(({ key }) => shadowValue(row, key).toLocaleLowerCase().includes(search))) return false;
    if (!ignoreRecency && filters.recency.length && !filters.recency.includes(discoveryAge(row, snapshotDate))) return false;
    return SHADOW_COLUMNS.every(({ key }) => key === exceptColumn || !filters.columns[key]?.length || filters.columns[key]!.includes(shadowValue(row, key)));
  });
}
export function shadowFacetCounts(rows: readonly ShadowItRecord[], column: ShadowColumn): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) { const value = shadowValue(row, column); counts.set(value, (counts.get(value) ?? 0) + 1); }
  return Array.from(counts, ([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
export function parseShadowFilters(value: unknown): ShadowFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Shadow IT filters.");
  const input = value as Record<string, unknown>;
  if (typeof input.search !== "string" || input.search.length > 500) throw new Error("Invalid search.");
  if (!input.columns || typeof input.columns !== "object" || Array.isArray(input.columns)) throw new Error("Invalid column filters.");
  const columns: ShadowFilters["columns"] = {};
  for (const [key, values] of Object.entries(input.columns)) {
    if (!SHADOW_COLUMNS.some((column) => column.key === key) || !Array.isArray(values) || values.length > 10000 ||
      !values.every((item) => typeof item === "string" && item.length <= 1024)) throw new Error("Invalid column selection.");
    columns[key as ShadowColumn] = [...new Set(values as string[])];
  }
  if (!Array.isArray(input.recency) || input.recency.length > DISCOVERY_AGE_BUCKETS.length ||
    !input.recency.every((age) => DISCOVERY_AGE_BUCKETS.includes(age))) throw new Error("Invalid discovery age selection.");
  return { search: input.search, columns, recency: [...new Set(input.recency)] as DiscoveryAge[] };
}
