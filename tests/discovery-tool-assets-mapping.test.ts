import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createAssetTypeRecord } from "@/lib/asset-taxonomy";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
const getCoreAppData = vi.hoisted(() => vi.fn());
vi.mock("@/lib/app-data", () => ({ getCoreAppData }));
import { GET } from "@/app/api/discovery-coverage/tool-assets/route";

describe("discovery tool gap drill-through mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const settings = defaultDiscoveryToolsSettings();
    settings.tools = settings.tools.slice(0, 1).map((tool) => ({ ...tool, assetTypeScope: createAssetTypeRecord((type) => type === "server" ? "required" : "na") }));
    const assets = [
      { id: "server-gap", type: "server", hostname: "Server gap", networkId: "net-1" },
      { id: "server-covered", type: "server", hostname: "Server covered", networkId: "net-1" },
      { id: "printer-gap", type: "printer-device", hostname: "Unmapped printer", networkId: "net-1" }
    ];
    getCoreAppData.mockResolvedValue({
      discoveryToolsSettings: settings,
      analytics: { evaluations: assets.map((asset) => ({ assetId: asset.id })) },
      dataset: { assets, managedNetworks: [], ictSystems: [], discoveryCoverageEvaluations: assets.map((asset) => ({
        assetId: asset.id, toolValues: { ucmdb: asset.id === "server-covered" ? 1 : 0 }, missingToolIds: [], missingToolNames: [], coverageCompliance: false
      })) }
    });
  });

  it("returns only mapped missing CIs and preserves the page filter scope", async () => {
    const response = await GET(new NextRequest("http://localhost/api/discovery-coverage/tool-assets?toolId=ucmdb&network=net-1&assetType=server&criticality=High&toolFacets=1"));
    const result = await response.json();
    expect(result.rows.map((row: { assetId: string }) => row.assetId)).toEqual(["server-gap"]);
    expect(result.selectedToolTotal).toBe(1);
    expect(result.assetTypeOptions).toEqual(["server"]);
    expect(getCoreAppData).toHaveBeenCalledWith({ network: "net-1", assetType: "server" }, { profile: "summary" });
  });

  it("returns no gaps when the tool no longer maps to any filtered CI", async () => {
    const data = await getCoreAppData();
    data.discoveryToolsSettings.tools[0].assetTypeScope.server = "na";
    const response = await GET(new NextRequest("http://localhost/api/discovery-coverage/tool-assets?toolId=ucmdb"));
    const result = await response.json();
    expect(result.rows).toEqual([]);
    expect(result.selectedToolTotal).toBe(0);
  });
});
