import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadMeasuresTrends } from "@/lib/measures-trends-data";
import * as data from "@/lib/data-loader";
import { clearAnalyticsCache } from "@/lib/analytics-cache";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { testSpiDefinitions, testMeasuresSettings, testSeverityDefinitions, testPriorityDefinitions } from "./spi-definition-fixtures";
import type { Dataset, ICTSystem, ServerAsset } from "@/lib/types";
import type { KpiDefinition } from "@/lib/kpi-definitions";
vi.mock("@/lib/data-loader", () => ({ loadSnapshotsForDateWindow: vi.fn(), loadSpiDefinitions: vi.fn(), loadKpiDefinitions: vi.fn(), loadSeverityDefinitions: vi.fn(), loadFindingPriorityDefinitions: vi.fn(), loadMeasuresSettings: vi.fn(), loadDiscoveryToolsSettings: vi.fn(), loadSnapshotKpiEvaluationsForAnalyticsScope: vi.fn() }));
const definitions: KpiDefinition[] = [{ id: "KPI-1", displayOrder: 1, name: "ATO coverage", description: "Systems with ATO", successMeasure: "All systems", calculationKey: "active-ato-coverage", enabled: true, reportAvailable: true, taskingTeams: [], taskingActions: [], taskingConditions: {} }];
function snapshot(date: string, snapshotId = 1): Dataset {
  const assets: ServerAsset[] = [1, 2, 3].map(id => ({ id: `a${id}`, name: `Asset ${id}`, hostname: `a${id}`, type: "server", networkId: id === 3 ? "net-2" : "net-1", securityDomain: id === 2 ? "SECRET" : "PROTECTED",
    systemContext: { systemId: `sys-${id}`, environmentType: "Production" }, lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" }, vulnerabilities: [], installedSoftware: [], operatingSystem: null }));
  const systems: ICTSystem[] = assets.map(asset => ({ id: asset.systemContext!.systemId, name: asset.systemContext!.systemId, networkId: asset.networkId, securityDomain: asset.securityDomain, adfPlatform: false, enterprisePlatform: false, modellingStatus: true, diisDefined: true, criticality: "Non-Critical", atoNumber: "ATO", environments: [], missionCapabilities: [], businessServices: [] }));
  return { snapshotDate: date, snapshotId, generatedAt: date, assets, ictSystems: systems, managedNetworks: [], findings: [], spiEvaluations: assets.map((asset, index) => ({ assetId: asset.id, spiId: 1, status: index === 1 ? "Unknown" : "Compliant", evidence: {}, reasons: [] })) };
}
beforeEach(() => {
  vi.clearAllMocks(); clearAnalyticsCache();
  vi.mocked(data.loadSpiDefinitions).mockResolvedValue(testSpiDefinitions);
  vi.mocked(data.loadKpiDefinitions).mockResolvedValue(definitions);
  vi.mocked(data.loadSeverityDefinitions).mockResolvedValue(testSeverityDefinitions);
  vi.mocked(data.loadFindingPriorityDefinitions).mockResolvedValue(testPriorityDefinitions);
  vi.mocked(data.loadMeasuresSettings).mockResolvedValue(testMeasuresSettings);
  vi.mocked(data.loadDiscoveryToolsSettings).mockResolvedValue(defaultDiscoveryToolsSettings());
  vi.mocked(data.loadSnapshotsForDateWindow).mockResolvedValue([snapshot("2026-10-31", 1), snapshot("2026-11-07", 2)]);
  vi.mocked(data.loadSnapshotKpiEvaluationsForAnalyticsScope).mockImplementation(async ({ systems }) => [{ kpiId: "KPI-1", displayOrder: 1, calculationKey: "active-ato-coverage", score: "", scorePercent: systems.length ? 100 : 0, compliantCount: systems.length, applicableCount: systems.length, nonCompliantCount: 0, unknownCount: 0, highPriorityCount: 0 }]);
});
describe("Measures Trends data boundary", () => {
  it("reuses current measure evaluation and applies only the header network/domain scope", async () => {
    const result = await loadMeasuresTrends({ network: "net-1", securityDomain: "SECRET", dataDate: "2026-11-07", measureHistory: "week", assetType: "printer-device", environment: "Development", severity: "Major" });
    expect(data.loadSnapshotsForDateWindow).toHaveBeenCalledWith("2026-11-07", 1, { profile: "summary" });
    expect(data.loadSnapshotKpiEvaluationsForAnalyticsScope).toHaveBeenCalledWith(expect.objectContaining({ systems: [expect.objectContaining({ id: "sys-2" })], analytics: expect.objectContaining({ evaluations: [expect.objectContaining({ assetId: "a2" })] }), kpiDefinitions: definitions }));
    expect(result.spi[0].points[0]).toMatchObject({ total: 1, compliant: 0, unknown: 1, percent: 0 });
    expect(result.kpi[0].points[0]).toMatchObject({ total: 1, compliant: 1, percent: 100 });
  });
  it.each(["3months", "6months", "12months"])("loads a bounded %s history through the same provider facade", async history => {
    await loadMeasuresTrends({ system: "sys-1", dataDate: "2026-11-07", measureHistory: history });
    expect(data.loadSnapshotsForDateWindow).toHaveBeenCalledWith("2026-11-07", parseInt(history), { profile: "summary" });
    expect(data.loadSnapshotKpiEvaluationsForAnalyticsScope).toHaveBeenCalledWith(expect.objectContaining({ systems: [expect.objectContaining({ id: "sys-1" })] }));
  });
  it("excludes stale/future fallback before KPI queries and keeps empty scopes N/A", async () => {
    vi.mocked(data.loadSnapshotsForDateWindow).mockResolvedValue([snapshot("2026-10-30"), snapshot("2026-11-08")]);
    expect((await loadMeasuresTrends({ network: "net-1", dataDate: "2026-11-07", measureHistory: "week" })).dates).toEqual([]);
    expect(data.loadSnapshotKpiEvaluationsForAnalyticsScope).not.toHaveBeenCalled();
    vi.mocked(data.loadSnapshotsForDateWindow).mockResolvedValue([snapshot("2026-11-07")]);
    const empty = await loadMeasuresTrends({ network: "net-1", securityDomain: "NONE", dataDate: "2026-11-07" });
    expect(empty.kpi[0].points[0].percent).toBeNull(); expect(empty.spi[0].points[0].percent).toBeNull();
  });
});
