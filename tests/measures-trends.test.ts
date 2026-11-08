import { describe, expect, it } from "vitest";
import { buildMeasuresTrends, measureHistory, measurePeriodStart, measureSnapshotsInPeriod, measureMovement, measureChartGeometry, MEASURE_HISTORY_OPTIONS, type MeasureObservation, type MeasureTrendPoint } from "@/lib/measures-trends";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import type { KpiRow } from "@/lib/measures";
import { testSpiDefinitions } from "./spi-definition-fixtures";
import { activeWorkspaceItem, WORKSPACE_GROUPS } from "@/lib/workspace-navigation";
import { isDataDateScopedPath } from "@/lib/data-date";

export const kpis: KpiDefinition[] = [{ id: "KPI-1", displayOrder: 1, name: "ATO coverage", description: "Systems with ATO", successMeasure: "All systems", calculationKey: "active-ato-coverage", enabled: true, reportAvailable: true, taskingTeams: [], taskingActions: [], taskingConditions: {} }];
const kpiRow = (total: number, compliant = 1): KpiRow => ({ ...kpis[0], score: "", scorePercent: total ? compliant / total * 100 : 0, compliantCount: compliant, applicableCount: total, nonCompliantCount: total - compliant, unknownCount: 0, highPriorityCount: 0 });
const observation = (snapshotDate: string, total = 2, compliant = 1): MeasureObservation => ({ snapshotDate, snapshotId: 1, kpis: [kpiRow(total, compliant)], spis: [] });
const point = (date: string, percent: number | null): MeasureTrendPoint => ({ date, percent, compliant: 0, nonCompliant: 0, unknown: 0, total: percent === null ? 0 : 10, recorded: true });

describe("Measures Trends", () => {
  it("places its scoped destination immediately below Measures Summary", () => {
    const pages = WORKSPACE_GROUPS.find(group => group.id === "observed-measures")!.items;
    expect(pages.slice(0, 2).map(page => page.label)).toEqual(["Measures Summary", "Measures Trends"]);
    expect(activeWorkspaceItem("/measures/trends", new URLSearchParams("measureTrendTab=spi&measureHistory=week"))?.id).toBe("measures-trends");
    expect(isDataDateScopedPath("/measures/trends")).toBe(true);
  });
  it("offers all five periods and makes four weeks exactly 28 days", () => {
    expect(MEASURE_HISTORY_OPTIONS.map(option => option.label)).toEqual(["1 week", "4 weeks", "3 months", "6 months", "12 months"]);
    expect(measureHistory(undefined)).toBe("4weeks"); expect(measureHistory("invalid")).toBe("4weeks"); expect(measureHistory(["week", "12months"])).toBe("week");
    expect(measurePeriodStart("week", "2026-03-31")).toBe("2026-03-24");
    expect(measurePeriodStart("4weeks", "2026-03-31")).toBe("2026-03-03");
    expect(measurePeriodStart("3months", "2026-05-31")).toBe("2026-02-28");
    expect(measurePeriodStart("6months", "2024-08-31")).toBe("2024-02-29");
    expect(measurePeriodStart("12months", "2024-02-29")).toBe("2023-02-28");
  });
  it("keeps inclusive boundaries and the latest daily revision without a point cap", () => {
    const rows = Array.from({ length: 370 }, (_, index) => ({ snapshotDate: new Date(Date.UTC(2025, 10, 5 + index)).toISOString().slice(0, 10), snapshotId: index + 1 }));
    rows.push({ snapshotDate: "2026-11-07", snapshotId: 1000 });
    const selected = measureSnapshotsInPeriod(rows.reverse(), "2025-11-07", "2026-11-07");
    expect(selected).toHaveLength(366); expect(selected[0].snapshotDate).toBe("2025-11-07"); expect(selected.at(-1)?.snapshotId).toBe(1000);
    expect(measureSnapshotsInPeriod(rows, "2027-01-01", "2027-02-01")).toEqual([]);
  });
  it("retains all configured measures, nullable empty populations and actual provider scores", () => {
    const model = buildMeasuresTrends([observation("2026-10-10"), observation("2026-10-31", 4, 3), observation("2026-11-07", 0, 0), observation("2026-11-08")], kpis, testSpiDefinitions, { network: "net-1", securityDomain: "SECRET" }, "2026-11-07");
    expect(model.from).toBe("2026-10-10"); expect(model.dates).toEqual(["2026-10-10", "2026-10-31", "2026-11-07"]);
    expect(model.kpi[0].points.map(row => row.percent)).toEqual([50, 75, null]);
    expect(model.spi).toHaveLength(testSpiDefinitions.length); expect(model.spi[0].points.every(row => row.percent === null && !row.recorded)).toBe(true);
    expect(measureMovement(model.kpi[0].points).delta).toBeNull(); // Do not reuse an earlier valid score as the latest.
    expect(model.scope).toMatchObject({ network: ["net-1"], securityDomain: "SECRET", dataDate: "2026-11-07" });
    expect(buildMeasuresTrends([], kpis, testSpiDefinitions, {}, "2026-11-07").kpi).toHaveLength(1);
  });
  it("recalculates first/last comparisons for each selected window and reports denominator changes", () => {
    const rows = [observation("2026-10-10", 4, 1), observation("2026-10-31", 2, 1), observation("2026-11-07", 4, 3)];
    const week = buildMeasuresTrends(rows, kpis, [], { measureHistory: "week" }, "2026-11-07").kpi[0].points;
    const month = buildMeasuresTrends(rows, kpis, [], { measureHistory: "4weeks" }, "2026-11-07").kpi[0].points;
    expect(measureMovement(week)).toMatchObject({ delta: 25, label: "Improving" }); expect(measureMovement(month).delta).toBe(50);
    expect(week.map(point => point.total)).toEqual([2, 4]);
    expect(measureMovement([point("2026-11-07", 0)]).delta).toBeNull();
    expect(measureMovement([point("2026-10-31", 25), point("2026-11-07", 0)])).toMatchObject({ delta: -25, label: "Declining" });
  });
  it("spaces chart points by date, fixes the percentage scale and breaks unknown values", () => {
    const chart = measureChartGeometry([point("2026-10-10", 0), point("2026-10-17", null), point("2026-11-07", 100)], "2026-10-10", "2026-11-07");
    expect(chart.plotted.map(row => row.x)).toEqual([40, 200, 680]); expect(chart.plotted.map(row => row.y)).toEqual([210, null, 30]);
    expect(chart.paths).toEqual(["M40,210", "M680,30"]);
    expect(measureChartGeometry([point("2026-11-07", 50)], "2026-10-10", "2026-11-07").plotted[0].x).toBe(680);
  });
});
