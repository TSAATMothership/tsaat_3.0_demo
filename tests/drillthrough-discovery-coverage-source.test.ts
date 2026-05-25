import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("drill-through discovery coverage wiring", () => {
  it("uses the shared scoped discovery tool model on network and ICT system drill-through pages", () => {
    const networkPage = readRepoFile("app/networks/[networkId]/page.tsx");
    const systemPage = readRepoFile("app/systems/[systemId]/page.tsx");

    for (const source of [networkPage, systemPage]) {
      expect(source).toContain("buildScopedDiscoveryToolCoverage(");
      expect(source).toContain("dataset.discoveryCoverageEvaluations");
      expect(source).toContain("discoveryToolCoverageModel.toolColumns.map");
      expect(source).toContain("discoveryCoverageValueLabel(value)");
    }
    expect(systemPage).toContain("discoveryCoverageExportHref");
    expect(systemPage).toContain("/discovery-coverage-export");
  });

  it("does not keep network tool filters locked to the old hard-coded four-tool set", () => {
    const networkPage = readRepoFile("app/networks/[networkId]/page.tsx");

    expect(networkPage).not.toContain("type DiscoveryToolFilterKey");
    expect(networkPage).not.toContain("isDiscoveryToolFilterKey");
    expect(networkPage).toContain("applicableDiscoveryToolIds.has(requestedDiscoveryToolFilter)");
    expect(networkPage).toContain("row.toolValues[selectedDiscoveryToolFilter] !== 0");
  });

  it("keeps network discovery coverage export aligned with dynamic configured tool columns", () => {
    const exportRoute = readRepoFile("app/api/networks/[networkId]/discovery-coverage-export/route.ts");

    expect(exportRoute).toContain("buildScopedDiscoveryToolCoverage(");
    expect(exportRoute).toContain("dataset.discoveryCoverageEvaluations");
    expect(exportRoute).toContain("discoveryToolCoverageModel.toolColumns.map");
    expect(exportRoute).toContain("discoveryCoverageValueLabel(coverage?.toolValues[tool.id])");
    expect(exportRoute).not.toContain("type DiscoveryToolFilterKey");
  });

  it("keeps ICT system discovery coverage export aligned with dynamic configured tool columns", () => {
    const exportRoute = readRepoFile("app/api/systems/[systemId]/discovery-coverage-export/route.ts");

    expect(exportRoute).toContain("buildScopedDiscoveryToolCoverage(");
    expect(exportRoute).toContain("dataset.discoveryCoverageEvaluations");
    expect(exportRoute).toContain("discoveryToolCoverageModel.toolColumns.map");
    expect(exportRoute).toContain("discoveryCoverageValueLabel(coverage?.toolValues[tool.id])");
    expect(exportRoute).toContain('export const dynamic = "force-dynamic"');
  });
});
