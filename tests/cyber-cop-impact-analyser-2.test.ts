import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  buildCyberCopImpactAnalyserFindingRows,
  buildCyberCopImpactAnalyserRows,
  filterCyberCopImpactAnalyserRows,
  type CyberCopImpactAnalyserRow
} from "@/lib/cyber-cop-impact-analyser";
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
  networkId: "network-1",
  securityDomain: "Secret",
  lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
  vulnerabilities: [],
  systemContext: { systemId: "system-1", environmentType: "Production" },
  type: "server",
  operatingSystem: null,
  installedSoftware: []
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

describe("Cyber COP ICT System Impact Analyser helpers", () => {
  it("builds compact rows from open server findings with the required axis fields", () => {
    const rows = buildCyberCopImpactAnalyserRows([serverAsset, workstationAsset], findings, systems);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      findingId: "finding-1",
      systemId: "system-1",
      systemName: "Payments",
      environmentType: "Production",
      serverId: "server-1",
      serverName: "PAY-SRV-01",
      serverHostname: "pay-srv-01.example.test",
      securityDomain: "Secret",
      severity: "Critical Exposure",
      spiId: 3,
      spiLabel: "SPI 3"
    });
  });

  it("filters compact rows by local diagram filters and text search", () => {
    const rows = buildCyberCopImpactAnalyserRows([serverAsset, workstationAsset], findings, systems);

    expect(filterCyberCopImpactAnalyserRows(rows, { environment: "Production", spiId: 3 })).toHaveLength(1);
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
  it("keeps the scalable analyser as the only Impact analyser tab", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const page = readRepoFile("app/cyber-cop/page.tsx");

    expect(dashboard).toContain('{ id: "ict-system-impact-analyser-2", label: "ICT System Impact Analyser" }');
    expect(dashboard).toContain("<IctSystemImpactAnalyser2Chart embedded />");
    expect(dashboard).not.toContain('"network-diagram"');
    expect(dashboard).not.toContain("NetworkDiagramChart");
    expect(dashboard).not.toContain("CyberCopNetworkDiagramRow");
    expect(dashboard).not.toContain("impactNetworkDiagramRows");
    expect(page).not.toContain("buildNetworkDiagramRows");
    expect(page).not.toContain("impactNetworkDiagramRows");
  });

  it("uses lazy dynamic API routes for data and selected SPI findings", () => {
    const dataRoute = readRepoFile("app/api/cyber-cop/impact-analyser-2/route.ts");
    const findingsRoute = readRepoFile("app/api/cyber-cop/impact-analyser-2/findings/route.ts");
    const component = readRepoFile("components/ict-system-impact-analyser-2.tsx");

    expect(dataRoute).toContain('export const dynamic = "force-dynamic"');
    expect(dataRoute).toContain("buildCyberCopImpactAnalyserRows");
    expect(findingsRoute).toContain('export const dynamic = "force-dynamic"');
    expect(findingsRoute).toContain("filterCyberCopImpactAnalyserRows");
    expect(findingsRoute).toContain('request.nextUrl.searchParams.get("diagramSearchAxis")');
    expect(findingsRoute).toContain('request.nextUrl.searchParams.get("diagramSearchValue")');
    expect(component).toContain('fetch(buildApiUrl("/api/cyber-cop/impact-analyser-2")');
    expect(component).toContain('buildApiUrl("/api/cyber-cop/impact-analyser-2/findings"');
  });

  it("keeps V2 worker-side filtering and Canvas/WebGL rendering markers", () => {
    const component = readRepoFile("components/ict-system-impact-analyser-2.tsx");
    const worker = readRepoFile("components/ict-system-impact-analyser-2-worker.ts");

    expect(component).toContain("new Worker(new URL");
    expect(component).toContain("new THREE.WebGLRenderer");
    expect(component).toContain("new THREE.OrthographicCamera(0, width, scrollTop, scrollTop + height, -1, 1)");
    expect(component).toContain("overlayCanvasRef");
    expect(component).toContain("RiskFindingsDrillThrough");
    expect(component).toContain("function ImpactAnalyserLoadingOverlay");
    expect(component).toContain("isDiagramInitialLoading");
    expect(component).toContain('title="Loading Diagram"');
    expect(component).toContain('title="Loading Risk Detail"');
    expect(component).toContain("ICT System Impact Analyser Diagram");
    expect(component).not.toContain("ICT System Impact Analyser 2");
    expect(component).toContain("Findings Criticality");
    expect(component).toContain("findingCriticalityFilterOptions");
    expect(component).toContain("Text Search");
    expect(component).toContain("Success Measure:");
    expect(component).toContain("Total Findings:");
    expect(component).toContain("tooltipMaxWidth");
    expect(component).toContain("tooltipLeft");
    expect(component).toContain("tooltipTop");
    expect(component).toContain('placement?: "left" | "default"');
    expect(component).toContain('placement: hit.plusAction ? "left" : "default"');
    expect(component).toContain("hasActiveHighlight");
    expect(component).toContain("selectedSearchOption");
    expect(component).toContain("setSelectedSearchOption(null)");
    expect(component).toContain("setSelectedSearchOption(exactSearchOption)");
    expect(component).toContain("diagramSearchAxis: selectedSearchOption?.axisKey");
    expect(component).toContain("diagramSearchValue: selectedSearchOption?.value");
    expect(component).toContain("exportSlug: `ict-system-impact-analyser-spi-${drillThroughData.selectedSpiId}`");
    expect(component).toContain("viewport.scrollTo");
    expect(worker).toContain("Float32Array");
    expect(worker).toContain("rowMatchesSearch");
    expect(worker).toContain("axisKeyForSearchCategory");
    expect(worker).toContain("filterRows");
    expect(worker).toContain("buildAxes");
    expect(worker).toContain("const normalizedSearch = filters.search.trim().toLowerCase()");
    expect(worker).toContain("filters.selectedSearchOption");
    expect(worker).toContain("rowAxisValue(row, filters.selectedSearchOption.axisKey) === filters.selectedSearchOption.value");
    expect(worker).toContain("if (!rowMatchesSearch(row, normalizedSearch))");
    expect(worker).toContain("rows: filteredRows");
    expect(worker).toContain("rows: selectedRows");
    expect(worker).toContain("searchOptions");
    expect(worker).toContain("highlightPositions");
  });
});
