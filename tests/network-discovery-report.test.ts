import { describe, expect, it } from "vitest";
import { createAssetTypeRecord } from "@/lib/asset-taxonomy";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { UNASSIGNED_NETWORK_ID } from "@/lib/discovery-filter-scope";
import {
  buildNetworkDiscoveryReportModel,
  formatNetworkDiscoveryFilterScope
} from "@/lib/network-discovery-report-model";
import {
  buildNetworkDiscoveryReportHref,
  NETWORK_DISCOVERY_REPORT_CONTENT_TYPE,
  networkDiscoveryReportDataDateFromSearchParams,
  networkDiscoveryReportFilename
} from "@/lib/network-discovery-report-links";
import type { Asset, Dataset, ManagedNetwork, Vulnerability } from "@/lib/types";
import { testMeasuresSettings, testSpiDefinitions } from "./spi-definition-fixtures";

const timestamp = "2026-04-23T00:00:00.000Z";

function vulnerability(assetId: string): Vulnerability {
  return {
    id: `finding-${assetId}`,
    assetId,
    cve: "CVE-2026-0001",
    description: "Fixture vulnerability",
    remediationGuidance: "Patch fixture asset",
    criticality: "Low",
    severity: "Low",
    exploitability: "No Known Exploit",
    detectedDate: "2026-04-01",
    capturedAt: timestamp,
    source: "Nessus"
  };
}

function createDataset(): Dataset {
  const alphaTargets = createAssetTypeRecord(() => [] as string[]);
  alphaTargets.server = ["Alpha Server 01"];
  alphaTargets["printer-device"] = ["Alpha Printer 01"];

  const networks: ManagedNetwork[] = [
    {
      id: "net-alpha",
      name: "Alpha Network",
      criticality: "Critical",
      adfPlatform: true,
      enterprisePlatform: false,
      modellingStatus: true,
      classification: "Secret",
      description: "Primary alpha mission network.",
      owner: "Alpha Operations",
      diisId: "DIIS-NET-001",
      atoNumber: "ATO-NET-001",
      discoveryStatus: "Discovery Enabled",
      ictSystemIds: ["sys-alpha"],
      assetIds: ["asset-alpha-server", "asset-alpha-printer"],
      targetStateAssets: alphaTargets
    },
    {
      id: "net-beta",
      name: "Beta Network",
      criticality: "Non-Critical",
      adfPlatform: false,
      enterprisePlatform: false,
      modellingStatus: false,
      discoveryStatus: "Discovery Non Enabled",
      ictSystemIds: [],
      assetIds: ["asset-beta-server"]
    }
  ];

  const assets: Asset[] = [
    {
      id: "asset-alpha-server",
      name: "Alpha Server 01",
      hostname: "alpha-srv-01",
      type: "server",
      networkId: "net-alpha",
      securityDomain: "Secret",
      lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
      vulnerabilities: [vulnerability("asset-alpha-server")],
      systemContext: { systemId: "sys-alpha", environmentType: "Production" },
      operatingSystem: null,
      installedSoftware: []
    },
    {
      id: "asset-alpha-printer",
      name: "Alpha Printer 01",
      hostname: "alpha-prn-01",
      type: "printer-device",
      networkId: "net-alpha",
      securityDomain: "Secret",
      lifecycle: { eolStatus: "Unknown", warrantyStatus: "Unknown" },
      vulnerabilities: []
    },
    {
      id: "asset-beta-server",
      name: "Beta Server 01",
      hostname: "beta-srv-01",
      type: "server",
      networkId: "net-beta",
      securityDomain: "Protected",
      lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
      vulnerabilities: [vulnerability("asset-beta-server")],
      systemContext: { systemId: "sys-beta", environmentType: "Production" },
      operatingSystem: null,
      installedSoftware: []
    }
  ];

  return {
    generatedAt: timestamp,
    snapshotDate: "2026-04-23",
    managedNetworks: networks,
    ictSystems: [
      {
        id: "sys-alpha",
        name: "Alpha ICT System",
        adfPlatform: true,
        enterprisePlatform: false,
        modellingStatus: true,
        diisDefined: true,
        networkId: "net-alpha",
        criticality: "Critical",
        securityDomain: "Secret",
        missionCapabilities: [],
        businessServices: [],
        environments: []
      },
      {
        id: "sys-beta",
        name: "Beta ICT System",
        adfPlatform: false,
        enterprisePlatform: false,
        modellingStatus: true,
        diisDefined: true,
        networkId: "net-beta",
        criticality: "Non-Critical",
        securityDomain: "Protected",
        missionCapabilities: [],
        businessServices: [],
        environments: []
      }
    ],
    assets,
    findings: []
  };
}

const discoveryToolsSettings = {
  ...defaultDiscoveryToolsSettings(),
  tools: defaultDiscoveryToolsSettings().tools.filter((tool) => ["ucmdb", "tenable"].includes(tool.id))
};

