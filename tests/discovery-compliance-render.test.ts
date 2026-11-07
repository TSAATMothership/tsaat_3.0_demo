import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DiscoveryComplianceExplorer } from "@/components/discovery-compliance-explorer";
import { PersonaProvider } from "@/components/persona-provider";
import { CmdbDrillThroughProvider } from "@/components/cmdb-drill-through";
import type { DiscoveryComplianceFilters, DiscoveryComplianceRecord } from "@/lib/discovery-compliance-explorer";

const row = (patch: Partial<DiscoveryComplianceRecord>): DiscoveryComplianceRecord => ({
  assetId: "ci-1", hostname: "Alpha", ipAddress: "10.0.0.1", assetType: "server", network: "North", system: "System A", environment: "Production",
  lastDiscoveredDate: "2026-11-06T01:00:00Z", discoveredBy: "Agent", compliant: false, coveredToolCount: 1, applicableToolCount: 3,
  missingTools: ["Tanium", "Tenable"], ...patch
});
const rows = [row({}), row({ assetId: "ci-2", hostname: "Beta", missingTools: ["Tanium"], coveredToolCount: 2 }),
  row({ assetId: "ci-3", hostname: "Gamma", discoveredBy: null, lastDiscoveredDate: null, compliant: true, coveredToolCount: 3, missingTools: [] })];
beforeEach(() => vi.stubGlobal("React", React)); afterEach(() => vi.unstubAllGlobals());
function render(records = rows, initialFilters?: DiscoveryComplianceFilters) {
  return renderToStaticMarkup(React.createElement(PersonaProvider, { children: React.createElement(CmdbDrillThroughProvider, {
    children: React.createElement(DiscoveryComplianceExplorer, { rows: records, snapshotDate: "2026-11-07", scope: { network: "net-1" }, initialFilters })
  }) }));
}
it("presents four shared explorer charts with CI counts, missing values and overlapping missing tools", () => {
  const html = render();
  expect(html).toContain('class="endpoint-explorer discovery-compliance-page"');
  expect(html.match(/summary chart"/g)).toHaveLength(4);
  for (const label of ["Discovery compliance: Coverage gaps, 2 records", "Discovery compliance: Compliant, 1 records", "Missing discovery tools: Tanium, 2 records",
    "Missing discovery tools: Tenable, 1 records", "Missing discovery tools: None, 1 records", "Discovered by: Not recorded, 1 records", "Last discovered: 2026-11-06, 2 records"]) expect(html).toContain(label);
  expect(html).toContain("Counts can overlap"); expect(html).toContain("66.7% of required tool checks covered");
  expect(html).toContain("2026-11-07"); expect(html).toContain('data-cmdb-asset-id="ci-1"');
  expect(html).not.toContain('class="coverage-snapshot');
});
it("uses existing initial filters for selected chart bars, matching rows and coverage percentage", () => {
  const html = render(rows, { search: "", columns: { missingTools: ["Tenable"] } });
  expect(html).toContain('aria-pressed="true" aria-label="Missing discovery tools: Tenable, 1 records"');
  expect(html).toContain('aria-label="Clear Missing Tools filter"');
  expect(html).toContain("1 matching records"); expect(html).toContain("33.3% of required tool checks covered");
  expect(html).toContain('data-cmdb-asset-id="ci-1"'); expect(html).not.toContain('data-cmdb-asset-id="ci-2"');
});
it("keeps the empty inventory state and disables export while every chart has no matching records", () => {
  const html = render([]);
  expect(html.match(/class="endpoint-chart-empty"/g)).toHaveLength(4);
  expect(html).toContain("No matching CIs"); expect(html).toContain("No CIs are available for this scope and date.");
  expect(html).toMatch(/class="endpoint-export"[^>]*disabled=""/);
});
