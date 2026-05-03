import { describe, expect, it } from "vitest";
import { buildSystemTopologyData } from "@/lib/network-topology";
import { UNASSIGNED_NETWORK_ID } from "@/lib/network-scope";
import { AnalyticsResult, Dataset } from "@/lib/types";

function buildAnalyticsResult(): AnalyticsResult {
  return {
    evaluations: [
      {
        assetId: "asset-core-1",
        assetType: "server",
        networkId: "net-core",
        systemId: "sys-core",
        environmentType: "Production",
        securityDomain: "Protected",
        systemCriticality: "Critical",
        discoveryCoverageCompliant: true,
        evaluations: [{ spiId: 1, status: "Compliant", evidence: {}, reasons: [] }]
      },
      {
        assetId: "asset-dep-in-model",
        assetType: "server",
        networkId: "net-dep",
        systemId: "sys-dep",
        environmentType: "Production",
        securityDomain: "Protected",
        systemCriticality: "Critical",
        discoveryCoverageCompliant: false,
        evaluations: [{ spiId: 1, status: "Non-compliant", evidence: {}, reasons: [] }]
      },
      {
        assetId: "asset-dep-out-of-model",
        assetType: "server",
        networkId: "net-dep",
        systemId: "sys-dep",
        environmentType: "Production",
        securityDomain: "Protected",
        systemCriticality: "Critical",
        discoveryCoverageCompliant: true,
        evaluations: [{ spiId: 1, status: "Compliant", evidence: {}, reasons: [] }]
      },
      {
        assetId: "asset-unassigned",
        assetType: "server",
        networkId: UNASSIGNED_NETWORK_ID,
        systemId: "sys-core",
        environmentType: "Production",
        securityDomain: "Protected",
        systemCriticality: "Critical",
        discoveryCoverageCompliant: true,
        evaluations: [{ spiId: 1, status: "Compliant", evidence: {}, reasons: [] }]
      }
    ],
    findings: [],
    networkRollups: [],
    systemRollups: [],
    environmentRollups: [],
    overallCompliancePercent: 0,
    statusTotals: {
      compliant: 0,
      nonCompliant: 0,
      unknown: 0,
      impactedAssets: 0
    },
    productionCriticalExposureAssetIds: []
  };
}

function buildDataset(): Dataset {
  return {
    generatedAt: "2026-04-12T00:00:00.000Z",
    snapshotDate: "2026-04-12",
    managedNetworks: [
      {
        id: "net-core",
        name: "Core Network",
        criticality: "Critical",
        adfPlatform: false,
        enterprisePlatform: false,
        modellingStatus: true,
        discoveryStatus: "Discovery Enabled",
        ictSystemIds: ["sys-core"],
        assetIds: ["asset-core-1"]
      },
      {
        id: "net-dep",
        name: "Dependent Network",
        criticality: "Critical",
        adfPlatform: false,
        enterprisePlatform: false,
        modellingStatus: true,
        discoveryStatus: "Discovery Enabled",
        ictSystemIds: ["sys-dep"],
        assetIds: ["asset-dep-in-model", "asset-dep-out-of-model"]
      },
      {
        id: UNASSIGNED_NETWORK_ID,
        name: "Unassigned Systems",
        criticality: "Non-Critical",
        adfPlatform: false,
        enterprisePlatform: false,
        modellingStatus: false,
        discoveryStatus: "Discovery Non Enabled",
        ictSystemIds: ["sys-core"],
        assetIds: ["asset-unassigned"]
      }
    ],
    ictSystems: [
      {
        id: "sys-core",
        name: "Core ICT System",
        adfPlatform: false,
        enterprisePlatform: false,
        modellingStatus: true,
        diisDefined: true,
        networkId: "net-core",
        criticality: "Critical",
        securityDomain: "Protected",
        missionCapabilities: [],
        businessServices: [],
        environments: [
          {
            id: "env-core-prod",
            name: "Production",
            type: "Production",
            assetIds: ["asset-core-1", "asset-dep-in-model", "asset-unassigned"]
          }
        ]
      },
      {
        id: "sys-dep",
        name: "Dependent ICT System",
        adfPlatform: false,
        enterprisePlatform: false,
        modellingStatus: true,
        diisDefined: true,
        networkId: "net-dep",
        criticality: "Critical",
        securityDomain: "Protected",
        missionCapabilities: [],
        businessServices: [],
        environments: [
          {
            id: "env-dep-prod",
            name: "Production",
            type: "Production",
            assetIds: ["asset-dep-in-model", "asset-dep-out-of-model"]
          }
        ]
      }
    ],
    assets: [
      {
        id: "asset-core-1",
        name: "Core Server",
        hostname: "core-1",
        type: "server",
        networkId: "net-core",
        securityDomain: "Protected",
        lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
        vulnerabilities: [],
        operatingSystem: null,
        installedSoftware: [],
        systemContext: { systemId: "sys-core", environmentType: "Production" }
      },
      {
        id: "asset-dep-in-model",
        name: "Dependent In Model",
        hostname: "dep-in-model",
        type: "server",
        networkId: "net-dep",
        securityDomain: "Protected",
        lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
        vulnerabilities: [],
        operatingSystem: null,
        installedSoftware: [],
        systemContext: { systemId: "sys-dep", environmentType: "Production" }
      },
      {
        id: "asset-dep-out-of-model",
        name: "Dependent Out Of Model",
        hostname: "dep-out-of-model",
        type: "server",
        networkId: "net-dep",
        securityDomain: "Protected",
        lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
        vulnerabilities: [],
        operatingSystem: null,
        installedSoftware: [],
        systemContext: { systemId: "sys-dep", environmentType: "Production" }
      },
      {
        id: "asset-unassigned",
        name: "Unassigned Server",
        hostname: "unassigned-1",
        type: "server",
        networkId: UNASSIGNED_NETWORK_ID,
        securityDomain: "Protected",
        lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
        vulnerabilities: [],
        operatingSystem: null,
        installedSoftware: [],
        systemContext: { systemId: "sys-core", environmentType: "Production" }
      }
    ],
    ciDependencies: [
      {
        id: "dep-core-flow",
        sourceAssetId: "asset-core-1",
        targetAssetId: "asset-dep-in-model",
        dependencyType: "Flow Dependency",
        protocol: "TCP",
        sourcePort: 55221,
        targetPort: 443
      },
      {
        id: "dep-dep-logical",
        sourceAssetId: "asset-dep-in-model",
        targetAssetId: "asset-dep-out-of-model",
        dependencyType: "Logical Dependency"
      }
    ]
  };
}

