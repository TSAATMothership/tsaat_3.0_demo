import { describe, expect, it } from "vitest";
import { buildDiscoveryComplianceRows, discoveryComplianceFacets, discoveryComplianceValue, discoveryComplianceSummary, emptyDiscoveryComplianceFilters, filterDiscoveryComplianceRows, parseDiscoveryComplianceFilters, type DiscoveryComplianceRecord } from "@/lib/discovery-compliance-explorer";
import { activeWorkspaceItem, WORKSPACE_GROUPS, workspaceHref } from "@/lib/workspace-navigation";

const rows: DiscoveryComplianceRecord[] = [
  { assetId: "server-1", hostname: "Alpha", assetType: "server", ipAddress: "10.0.0.1", lastDiscoveredDate: "2026-10-29T13:00:00Z", discoveredBy: "UCMDB", network: "North", system: "System A", environment: "Production", compliant: false, coveredToolCount: 1, applicableToolCount: 3, missingTools: ["Tanium", "Tenable"] },
  { assetId: "server-2", hostname: "Beta", assetType: "server", ipAddress: "10.0.0.2", lastDiscoveredDate: "2026-10-29T16:00:00Z", discoveredBy: "Tanium", network: "South", system: "System B", environment: "Test", compliant: true, coveredToolCount: 2, applicableToolCount: 2, missingTools: [] },
  { assetId: "printer-1", hostname: "Printer", assetType: "printer-device", ipAddress: "", lastDiscoveredDate: null, discoveredBy: null, network: "North", system: "System A", environment: "", compliant: false, coveredToolCount: 0, applicableToolCount: 1, missingTools: ["Tenable"] }
];

