import { createAssetTypeRecord } from "@/lib/asset-taxonomy";
import { describe, expect, it } from "vitest";
import { coverageToolStatus, coverageToolValue, coverageToolsCsv, filterCoverageTools, sortCoverageTools, type CoverageToolStat } from "@/lib/coverage-tool-explorer";

const tools: CoverageToolStat[] = [
  { id: "scanner", label: "Scanner", applicable: 10, covered: 6, missing: 4, coveragePercent: 60 },
  { id: "inventory", label: "Inventory", applicable: 10, covered: 10, missing: 0, coveragePercent: 100 },
  { id: "agent", label: "Agent", applicable: 0, covered: 0, missing: 0, coveragePercent: 0 },
  { id: "monitor", label: "Monitor", applicable: 20, covered: 14, missing: 6, coveragePercent: 70 }
];

describe("coverage tool explorer", () => {
  it("distinguishes no applicable assets from full coverage", () => {
    expect(coverageToolStatus(tools[2])).toBe("Not applicable");
    expect(coverageToolValue(tools[2], "coveragePercent")).toBe("N/A");
    expect(coverageToolStatus(tools[1])).toBe("Fully covered");
    expect(coverageToolStatus(tools[0])).toBe("Coverage gaps");
  });
  it("combines search with OR within a column and AND between columns", () => {
    expect(filterCoverageTools(tools, " coverage gaps ", { label: ["Scanner", "Monitor"], applicable: ["10"] })).toEqual([tools[0]]);
    expect(filterCoverageTools(tools, "unmatched", {})).toEqual([]);
    expect(filterCoverageTools([], "", {})).toEqual([]);
  });
  it("ignores only the current column selection when computing available facets", () => {
    const filters = { label: ["Scanner"], status: ["Coverage gaps"] };
    expect(filterCoverageTools(tools, "", filters, "label")).toEqual([tools[0], tools[3]]);
    expect(filterCoverageTools(tools, "scan", filters, "label")).toEqual([tools[0]]);
  });
  it("prioritises missing coverage and puts not-applicable tools last for coverage sorting", () => {
    expect(sortCoverageTools(tools, "gaps").map((tool) => tool.id)).toEqual(["monitor", "scanner", "agent", "inventory"]);
    expect(sortCoverageTools(tools, "coverage").map((tool) => tool.id)).toEqual(["scanner", "monitor", "inventory", "agent"]);
    expect(tools[0].id).toBe("scanner");
  });
  it("includes each tool's denominator breakdown in the CSV", () => {
    const csv = coverageToolsCsv([{ ...tools[0], applicableByCiType: createAssetTypeRecord((type) => type === "server" ? 7 : type === "workstation" ? 3 : 0) }]);
    const [header, row] = csv.split("\r\n");
    expect(header).toContain('"Server CIs used","Workstation CIs used","Network Device CIs used","Storage Device CIs used","Printer Device CIs used","Other CIs used","IP Node CIs used"');
    expect(row).toBe('"Scanner","Coverage gaps","10","6","4","60%","7","3","0","0","0","0","0"');
  });
  it("exports the full filtered selection, escapes CSV and neutralises formula-like names", () => {
    const selected = filterCoverageTools(tools, "", { status: ["Coverage gaps"] });
    const csv = coverageToolsCsv(selected);
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv).toContain('"Scanner","Coverage gaps","10","6","4","60%"');
    expect(csv).not.toContain('"Inventory"');
    expect(coverageToolsCsv([{ ...tools[0], label: '=HYPERLINK("test")' }])).toContain('"\'=HYPERLINK(""test"")"');
  });
});
