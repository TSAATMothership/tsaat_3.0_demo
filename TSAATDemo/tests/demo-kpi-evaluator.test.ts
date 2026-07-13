import { describe, expect, it } from "vitest";

import {
  demoKpiStableHash,
  evaluateDemoKpis,
  evaluateDemoKpiScopes
} from "@/lib/demo-kpi-evaluator";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import type { Asset, Dataset, Finding, ICTSystem, ManagedNetwork } from "@/lib/types";

const CALCULATION_KEYS = [
  "overall-spi-compliance",
  "protected-domain-compliance",
  "secret-domain-compliance",
  "critical-ict-system-compliance",
  "critical-exposure-in-production",
  "discovery-coverage-compliance",
  "active-ato-coverage",
  "diis-registration-coverage",
  "diis-modelled-coverage",
  "network-discovery-enablement"
] as const;

function makeDefinitions(): KpiDefinition[] {
  return CALCULATION_KEYS.map((calculationKey, index) => ({
    id: `KPI-${index + 1}`,
    displayOrder: index + 1,
    name: calculationKey,
    description: calculationKey,
    successMeasure: calculationKey,
    calculationKey,
    reportAvailable: false,
    enabled: true,
    calculationDefinition: {
      calculationKey,
      sourceKey: "demo",
      displayOrder: index + 1,
      name: calculationKey,
      description: calculationKey,
      enabled: true
    },
    taskingTeams: [],
    taskingActions: [],
    taskingConditions: {}
  }));
}

function makeSystem(input: {
  id: string;
  networkId: string;
  criticality: "Critical" | "Non-Critical";
  diisDefined: boolean;
  modellingStatus: boolean;
}): ICTSystem {
  return {
    ...input,
    name: input.id,
    adfPlatform: false,
    enterprisePlatform: false,
    securityDomain: "Protected",
    missionCapabilities: [],
    businessServices: [],
    environments: []
  };
}

function makeNetwork(id: string, discoveryStatus: "Discovery Enabled" | "Discovery Non Enabled"): ManagedNetwork {
  return {
    id,
    name: id,
    criticality: "Non-Critical",
    adfPlatform: false,
    enterprisePlatform: false,
    modellingStatus: true,
    discoveryStatus,
    ictSystemIds: [],
    assetIds: []
  };
}

function makeAsset(input: {
  id: string;
  networkId: string;
  securityDomain: "Protected" | "Secret" | "Unclassified";
  systemId?: string;
}): Asset {
  return {
    id: input.id,
    name: input.id,
    hostname: input.id,
    type: "other",
    networkId: input.networkId,
    securityDomain: input.securityDomain,
    lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
    vulnerabilities: [],
    ...(input.systemId
      ? { systemContext: { systemId: input.systemId, environmentType: "Production" as const } }
      : {})
  };
}

function makeFinding(input: {
  id: string;
  assetId: string;
  systemId?: string;
  severity: string;
  priorityRank: number;
}): Finding {
  return {
    id: input.id,
    spiId: 1,
    priorityRank: input.priorityRank,
    severity: input.severity,
    status: "open",
    complianceStatus: "Non-compliant",
    timestamp: "2026-04-23T00:00:00.000Z",
    scope: {
      networkId: input.assetId === "a2" ? "net-2" : "net-1",
      systemId: input.systemId ?? null,
      environmentType: input.systemId ? "Production" : null,
      assetId: input.assetId
    },
    title: input.id,
    evidence: {},
    recommendedAction: input.id
  };
}

