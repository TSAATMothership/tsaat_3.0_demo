import { describe, expect, it } from "vitest";
import { emptyMeasureFilters, filterMeasureRows, initialMeasureFilters, measureFacets, measureResults, measureValues, measuresFindingsHref, measuresHref, parseMeasureFilters, type MeasureRecord } from "@/lib/measures-explorer";
import { buildKpiExplorerRows, buildSpiExplorerRows } from "@/lib/measures-explorer-model";
import { buildMeasuresSummary } from "@/lib/measures-summary";
import type { KpiRow } from "@/lib/measures";
import type { AnalyticsResult, AssetSpiEvaluation, Dataset, Filters, Finding } from "@/lib/types";
import { testSpiDefinitions } from "./spi-definition-fixtures";

const row = (id: string, overrides: Partial<MeasureRecord> = {}): MeasureRecord => ({
  id, name: `Measure ${id}`, description: "Check collection coverage", successMeasure: "All assessed entities satisfy the requirement",
  scorePercent: 50, compliant: 5, nonCompliant: 3, unknown: 2, total: 10,
  reportHref: "/current", trendHref: "/trend", assetTypeBreakdown: [], ...overrides
});
const rows = [row("KPI-1"), row("KPI-2", { compliant: 10, nonCompliant: 0, unknown: 0, scorePercent: 100 }), row("KPI-3", { total: 0, compliant: 0, nonCompliant: 0, unknown: 0, scorePercent: 0, reportHref: null, trendHref: null })];
const scope: Filters = { managedNetwork: "net-1,net-2", ictSystem: "sys-1", securityDomain: "Protected", environment: "Production", assetType: "server", severity: "High Risk", missionCapability: "mission-1", businessService: "service-1", systemCriticality: "Critical" };
const snapshotDate = "2026-10-31";
const evaluation = (id: string): AssetSpiEvaluation => ({ assetId: id, assetType: "server", networkId: "net-1", systemId: "sys-1", environmentType: "Production", securityDomain: "Protected", systemCriticality: "Critical", discoveryCoverageCompliant: false,
  evaluations: [{ spiId: 1, status: "Non-compliant", evidence: {}, reasons: [] }, { spiId: 2, status: "Unknown", evidence: {}, reasons: [] }] });
const finding = (id: string, overrides: Partial<Finding> = {}): Finding => ({ id, spiId: 1, status: "open", complianceStatus: "Non-compliant", severity: "High Risk", priorityRank: 2, timestamp: snapshotDate,
  scope: { assetId: "ci-1", networkId: "net-1", systemId: "sys-1", environmentType: "Production" }, title: "Finding", evidence: {}, recommendedAction: "Review", ...overrides });
const analytics: AnalyticsResult = { evaluations: [evaluation("ci-1"), evaluation("ci-2")], findings: [finding("f-1"), finding("f-2", { spiId: 2, priorityRank: 1 }), finding("f-3", { spiId: 2, complianceStatus: "Unknown", priorityRank: 90, severity: "Data Gap" }), finding("f-4", { status: "closed" })],
  networkRollups: [], systemRollups: [], environmentRollups: [], overallCompliancePercent: 0, statusTotals: { compliant: 0, nonCompliant: 2, unknown: 2, impactedAssets: 2 }, productionCriticalExposureAssetIds: [] };
const dataset: Dataset = { generatedAt: snapshotDate, snapshotDate, assets: [], managedNetworks: [], ictSystems: [], spiEvaluations: [] };
const definitions = testSpiDefinitions.slice(0, 3);
const settings = { updatedAt: snapshotDate, severityMatrix: {}, priorityMatrix: { "1": 2, "2": 1, "3": 3 } };
const summaryInput = { kpis: rows, spis: [row("SPI-1", { compliant: 2, total: 3, nonCompliant: 1, unknown: 0 }), row("SPI-2", { compliant: 10, total: 100, nonCompliant: 80, unknown: 10 }), row("SPI-3", { compliant: 0, nonCompliant: 0, unknown: 0, total: 0 })], analytics, settings, spiDefinitions: definitions,
  severityDefinitions: [{ severityKey: "High Risk", label: "High risk", displayOrder: 1, selectableInSettings: true, toneKey: "danger" }], priorityDefinitions: [{ priorityRank: 1, label: "Urgent", displayOrder: 1, selectableInSettings: true, description: "Urgent" }] };

