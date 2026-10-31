import { describe, expect, it } from "vitest";
import {
  discoveryAge, emptyEndpointFilters, endpointFacetCounts, endpointValue, filterEndpointRows,
  NOT_RECORDED, parseEndpointFilters, type EndpointRecord
} from "@/lib/endpoint-explorer";

const snapshot = "2026-10-31";
const row = (overrides: Partial<EndpointRecord>): EndpointRecord => ({
  assetId: "a1", name: "Gateway", ciType: "Server", ipAddress: "10.0.0.1", macAddress: "00:00:01:AA:BB:CC",
  deviceModel: "Model A", lastDiscoveredDate: "2026-10-28T05:00:00Z", discoveredBy: "Scanner A", managedNetwork: "East", ...overrides
});
const rows = [row({}), row({ assetId: "a2", name: "Laptop", ciType: "Workstation", managedNetwork: "West", discoveredBy: "Scanner B" }),
  row({ assetId: "a3", name: "Printer", ciType: "Printer", managedNetwork: "East", macAddress: null, deviceModel: null, lastDiscoveredDate: null })];

describe("endpoint filtering", () => {
  it("combines OR selections within a column with AND across columns and search", () => {
    const filters = { ...emptyEndpointFilters(), columns: { ciType: ["Server", "Workstation"], managedNetwork: ["West"] } };
    expect(filterEndpointRows(rows, filters, snapshot).map((item) => item.assetId)).toEqual(["a2"]);
    expect(filterEndpointRows(rows, { ...filters, search: " scanner b " }, snapshot).map((item) => item.assetId)).toEqual(["a2"]);
    expect(filterEndpointRows(rows, { ...filters, search: "Gateway" }, snapshot)).toEqual([]);
  });

  it("provides dynamic facets that respect other filters without hiding alternatives in their own column", () => {
    const filters = { ...emptyEndpointFilters(), columns: { ciType: ["Server"], managedNetwork: ["East"] } };
    const options = endpointFacetCounts(filterEndpointRows(rows, filters, snapshot, "ciType"), "ciType");
    expect(options).toEqual([{ value: "Printer", count: 1 }, { value: "Server", count: 1 }]);
    expect(filterEndpointRows(rows, filters, snapshot)).toEqual([rows[0]]);
  });

  it("makes missing values selectable and groups timestamps by UTC date", () => {
    expect(endpointValue(rows[2], "deviceModel")).toBe(NOT_RECORDED);
    expect(endpointValue(rows[0], "lastDiscoveredDate")).toBe("2026-10-28");
    expect(filterEndpointRows(rows, { ...emptyEndpointFilters(), columns: { macAddress: [NOT_RECORDED] } }, snapshot)).toEqual([rows[2]]);
    expect(filterEndpointRows(rows, { ...emptyEndpointFilters(), columns: { lastDiscoveredDate: ["2026-10-28"] } }, snapshot)).toHaveLength(2);
  });

  it.each([
    ["2026-11-01", "After snapshot"], ["2026-10-31", "Last 7 days"], ["2026-10-24", "Last 7 days"],
    ["2026-10-23", "8–30 days"], ["2026-10-01", "8–30 days"], ["2026-09-30", "31–90 days"],
    ["2026-08-02", "31–90 days"], ["2026-08-01", "Over 90 days"], [null, NOT_RECORDED], ["invalid", NOT_RECORDED]
  ])("classifies discovery date %s as %s", (date, expected) => {
    expect(discoveryAge(row({ lastDiscoveredDate: date }), snapshot)).toBe(expected);
  });

  it("combines chart selections with column filters", () => {
    const filters = { ...emptyEndpointFilters(), columns: { managedNetwork: ["East"] }, recency: [NOT_RECORDED] };
    expect(filterEndpointRows(rows, filters, snapshot)).toEqual([rows[2]]);
    expect(filterEndpointRows(rows, filters, snapshot, undefined, true)).toEqual([rows[0], rows[2]]);
  });

  it("validates export filters and deduplicates selections", () => {
    expect(parseEndpointFilters({ search: "", columns: { name: ["Gateway", "Gateway"] }, recency: [NOT_RECORDED, NOT_RECORDED] }))
      .toEqual({ search: "", columns: { name: ["Gateway"] }, recency: [NOT_RECORDED] });
    for (const invalid of [null, [], {}, { search: "", columns: { unsupported: [] }, recency: [] },
      { search: "", columns: { name: [1] }, recency: [] }, { search: "", columns: {}, recency: ["Unknown age"] }]) {
      expect(() => parseEndpointFilters(invalid)).toThrow();
    }
  });
});
