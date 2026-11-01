import { describe, expect, it } from "vitest";
import { emptyExplorerTableFilters, prepareExplorerRows, queryExplorerRows, type ExplorerColumn, type ExplorerTableFilters, type ExplorerTableSort } from "@/lib/explorer-table";

const rows = [
  { id: "1", severity: "High Risk", status: "Open", priority: 1 },
  { id: "2", severity: "Moderate", status: "Open", priority: 2 },
  { id: "3", severity: "High Risk", status: "Closed", priority: 1 },
  { id: "4", severity: "Moderate", status: "Closed", priority: 2 }
];
const columns = [
  { key: "severity", label: "Severity", value: (row: typeof rows[number]) => row.severity },
  { key: "status", label: "Status", value: (row: typeof rows[number]) => row.status },
  { key: "priority", label: "Priority", value: (row: typeof rows[number]) => row.priority }
];
const prepared = prepareExplorerRows(rows, columns, (row) => `CI-${row.id}`);
describe("findings explorer filtering", () => {
  it("intersects columns while allowing multiple selected values within a column", () => {
    const result = queryExplorerRows(prepared, columns, { search: "", columns: { severity: ["High Risk", "Moderate"], status: ["Open"], priority: ["1"] } });
    expect(result.filtered.map((row) => row.id)).toEqual(["1"]);
    expect(rows).toHaveLength(4);
  });
  it("counts alternatives against all other filters without hiding the selected column's alternatives", () => {
    const result = queryExplorerRows(prepared, columns, { search: "", columns: { severity: ["High Risk"], status: ["Open"] } });
    expect(result.facets.severity).toEqual([{ value: "High Risk", count: 1 }, { value: "Moderate", count: 1 }]);
    expect(result.facets.status).toEqual([{ value: "Closed", count: 1 }, { value: "Open", count: 1 }]);
    expect(result.facets.priority).toEqual([{ value: "1", count: 1 }]);
  });
  it("searches displayed values and evidence context, and handles unmatched selections safely", () => {
    expect(queryExplorerRows(prepared, columns, { search: " CI-3 ", columns: {} }).filtered).toEqual([rows[2]]);
    expect(queryExplorerRows(prepared, columns, { search: "HIGH RISK", columns: { status: ["Open"] } }).filtered).toEqual([rows[0]]);
    const missing = queryExplorerRows(prepared, columns, { search: "", columns: { severity: ["Critical Exposure"] } });
    expect(missing.filtered).toEqual([]);
    expect(missing.facets.severity).toEqual([{ value: "High Risk", count: 2 }, { value: "Moderate", count: 2 }]);
  });
  it("returns the complete matching result set for pagination and exports, including records past the old limits", () => {
    const many = Array.from({ length: 601 }, (_, i) => ({ ...rows[i % 4], id: String(i) }));
    const result = queryExplorerRows(prepareExplorerRows(many, columns), columns, { search: "", columns: { severity: ["High Risk"] } });
    expect(result.filtered).toHaveLength(301);
    expect(result.filtered.at(-1)?.id).toBe("600");
    expect(queryExplorerRows([], columns, emptyExplorerTableFilters())).toEqual({ filtered: [], facets: { severity: [], status: [], priority: [] } });
  });
});

