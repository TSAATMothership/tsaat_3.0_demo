import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Discovery Unassigned Systems scope wiring", () => {
  it("excludes Unassigned Systems from Discovery page network and asset calculations", () => {
    const page = readRepoFile("app/discovery-coverage/page.tsx");

    expect(page).toContain("filterDiscoveryNetworks(networks)");
    expect(page).toContain("filterDiscoveryAssets(dataset.assets.filter((asset) => scopedAssetIds.has(asset.id)))");
    expect(page).toContain("filterDiscoveryNetworksByStatus(discoveryNetworks");
    expect(page).toMatch(/buildNetworkTargetStateSummary\(\s*targetStateNetworks,/);
    expect(page).toContain("networks: discoveryNetworks");
  });

  it("excludes Unassigned Systems from Discovery API calculations and network reports", () => {
    const toolAssetsRoute = readRepoFile("app/api/discovery-coverage/tool-assets/route.ts");
    const remediationReportRoute = readRepoFile("app/api/discovery-coverage/remediation-report/route.ts");
    const networkReportRoute = readRepoFile("app/api/discovery-coverage/network-report/route.ts");

    expect(toolAssetsRoute).toContain("sanitizeDiscoverySearchParams(requestParams)");
    expect(toolAssetsRoute).toContain(
      "filterDiscoveryAssets(dataset.assets.filter((asset) => scopedAssetIds.has(asset.id)))"
    );
    expect(remediationReportRoute).toContain("sanitizeDiscoverySearchParams(Object.fromEntries");
    expect(remediationReportRoute).toContain(
      "filterDiscoveryAssets(dataset.assets.filter((asset) => scopedAssetIds.has(asset.id)))"
    );
    expect(networkReportRoute).toContain("isUnassignedNetworkId(networkId)");
  });
});
