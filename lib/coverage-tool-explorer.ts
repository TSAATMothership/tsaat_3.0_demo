import { ASSET_TYPES, ASSET_TYPE_LABELS, type CanonicalAssetType } from "@/lib/asset-taxonomy";

export interface CoverageToolStat {
  id: string;
  label: string;
  covered: number;
  missing: number;
  applicable: number;
  applicableByCiType?: Record<CanonicalAssetType, number>;
  coveragePercent: number;
}

export const COVERAGE_TOOL_COLUMNS = [
  { key: "label", label: "Discovery tool" },
  { key: "status", label: "Status" },
  { key: "applicable", label: "Applicable CIs" },
  { key: "covered", label: "Covered assets" },
  { key: "missing", label: "Missing coverage" },
  { key: "coveragePercent", label: "Coverage" }
] as const;
export type CoverageToolColumn = typeof COVERAGE_TOOL_COLUMNS[number]["key"];
export type CoverageToolFilters = Partial<Record<CoverageToolColumn, string[]>>;
export type CoverageToolSort = "name" | "gaps" | "coverage";

export function coverageToolStatus(tool: CoverageToolStat): string {
  return !tool.applicable ? "Not applicable" : tool.missing ? "Coverage gaps" : "Fully covered";
}

export function coverageToolValue(tool: CoverageToolStat, key: CoverageToolColumn): string {
  if (key === "status") return coverageToolStatus(tool);
  if (key === "coveragePercent") return tool.applicable ? `${tool.coveragePercent}%` : "N/A";
  return String(tool[key]);
}

export function filterCoverageTools(tools: CoverageToolStat[], search: string, filters: CoverageToolFilters, except?: CoverageToolColumn) {
  const query = search.trim().toLocaleLowerCase();
  return tools.filter((tool) => (!query || [tool.id, ...COVERAGE_TOOL_COLUMNS.map(({ key }) => coverageToolValue(tool, key))]
    .join(" ").toLocaleLowerCase().includes(query)) && COVERAGE_TOOL_COLUMNS.every(({ key }) =>
    key === except || !filters[key]?.length || filters[key]!.includes(coverageToolValue(tool, key))));
}

export function sortCoverageTools(tools: CoverageToolStat[], sort: CoverageToolSort) {
  return [...tools].sort((a, b) => (sort === "gaps" ? b.missing - a.missing
    : sort === "coverage" ? (a.applicable ? a.coveragePercent : Infinity) - (b.applicable ? b.coveragePercent : Infinity) : 0)
    || a.label.localeCompare(b.label));
}

export function coverageToolsCsv(tools: CoverageToolStat[]): string {
  const cell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'" : "") + value.replace(/"/g, '""')}"`;
  return [[...COVERAGE_TOOL_COLUMNS.map(({ label }) => label), ...ASSET_TYPES.map((type) => `${ASSET_TYPE_LABELS[type]} CIs used`)],
    ...tools.map((tool) => [...COVERAGE_TOOL_COLUMNS.map(({ key }) => coverageToolValue(tool, key)),
      ...ASSET_TYPES.map((type) => tool.applicableByCiType ? String(tool.applicableByCiType[type]) : "")])]
    .map((row) => row.map(cell).join(",")).join("\r\n");
}
