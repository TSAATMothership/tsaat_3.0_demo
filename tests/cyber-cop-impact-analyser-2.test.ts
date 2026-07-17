import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  buildCiAnalyserRowsFromScope,
  buildCiFlowAssetScope,
  filterCiAnalyserRowsByModelledState,
  NON_MODELLED_RELATED_SYSTEM_LABEL
} from "@/lib/ci-flow-analyser";
import {
  buildCyberCopImpactAnalyserFindingRows,
  buildCyberCopImpactAnalyserRows,
  buildNetworkImpactAnalyserModelAssetIds,
  buildNetworkImpactAnalyserRows,
  buildSystemImpactAnalyserModelAssetIds,
  buildSystemImpactAnalyserRows,
  filterCyberCopImpactAnalyserRows,
  type CyberCopImpactAnalyserRow
} from "@/lib/cyber-cop-impact-analyser";
import type { TopologyCiDependency, TopologyCiNode } from "@/lib/network-topology";
import { Asset, Finding, ICTSystem, ManagedNetwork } from "@/lib/types";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const systems: ICTSystem[] = [
  {
    id: "system-1",
    name: "Payments",
    adfPlatform: false,
    enterprisePlatform: true,
    owner: "System Owner",
    supportEmail: "payments@example.test",
    modellingStatus: true,
    diisDefined: true,
    networkId: "network-1",
    criticality: "Critical",
    securityDomain: "Secret",
    missionCapabilities: [],
    businessServices: [],
    environments: []
  }
];

const networks: ManagedNetwork[] = [
  {
    id: "network-1",
    name: "Core Network",
    criticality: "Critical",
    adfPlatform: false,
    enterprisePlatform: true,
    modellingStatus: true,
    owner: "Network Owner",
    discoveryStatus: "Discovery Enabled",
    ictSystemIds: ["system-1"],
    assetIds: ["server-1"]
  }
];

const serverAsset: Asset = {
  id: "server-1",
  name: "PAY-SRV-01",
  hostname: "pay-srv-01.example.test",
  cmdbRecordUrl: "https://cmdb.example.test/assets/server-1",
  networkId: "network-1",
  securityDomain: "Secret",
  lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
  vulnerabilities: [
    {
      id: "vuln-1",
      assetId: "server-1",
      cve: "CVE-2026-0001",
      description: "Critical test vulnerability",
      remediationGuidance: "Patch",
      criticality: "Critical",
      severity: "Critical",
      exploitability: "Exploitable",
      detectedDate: "2026-01-01",
      capturedAt: "2026-01-01T00:00:00.000Z",
      source: "scanner"
    }
  ],
  systemContext: { systemId: "system-1", environmentType: "Production" },
  type: "server",
  operatingSystem: {
    family: "Windows Server",
    vendor: "Microsoft",
    majorVersion: 2022,
    version: "2022",
    supportStatus: "Supported",
    currentSupportedMajor: 2022,
    nMinus: 0
  },
  installedSoftware: [{ name: "Security Agent", version: "1.0.0", supportStatus: "Supported" }]
};

const workstationAsset: Asset = {
  id: "workstation-1",
  name: "PAY-WKS-01",
  hostname: "pay-wks-01.example.test",
  networkId: "network-1",
  securityDomain: "Secret",
  lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
  vulnerabilities: [],
  systemContext: { systemId: "system-1", environmentType: "Production" },
  type: "workstation",
  operatingSystem: null,
  installedSoftware: []
};

const findings: Finding[] = [
  {
    id: "finding-1",
    spiId: 3,
    priorityRank: 1,
    severity: "Critical Exposure",
    status: "open",
    complianceStatus: "Non-compliant",
    timestamp: "2026-01-01T00:00:00.000Z",
    scope: {
      networkId: "network-1",
      systemId: "system-1",
      environmentType: "Production",
      assetId: "server-1"
    },
    title: "Critical server finding",
    evidence: {
      assetIpAddress: "10.0.0.10",
      assetChangeAssignmentGroup: "Change Team",
      assetIncidentAssignmentGroup: "Incident Team"
    },
    recommendedAction: "Patch server"
  },
  {
    id: "finding-2",
    spiId: 5,
    priorityRank: 3,
    severity: "Major",
    status: "open",
    complianceStatus: "Non-compliant",
    timestamp: "2026-01-02T00:00:00.000Z",
    scope: {
      networkId: "network-1",
      systemId: "system-1",
      environmentType: "Production",
      assetId: "workstation-1"
    },
    title: "Workstation finding",
    evidence: {},
    recommendedAction: "Review workstation"
  },
  {
    id: "finding-3",
    spiId: 3,
    priorityRank: 2,
    severity: "High Risk",
    status: "closed",
    complianceStatus: "Non-compliant",
    timestamp: "2026-01-03T00:00:00.000Z",
    closedTimestamp: "2026-01-04T00:00:00.000Z",
    scope: {
      networkId: "network-1",
      systemId: "system-1",
      environmentType: "Production",
      assetId: "server-1"
    },
    title: "Closed server finding",
    evidence: {},
    recommendedAction: "No action"
  }
];

describe("CI Flow analyser helpers", () => {
  const ciNodes: TopologyCiNode[] = [
    {
      id: "asset-root",
      name: "Root Asset",
      hostname: "root.example.test",
      ipAddress: "10.0.0.10",
      type: "server",
      networkId: "network-1",
      securityDomain: "Secret",
      environmentType: "Production",
      systemId: "system-root",
      systemName: "Root System",
      systemModelled: true,
      cmdbRecordUrl: "https://cmdb.example.test/assets/asset-root",
      lifecycleEolStatus: "Supported",
      lifecycleWarrantyStatus: "InWarranty",
      operatingSystemSummary: "Microsoft Windows Server 2022 | Supported",
      installedSoftwareCount: 2,
      vulnerabilityCount: 3,
      criticalVulnerabilityCount: 1
    },
    {
      id: "asset-flow",
      name: "Flow Asset",
      hostname: "flow.example.test",
      ipAddress: "10.0.0.11",
      type: "workstation",
      networkId: "network-1",
      environmentType: "Production",
      systemId: "system-flow",
      systemName: "Flow System",
      systemModelled: true
    },
    {
      id: "asset-logical",
      name: "Logical Asset",
      hostname: "logical.example.test",
      ipAddress: "10.0.0.12",
      type: "network-device",
      networkId: "network-2",
      securityDomain: "Protected",
      environmentType: "UAT",
      systemId: "system-logical",
      systemName: "Logical System",
      systemModelled: false,
      cmdbRecordUrl: "https://cmdb.example.test/assets/asset-logical",
      networkOsSummary: "Cisco IOS XE 17 | Supported",
      patchStateSummary: "Latest: Yes",
      vulnerabilityCount: 5,
      criticalVulnerabilityCount: 2
    },
    {
      id: "asset-unmodelled-a",
      name: "Unmodelled A",
      hostname: "unmodelled-a.example.test",
      ipAddress: "10.0.0.13",
      type: "printer-device",
      networkId: "network-1",
      environmentType: null,
      systemId: null,
      systemName: null,
      systemModelled: false
    },
    {
      id: "asset-unmodelled-b",
      name: "Unmodelled B",
      hostname: "unmodelled-b.example.test",
      ipAddress: "10.0.0.14",
      type: "storage-device",
      networkId: "network-1",
      environmentType: null,
      systemId: "system-raw-unmodelled",
      systemName: "Raw Unmodelled System",
      systemModelled: false
    }
  ];
  const modelAssetIds = ["asset-root", "asset-flow", "asset-logical"];
  const ciDependencies: TopologyCiDependency[] = [
    {
      id: "flow-root-flow",
      sourceAssetId: "asset-root",
      targetAssetId: "asset-flow",
      dependencyType: "Flow Dependency"
    },
    {
      id: "logical-root-logical",
      sourceAssetId: "asset-root",
      targetAssetId: "asset-logical",
      dependencyType: "Logical Dependency"
    },
    {
      id: "flow-root-unmodelled-a",
      sourceAssetId: "asset-root",
      targetAssetId: "asset-unmodelled-a",
      dependencyType: "Flow Dependency"
    },
    {
      id: "flow-flow-unmodelled-b",
      sourceAssetId: "asset-flow",
      targetAssetId: "asset-unmodelled-b",
      dependencyType: "Flow Dependency"
    }
  ];
  const allAssetTypes = ["server", "workstation", "network-device", "storage-device", "printer-device", "other"] as const;
  const networkNameById = new Map([
    ["network-1", "Core Network"],
    ["network-2", "Edge Network"]
  ]);

  it("builds CI analyser rows from the same visible CI flow scope", () => {
    const scope = buildCiFlowAssetScope({
      rootAssetId: "asset-root",
      ciNodes,
      ciDependencies,
      includedAssetTypes: allAssetTypes,
      includedDependencyTypes: ["Flow Dependency", "Logical Dependency"],
      maxRelatedNodes: 110
    });
    const rows = buildCiAnalyserRowsFromScope({ rootAssetId: "asset-root", ciNodes, scope, networkNameById, modelAssetIds });

    expect(new Set(rows.map((row) => row.assetId))).toEqual(new Set(["asset-root"]));
    expect(rows.map((row) => row.relatedAssetId).sort()).toEqual(
      scope.visibleAssetIds.filter((assetId) => assetId !== "asset-root").sort()
    );
    expect(rows.map((row) => row.relatedSystemName)).toContain(NON_MODELLED_RELATED_SYSTEM_LABEL);
    expect(rows.find((row) => row.relatedAssetId === "asset-logical")).toMatchObject({
      relatedAssetType: "network-device",
      relatedAssetEnvironmentType: "UAT",
      relatedAssetNetworkId: "network-2",
      relatedAssetNetworkName: "Edge Network",
      relatedAssetHasIctSystem: true,
      relatedSystemId: "system-logical",
      relatedSystemName: "Logical System",
      relatedAssetSecurityDomain: "Protected",
      relatedAssetCmdbRecordUrl: "https://cmdb.example.test/assets/asset-logical",
      relatedAssetNetworkOsSummary: "Cisco IOS XE 17 | Supported",
      relatedAssetPatchStateSummary: "Latest: Yes",
      relatedAssetVulnerabilityCount: 5,
      relatedAssetCriticalVulnerabilityCount: 2
    });
    expect(rows.find((row) => row.relatedAssetId === "asset-unmodelled-a")).toMatchObject({
      relatedAssetType: "printer-device",
      relatedAssetEnvironmentType: null,
      relatedAssetHasIctSystem: false
    });
    expect(rows.find((row) => row.relatedAssetId === "asset-unmodelled-b")).toMatchObject({
      relatedAssetHasIctSystem: false,
      relatedSystemId: null,
      relatedSystemName: NON_MODELLED_RELATED_SYSTEM_LABEL
    });
  });

  it("uses relationship type toggles for CI flow scope and analyser rows", () => {
    const flowOnlyScope = buildCiFlowAssetScope({
      rootAssetId: "asset-root",
      ciNodes,
      ciDependencies,
      includedAssetTypes: allAssetTypes,
      includedDependencyTypes: ["Flow Dependency"],
      maxRelatedNodes: 110
    });
    const logicalOnlyScope = buildCiFlowAssetScope({
      rootAssetId: "asset-root",
      ciNodes,
      ciDependencies,
      includedAssetTypes: allAssetTypes,
      includedDependencyTypes: ["Logical Dependency"],
      maxRelatedNodes: 110
    });

    expect(
      buildCiAnalyserRowsFromScope({ rootAssetId: "asset-root", ciNodes, scope: flowOnlyScope, networkNameById, modelAssetIds })
        .map((row) => row.relatedAssetId)
        .sort()
    ).toEqual(["asset-flow", "asset-unmodelled-a", "asset-unmodelled-b"]);
    expect(
      buildCiAnalyserRowsFromScope({ rootAssetId: "asset-root", ciNodes, scope: logicalOnlyScope, networkNameById, modelAssetIds }).map(
        (row) => row.relatedAssetId
      )
    ).toEqual(["asset-logical"]);
  });

  it("collapses all unmodelled related assets under one related ICT system value", () => {
    const scope = buildCiFlowAssetScope({
      rootAssetId: "asset-root",
      ciNodes,
      ciDependencies,
      includedAssetTypes: allAssetTypes,
      includedDependencyTypes: ["Flow Dependency"],
      maxRelatedNodes: 110
    });
    const rows = buildCiAnalyserRowsFromScope({ rootAssetId: "asset-root", ciNodes, scope, networkNameById, modelAssetIds });
    const unmodelledSystemValues = rows
      .filter((row) => row.relatedSystemId === null)
      .map((row) => row.relatedSystemName);

    expect(unmodelledSystemValues).toHaveLength(2);
    expect(new Set(unmodelledSystemValues)).toEqual(new Set([NON_MODELLED_RELATED_SYSTEM_LABEL]));
  });

  it("filters CI analyser rows by related asset modelled state", () => {
    const scope = buildCiFlowAssetScope({
      rootAssetId: "asset-root",
      ciNodes,
      ciDependencies,
      includedAssetTypes: allAssetTypes,
      includedDependencyTypes: ["Flow Dependency", "Logical Dependency"],
      maxRelatedNodes: 110
    });
    const rows = buildCiAnalyserRowsFromScope({ rootAssetId: "asset-root", ciNodes, scope, networkNameById, modelAssetIds });

    expect(filterCiAnalyserRowsByModelledState(rows, ["modelled"]).map((row) => row.relatedAssetId)).toEqual([
      "asset-flow",
      "asset-logical"
    ]);
    expect(filterCiAnalyserRowsByModelledState(rows, ["non-modelled"]).map((row) => row.relatedAssetId)).toEqual([
      "asset-unmodelled-a",
      "asset-unmodelled-b"
    ]);
    expect(filterCiAnalyserRowsByModelledState(rows, ["modelled", "non-modelled"])).toHaveLength(rows.length);
    expect(filterCiAnalyserRowsByModelledState(rows, [])).toEqual([]);
  });
});

