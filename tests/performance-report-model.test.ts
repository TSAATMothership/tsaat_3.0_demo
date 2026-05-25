import { describe, expect, it } from "vitest";
import {
  buildNetworkPerformanceReportModel,
  buildSystemPerformanceReportModel
} from "@/lib/performance-report-model";
import { normalizeKpiDefinitions } from "@/lib/kpi-definitions";
import type { KpiRow } from "@/lib/measures";
import { testSeverityDefinitions, testSpiDefinitions } from "./spi-definition-fixtures";
import {
  AnalyticsResult,
  Asset,
  AssetSpiEvaluation,
  Dataset,
  Finding,
  ICTSystem,
  ManagedNetwork
} from "@/lib/types";
import rawKpiDefinitions from "../Database Schema/data/kpi-definitions.json";

const snapshotDate = "2026-04-23";
const kpiDefinitions = normalizeKpiDefinitions(rawKpiDefinitions);

function kpiRows(scorePercent = 50): KpiRow[] {
  return kpiDefinitions.map((definition) => ({
    id: definition.id,
    displayOrder: definition.displayOrder,
    name: definition.name,
    description: definition.description,
    successMeasure: definition.successMeasure,
    calculationKey: definition.calculationKey,
    reportAvailable: definition.reportAvailable,
    score: `${scorePercent}%`,
    scorePercent,
    compliantCount: 1,
    applicableCount: 2,
    nonCompliantCount: 1,
    unknownCount: 0,
    highPriorityCount: 0
  }));
}

function network(id: string, name: string, modellingStatus: boolean): ManagedNetwork {
  return {
    id,
    name,
    criticality: "Critical",
    adfPlatform: false,
    enterprisePlatform: true,
    modellingStatus,
    discoveryStatus: modellingStatus ? "Discovery Enabled" : "Discovery Non Enabled",
    ictSystemIds: [],
    assetIds: []
  };
}

function system(id: string, name: string, networkId: string, modellingStatus: boolean): ICTSystem {
  return {
    id,
    name,
    adfPlatform: false,
    enterprisePlatform: true,
    description: "",
    diisId: id,
    owner: `${name} Owner`,
    modellingStatus,
    diisDefined: true,
    networkId,
    criticality: "Critical",
    securityDomain: networkId === "net-a" ? "Secret" : "Protected",
    missionCapabilities: [],
    businessServices: [],
    environments: []
  };
}

function asset(id: string, networkId: string, systemId: string, securityDomain: "Secret" | "Protected", unknownLifecycle = false): Asset {
  return {
    id,
    name: id,
    hostname: `${id}.example`,
    networkId,
    securityDomain,
    lifecycle: {
      eolStatus: unknownLifecycle ? "Unknown" : "Supported",
      warrantyStatus: unknownLifecycle ? "Unknown" : "InWarranty"
    },
    vulnerabilities: [],
    systemContext: {
      systemId,
      environmentType: "Production"
    },
    type: "server",
    operatingSystem: null,
    installedSoftware: []
  };
}

function evaluation(
  assetId: string,
  networkId: string,
  systemId: string,
  securityDomain: "Secret" | "Protected",
  discoveryCoverageCompliant: boolean,
  statuses: AssetSpiEvaluation["evaluations"]
): AssetSpiEvaluation {
  return {
    assetId,
    assetType: "server",
    networkId,
    systemId,
    environmentType: "Production",
    securityDomain,
    systemCriticality: "Critical",
    discoveryCoverageCompliant,
    evaluations: statuses
  };
}

function finding(
  id: string,
  assetId: string,
  networkId: string,
  systemId: string,
  spiId: Finding["spiId"],
  severity: Finding["severity"],
  timestamp: string,
  closedTimestamp?: string
): Finding {
  return {
    id,
    spiId,
    priorityRank: severity === "Critical Exposure" ? 1 : severity === "High Risk" ? 2 : 3,
    severity,
    status: closedTimestamp ? "closed" : "open",
    complianceStatus: "Non-compliant",
    timestamp,
    closedTimestamp,
    scope: {
      networkId,
      systemId,
      environmentType: "Production",
      assetId
    },
    title: `${id} title`,
    evidence: { assetName: assetId },
    recommendedAction: "Fix the control gap."
  };
}