describe("measure table filters", () => {
  it("keeps non-compliant and unknown results independently visible on the same indicator", () => {
    expect(measureResults(rows[0])).toEqual(["Non-compliant", "Unknown"]);
    expect(filterMeasureRows(rows, { search: "", columns: { result: ["Unknown"] } }).map((item) => item.id)).toEqual(["KPI-1"]);
  });
  it("does not present zero assessments as fully compliant", () => {
    expect(measureResults(rows[2])).toEqual(["No assessments"]);
    expect(measureValues(rows[2], "score")).toEqual(["N/A"]);
  });
  it("combines columns with AND and selections within a column with OR", () => {
    const filters = { search: "", columns: { id: ["KPI-1", "KPI-2"], result: ["Fully compliant"] } };
    expect(filterMeasureRows(rows, filters).map((item) => item.id)).toEqual(["KPI-2"]);
  });
  it("searches the expanded description and success measure", () => {
    expect(filterMeasureRows(rows, { search: "COLLECTION", columns: {} })).toHaveLength(3);
    expect(filterMeasureRows(rows, { search: "satisfy the requirement", columns: {} })).toHaveLength(3);
  });
  it("facets ignore their own selection but respect search and other columns", () => {
    expect(measureFacets(rows, { search: "", columns: { id: ["KPI-1"], result: ["Fully compliant"] } }, "result")).toEqual([{ value: "Non-compliant", count: 1 }, { value: "Unknown", count: 1 }]);
  });
  it("filters independently available reports", () => {
    const source = [row("SPI-1", { reportHref: null }), row("SPI-2", { trendHref: null })];
    expect(filterMeasureRows(source, { search: "", columns: { reports: ["Trend report"] } }).map((item) => item.id)).toEqual(["SPI-1"]);
  });
  it("validates columns, payload types and search lengths", () => {
    for (const payload of [null, [], { search: "x".repeat(501), columns: {} }, { search: "", columns: { unsupported: [] } }, { search: "", columns: { id: [1] } }]) expect(() => parseMeasureFilters(payload)).toThrow();
    expect(parseMeasureFilters({ search: "", columns: { id: ["KPI-1", "KPI-1"] } }).columns.id).toEqual(["KPI-1"]);
  });
});

describe("measure report preservation and navigation", () => {
  it("retains the KPI current/trend availability and SQL score", () => {
    const kpi: KpiRow = { id: "KPI-1", displayOrder: 1, name: "Coverage", description: "Scope", successMeasure: "All", calculationKey: "test", reportAvailable: false, score: "42%", scorePercent: 42, compliantCount: 4, applicableCount: 10, nonCompliantCount: 5, unknownCount: 1, highPriorityCount: 2 };
    expect(buildKpiExplorerRows([kpi], scope, snapshotDate)[0]).toMatchObject({ scorePercent: 42, reportHref: null, trendHref: null, highPriorityCount: 2 });
    const enabled = buildKpiExplorerRows([{ ...kpi, reportAvailable: true }], scope, snapshotDate)[0];
    expect(new URL(enabled.reportHref!, "http://localhost").searchParams.get("kind")).toBe("kpi");
    expect(new URL(enabled.trendHref!, "http://localhost").searchParams.get("kind")).toBe("kpi-trend");
  });
  it("retains SPI report flags independently and every CI-type breakdown", () => {
    const result = buildSpiExplorerRows(dataset, analytics, [{ ...definitions[0], reportAvailable: false, trendReportAvailable: true }], scope)[0];
    expect(result.reportHref).toBeNull();
    expect(new URL(result.trendHref!, "http://localhost").searchParams.get("kind")).toBe("spi-trend");
    expect(result.assetTypeBreakdown).toHaveLength(6);
    expect(result.assetTypeBreakdown.find((group) => group.id === "server")?.nonCompliant).toBe(2);
    expect(result.total).toBe(2);
  });
  it("preserves every page scope field and the actual snapshot on drill-through", () => {
    const selection = { search: "", columns: { id: ["SPI-1"] } };
    const params = new URL(measuresHref("measures-spi", scope, snapshotDate, selection), "http://localhost").searchParams;
    expect(Object.fromEntries(params)).toMatchObject({ network: "net-1,net-2", system: "sys-1", securityDomain: "Protected", environment: "Production", assetType: "server", severity: "High Risk", mission: "mission-1", service: "service-1", criticality: "Critical", dataDate: snapshotDate });
    expect(initialMeasureFilters(Object.fromEntries(params))).toEqual(selection);
    const findingParams = new URL(measuresFindingsHref(scope, snapshotDate, { severity: "Data Gap" }), "http://localhost").searchParams;
    expect(Object.fromEntries(findingParams)).toMatchObject({ findingsViewTab: "register", findingsTab: "open", asOf: snapshotDate, dataDate: snapshotDate, severity: "Data Gap" });
  });
  it("supports legacy SPI/search links and safely ignores malformed new filters", () => {
    expect(initialMeasureFilters({ spi: "2", measureSearch: "test" }, 2)).toEqual({ search: "test", columns: { id: ["SPI-2"] } });
    for (const raw of ["{", "null", "x".repeat(12001)]) expect(initialMeasureFilters({ measureFilters: raw })).toEqual(emptyMeasureFilters());
  });
});

