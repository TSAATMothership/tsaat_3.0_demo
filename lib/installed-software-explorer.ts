import { discoveryAge, DISCOVERY_AGE_BUCKETS, NOT_RECORDED, type DiscoveryAge } from "@/lib/endpoint-explorer";

/** One installation on one endpoint; ordinal preserves multiple installations of a product. */
export interface InstalledSoftwareRecord {
  assetId: string;
  softwareOrdinal: number;
  softwareName: string;
  softwareVersion: string | null;
  filePath: string | null;
  lastDiscoveredDate: string | null;
  discoveredBy: string | null;
  deviceName: string;
  deviceModel: string | null;
  osName: string | null;
  osVersion: string | null;
  osPatchLevel: string | null;
}

export const SOFTWARE_COLUMNS = [
  { key: "softwareName", label: "Software Name" },
  { key: "softwareVersion", label: "Software Version" },
  { key: "filePath", label: "File Path" },
  { key: "lastDiscoveredDate", label: "Last Discovered Date" },
  { key: "discoveredBy", label: "Discovered By" },
  { key: "deviceName", label: "End Point Device Name" },
  { key: "deviceModel", label: "End Point Device Model" },
  { key: "osName", label: "End Point OS Name" },
  { key: "osVersion", label: "End Point OS Version" },
  { key: "osPatchLevel", label: "End Point OS Patch Level" }
] as const;
export type SoftwareColumn = typeof SOFTWARE_COLUMNS[number]["key"];
export interface SoftwareFilters {
  search: string;
  columns: Partial<Record<SoftwareColumn, string[]>>;
  recency: DiscoveryAge[];
}
export const emptySoftwareFilters = (): SoftwareFilters => ({ search: "", columns: {}, recency: [] });

export function softwareValue(row: InstalledSoftwareRecord, column: SoftwareColumn): string {
  const value = row[column]?.trim();
  if (!value) return NOT_RECORDED;
  return column === "lastDiscoveredDate" ? value.slice(0, 10) : value;
}

export function filterSoftwareRows(rows: readonly InstalledSoftwareRecord[], filters: SoftwareFilters, snapshotDate: string,
  exceptColumn?: SoftwareColumn, ignoreRecency = false): InstalledSoftwareRecord[] {
  const search = filters.search.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (search && !SOFTWARE_COLUMNS.some(({ key }) => softwareValue(row, key).toLocaleLowerCase().includes(search))) return false;
    if (!ignoreRecency && filters.recency.length && !filters.recency.includes(discoveryAge(row, snapshotDate))) return false;
    return SOFTWARE_COLUMNS.every(({ key }) => key === exceptColumn || !filters.columns[key]?.length || filters.columns[key]!.includes(softwareValue(row, key)));
  });
}

export function softwareFacetCounts(rows: readonly InstalledSoftwareRecord[], column: SoftwareColumn): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = softwareValue(row, column);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function parseSoftwareFilters(value: unknown): SoftwareFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid software filters.");
  const input = value as Record<string, unknown>;
  if (typeof input.search !== "string" || input.search.length > 500) throw new Error("Invalid software search.");
  if (!input.columns || typeof input.columns !== "object" || Array.isArray(input.columns)) throw new Error("Invalid column filters.");
  const columns: SoftwareFilters["columns"] = {};
  for (const [key, values] of Object.entries(input.columns)) {
    if (!SOFTWARE_COLUMNS.some((column) => column.key === key) || !Array.isArray(values) || values.length > 10000 ||
      !values.every((item) => typeof item === "string" && item.length <= 4096)) throw new Error("Invalid column selection.");
    columns[key as SoftwareColumn] = [...new Set(values as string[])];
  }
  if (!Array.isArray(input.recency) || input.recency.length > DISCOVERY_AGE_BUCKETS.length ||
    !input.recency.every((age) => DISCOVERY_AGE_BUCKETS.includes(age))) throw new Error("Invalid discovery age selection.");
  return { search: input.search, columns, recency: [...new Set(input.recency)] as DiscoveryAge[] };
}
