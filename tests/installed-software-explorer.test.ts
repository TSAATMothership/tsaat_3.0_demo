import { describe, expect, it } from "vitest";
import { emptySoftwareFilters, filterSoftwareRows, softwareFacetCounts, softwareValue, parseSoftwareFilters, type InstalledSoftwareRecord } from "@/lib/installed-software-explorer";
import { NOT_RECORDED } from "@/lib/endpoint-explorer";

const date = "2026-10-31";
const base: InstalledSoftwareRecord = { assetId: "a1", softwareOrdinal: 1, softwareName: "Agent", softwareVersion: "01.020",
  filePath: "C:\\Program Files\\Agent\\agent.exe", lastDiscoveredDate: "2026-10-30T12:30:00Z", discoveredBy: "Scanner A",
  deviceName: "Device A", deviceModel: "Model A", osName: "Windows", osVersion: "11", osPatchLevel: "KB123456" };
const rows = [base, { ...base, softwareOrdinal: 2, filePath: "D:\\Agent\\agent.exe", softwareVersion: "02.000" },
  { ...base, assetId: "a2", deviceName: "Device B", osName: "Linux", osPatchLevel: null, discoveredBy: null, lastDiscoveredDate: null },
  { ...base, assetId: "a3", softwareName: "Database", deviceName: "Device C", discoveredBy: "Scanner B" }];

describe("installed software explorer filters", () => {
  it("keeps separate installations of the same product on the same endpoint", () => {
    const result = filterSoftwareRows(rows, { ...emptySoftwareFilters(), columns: { softwareName: ["Agent"], deviceName: ["Device A"] } }, date);
    expect(result.map((row) => row.softwareOrdinal)).toEqual([1, 2]);
  });
  it("uses OR within a column and AND across columns, global search and charts", () => {
    const filters = { ...emptySoftwareFilters(), columns: { softwareName: ["Agent", "Database"], osName: ["Windows"] }, recency: ["Last 7 days" as const] };
    expect(filterSoftwareRows(rows, filters, date)).toHaveLength(3);
    expect(filterSoftwareRows(rows, { ...filters, search: " d:\\AGENT " }, date)).toEqual([rows[1]]);
    expect(filterSoftwareRows(rows, { ...filters, columns: { ...filters.columns, discoveredBy: ["Scanner B"] } }, date)).toEqual([rows[3]]);
  });
  it("offers other values in the current column while respecting all other filters", () => {
    const filters = { ...emptySoftwareFilters(), columns: { softwareName: ["Agent"], osName: ["Windows"] } };
    expect(softwareFacetCounts(filterSoftwareRows(rows, filters, date, "softwareName"), "softwareName"))
      .toEqual([{ value: "Agent", count: 2 }, { value: "Database", count: 1 }]);
  });
  it("filters missing source values without substituting endpoint discovery data", () => {
    expect(softwareValue(rows[2], "osPatchLevel")).toBe(NOT_RECORDED);
    expect(filterSoftwareRows(rows, { ...emptySoftwareFilters(), recency: [NOT_RECORDED] }, date)).toEqual([rows[2]]);
    expect(filterSoftwareRows(rows, { ...emptySoftwareFilters(), columns: { osPatchLevel: [NOT_RECORDED] } }, date)).toEqual([rows[2]]);
    expect(softwareValue(base, "lastDiscoveredDate")).toBe("2026-10-30");
  });
  it("allows full-length paths in export filters, deduplicates and rejects unknown fields", () => {
    const path = "C:\\" + "folder\\".repeat(200);
    expect(parseSoftwareFilters({ search: "", columns: { filePath: [path, path] }, recency: [] }).columns.filePath).toEqual([path]);
    for (const filters of [null, {}, { ...emptySoftwareFilters(), columns: { badKey: [] } },
      { ...emptySoftwareFilters(), columns: { filePath: [12] } }, { ...emptySoftwareFilters(), recency: ["invalid"] }]) {
      expect(() => parseSoftwareFilters(filters)).toThrow();
    }
  });
});
