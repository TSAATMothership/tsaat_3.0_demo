import { describe, expect, it } from "vitest";
import { DISABLED_REFERENCE_NETWORK_ID } from "@/lib/disabled-network-fixture";
import { buildDiscoveryCoverageByNetworkRows } from "@/lib/discovery-coverage-by-network-rows";
import { UNASSIGNED_NETWORK_ID } from "@/lib/discovery-filter-scope";
import type { ManagedNetwork } from "@/lib/types";

function network(overrides: Partial<ManagedNetwork> & Pick<ManagedNetwork, "id" | "name">): ManagedNetwork {
  return {
    criticality: "Non-Critical",
    adfPlatform: false,
    enterprisePlatform: false,
    modellingStatus: true,
    discoveryStatus: "Discovery Enabled",
    ictSystemIds: [],
    assetIds: [],
    ...overrides
  };
}

const toolColumns = [
  { key: "ucmdb", label: "UCMDB" },
  { key: "tenable", label: "Tenable" }
];

describe("Discovery by-network tile rows", () => {
  it("keeps measured coverage for discovery-enabled networks", () => {
    const rows = buildDiscoveryCoverageByNetworkRows({
      networks: [
        network({
          id: "net-enabled",
          name: "Enabled Network",
          classification: "Protected",
          owner: "Network Owner",
          atoNumber: "ATO-NET-001",
          diisId: "DIIS-NET-001"
        })
      ],
      toolColumns,
      coverageRows: [
        {
          networkId: "net-enabled",
          coverage: {
            toolValues: {
              ucmdb: 1,
              tenable: 0
            }
          }
        }
      ]
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      coverageAvailable: true,
      assetCount: 1,
      overallCoveragePercent: 50,
      owner: "Network Owner",
      atoNumber: "ATO-NET-001",
      diisId: "DIIS-NET-001"
    });
    expect(rows[0].toolCoverage).toEqual([
      { toolId: "ucmdb", toolName: "UCMDB", covered: 1, missing: 0, applicable: 1, coveragePercent: 100 },
      { toolId: "tenable", toolName: "Tenable", covered: 0, missing: 1, applicable: 1, coveragePercent: 0 }
    ]);
  });

  it("renders a blank-data row for unmodelled discovery-disabled networks with no aggregate", () => {
    const rows = buildDiscoveryCoverageByNetworkRows({
      networks: [
        network({
          id: DISABLED_REFERENCE_NETWORK_ID,
          name: "Disabled Reference Network",
          description: "Only this description is available.",
          modellingStatus: false,
          discoveryStatus: "Discovery Non Enabled"
        })
      ],
      toolColumns,
      coverageRows: []
    });

    expect(rows).toEqual([
      {
        networkId: DISABLED_REFERENCE_NETWORK_ID,
        networkName: "Disabled Reference Network",
        modellingStatus: "Not Modelled",
        discoveryEnabled: false,
        coverageAvailable: false,
        description: "Only this description is available.",
        toolCoverage: []
      }
    ]);
  });

  it("does not fallback-fill metadata or measured coverage for modelled discovery-disabled networks", () => {
    const rows = buildDiscoveryCoverageByNetworkRows({
      networks: [
        network({
          id: "net-modelled-disabled",
          name: "Modelled Disabled Network",
          modellingStatus: true,
          discoveryStatus: "Discovery Non Enabled",
          atoNumber: "ATO-NET-099",
          diisId: "DIIS-NET-099"
        })
      ],
      toolColumns,
      coverageRows: [
        {
          networkId: "net-modelled-disabled",
          coverage: {
            toolValues: {
              ucmdb: 1,
              tenable: 1
            }
          }
        }
      ]
    });

    expect(rows[0]).toMatchObject({
      modellingStatus: "Modelled",
      discoveryEnabled: false,
      coverageAvailable: false,
      atoNumber: "ATO-NET-099",
      diisId: "DIIS-NET-099",
      toolCoverage: []
    });
    expect(rows[0].owner).toBeUndefined();
    expect(rows[0].assetCount).toBeUndefined();
    expect(rows[0].overallCoveragePercent).toBeUndefined();
  });

  it("excludes the synthetic unassigned network while retaining no-aggregate managed networks", () => {
    const rows = buildDiscoveryCoverageByNetworkRows({
      networks: [
        network({
          id: UNASSIGNED_NETWORK_ID,
          name: "Unassigned Systems",
          discoveryStatus: "Discovery Non Enabled",
          modellingStatus: false
        }),
        network({
          id: "net-real-disabled",
          name: "Real Disabled Network",
          discoveryStatus: "Discovery Non Enabled",
          modellingStatus: false
        })
      ],
      toolColumns,
      coverageRows: []
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].networkId).toBe("net-real-disabled");
    expect(rows[0].coverageAvailable).toBe(false);
  });
});
