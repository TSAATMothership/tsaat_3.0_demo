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
      const isDiscoveryCoverage = definition.id === "KPI-6";
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
  it("marks KPI-1 through KPI-4 unavailable and KPI-5 through KPI-10 available", () => {
    const reports = buildKpiReportModels(kpiRows(1));

    expect(reports.filter((report) => !report.reportAvailable).map((report) => report.id)).toEqual([
      "KPI-1",
      "KPI-2",
      "KPI-3",
      "KPI-4"
    ]);
    expect(reports.filter((report) => report.reportAvailable).map((report) => report.id)).toEqual([
      "KPI-5",
      "KPI-6",
      "KPI-7",
      "KPI-8",
      "KPI-9",
      "KPI-10"
    ]);
    expect(isKpiReportAvailable("KPI-4", kpiDefinitions)).toBe(false);
    expect(isKpiReportAvailable("KPI-5", kpiDefinitions)).toBe(true);
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
      kpiId: "KPI-6",
      kpiDefinitions
    });
    const trend = buildKpiTrendReportModel({
      kpiId: "KPI-6",
      kpiDefinitions,
      snapshots: [
        { snapshotDate: "2026-04-16", kpiRows: kpiRows(1) },
        { snapshotDate: "2026-04-23", kpiRows: kpiRows(2) }
      ]
    });

    expect(trend).not.toBeNull();
    expect(trend?.reportName).toBe("KPI-6 Trend Report: Discovery Coverage Compliance");
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
      kpiId: "KPI-6",
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