describe("numeric range filtering", () => {
  const durationRows = [
    { id: "today", days: 0, severity: "High Risk" },
    { id: "five", days: 5, severity: "High Risk" },
    { id: "ten", days: 10, severity: "Moderate" },
    { id: "twenty", days: 20, severity: "High Risk" },
    { id: "closed", days: null, severity: "Moderate" }
  ];
  const durationColumns: ExplorerColumn<typeof durationRows[number]>[] = [
    { key: "duration", label: "Duration", value: row => row.days === null ? "\u2014" : `${row.days} days`,
      range: { value: row => row.days, unit: "days", min: 0, step: 1, sortable: true } },
    { key: "severity", label: "Severity", value: row => row.severity }
  ];
  const durationPrepared = prepareExplorerRows(durationRows, durationColumns);
  const query = (filters: Partial<ExplorerTableFilters>, sort?: ExplorerTableSort) => queryExplorerRows(durationPrepared, durationColumns, { search: "", columns: {}, ...filters }, sort);

  it("includes both range boundaries and excludes findings without an open duration", () => {
    expect(query({ ranges: { duration: { min: 5, max: 10 } } }).filtered.map(row => row.id)).toEqual(["five", "ten"]);
    expect(query({ ranges: { duration: { min: 0, max: 0 } } }).filtered.map(row => row.id)).toEqual(["today"]);
  });

  it("supports either bound alone and clearing a range restores missing durations too", () => {
    expect(query({ ranges: { duration: { min: 10 } } }).filtered.map(row => row.id)).toEqual(["ten", "twenty"]);
    expect(query({ ranges: { duration: { max: 5 } } }).filtered.map(row => row.id)).toEqual(["today", "five"]);
    expect(query({ ranges: { duration: {} } }).filtered).toEqual(durationRows);
    expect(query(emptyExplorerTableFilters()).filtered).toEqual(durationRows);
  });

  it("combines ranges with table search and other column filters", () => {
    expect(query({ ranges: { duration: { min: 5, max: 20 } }, columns: { severity: ["High Risk"] } }).filtered.map(row => row.id)).toEqual(["five", "twenty"]);
    expect(query({ ranges: { duration: { min: 5, max: 20 } }, search: "10 days" }).filtered.map(row => row.id)).toEqual(["ten"]);
    expect(query({ ranges: { duration: { min: 50, max: 100 } } }).filtered).toEqual([]);
  });

  it("keeps duration alternatives visible while applying ranges to other columns' counts", () => {
    const result = query({ ranges: { duration: { min: 5, max: 10 } }, columns: { duration: ["5 days"] } });
    expect(result.filtered.map(row => row.id)).toEqual(["five"]);
    expect(result.facets.duration).toHaveLength(5);
    expect(result.facets.severity).toEqual([{ value: "High Risk", count: 1 }]);
  });

  it("sorts days numerically in either direction, keeping missing durations last and ties stable", () => {
    const mixedRows = [durationRows[4], durationRows[2], { ...durationRows[0], id: "hundred", days: 100 },
      durationRows[1], durationRows[0], { ...durationRows[2], id: "ten-again" }, { ...durationRows[0], id: "invalid", days: NaN }];
    const mixedPrepared = prepareExplorerRows(mixedRows, durationColumns);
    const sorted = (direction: "asc" | "desc") => queryExplorerRows(mixedPrepared, durationColumns, emptyExplorerTableFilters(), { key: "duration", direction }).filtered.map(row => row.id);
    expect(sorted("asc")).toEqual(["today", "five", "ten", "ten-again", "hundred", "closed", "invalid"]);
    expect(sorted("desc")).toEqual(["hundred", "ten", "ten-again", "five", "today", "closed", "invalid"]);
    expect(mixedRows.map(row => row.id)).toEqual(["closed", "ten", "hundred", "five", "today", "ten-again", "invalid"]);
    expect(queryExplorerRows(mixedPrepared, durationColumns, emptyExplorerTableFilters()).filtered).toEqual(mixedRows);
  });

  it("sorts all filtered results before pagination and export without changing facet counts", () => {
    const filters = { ranges: { duration: { min: 5, max: 20 } }, columns: { severity: ["High Risk"] }, search: "days" };
    const result = query(filters, { key: "duration", direction: "desc" });
    expect(result.filtered.map(row => row.id)).toEqual(["twenty", "five"]);
    expect(result.facets).toEqual(query(filters).facets);
    const many = Array.from({ length: 61 }, (_, days) => ({ id: String(days), days, severity: "High Risk" }));
    const all = queryExplorerRows(prepareExplorerRows(many, durationColumns), durationColumns, emptyExplorerTableFilters(), { key: "duration", direction: "desc" }).filtered;
    expect(all.slice(0, 50).map(row => row.days)).toEqual(Array.from({ length: 50 }, (_, index) => 60 - index));
    expect(all.at(-1)?.days).toBe(0);
    expect(all).toHaveLength(61);
  });
});
