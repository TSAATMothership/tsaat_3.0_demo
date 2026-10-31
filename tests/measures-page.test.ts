import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import MeasuresPage from "@/app/measures/page";
import { getCoreAppData } from "@/lib/app-data";
import { loadSnapshotKpiEvaluationsForAnalyticsScope } from "@/lib/data-loader";
import { testSpiDefinitions } from "./spi-definition-fixtures";
import { MeasuresExplorer } from "@/components/measures-explorer";
import { MeasuresSummary } from "@/components/measures-summary";
import React, { type ComponentProps, type ReactElement } from "react";

vi.mock("@/lib/app-data", () => ({ getCoreAppData: vi.fn() }));
vi.mock("@/lib/data-loader", () => ({ loadSnapshotKpiEvaluationsForAnalyticsScope: vi.fn() }));
const scope = { network: "net-1", system: "sys-1", dataDate: "2026-10-31" };
const core: Awaited<ReturnType<typeof getCoreAppData>> = {
  dataset: { snapshotDate: "2026-10-30", generatedAt: "2026-10-30", assets: [], managedNetworks: [], ictSystems: [], spiEvaluations: [] },
  analytics: { evaluations: [], findings: [], networkRollups: [], systemRollups: [], environmentRollups: [], overallCompliancePercent: 0, statusTotals: { compliant: 0, nonCompliant: 0, unknown: 0, impactedAssets: 0 }, productionCriticalExposureAssetIds: [] },
  filters: { managedNetwork: "net-1", ictSystem: "sys-1" }, systems: [], networks: [],
  filterOptions: { networks: [], systems: [], securityDomains: [], missionCapabilities: [], businessServices: [], systemCriticalities: [] },
  kpiDefinitions: [{ id: "KPI-1", displayOrder: 1, name: "Coverage", description: "Coverage measure", successMeasure: "All entities", calculationKey: "coverage", enabled: true, reportAvailable: true, taskingTeams: [], taskingActions: [], taskingConditions: {} }],
  spiDefinitions: testSpiDefinitions.slice(0, 1), severityDefinitions: [], priorityDefinitions: [],
  findingDisplayConfiguration: { sourcePolicies: [], generationPolicies: [], workflowStatuses: [], buckets: [], evidenceFields: [], registerColumns: [] },
  discoveryToolsSettings: defaultDiscoveryToolsSettings(),
  measuresSettings: { updatedAt: "2026-10-30", severityMatrix: {}, priorityMatrix: {} }
};
function child<P>(element: ReactElement, type: unknown): ReactElement<P> {
  return (element.props.children as ReactElement[]).find((item) => item?.type === type) as ReactElement<P>;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  vi.mocked(getCoreAppData).mockResolvedValue(core);
  vi.mocked(loadSnapshotKpiEvaluationsForAnalyticsScope).mockResolvedValue([{ kpiId: "KPI-1", displayOrder: 1, calculationKey: "coverage", score: "80%", scorePercent: 80, compliantCount: 8, applicableCount: 10, nonCompliantCount: 1, unknownCount: 1, highPriorityCount: 1 }]);
});
afterEach(() => vi.unstubAllGlobals());
describe("observed measures page wiring", () => {
  it("does not load data until a workspace scope is selected", async () => {
    await MeasuresPage({ searchParams: {} });
    expect(getCoreAppData).not.toHaveBeenCalled();
  });
  it("builds the executive summary from the same scoped indicator data and actual snapshot", async () => {
    const rendered = await MeasuresPage({ searchParams: scope });
    const summary = child<ComponentProps<typeof MeasuresSummary>>(rendered, MeasuresSummary);
    expect(summary.props.snapshotDate).toBe("2026-10-30");
    expect(summary.props.model.kpis.nonCompliant).toBe(1);
    expect(summary.props.model.spis.unassessed).toBe(1);
    expect(summary.props.allSpiReportHref).toContain("dataDate=2026-10-30");
    expect(loadSnapshotKpiEvaluationsForAnalyticsScope).toHaveBeenCalledWith(expect.objectContaining({ dataset: core.dataset, analytics: core.analytics, networks: [], systems: [] }));
  });
  it("passes KPI summary selections into the actual table and preserves report links", async () => {
    const initialFilters = { search: "", columns: { result: ["Non-compliant"] } };
    const rendered = await MeasuresPage({ searchParams: { ...scope, measuresTab: "measures-kpi", measureFilters: JSON.stringify(initialFilters) } });
    const explorer = child<ComponentProps<typeof MeasuresExplorer>>(rendered, MeasuresExplorer);
    expect(explorer.props.mode).toBe("kpi");
    expect(explorer.props.initialFilters).toEqual(initialFilters);
    expect(explorer.props.rows[0].reportHref).toContain("kind=kpi");
    expect(explorer.props.rows[0].trendHref).toContain("dataDate=2026-10-30");
  });
  it("supports legacy SPI filters and avoids loading unrelated KPI calculations", async () => {
    const rendered = await MeasuresPage({ searchParams: { ...scope, measuresTab: "measures-spi", spi: "1", measureSearch: "coverage" } });
    const explorer = child<ComponentProps<typeof MeasuresExplorer>>(rendered, MeasuresExplorer);
    expect(explorer.props.initialFilters).toEqual({ search: "coverage", columns: { id: ["SPI-1"] } });
    expect(explorer.props.allSpiReportHref).toContain("kind=spi-all");
    expect(loadSnapshotKpiEvaluationsForAnalyticsScope).not.toHaveBeenCalled();
  });
  it("redirects legacy risk matrix URLs to the Settings popup without loading scoped analytics", async () => {
    await expect(MeasuresPage({ searchParams: { ...scope, measuresTab: "spi-settings" } })).rejects.toMatchObject({
      digest: expect.stringContaining("/settings?settingsTab=spi-risk-matrix&network=net-1&system=sys-1&dataDate=2026-10-31")
    });
    await expect(MeasuresPage({ searchParams: { measuresTab: "settings" } })).rejects.toMatchObject({
      digest: expect.stringContaining("/settings?settingsTab=spi-risk-matrix")
    });
    expect(getCoreAppData).not.toHaveBeenCalled();
    expect(loadSnapshotKpiEvaluationsForAnalyticsScope).not.toHaveBeenCalled();
  });
});
