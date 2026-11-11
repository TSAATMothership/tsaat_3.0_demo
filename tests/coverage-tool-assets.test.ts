import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAssetTypeRecord } from "@/lib/asset-taxonomy";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/discovery-coverage/tool-assets/route";
import { filterToolAssets, readToolAssetFilters, toolAssetFacets, type CoverageToolAsset } from "@/lib/coverage-tool-assets";

const load = vi.hoisted(() => vi.fn());
vi.mock("@/lib/app-data", () => ({ getCoreAppData: load }));
const rows: CoverageToolAsset[] = Array.from({ length: 80 }, (_, i) => ({
  assetId: `asset-${i}`, hostname: `host-${String(i).padStart(2, "0")}`, ipAddress: `10.0.0.${i}`,
  assetType: i < 60 ? "server" : "workstation", network: "North", ictSystem: "System A",
  environment: i % 2 ? "Production" : "Test", toolValue: 0, coverageCompliance: false
}));
const request = (query: string) => new NextRequest(`http://localhost/api/discovery-coverage/tool-assets?toolId=scanner&network=net-1&dataDate=2026-10-31&${query}`);

beforeEach(() => {
  load.mockReset();
  load.mockResolvedValue({
    dataset: {
      assets: rows.map((row) => ({ id: row.assetId, hostname: row.hostname, ipAddress: row.ipAddress, type: row.assetType,
        networkId: "net-1", systemContext: { systemId: "sys-1", environmentType: row.environment } })),
      managedNetworks: [{ id: "net-1", name: "North" }], ictSystems: [{ id: "sys-1", name: "System A" }],
      discoveryCoverageEvaluations: rows.map((row) => ({ assetId: row.assetId, toolValues: { scanner: 0 }, coverageCompliance: false, missingToolIds: ["scanner"], missingToolNames: ["Scanner"] }))
    },
    analytics: { evaluations: rows.map((row) => ({ assetId: row.assetId })) },
    discoveryToolsSettings: { tools: [{ id: "scanner", name: "Scanner", assetTypeScope: createAssetTypeRecord(() => "required") }] }
  });
});

describe("tool asset column filters", () => {
  it("supports multi-select values within columns, intersected with search and other columns", () => {
    const filters = readToolAssetFilters(new URLSearchParams("toolColumn.assetType=server&toolColumn.assetType=workstation&toolColumn.environment=Test&toolColumn.assetType=server"));
    expect(filters.assetType).toEqual(["server", "workstation"]);
    expect(filterToolAssets(rows, "HOST-6", filters).map((row) => row.assetId)).toEqual(["asset-60", "asset-62", "asset-64", "asset-66", "asset-68"]);
    expect(filterToolAssets(rows, "", { toolValue: ["0"], coverageCompliance: ["No"] })).toHaveLength(80);
  });
  it("computes each facet across all records, ignoring only its own column filter", () => {
    const facets = toolAssetFacets(rows, "", { assetType: ["server"], environment: ["Test"] });
    expect(facets.assetType).toEqual([{ value: "server", count: 30 }, { value: "workstation", count: 10 }]);
    expect(facets.environment).toEqual([{ value: "Production", count: 30 }, { value: "Test", count: 30 }]);
  });
  it("filters before pagination and retains workspace scope while excluding table parameters", async () => {
    const response = await GET(request("toolColumn.assetType=server&toolColumn.environment=Test&pageSize=25&page=2&toolFacets=1"));
    const payload = await response.json();
    expect(payload.rows).toHaveLength(5);
    expect(payload.pagination).toMatchObject({ totalItems: 30, currentPage: 2, totalPages: 2 });
    expect(payload.columnFacets.assetType).toEqual([{ value: "server", count: 30 }, { value: "workstation", count: 10 }]);
    expect(load).toHaveBeenCalledWith({ network: "net-1", dataDate: "2026-10-31" }, { profile: "summary" });
  });
  it("uses the same filters for export batches and preserves legacy asset-type requests", async () => {
    const exported = await (await GET(request("toolColumn.assetType=server&toolColumn.environment=Test&pageSize=5000"))).json();
    expect(exported.rows).toHaveLength(30);
    expect(exported.columnFacets).toBeUndefined();
    const legacy = await (await GET(request("toolAssetType=workstation&toolSearch=host-6"))).json();
    expect(legacy.rows).toHaveLength(10);
  });
  it("returns an empty first page for unmatched filters with usable facet alternatives", async () => {
    const payload = await (await GET(request("toolColumn.assetType=unknown&page=9&toolFacets=1"))).json();
    expect(payload.rows).toEqual([]);
    expect(payload.pagination).toMatchObject({ currentPage: 1, totalItems: 0, totalPages: 1 });
    expect(payload.columnFacets.assetType).toHaveLength(2);
  });
});
