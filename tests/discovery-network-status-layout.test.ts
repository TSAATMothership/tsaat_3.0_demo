import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(process.cwd(), "app", "discovery-coverage", "page.tsx"), "utf8");

describe("Discovery network status table layout", () => {

  it("removes the obsolete network status and settings tabs from Discovery", () => {
    expect(pageSource).not.toContain("NetworkDiscoverySummaryTableClient");
    expect(pageSource).not.toContain("DiscoveryToolsSettingsPanel");
    expect(pageSource).not.toContain("DiscoveryCoverageByNetworkSection");
    expect(pageSource).toContain("DiscoveryComplianceExplorer");
  });
});
