import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("SPI heatmap tabs", () => {
  it("wires the Network and ICT System SPI heatmaps into the Cyber COP page", () => {
    const cyberCopPage = readRepoFile("app/cyber-cop/page.tsx");
    const cyberCopDashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const measuresPage = readRepoFile("app/measures/page.tsx");

    expect(cyberCopDashboard).toContain('{ id: "networks-spi-heatmap", label: "Networks - SPI Heatmap" }');
    expect(cyberCopDashboard).toContain('{ id: "systems-spi-heatmap", label: "ICT System - SPI Heatmap" }');
    expect(cyberCopDashboard).toContain('activeTab === "networks-spi-heatmap"');
    expect(cyberCopDashboard).toContain('activeTab === "systems-spi-heatmap"');
    expect(cyberCopDashboard).toContain("MeasuresSpiHeatmapSection");
    expect(cyberCopDashboard).toContain("localSpiFilter");
    expect(cyberCopPage).toContain("buildNetworkPerformanceReportModel");
    expect(cyberCopPage).toContain("buildSystemPerformanceReportModel");
    expect(cyberCopPage).toContain('omitSearchParams(searchParams, ["system", "criticality", "environment"])');
    expect(cyberCopPage).toContain('omitSearchParams(searchParams, ["network"])');
    expect(cyberCopPage).toContain("networkSpiHeatmapFilterSlot");
    expect(cyberCopPage).toContain("systemSpiHeatmapFilterSlot");
    expect(measuresPage).not.toContain('activeTab === "networks-spi-heatmap"');
    expect(measuresPage).not.toContain('activeTab === "systems-spi-heatmap"');
  });

  it("adds SPI and text search controls for Measures SPI views", () => {
    const filters = readRepoFile("components/measures-spi-filters.tsx");
    const matrix = readRepoFile("components/kpi-spi-matrix.tsx");

    expect(filters).toContain("SPI Filter");
    expect(filters).toContain("Text Search");
    expect(filters).toContain("spiDefinitions.map");
    expect(filters).toContain("definition.name");
    expect(filters).toContain("definition.description");
    expect(filters).toContain("selectedSpiDetails");
    expect(filters).toContain("dynamicSearch");
    expect(filters).toContain("localSpiFilter");
    expect(filters).toContain("onSelectedSpiIdChange");
    expect(filters).toContain("onSearchValueChange");
    expect(filters).toContain("Filters rows as you type");
    expect(filters).toContain('!dynamicSearch ? (');
    expect(filters).toContain("SPI {definition.spiId} - {definition.name}: {definition.description}");
    expect(filters).toContain('params.set("spi", value)');
    expect(filters).toContain('params.set("measureSearch", trimmedSearch)');
    expect(matrix).toContain("selectedSpiId");
    expect(matrix).toContain("searchValue");
    expect(matrix).toContain("report.successMeasure");
    expect(matrix).toContain("No SPI reports match the current SPI and text search filters.");
  });

  it("renders the new SPI heatmap from shared SPI matrix rows", () => {
    const heatmap = readRepoFile("components/measures-spi-heatmap.tsx");
    const heatmapSection = readRepoFile("components/measures-spi-heatmap-section.tsx");
    const model = readRepoFile("lib/performance-report-model.ts");

    expect(model).toContain("PerformanceSpiMatrixRow");
    expect(model).toContain("PerformanceAffectedCiRow");
    expect(model).toContain("PerformanceEntityDetails");
    expect(model).toContain("spiMatrixRows");
    expect(model).toContain("affectedCis: buildAffectedCiRows");
    expect(model).toContain("entityDetails:");
    expect(heatmapSection).toContain("useState(initialSearchValue)");
    expect(heatmapSection).toContain("localSelectedSpiId");
    expect(heatmapSection).toContain("dynamicSearch");
    expect(heatmapSection).toContain("localSpiFilter={localSpiFilter}");
    expect(heatmapSection).toContain("onSearchValueChange={setSearchValue}");
    expect(heatmap).toContain("model.spiMatrixRows");
    expect(heatmap).toContain("SPI Heatmap Drill-Through");
    expect(heatmap).not.toContain(">Applicable<");
    expect(heatmap).toContain("onOpenAffectedCis");
    expect(heatmap).toContain("setAffectedCisPanel");
    expect(heatmap).toContain("Affected CIs");
    expect(heatmap).toContain("CVE Details");
    expect(heatmap).toContain('className="min-w-[111rem] table-fixed text-sm"');
    expect(heatmap).toContain('<col className="w-[20rem]" />');
    expect(heatmap).toContain("whitespace-nowrap px-3 py-2");
    expect(heatmap).toContain("assetChangeAssignmentGroup");
    expect(heatmap).toContain("assetIncidentAssignmentGroup");
    expect(heatmap).toContain("totalCveVulnerabilities");
    expect(heatmap).toContain("setSelectedEntityDetails(row.entityDetails)");
    expect(heatmap).toContain("Network Details");
    expect(heatmap).toContain("ICT System Details");
    expect(heatmap).toContain("Export to CSV");
    expect(heatmap).toContain("Export CSV");
    expect(heatmap).toContain('title={`${spi.label}: ${spi.name} - ${spi.description}`}');
    expect(heatmap).toContain("overflow-y-auto overflow-x-hidden");
    expect(heatmap).toContain("No domain/entity rows match the current SPI heatmap filters.");
  });
});
