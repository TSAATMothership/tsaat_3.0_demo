export interface EndpointRecord {
  securityDomain: string;
  assetId: string;
  name: string;
  ciType: string;
  ipAddress: string | null;
  macAddress: string | null;
  deviceModel: string | null;
  lastDiscoveredDate: string | null;
  discoveredBy: string | null;
  managedNetwork: string;
}

export const ENDPOINT_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "ciType", label: "CI Type" },
  { key: "securityDomain", label: "Security Domain" },
  { key: "ipAddress", label: "IP Address" },
  { key: "macAddress", label: "MAC Address" },
  { key: "deviceModel", label: "Device Model" },
  { key: "lastDiscoveredDate", label: "Last Discovered Date" },
  { key: "discoveredBy", label: "Discovered By" },
  { key: "managedNetwork", label: "Managed Network" }
] as const;
export type EndpointColumn = typeof ENDPOINT_COLUMNS[number]["key"];
export const NOT_RECORDED = "Not recorded";
export const DISCOVERY_AGE_BUCKETS = ["Last 7 days", "8–30 days", "31–90 days", "Over 90 days", "After snapshot", NOT_RECORDED] as const;
export type DiscoveryAge = typeof DISCOVERY_AGE_BUCKETS[number];
export interface EndpointFilters {
  search: string;
  columns: Partial<Record<EndpointColumn, string[]>>;
  recency: DiscoveryAge[];
}
export const emptyEndpointFilters = (): EndpointFilters => ({ search: "", columns: {}, recency: [] });

export function endpointValue(row: EndpointRecord, column: EndpointColumn): string {
  const value = row[column]?.trim();
  if (!value) return NOT_RECORDED;
  // The date facet groups timestamps by their recorded UTC date.
  return column === "lastDiscoveredDate" ? value.slice(0, 10) : value;
}

export function discoveryAge(row: { lastDiscoveredDate: string | null }, snapshotDate: string): DiscoveryAge {
  const discovered = row.lastDiscoveredDate ? Date.parse(row.lastDiscoveredDate.slice(0, 10)) : NaN;
  const snapshot = Date.parse(snapshotDate.slice(0, 10));
  if (!Number.isFinite(discovered) || !Number.isFinite(snapshot)) return NOT_RECORDED;
  const days = Math.floor((snapshot - discovered) / 86400000);
  return days < 0 ? "After snapshot" : days <= 7 ? "Last 7 days" : days <= 30 ? "8–30 days"
    : days <= 90 ? "31–90 days" : "Over 90 days";
}

export function filterEndpointRows(
  rows: readonly EndpointRecord[], filters: EndpointFilters, snapshotDate: string,
  exceptColumn?: EndpointColumn, ignoreRecency = false
): EndpointRecord[] {
  const search = filters.search.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (search && !ENDPOINT_COLUMNS.some(({ key }) => endpointValue(row, key).toLocaleLowerCase().includes(search))) return false;
    if (!ignoreRecency && filters.recency.length && !filters.recency.includes(discoveryAge(row, snapshotDate))) return false;
    return ENDPOINT_COLUMNS.every(({ key }) => key === exceptColumn || !filters.columns[key]?.length ||
      filters.columns[key]!.includes(endpointValue(row, key)));
  });
}

export function endpointFacetCounts(rows: readonly EndpointRecord[], column: EndpointColumn): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = endpointValue(row, column);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Export accepts only the same column and chart filters supported by the table. */
export function parseEndpointFilters(value: unknown): EndpointFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid endpoint filters.");
  const input = value as Record<string, unknown>;
  if (typeof input.search !== "string" || input.search.length > 500) throw new Error("Invalid endpoint search.");
  if (!input.columns || typeof input.columns !== "object" || Array.isArray(input.columns)) throw new Error("Invalid column filters.");
  const columns: EndpointFilters["columns"] = {};
  for (const [key, values] of Object.entries(input.columns)) {
    if (!ENDPOINT_COLUMNS.some((column) => column.key === key) || !Array.isArray(values) || values.length > 10000 ||
      !values.every((item) => typeof item === "string" && item.length <= 1024)) throw new Error("Invalid column selection.");
    columns[key as EndpointColumn] = [...new Set(values as string[])];
  }
  if (!Array.isArray(input.recency) || !input.recency.every((age) => DISCOVERY_AGE_BUCKETS.includes(age))) {
    throw new Error("Invalid discovery age selection.");
  }
  return { search: input.search, columns, recency: [...new Set(input.recency)] as DiscoveryAge[] };
}
