import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function repoPath(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}

function readRepoFile(relativePath: string): string {
  return readFileSync(repoPath(relativePath), "utf8");
}

describe("network and ICT system action tab removal", () => {

  it("redirects retired posture pages to risk profiles without rendering action panels", () => {
    const networkPage = readRepoFile("app/networks/page.tsx");
    const systemPage = readRepoFile("app/systems/page.tsx");

    expect(networkPage).toContain('redirect(postureReplacementHref("/networks", searchParams))');
    expect(systemPage).toContain('redirect(postureReplacementHref("/systems", searchParams))');

    for (const source of [networkPage, systemPage]) {
      expect(source).not.toContain('activeTab === "action"');
      expect(source).not.toContain("Performance Report");
      expect(source).not.toContain("actionPerformanceModel");
      expect(source).not.toContain("buildActionThroughput");
      expect(source).not.toContain("buildActionAgeBuckets");
      expect(source).not.toContain("buildActionOldestOpenFindings");
      expect(source).not.toContain("buildActionQuickWins");
    }

    expect(networkPage).not.toContain("NetworksActionPanel");
    expect(systemPage).not.toContain("SystemsActionPanel");
  });

  it("removes dead action dashboard and panel wrappers without removing report APIs", () => {
    const networkRoute = readRepoFile("app/api/networks/performance-report/route.ts");
    const systemRoute = readRepoFile("app/api/systems/performance-report/route.ts");

    expect(existsSync(repoPath("components/performance-action-dashboard.tsx"))).toBe(false);

    for (const file of ["components/networks-cop-panels.tsx", "components/systems-cop-panels.tsx"]) {
      expect(existsSync(repoPath(file))).toBe(false);
    }

    expect(networkRoute).toContain('export const dynamic = "force-dynamic"');
    expect(systemRoute).toContain('export const dynamic = "force-dynamic"');
    expect(networkRoute).toContain("tsaat-network-performance-report-");
    expect(systemRoute).toContain("tsaat-ict-systems-performance-report-");
    expect(networkRoute).toContain("buildNetworkPerformanceReportModel");
    expect(systemRoute).toContain("buildSystemPerformanceReportModel");
  });
});
