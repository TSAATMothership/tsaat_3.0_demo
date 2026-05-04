import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Measures SPI heatmap tabs", () => {
  it("wires the Network and ICT System SPI heatmaps into the Measures page", () => {
    const measuresPage = readRepoFile("app/measures/page.tsx");

    expect(measuresPage).toContain("MeasuresSpiHeatmapSection");
    expect(measuresPage).toContain("MeasuresSpiFilters");
    expect(measuresPage).toContain("buildNetworkPerformanceReportModel");
    expect(measuresPage).toContain("buildSystemPerformanceReportModel");
    expect(measuresPage).toContain('activeTab === "networks-spi-heatmap"');
    expect(measuresPage).toContain('activeTab === "systems-spi-heatmap"');
    expect(measuresPage).toContain('omitSearchParams(searchParams, ["system", "criticality", "environment"])');
    expect(measuresPage).toContain('omitSearchParams(searchParams, ["network"])');
  });

  it("adds SPI and text search controls for Measures SPI views", () => {
    const filters = readRepoFile("components/measures-spi-filters.tsx");
    const matrix = readRepoFile("components/kpi-spi-matrix.tsx");

    expect(filters).toContain("SPI Filter");
    expect(filters).toContain("Text Search");
    expect(filters).toContain("SPI_NAMES");
    expect(filters).toContain("SPI_DESCRIPTIONS");
    expect(filters).toContain("selectedSpiDetails");
    expect(filters).toContain("dynamicSearch");
    expect(filters).toContain("onSearchValueChange");
    expect(filters).toContain("Filters rows as you type");
    expect(filters).toContain('!dynamicSearch ? (');
    expect(filters).toContain("SPI {spiId} - {SPI_NAMES[spiId]}: {SPI_DESCRIPTIONS[spiId]}");
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
    expect(heatmapSection).toContain("dynamicSearch");
    expect(heatmapSection).toContain("onSearchValueChange={setSearchValue}");
    expect(heatmap).toContain("model.spiMatrixRows");
    expect(heatmap).toContain("SPI Heatmap Drill-Through");
    expect(heatmap).not.toContain(">Applicable<");
    expect(heatmap).toContain("onOpenAffectedCis");
    expect(heatmap).toContain("setAffectedCisPanel");
    expect(heatmap).toContain("Affected CIs");
    expect(heatmap).toContain("CVE Details");
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
