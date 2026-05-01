import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(process.cwd(), "app", "discovery-coverage", "page.tsx"), "utf8");
const tableSource = readFileSync(
  path.join(process.cwd(), "components", "network-discovery-summary-table-client.tsx"),
  "utf8"
);

describe("Discovery network status table layout", () => {
  it("renders modelling status before discovery enabled", () => {
    expect(pageSource).toContain("modellingStatus: network.modellingStatus");
    expect(tableSource).toContain('modellingStatus: "Modelled" | "Not Modelled"');
    expect(tableSource).toMatch(/Modelling Status[\s\S]*Discovery Enabled/);
    expect(tableSource).toContain("row.modellingStatus === \"Modelled\"");
    expect(tableSource).toContain("ASSET_TYPES.length + 4");
  });

  it("keeps asset cells wide and anchors coverage at the lower left", () => {
    expect(tableSource).toContain('const STATUS_COLUMN_WIDTH_CLASS = "w-[8.5rem]"');
    expect(tableSource).toContain('const ASSET_COLUMN_WIDTH_CLASS = "w-[13rem]"');
    expect(tableSource).toContain('const TABLE_MIN_WIDTH_CLASS = "min-w-[122rem]"');
    expect(tableSource).toContain("overflow-auto");
    expect(tableSource).toContain("mt-auto shrink-0 text-left");
    expect(tableSource).toContain('const MISSING_CALLOUT_SLOT_CLASS = "h-[1.35rem] shrink-0 w-full"');
    expect(tableSource).toContain('const COMBINED_MISSING_CALLOUT_SPACER_CLASS = "h-[0.8rem] w-full shrink-0"');
    expect(tableSource).toContain('const COMBINED_MISSING_CALLOUT_SLOT_CLASS = "h-[4.05rem] shrink-0 w-full"');
    expect(tableSource).toContain("text-[10px] font-semibold uppercase tracking-[0.08em]");
    expect(tableSource).toContain("flex items-end");
  });

  it("shows coverage as n.a unless both target state and discovery data are usable", () => {
    expect(tableSource).toContain("function formatCoverageLabel(summary: NetworkTargetStateCellSummary): string");
    expect(tableSource).toContain('if (summary.state !== "ok")');
    expect(tableSource).toContain('return "n.a"');
    expect(tableSource).toContain("const coverageLabel = formatCoverageLabel(summary)");
  });

  it("offers a target-state template download from the details slideout", () => {
    expect(tableSource).toContain("buildNetworkTargetStateTemplateHref");
    expect(tableSource).toContain("Generate Target State Template");
    expect(tableSource).toContain("bg-amber-500/15");
  });

  it("adds modelling and discovery-enabled filters to the Network Discovery Status tab", () => {
    expect(pageSource).toContain('key: "modellingStatus"');
    expect(pageSource).toContain('label: "Modelling Status"');
    expect(pageSource).toContain('key: "discoveryEnabled"');
    expect(pageSource).toContain('label: "Discovery Enabled"');
    expect(pageSource).toContain("targetStateNetworks");
  });
});
