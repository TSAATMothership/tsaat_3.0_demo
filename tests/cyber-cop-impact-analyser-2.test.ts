import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  buildCyberCopImpactAnalyserFindingRows,
  buildCyberCopImpactAnalyserRows,
  buildNetworkImpactAnalyserModelAssetIds,
  buildNetworkImpactAnalyserRows,
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
      networkName: "network-1",
      hasIctSystem: true,
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
    expect(dashboard).toContain("<IctSystemImpactAnalyser2Chart embedded systemScopeIds={systemScopeIds} />");
    expect(dashboard).toContain('selectionMode="multi"');
    expect(dashboard).toContain("selectedItemIds={selectedIctSystemIds}");
    expect(dashboard).toContain("onVisibleItemIdsChange={(itemIds) =>");
    expect(dashboard).toContain("const activeImpactSystemRows = useMemo");
    expect(dashboard).toContain("const activeImpactSystemIds = useMemo");
    expect(dashboard).toContain("systemScopeIds={activeImpactSystemIds}");
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
    expect(dashboard).toContain("systemScopeIds={activeImpactSystemIds}");
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
    expect(findingsRoute).toContain('request.nextUrl.searchParams.get("diagramSystemIds")');
    expect(findingsRoute).toContain("systemIds: diagramSystemIdsParam === null ? null : readCsvParam(diagramSystemIdsParam)");
    expect(component).toContain('dataPath = "/api/cyber-cop/impact-analyser-2"');
    expect(component).toContain('findingsPath = "/api/cyber-cop/impact-analyser-2/findings"');
    expect(component).toContain("fetch(buildApiUrl(dataPath)");
    expect(component).toContain("buildApiUrl(findingsPath");
  });

  it("wires the network detailed topology view to a network-scoped analyser", () => {
    const detailedTopology = readRepoFile("components/detailed-topology-view.tsx");
    const dataRoute = readRepoFile("app/api/networks/[networkId]/impact-analyser/route.ts");
    const findingsRoute = readRepoFile("app/api/networks/[networkId]/impact-analyser/findings/route.ts");

    expect(dataRoute).toContain('export const dynamic = "force-dynamic"');
    expect(dataRoute).toContain("buildNetworkTopologyData");
    expect(dataRoute).toContain("buildNetworkImpactAnalyserModelAssetIds");
    expect(dataRoute).toContain("topologyModelAssetIds: topologyData.modelAssetIds");
    expect(dataRoute).toContain("networkName: network.name");
    expect(dataRoute).toContain("buildNetworkImpactAnalyserRows");
    expect(findingsRoute).toContain('export const dynamic = "force-dynamic"');
    expect(findingsRoute).toContain('request.nextUrl.searchParams.get("diagramAssetType")');
    expect(findingsRoute).toContain("modelAssetIds");
    expect(detailedTopology).toContain("IctSystemImpactAnalyser2Chart");
    expect(detailedTopology).toContain('title="Network Impact Analyser"');
    expect(detailedTopology).toContain("includeNetworkAxis");
    expect(detailedTopology).toContain("assetAxisLabel=\"Assets\"");
    expect(detailedTopology).toContain("assetSearchCategory=\"Assets\"");
    expect(detailedTopology).toContain("showAssetTypeFilter");
    expect(detailedTopology).toContain("showSelectedTileText");
    expect(detailedTopology).toContain("onAssetFocus={openCiFlowFocusForAssetId}");
  });

  it("keeps V2 worker-side filtering and Canvas/WebGL rendering markers", () => {
    const component = readRepoFile("components/ict-system-impact-analyser-2.tsx");
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
    expect(component).toContain("Findings Criticality");
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
    expect(component).toContain("Network: ${selectedAssetMeta.networkName || selectedAssetMeta.networkId}");
    expect(component).toContain("onAssetFocus?: (assetId: string) => void");
    expect(component).toContain('axis.key === "asset"');
    expect(component).toContain('context.fillText("F"');
    expect(component).toContain("Selected Tile Text");
    expect(component).toContain("hasActiveHighlight");
    expect(component).toContain("if (!axis.values.length)");
    expect(component).toContain("selectedSearchOption");
    expect(component).toContain("setSelectedSearchOption(null)");
    expect(component).toContain("setSelectedSearchOption(exactSearchOption)");
    expect(component).toContain('const reconcileDiagramViewport = useCallback((mode: "reset" | "clamp", virtualHeight?: number)');
    expect(component).toContain("resetDiagramViewportForFilterChange");
    expect(component).toContain('reconcileDiagramViewport("clamp", workerResult.virtualHeight)');
    expect(component).toContain("scrollExactSearchNodeIntoView(selectedNode, workerResult)");
    expect(component).toContain("const clearDiagramSearch = () =>");
    expect(component).toContain('reconcileDiagramViewport("reset")');
    expect(component).not.toContain("viewport.scrollTo({ top: 0 })");
    expect(component).toContain("systemScopeIds?: string[]");
    expect(component).toContain("const systemScopeKey = hasSystemScope");
    expect(component).toContain("systemIds: normalizedSystemScopeIds");
    expect(component).toContain("diagramSystemIds: systemScopeKey");
    expect(component).toContain("diagramSearchAxis: selectedSearchOption?.axisKey");
    expect(component).toContain("diagramSearchValue: selectedSearchOption?.value");
    expect(component).toContain("diagramEnvironment: selectedEnvironmentKey");
    expect(component).toContain("diagramSecurityDomain: selectedSecurityDomainKey");
    expect(component).toContain("diagramFindingCriticality: selectedFindingCriticalityKey");
    expect(component).toContain("diagramAssetType: selectedAssetTypeKey");
    expect(component).toContain("exportSlug: `ict-system-impact-analyser-spi-${drillThroughData.selectedSpiId}`");
    expect(component).toContain("viewport.scrollTo");
    expect(worker).toContain("Float32Array");
    expect(worker).toContain("rowMatchesSearch");
    expect(worker).toContain("axisKeyForSearchCategory");
    expect(worker).toContain("filterRows");
    expect(worker).toContain("buildAxes");
    expect(worker).toContain("const normalizedSearch = filters.search.trim().toLowerCase()");
    expect(worker).toContain("const systemIdFilter = filters.systemIds ? new Set(filters.systemIds) : null");
    expect(worker).toContain("if (systemIdFilter && (!row.systemId || !systemIdFilter.has(row.systemId)))");
    expect(worker).toContain("assetType: string");
    expect(worker).toContain("function matchesMultiFilter");
    expect(worker).toContain("environment: string[]");
    expect(worker).toContain("if (!matchesMultiFilter(filters.assetType, row.assetType))");
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
    expect(worker).toContain("rowAxisValue(row, filters.selectedSearchOption.axisKey) === filters.selectedSearchOption.value");
    expect(worker).toContain("if (!rowMatchesSearch(row, normalizedSearch))");
    expect(worker).toContain("rows: filteredRows");
    expect(worker).toContain("rows: selectedRows");
    expect(worker).toContain("searchOptions");
    expect(worker).toContain("highlightPositions");
  });
});
