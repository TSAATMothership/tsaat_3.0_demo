import { ASSET_TYPES, createAssetTypeRecord } from "@/lib/asset-taxonomy";
import {
  buildNetworkTargetStateSummary,
  calculateMatchedTargetStateAssets,
  describeNetworkTargetStateCellPresentation,
  normalizeTargetStateAssetName,
  summarizeTargetStateAssetType
} from "@/lib/network-target-state";
import type { ManagedNetwork } from "@/lib/types";
import { describe, expect, it } from "vitest";

function createManagedNetwork(id: string, targetStateAssets?: ManagedNetwork["targetStateAssets"]): ManagedNetwork {
  return {
    id,
    name: id,
    criticality: "Non-Critical",
    adfPlatform: false,
    enterprisePlatform: false,
    discoveryStatus: "Discovery Enabled",
    ictSystemIds: [],
    assetIds: [],
    targetStateAssets
  };
}

describe("network target-state matching", () => {
  it("normalizes names as trim + lowercase", () => {
    expect(normalizeTargetStateAssetName("  App-SRV-01  ")).toBe("app-srv-01");
  });

  it("matches target to discovered as name-count minimum", () => {
    const matched = calculateMatchedTargetStateAssets(
      ["srv-a", "srv-a", "srv-b", "srv-c"],
      [" SRV-A ", "srv-a", "srv-b", "srv-b"]
    );
    expect(matched).toBe(3);
  });

  it("returns missing states and ok coverage", () => {
    const targetMissing = summarizeTargetStateAssetType([], ["srv-a"]);
    expect(targetMissing.state).toBe("target-missing");
    expect(targetMissing.discoveredTotal).toBe(0);
    expect(targetMissing.discoveredSetTotal).toBe(1);

    expect(summarizeTargetStateAssetType([], []).state).toBe("target-and-discovery-missing");
    const discoveryMissing = summarizeTargetStateAssetType(["srv-a"], ["srv-b"]);
    expect(discoveryMissing.state).toBe("discovery-missing");
    expect(discoveryMissing.discoveredTotal).toBe(0);
    expect(discoveryMissing.discoveredSetTotal).toBe(1);

    const ok = summarizeTargetStateAssetType(["srv-a", "srv-b", "srv-c"], ["srv-a", "srv-b"]);
    expect(ok.state).toBe("ok");
    expect(ok.targetTotal).toBe(3);
    expect(ok.discoveredTotal).toBe(2);
    expect(ok.discoveredSetTotal).toBe(2);
    expect(ok.coveragePercent).toBe(66.7);
  });
});

describe("network target-state presentation", () => {
  it("shows chart with discovered-set count for target-missing", () => {
    const summary = summarizeTargetStateAssetType([], ["srv-a", "srv-b"]);
    const presentation = describeNetworkTargetStateCellPresentation(summary);

    expect(presentation.showChart).toBe(true);
    expect(presentation.displayTargetTotal).toBe(0);
    expect(presentation.displayDiscoveredTotal).toBe(2);
    expect(presentation.missingMessage).toBe("Target State Missing");
    expect(presentation.missingMessagePlacement).toBe("below-chart");
  });

  it("shows chart with discovery-missing message below chart", () => {
    const summary = summarizeTargetStateAssetType(["srv-a"], []);
    const presentation = describeNetworkTargetStateCellPresentation(summary);

    expect(presentation.showChart).toBe(true);
    expect(presentation.displayTargetTotal).toBe(1);
    expect(presentation.displayDiscoveredTotal).toBe(0);
    expect(presentation.missingMessage).toBe("Discovery Missing");
    expect(presentation.missingMessagePlacement).toBe("below-chart");
  });

  it("shows message-only for both-missing", () => {
    const summary = summarizeTargetStateAssetType([], []);
    const presentation = describeNetworkTargetStateCellPresentation(summary);

    expect(presentation.showChart).toBe(false);
    expect(presentation.missingMessage).toBe("Target State Missing + Discovery Missing");
    expect(presentation.missingMessagePlacement).toBe("message-only");
  });

  it("keeps existing chart behavior for ok state", () => {
    const summary = summarizeTargetStateAssetType(["srv-a", "srv-b"], ["srv-a"]);
    const presentation = describeNetworkTargetStateCellPresentation(summary);

    expect(summary.state).toBe("ok");
    expect(presentation.showChart).toBe(true);
    expect(presentation.displayTargetTotal).toBe(2);
    expect(presentation.displayDiscoveredTotal).toBe(1);
    expect(presentation.missingMessage).toBeNull();
    expect(presentation.missingMessagePlacement).toBeNull();
  });
});

describe("buildNetworkTargetStateSummary", () => {
  it("derives provided flag and per-type summaries", () => {
    const alphaTargetState = createAssetTypeRecord(() => [] as string[]);
    alphaTargetState.server = ["srv-01", "srv-02", "srv-03"];
    const networks: ManagedNetwork[] = [
      createManagedNetwork("net-alpha", alphaTargetState),
      createManagedNetwork("net-bravo", createAssetTypeRecord(() => [] as string[]))
    ];

    const discoveredAssets = [
      { networkId: "net-alpha", assetType: "server" as const, name: "SRV-01" },
      { networkId: "net-alpha", assetType: "server" as const, name: "srv-02" },
      { networkId: "net-alpha", assetType: "workstation" as const, name: "ws-01" }
    ];

    const summary = buildNetworkTargetStateSummary(networks, discoveredAssets);
    const alpha = summary.get("net-alpha");
    const bravo = summary.get("net-bravo");

    expect(alpha?.targetStateProvided).toBe(true);
    expect(alpha?.byAssetType.server.targetTotal).toBe(3);
    expect(alpha?.byAssetType.server.discoveredTotal).toBe(2);
    expect(alpha?.byAssetType.server.discoveredSetTotal).toBe(2);
    expect(alpha?.byAssetType.server.state).toBe("ok");
    expect(alpha?.byAssetType.workstation.discoveredSetTotal).toBe(1);
    expect(alpha?.byAssetType.workstation.state).toBe("target-missing");

    expect(bravo?.targetStateProvided).toBe(false);
    for (const assetType of ASSET_TYPES) {
      expect(bravo?.byAssetType[assetType].state).toBe("target-and-discovery-missing");
    }
  });
});
