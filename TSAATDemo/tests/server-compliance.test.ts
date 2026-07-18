import { describe, expect, it } from "vitest";
import { ASSET_TYPES, assetTypeLabel, createAssetTypeRecord } from "@/lib/asset-taxonomy";
import type { CanonicalAssetType } from "@/lib/asset-taxonomy";
import type { DiscoveryToolSetting, DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { buildAssetComplianceModel, buildServerComplianceModel } from "@/lib/server-compliance";
import type { SpiDefinition } from "@/lib/spi-definitions";
import type { Asset, Dataset, Finding, ICTSystem, ManagedNetwork, ServerAsset } from "@/lib/types";

function serverAsset(overrides: Partial<ServerAsset & { ipAddress: string }> = {}): ServerAsset {
  return {
    id: "server-1",
    name: "Application Server",
    hostname: "app-server-01",
    ipAddress: "10.20.30.40",
    type: "server",
    networkId: "network-1",
    securityDomain: "Protected",
    lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
    vulnerabilities: [],
    operatingSystem: null,
    installedSoftware: [],
    ...overrides
  } as ServerAsset;
}

function workstationAsset(): Asset {
  return {
    id: "workstation-1",
    name: "Workstation",
    hostname: "workstation-01",
    type: "workstation",
    networkId: "network-1",
    securityDomain: "Unclassified",
    lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
    vulnerabilities: [],
    operatingSystem: null,
    installedSoftware: []
  };
}

function canonicalAsset(assetType: CanonicalAssetType): Asset {
  const base = {
    id: `${assetType}-1`,
    name: `${assetTypeLabel(assetType)} Asset`,
    hostname: `${assetType}-01`,
    type: assetType,
    networkId: "network-1",
    securityDomain: "Protected" as const,
    lifecycle: { eolStatus: "Supported" as const, warrantyStatus: "InWarranty" as const },
    vulnerabilities: []
  };
  if (assetType === "server" || assetType === "workstation") {
    return { ...base, type: assetType, operatingSystem: null, installedSoftware: [] } as Asset;
  }
  if (assetType === "network-device") {
    return { ...base, type: assetType, networkOs: null, patchState: null } as Asset;
  }
  return { ...base, type: assetType } as Asset;
}

function managedNetwork(): ManagedNetwork {
  return {
    id: "network-1",
    name: "Protected Network",
    criticality: "Critical",
    adfPlatform: false,
    enterprisePlatform: true,
    modellingStatus: true,
    discoveryStatus: "Discovery Enabled",
    ictSystemIds: ["system-1", "system-2"],
    assetIds: ["server-1"]
  };
}

function system(id: string, name: string, environmentType: "Production" | "Development"): ICTSystem {
  return {
    id,
    name,
    adfPlatform: false,
    enterprisePlatform: true,
    modellingStatus: true,
    diisDefined: true,
    networkId: "network-1",
    criticality: "Critical",
    securityDomain: "Protected",
    missionCapabilities: [],
    businessServices: [],
    environments: [
      {
        id: `${id}-${environmentType.toLowerCase()}`,
        name: environmentType,
        type: environmentType,
        assetIds: ["server-1"]
      }
    ]
  };
}

function spiDefinition(spiId: number, name: string, displayOrder: number, description = name): SpiDefinition {
  return { spiId, name, description, displayOrder } as SpiDefinition;
}

function finding(
  id: string,
  spiId: number,
  options: Partial<Finding> = {}
): Finding {
  return {
    id,
    spiId,
    priorityRank: 2,
    severity: "High Risk",
    status: "open",
    complianceStatus: "Non-compliant",
    timestamp: "2026-07-10T00:00:00.000Z",
    scope: {
      networkId: "network-1",
      systemId: "system-1",
      environmentType: "Production",
      assetId: "server-1"
    },
    title: `Finding ${id}`,
    evidence: {},
    recommendedAction: `Remediate ${id}`,
    ...options
  };
}

function discoveryTool(
  id: string,
  name: string,
  requiredAssetTypes: CanonicalAssetType[] = ["server"]
): DiscoveryToolSetting {
  return {
    id,
    name,
    description: `${name} discovery coverage`,
    el2Owner: `${name} Owner`,
    el2OperationsManager: `${name} Operations`,
    assetTypeScope: createAssetTypeRecord((assetType) =>
      requiredAssetTypes.includes(assetType) ? "required" : "na"
    )
  };
}

function discoverySettings(): DiscoveryToolsSettings {
  return {
    updatedAt: "2026-07-17T00:00:00.000Z",
    tools: [
      discoveryTool("ucmdb", "UCMDB"),
      discoveryTool("tanium", "Tanium"),
      discoveryTool("tenable", "Tenable"),
      discoveryTool("printer-only", "Printer Tool", [])
    ]
  };
}

function baseDataset(assets: Asset[] = [serverAsset()]): Dataset {
  return {
    generatedAt: "2026-07-17T01:00:00.000Z",
    snapshotDate: "2026-07-17",
    managedNetworks: [managedNetwork()],
    ictSystems: [system("system-1", "Alpha System", "Production"), system("system-2", "Beta System", "Development")],
    assets,
    spiEvaluations: [],
    discoveryCoverageEvaluations: [],
    findings: []
  };
}

describe("buildServerComplianceModel", () => {
  it("builds deterministic SPI, finding, discovery, and preferred model context details for a server", () => {
    const dataset = baseDataset();
    dataset.spiEvaluations = [
      {
        assetId: "server-1",
        spiId: 1,
        status: "Non-compliant",
        reasons: [" Patch gap ", ""],
        evidence: { zNull: null, compliantFlag: false, missingPatches: 2 }
      },
      {
        assetId: "server-1",
        spiId: 2,
        status: "Compliant",
        reasons: [],
        evidence: {}
      }
    ];
    dataset.findings = [
      finding("finding-p2", 1, { priorityRank: 2, timestamp: "2026-07-12T00:00:00.000Z" }),
      finding("finding-p1", 1, {
        priorityRank: 1,
        timestamp: "2026-07-11T00:00:00.000Z",
        evidence: {
          assetOwner: "Application Owner",
          changeAssignmentGroup: "Change Team",
          incidentAssignmentGroup: "Incident Team",
          scanner: "Tenable"
        }
      }),
      finding("finding-evidence", 2, { evidence: { scanner: "Tenable", detected: true } }),
      finding("finding-closed", 1, {
        status: "closed",
        closedTimestamp: "2026-07-16T00:00:00.000Z"
      }),
      finding("finding-other-asset", 1, {
        scope: {
          networkId: "network-1",
          systemId: null,
          environmentType: null,
          assetId: "other-server"
        }
      })
    ];
    dataset.discoveryCoverageEvaluations = [
      {
        assetId: "server-1",
        toolValues: { ucmdb: 1, tanium: 0, tenable: null, "printer-only": 1 },
        missingToolIds: ["tanium"],
        missingToolNames: ["Tanium"],
        coverageCompliance: false
      }
    ];

    const model = buildServerComplianceModel({
      dataset,
      assetId: " server-1 ",
      preferredSystemId: "system-2",
      spiDefinitions: [spiDefinition(1, "Patch Compliance", 2), spiDefinition(2, "Vulnerability Coverage", 1)],
      discoveryToolsSettings: discoverySettings()
    });

    expect(model).not.toBeNull();
    expect(model?.snapshotDate).toBe("2026-07-17");
    expect(model?.asset).toEqual({
      id: "server-1",
      name: "Application Server",
      hostname: "app-server-01",
      ipAddress: "10.20.30.40",
      assetType: "server",
      assetTypeLabel: "Server",
      environmentType: "Development",
      systemName: "Beta System",
      networkName: "Protected Network",
      securityDomain: "Protected"
    });
    expect(model?.complianceOverview).toMatchObject({
      score: 50,
      total: 2,
      compliant: 1,
      nonCompliant: 1,
      unknown: 0,
      openFindingCount: 3
    });
    expect(model?.complianceOverview.measures.map((measure) => measure.spiId)).toEqual([2, 1]);
    expect(model?.complianceOverview.measures[0]).toMatchObject({
      label: "SPI 2 - Vulnerability Coverage",
      status: "Compliant",
      total: 1,
      compliant: 1,
      nonCompliant: 0,
      unknown: 0,
      score: 100,
      impactedAssets: 0,
      topReasons: [],
      evidence: [
        { key: "detected", value: "true" },
        { key: "scanner", value: "Tenable" }
      ]
    });
    expect(model?.complianceOverview.measures[1]).toMatchObject({
      label: "SPI 1 - Patch Compliance",
      status: "Non-compliant",
      total: 1,
      compliant: 0,
      nonCompliant: 1,
      unknown: 0,
      score: 0,
      impactedAssets: 1,
      topReasons: ["Patch gap"]
    });
    expect(model?.complianceOverview.measures[1].reasons).toEqual(["Patch gap"]);
    expect(model?.complianceOverview.measures[1].evidence).toEqual([
      { key: "compliantFlag", value: "false" },
      { key: "missingPatches", value: "2" },
      { key: "zNull", value: "N/A" }
    ]);
    expect(model?.complianceOverview.measures[1].openFindings.map((item) => item.id)).toEqual([
      "finding-p1",
      "finding-p2"
    ]);
    expect(model?.complianceOverview.measures[1].openFindings[0]).toMatchObject({
      id: "finding-p1",
      title: "Finding finding-p1",
      severity: "High Risk",
      status: "open",
      recommendedAction: "Remediate finding-p1",
      assetId: "server-1",
      assetName: "Application Server",
      assetType: "Server",
      assetIpAddress: "10.20.30.40",
      assetChangeAssignmentGroup: "Change Team",
      assetIncidentAssignmentGroup: "Incident Team",
      owner: "Application Owner",
      spiId: 1,
      priorityRank: 1,
      timestamp: "2026-07-11T00:00:00.000Z",
      closedTimestamp: null,
      measureLabel: "SPI 1 - Patch Compliance",
      complianceStatus: "Non-compliant",
      evaluationStatus: "Non-compliant",
      scopeLabel: "Asset server-1 | System system-1 | Env Production",
      evidence: [
        { key: "assetOwner", value: "Application Owner" },
        { key: "changeAssignmentGroup", value: "Change Team" },
        { key: "incidentAssignmentGroup", value: "Incident Team" },
        { key: "scanner", value: "Tenable" }
      ]
    });
    expect(model?.complianceOverview.measures[1].findings.map((item) => [item.id, item.status])).toEqual([
      ["finding-p1", "open"],
      ["finding-p2", "open"],
      ["finding-closed", "closed"]
    ]);
    expect(model?.complianceOverview.measures[1].findings[2]).toMatchObject({
      closedTimestamp: "2026-07-16T00:00:00.000Z",
      status: "closed"
    });
    expect(model?.complianceOverview.findings.map((item) => item.id)).toEqual([
      "finding-p1",
      "finding-p2",
      "finding-closed",
      "finding-evidence"
    ]);
    expect(model?.discoveryCompliance).toMatchObject({
      score: 50,
      coverageCompliance: false,
      covered: 1,
      missing: 1,
      notAvailable: 1,
      total: 3
    });
    expect(model?.discoveryCompliance.tools.map((tool) => [tool.id, tool.value, tool.status])).toEqual([
      ["ucmdb", 1, "Covered"],
      ["tanium", 0, "Missing"],
      ["tenable", null, "Not available"]
    ]);
  });

  it("uses N/A display fallbacks, unknown counts, reason evidence, and absent discovery evidence safely", () => {
    const dataset = baseDataset([
      serverAsset({
        id: "server-unmodelled",
        name: "",
        hostname: "",
        ipAddress: "",
        networkId: "unknown-network"
      })
    ]);
    dataset.spiEvaluations = [
      {
        assetId: "server-unmodelled",
        spiId: 99,
        status: "Unknown",
        reasons: ["No source evidence"],
        evidence: {}
      }
    ];

    const model = buildServerComplianceModel({
      dataset,
      assetId: "server-unmodelled",
      spiDefinitions: [spiDefinition(1, "Baseline Control", 1)],
      discoveryToolsSettings: { updatedAt: "2026-07-17T00:00:00.000Z", tools: [discoveryTool("ucmdb", "UCMDB")] }
    });

    expect(model?.asset).toMatchObject({
      name: "server-unmodelled",
      hostname: "server-unmodelled",
      ipAddress: "N/A",
      environmentType: "N/A",
      systemName: "N/A",
      networkName: "unknown-network"
    });
    expect(model?.complianceOverview).toMatchObject({
      score: 0,
      total: 1,
      compliant: 0,
      nonCompliant: 0,
      unknown: 1,
      openFindingCount: 0
    });
    expect(model?.complianceOverview.measures.map((measure) => measure.spiId)).toEqual([1, 99]);
    expect(model?.complianceOverview.measures[0]).toMatchObject({
      spiId: 1,
      label: "SPI 1 - Baseline Control",
      status: "Unknown",
      total: 0,
      compliant: 0,
      nonCompliant: 0,
      unknown: 0,
      score: 0,
      impactedAssets: 0,
      topReasons: [],
      evidence: []
    });
    expect(model?.complianceOverview.measures[1]).toMatchObject({
      spiId: 99,
      label: "SPI 99 - Unmapped SPI",
      total: 1,
      compliant: 0,
      nonCompliant: 0,
      unknown: 1,
      score: 0,
      impactedAssets: 1,
      evidence: [{ key: "reason", value: "No source evidence" }]
    });
    expect(model?.discoveryCompliance).toMatchObject({
      score: 0,
      coverageCompliance: false,
      covered: 0,
      missing: 0,
      notAvailable: 1,
      total: 1
    });
  });

  it("aggregates duplicate SPI evaluation rows without letting display-only SPI definitions change the summary", () => {
    const dataset = baseDataset();
    dataset.spiEvaluations = [
      {
        assetId: "server-1",
        spiId: 7,
        status: "Compliant",
        reasons: [],
        evidence: { source: "one" }
      },
      {
        assetId: "server-1",
        spiId: 7,
        status: "Non-compliant",
        reasons: ["Repeated reason", "Zulu reason"],
        evidence: { source: "two" }
      },
      {
        assetId: "server-1",
        spiId: 7,
        status: "Non-compliant",
        reasons: ["Repeated reason", "Alpha reason"],
        evidence: { source: "three" }
      },
      {
        assetId: "server-1",
        spiId: 7,
        status: "Unknown",
        reasons: ["Unknown source"],
        evidence: {}
      }
    ];

    const model = buildServerComplianceModel({
      dataset,
      assetId: "server-1",
      spiDefinitions: [spiDefinition(8, "No evaluation", 1), spiDefinition(7, "Aggregated SPI", 2)],
      discoveryToolsSettings: discoverySettings()
    });

    expect(model?.complianceOverview).toMatchObject({
      score: 25,
      total: 4,
      compliant: 1,
      nonCompliant: 2,
      unknown: 1
    });
    expect(model?.complianceOverview.measures.map((measure) => measure.spiId)).toEqual([8, 7]);
    expect(model?.complianceOverview.measures[0]).toMatchObject({ total: 0, score: 0, impactedAssets: 0 });
    expect(model?.complianceOverview.measures[1]).toMatchObject({
      status: "Non-compliant",
      total: 4,
      compliant: 1,
      nonCompliant: 2,
      unknown: 1,
      score: 25,
      impactedAssets: 1,
      topReasons: ["Repeated reason", "Alpha reason", "Zulu reason"]
    });
    expect(model?.complianceOverview.measures[1].evidence).toEqual([
      { key: "source", value: "one" },
      { key: "source", value: "three" },
      { key: "source", value: "two" }
    ]);
  });

  it.each(ASSET_TYPES)("builds the same compliance contract and asset-scoped discovery tools for %s assets", (assetType) => {
    const asset = canonicalAsset(assetType);
    const dataset = baseDataset([asset]);
    dataset.managedNetworks[0].assetIds = [asset.id];
    for (const ictSystem of dataset.ictSystems) {
      for (const environment of ictSystem.environments) {
        environment.assetIds = [asset.id];
      }
    }
    dataset.spiEvaluations = [
      {
        assetId: asset.id,
        spiId: 1,
        status: "Compliant",
        reasons: [],
        evidence: { source: "canonical-asset-test" }
      }
    ];
    dataset.findings = [
      finding(`${assetType}-finding`, 1, {
        complianceStatus: "Compliant",
        scope: {
          networkId: "network-1",
          systemId: "system-1",
          environmentType: "Production",
          assetId: asset.id
        }
      })
    ];
    const tools = ASSET_TYPES.map((toolAssetType) =>
      discoveryTool(`${toolAssetType}-tool`, `${assetTypeLabel(toolAssetType)} Tool`, [toolAssetType])
    );
    dataset.discoveryCoverageEvaluations = [
      {
        assetId: asset.id,
        toolValues: Object.fromEntries(tools.map((tool) => [tool.id, 1])) as Record<string, 1>,
        missingToolIds: [],
        missingToolNames: [],
        coverageCompliance: true
      }
    ];
    const options = {
      dataset,
      assetId: asset.id,
      spiDefinitions: [spiDefinition(1, "Canonical asset compliance", 1)],
      discoveryToolsSettings: { updatedAt: "2026-07-17T00:00:00.000Z", tools }
    };

    const model = buildAssetComplianceModel(options);

    expect(model?.asset).toMatchObject({
      id: asset.id,
      assetType,
      assetTypeLabel: assetTypeLabel(assetType)
    });
    expect(model?.complianceOverview).toMatchObject({ score: 100, total: 1, compliant: 1 });
    expect(model?.complianceOverview.findings[0]).toMatchObject({
      assetId: asset.id,
      assetType: assetTypeLabel(assetType)
    });
    expect(model?.discoveryCompliance).toMatchObject({
      score: 100,
      covered: 1,
      missing: 0,
      notAvailable: 0,
      total: 1,
      coverageCompliance: true
    });
    expect(model?.discoveryCompliance.tools.map((tool) => tool.id)).toEqual([`${assetType}-tool`]);
    expect(buildServerComplianceModel(options)).toEqual(model);
  });

  it("returns null only when the requested asset is missing", () => {
    const dataset = baseDataset([workstationAsset()]);
    const options = {
      dataset,
      spiDefinitions: [],
      discoveryToolsSettings: discoverySettings()
    };

    expect(buildServerComplianceModel({ ...options, assetId: "missing" })).toBeNull();
    expect(buildAssetComplianceModel({ ...options, assetId: "missing" })).toBeNull();
    expect(buildAssetComplianceModel({ ...options, assetId: "workstation-1" })).not.toBeNull();
  });
});
