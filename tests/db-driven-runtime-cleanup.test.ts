import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function repoPath(relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(repoPath(relativePath), "utf8");
}

function walkSourceFiles(relativePath: string): string[] {
  const absolutePath = repoPath(relativePath);
  if (!fs.existsSync(absolutePath)) {
    return [];
  }

  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const entryRelativePath = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      return walkSourceFiles(entryRelativePath);
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) {
      return [];
    }
    return [entryRelativePath];
  });
}

describe("DB-driven SPI and findings runtime cleanup", () => {
  it("removes legacy TypeScript SPI and findings runtime modules", () => {
    for (const relativePath of ["lib/findings.ts", "lib/finding-status.ts", "lib/spi-rules.ts"]) {
      expect(fs.existsSync(repoPath(relativePath)), relativePath).toBe(false);
    }
  });

  it("does not reference removed SPI and findings runtime helpers", () => {
    const currentTestPath = path.join("tests", "db-driven-runtime-cleanup.test.ts");
    const sourceFiles = ["app", "components", "lib", "tests"]
      .flatMap(walkSourceFiles)
      .filter((relativePath) => relativePath !== currentTestPath);

    const legacyPatterns = [
      /["']@\/lib\/findings["']/,
      /["']@\/lib\/finding-status["']/,
      /["']@\/lib\/spi-rules["']/,
      /\bbuildFindings\s*\(/,
      /\bworkflowStatusAtAsOf\s*\(/,
      /\bevaluateAssetSpis\s*\(/,
      /\bhasProductionCriticalVulnerability\s*\(/
    ];

    for (const relativePath of sourceFiles) {
      const source = readRepoFile(relativePath);
      for (const pattern of legacyPatterns) {
        expect(source, `${relativePath} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("keeps SPI evaluations and effective findings on SQL-backed loader paths", () => {
    const dataLoader = readRepoFile("lib/data-loader.ts");
    const analytics = readRepoFile("lib/analytics.ts");

    expect(dataLoader).toContain("usp_evaluate_spi_snapshot");
    expect(dataLoader).toContain("usp_get_effective_findings_snapshot");
    expect(analytics).toContain("dataset.findings ?? []");
    expect(analytics).not.toContain("buildFindings");
  });

  it("uses database-produced workflow status in the compliance overview panel", () => {
    const source = readRepoFile("components/network-compliance-overview.tsx");

    expect(source).toContain("finding.workflowStatus === \"open\"");
    expect(source).toContain("asOfStatus: finding.workflowStatus");
    expect(source).not.toContain("workflowStatusAtAsOf");
  });
});
