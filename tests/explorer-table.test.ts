import { describe, expect, it } from "vitest";
import { emptyExplorerTableFilters, prepareExplorerRows, queryExplorerRows } from "@/lib/explorer-table";

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
