import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetDataLoaderCachesForTest, loadInstalledSoftwareExplorerData } from "@/lib/data-loader";
const sql = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sql-server", () => ({ executeSqlJson: sql, executeSqlText: vi.fn(), toSqlUnicodeLiteral: (value: string) => `N'${value.replace(/'/g, "''")}'` }));
beforeEach(() => {
  __resetDataLoaderCachesForTest(); sql.mockReset();
  sql.mockImplementation(async (query: string) => {
    if (query.includes("ds.[snapshot_id] AS [snapshotId]")) return [
      { snapshotId: 1, snapshotDate: "2026-09-30", generatedAt: "2026-09-30T00:00:00Z" },
      { snapshotId: 2, snapshotDate: "2026-10-31", generatedAt: "2026-10-31T00:00:00Z" }
    ];
    if (query.includes("DECLARE @softwareSnapshotId")) return [];
    throw new Error("Unexpected analytics query in software explorer.");
  });
});
describe("installed software scoped SQL", () => {
  it("does not load before a workspace scope is selected", async () => {
    expect((await loadInstalledSoftwareExplorerData({ dataDate: "2026-10-31" })).rows).toEqual([]);
    expect(sql).not.toHaveBeenCalled();
  });
  it("uses one inventory query plus snapshot selection, caching identical scopes", async () => {
    const scope = { network: ["net-1", "net-'2"], dataDate: "2026-10-01" };
    expect((await loadInstalledSoftwareExplorerData(scope)).snapshotDate).toBe("2026-09-30");
    expect(sql).toHaveBeenCalledTimes(2);
    const query = sql.mock.calls[1][0];
    for (const value of ["@softwareSnapshotId BIGINT = 1", "net-''2", "OPENJSON(@networks)", "sw.[software_ordinal]", "sw.[last_discovered_date]", "os.[patch_level]", "nos.[patch_level]"]) expect(query).toContain(value);
    expect(query).not.toContain("a.[last_discovered_date]");
    expect(query).not.toContain("is_latest");
    await loadInstalledSoftwareExplorerData(scope);
    expect(sql).toHaveBeenCalledTimes(2);
  });
  it("separates systems, dates and cache invalidation", async () => {
    await loadInstalledSoftwareExplorerData({ network: "net-1", dataDate: "2026-10-01" });
    await loadInstalledSoftwareExplorerData({ system: "sys-1", dataDate: "2026-10-01" });
    await loadInstalledSoftwareExplorerData({ system: "sys-1", dataDate: "2026-10-31" });
    expect(sql).toHaveBeenCalledTimes(4);
    expect(sql.mock.calls[2][0]).toContain("@systems NVARCHAR(MAX) = N'[\"sys-1\"]'");
    expect(sql.mock.calls[3][0]).toContain("@softwareSnapshotId BIGINT = 2");
    __resetDataLoaderCachesForTest();
    await loadInstalledSoftwareExplorerData({ system: "sys-1", dataDate: "2026-10-31" });
    expect(sql).toHaveBeenCalledTimes(6);
  });
});
