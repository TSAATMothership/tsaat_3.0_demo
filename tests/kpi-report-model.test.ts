import { describe, expect, it } from "vitest";
import { subtractCalendarMonthsDateKey } from "@/lib/data-date";
import {
  buildKpiReportModel,
  buildKpiReportModels,
  buildKpiTrendReportModel,
  isKpiReportAvailable
} from "@/lib/kpi-report-model";
import { normalizeKpiDefinitions } from "@/lib/kpi-definitions";
import { buildKpiRows, type KpiRow } from "@/lib/measures";
import { AnalyticsResult, AssetSpiEvaluation, ICTSystem, ManagedNetwork } from "@/lib/types";
import rawKpiDefinitions from "../Database Schema/data/kpi-definitions.json";

function evaluation(assetId: string, discoveryCoverageCompliant: boolean): AssetSpiEvaluation {
  return {
    assetId,
    assetType: "server",
    networkId: "net-1",
    systemId: "sys-1",
    environmentType: "Production",
    securityDomain: "Protected",
    systemCriticality: "Critical",
    discoveryCoverageCompliant,
    evaluations: [
      {
        spiId: 1,
        status: discoveryCoverageCompliant ? "Compliant" : "Non-compliant",
        evidence: {},
        reasons: []
      }
    ]
  };
}

function analyticsFixture(discoveryCompliantCount: number): AnalyticsResult {
  const evaluations = [evaluation("asset-1", discoveryCompliantCount >= 1), evaluation("asset-2", discoveryCompliantCount >= 2)];
  return {
    evaluations,
    findings: [],
    networkRollups: [],
    systemRollups: [],
    environmentRollups: [],
    overallCompliancePercent: 50,
    statusTotals: { compliant: discoveryCompliantCount, nonCompliant: 2 - discoveryCompliantCount, unknown: 0, impactedAssets: 2 },
    productionCriticalExposureAssetIds: []
  };
}

