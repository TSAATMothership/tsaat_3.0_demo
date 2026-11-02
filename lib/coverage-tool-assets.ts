import type { DiscoveryCoverageValue } from "@/lib/discovery-coverage";

export interface CoverageToolAsset {
  assetId: string;
  hostname: string;
  ipAddress: string;
  assetType: string;
  network: string;
  ictSystem: string;
  environment: string;
  toolValue: DiscoveryCoverageValue;
  coverageCompliance: boolean;
}

export const TOOL_ASSET_COLUMNS = [
  { key: "hostname", label: "Asset" },
  { key: "ipAddress", label: "IP address" },
  { key: "assetType", label: "Type" },
  { key: "network", label: "Network" },
  { key: "ictSystem", label: "ICT system" },
  { key: "environment", label: "Environment" },
  { key: "toolValue", label: "Tool coverage" },
  { key: "coverageCompliance", label: "Coverage compliance" }
] as const;
export type ToolAssetColumn = typeof TOOL_ASSET_COLUMNS[number]["key"];
export type ToolAssetFilters = Partial<Record<ToolAssetColumn, string[]>>;
export type ToolAssetFacets = Partial<Record<ToolAssetColumn, { value: string; count: number }[]>>;

export function toolAssetValue(row: CoverageToolAsset, key: ToolAssetColumn): string {
  if (key === "coverageCompliance") return row.coverageCompliance ? "Yes" : "No";
  if (key === "toolValue") return row.toolValue === null ? "N/A" : String(row.toolValue);
  return row[key] || "Not recorded";
}

export function readToolAssetFilters(params: URLSearchParams): ToolAssetFilters {
  return Object.fromEntries(TOOL_ASSET_COLUMNS.map(({ key }) => [key, [...new Set(params.getAll(`toolColumn.${key}`))]]));
}

export function filterToolAssets(rows: CoverageToolAsset[], search: string, filters: ToolAssetFilters, except?: ToolAssetColumn) {
  const query = search.trim().toLocaleLowerCase();
  return rows.filter((row) => (!query || [row.assetId, ...TOOL_ASSET_COLUMNS.map(({ key }) => toolAssetValue(row, key))]
    .join(" ").toLocaleLowerCase().includes(query)) && TOOL_ASSET_COLUMNS.every(({ key }) =>
    key === except || !filters[key]?.length || filters[key]!.includes(toolAssetValue(row, key))));
}

export function toolAssetFacets(rows: CoverageToolAsset[], search: string, filters: ToolAssetFilters): ToolAssetFacets {
  return Object.fromEntries(TOOL_ASSET_COLUMNS.map(({ key }) => {
    const counts = new Map<string, number>();
    for (const row of filterToolAssets(rows, search, filters, key)) {
      const value = toolAssetValue(row, key);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [key, [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }))];
  }));
}