describe("network discovery report links", () => {
  it("preserves query scope while overriding the selected network", () => {
    const href = buildNetworkDiscoveryReportHref({
      networkId: "net-alpha",
      searchParams: new URLSearchParams(
        "network=net-beta&dataDate=2026-04-23&assetType=server&severity=High+Risk&discoveryCoverageTab=coverage-by-network"
      )
    });
    const url = new URL(href, "http://localhost");

    expect(url.pathname).toBe("/api/discovery-coverage/network-report");
    expect(url.searchParams.get("network")).toBe("net-alpha");
    expect(url.searchParams.get("dataDate")).toBe("2026-04-23");
    expect(url.searchParams.get("assetType")).toBe("server");
    expect(url.searchParams.get("severity")).toBe("High Risk");
    expect(url.searchParams.get("discoveryCoverageTab")).toBe("coverage-by-network");
  });

  it("normalizes report response metadata", () => {
    expect(networkDiscoveryReportDataDateFromSearchParams(new URLSearchParams("dataDate=2026-04-23"))).toBe(
      "2026-04-23"
    );
    expect(networkDiscoveryReportDataDateFromSearchParams(new URLSearchParams("dataDate=23-04-2026"))).toBeUndefined();
    expect(networkDiscoveryReportFilename("Net Alpha", "2026-04-23")).toBe(
      "tsaat-network-discovery-report-net-alpha-2026-04-23.pdf"
    );
    expect(NETWORK_DISCOVERY_REPORT_CONTENT_TYPE).toBe("application/pdf");
  });
});

describe("network discovery report model", () => {
  it("forces the selected tile network while retaining other active filters", () => {
    const model = buildNetworkDiscoveryReportModel({
      dataset: createDataset(),
      discoveryToolsSettings,
      measuresSettings: testMeasuresSettings,
      spiDefinitions: testSpiDefinitions,
      networkId: "net-alpha",
      filters: {
        managedNetwork: "net-beta",
        assetType: "server"
      }
    });

    expect(model?.filterText).toBe(
      formatNetworkDiscoveryFilterScope({
        managedNetwork: "net-alpha",
        assetType: "server"
      })
    );
    expect(model?.summary.assetsInScope).toBe(1);
    expect(model?.discoveredAssets.map((asset) => asset.assetId)).toEqual(["asset-alpha-server"]);
  });

  it("builds network metadata, coverage, target-state, and annex rows", () => {
    const model = buildNetworkDiscoveryReportModel({
      dataset: createDataset(),
      discoveryToolsSettings,
      measuresSettings: testMeasuresSettings,
      spiDefinitions: testSpiDefinitions,
      networkId: "net-alpha"
    });

    expect(model?.network).toMatchObject({
      name: "Alpha Network",
      atoNumber: "ATO-NET-001",
      diisId: "DIIS-NET-001",
      modellingStatus: "Modelled"
    });
    expect(model?.summary).toMatchObject({
      assetsInScope: 2,
      coverageCompliantAssets: 1,
      assetsWithCoverageGaps: 1,
      overallToolCoveragePercent: 50
    });
    expect(model?.toolCoverageRows).toEqual([
      { toolId: "ucmdb", toolName: "UCMDB", covered: 1, missing: 1, applicable: 2, coveragePercent: 50 },
      { toolId: "tenable", toolName: "Tenable", covered: 1, missing: 1, applicable: 2, coveragePercent: 50 }
    ]);
    expect(model?.targetStateRows.find((row) => row.assetType === "server")).toMatchObject({
      targetTotal: 1,
      discoveredTotal: 1,
      matchedTotal: 1,
      coveragePercent: 100
    });
    expect(model?.discoveredAssets.map((asset) => asset.assetId)).toEqual([
      "asset-alpha-printer",
      "asset-alpha-server"
    ]);
    expect(model?.assetsNotDiscovered.map((asset) => ({ assetId: asset.assetId, missingTools: asset.missingTools }))).toEqual([
      { assetId: "asset-alpha-printer", missingTools: ["Tenable", "UCMDB"] }
    ]);
  });

  it("returns null when the network is not present in the selected snapshot", () => {
    const model = buildNetworkDiscoveryReportModel({
      dataset: createDataset(),
      discoveryToolsSettings,
      measuresSettings: testMeasuresSettings,
      spiDefinitions: testSpiDefinitions,
      networkId: "net-missing"
    });

    expect(model).toBeNull();
  });

  it("does not generate reports for the synthetic Unassigned Systems bucket", () => {
    const dataset = createDataset();
    dataset.managedNetworks.push({
      id: UNASSIGNED_NETWORK_ID,
      name: "Unassigned Systems",
      criticality: "Non-Critical",
      adfPlatform: false,
      enterprisePlatform: false,
      modellingStatus: false,
      discoveryStatus: "Discovery Non Enabled",
      ictSystemIds: [],
      assetIds: []
    });

    const model = buildNetworkDiscoveryReportModel({
      dataset,
      discoveryToolsSettings,
      measuresSettings: testMeasuresSettings,
      spiDefinitions: testSpiDefinitions,
      networkId: UNASSIGNED_NETWORK_ID
    });

    expect(model).toBeNull();
  });
});