describe("executive measures summary", () => {
  it("uses weighted SPI assessment coverage without averaging unlike KPI populations", () => {
    const result = buildMeasuresSummary(summaryInput);
    expect(result.spiAssessment).toEqual({ assessed: 103, compliant: 12, nonCompliant: 81, unknown: 10, percent: 11.7 });
    expect(result.kpis).toMatchObject({ total: 3, nonCompliant: 1, unknown: 1, fullyCompliant: 1, unassessed: 1 });
  });
  it("deduplicates affected CIs, networks and systems and allows evidence gaps to overlap", () => {
    const result = buildMeasuresSummary(summaryInput);
    expect(result).toMatchObject({ totalCis: 2, affectedCis: 2, unknownCis: 2, affectedNetworks: 1, affectedSystems: 1 });
  });
  it("uses open findings only, preserves evidence-gap classifications, and follows saved priorities", () => {
    const result = buildMeasuresSummary(summaryInput);
    expect(result.openFindings).toBe(3);
    expect(result.openUnknownFindings).toBe(1);
    expect(result.severities).toEqual([{ key: "High Risk", label: "High risk", count: 2 }, { key: "Data Gap", label: "Data Gap", count: 1 }]);
    expect(result.priorityFocus.map((item) => [item.id, item.priority, item.nonCompliant])).toEqual([["SPI-2", "Urgent", 1], ["SPI-1", "P2", 1]]);
    const updated = buildMeasuresSummary({ ...summaryInput, settings: { ...settings, priorityMatrix: { "1": 1, "2": 3 } } });
    expect(updated.priorityFocus[0].id).toBe("SPI-1");
  });
  it("keeps empty scopes and unassessed definitions distinct from a healthy result", () => {
    const result = buildMeasuresSummary({ ...summaryInput, kpis: [], spis: [], analytics: { ...analytics, findings: [], evaluations: [] } });
    expect(result.spiAssessment.percent).toBeNull();
    expect(result.kpis.fullyCompliant).toBe(0);
    expect(result.priorityFocus).toEqual([]);
  });
  it("matches summary result links to the corresponding filtered indicators", () => {
    const model = buildMeasuresSummary(summaryInput);
    for (const result of ["Non-compliant", "Unknown", "No assessments"]) {
      const href = measuresHref("measures-kpi", scope, snapshotDate, { search: "", columns: { result: [result] } });
      const filters = initialMeasureFilters(Object.fromEntries(new URL(href, "http://localhost").searchParams));
      const count = filterMeasureRows(rows, filters).length;
      expect(count).toBe(result === "Non-compliant" ? model.kpis.nonCompliant : result === "Unknown" ? model.kpis.unknown : model.kpis.unassessed);
    }
  });
});