function fixture() {
  const networks = [network("net-a", "Alpha Network", true), network("net-b", "Beta Network", false)];
  const systems = [system("sys-a", "Alpha System", "net-a", true), system("sys-b", "Beta System", "net-b", false)];
  const assets = [
    asset("asset-1", "net-a", "sys-a", "Secret"),
    asset("asset-2", "net-a", "sys-a", "Protected"),
    asset("asset-3", "net-b", "sys-b", "Protected", true)
  ];
  assets[0].vulnerabilities = [
    {
      assetId: "asset-1",
      cve: "CVE-2026-0001",
      description: "OpenSSL package requires patching.",
      remediationGuidance: "Apply the current vendor patch.",
      criticality: "High",
      severity: "High",
      exploitability: "Known Exploited",
      detectedDate: "2026-04-01T00:00:00.000Z",
      capturedAt: "2026-04-02T00:00:00.000Z",
      source: "scanner"
    }
  ];
  const evaluations = [
    evaluation("asset-1", "net-a", "sys-a", "Secret", true, [
      { spiId: 1, status: "Compliant", evidence: {}, reasons: [] },
      { spiId: 2, status: "Non-compliant", evidence: {}, reasons: [] }
    ]),
    evaluation("asset-2", "net-a", "sys-a", "Protected", false, [
      { spiId: 1, status: "Unknown", evidence: {}, reasons: [] },
      { spiId: 3, status: "Non-compliant", evidence: {}, reasons: [] }
    ]),
    evaluation("asset-3", "net-b", "sys-b", "Protected", false, [
      { spiId: 1, status: "Compliant", evidence: {}, reasons: [] }
    ])
  ];
  const findings = [
    finding("finding-old", "asset-1", "net-a", "sys-a", 1, "Critical Exposure", "2026-01-10T00:00:00.000Z"),
    finding("finding-60", "asset-2", "net-a", "sys-a", 3, "High Risk", "2026-02-10T00:00:00.000Z"),
    finding("finding-30", "asset-3", "net-b", "sys-b", 1, "Major", "2026-03-20T00:00:00.000Z"),
    finding(
      "finding-closed",
      "asset-1",
      "net-a",
      "sys-a",
      2,
      "Moderate",
      "2026-04-15T00:00:00.000Z",
      "2026-04-21T00:00:00.000Z"
    )
  ];
  const dataset: Dataset = {
    generatedAt: `${snapshotDate}T00:00:00.000Z`,
    snapshotDate,
    spiEvaluations: [],
    managedNetworks: networks,
    ictSystems: systems,
    assets,
    findings
  };
  const analytics: AnalyticsResult = {
    evaluations,
    findings,
    networkRollups: [],
    systemRollups: [],
    environmentRollups: [],
    overallCompliancePercent: 40,
    statusTotals: {
      compliant: 2,
      nonCompliant: 2,
      unknown: 1,
      impactedAssets: 3
    },
    productionCriticalExposureAssetIds: ["asset-1"]
  };

  return { dataset, analytics, networks, systems };
}

