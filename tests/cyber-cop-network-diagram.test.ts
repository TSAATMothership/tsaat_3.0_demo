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
