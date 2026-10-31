import type { SpiReportAssetTypeBreakdown } from "@/lib/spi-report-model";
import type { Filters } from "@/lib/types";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export interface MeasureRecord {
  id: string;
  name: string;
  description: string;
  successMeasure: string;
  scorePercent: number;
  compliant: number;
  nonCompliant: number;
  unknown: number;
  total: number;
  reportHref: string | null;
  trendHref: string | null;
  assetTypeBreakdown: SpiReportAssetTypeBreakdown[];
  highPriorityCount?: number;
}
export const MEASURE_COLUMNS = [
  { key: "id", label: "Indicator ID" }, { key: "name", label: "Measure" },
  { key: "result", label: "Observed result" }, { key: "score", label: "Compliance" },
  { key: "total", label: "Assessed" }, { key: "compliant", label: "Compliant" },
  { key: "nonCompliant", label: "Non-compliant" }, { key: "unknown", label: "Unknown" },
  { key: "reports", label: "Reports" }
] as const;
export type MeasureColumn = typeof MEASURE_COLUMNS[number]["key"];
export interface MeasureFilters { search: string; columns: Partial<Record<MeasureColumn, string[]>> }
export const emptyMeasureFilters = (): MeasureFilters => ({ search: "", columns: {} });
export const MEASURE_RESULTS = ["Non-compliant", "Unknown", "Fully compliant", "No assessments"] as const;

export function measureResults(row: MeasureRecord): string[] {
  if (!row.total) return ["No assessments"];
  const values = [];
  if (row.nonCompliant > 0) values.push("Non-compliant");
  if (row.unknown > 0) values.push("Unknown");
  if (row.compliant === row.total) values.push("Fully compliant");
  return values.length ? values : ["Review"];
}
export function measureValues(row: MeasureRecord, column: MeasureColumn): string[] {
  if (column === "result") return measureResults(row);
  if (column === "score") return [row.total ? `${row.scorePercent}%` : "N/A"];
  if (column === "reports") {
    const available = [row.reportHref ? "Current report" : "", row.trendHref ? "Trend report" : ""].filter(Boolean);
    return available.length ? available : ["Unavailable"];
  }
  return [String(row[column])];
}
export function filterMeasureRows(rows: readonly MeasureRecord[], filters: MeasureFilters, exceptColumn?: MeasureColumn): MeasureRecord[] {
  const search = filters.search.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (search && ![row.description, row.successMeasure, ...MEASURE_COLUMNS.flatMap(({ key }) => measureValues(row, key))].join(" ").toLocaleLowerCase().includes(search)) return false;
    return MEASURE_COLUMNS.every(({ key }) => key === exceptColumn || !filters.columns[key]?.length ||
      measureValues(row, key).some((value) => filters.columns[key]!.includes(value)));
  });
}
export function measureFacets(rows: readonly MeasureRecord[], filters: MeasureFilters, column: MeasureColumn) {
  const counts = new Map<string, number>();
  for (const row of filterMeasureRows(rows, filters, column)) {
    for (const value of measureValues(row, column)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, count }));
}
export function parseMeasureFilters(value: unknown): MeasureFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid measure filters.");
  const input = value as Record<string, unknown>;
  if (typeof input.search !== "string" || input.search.length > 500) throw new Error("Invalid measure search.");
  if (!input.columns || typeof input.columns !== "object" || Array.isArray(input.columns)) throw new Error("Invalid measure columns.");
  const columns: MeasureFilters["columns"] = {};
  for (const [key, values] of Object.entries(input.columns)) {
    if (!MEASURE_COLUMNS.some((column) => column.key === key) || !Array.isArray(values) || values.length > 1000 ||
      !values.every((item) => typeof item === "string" && item.length <= 4096)) throw new Error("Invalid measure selection.");
    columns[key as MeasureColumn] = [...new Set(values as string[])];
  }
  return { search: input.search, columns };
}
export function initialMeasureFilters(params: WorkspaceSearchParams, selectedSpiId?: number): MeasureFilters {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const raw = first(params.measureFilters);
  if (raw && raw.length <= 12000) {
    try { return parseMeasureFilters(JSON.parse(raw)); } catch { /* Fall back to legacy links. */ }
  }
  return { search: (first(params.measureSearch) ?? "").slice(0, 500), columns: selectedSpiId ? { id: [`SPI-${selectedSpiId}`] } : {} };
}
export function measuresScopeParams(filters: Filters, snapshotDate: string): URLSearchParams {
  const params = new URLSearchParams({ dataDate: snapshotDate });
  const fields = { managedNetwork: "network", ictSystem: "system", systemCriticality: "criticality", securityDomain: "securityDomain", environment: "environment", assetType: "assetType", severity: "severity", missionCapability: "mission", businessService: "service" } as const;
  for (const [field, key] of Object.entries(fields)) {
    const value = filters[field as keyof Filters];
    if (value) params.set(key, value);
  }
  return params;
}
export function measuresHref(tab: "summary" | "measures-kpi" | "measures-spi" | "spi-settings", filters: Filters, snapshotDate: string, selection?: MeasureFilters): string {
  const params = measuresScopeParams(filters, snapshotDate);
  if (tab === "spi-settings") {
    params.set("settingsTab", "spi-risk-matrix");
    return `/settings?${params}`;
  }
  params.set("measuresTab", tab);
  if (selection) params.set("measureFilters", JSON.stringify(selection));
  return `/measures?${params}`;
}
export function measuresFindingsHref(filters: Filters, snapshotDate: string, selection: { severity?: string; spi?: number; priority?: number } = {}): string {
  const params = measuresScopeParams(filters, snapshotDate);
  params.set("findingsViewTab", "register"); params.set("findingsTab", "open"); params.set("asOf", snapshotDate);
  for (const [key, value] of Object.entries(selection)) if (value !== undefined) params.set(key, String(value));
  return `/findings?${params}`;
}