describe("performance report model", () => {
  it("groups compliance, KPI, discovery, and modelling by Security Domain x network", () => {
    const { dataset, analytics, networks, systems } = fixture();
    const model = buildNetworkPerformanceReportModel({
      dataset,
      analytics,
      filters: {},
      networks,
      systems,
      kpiDefinitions,
      kpiRowsByMatrixRowId: new Map([["Secret::net-a", kpiRows(50)]]),
      spiDefinitions: testSpiDefinitions,
      severityDefinitions: testSeverityDefinitions,
      asOfDate: snapshotDate
    });

    const alphaSecret = model.domainEntityRows.find(
      (row) => row.securityDomain === "Secret" && row.entityName === "Alpha Network"
    );
    expect(alphaSecret).toMatchObject({
      scorePercent: 50,
      compliant: 1,
      nonCompliant: 1,
      unknown: 0,
      total: 2
    });

    const alphaSecretKpis = model.kpiMatrixRows.find((row) => row.id === "Secret::net-a")?.kpis ?? [];
    expect(alphaSecretKpis).toHaveLength(10);
    expect(alphaSecretKpis.find((kpi) => kpi.id === "KPI-1")?.scorePercent).toBe(50);

    const alphaSecretSpiRow = model.spiMatrixRows.find((row) => row.id === "Secret::net-a");
    expect(alphaSecretSpiRow?.entityDetails).toMatchObject({
      scopeType: "network",
      id: "net-a",
      name: "Alpha Network"
    });

    const alphaSecretSpis = alphaSecretSpiRow?.spis ?? [];
    expect(alphaSecretSpis).toHaveLength(10);
    expect(alphaSecretSpis.find((spi) => spi.spiId === 1)).toMatchObject({
      scorePercent: 100,
      compliant: 1,
      nonCompliant: 0,
      unknown: 0,
      total: 1
    });
    expect(alphaSecretSpis.find((spi) => spi.spiId === 2)).toMatchObject({
      scorePercent: 0,
      compliant: 0,
      nonCompliant: 1,
      unknown: 0,
      total: 1
    });
    expect(alphaSecretSpis.find((spi) => spi.spiId === 2)?.affectedCis).toMatchObject([
      {
        assetId: "asset-1",
        assetName: "asset-1.example",
        assetType: "Server",
        totalCveVulnerabilities: 1,
        cveVulnerabilities: [
          {
            cve: "CVE-2026-0001",
            criticality: "High"
          }
        ]
      }
    ]);

    const protectedAlphaSpis = model.spiMatrixRows.find((row) => row.id === "Protected::net-a")?.spis ?? [];
    expect(protectedAlphaSpis.find((spi) => spi.spiId === 1)).toMatchObject({
      scorePercent: 0,
      compliant: 0,
      nonCompliant: 0,
      unknown: 1,
      total: 1
    });

    const protectedAlphaDiscovery = model.discoveryGapRows.find((row) => row.id === "Protected::net-a");
    expect(protectedAlphaDiscovery).toMatchObject({ scorePercent: 0, compliant: 0, nonCompliant: 1, other: 0 });

    const protectedBetaDiscovery = model.discoveryGapRows.find((row) => row.id === "Protected::net-b");
    expect(protectedBetaDiscovery).toMatchObject({ scorePercent: 0, compliant: 0, nonCompliant: 0, other: 1 });

    expect(model.modellingGapRows.map((row) => row.entityName)).toEqual(["Beta Network"]);
  });

  it("uses cumulative age thresholds and groups open findings by SPI", () => {
    const { dataset, analytics, networks, systems } = fixture();
    const model = buildNetworkPerformanceReportModel({
      dataset,
      analytics,
      filters: {},
      networks,
      systems,
      kpiDefinitions,
      spiDefinitions: testSpiDefinitions,
      severityDefinitions: testSeverityDefinitions,
      asOfDate: snapshotDate
    });

    expect(model.findingAgeThresholdRows.map((row) => [row.label, row.total])).toEqual([
      [">30d", 3],
      [">60d", 2],
      [">90d", 1]
    ]);
    expect(model.findingAgeThresholdRows[2]).toMatchObject({
      criticalExposureCount: 1,
      highRiskCount: 0,
      majorCount: 0
    });

    const spiOne = model.findingSpiRows.find((row) => row.spiId === 1);
    expect(spiOne).toMatchObject({
      total: 2,
      criticalExposureCount: 1,
      majorCount: 1
    });
    expect(model.summary.openedInWindow).toBe(3);
    expect(model.summary.closedInWindow).toBe(1);
  });

  it("uses ICT system modelling status for system-scope reports", () => {
    const { dataset, analytics, networks, systems } = fixture();
    const model = buildSystemPerformanceReportModel({
      dataset,
      analytics,
      filters: {},
      networks,
      systems,
      kpiDefinitions,
      spiDefinitions: testSpiDefinitions,
      severityDefinitions: testSeverityDefinitions,
      asOfDate: snapshotDate
    });

    expect(model.entityLabelSingular).toBe("ICT System");
    expect(model.domainEntityRows.some((row) => row.id === "Secret::sys-a")).toBe(true);
    expect(model.spiMatrixRows.find((row) => row.id === "Secret::sys-a")?.entityDetails).toMatchObject({
      scopeType: "system",
      id: "sys-a",
      name: "Alpha System",
      owner: "Alpha System Owner"
    });
    expect(model.modellingGapRows.map((row) => row.entityName)).toEqual(["Beta System"]);
  });
});
