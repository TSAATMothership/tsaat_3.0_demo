import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetDataLoaderCachesForTest, loadEndpointExplorerData } from "@/lib/data-loader";

const sql = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sql-server", () => ({ executeSqlJson: sql, executeSqlText: vi.fn(), toSqlUnicodeLiteral: (value: string) => `N'${value.replace(/'/g, "''")}'` }));

beforeEach(() => {
  __resetDataLoaderCachesForTest();
  sql.mockReset();
  sql.mockImplementation(async (query: string) => {
    if (query.includes("ds.[snapshot_id] AS [snapshotId]")) return [
      { snapshotId: 1, snapshotDate: "2026-09-30", generatedAt: "2026-09-30T00:00:00Z" },
      { snapshotId: 2, snapshotDate: "2026-10-31", generatedAt: "2026-10-31T00:00:00Z" }
    ];
    if (query.includes("DECLARE @endpointSnapshotId")) return [{ securityDomain: "UNKNOWN", assetId: "a1", name: "Device 1", ciType: "server", ipAddress: "10.0.0.1",
      macAddress: null, deviceModel: null, lastDiscoveredDate: null, discoveredBy: null, managedNetwork: "West" }];
    throw new Error("Unexpected SQL: explorer must not load analytics or SPI evaluations.");
  });
});

describe("endpoint CMDB query", () => {
  it("loads no data before the header scope is selected", async () => {
    expect((await loadEndpointExplorerData({ dataDate: "2026-10-31" })).rows).toEqual([]);
    expect(sql).not.toHaveBeenCalled();
  });
  it("uses the requested snapshot and SQL scope, then reuses the cached result", async () => {
    const scope = { dataDate: "2026-10-01", network: ["net-1", "net-'2"] };
    const result = await loadEndpointExplorerData(scope);
    expect(result.snapshotDate).toBe("2026-09-30");
    expect(result.rows[0]).toMatchObject({ ciType: "Server", deviceModel: null, lastDiscoveredDate: null });
    expect(sql).toHaveBeenCalledTimes(2);
    const query = sql.mock.calls[1][0];
    expect(query).toContain("@endpointSnapshotId BIGINT = 1");
    expect(query).toContain("net-''2");
    expect(query).toContain("OPENJSON(@networks)");
    expect(query).toContain("a.[mac_address]");
    expect(query).toContain("a.[network_id] <> N'net-unassigned'");
    expect(await loadEndpointExplorerData(scope)).toEqual(result);
    expect(sql).toHaveBeenCalledTimes(2);
  });
  it("keeps cache entries separate for ICT systems and snapshot dates", async () => {
    await loadEndpointExplorerData({ network: "net-1", dataDate: "2026-10-01" });
    await loadEndpointExplorerData({ system: "sys-1", dataDate: "2026-10-01" });
    await loadEndpointExplorerData({ system: "sys-1", dataDate: "2026-10-31" });
    expect(sql).toHaveBeenCalledTimes(4);
    expect(sql.mock.calls[2][0]).toContain("@systems NVARCHAR(MAX) = N'[\"sys-1\"]'");
    expect(sql.mock.calls[2][0]).toContain("OPENJSON(@systems)");
    expect(sql.mock.calls[3][0]).toContain("@endpointSnapshotId BIGINT = 2");
  });
});

it("separates domain caches and sends an explicit empty SQL domain list for none", async () => {
  for(const securityDomain of ["SECRET","PROTECTED","NONE"]) await loadEndpointExplorerData({network:"net-1",securityDomain});
  expect(sql).toHaveBeenCalledTimes(4);
  for(const [index,domains] of [[1,'["SECRET"]'],[2,'["PROTECTED"]'],[3,'[]']] as const){
    expect(sql.mock.calls[index][0]).toContain("@domains NVARCHAR(MAX) = N'"+domains+"'");
    expect(sql.mock.calls[index][0]).toContain("a.[security_domain] IN (SELECT [value] FROM OPENJSON(@domains))");
  }
  await loadEndpointExplorerData({network:"net-1",securityDomain:"SECRET"}); expect(sql).toHaveBeenCalledTimes(4);
});
