import { describe, expect, it } from "vitest";
import { subtractCalendarMonthsDateKey } from "@/lib/data-date";
import {
  buildSpiReportModel,
  buildSpiReportModels,
  buildSpiTrendReportModel,
  spiReportAssetTypeGroup
} from "@/lib/spi-report-model";
import { Asset, AssetSpiEvaluation, AssetType, ComplianceStatus, Dataset } from "@/lib/types";
import { testSpiDefinitions } from "./spi-definition-fixtures";

function baseAsset(id: string, name: string, type: AssetType): Asset {
  const common = {
    id,
    name,
    hostname: id,
    networkId: "net-1",
    securityDomain: "Protected" as const,
    lifecycle: { eolStatus: "Supported" as const, warrantyStatus: "InWarranty" as const },
    vulnerabilities: [],
    systemContext: { systemId: "sys-1", environmentType: "Production" as const }
  };

  if (type === "server") {
    return { ...common, type, operatingSystem: null, installedSoftware: [] };
  }
  if (type === "workstation") {
    return { ...common, type, operatingSystem: null, installedSoftware: [] };
  }
  if (type === "network-device") {
    return { ...common, type, networkOs: null, patchState: null };
  }
  return { ...common, type } as Asset;
}

function evaluationForAsset(asset: Asset, status: ComplianceStatus): AssetSpiEvaluation {
  return {
    assetId: asset.id,
    assetType: asset.type,
    networkId: asset.networkId,
    systemId: asset.systemContext?.systemId ?? null,
    environmentType: asset.systemContext?.environmentType ?? null,
    securityDomain: asset.securityDomain,
    systemCriticality: "Critical",
    discoveryCoverageCompliant: true,
    evaluations: [
      {
        spiId: 10,
        status,
        evidence: {},
        reasons: [`${status} reason`]
      }
    ]
  };
}

function reportFixture({
  snapshotDate = "2026-04-30",
  statuses = [
    "Compliant",
    "Non-compliant",
    "Unknown",
    "Unknown",
    "Non-compliant",
    "Compliant"
  ] as ComplianceStatus[]
}: {
  snapshotDate?: string;
  statuses?: ComplianceStatus[];
} = {}) {
  const assets = [
    baseAsset("srv-1", "Server 1", "server"),
    baseAsset("wks-1", "Workstation 1", "workstation"),
    baseAsset("net-1", "Network Device 1", "network-device"),
    baseAsset("prt-1", "Printer 1", "printer-device"),
    baseAsset("sto-1", "Storage 1", "storage-device"),
    baseAsset("oth-1", "Other 1", "other")
  ];
  const dataset: Dataset = {
    generatedAt: `${snapshotDate}T00:00:00.000Z`,
    snapshotDate,
    spiEvaluations: [],
    managedNetworks: [],
    ictSystems: [],
    assets
  };
  const analytics = {
    evaluations: assets.map((asset, index) => evaluationForAsset(asset, statuses[index] ?? "Unknown")),
    findings: [],
    networkRollups: [],
    systemRollups: [],
    environmentRollups: [],
    overallCompliancePercent: 33.3,
    statusTotals: { compliant: 2, nonCompliant: 2, unknown: 2, impactedAssets: 6 },
    productionCriticalExposureAssetIds: []
  };

  return { dataset, analytics };
}

