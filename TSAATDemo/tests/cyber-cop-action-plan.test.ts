import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Cyber COP action plan summary", () => {
  it("places the Action tab at the far right of the Cyber COP tab bar", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    const tabsStart = dashboard.indexOf("const cyberCopTabs");
    const tabsEnd = dashboard.indexOf("];", tabsStart);
    const tabsBlock = dashboard.slice(tabsStart, tabsEnd);

    expect(tabsBlock.indexOf('{ id: "action", label: "Action" }')).toBeGreaterThan(
      tabsBlock.indexOf('{ id: "systems-spi-heatmap", label: "ICT System - SPI Heatmap" }')
    );
  });

  it("renders the grouped action plan matrix sections and requested actions", () => {
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");

    expect(dashboard).toContain("Threat Surface Area Action Plan");
    expect(dashboard).toContain("Discovery Action Plan");
    expect(dashboard).toContain("ICT System Modelling Action Plan");

    expect(dashboard).toContain("Immediate action (critical and High-risk findings)");
    expect(dashboard).toContain("Total Non-Compliant OS");
    expect(dashboard).toContain("Assets out of Warranty/EOL");
    expect(dashboard).toContain("Servers with Critical findings");
    expect(dashboard).toContain("Networks without discovery enabled");
    expect(dashboard).toContain("Networks Discovery non-compliant");
    expect(dashboard).toContain("Networks with no target state");
    expect(dashboard).toContain("DIIS ICT Systems defined");
    expect(dashboard).toContain("ICT Systems not modelled");
    expect(dashboard).toContain("ICT System Modelled and Discovery non-compliant");

    expect(dashboard).toContain("function ActionPlanMatrix");
    expect(dashboard).toContain(">Action</th>");
    expect(dashboard).toContain(">Count</th>");
    expect(dashboard).toContain(">Scope</th>");
    expect(dashboard).toContain(">Rate</th>");
    expect(dashboard).toContain(">Status</th>");
    expect(dashboard).toContain("table-fixed");
    expect(dashboard).toContain("min-[1900px]:grid-cols");
    expect(dashboard).not.toContain("function ActionPlanSummaryTile");
    expect(dashboard).not.toContain("function ActionPlanSection");
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
    expect(page).toContain("networksWithNoTargetState");
    expect(page).toContain('finding.severity === "Critical Exposure"');
    expect(page).toContain('asset.type === "server"');
  });

  it("limits Oldest Open Findings to critical exposure and high risk findings", () => {
    const page = readRepoFile("app/cyber-cop/page.tsx");
    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");

    expect(page).toContain(
      '.filter((finding) => finding.severity === "Critical Exposure" || finding.severity === "High Risk")'
    );
    expect(dashboard).toContain("Longest-running open Critical Exposure and High Risk findings");
    expect(dashboard).toContain("No open Critical Exposure or High Risk findings in current scope.");
  });
});
