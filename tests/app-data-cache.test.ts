import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetAppDataCachesForTest } from "@/lib/app-data-cache";
import { getCoreAppData, getTrendAppData } from "@/lib/app-data";
import type { Dataset } from "@/lib/types";

const loadDatasetForDateMock = vi.hoisted(() => vi.fn());
const loadLatestSnapshotsForDateMock = vi.hoisted(() => vi.fn());
const loadMeasuresSettingsMock = vi.hoisted(() => vi.fn());
const loadDiscoveryToolsSettingsMock = vi.hoisted(() => vi.fn());
const loadKpiDefinitionsMock = vi.hoisted(() => vi.fn());
const loadSpiDefinitionsMock = vi.hoisted(() => vi.fn());
const loadSeverityDefinitionsMock = vi.hoisted(() => vi.fn());
const getCachedAnalyticsMock = vi.hoisted(() => vi.fn());
const buildTrendPointsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/data-loader", () => ({
  loadDatasetForDate: loadDatasetForDateMock,
  loadLatestSnapshotsForDate: loadLatestSnapshotsForDateMock,
  loadMeasuresSettings: loadMeasuresSettingsMock,
  loadDiscoveryToolsSettings: loadDiscoveryToolsSettingsMock,
  loadKpiDefinitions: loadKpiDefinitionsMock,
  loadSpiDefinitions: loadSpiDefinitionsMock,
  loadSeverityDefinitions: loadSeverityDefinitionsMock
}));

vi.mock("@/lib/analytics-cache", () => ({
  datasetCacheSignature: (dataset: Dataset) =>
    [dataset.snapshotDate, dataset.generatedAt, dataset.managedNetworks.length, dataset.ictSystems.length, dataset.assets.length].join("|"),
  filtersCacheKey: (filters: Record<string, unknown>) => JSON.stringify(Object.entries(filters).sort()),
  getCachedAnalytics: getCachedAnalyticsMock,
  settingsCacheSignature: (measuresSettings: { updatedAt?: string }, discoveryToolsSettings: { updatedAt?: string }) =>
    `${measuresSettings.updatedAt ?? ""}|${discoveryToolsSettings.updatedAt ?? ""}`
}));

vi.mock("@/lib/trends", () => ({
  buildTrendPoints: buildTrendPointsMock
}));

const dataset: Dataset = {
  generatedAt: "2026-04-30T00:00:00.000Z",
  snapshotDate: "2026-04-30",
  managedNetworks: [
    {
      id: "net-1",
      name: "Network 1",
      criticality: "Critical",
      adfPlatform: false,
      enterprisePlatform: false,
      modellingStatus: true,
      discoveryStatus: "Discovery Enabled",
      ictSystemIds: ["sys-1"],
      assetIds: ["asset-1"]
    }
  ],
  ictSystems: [
    {
      id: "sys-1",
      name: "System 1",
      adfPlatform: false,
      enterprisePlatform: false,
      modellingStatus: true,
      diisDefined: true,
      networkId: "net-1",
      criticality: "Critical",
      securityDomain: "Protected",
      missionCapabilities: [],
      businessServices: [],
      environments: []
    }
  ],
  assets: [
    {
      id: "asset-1",
      name: "Asset 1",
      hostname: "asset-1",
      type: "server",
      networkId: "net-1",
      securityDomain: "Protected",
      lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
      vulnerabilities: [],
      operatingSystem: null,
      installedSoftware: [],
      systemContext: { systemId: "sys-1", environmentType: "Production" }
    }
  ],
  findings: []
};

describe("app data model caches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetAppDataCachesForTest();
    loadDatasetForDateMock.mockResolvedValue(dataset);
    loadLatestSnapshotsForDateMock.mockResolvedValue([dataset]);
    loadMeasuresSettingsMock.mockResolvedValue({
      updatedAt: "2026-04-30T01:00:00.000Z",
      severityMatrix: {},
      priorityMatrix: {}
    });
    loadDiscoveryToolsSettingsMock.mockResolvedValue({ updatedAt: "2026-04-30T02:00:00.000Z", tools: [] });
    loadKpiDefinitionsMock.mockResolvedValue([
      {
        id: "KPI-1",
        displayOrder: 1,
        name: "Overall SPI Compliance",
        description: "Overall compliance",
        successMeasure: "Target >= 95%",
        calculationKey: "overall-spi-compliance",
        reportAvailable: false
      }
    ]);
    loadSpiDefinitionsMock.mockResolvedValue([
      {
        spiId: 1,
        displayOrder: 1,
        name: "SPI-1",
        description: "Operating system must be supported",
        successMeasure: "Supported operating system",
        priorityOrder: 1,
        defaultSeverity: "Major",
        recommendedAction: "Update unsupported operating systems.",
        enabled: true,
        ruleKey: "os-support",
        ruleParameters: {},
        reportAvailable: true,
        trendReportAvailable: true,
        reportDetailKey: "standard-asset-annex",
        applicableAssetTypes: ["server"],
        taskingTeams: [],
        taskingActions: [],
        taskingConditions: {}
      }
    ]);
    loadSeverityDefinitionsMock.mockResolvedValue([
      {
        severityKey: "Major",
        label: "Major",
        displayOrder: 3,
        selectableInSettings: true,
        toneKey: "major"
      }
    ]);
    getCachedAnalyticsMock.mockReturnValue({ marker: "analytics" });
    buildTrendPointsMock.mockReturnValue([{ weekLabel: "W01", snapshotDate: "2026-04-30" }]);
  });

  it("reuses equivalent core app models", async () => {
    const first = await getCoreAppData({ dataDate: "2026-04-30", managedNetwork: "net-1" });
    const second = await getCoreAppData({ managedNetwork: "net-1", dataDate: "2026-04-30" });

    expect(first).toBe(second);
    expect(getCachedAnalyticsMock).toHaveBeenCalledTimes(1);
  });

  it("separates core app models by filter scope", async () => {
    await getCoreAppData({ dataDate: "2026-04-30", managedNetwork: "net-1" });
    await getCoreAppData({ dataDate: "2026-04-30", managedNetwork: "net-1", assetType: "server" });

    expect(getCachedAnalyticsMock).toHaveBeenCalledTimes(2);
  });

  it("reuses trend app models and separates them by lookback", async () => {
    const first = await getTrendAppData({ dataDate: "2026-04-30", managedNetwork: "net-1" }, 12, {
      includeTrendPoints: true
    });
    const second = await getTrendAppData({ dataDate: "2026-04-30", managedNetwork: "net-1" }, 12, {
      includeTrendPoints: true
    });
    const third = await getTrendAppData({ dataDate: "2026-04-30", managedNetwork: "net-1" }, 6, {
      includeTrendPoints: true
    });

    expect(first).toBe(second);
    expect(third).not.toBe(first);
    expect(buildTrendPointsMock).toHaveBeenCalledTimes(2);
  });
});
