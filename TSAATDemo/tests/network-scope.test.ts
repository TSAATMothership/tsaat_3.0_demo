import { describe, expect, it } from "vitest";
import { buildFilterOptions, filterNetworks, parseFilters } from "@/lib/selectors";
import { UNASSIGNED_NETWORK_ID } from "@/lib/network-scope";
import type { ICTSystem, ManagedNetwork } from "@/lib/types";

const networks: ManagedNetwork[] = [
  {
    id: "net-alpha",
    name: "Alpha Network",
    criticality: "Critical",
    adfPlatform: false,
    enterprisePlatform: false,
    modellingStatus: true,
    discoveryStatus: "Discovery Enabled",
    ictSystemIds: [],
    assetIds: []
  },
  {
    id: UNASSIGNED_NETWORK_ID,
    name: "Unassigned Systems",
    criticality: "Non-Critical",
    adfPlatform: false,
    enterprisePlatform: false,
    modellingStatus: false,
    discoveryStatus: "Discovery Non Enabled",
    ictSystemIds: [],
    assetIds: []
  }
];

const systems: ICTSystem[] = [
  {
    id: "sys-alpha",
    name: "Alpha System",
    adfPlatform: false,
    enterprisePlatform: false,
    modellingStatus: true,
    diisDefined: true,
    networkId: "net-alpha",
    criticality: "Critical",
    securityDomain: "Protected",
    missionCapabilities: [],
    businessServices: [],
    environments: []
  }
];

describe("shared network scope", () => {
  it("normalizes a synthetic network query to All", () => {
    expect(parseFilters({ network: UNASSIGNED_NETWORK_ID }).managedNetwork).toBeUndefined();
  });

  it("removes Unassigned Systems from shared network filter options", () => {
    expect(buildFilterOptions(networks, systems).networks).toEqual([{ id: "net-alpha", label: "Alpha Network" }]);
  });

  it("removes Unassigned Systems from managed network model lists", () => {
    expect(filterNetworks(networks, {}).map((network) => network.id)).toEqual(["net-alpha"]);
    expect(filterNetworks(networks, { managedNetwork: UNASSIGNED_NETWORK_ID }).map((network) => network.id)).toEqual([
      "net-alpha"
    ]);
  });
});