function fixture() {
  const assets = [
    makeAsset({ id: "a1", networkId: "net-1", securityDomain: "Protected", systemId: "system-5" }),
    makeAsset({ id: "a2", networkId: "net-2", securityDomain: "Secret", systemId: "system-2" }),
    makeAsset({ id: "a3", networkId: "net-1", securityDomain: "Protected" })
  ];
  const findings = [
    makeFinding({ id: "f1", assetId: "a1", systemId: "system-5", severity: "Critical Exposure", priorityRank: 1 }),
    makeFinding({ id: "f2", assetId: "a2", systemId: "system-2", severity: "High Risk", priorityRank: 2 }),
    makeFinding({ id: "f3", assetId: "a3", severity: "Medium", priorityRank: 3 })
  ];
  const dataset: Dataset = {
    snapshotId: 8,
    generatedAt: "2026-04-23T00:00:00.000Z",
    snapshotDate: "2026-04-23",
    managedNetworks: [
      makeNetwork("net-1", "Discovery Enabled"),
      makeNetwork("net-2", "Discovery Non Enabled")
    ],
    ictSystems: [
      makeSystem({
        id: "system-5",
        networkId: "net-1",
        criticality: "Critical",
        diisDefined: true,
        modellingStatus: true
      }),
      makeSystem({
        id: "system-2",
        networkId: "net-2",
        criticality: "Non-Critical",
        diisDefined: true,
        modellingStatus: false
      })
    ],
    assets,
    spiEvaluations: [
      { assetId: "a1", spiId: 1, status: "Compliant", outcomeKey: "ok", evidence: {}, reasons: [] },
      { assetId: "a1", spiId: 2, status: "Unknown", outcomeKey: "unknown", evidence: {}, reasons: [] },
      { assetId: "a2", spiId: 1, status: "Non-compliant", outcomeKey: "bad", evidence: {}, reasons: [] },
      { assetId: "a2", spiId: 2, status: "Compliant", outcomeKey: "ok", evidence: {}, reasons: [] },
      { assetId: "a3", spiId: 1, status: "Compliant", outcomeKey: "ok", evidence: {}, reasons: [] }
    ],
    discoveryCoverageEvaluations: [
      { assetId: "a1", toolValues: {}, missingToolIds: [], missingToolNames: [], coverageCompliance: true },
      { assetId: "a2", toolValues: {}, missingToolIds: ["tool"], missingToolNames: ["Tool"], coverageCompliance: false },
      { assetId: "a3", toolValues: {}, missingToolIds: [], missingToolNames: [], coverageCompliance: true }
    ],
    findings
  };

  return { dataset, findings, definitions: makeDefinitions() };
}