describe("SPI report model", () => {
  it("matches SPI summary counts and splits annex rows by calculable score", () => {
    const { dataset, analytics } = reportFixture();
    const report = buildSpiReportModel({ dataset, analytics, spiId: 10, spiDefinitions: testSpiDefinitions });

    expect(report).not.toBeNull();
    expect(report?.scorePercent).toBe(33.3);
    expect(report?.compliant).toBe(2);
    expect(report?.nonCompliant).toBe(2);
    expect(report?.unknown).toBe(2);
    expect(report?.total).toBe(6);
    expect(report?.annexA.map((row) => row.score).sort()).toEqual([
      "Compliant",
      "Compliant",
      "Non-compliant",
      "Non-compliant"
    ]);
    expect(report?.annexB.map((row) => row.score)).toEqual(["Unknown", "Unknown"]);
  });

  it("keeps storage-device separate from the Other Devices template bucket", () => {
    const { dataset, analytics } = reportFixture();
    const report = buildSpiReportModel({ dataset, analytics, spiId: 10, spiDefinitions: testSpiDefinitions });
    const storageBucket = report?.assetTypeBreakdown.find((bucket) => bucket.id === "storage-device");
    const otherBucket = report?.assetTypeBreakdown.find((bucket) => bucket.id === "other");

    expect(spiReportAssetTypeGroup("storage-device")).toBe("storage-device");
    expect(spiReportAssetTypeGroup("other")).toBe("other");
    expect(storageBucket).toMatchObject({ label: "Storage Devices", nonCompliant: 1, unknown: 0 });
    expect(otherBucket).toMatchObject({ label: "Other Devices", nonCompliant: 0, unknown: 0 });
  });

  it("builds all available SPI report models from the current filtered analytics", () => {
    const { dataset, analytics } = reportFixture();
    const reports = buildSpiReportModels(dataset, analytics, testSpiDefinitions);
    const spi10Report = reports.find((report) => report.spiId === 10);

    expect(reports.map((report) => report.spiId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(spi10Report).toMatchObject({
      indicatorLabel: "SPI-10",
      compliant: 2,
      nonCompliant: 2,
      unknown: 2,
      total: 6
    });
  });

  it("builds SPI trend points from the same summary counts as the current SPI report", () => {
    const older = reportFixture({
      snapshotDate: "2026-04-16",
      statuses: ["Compliant", "Compliant", "Unknown", "Unknown", "Non-compliant", "Compliant"]
    });
    const current = reportFixture();
    const currentReport = buildSpiReportModel({
      dataset: current.dataset,
      analytics: current.analytics,
      spiId: 10,
      spiDefinitions: testSpiDefinitions
    });
    const trend = buildSpiTrendReportModel({
      spiId: 10,
      snapshots: [older, current],
      spiDefinitions: testSpiDefinitions
    });

    expect(trend).not.toBeNull();
    expect(trend?.reportName).toBe("SPI 10 Trend Report: Asset Lifecycle Currency");
    expect(trend?.rangeStartDate).toBe("2026-04-16");
    expect(trend?.rangeEndDate).toBe("2026-04-30");
    expect(trend?.trendPoints).toHaveLength(2);
    expect(trend?.trendPoints[1]).toMatchObject({
      snapshotDate: "2026-04-30",
      scorePercent: currentReport?.scorePercent,
      compliant: currentReport?.compliant,
      nonCompliant: currentReport?.nonCompliant,
      unknown: currentReport?.unknown,
      total: currentReport?.total
    });
    expect(trend?.trendPoints[1].assetTypeBreakdown.find((bucket) => bucket.id === "storage-device")).toMatchObject({
      label: "Storage Devices",
      nonCompliant: 1,
      unknown: 0
    });
  });

  it("uses the supplied per-snapshot analytics scope instead of the raw dataset size", () => {
    const scoped = reportFixture({
      statuses: ["Compliant", "Non-compliant", "Unknown", "Unknown", "Non-compliant", "Compliant"]
    });
    const trend = buildSpiTrendReportModel({
      spiId: 10,
      snapshots: [
        {
          dataset: scoped.dataset,
          analytics: {
            ...scoped.analytics,
            evaluations: scoped.analytics.evaluations.slice(0, 2)
          }
        }
      ],
      spiDefinitions: testSpiDefinitions
    });

    expect(trend?.trendPoints[0]).toMatchObject({
      compliant: 1,
      nonCompliant: 1,
      unknown: 0,
      total: 2
    });
  });

  it("uses a 12-calendar-month inclusive trend window start", () => {
    expect(subtractCalendarMonthsDateKey("2026-04-23", 12)).toBe("2025-04-23");
    expect(subtractCalendarMonthsDateKey("2024-02-29", 12)).toBe("2023-02-28");
  });
});
