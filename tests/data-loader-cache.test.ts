import { beforeEach, describe, expect, it, vi } from "vitest";
import { ASSET_TYPES } from "@/lib/asset-taxonomy";
import {
  __resetDataLoaderCachesForTest,
  loadDatasetForDate,
  loadMeasuresSettings,
  loadReferenceVersions,
  saveMeasuresSettings
} from "@/lib/data-loader";
import { defaultMeasuresSettings } from "@/lib/measures-settings";

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
  networkTargetStateAssets: [],
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
  ciDependencies: [],
  findings: []
};

function installSqlMock(): void {
  executeSqlJsonMock.mockImplementation(async (sql: string) => {
    if (sql.includes("ds.[snapshot_id] AS [snapshotId]")) {
      return [{ snapshotId: 1, snapshotDate: "2026-04-30", generatedAt: "2026-04-30T00:00:00.000Z" }];
    }

    if (sql.includes("DECLARE @snapshotId BIGINT")) {
      return emptySnapshotPayload;
    }

    if (sql.includes("FROM [tsaat].[measures_settings_version]")) {
      return { settingsVersionId: 7, updatedAt: "2026-04-30T01:00:00.000Z" };
    }

    if (sql.includes("FROM [tsaat].[measures_severity_matrix]")) {
      return ASSET_TYPES.map((assetType) => ({
        spiId: 1,
        assetType,
        severity: "Major"
      }));
    }

    if (sql.includes("FROM [tsaat].[measures_priority_matrix]")) {
      return [{ spiId: 1, priorityRank: 3 }];
    }

    if (sql.includes("version_ref.[version_set_id] AS [versionSetId]")) {
      return { versionSetId: 3 };
    }

    if (sql.includes("FROM [tsaat].[reference_os_current_major]")) {
      return [{ osKey: "Windows Server", currentSupportedMajor: 2022 }];
    }

    if (sql.includes("FROM [tsaat].[reference_software_supported_version]")) {
      return [{ softwareName: "SQL Server", versionOrdinal: 1, version: "2022" }];
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
  });

  it("reuses measures settings by latest version", async () => {
    await loadMeasuresSettings();
    await loadMeasuresSettings();

    expect(sqlCallsContaining("FROM [tsaat].[measures_settings_version]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[measures_severity_matrix]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[measures_priority_matrix]")).toBe(1);
  });

  it("invalidates measures settings cache after a save", async () => {
    await loadMeasuresSettings();
    await saveMeasuresSettings(defaultMeasuresSettings());
    executeSqlJsonMock.mockClear();

    await loadMeasuresSettings();

    expect(sqlCallsContaining("FROM [tsaat].[measures_settings_version]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[measures_severity_matrix]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[measures_priority_matrix]")).toBe(1);
  });

  it("caches reference versions for repeated reads", async () => {
    await loadReferenceVersions();
    await loadReferenceVersions();

    expect(sqlCallsContaining("version_ref.[version_set_id] AS [versionSetId]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[reference_os_current_major]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[reference_software_supported_version]")).toBe(1);
  });
});
