import { describe, expect, it } from "vitest";
import {
  filterDiscoveryAssets,
  filterDiscoveryNetworks,
  filterDiscoveryNetworksByStatus,
  normalizeDiscoveryEnabled,
  normalizeDiscoveryNetworkModellingStatus,
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

  it("removes Unassigned Systems from Discovery network calculations", () => {
    expect(
      filterDiscoveryNetworks([
        { id: "net-1", name: "Network 1" },
        { id: UNASSIGNED_NETWORK_ID, name: "Unassigned Systems" },
        { id: "net-2", name: "Network 2" }
      ])
    ).toEqual([
      { id: "net-1", name: "Network 1" },
      { id: "net-2", name: "Network 2" }
    ]);
  });

  it("removes Unassigned Systems assets from Discovery asset calculations", () => {
    expect(
      filterDiscoveryAssets([
        { id: "asset-1", networkId: "net-1" },
        { id: "asset-unassigned", networkId: UNASSIGNED_NETWORK_ID },
        { id: "asset-2", networkId: "net-2" }
      ])
    ).toEqual([
      { id: "asset-1", networkId: "net-1" },
      { id: "asset-2", networkId: "net-2" }
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

  it("normalizes and applies Network Discovery Status filters", () => {
    const networks = [
      { id: "net-1", modellingStatus: true, discoveryStatus: "Discovery Enabled" },
      { id: "net-2", modellingStatus: false, discoveryStatus: "Discovery Non Enabled" },
      { id: "net-3", modellingStatus: true, discoveryStatus: "Discovery Non Enabled" }
    ];

    expect(normalizeDiscoveryNetworkModellingStatus("modelled")).toBe("modelled");
    expect(normalizeDiscoveryNetworkModellingStatus("bad-value")).toBeUndefined();
    expect(normalizeDiscoveryEnabled("not-enabled")).toBe("not-enabled");
    expect(normalizeDiscoveryEnabled(["enabled"])).toBe("enabled");
    expect(
      filterDiscoveryNetworksByStatus(networks, {
        modellingStatus: "modelled",
        discoveryEnabled: "not-enabled"
      })
    ).toEqual([{ id: "net-3", modellingStatus: true, discoveryStatus: "Discovery Non Enabled" }]);
  });
});
