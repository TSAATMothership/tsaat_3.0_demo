import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

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
});