describe("discovery compliance explorer", () => {
  it("combines search and columns while allowing multiple values within a column", () => {
    expect(filterDiscoveryComplianceRows(rows, { search: " north ", columns: { assetType: ["Server", "Printer Device"], missingTools: ["Tanium"] } })).toEqual([rows[0]]);
    expect(filterDiscoveryComplianceRows(rows, { search: "", columns: { missingTools: ["Tanium", "Tenable"] } })).toEqual([rows[0], rows[2]]);
    expect(filterDiscoveryComplianceRows(rows, { search: "Production", columns: {} })).toEqual([rows[0]]);
    expect(filterDiscoveryComplianceRows(rows, { search: "server-2", columns: { compliant: ["Compliant"] } })).toEqual([rows[1]]);
    expect(filterDiscoveryComplianceRows(rows, { search: "", columns: { missingTools: ["None"] } })).toEqual([rows[1]]);
  });
  it("computes per-column facets across the full filtered dataset and ignores its own selection", () => {
    const facets = discoveryComplianceFacets(rows, { search: "", columns: { missingTools: ["Tanium"], network: ["North"] } });
    expect(facets.missingTools).toEqual([{ value: "Tanium", count: 1 }, { value: "Tenable", count: 2 }]);
    expect(facets.assetType).toEqual([{ value: "Server", count: 1 }]);
    expect(facets.network).toEqual([{ value: "North", count: 1 }]);
  });
  it("uses readable CI labels and missing-value labels consistently", () => {
    expect(discoveryComplianceValue(rows[2], "assetType")).toBe("Printer Device");
    expect(discoveryComplianceValue(rows[2], "ipAddress")).toBe("Not recorded");
    expect(discoveryComplianceValue(rows[0], "missingTools")).toBe("Tanium, Tenable");
    expect(filterDiscoveryComplianceRows(rows, { search: "not recorded", columns: {} })).toEqual([rows[2]]);
    expect(filterDiscoveryComplianceRows([], emptyDiscoveryComplianceFilters())).toEqual([]);
  });
  it("searches and filters discovery dates and sources consistently with Endpoint Explorer", () => {
    expect(discoveryComplianceValue(rows[0], "lastDiscoveredDate")).toBe("2026-10-29");
    expect(discoveryComplianceValue(rows[2], "lastDiscoveredDate")).toBe("Not recorded");
    expect(discoveryComplianceValue(rows[2], "discoveredBy")).toBe("Not recorded");
    expect(filterDiscoveryComplianceRows(rows, { search: "2026-10-29", columns: {} })).toEqual(rows.slice(0, 2));
    expect(filterDiscoveryComplianceRows(rows, { search: "ucmdb", columns: {} })).toEqual([rows[0]]);
    expect(filterDiscoveryComplianceRows(rows, { search: "", columns: { lastDiscoveredDate: ["2026-10-29"], discoveredBy: ["Tanium"] } })).toEqual([rows[1]]);
    expect(filterDiscoveryComplianceRows(rows, { search: "", columns: { discoveredBy: ["Not recorded"] } })).toEqual([rows[2]]);
    expect(discoveryComplianceFacets(rows, emptyDiscoveryComplianceFilters()).lastDiscoveredDate).toEqual([{ value: "2026-10-29", count: 2 }, { value: "Not recorded", count: 1 }]);
  });
  it("carries the recorded discovery metadata into compliance rows", () => {
    const assets = [{ id: "ci-1", name: "CI 1", hostname: "host", type: "server", networkId: "net-1", lastDiscoveredDate: "2026-10-29T13:00:00Z", discoveredBy: "UCMDB" }] as Parameters<typeof buildDiscoveryComplianceRows>[0];
    const result = buildDiscoveryComplianceRows(assets, new Map([["ci-1", { toolValues: {}, missingToolIds: [], missingToolNames: [], coverageCompliance: true }]]), { managedNetworks: [], ictSystems: [] });
    expect(result[0]).toMatchObject({ lastDiscoveredDate: "2026-10-29T13:00:00Z", discoveredBy: "UCMDB" });
  });
  it("keeps status totals available while a tile filters the table and updates weighted tool coverage", () => {
    expect(discoveryComplianceSummary(rows, emptyDiscoveryComplianceFilters())).toEqual({ total: 3, compliant: 1, gaps: 2, coveragePercent: 50 });
    const compliantFilter = { search: "", columns: { compliant: ["Compliant"] } };
    expect(filterDiscoveryComplianceRows(rows, compliantFilter)).toEqual([rows[1]]);
    expect(discoveryComplianceSummary(rows, compliantFilter)).toEqual({ total: 3, compliant: 1, gaps: 2, coveragePercent: 100 });
    const gapFilter = { search: "", columns: { compliant: ["Coverage gaps"] } };
    expect(discoveryComplianceSummary(rows, gapFilter)).toEqual({ total: 3, compliant: 1, gaps: 2, coveragePercent: 25 });
  });
  it("respects search and other columns in tile counts and handles zero matches and unmapped CIs", () => {
    const filters = { search: "north", columns: { compliant: ["Compliant"], assetType: ["Server"] } };
    expect(discoveryComplianceSummary(rows, filters)).toEqual({ total: 1, compliant: 0, gaps: 1, coveragePercent: 0 });
    expect(filterDiscoveryComplianceRows(rows, filters)).toEqual([]);
    expect(discoveryComplianceSummary(rows, { search: "unmatched", columns: {} })).toEqual({ total: 0, compliant: 0, gaps: 0, coveragePercent: 0 });
    expect(discoveryComplianceSummary([{ ...rows[1], coveredToolCount: 0, applicableToolCount: 0 }], emptyDiscoveryComplianceFilters()).coveragePercent).toBe(0);
  });
  it("validates export filters and preserves multi-select choices", () => {
    expect(parseDiscoveryComplianceFilters({ search: "alpha", columns: { missingTools: ["Tanium", "Tanium"] } })).toEqual({ search: "alpha", columns: { missingTools: ["Tanium"] } });
    for (const input of [null, { search: "", columns: { unknown: [] } }, { search: "", columns: { compliant: [true] } }, { search: "x".repeat(501), columns: {} }]) {
      expect(() => parseDiscoveryComplianceFilters(input)).toThrow();
    }
  });
  it("places the renamed explorer immediately below Discovery Tool Coverage and retains existing links", () => {
    const items = WORKSPACE_GROUPS.find((group) => group.label === "Discovery")!.items;
    const index = items.findIndex((item) => item.label === "Discovery Tool Coverage");
    expect(items[index + 1]).toEqual({ id: "discovery-compliance", label: "Discovery Compliance Explorer", href: "/discovery-coverage?discoveryView=compliance" });
    const url = new URL(workspaceHref(items[index + 1].href, new URLSearchParams("network=net-1&dataDate=2026-10-31")), "http://localhost");
    expect(activeWorkspaceItem(url.pathname, url.searchParams)?.label).toBe("Discovery Compliance Explorer");
    expect(url.searchParams.get("network")).toBe("net-1");
    expect(url.searchParams.get("dataDate")).toBe("2026-10-31");
  });
});