describe("buildSystemTopologyData model-scoped dependencies", () => {
  it("includes only dependent entities and compliance based on CIs in the viewed system model", () => {
    const topology = buildSystemTopologyData(buildDataset(), buildAnalyticsResult(), "sys-core");

    const networkNodes = topology.nodes.filter((node) => node.entityType === "network");
    const systemNodes = topology.nodes.filter((node) => node.entityType === "ict-system");
    expect(networkNodes.map((node) => node.entityId)).toEqual(["net-dep"]);
    expect(systemNodes.map((node) => node.entityId).sort()).toEqual(["sys-core", "sys-dep"]);

    const dependentSystemNode = systemNodes.find((node) => node.entityId === "sys-dep");
    expect(dependentSystemNode?.cyberCompliance.nonCompliant).toBe(1);
    expect(dependentSystemNode?.cyberCompliance.compliant).toBe(0);

    const dependentNetworkNode = networkNodes[0];
    expect(dependentNetworkNode?.cyberCompliance.nonCompliant).toBe(1);
    expect(dependentNetworkNode?.cyberCompliance.compliant).toBe(0);

    const coreCmdb = topology.cmdbTopologies.find((item) => item.systemId === "sys-core");
    expect(coreCmdb?.servers.map((item) => item.id)).toEqual(["asset-core-1"]);
    expect(coreCmdb?.servers[0]?.cyberCompliance.compliant).toBe(1);
    expect(coreCmdb?.servers[0]?.cyberCompliance.nonCompliant).toBe(0);
    expect(coreCmdb?.servers[0]?.discoveryCompliance.compliant).toBe(1);
    expect(coreCmdb?.servers[0]?.discoveryCompliance.nonCompliant).toBe(0);

    const depCmdb = topology.cmdbTopologies.find((item) => item.systemId === "sys-dep");
    expect(depCmdb?.servers.map((item) => item.id)).toEqual(["asset-dep-in-model"]);
    expect(depCmdb?.servers[0]?.cyberCompliance.compliant).toBe(0);
    expect(depCmdb?.servers[0]?.cyberCompliance.nonCompliant).toBe(1);
    expect(depCmdb?.servers[0]?.discoveryCompliance.compliant).toBe(0);
    expect(depCmdb?.servers[0]?.discoveryCompliance.nonCompliant).toBe(1);

    expect(topology.ciDependencies.map((item) => item.id).sort()).toEqual(["dep-core-flow", "dep-dep-logical"]);
    expect(topology.ciNodes.map((item) => item.id).sort()).toEqual([
      "asset-core-1",
      "asset-dep-in-model",
      "asset-dep-out-of-model"
    ]);
    expect(topology.modelAssetIds.sort()).toEqual(["asset-core-1", "asset-dep-in-model", "asset-unassigned"]);
  });
});