const systems: ICTSystem[] = [
  {
    id: "sys-1",
    name: "System 1",
    adfPlatform: true,
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
];

const networks: ManagedNetwork[] = [
  {
    id: "net-1",
    name: "Network 1",
    criticality: "Critical",
    adfPlatform: true,
    enterprisePlatform: false,
    modellingStatus: true,
    discoveryStatus: "Discovery Enabled",
    ictSystemIds: ["sys-1"],
    assetIds: ["asset-1", "asset-2"]
  }
];

const kpiDefinitions = normalizeKpiDefinitions(rawKpiDefinitions);

function kpiRows(discoveryCompliantCount: number, definitions = kpiDefinitions, discoveryApplicableCount = 2): KpiRow[] {
  return buildKpiRows(
    definitions,
    definitions.map((definition) => {
      const isDiscoveryCoverage = definition.calculationKey === "active-ato-coverage" || definition.calculationKey === "discovery-coverage-compliance";
      const compliantCount = isDiscoveryCoverage ? discoveryCompliantCount : 1;
      const applicableCount = isDiscoveryCoverage ? discoveryApplicableCount : 2;
      const scorePercent = Number(((compliantCount / applicableCount) * 100).toFixed(1));
      return {
        snapshotId: 1,
        kpiId: definition.id,
        displayOrder: definition.displayOrder,
        calculationKey: definition.calculationKey,
        score: `${scorePercent}%`,
        scorePercent,
        compliantCount,
        applicableCount,
        nonCompliantCount: applicableCount - compliantCount,
        unknownCount: 0,
        highPriorityCount: 0
      };
    })
  );
}

describe("KPI report model", () => {
  it("filters both KPI report totals and tasking counts to non-compliance without mutating source rows", () => {
    for (const id of ["KPI-1", "KPI-2"]) {
      const rows = kpiRows(1).map(row => ({ ...row, compliantCount: 3, nonCompliantCount: 2, unknownCount: 1, applicableCount: 6, scorePercent: 50, score: "50%" }));
      const report = buildKpiReportModel({ kpiRows: rows, kpiId: id, kpiDefinitions, nonCompliantOnly: true })!;
      expect(report).toMatchObject({ nonCompliantOnly: true, total: 2, nonCompliant: 2, compliant: 0, unknown: 0, scorePercent: 0 });
      expect(report.sourceRow).toMatchObject({ applicableCount: 2, nonCompliantCount: 2, compliantCount: 0, unknownCount: 0 });
      expect(buildKpiReportModel({ kpiRows: rows, kpiId: id, kpiDefinitions })).toMatchObject({ total: 6, compliant: 3, unknown: 1 });
      const empty = buildKpiReportModel({ kpiRows: rows.map(row => ({ ...row, nonCompliantCount: 0 })), kpiId: id, kpiDefinitions, nonCompliantOnly: true })!;
      expect(empty).toMatchObject({ total: 0, compliant: 0, unknown: 0, score: "N/A" });
    }
  });

  it("offers current and trend reports for the two retained system KPIs", () => {
    const reports = buildKpiReportModels(kpiRows(1));
    expect(reports.map((report) => report.id)).toEqual(["KPI-1", "KPI-2"]);
    expect(reports.every((report) => report.reportAvailable)).toBe(true);
    expect(isKpiReportAvailable("KPI-7", kpiDefinitions)).toBe(false);
    expect(isKpiReportAvailable("KPI-1", kpiDefinitions)).toBe(true);
  });

  it("uses database definition order and omits removed KPI definitions", () => {
    const customDefinitions = normalizeKpiDefinitions({
      kpis: [
        {
          id: "KPI-6",
          displayOrder: 1,
          name: "Discovery Coverage Compliance",
          description: "Discovery definition.",
          successMeasure: "Target = 100%.",
          calculationKey: "discovery-coverage-compliance",
          reportAvailable: true
        },
        {
          id: "KPI-1",
          displayOrder: 2,
          name: "Overall SPI Compliance",
          description: "Overall definition.",
          successMeasure: "Target >= 95%.",
          calculationKey: "overall-spi-compliance",
          reportAvailable: false
        }
      ]
    });

    const reports = buildKpiReportModels(kpiRows(1, customDefinitions));

    expect(reports.map((report) => report.id)).toEqual(["KPI-6", "KPI-1"]);
    expect(reports[0]).toMatchObject({
      id: "KPI-6",
      name: "Discovery Coverage Compliance",
      scorePercent: 50
    });
  });

  it("builds KPI trend points from per-snapshot scoped analytics", () => {
    const currentReport = buildKpiReportModel({
      kpiRows: kpiRows(2),
      kpiId: "KPI-1",
      kpiDefinitions
    });
    const trend = buildKpiTrendReportModel({
      kpiId: "KPI-1",
      kpiDefinitions,
      snapshots: [
        { snapshotDate: "2026-04-16", kpiRows: kpiRows(1) },
        { snapshotDate: "2026-04-23", kpiRows: kpiRows(2) }
      ]
    });

    expect(trend).not.toBeNull();
    expect(trend?.reportName).toBe("KPI-1 Trend Report: ICT Systems have an active ATO");
    expect(trend?.rangeStartDate).toBe("2026-04-16");
    expect(trend?.rangeEndDate).toBe("2026-04-23");
    expect(trend?.trendPoints[1]).toMatchObject({
      snapshotDate: "2026-04-23",
      scorePercent: currentReport?.scorePercent,
      compliant: currentReport?.compliant,
      nonCompliant: currentReport?.nonCompliant,
      unknown: currentReport?.unknown,
      total: currentReport?.total
    });
    expect(trend?.trendPoints).toEqual([
      {
        snapshotDate: "2026-04-16",
        scorePercent: 50,
        compliant: 1,
        nonCompliant: 1,
        unknown: 0,
        total: 2
      },
      {
        snapshotDate: "2026-04-23",
        scorePercent: 100,
        compliant: 2,
        nonCompliant: 0,
        unknown: 0,
        total: 2
      }
    ]);
  });

  it("uses the supplied scoped analytics for each KPI trend snapshot", () => {
    const trend = buildKpiTrendReportModel({
      kpiId: "KPI-1",
      kpiDefinitions,
      snapshots: [
        {
          snapshotDate: "2026-04-23",
          kpiRows: kpiRows(0, kpiDefinitions, 1)
        }
      ]
    });

    expect(trend?.trendPoints[0]).toMatchObject({
      scorePercent: 0,
      compliant: 0,
      nonCompliant: 1,
      unknown: 0,
      total: 1
    });
  });

  it("does not build trend reports for unavailable KPIs", () => {
    const trend = buildKpiTrendReportModel({
      kpiId: "KPI-4",
      kpiDefinitions,
      snapshots: [{ snapshotDate: "2026-04-23", kpiRows: kpiRows(2) }]
    });

    expect(trend).toBeNull();
  });

  it("uses a 12-calendar-month inclusive trend window start", () => {
    expect(subtractCalendarMonthsDateKey("2026-04-23", 12)).toBe("2025-04-23");
    expect(subtractCalendarMonthsDateKey("2024-02-29", 12)).toBe("2023-02-28");
  });
});