describe("Cyber COP ICT System Impact Analyser helpers", () => {
  it("builds compact rows from open server findings with the required axis fields", () => {
    const rows = buildCyberCopImpactAnalyserRows([serverAsset, workstationAsset], findings, systems);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      findingId: "finding-1",
      systemId: "system-1",
      systemName: "Payments",
      networkName: "network-1",
      hasIctSystem: true,
      environmentType: "Production",
      serverId: "server-1",
      serverName: "PAY-SRV-01",
      serverHostname: "pay-srv-01.example.test",
      securityDomain: "Secret",
      severity: "Critical Exposure",
      spiId: 3,
      spiLabel: "SPI 3",
      cmdbRecordUrl: "https://cmdb.example.test/assets/server-1",
      lifecycleEolStatus: "Supported",
      lifecycleWarrantyStatus: "InWarranty",
      operatingSystemSummary: "Microsoft Windows Server 2022 | Supported",
      installedSoftwareCount: 1,
      vulnerabilityCount: 1,
      criticalVulnerabilityCount: 1
    });
  });

  it("filters compact rows by local diagram filters and text search", () => {
    const rows = buildCyberCopImpactAnalyserRows([serverAsset, workstationAsset], findings, systems);

    expect(filterCyberCopImpactAnalyserRows(rows, { environment: "Production", spiId: 3 })).toHaveLength(1);
    expect(filterCyberCopImpactAnalyserRows(rows, { environment: ["Production"], securityDomain: ["Secret"] })).toHaveLength(1);
    expect(filterCyberCopImpactAnalyserRows(rows, { environment: "Production,UAT" })).toHaveLength(1);
    expect(filterCyberCopImpactAnalyserRows(rows, { findingCriticality: "High Risk" })).toHaveLength(0);
    expect(filterCyberCopImpactAnalyserRows(rows, { securityDomain: "Protected" })).toHaveLength(0);
    expect(filterCyberCopImpactAnalyserRows(rows, { search: "pay-srv" })).toHaveLength(1);
    expect(filterCyberCopImpactAnalyserRows(rows, { search: "missing" })).toHaveLength(0);
  });

  it("uses exact selected search filtering instead of substring matching", () => {
    const collisionRows: CyberCopImpactAnalyserRow[] = [
      {
        findingId: "finding-spi-1",
        systemId: "system-1",
        systemName: "Payments",
        networkName: "Core Network",
        hasIctSystem: true,
        environmentType: "Production",
        serverId: "server-1",
        serverName: "PAY-SRV-01",
        serverHostname: "pay-srv-01.example.test",
        securityDomain: "Secret",
        severity: "High Risk",
        spiId: 1,
        spiLabel: "SPI 1"
      },
      {
        findingId: "finding-spi-10",
        systemId: "system-1",
        systemName: "Payments",
        networkName: "Core Network",
        hasIctSystem: true,
        environmentType: "Production",
        serverId: "server-2",
        serverName: "PAY-SRV-10",
        serverHostname: "pay-srv-10.example.test",
        securityDomain: "Secret",
        severity: "High Risk",
        spiId: 10,
        spiLabel: "SPI 10"
      }
    ];

    expect(filterCyberCopImpactAnalyserRows(collisionRows, { search: "SPI 1" })).toHaveLength(2);
    expect(
      filterCyberCopImpactAnalyserRows(collisionRows, {
        search: "SPI 1",
        selectedSearchAxis: "spi",
        selectedSearchValue: "SPI 1"
      }).map((row) => row.spiLabel)
    ).toEqual(["SPI 1"]);
  });

  it("filters compact rows by scoped ICT system ids", () => {
    const scopedRows: CyberCopImpactAnalyserRow[] = [
      {
        findingId: "finding-system-1",
        systemId: "system-1",
        systemName: "Payments",
        networkName: "Core Network",
        hasIctSystem: true,
        environmentType: "Production",
        serverId: "server-1",
        serverName: "PAY-SRV-01",
        serverHostname: "pay-srv-01.example.test",
        securityDomain: "Secret",
        severity: "Critical Exposure",
        spiId: 3,
        spiLabel: "SPI 3"
      },
      {
        findingId: "finding-system-2",
        systemId: "system-2",
        systemName: "Logistics",
        networkName: "Core Network",
        hasIctSystem: true,
        environmentType: "Production",
        serverId: "server-2",
        serverName: "LOG-SRV-01",
        serverHostname: "log-srv-01.example.test",
        securityDomain: "Protected",
        severity: "High Risk",
        spiId: 4,
        spiLabel: "SPI 4"
      }
    ];

    expect(filterCyberCopImpactAnalyserRows(scopedRows, { systemIds: ["system-1"] }).map((row) => row.systemId)).toEqual([
      "system-1"
    ]);
    expect(filterCyberCopImpactAnalyserRows(scopedRows, { systemIds: [] })).toHaveLength(0);
    expect(
      filterCyberCopImpactAnalyserRows(scopedRows, {
        systemIds: ["system-2"],
        selectedSearchAxis: "spi",
        selectedSearchValue: "SPI 4"
      }).map((row) => row.findingId)
    ).toEqual(["finding-system-2"]);
  });

  it("builds network-scoped asset rows with standalone modelled assets", () => {
    const storageAsset = {
      ...workstationAsset,
      id: "storage-1",
      name: "PAY-STO-01",
      hostname: "pay-sto-01.example.test",
      type: "storage-device"
    } as Asset;
    const unassignedAsset = {
      ...workstationAsset,
      id: "unassigned-asset-1",
      name: "UNASSIGNED-ASSET-01",
      hostname: "unassigned-asset-01.example.test",
      type: "network-device",
      systemContext: undefined
    } as Asset;
    const unassignedAssetFinding: Finding = {
      id: "finding-4",
      spiId: 7,
      priorityRank: 4,
      severity: "High Risk",
      status: "open",
      complianceStatus: "Non-compliant",
      timestamp: "2026-01-05T00:00:00.000Z",
      scope: {
        networkId: "network-1",
        systemId: null,
        environmentType: null,
        assetId: "unassigned-asset-1"
      },
      title: "Unassigned network device finding",
      evidence: {},
      recommendedAction: "Review network device"
    };
    const networkFindings = [...findings, unassignedAssetFinding];
    const rows = buildNetworkImpactAnalyserRows({
      assets: [serverAsset, workstationAsset, storageAsset, unassignedAsset],
      findings: networkFindings,
      systems,
      modelAssetIds: ["server-1", "workstation-1", "storage-1", "unassigned-asset-1"],
      networkName: "Core Network"
    });

    expect(rows).toHaveLength(7);
    expect(rows.every((row) => row.networkName === "Core Network")).toBe(true);
    expect(rows.filter((row) => row.assetId === "storage-1")).toMatchObject([
      {
        findingId: null,
        assetType: "storage-device",
        hasOpenFinding: false,
        hasIctSystem: true,
        assetName: "PAY-STO-01"
      }
    ]);
    expect(rows.filter((row) => row.assetId === "workstation-1").map((row) => row.hasOpenFinding)).toEqual([false, true]);
    expect(rows.find((row) => row.assetId === "workstation-1" && row.findingId === "finding-2")).toMatchObject({
      assetType: "workstation",
      hasOpenFinding: true,
      hasIctSystem: true,
      environmentType: "Production",
      severity: "Major",
      spiId: 5,
      spiLabel: "SPI 5"
    });
    expect(rows.filter((row) => row.assetId === "unassigned-asset-1").map((row) => row.hasOpenFinding)).toEqual([false, true]);
    expect(rows.find((row) => row.assetId === "unassigned-asset-1" && row.findingId === null)).toMatchObject({
      findingId: null,
      assetType: "network-device",
      hasOpenFinding: false,
      hasIctSystem: false,
      systemId: null,
      assetName: "UNASSIGNED-ASSET-01"
    });
    expect(rows.find((row) => row.assetId === "unassigned-asset-1" && row.findingId === "finding-4")).toMatchObject({
      assetType: "network-device",
      hasOpenFinding: true,
      hasIctSystem: false,
      systemId: null,
      environmentType: null,
      severity: "High Risk",
      spiId: 7,
      spiLabel: "SPI 7"
    });
    expect(rows.filter((row) => row.assetId === "server-1").map((row) => row.hasOpenFinding)).toEqual([false, true]);
    expect(filterCyberCopImpactAnalyserRows(rows, { assetType: "storage-device" }).map((row) => row.assetId)).toEqual([
      "storage-1"
    ]);
    expect(
      filterCyberCopImpactAnalyserRows(rows, { assetType: "workstation", findingCriticality: "Major" }).map(
        (row) => row.findingId
      )
    ).toEqual(["finding-2"]);
    expect(
      filterCyberCopImpactAnalyserRows(rows, { assetType: "network-device", findingCriticality: "High Risk" }).map(
        (row) => row.findingId
      )
    ).toEqual(["finding-4"]);
    expect(
      filterCyberCopImpactAnalyserRows(rows, {
        selectedSearchAxis: "asset",
        selectedSearchValue: "server-1"
      }).map((row) => row.assetId)
    ).toEqual(["server-1", "server-1"]);
  });

  it("uses the full selected network asset scope for network impact analyser rows", () => {
    const directNetworkAsset = {
      ...workstationAsset,
      id: "printer-1",
      name: "PAY-PRN-01",
      hostname: "pay-prn-01.example.test",
      type: "printer-device",
      systemContext: undefined
    } as Asset;
    const modelAssetIds = buildNetworkImpactAnalyserModelAssetIds({
      network: {
        ...networks[0],
        assetIds: ["storage-1"]
      },
      assets: [serverAsset, workstationAsset, directNetworkAsset],
      topologyModelAssetIds: ["server-1"]
    });

    expect(modelAssetIds).toEqual(["printer-1", "server-1", "storage-1", "workstation-1"]);
  });

  it("deduplicates aggregate network scope and preserves each asset network name", () => {
    const edgeAsset = {
      ...workstationAsset,
      id: "edge-workstation-1",
      name: "EDGE-WS-01",
      hostname: "edge-ws-01.example.test",
      networkId: "network-2",
      systemContext: undefined
    } as Asset;
    const rows = buildNetworkImpactAnalyserRows({
      assets: [serverAsset, edgeAsset],
      findings,
      systems,
      modelAssetIds: ["server-1", "server-1", "edge-workstation-1"],
      networkNameById: new Map([
        ["network-1", "Core Network"],
        ["network-2", "Edge Network"]
      ])
    });

    expect(rows.filter((row) => row.assetId === "server-1" && row.findingId === null)).toHaveLength(1);
    expect(rows.filter((row) => row.assetId === "edge-workstation-1" && row.findingId === null)).toHaveLength(1);
    expect(rows.find((row) => row.assetId === "server-1")?.networkName).toBe("Core Network");
    expect(rows.find((row) => row.assetId === "edge-workstation-1")?.networkName).toBe("Edge Network");
  });

  it("builds ICT system-scoped asset rows with the selected system as the root", () => {
    const systemWithModel = {
      ...systems[0],
      environments: [
        {
          id: "env-production",
          name: "Production",
          type: "Production" as const,
          assetIds: ["storage-1", "printer-1"]
        }
      ]
    };
    const storageAsset = {
      ...workstationAsset,
      id: "storage-1",
      name: "PAY-STO-01",
      hostname: "pay-sto-01.example.test",
      type: "storage-device"
    } as Asset;
    const networkDeviceAsset = {
      ...workstationAsset,
      id: "network-device-1",
      name: "PAY-NET-01",
      hostname: "pay-net-01.example.test",
      type: "network-device"
    } as Asset;
    const otherAsset = {
      ...workstationAsset,
      id: "other-1",
      name: "PAY-OTH-01",
      hostname: "pay-oth-01.example.test",
      type: "other"
    } as Asset;
    const printerAssetWithoutContext = {
      ...workstationAsset,
      id: "printer-1",
      name: "PAY-PRN-01",
      hostname: "pay-prn-01.example.test",
      type: "printer-device",
      systemContext: undefined
    } as Asset;
    const printerFinding: Finding = {
      id: "finding-printer",
      spiId: 8,
      priorityRank: 4,
      severity: "High Risk",
      status: "open",
      complianceStatus: "Non-compliant",
      timestamp: "2026-01-06T00:00:00.000Z",
      scope: {
        networkId: "network-1",
        systemId: null,
        environmentType: null,
        assetId: "printer-1"
      },
      title: "Printer finding",
      evidence: {},
      recommendedAction: "Review printer"
    };
    const scopedAssets = [
      serverAsset,
      workstationAsset,
      storageAsset,
      networkDeviceAsset,
      printerAssetWithoutContext,
      otherAsset
    ];
    const modelAssetIds = buildSystemImpactAnalyserModelAssetIds({
      system: systemWithModel,
      assets: scopedAssets,
      topologyModelAssetIds: ["network-device-1", "other-1"]
    });
    const rows = buildSystemImpactAnalyserRows({
      assets: scopedAssets,
      findings: [...findings, printerFinding],
      systems: [systemWithModel],
      system: systemWithModel,
      modelAssetIds,
      networkNameById: new Map([["network-1", "Core Network"]])
    });

    expect(modelAssetIds).toEqual([
      "network-device-1",
      "other-1",
      "printer-1",
      "server-1",
      "storage-1",
      "workstation-1"
    ]);
    expect(new Set(rows.map((row) => row.assetType))).toEqual(
      new Set(["server", "workstation", "storage-device", "network-device", "printer-device", "other"])
    );
    expect(rows.every((row) => row.systemId === "system-1" && row.systemName === "Payments" && row.hasIctSystem)).toBe(true);
    expect(rows.find((row) => row.assetId === "storage-1" && row.findingId === null)).toMatchObject({
      assetType: "storage-device",
      hasOpenFinding: false,
      environmentType: "Production"
    });
    expect(rows.find((row) => row.assetId === "printer-1" && row.findingId === "finding-printer")).toMatchObject({
      assetType: "printer-device",
      hasOpenFinding: true,
      hasIctSystem: true,
      systemId: "system-1",
      environmentType: "Production",
      networkName: "Core Network",
      severity: "High Risk",
      spiId: 8,
      spiLabel: "SPI 8"
    });
    expect(
      filterCyberCopImpactAnalyserRows(rows, { assetType: "printer-device", findingCriticality: "High Risk" }).map(
        (row) => row.findingId
      )
    ).toEqual(["finding-printer"]);
  });

  it("builds drill-through finding rows with source finding ids and affected CI fields", () => {
    const rows = buildCyberCopImpactAnalyserFindingRows({
      findings,
      scopedAssets: [serverAsset, workstationAsset],
      allAssets: [serverAsset, workstationAsset],
      systems,
      networks
    });

    expect(rows.map((row) => row.sourceFindingId)).toContain("finding-1");
    expect(rows.find((row) => row.sourceFindingId === "finding-1")).toMatchObject({
      assetName: "PAY-SRV-01",
      assetIpAddress: "10.0.0.10",
      assetType: "Server",
      owner: "System Owner",
      systemId: "system-1",
      networkId: "network-1",
      environmentType: "Production"
    });
  });
});

