import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("network Unassigned Systems scope wiring", () => {
  it("rejects the synthetic network on direct network model routes", () => {
    expect(readRepoFile("app/networks/[networkId]/page.tsx")).toContain("isUnassignedNetworkId(params.networkId)");
    expect(readRepoFile("app/api/networks/[networkId]/discovery-coverage-export/route.ts")).toContain(
      "isUnassignedNetworkId(params.networkId)"
    );
    expect(readRepoFile("app/api/networks/[networkId]/remediation-report/route.ts")).toContain(
      "isUnassignedNetworkId(params.networkId)"
    );
  });

  it("excludes the synthetic network from network model reports and topology", () => {
    expect(readRepoFile("app/api/networks/remediation-report/route.ts")).toContain("filterRealNetworkEvaluations");
    expect(readRepoFile("app/api/networks/remediation-report/route.ts")).toContain("filterRealNetworkFindings");
    expect(readRepoFile("lib/network-topology.ts")).toContain("filterRealNetworks(dataset.managedNetworks)");
    expect(readRepoFile("components/detailed-topology-view.tsx")).toContain("isRealNetworkId(relatedCi.networkId)");
  });
});
