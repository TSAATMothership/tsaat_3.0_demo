import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { countSevereOpenFindingsOlderThan } from "../lib/cyber-cop-action-plan";
import type { Finding } from "../lib/types";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Cyber COP action plan summary", () => {
  it("removes the Action tab from the workspace", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const navigation = readRepoFile("lib/workspace-navigation.ts");
    expect(dashboard).not.toContain('activeTab === "action"');
    expect(dashboard).not.toContain('aria-label="Cyber COP action plan tabs"');
    expect(navigation).not.toContain('label: "Action"');
  });

  it("uses plan-specific recommended actions and removes the oldest-findings table", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const page = readRepoFile("app/cyber-cop/page.tsx");

    expect(dashboard).toContain("Enable discovery on managed networks currently marked Discovery Non Enabled.");
    expect(dashboard).toContain("Remediate discovery-tool coverage gaps on discovery-enabled networks.");
    expect(dashboard).toContain("Define and load target-state inventories for networks with no target state.");
    expect(dashboard).toContain("Complete TSAAT models for DIIS-defined ICT systems that are not modelled.");
    expect(dashboard).toContain("Remediate discovery coverage gaps for modelled DIIS ICT systems.");
    expect(dashboard).toContain(">Why This Helps</th>");
    expect(dashboard).toContain(">Items</th>");
    expect(dashboard).toContain(">Priority</th>");
    expect(dashboard).not.toContain("Oldest Open Findings");
    expect(dashboard).not.toContain("OldestOpenFindingsTable");
    expect(dashboard).not.toContain("actionOldestOpenFindings");
    expect(page).not.toContain("buildActionOldestOpenFindings");
    expect(page).not.toContain("actionOldestOpenFindings");
  });

  it("removes throughput and aging charts from the Cyber COP Action tab", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const page = readRepoFile("app/cyber-cop/page.tsx");

    for (const source of [dashboard, page]) {
      expect(source).not.toContain("Remediation Throughput (Weekly)");
      expect(source).not.toContain("Open Findings Aging Buckets");
      expect(source).not.toContain("Planned Remediation");
      expect(source).not.toContain("Discovery Coverage Gaps");
      expect(source).not.toContain("actionThroughput");
      expect(source).not.toContain("actionAgeBuckets");
      expect(source).not.toContain("buildActionThroughput");
      expect(source).not.toContain("buildActionAgeBuckets");
    }
  });

  it("builds the new scoped action counts in the Cyber COP page", () => {
    const page = readRepoFile("app/cyber-cop/page.tsx");

    expect(page).toContain("buildNetworkTargetStateSummary");
    expect(page).toContain('asset.lifecycle.warrantyStatus === "OutOfWarranty" || asset.lifecycle.eolStatus === "EOL"');
    expect(page).toContain('network.discoveryStatus === "Discovery Non Enabled"');
    expect(page).toContain('network.discoveryStatus === "Discovery Enabled"');
    expect(page).toContain("networksDiscoveryNonCompliant");
    expect(page).toContain("discoveryEnabledNetworksTotal: discoveryEnabledNetworkIds.size");
    expect(page).toContain("networksWithNoTargetState");
    expect(page).toContain('finding.severity === "Critical Exposure"');
    expect(page).toContain('asset.type === "server"');
  });

  it("counts only open Critical and High findings strictly older than 60 whole UTC days", () => {
    const page = readRepoFile("app/cyber-cop/page.tsx");
    const findings: Array<Pick<Finding, "severity" | "status" | "timestamp">> = [
      { severity: "Critical Exposure", status: "open", timestamp: "2026-02-21T20:30:00.000Z" },
      { severity: "High Risk", status: "open", timestamp: "2026-02-22T00:00:00.000Z" },
      { severity: "Major", status: "open", timestamp: "2026-01-01T00:00:00.000Z" },
      { severity: "Critical Exposure", status: "closed", timestamp: "2026-01-01T00:00:00.000Z" },
      { severity: "High Risk", status: "open", timestamp: "invalid" },
      { severity: "Critical Exposure", status: "open", timestamp: "2026-05-01T00:00:00.000Z" }
    ];

    expect(countSevereOpenFindingsOlderThan(findings, "2026-04-23", 60)).toBe(1);
    expect(countSevereOpenFindingsOlderThan(findings, "2026-02-20", 60)).toBe(0);
    expect(page).toContain("countSevereOpenFindingsOlderThan(openFindings, dataset.snapshotDate, 60)");
    expect(page).toContain("criticalHighOpenFindingsOver60Days");
    expect(page).toContain("threatSurfaceQuickWins");
    expect(page).toContain("buildActionQuickWins(openFindings, 10)");
  });
});
