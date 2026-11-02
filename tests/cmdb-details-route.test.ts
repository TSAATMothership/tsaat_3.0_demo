import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Dataset } from "@/lib/types";
import { GET } from "@/app/api/assets/cmdb-details/route";
import { loadDatasetForDate } from "@/lib/data-loader";
import { loadCmdbAttributeDefinitions } from "@/lib/cmdb-attribute-loader";

vi.mock("@/lib/data-loader", () => ({ loadDatasetForDate: vi.fn() }));
vi.mock("@/lib/cmdb-attribute-loader", () => ({ loadCmdbAttributeDefinitions: vi.fn() }));

const dataset: Dataset = {
  generatedAt: "2026-10-30T00:00:00Z", snapshotDate: "2026-10-30", managedNetworks: [], ictSystems: [], spiEvaluations: [],
  assets: [{ id: "ci-1", name: "Printer One", hostname: "printer-1", type: "printer-device", networkId: "net-1",
    securityDomain: "Protected", lifecycle: { eolStatus: "Unknown", warrantyStatus: "Unknown" }, vulnerabilities: [] }]
};
const request = (query = "assetId=ci-1&dataDate=2026-10-30") => new NextRequest(`http://localhost/api/assets/cmdb-details?${query}`);

describe("CMDB attribute API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadDatasetForDate).mockResolvedValue(dataset);
    vi.mocked(loadCmdbAttributeDefinitions).mockResolvedValue([{ key: "assetName", label: "Printer", displayOrder: 10 }]);
  });
  it("loads the snapshot and applies the actual asset type's mapping", async () => {
    const response = await GET(request());
    expect(loadDatasetForDate).toHaveBeenCalledWith("2026-10-30", { profile: "full" });
    expect(loadCmdbAttributeDefinitions).toHaveBeenCalledWith("printer-device");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ snapshotDate: "2026-10-30", asset: {
      snapshotDate: "2026-10-30", assetId: "ci-1", assetName: "Printer One", assetType: "printer-device",
      attributes: [{ key: "assetName", label: "Printer", value: "Printer One" }]
    } });
  });
  it("reads changes on the next request and respects an empty field set", async () => {
    expect((await (await GET(request())).json()).asset.attributes).toHaveLength(1);
    vi.mocked(loadCmdbAttributeDefinitions).mockResolvedValue([]);
    expect((await (await GET(request())).json()).asset.attributes).toEqual([]);
    expect(loadCmdbAttributeDefinitions).toHaveBeenCalledTimes(2);
  });
  it("does not load mappings for missing assets or invalid requests", async () => {
    expect((await GET(request(""))).status).toBe(400);
    expect((await GET(request("assetId=unknown"))).status).toBe(404);
    expect(loadCmdbAttributeDefinitions).not.toHaveBeenCalled();
  });
  it("returns a retryable error rather than falling back to all fields on SQL failure", async () => {
    vi.mocked(loadCmdbAttributeDefinitions).mockRejectedValue(new Error("connection details must not be returned"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Unable to load the CMDB attribute configuration. Please retry." });
  });
});