describe("Cyber COP ICT System Impact Analyser source wiring", () => {
  it("promotes the scalable analyser to a main Cyber COP tab after the ICT System SPI heatmap", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const page = readRepoFile("app/cyber-cop/page.tsx");
    const dashboardTabsStart = dashboard.indexOf("const cyberCopTabs");
    const dashboardTabsEnd = dashboard.indexOf("];", dashboardTabsStart);
    const dashboardTabs = dashboard.slice(dashboardTabsStart, dashboardTabsEnd);
    const impactTabsStart = dashboard.indexOf("const impactChartTabs");
    const impactTabsEnd = dashboard.indexOf("];", impactTabsStart);
    const impactTabs = dashboard.slice(impactTabsStart, impactTabsEnd);

    expect(dashboard).toContain('{ id: "ict-system-impact-analyser", label: "ICT System Impact Analyser" }');
    expect(dashboardTabs.indexOf('{ id: "ict-system-impact-analyser", label: "ICT System Impact Analyser" }')).toBeGreaterThan(
      dashboardTabs.indexOf('{ id: "systems-spi-heatmap", label: "ICT System - SPI Heatmap" }')
    );
    expect(impactTabs).not.toContain("ICT System Impact Analyser");
    expect(dashboard).toContain('activeTab === "ict-system-impact-analyser"');
    expect(dashboard).toContain('id="cyber-cop-tabpanel-ict-system-impact-analyser"');
    expect(dashboard).toContain("<IctSystemImpactAnalyser2Chart");
    expect(dashboard).toContain("embedded");
    expect(dashboard).toContain("systemScopeIds={appliedSystemIds}");
    expect(dashboard).toContain("spiDefinitions={spiDefinitions}");
    expect(dashboard).toContain('selectionMode="multi"');
    expect(dashboard).toContain("selectedItemIds={selectedIctSystemIds}");
    expect(dashboard).toContain("onVisibleItemIdsChange={(itemIds) =>");
    expect(dashboard).toContain("const activeImpactSystemRows = useMemo");
    expect(dashboard).toContain("systemOptions={activeImpactSystemRows}");
    expect(dashboard).not.toContain('"network-diagram"');
    expect(dashboard).not.toContain("NetworkDiagramChart");
    expect(dashboard).not.toContain("CyberCopNetworkDiagramRow");
    expect(dashboard).not.toContain("impactNetworkDiagramRows");
    expect(page).not.toContain("buildNetworkDiagramRows");
    expect(page).not.toContain("impactNetworkDiagramRows");
  });

  it("combines business and mission impact scopes into one tabbed left panel", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");

    expect(dashboard).toContain('type ImpactScopeTabId = "business-services" | "mission-capabilities";');
    expect(dashboard).toContain(
      'const [activeImpactScopeTab, setActiveImpactScopeTab] = useState<ImpactScopeTabId>("business-services");'
    );
    expect(dashboard).toContain('aria-label="Business and mission impact scope tabs"');
    expect(dashboard).toContain('id={`cyber-cop-impact-scope-tab-${tab.id}`}');
    expect(dashboard).toContain('id="cyber-cop-impact-scope-panel-business-services"');
    expect(dashboard).toContain('id="cyber-cop-impact-scope-panel-mission-capabilities"');
    expect(dashboard).toContain('title="Business Services"');
    expect(dashboard).toContain('title="Mission Capabilities"');
    expect(dashboard).toContain("embedded\n                        hideHeader");
    expect(dashboard).toContain(
      "xl:grid-rows-[minmax(17rem,0.85fr)_minmax(28rem,1.85fr)]"
    );
    expect(dashboard).toContain('className="min-h-[28rem] xl:min-h-0"');
    expect(dashboard).not.toContain('title="Mission Capabilities Impact"');

    expect(dashboard).toContain('if (activeImpactScopeTab === "business-services" && selectedBusinessServiceId)');
    expect(dashboard).toContain('if (activeImpactScopeTab === "mission-capabilities" && selectedMissionCapabilityId)');
    expect(dashboard).toContain('if (activeImpactScopeTab === "business-services" && businessSearchScope.active)');
    expect(dashboard).toContain('if (activeImpactScopeTab === "mission-capabilities" && missionSearchScope.active)');
    expect(dashboard).toMatch(
      /useEffect\(\(\) => \{\s+setSelectedIctSystemIds\(\[\]\);\s+setIctSystemVisibleScope\(\{ active: false, itemIds: \[\] \}\);\s+\}, \[activeImpactScopeTab\]\);/
    );
    expect(dashboard).toContain("systemOptions={activeImpactSystemRows}");
  });

  it("gates the Cyber COP analyser behind an explicit ICT system selection and Run action", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");

    expect(dashboard).toContain("function IctSystemImpactAnalyserRunPanel");
    expect(dashboard).toContain('const [selectedSystemIds, setSelectedSystemIds] = useState<string[]>([])');
    expect(dashboard).toContain('const [appliedSystemIds, setAppliedSystemIds] = useState<string[]>([])');
    expect(dashboard).toContain('aria-multiselectable="true"');
    expect(dashboard).toContain('disabled={!selectedSystemIds.length || isLoading}');
    expect(dashboard).toContain('setAppliedSystemIds([...selectedSystemIds])');
    expect(dashboard).toContain('setAppliedSystemIds([])');
    expect(dashboard).toContain('onLoadStateChange={handleLoadStateChange}');
    expect(dashboard).toContain("Select one or more ICT systems, then select Run to load the analyser.");
    expect(dashboard).toContain("key={`cyber-cop-impact-analyser-run-${runRequestId}`}");
  });

  it("adds a run-gated Network Impact Analyser immediately after the ICT System analyser", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const page = readRepoFile("app/cyber-cop/page.tsx");
    const dataRoute = readRepoFile("app/api/cyber-cop/impact-analyser-2/route.ts");
    const findingsRoute = readRepoFile("app/api/cyber-cop/impact-analyser-2/findings/route.ts");
    const component = readRepoFile("components/ict-system-impact-analyser-2.tsx");
    const dashboardTabsStart = dashboard.indexOf("const cyberCopTabs");
    const dashboardTabsEnd = dashboard.indexOf("];", dashboardTabsStart);
    const dashboardTabs = dashboard.slice(dashboardTabsStart, dashboardTabsEnd);
    const ictTab = '{ id: "ict-system-impact-analyser", label: "ICT System Impact Analyser" }';
    const networkTab = '{ id: "network-impact-analyser", label: "Network Impact Analyser" }';
    const actionTab = '{ id: "action", label: "Action" }';

    expect(dashboardTabs.indexOf(networkTab)).toBeGreaterThan(dashboardTabs.indexOf(ictTab));
    expect(dashboardTabs.indexOf(actionTab)).toBeGreaterThan(dashboardTabs.indexOf(networkTab));
    expect(dashboardTabs).toContain(`${ictTab},
  ${networkTab},
  ${actionTab}`);
    expect(dashboard).toContain("xl:grid-cols-7");
    expect(dashboard).toContain('activeTab === "network-impact-analyser"');
    expect(dashboard).toContain('id="cyber-cop-tabpanel-network-impact-analyser"');
    expect(dashboard).toContain("function NetworkImpactAnalyserRunPanel");
    expect(dashboard).toContain('const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([])');
    expect(dashboard).toContain('const [appliedNetworkIds, setAppliedNetworkIds] = useState<string[]>([])');
    expect(dashboard).toContain('aria-label="Select networks for the Network Impact Analyser"');
    expect(dashboard).toContain('role="group"');
    expect(dashboard).toContain("event.currentTarget.contains(nextTarget)");
    expect(dashboard).toContain('disabled={!selectedNetworkIds.length || isLoading}');
    expect(dashboard).toContain("setAppliedNetworkIds([...selectedNetworkIds])");
    expect(dashboard).toContain("setAppliedNetworkIds([])");
    expect(dashboard).toContain("networkScopeIds={appliedNetworkIds}");
    expect(dashboard).toContain("dataDate={snapshotDate}");
    expect(dashboard).toContain('analyserName="Network Impact Analyser"');
    expect(dashboard).toContain('assetAxisLabel="Assets"');
    expect(dashboard).toContain('assetSearchCategory="Assets"');
    expect(dashboard).toContain("includeNetworkAxis");
    expect(dashboard).toContain("showAssetTypeFilter");
    expect(dashboard).toContain("Select one or more networks, then select Run to load the analyser.");
    expect(dashboard).toContain("key={`cyber-cop-network-impact-analyser-run-${runRequestId}`}");
    expect(page).toContain("networkOptions={networks.map(({ id, name }) => ({ id, name }))}");

    expect(component).toContain("networkScopeIds?: string[]");
    expect(component).toContain("dataDate?: string");
    expect(component).toContain("...(dataDate ? { dataDate } : {})");
    expect(component).toContain("const networkScopeKey = hasNetworkScope");
    expect(component).toContain("diagramNetworkIds: networkScopeKey");
    expect(dataRoute).toContain('request.nextUrl.searchParams.get("diagramNetworkIds")');
    expect(dataRoute).toContain("if (diagramNetworkIdsParam !== null)");
    expect(dataRoute).toContain("const selectedNetworks = networks.filter");
    expect(dataRoute).toContain("applyAssetFilters(dataset.assets, dataset.ictSystems, filters)");
    expect(dataRoute).toContain("networkScopedAssetIds.has(assetId)");
    expect(dataRoute).toContain("buildNetworkTopologyData");
    expect(dataRoute).toContain("buildNetworkImpactAnalyserModelAssetIds");
    expect(dataRoute).toContain("modelAssetIds.add(assetId)");
    expect(dataRoute).toContain("networkNameById");
    expect(dataRoute).toContain("buildNetworkImpactAnalyserRows");
    expect(findingsRoute).toContain('request.nextUrl.searchParams.get("diagramNetworkIds")');
    expect(findingsRoute).toContain("scopedAssets = networkScopedAssets.filter");
    expect(findingsRoute).toContain("buildNetworkImpactAnalyserRows");
    expect(findingsRoute).toContain(
      "systemIds: isNetworkScope || diagramSystemIdsParam === null ? null : readCsvParam(diagramSystemIdsParam)"
    );
    expect(findingsRoute).toContain(
      "totalCount: isNetworkScope ? selectedRows.filter((row) => row.findingId).length : selectedRows.length"
    );
  });


  it("uses lazy dynamic API routes for data and selected SPI findings", () => {
    const dataRoute = readRepoFile("app/api/cyber-cop/impact-analyser-2/route.ts");
    const findingsRoute = readRepoFile("app/api/cyber-cop/impact-analyser-2/findings/route.ts");
    const component = readRepoFile("components/ict-system-impact-analyser-2.tsx");

    expect(dataRoute).toContain('export const dynamic = "force-dynamic"');
    expect(dataRoute).toContain("buildCyberCopImpactAnalyserRows");
    expect(dataRoute).toContain('request.nextUrl.searchParams.get("diagramSystemIds")');
    expect(dataRoute).toContain("diagramSystemIds.has(systemId)");
    expect(dataRoute).toContain("buildCyberCopImpactAnalyserRows(analyserAssets");
    expect(findingsRoute).toContain('export const dynamic = "force-dynamic"');
    expect(findingsRoute).toContain("filterCyberCopImpactAnalyserRows");
    expect(findingsRoute).toContain('request.nextUrl.searchParams.get("diagramSearchAxis")');
    expect(findingsRoute).toContain('request.nextUrl.searchParams.get("diagramSearchValue")');
    expect(findingsRoute).toContain('request.nextUrl.searchParams.get("diagramSystemIds")');
    expect(findingsRoute).toContain(
      "systemIds: isNetworkScope || diagramSystemIdsParam === null ? null : readCsvParam(diagramSystemIdsParam)"
    );
    expect(component).toContain('dataPath = "/api/cyber-cop/impact-analyser-2"');
    expect(component).toContain('findingsPath = "/api/cyber-cop/impact-analyser-2/findings"');
    expect(component).toContain("buildApiUrl(dataPath, {");
    expect(component).toContain("diagramSystemIds: systemScopeKey");
    expect(component).toContain("buildApiUrl(findingsPath");
    expect(component).toContain("signal: abortController.signal");
    expect(component).toContain("abortController.abort()");
    expect(component).toContain("onLoadStateChange?.(reportedLoadState)");
  });

  it("wires detailed topology views to network and ICT system scoped analysers", () => {
    const detailedTopology = readRepoFile("components/detailed-topology-view.tsx");
    const systemTabs = readRepoFile("components/system-detail-tabs.tsx");
    const topologyModel = readRepoFile("lib/network-topology.ts");
    const dataRoute = readRepoFile("app/api/networks/[networkId]/impact-analyser/route.ts");
    const findingsRoute = readRepoFile("app/api/networks/[networkId]/impact-analyser/findings/route.ts");
    const systemDataRoute = readRepoFile("app/api/systems/[systemId]/impact-analyser/route.ts");
    const systemFindingsRoute = readRepoFile("app/api/systems/[systemId]/impact-analyser/findings/route.ts");
    const ciFlowAnalyser = readRepoFile("lib/ci-flow-analyser.ts");

    expect(dataRoute).toContain('export const dynamic = "force-dynamic"');
    expect(dataRoute).toContain("buildNetworkTopologyData");
    expect(dataRoute).toContain("buildNetworkImpactAnalyserModelAssetIds");
    expect(dataRoute).toContain("topologyModelAssetIds: topologyData.modelAssetIds");
    expect(dataRoute).toContain("networkName: network.name");
    expect(dataRoute).toContain("buildNetworkImpactAnalyserRows");
    expect(findingsRoute).toContain('export const dynamic = "force-dynamic"');
    expect(findingsRoute).toContain('request.nextUrl.searchParams.get("diagramAssetType")');
    expect(findingsRoute).toContain("modelAssetIds");
    expect(systemDataRoute).toContain('export const dynamic = "force-dynamic"');
    expect(systemDataRoute).toContain("buildSystemTopologyData");
    expect(systemDataRoute).toContain("buildSystemImpactAnalyserModelAssetIds");
    expect(systemDataRoute).toContain("buildSystemImpactAnalyserRows");
    expect(systemFindingsRoute).toContain('export const dynamic = "force-dynamic"');
    expect(systemFindingsRoute).toContain('request.nextUrl.searchParams.get("diagramAssetType")');
    expect(systemFindingsRoute).toContain("buildSystemImpactAnalyserRows");
    expect(systemFindingsRoute).toContain("systemIds: diagramSystemIdsParam === null ? null : readCsvParam(diagramSystemIdsParam)");
    expect(topologyModel).toContain('rootScope: { type: "network", id: networkId, name: networkName }');
    expect(topologyModel).toContain('rootScope: { type: "ict-system", id: system.id, name: system.name }');
    expect(systemTabs).toContain("ICT System Impact Analyser");
    expect(detailedTopology).toContain("IctSystemImpactAnalyser2Chart");
    expect(detailedTopology).toContain('const isSystemImpactAnalyser = topologyRootScope.type === "ict-system"');
    expect(detailedTopology).toContain('/api/systems/${impactAnalyserRootId}/impact-analyser');
    expect(detailedTopology).toContain('/api/networks/${impactAnalyserRootId}/impact-analyser');
    expect(detailedTopology).toContain('const impactAnalyserTitle = isSystemImpactAnalyser ? "ICT System Impact Analyser" : "Network Impact Analyser"');
    expect(detailedTopology).toContain("{...(!isSystemImpactAnalyser ? { includeNetworkAxis: true } : {})}");
    expect(detailedTopology).toContain("assetAxisLabel=\"Assets\"");
    expect(detailedTopology).toContain("assetSearchCategory=\"Assets\"");
    expect(detailedTopology).toContain("showAssetTypeFilter");
    expect(detailedTopology).toContain("onAssetFocus={openCiFlowFocusForAssetId}");
    expect(detailedTopology).toContain("const assetFocusEligibleAssetIds = useMemo");
    expect(detailedTopology).toContain("for (const dependency of data.ciDependencies)");
    expect(detailedTopology).toContain("eligibleAssetIds.add(dependency.sourceAssetId)");
    expect(detailedTopology).toContain("eligibleAssetIds.add(dependency.targetAssetId)");
    expect(detailedTopology).toContain("assetFocusEligibleAssetIds={assetFocusEligibleAssetIds}");
    expect(detailedTopology).toContain("const openCiFlowFocusForAsset = useCallback");
    expect(detailedTopology).toContain("const CI_ASSET_TYPES: CiAssetType[] = [...ASSET_TYPES]");
    expect(detailedTopology).toContain('item.entityType === "ci" && item.ciAssetId === assetId');
    expect(detailedTopology).toContain("if (!flowCiNodeByAssetId.has(assetId))");
    expect(detailedTopology).toContain("openCiFlowFocusForAsset(assetId, fallbackOriginCenter)");
    expect(detailedTopology).toContain("const fallbackOriginCenter = rootNode");
    expect(detailedTopology).toContain('title="CI Analyser"');
    expect(detailedTopology).toContain('diagramMode="ci"');
    expect(detailedTopology).toContain("includeNetworkAxis={!isSystemImpactAnalyser}\n                      showAssetTypeFilter");
    expect(detailedTopology).toContain("CI_ANALYSER_MODELLED_FILTER_OPTIONS");
    expect(detailedTopology).toContain('label: "Show Modelled"');
    expect(detailedTopology).toContain('label: "Show Non-Modelled"');
    expect(detailedTopology).toContain("ciAnalyserIncludedModelledStates");
    expect(detailedTopology).toContain("filterCiAnalyserRowsByModelledState(unfilteredCiAnalyserRows, ciAnalyserIncludedModelledStates)");
    expect(detailedTopology).toContain("toggleCiAnalyserIncludedModelledState");
    expect(detailedTopology).toContain("modelAssetIds: data.modelAssetIds");
    expect(ciFlowAnalyser).toContain("const modelAssetIdSet = new Set(modelAssetIds)");
    expect(ciFlowAnalyser).toContain("const isModelledCi = (node: TopologyCiNode) => modelAssetIdSet.has(node.id) || node.systemModelled");
    expect(ciFlowAnalyser).toContain("const relatedIsModelled = isModelledCi(relatedNode)");
    expect(ciFlowAnalyser).toContain("const relatedSystemId = relatedIsModelled ? relatedNode.systemId : null");
    expect(detailedTopology).toContain("const ciRelatedAssetTypeSummary = useMemo");
    expect(detailedTopology).toContain("new Map<AssetType, number>");
    expect(detailedTopology).toContain("row.relatedAssetType");
    expect(detailedTopology).toContain("assetTypeLabel(assetType)");
    expect(detailedTopology).toContain("ciRelatedAssetTypeSummaryTotal");
    expect(ciFlowAnalyser).toContain("relatedAssetHasIctSystem === true");
    expect(detailedTopology).toContain("CI_FLOW_RELATIONSHIP_TYPES.map");
    expect(detailedTopology).toContain("includedAssetTypes: CI_ASSET_TYPES");
    expect(detailedTopology).toContain("const handleCiAnalyserSelectedNodeChange = useCallback");
    expect(detailedTopology).toContain('node.axisKey !== "asset" && node.axisKey !== "relatedAsset"');
    expect(detailedTopology).toContain("selectedCiAnalyserRelatedAssetId");
    expect(detailedTopology).toContain("ciAnalyserRows.some((row) => row.relatedAssetId === node.value)");
    expect(detailedTopology).not.toContain("ciFlowNodeById.has");
    expect(detailedTopology).toContain("onSelectedNodeChange={handleCiAnalyserSelectedNodeChange}");
    expect(detailedTopology).toContain("extraControls={");
    expect(detailedTopology).toContain("ci-focus-analyser-relationship-filter");
    expect(detailedTopology).toContain("ci-focus-analyser-modelled-filter");
    expect(detailedTopology).toContain("grid-cols-[minmax(15rem,0.55fr)_minmax(0,1.8fr)]");
    expect(detailedTopology).toContain('id="ci-focus-compliance-mode"');
    expect(detailedTopology).toContain("interface CiFocusTileModel");
    expect(detailedTopology).toContain("interface CiFocusContextRow");
    expect(detailedTopology).toContain(">Tile View</h4>");
    expect(detailedTopology).toContain("data-ci-focus-tile-view-rows");
    expect(detailedTopology).toContain("data-ci-focus-context-row-stack");
    expect(detailedTopology).toContain("data-ci-focus-context-rows");
    expect(detailedTopology).toContain("data-ci-focus-related-asset-type-summary");
    expect(detailedTopology).toContain("data-ci-focus-related-asset-type-summary-items");
    expect(detailedTopology).toContain("data-ci-focus-related-asset-type-summary-table");
    expect(detailedTopology).toContain("Related Assets By Type");
    expect(detailedTopology).toContain("Current CI Analyser scope");
    expect(detailedTopology).toContain("Asset Type");
    expect(detailedTopology).toContain("Count");
    expect(detailedTopology).toContain("No related assets match the current filters.");
    expect(detailedTopology).toContain('data-ci-focus-row={row.label}');
    expect(detailedTopology).toContain('label: "Network"');
    expect(detailedTopology).toContain('label: "ICT System"');
    expect(detailedTopology).toContain('label: "Environment"');
    expect(detailedTopology).toContain('label: "Asset"');
    expect(detailedTopology).toContain('label: "Related Asset"');
    expect(detailedTopology).toContain('className="-rotate-90 whitespace-nowrap');
    expect(detailedTopology).toContain("data-ci-focus-vertical-connector");
    expect(detailedTopology).toContain("className=\"pointer-events-none absolute bottom-8 top-8 z-0 w-px bg-white/75\"");
    expect(detailedTopology).toContain('style={{ left: "calc(2.5rem + (100% - 2.5rem) / 2)" }}');
    expect(detailedTopology).toContain("relative flex min-h-0 flex-1 flex-col gap-5");
    expect(detailedTopology).toContain("relative z-10 flex shrink-0 flex-col gap-5");
    expect(detailedTopology).toContain("selectedRelatedCiFlowFocusNode");
    expect(detailedTopology).toContain("selectedCiAnalyserRelatedRow");
    expect(detailedTopology).toContain("flowCiNodeByAssetId.get(selectedCiAnalyserRelatedRow.relatedAssetId");
    expect(detailedTopology).toContain("Asset Type: ${assetTypeLabel(selectedRelatedCiFlowFocusNode.type)}");
    expect(detailedTopology).toContain('"ci-focus-context-related-asset-placeholder"');
    expect(detailedTopology).toContain('"No Related Asset Selected"');
    expect(detailedTopology).not.toContain('"Select a related asset in the CI Analyser"');
    expect(detailedTopology).toContain("placeholder: true");
    expect(detailedTopology).toContain("if (tile.placeholder)");
    expect(detailedTopology).toContain("data-ci-focus-placeholder-tile");
    expect(detailedTopology).toContain('className={`${tileClassName} relative overflow-hidden`}');
    expect(detailedTopology).toContain('aria-hidden="true" className="invisible min-w-0 space-y-0.5"');
    expect(detailedTopology).toContain("absolute inset-0 flex items-center justify-center");
    expect(detailedTopology).toContain('className="flex min-h-[4.5rem] min-w-0 gap-2"');
    expect(detailedTopology).toContain('<article data-ci-focus-tile={tile.id} className={tileClassName} style={tileStyle}>');
    expect(detailedTopology).toContain('{tile.placeholder ? "border-dashed opacity-85" : ""}');
    expect(detailedTopology).toContain("{tile.name}</p>");
    expect(detailedTopology).toContain('setCiAnalyserSelectedAssetAxis("asset")');
    expect(detailedTopology).toContain('setCiAnalyserSelectedAssetAxis("relatedAsset")');
    expect(detailedTopology).toContain("setCiAnalyserSelectedAssetAxis(null)");
    expect(detailedTopology).not.toContain('ciAnalyserSelectedAssetAxis === "relatedAsset" && ciFocusRelatedAssetTile');
    expect(detailedTopology).toContain('id: "ci-focus-context-related-asset"');
    expect(detailedTopology).toContain("bg-slate-950/55 p-3");
    expect(detailedTopology).toContain("renderCiFocusTile(row.tile)");
    expect(detailedTopology).not.toContain('label: "Selected Asset"');
    expect(detailedTopology).not.toContain("data-ci-focus-selected-pair");
    expect(detailedTopology).not.toContain("data-ci-focus-selected-rows");
    expect(detailedTopology).not.toContain("data-ci-focus-selected-pair-tile={row.label}");
    expect(detailedTopology).not.toContain('"Select a Related Asset"');
    expect(detailedTopology).not.toContain('"No related asset selected"');
    expect(detailedTopology).not.toContain("const ciAnalyserExternalSelectedSearchOption");
    expect(detailedTopology).not.toContain("externalSelectedSearchOption={ciAnalyserExternalSelectedSearchOption}");
    expect(detailedTopology).not.toContain("Linked Models");
    expect(detailedTopology).not.toContain("ciFlowIncludedAssetTypes");
    expect(detailedTopology).not.toContain("toggleCiFlowIncludedAssetType");
    expect(detailedTopology).not.toContain("ciFlowHover");
    expect(detailedTopology).not.toContain("ciFlowHovered");
    expect(detailedTopology).not.toContain("Export Non-Modelled CIs");
    expect(detailedTopology).not.toContain("presentedNonModelledCiRows");
    expect(detailedTopology).not.toContain("exportPresentedNonModelledCis");

    const ciFocusTileSection = detailedTopology.slice(
      detailedTopology.indexOf(">Tile View</h4>"),
      detailedTopology.indexOf('title="CI Analyser"')
    );
    expect(ciFocusTileSection).toContain("Compliance");
    expect(ciFocusTileSection).toContain("Tile View");
    expect(ciFocusTileSection).toContain("data-ci-focus-tile-view-rows");
    expect(ciFocusTileSection).toContain("data-ci-focus-vertical-connector");
    expect(ciFocusTileSection).toContain("data-ci-focus-context-row-stack");
    expect(ciFocusTileSection).toContain("data-ci-focus-context-rows");
    expect(ciFocusTileSection).toContain("data-ci-focus-related-asset-type-summary");
    expect(ciFocusTileSection).toContain("data-ci-focus-related-asset-type-summary-table");
    expect(ciFocusTileSection).toContain("Related Assets By Type");
    expect(ciFocusTileSection).toContain("gap-5");
    expect(ciFocusTileSection).not.toContain("Selected Asset");
    expect(ciFocusTileSection).not.toContain("data-ci-focus-selected-pair");
    expect(ciFocusTileSection).not.toContain("Relationships");
    expect(ciFocusTileSection).not.toContain("CI Types");
    expect(ciFocusTileSection).not.toContain("Tile Search");
    expect(ciFocusTileSection).not.toContain("Green compliant");
    expect(ciFocusTileSection).not.toContain("In-model CI");
    expect(ciFocusTileSection).not.toContain("Out-of-model CI");
    expect(ciFocusTileSection).not.toContain("Orbit + Pan");
    expect(ciFocusTileSection).not.toContain("Reset View");
    expect(ciFocusTileSection).not.toContain("Drag: rotate");
    expect(ciFocusTileSection).not.toContain("Root CI pinned");
    expect(ciFocusTileSection).not.toContain("Zoom {detailedZoomPercent}%");
    expect(ciFocusTileSection).not.toContain("detailedViewportRef");
    expect(ciFocusTileSection).not.toContain("detailedCanvasRef");
    expect(ciFocusTileSection).not.toContain('absolute bottom-4 left-4');
    expect(ciFocusTileSection).not.toContain(">Close</button>");
    const relatedAssetSummarySection = ciFocusTileSection.slice(
      ciFocusTileSection.indexOf("data-ci-focus-related-asset-type-summary"),
      ciFocusTileSection.indexOf("</section>", ciFocusTileSection.indexOf("data-ci-focus-related-asset-type-summary"))
    );
    expect(relatedAssetSummarySection).toContain("<table");
    expect(relatedAssetSummarySection).toContain("border-collapse");
    expect(relatedAssetSummarySection).toContain("overflow-y-auto");
    expect(relatedAssetSummarySection).not.toContain("grid gap-2");
    expect(relatedAssetSummarySection).not.toContain("rounded-lg border border-slate-700/80");
    expect(relatedAssetSummarySection).not.toContain("rounded-full border border-sky-300/25");

    const ciAnalyserComponentStart = detailedTopology.indexOf('title="CI Analyser"');
    const ciAnalyserSection = detailedTopology.slice(
      ciAnalyserComponentStart,
      detailedTopology.indexOf("/>", ciAnalyserComponentStart)
    );
    expect(ciAnalyserSection).toContain("Relationships");
    expect(detailedTopology).toContain("Modelled");
    expect(ciAnalyserSection).toContain("showSelectedTileText");
    expect(ciAnalyserSection).toContain("CI_FLOW_RELATIONSHIP_TYPES.map");
    expect(ciAnalyserSection).not.toContain("Related Assets By Type");
    expect(ciAnalyserSection).not.toContain("Compliance");

    const riskImpactAnalyserSectionStart = detailedTopology.indexOf("title={impactAnalyserTitle}");
    const riskImpactAnalyserSection = detailedTopology.slice(
      riskImpactAnalyserSectionStart,
      detailedTopology.indexOf("/>", riskImpactAnalyserSectionStart)
    );
    expect(riskImpactAnalyserSection).not.toContain("showSelectedTileText");
    expect(riskImpactAnalyserSection).toContain("assetFocusEligibleAssetIds={assetFocusEligibleAssetIds}");
  });

  it("keeps V2 worker-side filtering and Canvas/WebGL rendering markers", () => {
    const component = readRepoFile("components/ict-system-impact-analyser-2.tsx");
    const cmdbDrawer = readRepoFile("components/cmdb-drill-through.tsx");
    const worker = readRepoFile("components/ict-system-impact-analyser-2-worker.ts");

    expect(component).toContain("new Worker(new URL");
    expect(component).toContain("new THREE.WebGLRenderer");
    expect(component).toContain("const cameraScrollTop = Math.min(scrollTop, maxRenderScrollTop)");
    expect(component).toContain("new THREE.OrthographicCamera(0, width, cameraScrollTop, cameraScrollTop + height, -1, 1)");
    expect(component).toContain("overlayCanvasRef");
    expect(component).toContain("RiskFindingsDrillThrough");
    expect(component).toContain("function ImpactAnalyserLoadingOverlay");
    expect(component).toContain("isDiagramInitialLoading");
    expect(component).toContain('title="Loading Diagram"');
    expect(component).toContain('title="Loading Risk Detail"');
    expect(component).toContain("ICT System Impact Analyser Diagram");
    expect(component).not.toContain("ICT System Impact Analyser 2");
    expect(component).toContain("Findings Severity");
    expect(component).toContain("findingCriticalityFilterOptions");
    expect(component).toContain("Text Search");
    expect(component).toContain("Success Measure:");
    expect(component).toContain("Total Findings:");
    expect(component).toContain("tooltipMaxWidth");
    expect(component).toContain("tooltipLeft");
    expect(component).toContain("tooltipTop");
    expect(component).toContain('placement?: "left" | "default"');
    expect(component).toContain('placement: hit.action !== "none" ? "left" : "default"');
    expect(component).toContain("showAssetTypeFilter");
    expect(component).toContain("showSelectedTileText");
    expect(component).toContain("function MultiSelectFilter");
    expect(component).toContain("selectedEnvironments");
    expect(component).toContain("selectedSecurityDomains");
    expect(component).toContain("selectedAssetTypes");
    expect(component).toContain("selectedFindingCriticalities");
    expect(component).toContain("includeNetworkAxis?: boolean");
    expect(component).toContain("includeNetworkAxis = false");
    expect(component).toContain("export interface ImpactAnalyser2SelectedSearchOption");
    expect(component).toContain("export interface ImpactAnalyser2SelectedNode");
    expect(component).toContain("externalSelectedSearchOption?: ImpactAnalyser2SelectedSearchOption | null");
    expect(component).toContain("onSelectedNodeChange?: (node: ImpactAnalyser2SelectedNode | null) => void");
    expect(component).toContain("extraControls?: ReactNode");
    expect(component).toContain("const latestWorkerInitRequestIdRef = useRef(0)");
    expect(component).toContain("const [acknowledgedWorkerInitRequestId, setAcknowledgedWorkerInitRequestId] = useState(0)");
    expect(component).toContain("const initRequestId = latestWorkerInitRequestIdRef.current + 1");
    expect(component).toContain("latestWorkerInitRequestIdRef.current = initRequestId");
    expect(component).toContain('workerRef.current?.postMessage({ type: "init", initRequestId, rows, diagramMode })');
    expect(component).toContain("if (event.data.initRequestId !== latestWorkerInitRequestIdRef.current)");
    expect(component).toContain("setAcknowledgedWorkerInitRequestId(event.data.initRequestId)");
    expect(component).toContain("initRequestId: acknowledgedWorkerInitRequestId");
    expect(component).toContain("initRequestId: event.data.initRequestId");
    expect(component).toContain("if (!workerReady || !acknowledgedWorkerInitRequestId || !workerRef.current || !viewportSize.width)");
    expect(component).toContain("if (result.initRequestId !== acknowledgedWorkerInitRequestId)");
    expect(component).toContain("const clearRenderedDiagram = useCallback");
    expect(component).toContain("workerResultRef.current = null");
    expect(component).toContain("rendererRef.current?.clear()");
    expect(component).toContain("overlayContext.setTransform(1, 0, 0, 1, 0, 0)");
    expect(component).toContain("overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)");
    expect(component).toContain("if (renderer && renderer.domElement !== canvas)");
    expect(component).toContain("renderer.dispose()");
    expect(component).toContain("sceneRef.current = null");
    expect(component).toContain("renderer = null");
    expect(component).toContain('className="pointer-events-none absolute left-3 top-3 z-20');
    const chartViewportSource = component.slice(component.indexOf("ref={viewportRef}"));
    const webglCanvasIndex = chartViewportSource.indexOf("ref={webglCanvasRef}");
    const overlayCanvasIndex = chartViewportSource.indexOf("ref={overlayCanvasRef}");
    const emptyStateIndex = chartViewportSource.indexOf("No CI relationship paths match the selected filters.");
    expect(webglCanvasIndex).toBeGreaterThan(-1);
    expect(overlayCanvasIndex).toBeGreaterThan(-1);
    expect(emptyStateIndex).toBeGreaterThan(-1);
    expect(webglCanvasIndex).toBeLessThan(emptyStateIndex);
    expect(overlayCanvasIndex).toBeLessThan(emptyStateIndex);
    expect(component).toContain("const activeSelectedSearchOption = selectedSearchOption ?? externalSelectedSearchOption");
    expect(component).toContain("selectedSearchOption: activeSelectedSearchOption");
    expect(component).toContain("selectedNode: activeSelectedNode");
    expect(component).toContain("onSelectedNodeChange?.(activeSelectedNode)");
    expect(component).toContain("{extraControls}");
    expect(component).toContain('queueDiagramFilterRefresh({ type: "scroll-to-selected-node", node: externalSelectedNode })');
    expect(component).toContain('diagramMode = "risk"');
    expect(component).toContain('diagramMode?: ImpactAnalyser2DiagramMode');
    expect(component).toContain("sourceRows?: ImpactAnalyser2Row[]");
    expect(component).toContain("Network: ${selectedAssetMeta.networkName || selectedAssetMeta.networkId}");
    expect(component).toContain("function SelectedAssetPanel");
    expect(component).toContain("useCmdbDrillThrough");
    expect(component).toContain("openCmdbDrillThrough(node.value, assetName)");
    expect(component).not.toContain("interface AssetDetailsPanelModel");
    expect(component).not.toContain("function AssetDetailsPanel");
    expect(component).toContain('title="Selected Asset"');
    expect(component).toContain('placement="bottom-left"');
    expect(component).toContain('const placementClass = placement === "bottom-left" ? "bottom-3 left-3" : "right-3 top-3"');
    expect(component).toContain('activeSelectedNode?.axisKey === "asset"');
    expect(component).toContain("isCiDiagramMode && selectedAssetMeta");
    expect(component).not.toContain("const selectedRelatedAssetMeta");
    expect(component).not.toContain('activeSelectedNode?.axisKey === "relatedAsset" ? relatedAssetMetaById.get(activeSelectedNode.value)');
    expect(component).not.toContain("selectedRelatedAssetMeta.relatedAssetType");
    expect(component).not.toContain("selectedRelatedAssetMeta.relatedAssetEnvironmentType");
    expect(component).not.toContain("selectedRelatedAssetMeta.relatedAssetNetworkName");
    expect(component).not.toContain("selectedRelatedAssetMeta.relatedAssetHasIctSystem");
    expect(component).not.toContain("Related Asset: ${selectedAssetMeta.relatedAssetName");
    expect(component).not.toContain("Related ICT System: ${selectedAssetMeta.relatedSystemName");
    expect(component).toContain("onAssetFocus?: (assetId: string) => void");
    expect(component).toContain("assetFocusEligibleAssetIds?: string[]");
    expect(component).toContain("const assetFocusEligibleAssetIdSet = useMemo");
    expect(component).toContain("const isAssetFocusEligible = useCallback");
    expect(component).toContain('axis.key === "asset"');
    expect(component).toContain("const assetShapeTypeForNode = useCallback");
    expect(component).toContain('if (axisKey === "relatedAsset")');
    expect(component).toContain("relatedAssetMetaById.get(value)?.relatedAssetType");
    expect(component).toContain("const assetType = assetShapeTypeForNode(axis.key, value)");
    expect(component).toContain('if (!isCiDiagramMode && isSelected && axis.key === "asset" && isAssetFocusEligible(value))');
    expect(component).toContain("const canOpenAssetDetails = useCallback");
    expect(component).toContain('if (isCiDiagramMode && axisKey === "relatedAsset")');
    expect(component).toContain("relatedAssetMetaById.has(value)");
    expect(component).toContain("if (isSelected && canOpenAssetDetails(axis.key, value))");
    expect(component).toContain("if (isSelected && canOpenAssetDetails(axis.key, value) && bottomRightBadgeDistance <= 11)");
    expect(component).toContain('context.fillText("F"');
    expect(component).toContain('context.fillText("D"');
    expect(component).toContain("Open CI Analyser for ${displayNodeLabel(hit.node.axisKey, hit.node.value)}");
    expect(component).toContain("Open Asset Details for ${displayNodeLabel(hit.node.axisKey, hit.node.value)}");
    expect(component).toContain('hit.action === "asset-details"');
    expect(component).toContain("openAssetDetails(hit.node)");
    expect(cmdbDrawer).toContain("CMDB Drill Through");
    expect(cmdbDrawer).toContain("Asset Details for");
    expect(cmdbDrawer).toContain("CMDB Record");
    expect(cmdbDrawer).toContain("Open CMDB record");
    expect(cmdbDrawer).toContain('<table className="w-full table-fixed border-separate border-spacing-y-1 text-left select-text">');
    expect(cmdbDrawer).toContain('scope="row"');
    expect(cmdbDrawer).toContain('role="dialog"');
    expect(cmdbDrawer).toContain("fixed inset-0 z-[11000] pointer-events-none cursor-default");
    expect(cmdbDrawer).toContain("min-h-0 flex-1 cursor-text select-text overflow-y-auto py-3");
    expect(cmdbDrawer).toContain("cursor-pointer break-words text-cyan-200");
    expect(cmdbDrawer).toContain('aria-label="Close CMDB Drill Through"');
    expect(component).not.toContain("Open CI Flow Focus for ${displayNodeLabel(hit.node.axisKey, hit.node.value)}");
    expect(component).not.toContain("{!isCiDiagramMode && selectedAssetDetails");
    expect(component).not.toContain('assetType === "server" && onAssetFocus');
    expect(component).not.toContain("Selected Tile Text");
    expect(component).toContain("Selected Asset");
    expect(component).toContain("if (!axis.values.length)");
    expect(component).toContain("selectedSearchOption");
    expect(component).toContain("setSelectedSearchOption(null)");
    expect(component).toContain("setSelectedSearchOption(exactSearchOption)");
    expect(component).toContain("type ImpactAnalyser2PendingViewportAction");
    expect(component).toContain("pendingViewportActionRef");
    expect(component).toContain("acceptedWorkerResultRequestIdRef");
    expect(component).toContain("const queueDiagramFilterRefresh = useCallback");
    expect(component).toContain("const applyQueuedDiagramViewportAction = useCallback");
    expect(component).toContain("const handleDiagramSearchChange = useCallback");
    expect(component).toContain("const selectDiagramSearchOption = useCallback");
    expect(component).toContain('queueDiagramFilterRefresh({ type: "reset" })');
    expect(component).toContain('queueDiagramFilterRefresh({ type: "scroll-to-selected-node", node: exactSelectedNode })');
    expect(component).toContain('const reconcileDiagramViewport = useCallback((mode: "reset" | "clamp", virtualHeight?: number)');
    expect(component).toContain("resetDiagramViewportForFilterChange");
    expect(component).toContain("applyQueuedDiagramViewportAction(workerResult)");
    expect(component).toContain("scrollExactSearchNodeIntoView(action.node, result)");
    expect(component).toContain("const clearDiagramSearch = useCallback");
    expect(component).toContain('reconcileDiagramViewport("reset", result.virtualHeight)');
    expect(component).not.toContain("viewport.scrollTo({ top: 0 })");
    expect(component).toContain("requestId: event.data.requestId");
    expect(component).toContain("acknowledgedWorkerInitRequestId");
    expect(component).toContain("acceptedWorkerResultRequestIdRef.current = event.data.requestId");
    expect(component).toContain("if (acceptedWorkerResultRequestIdRef.current !== result.requestId)");
    expect(component).toContain("opacity: selectedNodeRef.current ? 0.14 : 0.42");
    expect(component).toContain('context.strokeStyle = "#38bdf8"');
    expect(component).toContain("context.lineWidth = 2.4");
    expect(component).not.toContain("context.globalAlpha = 0.96");
    expect(component).not.toContain("Math.sin(timestamp / 180)");
    expect(component).not.toContain("const pulse = 0.65");
    expect(component).not.toContain("context.shadowBlur = 12");
    expect(component).not.toContain("context.lineWidth = 2.2 + pulse * 2.2");
    expect(component).toContain("systemScopeIds?: string[]");
    expect(component).toContain("const systemScopeKey = hasSystemScope");
    expect(component).toContain("systemIds: normalizedSystemScopeIds");
    expect(component).toContain("diagramSystemIds: systemScopeKey");
    expect(component).toContain("diagramSearchAxis: activeSelectedSearchOption?.axisKey");
    expect(component).toContain("diagramSearchValue: activeSelectedSearchOption?.value");
    expect(component).toContain("diagramEnvironment: selectedEnvironmentKey");
    expect(component).toContain("diagramSecurityDomain: selectedSecurityDomainKey");
    expect(component).toContain("diagramFindingCriticality: selectedFindingCriticalityKey");
    expect(component).toContain("diagramAssetType: selectedAssetTypeKey");
    expect(component).toContain('analyserSlug = "ict-system-impact-analyser"');
    expect(component).toContain("exportSlug: `${analyserSlug}-spi-${drillThroughData.selectedSpiId}`");
    expect(component).toContain("viewport.scrollTo");
    expect(worker).toContain("Float32Array");
    expect(worker).toContain("rowMatchesSearch");
    expect(worker).toContain("axisKeyForSearchCategory");
    expect(worker).toContain("filterRows");
    expect(worker).toContain("buildAxes");
    expect(worker).toContain("initRequestId: number");
    expect(worker).toContain("initRequestId: request.initRequestId");
    expect(worker).toContain("const normalizedSearch = filters.search.trim().toLowerCase()");
    expect(worker).toContain("const systemIdFilter = filters.systemIds ? new Set(filters.systemIds) : null");
    expect(worker).toContain("if (systemIdFilter && (!row.systemId || !systemIdFilter.has(row.systemId)))");
    expect(worker).toContain("assetType: string");
    expect(worker).toContain("function matchesMultiFilter");
    expect(worker).toContain("environment: string[]");
    expect(worker).toContain('const assetTypeFilterValue = diagramMode === "ci" ? row.relatedAssetType : row.assetType');
    expect(worker).toContain("if (!matchesMultiFilter(filters.assetType, assetTypeFilterValue))");
    expect(worker).toContain('request.diagramMode === "ci" ? row.relatedAssetType : row.assetType');
    expect(worker).toContain('key: "asset"');
    expect(worker).toContain('key: "network"');
    expect(worker).toContain("includeNetworkAxis");
    expect(worker).toContain("rowPathAxisKeys");
    expect(worker).toContain('keys.push("network")');
    expect(worker).toContain('keys.push("system", "environment")');
    expect(worker).toContain('keys.push("severity", "spi")');
    expect(worker).toContain('assetAxis.label = request.layout.assetAxisLabel');
    expect(worker).toContain("rowHasFindingPath");
    expect(worker).toContain("const findingRows = filteredRows.filter(rowHasFindingPath)");
    expect(worker).toContain("let rowCanDraw = true");
    expect(worker).toContain("return { positions: positions.slice(0, offset), colors: colors.slice(0, colorOffset) }");
    expect(worker).toContain("filters.selectedSearchOption");
    expect(worker).toContain('diagramMode !== "ci"');
    expect(worker).toContain('diagramMode === "ci"');
    expect(worker).toContain("rowAxisValue(row, filters.selectedSearchOption.axisKey) === filters.selectedSearchOption.value");
    expect(worker).toContain("if (!rowMatchesSearch(row, normalizedSearch))");
    expect(worker).toContain("rows: filteredRows");
    expect(worker).toContain("rows: selectedRows");
    expect(worker).toContain("searchOptions");
    expect(worker).toContain("basePositions: baseBuffers.positions");
    expect(worker).toContain("highlightPositions");
    expect(worker).toContain('label: "Security Posture Indicator"');
    expect(worker).not.toContain('label: "SPI"');
  });

  it("does not draw vertical blue divider lines through the analyser node columns", () => {
    const component = readRepoFile("components/ict-system-impact-analyser-2.tsx");

    expect(component).not.toContain('context.strokeStyle = "rgba(125, 211, 252, 0.34)"');
    expect(component).not.toContain("context.moveTo(x, chartLayout.top - currentScrollTop)");
    expect(component).not.toContain("context.lineTo(x, result.virtualHeight - chartLayout.bottom - currentScrollTop)");
  });

  it("keeps asset CMDB record URL wired through DB and analyser row artefacts", () => {
    const schema = readRepoFile("Database Schema/database-schema.sql");
    const migration = readRepoFile("Database Schema/migrations/019_add_asset_cmdb_record_url.sql");
    const loader = readRepoFile("Database Schema/loaders/load-data.sql");
    const validator = readRepoFile("Database Schema/loaders/validate-database.sql");
    const mappingDocs = readRepoFile("Database Schema/data-mapping-description.txt");
    const schemaDocs = readRepoFile("Database Schema/database-schema-description.txt");
    const erd = readRepoFile("Database Schema/ERD.md");
    const dataLoader = readRepoFile("lib/data-loader.ts");
    const types = readRepoFile("lib/types.ts");
    const rowBuilder = readRepoFile("lib/cyber-cop-impact-analyser.ts");
    const cmdbBuilder = readRepoFile("lib/cmdb-drill-through.ts");
    const cmdbDrawer = readRepoFile("components/cmdb-drill-through.tsx");

    expect(schema).toContain("[cmdb_record_url] NVARCHAR(1024) NULL");
    expect(migration).toContain("019_add_asset_cmdb_record_url.sql");
    expect(migration).toContain("ADD [cmdb_record_url] NVARCHAR(1024) NULL");
    expect(loader).toContain("[cmdb_record_url]");
    expect(loader).toContain("'$.cmdbRecordUrl'");
    expect(validator).toContain("COL_LENGTH(N'tsaat.asset', N'cmdb_record_url')");
    expect(mappingDocs).toContain("cmdbRecordUrl");
    expect(schemaDocs).toContain("cmdb_record_url");
    expect(erd).toContain("cmdb_record_url");
    expect(dataLoader).toContain("cmdbRecordUrl: string | null");
    expect(dataLoader).toContain("a.[cmdb_record_url] AS [cmdbRecordUrl]");
    expect(types).toContain("cmdbRecordUrl?: string | null");
    expect(rowBuilder).toContain("cmdbRecordUrl?: string | null");
    expect(rowBuilder).toContain("cmdbRecordUrl: asset.cmdbRecordUrl ?? null");
    expect(cmdbBuilder).toContain("cmdbRecordUrl: asset.cmdbRecordUrl?.trim() || null");
    expect(cmdbDrawer).toContain("details?.cmdbRecordUrl");
    expect(cmdbDrawer).toContain("Open CMDB record");
  });
});
