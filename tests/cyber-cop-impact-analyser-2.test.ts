import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  buildCyberCopImpactAnalyserFindingRows,
  buildCyberCopImpactAnalyserRows,
  buildCyberCopIctSystemDependencyRows,
  buildNetworkImpactAnalyserModelAssetIds,
  buildNetworkImpactAnalyserRows,
  buildSystemImpactAnalyserModelAssetIds,
  buildSystemImpactAnalyserRows,
  filterCyberCopImpactAnalyserRows,
  NOT_MODELLED_DEPENDENT_SYSTEM_LABEL,
  type CyberCopImpactAnalyserRow
} from "@/lib/cyber-cop-impact-analyser";
import { Asset, CiDependency, Finding, ICTSystem, ManagedNetwork } from "@/lib/types";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
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
    securityDomain: "SECRET",
    missionCapabilities: [],
    businessServices: [],
    environments: []
  }
];

const networks: ManagedNetwork[] = [
  { securityDomain: "UNKNOWN",
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
  securityDomain: "SECRET",
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
  securityDomain: "SECRET",
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
      assetIpAddress: "10.0.0.10"
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

function dependencyServer(id: string, name: string, systemContext?: Asset["systemContext"]): Asset {
  return {
    id,
    name,
    hostname: `${id}.example.test`,
    cmdbRecordUrl: `https://cmdb.example.test/assets/${id}`,
    networkId: "network-1",
    securityDomain: "SECRET",
    lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
    vulnerabilities: [],
    systemContext,
    type: "server",
    operatingSystem: null,
    installedSoftware: []
  };
}

function dependencyWorkstation(id: string, name: string): Asset {
  return {
    id,
    name,
    hostname: `${id}.example.test`,
    networkId: "network-1",
    securityDomain: "SECRET",
    lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
    vulnerabilities: [],
    type: "workstation",
    operatingSystem: null,
    installedSoftware: []
  };
}

function dependencySystem(
  id: string,
  name: string,
  modellingStatus: boolean,
  environments: Array<{ type: ICTSystem["environments"][number]["type"]; assetIds: string[] }>
): ICTSystem {
  return {
    ...systems[0],
    id,
    name,
    modellingStatus,
    environments: environments.map((environment, index) => ({
      id: `${id}-environment-${index + 1}`,
      name: environment.type,
      ...environment
    }))
  };
}

describe("Cyber COP ICT System Dependencies rows", () => {
  it("keeps directed modelled server dependencies and applies eligibility only to source servers", () => {
    const assets = [
      dependencyServer("source-a", "Source A", { systemId: "source-system", environmentType: "Production" }),
      dependencyServer("source-b", "Source B", { systemId: "source-system", environmentType: "Production" }),
      dependencyServer("target-modelled", "Target Modelled", {
        systemId: "target-system",
        environmentType: "UAT"
      })
    ];
    const dependencySystems = [
      dependencySystem("source-system", "Source System", true, [
        { type: "Production", assetIds: ["source-a", "source-b"] }
      ]),
      dependencySystem("target-system", "Target System", true, [
        { type: "UAT", assetIds: ["target-modelled"] }
      ])
    ];
    const dependencies: CiDependency[] = [
      {
        id: "source-a-to-target",
        sourceAssetId: "source-a",
        targetAssetId: "target-modelled",
        dependencyType: "Flow Dependency"
      },
      {
        id: "source-b-to-target",
        sourceAssetId: "source-b",
        targetAssetId: "target-modelled",
        dependencyType: "Logical Dependency"
      }
    ];

    const rows = buildCyberCopIctSystemDependencyRows({
      assets,
      ciDependencies: dependencies,
      systems: dependencySystems,
      selectedSystemIds: ["source-system"],
      sourceAssetIds: ["source-a"],
      networkNameById: new Map([["network-1", "Core Network"]])
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dependencyId: "source-a-to-target",
      dependencyType: "Flow Dependency",
      systemId: "source-system",
      systemName: "Source System",
      environmentType: "Production",
      assetId: "source-a",
      relatedAssetId: "target-modelled",
      relatedAssetEnvironmentType: "UAT",
      relatedAssetHasIctSystem: true,
      relatedSystemId: "target-system",
      relatedSystemName: "Target System"
    });
    expect(rows.map((row) => `${row.assetId}->${row.relatedAssetId}`)).toEqual(["source-a->target-modelled"]);
  });

  it("emits only the stored directed edges without synthesising a transitive dependency", () => {
    const assets = [
      dependencyServer("server-a", "Server A"),
      dependencyServer("server-b", "Server B"),
      dependencyServer("server-c", "Server C")
    ];
    const dependencySystems = [
      dependencySystem("chain-system", "Chain System", true, [
        { type: "Production", assetIds: assets.map((asset) => asset.id) }
      ])
    ];
    const dependencies: CiDependency[] = [
      {
        id: "a-to-b",
        sourceAssetId: "server-a",
        targetAssetId: "server-b",
        dependencyType: "Flow Dependency"
      },
      {
        id: "b-to-c",
        sourceAssetId: "server-b",
        targetAssetId: "server-c",
        dependencyType: "Flow Dependency"
      }
    ];

    const rows = buildCyberCopIctSystemDependencyRows({
      assets,
      ciDependencies: dependencies,
      systems: dependencySystems,
      selectedSystemIds: ["chain-system"]
    });

    expect(rows.map((row) => `${row.assetId}->${row.relatedAssetId}`).sort()).toEqual([
      "server-a->server-b",
      "server-b->server-c"
    ]);
    expect(rows.some((row) => row.assetId === "server-a" && row.relatedAssetId === "server-c")).toBe(false);
  });

  it("deduplicates dependency ids and excludes self, dangling, and non-server edges", () => {
    const assets = [
      dependencyServer("source-server", "Source Server"),
      dependencyServer("target-one", "Target One"),
      dependencyServer("target-two", "Target Two"),
      dependencyWorkstation("target-workstation", "Target Workstation")
    ];
    const dependencySystems = [
      dependencySystem("edge-system", "Edge System", true, [
        { type: "Production", assetIds: ["source-server"] }
      ])
    ];
    const dependencies: CiDependency[] = [
      {
        id: "duplicate-id",
        sourceAssetId: "source-server",
        targetAssetId: "target-one",
        dependencyType: "Logical Dependency"
      },
      {
        id: "duplicate-id",
        sourceAssetId: "source-server",
        targetAssetId: "target-two",
        dependencyType: "Flow Dependency"
      },
      {
        id: "self-edge",
        sourceAssetId: "source-server",
        targetAssetId: "source-server",
        dependencyType: "Flow Dependency"
      },
      {
        id: "dangling-edge",
        sourceAssetId: "source-server",
        targetAssetId: "missing-server",
        dependencyType: "Flow Dependency"
      },
      {
        id: "non-server-target",
        sourceAssetId: "source-server",
        targetAssetId: "target-workstation",
        dependencyType: "Flow Dependency"
      },
      {
        id: "non-server-source",
        sourceAssetId: "target-workstation",
        targetAssetId: "source-server",
        dependencyType: "Flow Dependency"
      }
    ];

    const rows = buildCyberCopIctSystemDependencyRows({
      assets,
      ciDependencies: dependencies,
      systems: dependencySystems,
      selectedSystemIds: ["edge-system"]
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dependencyId: "duplicate-id",
      assetId: "source-server",
      relatedAssetId: "target-one"
    });
  });

  it("uses Not Modelled for absent, inactive-model, and context-only dependent servers", () => {
    const assets = [
      dependencyServer("source-server", "Source Server"),
      dependencyServer("target-absent", "Target Absent"),
      dependencyServer("target-inactive", "Target Inactive", {
        systemId: "inactive-system",
        environmentType: "Development"
      }),
      dependencyServer("target-context-only", "Target Context Only", {
        systemId: "modelled-system",
        environmentType: "UAT"
      })
    ];
    const dependencySystems = [
      dependencySystem("source-system", "Source System", true, [
        { type: "Production", assetIds: ["source-server"] }
      ]),
      dependencySystem("inactive-system", "Inactive System", false, [
        { type: "Development", assetIds: ["target-inactive"] }
      ]),
      dependencySystem("modelled-system", "Modelled System", true, [{ type: "UAT", assetIds: [] }])
    ];
    const dependencies: CiDependency[] = ["target-absent", "target-inactive", "target-context-only"].map(
      (targetAssetId) => ({
        id: `source-to-${targetAssetId}`,
        sourceAssetId: "source-server",
        targetAssetId,
        dependencyType: "Logical Dependency"
      })
    );

    const rows = buildCyberCopIctSystemDependencyRows({
      assets,
      ciDependencies: dependencies,
      systems: dependencySystems,
      selectedSystemIds: ["source-system"]
    });

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.relatedAssetId).sort()).toEqual([
      "target-absent",
      "target-context-only",
      "target-inactive"
    ]);
    expect(
      rows.every(
        (row) =>
          row.relatedSystemId === null &&
          row.relatedSystemName === NOT_MODELLED_DEPENDENT_SYSTEM_LABEL &&
          row.relatedAssetEnvironmentType === null &&
          row.relatedAssetHasIctSystem === false
      )
    ).toBe(true);
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
      securityDomain: "SECRET",
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
    expect(filterCyberCopImpactAnalyserRows(rows, { environment: ["Production"], securityDomain: ["SECRET"] })).toHaveLength(1);
    expect(filterCyberCopImpactAnalyserRows(rows, { environment: "Production,UAT" })).toHaveLength(1);
    expect(filterCyberCopImpactAnalyserRows(rows, { findingCriticality: "High Risk" })).toHaveLength(0);
    expect(filterCyberCopImpactAnalyserRows(rows, { securityDomain: "PROTECTED" })).toHaveLength(0);
    expect(filterCyberCopImpactAnalyserRows(rows, { search: "pay-srv" })).toHaveLength(1);
    expect(filterCyberCopImpactAnalyserRows(rows, { search: "missing" })).toHaveLength(0);
  });

  it("uses exact selected search filtering instead of substring matching", () => {
    const collisionRows: CyberCopImpactAnalyserRow[] = [
      {
        findingId: "finding-spi-1",
        assetId: "server-1", assetName: "PAY-SRV-01", assetHostname: "pay-srv-01.example.test", assetType: "server",
        assetIpAddress: "10.0.0.1", networkId: "network-1", hasOpenFinding: true,
        systemId: "system-1",
        systemName: "Payments",
        networkName: "Core Network",
        hasIctSystem: true,
        environmentType: "Production",
        serverId: "server-1",
        serverName: "PAY-SRV-01",
        serverHostname: "pay-srv-01.example.test",
        securityDomain: "SECRET",
        severity: "High Risk",
        spiId: 1,
        spiLabel: "SPI 1"
      },
      {
        findingId: "finding-spi-10",
        assetId: "server-2", assetName: "PAY-SRV-10", assetHostname: "pay-srv-10.example.test", assetType: "server",
        assetIpAddress: "10.0.0.1", networkId: "network-1", hasOpenFinding: true,
        systemId: "system-1",
        systemName: "Payments",
        networkName: "Core Network",
        hasIctSystem: true,
        environmentType: "Production",
        serverId: "server-2",
        serverName: "PAY-SRV-10",
        serverHostname: "pay-srv-10.example.test",
        securityDomain: "SECRET",
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
        assetId: "server-1", assetName: "PAY-SRV-01", assetHostname: "pay-srv-01.example.test", assetType: "server",
        assetIpAddress: "10.0.0.1", networkId: "network-1", hasOpenFinding: true,
        systemId: "system-1",
        systemName: "Payments",
        networkName: "Core Network",
        hasIctSystem: true,
        environmentType: "Production",
        serverId: "server-1",
        serverName: "PAY-SRV-01",
        serverHostname: "pay-srv-01.example.test",
        securityDomain: "SECRET",
        severity: "Critical Exposure",
        spiId: 3,
        spiLabel: "SPI 3"
      },
      {
        findingId: "finding-system-2",
        assetId: "server-2", assetName: "LOG-SRV-01", assetHostname: "log-srv-01.example.test", assetType: "server",
        assetIpAddress: "10.0.0.1", networkId: "network-1", hasOpenFinding: true,
        systemId: "system-2",
        systemName: "Logistics",
        networkName: "Core Network",
        hasIctSystem: true,
        environmentType: "Production",
        serverId: "server-2",
        serverName: "LOG-SRV-01",
        serverHostname: "log-srv-01.example.test",
        securityDomain: "PROTECTED",
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
      networkOs: null, patchState: null,
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
      type: "network-device",
      networkOs: null, patchState: null
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
      systemId: "system-1",
      networkId: "network-1",
      environmentType: "Production"
    });
    for (const row of rows) {
      expect(row).not.toHaveProperty("owner");
      expect(row).not.toHaveProperty("assetChangeAssignmentGroup");
      expect(row).not.toHaveProperty("assetIncidentAssignmentGroup");
    }
  });
});

