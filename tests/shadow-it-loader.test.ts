import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetDataLoaderCachesForTest, loadShadowItExplorerData } from "@/lib/data-loader";
const sql = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sql-server", () => ({ executeSqlJson: sql, executeSqlText: vi.fn(), toSqlUnicodeLiteral: (value: string) => `N'${value.replace(/'/g, "''")}'` }));
beforeEach(() => { __resetDataLoaderCachesForTest(); sql.mockReset(); sql.mockImplementation(async (query: string) => {
  if (query.includes("ds.[snapshot_id] AS [snapshotId]")) return [{ snapshotId: 1, snapshotDate: "2026-09-30", generatedAt: "2026-09-30T00:00:00Z" }, { snapshotId: 2, snapshotDate: "2026-10-31", generatedAt: "2026-10-31T00:00:00Z" }];
  if (query.includes("DECLARE @shadowSnapshotId")) return [{ assetId: "node-1", endpointCiType: "network-device" }];
  throw new Error("Unexpected non-inventory query.");
}); });
describe("Shadow IT scoped SQL", () => {
  it("loads nothing without an applied scope", async () => { expect((await loadShadowItExplorerData({})).rows).toEqual([]); expect(sql).not.toHaveBeenCalled(); });
  it("loads only IP Nodes and same-snapshot ARP owners, then reuses the cache", async () => {
    const scope = { network: ["net-1", "net-'2"], dataDate: "2026-10-01" };
    const result = await loadShadowItExplorerData(scope);
    expect(result.snapshotDate).toBe("2026-09-30"); expect(result.rows[0].endpointCiType).toBe("Network Device");
    const query = sql.mock.calls[1][0];
    for (const text of ["@shadowSnapshotId BIGINT = 1", "node.[asset_type] = N'ip-node'", "node.[discovery_approach] = N'ARP Table'", "owner.[snapshot_id] = node.[snapshot_id]", "owner.[asset_id] = node.[arp_owner_asset_id]", "net-''2"]) expect(query).toContain(text);
    await loadShadowItExplorerData(scope); expect(sql).toHaveBeenCalledTimes(2);
  });
  it("scopes systems by explicit node association or ARP owner and separates dates", async () => {
    await loadShadowItExplorerData({ system: "sys-1", dataDate: "2026-10-01" });
    await loadShadowItExplorerData({ system: "sys-1", dataDate: "2026-10-31" });
    expect(sql).toHaveBeenCalledTimes(3);
    expect(sql.mock.calls[1][0]).toContain("owner.[system_id] IN (SELECT [value] FROM OPENJSON(@systems))");
    expect(sql.mock.calls[2][0]).toContain("@shadowSnapshotId BIGINT = 2");
  });
});
