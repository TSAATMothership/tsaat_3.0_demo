import { describe, expect, it } from "vitest";
import { SHADOW_COLUMNS, emptyShadowFilters, filterShadowRows, shadowFacetCounts, shadowValue, parseShadowFilters, type ShadowItRecord } from "@/lib/shadow-it-explorer";
import { formatAssetTypeLabel, isAssetType } from "@/lib/asset-taxonomy";

export const arpRow: ShadowItRecord = { assetId: "node-1", ownerAssetId: "switch-1", ipAddress: "10.88.0.1", discoveryApproach: "ARP Table",
  lastDiscoveredDate: "2026-10-30T12:00:00Z", discoveredBy: "ARP Collector", endpointName: "Core switch", endpointCiType: "Network Device",
  endpointIpAddress: "10.77.0.1", endpointMacAddress: "02:77:00:00:00:01", endpointDeviceModel: "Switch Model",
  endpointLastDiscoveredDate: "2026-10-20T12:00:00Z", endpointDiscoveredBy: "Inventory Agent", endpointManagedNetwork: "East" };
const scan: ShadowItRecord = { ...arpRow, assetId: "node-2", ownerAssetId: null, ipAddress: "10.88.0.2", discoveryApproach: "IP Scan", discoveredBy: "IP Scanner" };
const rows = [arpRow, scan, { ...arpRow, assetId: "node-3", ipAddress: "10.88.0.3", lastDiscoveredDate: "2026-07-01T00:00:00Z" }];
describe("Shadow IT records and filters", () => {
  it("recognizes the IP Node CI type", () => { expect(isAssetType("ip-node")).toBe(true); expect(formatAssetTypeLabel("ip-node")).toBe("IP Node"); });
  it("always makes all eight owner fields N/A for IP Scan, even if stale owner values are present", () => {
    for (const { key } of SHADOW_COLUMNS.slice(4)) expect(shadowValue(scan, key)).toBe("N/A");
    expect(shadowValue(scan, "ipAddress")).toBe("10.88.0.2");
    expect(shadowValue(scan, "lastDiscoveredDate")).toBe("2026-10-30");
  });
  it("keeps observed-node values separate from the owning endpoint", () => {
    expect(shadowValue(arpRow, "ipAddress")).not.toBe(shadowValue(arpRow, "endpointIpAddress"));
    expect(shadowValue(arpRow, "lastDiscoveredDate")).toBe("2026-10-30");
    expect(shadowValue(arpRow, "endpointLastDiscoveredDate")).toBe("2026-10-20");
  });
  it("combines multi-column OR selections with AND, global search and node discovery age", () => {
    const filters = { ...emptyShadowFilters(), columns: { discoveryApproach: ["ARP Table"], ipAddress: ["10.88.0.1", "10.88.0.3"] }, recency: ["Last 7 days" as const] };
    expect(filterShadowRows(rows, filters, "2026-10-31")).toEqual([arpRow]);
    expect(filterShadowRows(rows, { ...filters, search: " core SWITCH " }, "2026-10-31")).toEqual([arpRow]);
    expect(filterShadowRows(rows, { ...filters, search: "IP Scanner" }, "2026-10-31")).toEqual([]);
  });
  it("can select N/A to find scans, and facets retain alternative values", () => {
    const filters = { ...emptyShadowFilters(), columns: { endpointName: ["N/A"] } };
    expect(filterShadowRows(rows, filters, "2026-10-31")).toEqual([scan]);
    expect(shadowFacetCounts(filterShadowRows(rows, filters, "2026-10-31", "endpointName"), "endpointName"))
      .toEqual([{ value: "Core switch", count: 2 }, { value: "N/A", count: 1 }]);
  });
  it("validates export filters", () => {
    expect(parseShadowFilters({ ...emptyShadowFilters(), columns: { discoveryApproach: ["IP Scan", "IP Scan"] } }).columns.discoveryApproach).toEqual(["IP Scan"]);
    for (const value of [null, {}, { ...emptyShadowFilters(), columns: { unknownColumn: [] } }, { ...emptyShadowFilters(), recency: ["invalid"] }]) expect(() => parseShadowFilters(value)).toThrow();
  });
});
