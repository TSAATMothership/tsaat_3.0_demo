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
  it("removes the Action tab from the top-level Networks and ICT Systems tab bars", () => {
    const networkTabs = readRepoFile("components/networks-tabs.tsx");
    const systemTabs = readRepoFile("components/systems-tabs.tsx");

    expect(networkTabs).toContain('type NetworksTabId = "overview" | "posture"');
    expect(systemTabs).toContain('type SystemsTabId = "overview" | "posture"');
    expect(networkTabs).not.toContain('{ id: "action", label: "Action" }');
    expect(systemTabs).not.toContain('{ id: "action", label: "Action" }');
    expect(networkTabs).not.toContain('pendingTab === "action"');
    expect(systemTabs).not.toContain('pendingTab === "action"');
  });

  it("falls old action-tab query params back to Overview and removes action panel rendering", () => {
    const networkPage = readRepoFile("app/networks/page.tsx");
    const systemPage = readRepoFile("app/systems/page.tsx");

    expect(networkPage).toContain('const activeTab: "overview" | "posture" = requestedTab === "posture" ? "posture" : "overview"');
    expect(systemPage).toContain('const activeTab: "overview" | "posture" = requestedTab === "posture" ? "posture" : "overview"');

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
    const networkPanels = readRepoFile("components/networks-cop-panels.tsx");
    const systemPanels = readRepoFile("components/systems-cop-panels.tsx");
    const networkRoute = readRepoFile("app/api/networks/performance-report/route.ts");
    const systemRoute = readRepoFile("app/api/systems/performance-report/route.ts");

    expect(existsSync(repoPath("components/performance-action-dashboard.tsx"))).toBe(false);

    for (const source of [networkPanels, systemPanels]) {
      expect(source).not.toContain("PerformanceActionDashboard");
      expect(source).not.toContain("ActionPanel");
      expect(source).not.toContain("ActionThroughputPoint");
      expect(source).not.toContain("RemediationThroughputChart");
      expect(source).not.toContain("FindingAgingBucketsChart");
      expect(source).not.toContain("OldestOpenFindingsTable");
      expect(source).not.toContain("ActionQuickWinsTable");
      expect(source).not.toContain("Action Plan Summary");
    }

    expect(networkRoute).toContain('export const dynamic = "force-dynamic"');
    expect(systemRoute).toContain('export const dynamic = "force-dynamic"');
    expect(networkRoute).toContain("tsaat-network-performance-report-");
    expect(systemRoute).toContain("tsaat-ict-systems-performance-report-");
    expect(networkRoute).toContain("buildNetworkPerformanceReportModel");
    expect(systemRoute).toContain("buildSystemPerformanceReportModel");
  });
});
