import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("drill-through discovery coverage wiring", () => {
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