describe("demo KPI evaluator", () => {
  it("matches fn_kpi_stable_hash for the deterministic ATO and DIIS proxies", () => {
    expect(demoKpiStableHash("system-5:ato")).toBe(2459212985);
    expect(demoKpiStableHash("system-5:diis")).toBe(3221237234);
    expect(demoKpiStableHash("system-2:ato")).toBe(2456442422);
    expect(demoKpiStableHash("system-2:diis")).toBe(3135349781);
    expect(demoKpiStableHash("system-5:ato   ")).toBe(demoKpiStableHash("system-5:ato"));
  });

  it("reproduces all ten SQL KPI calculations and one-decimal score formatting", () => {
    const { dataset, findings, definitions } = fixture();
    const evaluations = evaluateDemoKpis({
      dataset,
      assetIds: dataset.assets.map((asset) => asset.id),
      systemIds: dataset.ictSystems.map((system) => system.id),
      networkIds: dataset.managedNetworks.map((network) => network.id),
      findings,
      kpiDefinitions: definitions
    });
    const byKey = new Map(evaluations.map((evaluation) => [evaluation.calculationKey, evaluation]));

    expect(evaluations).toHaveLength(10);
    expect(byKey.get("overall-spi-compliance")).toMatchObject({
      score: "60.0% (3/5)",
      scorePercent: 60,
      compliantCount: 3,
      applicableCount: 5,
      nonCompliantCount: 1,
      unknownCount: 1,
      highPriorityCount: 2
    });
    expect(byKey.get("protected-domain-compliance")).toMatchObject({
      score: "66.7% (2/3)",
      scorePercent: 66.7,
      highPriorityCount: 1
    });
    expect(byKey.get("secret-domain-compliance")).toMatchObject({
      score: "50.0% (1/2)",
      scorePercent: 50,
      highPriorityCount: 1
    });
    expect(byKey.get("critical-ict-system-compliance")).toMatchObject({
      score: "50.0% (1/2)",
      scorePercent: 50,
      highPriorityCount: 1
    });
    expect(byKey.get("critical-exposure-in-production")).toMatchObject({
      score: "1",
      scorePercent: 66.7,
      compliantCount: 2,
      applicableCount: 3,
      nonCompliantCount: 1,
      unknownCount: 1,
      highPriorityCount: 1
    });
    expect(byKey.get("discovery-coverage-compliance")).toMatchObject({
      score: "66.7% (2/3)",
      scorePercent: 66.7,
      highPriorityCount: 1
    });
    expect(byKey.get("active-ato-coverage")).toMatchObject({
      score: "50.0% (1/2)",
      scorePercent: 50,
      highPriorityCount: 1
    });
    expect(byKey.get("diis-registration-coverage")).toMatchObject({
      score: "50.0% (1/2)",
      scorePercent: 50,
      highPriorityCount: 1
    });
    expect(byKey.get("diis-modelled-coverage")).toMatchObject({
      score: "50.0% (1/2)",
      scorePercent: 50,
      highPriorityCount: 1
    });
    expect(byKey.get("network-discovery-enablement")).toMatchObject({
      score: "50.0% (1/2)",
      scorePercent: 50,
      highPriorityCount: 1
    });
  });

  it("applies independent asset, system, and network scopes and supports the bulk loader contract", () => {
    const { dataset, findings, definitions } = fixture();
    const single = evaluateDemoKpis({
      dataset,
      assetIds: ["a1"],
      systemIds: ["system-5"],
      networkIds: ["net-1"],
      findings,
      kpiDefinitions: definitions
    });
    const singleByKey = new Map(single.map((evaluation) => [evaluation.calculationKey, evaluation]));

    expect(singleByKey.get("overall-spi-compliance")?.score).toBe("50.0% (1/2)");
    expect(singleByKey.get("critical-exposure-in-production")?.scorePercent).toBe(0);
    expect(singleByKey.get("discovery-coverage-compliance")?.score).toBe("100.0% (1/1)");
    expect(singleByKey.get("active-ato-coverage")?.score).toBe("0.0% (0/1)");
    expect(singleByKey.get("diis-registration-coverage")?.score).toBe("100.0% (1/1)");
    expect(singleByKey.get("diis-modelled-coverage")?.score).toBe("100.0% (1/1)");
    expect(singleByKey.get("network-discovery-enablement")?.score).toBe("100.0% (1/1)");

    const bulk = evaluateDemoKpiScopes({
      dataset,
      scopes: [
        {
          scopeKey: "scope-a1",
          assetIds: ["a1"],
          systemIds: ["system-5"],
          networkIds: ["net-1"],
          findings
        },
        {
          scopeKey: "empty-is-filtered-like-data-loader",
          assetIds: [],
          systemIds: [],
          networkIds: [],
          findings: []
        }
      ],
      kpiDefinitions: definitions
    });

    expect(bulk.get("scope-a1")).toEqual(single);
    expect(bulk.has("empty-is-filtered-like-data-loader")).toBe(false);
  });

  it("omits disabled KPI and calculation definitions like the SQL inner joins", () => {
    const { dataset, findings, definitions } = fixture();
    definitions[0] = { ...definitions[0], enabled: false };
    definitions[1] = {
      ...definitions[1],
      calculationDefinition: { ...definitions[1].calculationDefinition!, enabled: false }
    };

    const evaluations = evaluateDemoKpis({
      dataset,
      assetIds: dataset.assets.map((asset) => asset.id),
      systemIds: dataset.ictSystems.map((system) => system.id),
      networkIds: dataset.managedNetworks.map((network) => network.id),
      findings,
      kpiDefinitions: definitions
    });

    expect(evaluations.map((evaluation) => evaluation.kpiId)).not.toContain("KPI-1");
    expect(evaluations.map((evaluation) => evaluation.kpiId)).not.toContain("KPI-2");
    expect(evaluations).toHaveLength(8);
  });
});
