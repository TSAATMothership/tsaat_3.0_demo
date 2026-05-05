import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Cyber COP network diagram impact tab", () => {
  it("registers the Network Diagram tab and chart filters", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");

    expect(dashboard).toContain('"network-diagram"');
    expect(dashboard).toContain('{ id: "network-diagram", label: "Network Diagram" }');
    expect(dashboard).toContain("CyberCopNetworkDiagramRow");
    expect(dashboard).toContain("function NetworkDiagramChart");
    expect(dashboard).toContain("Parallel coordinates for open server findings");
    expect(dashboard).toContain("ICT System");
    expect(dashboard).toContain("Finding Severity");
    expect(dashboard).toContain("selectedEnvironment");
    expect(dashboard).toContain("selectedSecurityDomain");
    expect(dashboard).toContain("selectedNode");
    expect(dashboard).toContain("rowsMatchingSelectedNode");
    expect(dashboard).toContain("onClick={() => setSelectedNode(null)}");
    expect(dashboard).toContain("event.stopPropagation()");
    expect(dashboard).toContain('filter id="network-diagram-glow"');
    expect(dashboard).toContain('repeatCount="indefinite"');
    expect(dashboard).toContain("No network diagram findings match the selected filters.");
    expect(dashboard).toContain("overflow-y-auto overflow-x-hidden");
    expect(dashboard).toContain("SPI_SUCCESS_MEASURES");
    expect(dashboard).toContain("Success Measure:");
  });

  it("builds network diagram rows from open server findings and passes them to Cyber COP", () => {
    const page = readRepoFile("app/cyber-cop/page.tsx");
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");

    expect(page).toContain("type CyberCopNetworkDiagramRow");
    expect(page).toContain("function buildNetworkDiagramRows");
    expect(page).toContain('finding.status !== "open"');
    expect(page).toContain('asset.type !== "server"');
    expect(page).toContain("environmentType:");
    expect(page).toContain("securityDomain: asset.securityDomain");
    expect(page).toContain("severity: finding.severity");
    expect(page).toContain("spiLabel: `SPI ${finding.spiId}`");
    expect(page).toContain("const impactNetworkDiagramRows = buildNetworkDiagramRows(filteredAssets, openFindings, systems)");
    expect(page).toContain("impactNetworkDiagramRows={impactNetworkDiagramRows}");

    expect(dashboard).toContain("impactNetworkDiagramRows: CyberCopNetworkDiagramRow[]");
    expect(dashboard).toContain("networkDiagramRows={impactNetworkDiagramRows}");
    expect(dashboard).toContain("<NetworkDiagramChart rows={scopedNetworkDiagramRows} embedded />");
  });
});

describe("Cyber COP SPI driver drill-through", () => {
  it("wires the SPI Driver chart to the reusable Risk Profile findings drill-through", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const riskCharts = readRepoFile("components/network-detail-risk-charts.tsx");

    expect(riskCharts).toContain("export function RiskFindingsDrillThrough");
    expect(riskCharts).toContain("RiskFindingsDrillThroughSelection");
    expect(riskCharts).toContain("Affected CIs");
    expect(riskCharts).toContain("High Risk CVE Vulnerabilities");
    expect(riskCharts).toContain("Open Findings Aging Buckets");
    expect(riskCharts).toContain('className="min-w-[134rem] table-fixed text-sm"');
    expect(riskCharts).toContain('<col className="w-[18rem]" />');
    expect(riskCharts).toContain("whitespace-nowrap px-3 py-2");

    expect(dashboard).toContain("RiskFindingsDrillThrough");
    expect(dashboard).toContain("function SpiDriverChart");
    expect(dashboard).toContain("findings: NetworkDetailRiskFindingRow[]");
    expect(dashboard).toContain("allFindings: NetworkDetailRiskFindingRow[]");
    expect(dashboard).toContain("openSpiDrillThrough(row.spiId)");
    expect(dashboard).toContain("selectedSpiId === row.spiId");
    expect(dashboard).toContain("lockedSpiId: selectedSpiId");
    expect(dashboard).toContain("Select an SPI bar to open Findings");
  });

  it("scopes SPI Driver drill-through findings to the active Impact system selection", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const page = readRepoFile("app/cyber-cop/page.tsx");

    expect(dashboard).toContain("const visibleSystemIds = useMemo(() => new Set(systemRows.map((row) => row.id)), [systemRows])");
    expect(dashboard).toContain("const scopedRiskFindings = useMemo");
    expect(dashboard).toContain("visibleSystemIds.has(finding.systemId as string)");
    expect(dashboard).toContain("riskFindings={riskFindings}");
    expect(dashboard).toContain("assetHighRiskCvesByAssetId={assetHighRiskCvesByAssetId}");
    expect(dashboard).toContain("asOfDate={asOfDate}");

    expect(page).toContain("systemId,");
    expect(page).toContain("networkId,");
    expect(page).toContain("environmentType,");
    expect(page).toContain("riskFindings={riskProfileFindings}");
  });
});

describe("Cyber COP overview Risk Profile", () => {
  it("disables the overview Risk Profile drill-through without removing shared drill-through support", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const riskCharts = readRepoFile("components/network-detail-risk-charts.tsx");
    const networkPanels = readRepoFile("components/networks-cop-panels.tsx");
    const systemPanels = readRepoFile("components/systems-cop-panels.tsx");

    expect(riskCharts).toContain("enableFindingsDrillThrough = true");
    expect(riskCharts).toContain("if (!enableFindingsDrillThrough)");
    expect(riskCharts).toContain("enableFindingsDrillThrough && isFindingsPanelVisible && selectedSeverity");
    expect(dashboard).toContain("enableFindingsDrillThrough={false}");
    expect(networkPanels).not.toContain("enableFindingsDrillThrough={false}");
    expect(systemPanels).not.toContain("enableFindingsDrillThrough={false}");
  });
});
