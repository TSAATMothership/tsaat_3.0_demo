import { __resetDataLoaderCachesForTest, loadDatasetForDate, loadDiscoveryToolsSettings, saveDiscoveryToolsSettings } from "@/lib/data-loader";
import { beforeEach, describe, expect, it, vi } from "vitest";
const executeSqlJsonMock = vi.hoisted(() => vi.fn());
const executeSqlTextMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sql-server", () => ({
    executeSqlJson: executeSqlJsonMock,
    executeSqlText: executeSqlTextMock,
    toSqlUnicodeLiteral: (value: string) => `N'${String(value).replace(/'/g, "''")}'`
}));
const emptySnapshotPayload = {
    managedNetworks: [],
    managedNetworkHierarchy: [],
    networkDeclaredSystems: [],
    networkDeclaredAssets: [],
    ictSystems: [],
    ictSystemHierarchy: [],
    systemMissionCapabilities: [],
    systemBusinessServices: [],
    systemEnvironments: [],
    systemEnvironmentAssets: [],
    assets: [],
    assetOperatingSystems: [],
    assetNetworkOperatingSystems: [],
    assetPatchStates: [],
    assetInstalledSoftware: [],
    assetVulnerabilities: [],
    ciDependencies: []
};
function installSqlMock(): void {
    executeSqlJsonMock.mockImplementation(async (sql: string) => {
        if (sql.includes("ds.[snapshot_id] AS [snapshotId]")) {
            return [{ snapshotId: 1, snapshotDate: "2026-04-30", generatedAt: "2026-04-30T00:00:00.000Z" }];
        }
        if (sql.includes("DECLARE @snapshotId BIGINT")) {
            return emptySnapshotPayload;
        }
        if (sql.includes("FROM [tsaat].[discovery_tools_settings_version]")) {
            return { settingsVersionId: 11, updatedAt: "2026-04-30T02:00:00.000Z" };
        }
        if (sql.includes("version_ref.[version_set_id] AS [versionSetId]")) {
            return { versionSetId: 3 };
        }
        return [];
    });
}
function sqlCallsContaining(text: string): number {
    return executeSqlJsonMock.mock.calls.filter(([sql]) => String(sql).includes(text)).length;
}
describe("data loader caches", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetDataLoaderCachesForTest();
        installSqlMock();
        executeSqlTextMock.mockResolvedValue("");
    });
    it("reuses snapshot metadata and snapshot datasets within the cache window", async () => {
        await loadDatasetForDate("2026-04-30");
        await loadDatasetForDate("2026-04-30");
        expect(sqlCallsContaining("ds.[snapshot_id] AS [snapshotId]")).toBe(1);
        expect(sqlCallsContaining("DECLARE @snapshotId BIGINT")).toBe(1);
        expect(sqlCallsContaining("usp_evaluate_discovery_coverage_snapshot")).toBe(1);
        expect(sqlCallsContaining("usp_get_effective_findings_snapshot")).toBe(0);
    });
    it("separates snapshot dataset cache entries by load profile", async () => {
        await loadDatasetForDate("2026-04-30", { profile: "summary" });
        await loadDatasetForDate("2026-04-30", { profile: "summary" });
        await loadDatasetForDate("2026-04-30", { profile: "full" });
        const payloadSql = executeSqlJsonMock.mock.calls
            .map(([sql]) => String(sql))
            .filter((sql) => sql.includes("DECLARE @snapshotId BIGINT"));
        expect(payloadSql).toHaveLength(2);
        expect(payloadSql[0]).toContain("DECLARE @includeFullPayload BIT = 0;");
        expect(payloadSql[1]).toContain("DECLARE @includeFullPayload BIT = 1;");
    });
    it("invalidates saved discovery mappings and snapshot coverage after a successful save", async () => {
        await loadDatasetForDate();
        const settings = await loadDiscoveryToolsSettings();
        const tools = settings.tools.map((tool) => ({ id: tool.id, assetTypeScope: { ...tool.assetTypeScope, server: "na" } }));
        const saved = await saveDiscoveryToolsSettings({ tools });
        expect(saved.tools.every((tool) => tool.assetTypeScope.server === "na")).toBe(true);
        expect(executeSqlTextMock).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO [tsaat].[discovery_tool_asset_scope]"));
        executeSqlJsonMock.mockClear();
        await loadDatasetForDate();
        await loadDiscoveryToolsSettings();
        expect(sqlCallsContaining("FROM [tsaat].[discovery_tools_settings_version]")).toBe(1);
        expect(sqlCallsContaining("usp_evaluate_discovery_coverage_snapshot")).toBe(1);
    });
});
