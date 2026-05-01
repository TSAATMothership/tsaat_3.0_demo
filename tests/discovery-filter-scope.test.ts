import { describe, expect, it } from "vitest";
import {
  removeUnassignedNetworkOption,
  sanitizeDiscoverySearchParams,
  UNASSIGNED_NETWORK_ID
} from "@/lib/discovery-filter-scope";

describe("discovery filter scope", () => {
  it("removes Unassigned Systems from Discovery network filter options", () => {
    const options = removeUnassignedNetworkOption({
      networks: [
        { id: "net-1", label: "Network 1" },
        { id: UNASSIGNED_NETWORK_ID, label: "Unassigned Systems" },
        { id: "net-2", label: "Network 2" }
      ],
      systems: []
    });

    expect(options.networks).toEqual([
      { id: "net-1", label: "Network 1" },
      { id: "net-2", label: "Network 2" }
    ]);
  });

  it("treats a manually supplied Unassigned Systems network query as All networks on Discovery", () => {
    expect(
      sanitizeDiscoverySearchParams({
        network: UNASSIGNED_NETWORK_ID,
        assetType: "server"
      })
    ).toEqual({
      assetType: "server"
    });
  });

  it("preserves normal network query values", () => {
    expect(
      sanitizeDiscoverySearchParams({
        network: "net-1",
        discoveryCoverageTab: "coverage-by-network"
      })
    ).toEqual({
      network: "net-1",
      discoveryCoverageTab: "coverage-by-network"
    });
  });
});
