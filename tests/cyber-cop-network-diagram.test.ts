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
    expect(dashboard).toContain("flex min-w-0 shrink-0 flex-col gap-2");
    expect(dashboard).toContain("inline-block whitespace-nowrap text-sm uppercase");
    expect(dashboard).toContain("flex w-full min-w-0 flex-nowrap");
    expect(dashboard).toContain("overflow-visible");
    expect(dashboard).toContain('title="One line per open server finding across ICT system, environment, server, severity, and SPI."');
    expect(dashboard).toContain("ICT System");
    expect(dashboard).toContain("Finding Severity");
    expect(dashboard).toContain("selectedEnvironment");
    expect(dashboard).toContain("selectedSecurityDomain");
    expect(dashboard).toContain("selectedFindingCriticality");
    expect(dashboard).toContain("networkDiagramSearch");
    expect(dashboard).toContain("isNetworkDiagramSearchFocused");
    expect(dashboard).toContain("networkDiagramSearchInputRef");
    expect(dashboard).toContain("filteredNetworkDiagramSearchOptions");
    expect(dashboard).toContain("selectNetworkDiagramSearchOption");
    expect(dashboard).toContain("Findings Criticality");
    expect(dashboard).toContain("Text Search");
    expect(dashboard).toContain('id="network-diagram-search"');
    expect(dashboard).toContain("top-[calc(100%+0.25rem)]");
    expect(dashboard).toContain("row.severity !== selectedFindingCriticality");
    expect(dashboard).toContain("const haystack = [");
    expect(dashboard).toContain("row.systemName");
    expect(dashboard).toContain("row.serverName");
    expect(dashboard).toContain("row.spiLabel");
    expect(dashboard).toContain("setNetworkDiagramSearch(\"\")");
    expect(dashboard).toContain("selectedNode");
    expect(dashboard).toContain("selectedSpiDrillThroughId");
    expect(dashboard).toContain("rowsMatchingSelectedNode");
    expect(dashboard).toContain("filteredRowCountBySpiId");
    expect(dashboard).toContain("filteredNetworkDiagramRiskFindings");
    expect(dashboard).toContain("selectNetworkDiagramNode(axis.key, value)");
    expect(dashboard).toContain("openNetworkDiagramSpiDrillThrough");
    expect(dashboard).toContain('selected && axis.key === "spi"');
    expect(dashboard).toContain('aria-label={`Open findings for ${value}`}');
    expect(dashboard).toContain("onClick={() => setSelectedNode(null)}");
    expect(dashboard).toContain("event.stopPropagation()");
    expect(dashboard).toContain('filter id="network-diagram-glow"');
    expect(dashboard).toContain('repeatCount="indefinite"');
    expect(dashboard).toContain("No network diagram findings match the selected filters.");
    expect(dashboard).toContain("overflow-y-auto overflow-x-hidden");
    expect(dashboard).toContain("SPI_NAMES");
    expect(dashboard).toContain("SPI_SUCCESS_MEASURES");
    expect(dashboard).toContain("Success Measure:");
    expect(dashboard).toContain("Total Findings:");
    expect(dashboard).toContain("[networkDiagramSearch, selectedEnvironment, selectedFindingCriticality, selectedSecurityDomain]");

    const selectNodeBlock = dashboard.slice(
      dashboard.indexOf("const selectNetworkDiagramNode"),
      dashboard.indexOf("const openNetworkDiagramSpiDrillThrough")
    );
    expect(selectNodeBlock).not.toContain("setSelectedSpiDrillThroughId");
    expect(selectNodeBlock).toContain("current?.axisKey === axisKey");

    const plusActionBlock = dashboard.slice(
      dashboard.indexOf("const openNetworkDiagramSpiDrillThrough"),
      dashboard.indexOf("const closeNetworkDiagramSpiDrillThrough")
    );
    expect(plusActionBlock).toContain("setSelectedNode({ axisKey: \"spi\", value })");
    expect(plusActionBlock).toContain("setSelectedSpiDrillThroughId(spiId)");
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
    expect(page).toContain("sourceFindingId: finding.id");
    expect(dashboard).toContain("riskFindings={scopedRiskFindings}");
    expect(dashboard).toContain("assetHighRiskCvesByAssetId={assetHighRiskCvesByAssetId}");
    expect(dashboard).toContain("asOfDate={asOfDate}");
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
    const exportedDrillThrough = riskCharts.slice(
      riskCharts.indexOf("export function RiskFindingsDrillThrough"),
      riskCharts.indexOf("export function NetworkDetailRiskCharts")
    );
    expect(exportedDrillThrough).not.toContain("Closed Findings by SPI");
    expect(exportedDrillThrough).toContain("Affected Assets by Type");
    expect(exportedDrillThrough).toContain("const affectedAssetsByTypeRows = useMemo");
    expect(exportedDrillThrough).toContain("for (const finding of filteredFindings)");
    expect(exportedDrillThrough).toContain("const assetKey = finding.assetId");
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
    expect(dashboard).toContain("id: `network-diagram-spi-${selectedSpiDrillThroughId}`");
    expect(dashboard).toContain("lockedSpiId: selectedSpiDrillThroughId");
    expect(dashboard).toContain("exportSlug: `network-diagram-spi-${selectedSpiDrillThroughId}`");
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