describe("Cyber COP ICT System Impact Analyser source wiring", () => {
  it("opens the scalable analyser as a standalone workspace view", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const page = readRepoFile("app/cyber-cop/page.tsx");
    const navigation = readRepoFile("lib/workspace-navigation.ts");
    const impactTabsStart = dashboard.indexOf("const impactChartTabs");
    const impactTabsEnd = dashboard.indexOf("];", impactTabsStart);
    const impactTabs = dashboard.slice(impactTabsStart, impactTabsEnd);

    expect(navigation).toContain('href: "/cyber-cop?copView=ict-system-impact-analyser"');
    expect(page).toContain("activeTab={resolveCopView(searchParams.copView)}");
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

  it("opens ICT System Dependencies independently with the exact directed six-axis contract", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const component = readRepoFile("components/ict-system-impact-analyser-2.tsx");
    const worker = readRepoFile("components/ict-system-impact-analyser-2-worker.ts");
    const dependencyExport = readRepoFile("lib/ict-system-dependencies-export.ts");
    const dependencyRoute = readRepoFile("app/api/cyber-cop/impact-analyser-2/dependencies/route.ts");
    const ictPanelStart = dashboard.indexOf("function IctSystemImpactAnalyserRunPanel");
    const panelEnd = dashboard.indexOf("function ImpactChartTabs");
    const ictPanel = dashboard.slice(ictPanelStart, panelEnd);

    expect(dashboard).toContain('activeTab === "ict-system-dependencies"');
    expect(dashboard).toContain('id="cyber-cop-tabpanel-ict-system-dependencies"');
    expect(dashboard).toContain('view="dependencies"');
    expect(dashboard).toContain("systemOptions={ictSystemOptions}");
    expect(ictPanel).not.toContain("isDependenciesOpen");
    expect(ictPanel).not.toContain("diagramOverlay");
    expect(ictPanel).toContain('dataPath={isDependenciesView ? "/api/cyber-cop/impact-analyser-2/dependencies" : undefined}');
    expect(ictPanel).toContain('diagramMode={isDependenciesView ? "dependencies" : "risk"}');
    expect(ictPanel).toContain("systemScopeIds={appliedSystemIds}");
    expect(ictPanel).toContain('complianceActionScope={isDependenciesView ? "dependency-servers" : "risk-servers"}');
    expect(ictPanel).toContain('initialEnvironments={isDependenciesView ? ["Production"] : []}');
    expect(ictPanel).toContain('initialFindingSeverities={isDependenciesView ? [] : ["Critical Exposure", "High Risk"]}');
    expect(component).toContain("() => [...initialEnvironments]");
    expect(component).toContain("() => [...initialFindingSeverities]");
    expect(component).toContain("new Set([...environmentOptions, ...selectedEnvironments])");
    expect(component).not.toContain("current.filter((environment) => environmentOptions.includes(environment))");
    expect(component).toContain('type ImpactAnalyser2DiagramMode = "risk" | "ci" | "dependencies"');
    expect(component).not.toContain("data-impact-analyser-diagram-overlay");
    expect(component).toContain("data-impact-analyser-filter-row={diagramMode}");
    expect(component).toContain('label="Dependent ICT Systems"');
    expect(component).toContain('aria-label="Export ICT System Dependencies to Excel"');
    expect(component).toContain("buildIctSystemDependenciesWorkbookXml(filteredDependencyRows)");
    expect(component).toContain('axis.key === "relatedSystem" && value === "Not Modelled"');
    expect(component).toContain('? "#ef4444"');
    expect(component).toContain('data-not-modelled-node-legend="true"');
    expect(component).toContain("data-dependency-axis-order");

    const dependencyAxesStart = worker.indexOf('const isDependencyDiagram = diagramMode === "dependencies"');
    const dependencyAxes = worker.slice(dependencyAxesStart, worker.indexOf("const findingRows", dependencyAxesStart));
    const expectedAxisLabels = [
      'label: "ICT System"',
      'label: "Environment"',
      'label: isDependencyDiagram ? "Dependent Server" : "Related Asset"',
      'label: "Dependent Environment"',
      'label: isDependencyDiagram ? "Dependent ICT System" : "Related ICT System"'
    ];
    let previousAxisIndex = -1;
    for (const axisLabel of expectedAxisLabels) {
      const axisIndex = dependencyAxes.indexOf(axisLabel);
      expect(axisIndex).toBeGreaterThan(previousAxisIndex);
      previousAxisIndex = axisIndex;
    }
    expect(worker).toContain('assetAxis.label = request.layout.assetAxisLabel');
    expect(worker).toContain('keys.push("relatedEnvironment")');
    expect(worker).toContain('left === NOT_MODELLED_DEPENDENT_SYSTEM_LABEL');
    expect(worker).toContain("dependentIctSystem: string[]");
    expect(worker).toContain("dependentIctSystemOptions");
    expect(worker).toContain("filters.dependentIctSystem");
    expect(worker).toContain("filteredSourceRowIndexes");

    expect(dependencyExport).toContain('"ICT System"');
    expect(dependencyExport).toContain('"Dependent ICT System"');
    expect(dependencyExport).toContain('ss:Name="ICT System Dependencies"');
    expect(dependencyExport).toContain("application/vnd.ms-excel");

    expect(dependencyRoute).toContain('export const dynamic = "force-dynamic"');
    expect(dependencyRoute).toContain('request.nextUrl.searchParams.get("diagramSystemIds")');
    expect(dependencyRoute).toContain("buildCyberCopIctSystemDependencyRows");
    expect(dependencyRoute).toContain("sourceAssetIds: eligibleSourceAssetIds");
  });

  it("generalizes the accessible Compliance action without retaining the F action", () => {
    const component = readRepoFile("components/ict-system-impact-analyser-2.tsx");

    expect(component).toContain("export type ImpactAnalyser2ComplianceActionScope");
    expect(component).toContain('| "risk-servers"');
    expect(component).toContain('| "risk-all-assets"');
    expect(component).toContain('| "dependency-servers"');
    expect(component).toContain("complianceActionScope?: ImpactAnalyser2ComplianceActionScope");
    expect(component).toContain('if (diagramMode === "risk")');
    expect(component).toContain('if (axisKey !== "asset")');
    expect(component).toContain('complianceActionScope === "risk-all-assets"');
    expect(component).toContain('complianceActionScope === "risk-servers" && assetType === "server"');
    expect(component).toContain('diagramMode === "dependencies"');
    expect(component).toContain('complianceActionScope === "dependency-servers"');
    expect(component).toContain('(axisKey === "asset" || axisKey === "relatedAsset")');
    expect(component).toContain('assetType === "server"');
    expect(component).toContain('activeSelectedNode.axisKey === "relatedAsset"');
    expect(component).toContain("relatedAssetMetaById.get(activeSelectedNode.value)?.relatedSystemId");
    expect(component).toContain("assetMetaById.get(activeSelectedNode.value)?.systemId");

    expect(component).toContain(
      "const x = axisX(axisIndex, workerResult.axes.length, viewportSize.width) + 13;"
    );
    expect(component).toContain(
      "const y = valueVirtualY(axis, valueIndex, workerResult.virtualHeight) - scrollTop - 13;"
    );
    expect(component).toContain(
      "style={{ left: complianceNodeAction.x, top: complianceNodeAction.y }}"
    );

    const actionMarker = 'data-impact-analyser-node-action="compliance"';
    const actionMarkerIndex = component.indexOf(actionMarker);
    const actionStart = component.lastIndexOf("<PersonaPopupButton", actionMarkerIndex);
    const actionEnd = component.indexOf("</PersonaPopupButton>", actionMarkerIndex);
    expect(actionMarkerIndex).toBeGreaterThanOrEqual(0);
    expect(actionStart).toBeGreaterThanOrEqual(0);
    expect(actionEnd).toBeGreaterThan(actionMarkerIndex);
    const actionButton = component.slice(actionStart, actionEnd + "</PersonaPopupButton>".length);
    expect(actionButton).toContain('<PersonaPopupButton popup="asset-compliance"');
    expect(actionButton).toContain("ref={complianceTriggerRef}");
    expect(actionButton).toContain('type="button"');
    expect(actionButton).toContain(actionMarker);
    expect(actionButton).toContain(
      'aria-label={`Open Compliance View for ${complianceNodeAction.assetName}`}'
    );
    expect(actionButton).toMatch(/>\s*C\s*<\/PersonaPopupButton>/);

    expect(component).toContain('type ImpactAnalyser2ActionHit = "none" | "spi-findings" | "asset-details"');
    expect(component).not.toContain('"asset-focus"');
    expect(component).not.toContain("onAssetFocus");
    expect(component).not.toContain("assetFocusEligibleAssetIds");
    expect(component).not.toContain("isAssetFocusEligible");
    expect(component).not.toContain('context.fillText("F"');
    expect(component).not.toContain("Open CI Analyser for");
    expect(component).toContain("context.arc(x + 13, y + 13, 7, 0, Math.PI * 2);");
    expect(component).toContain('context.fillText("D", x + 13, y + 13.5);');
    expect(component).toContain(
      'compliancePath = "/api/cyber-cop/impact-analyser-2/compliance"'
    );
    expect(component).toContain("<ServerComplianceView");
    expect(component).toContain("systemId={complianceAsset.systemId}");
    expect(component).toContain("dataPath={compliancePath}");
    expect(component).toContain("onClose={closeComplianceView}");
  });

  it("shares Settings sizing and explorer controls while preserving asset compliance drill-through", () => {
    const complianceView = readRepoFile("components/server-compliance-view.tsx");

    expect(complianceView).toContain('className="settings-popup asset-compliance-popup"');
    expect(complianceView).toContain("node?.showModal()");
    expect(complianceView).toContain("<WorkspaceTabs");
    expect(complianceView).toContain("<FindingsDataTable");
    expect(complianceView).toContain('data-server-compliance-dialog="fixed"');
    expect(complianceView).toContain('data-asset-compliance-dialog="fixed"');
    expect(complianceView).toContain('data-asset-compliance-view="true"');
    expect(complianceView).toContain('params.set("systemId", systemId)');
    expect(complianceView).toContain('model?.asset.assetTypeLabel ?? "Asset"');
    expect(complianceView).toContain("data-server-compliance-score-tiles");
    expect(complianceView).toContain("Security Posture Indicator breakdown");
    expect(complianceView).toContain("data-server-compliance-spi-breakdown");
    expect(complianceView).toContain("data-server-compliance-measure-detail");

    const measureActionMarker = "data-server-compliance-measure-action";
    const measureActionIndex = complianceView.indexOf(measureActionMarker);
    const measureActionStart = complianceView.lastIndexOf("<button", measureActionIndex);
    const measureActionEnd = complianceView.indexOf("</button>", measureActionIndex);
    expect(measureActionIndex).toBeGreaterThanOrEqual(0);
    expect(measureActionStart).toBeGreaterThanOrEqual(0);
    expect(measureActionEnd).toBeGreaterThan(measureActionIndex);
    const measureAction = complianceView.slice(measureActionStart, measureActionEnd + "</button>".length);
    expect(measureAction).toContain('type="button"');
    expect(measureAction).toContain("onClick=");

    expect(complianceView).toContain("if (selectedMeasure) closeMeasureDetail(); else onClose()");
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
    expect(dashboard).toContain('key={"cyber-cop-" + view + "-run-" + runRequestId}');
  });

  it("retains compatibility data API scoping without a Network Impact Analyser UI", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const dataRoute = readRepoFile("app/api/cyber-cop/impact-analyser-2/route.ts");
    const findingsRoute = readRepoFile("app/api/cyber-cop/impact-analyser-2/findings/route.ts");
    const component = readRepoFile("components/ict-system-impact-analyser-2.tsx");
    const drawer = readRepoFile("components/cmdb-drill-through.tsx");
    expect(dashboard).not.toContain("NetworkImpactAnalyserRunPanel");
    expect(dashboard).not.toContain('activeTab === "network-impact-analyser"');
    expect(drawer).not.toContain("Open Network Impact Analyser");
    expect(drawer).not.toContain("data-cmdb-network-impact");
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

  it("toggles ICT system selections from the full option row", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const ictPanelStart = dashboard.indexOf("function IctSystemImpactAnalyserRunPanel");
    const panelEnd = dashboard.indexOf("function ImpactChartTabs");
    const ictPanel = dashboard.slice(ictPanelStart, panelEnd);

    expect(ictPanel).toContain('data-impact-analyser-selection-option="ict-system"');
    expect(ictPanel).toContain("if (!(event.target instanceof HTMLInputElement))");
    expect(ictPanel).toContain("event.preventDefault()");
    expect(ictPanel).toContain("onChange={() => toggleSelectedSystem(system.id)}");
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
    expect(component).not.toContain("onAssetFocus");
    expect(component).not.toContain("assetFocusEligibleAssetIds");
    expect(component).not.toContain("assetFocusEligibleAssetIdSet");
    expect(component).not.toContain("isAssetFocusEligible");
    expect(component).toContain('axisKey === "asset"');
    expect(component).toContain("const assetShapeTypeForNode = useCallback");
    expect(component).toContain('if (axisKey === "relatedAsset")');
    expect(component).toContain("relatedAssetMetaById.get(value)?.relatedAssetType");
    expect(component).toContain("const assetType = assetShapeTypeForNode(axis.key, value)");
    expect(component).toContain("const canOpenCompliance = useCallback");
    expect(component).toContain("complianceActionScope?: ImpactAnalyser2ComplianceActionScope");
    expect(component).toContain("const canOpenAssetDetails = useCallback");
    expect(component).toContain('if (isRelationshipDiagramMode && axisKey === "relatedAsset")');
    expect(component).toContain("relatedAssetMetaById.has(value)");
    expect(component).toContain("if (isSelected && cmdbAllowed && canOpenAssetDetails(axis.key, value))");
    expect(component).toContain("if (isSelected && cmdbAllowed && canOpenAssetDetails(axis.key, value) && bottomRightBadgeDistance <= 11)");
    expect(component).not.toContain('context.fillText("F"');
    expect(component).toContain('context.fillText("D"');
    expect(component).not.toContain("Open CI Analyser for ${displayNodeLabel(hit.node.axisKey, hit.node.value)}");
    expect(component).toContain("Open Asset Details for ${displayNodeLabel(hit.node.axisKey, hit.node.value)}");
    expect(component).toContain('hit.action === "asset-details"');
    expect(component).toContain("openAssetDetails(hit.node)");
    expect(cmdbDrawer).toContain("CMDB Drill Through");
    expect(cmdbDrawer).toContain("Asset details for");
    expect(cmdbDrawer).toContain("details?.attributes ?? []");
    expect(cmdbDrawer).toContain('href={row.href}');
    expect(cmdbDrawer).toContain('title="Asset Details" rows={tableRows} columns={detailColumns}');
    expect(cmdbDrawer).toContain('label: "Field"');
    expect(cmdbDrawer).toContain("<dialog");
    expect(cmdbDrawer).toContain("measure-scope-panel measure-scope-panel-systems cmdb-scope-panel");
    expect(cmdbDrawer).toContain('className="measure-scope-table cmdb-details-table"');
    expect(cmdbDrawer).toContain('className="cmdb-record-link"');
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
    expect(worker).toContain('const assetTypeFilterValue = diagramMode === "risk" ? row.assetType : row.relatedAssetType');
    expect(worker).toContain("if (!matchesMultiFilter(filters.assetType, assetTypeFilterValue))");
    expect(worker).toContain('request.diagramMode === "risk" ? row.assetType : row.relatedAssetType');
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
    expect(worker).toContain('diagramMode !== "risk"');
    expect(worker).toContain('diagramMode === "risk"');
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
    const dataLoader = readRepoFile("lib/sql-data-loader.ts");
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
    const cmdbAttributes = readRepoFile("lib/cmdb-attributes.ts");
    expect(cmdbAttributes).toContain('key === "cmdbRecordUrl"');
    expect(cmdbAttributes).toContain("safeExternalUrl(details.cmdbRecordUrl)");
    expect(cmdbAttributes).toContain("Open CMDB record");
    expect(cmdbDrawer).toContain("details?.attributes ?? []");
    expect(cmdbDrawer).toContain("href={row.href}");
  });
});
