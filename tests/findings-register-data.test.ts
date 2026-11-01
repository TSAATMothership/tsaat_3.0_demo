import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCoreAppData } from "@/lib/app-data";
import { loadSnapshotEffectiveFindings } from "@/lib/data-loader";
import { loadFindingsRegisterData } from "@/lib/findings-register-data";
import { asset, configuration, finding } from "./fixtures/findings-export";

vi.mock("@/lib/app-data", () => ({ getCoreAppData: vi.fn() }));
vi.mock("@/lib/data-loader", () => ({ loadSnapshotEffectiveFindings: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCoreAppData).mockResolvedValue({
    dataset: { snapshotId: 42, snapshotDate: "2026-11-01", assets: [asset, { ...asset, id: "outside" }] },
    analytics: { evaluations: [{ assetId: asset.id }], findings: [finding("current-only")] },
    spiDefinitions: [{ spiId: 1 }], findingDisplayConfiguration: configuration
  } as unknown as Awaited<ReturnType<typeof getCoreAppData>>);
  vi.mocked(loadSnapshotEffectiveFindings).mockResolvedValue([finding("historical"), finding("closed", asset.id, "closed"), finding("outside", "outside")]);
});

describe("shared register and export data", () => {
  it("loads historical findings only for scoped CIs and selected status, with snapshot-backed drill-through values", async () => {
    const result = await loadFindingsRegisterData({ network: "net-1", dataDate: "2026-11-02", asOf: "2026-10-30", severity: "High Risk", search: "removed" });
    expect(getCoreAppData).toHaveBeenCalledWith(expect.objectContaining({ network: "net-1", dataDate: "2026-11-02", severity: undefined, search: undefined }), { profile: "risk-summary" });
    expect(loadSnapshotEffectiveFindings).toHaveBeenCalledWith(42, "2026-10-30");
    expect(result.findings.map((row) => row.id)).toEqual(["historical"]);
    expect(Object.keys(result.assetDetailsByAssetId)).toEqual([asset.id]);
    expect(result.assetDetailsByAssetId[asset.id]).toMatchObject({ deviceModel: "Edge Model 100", lastDiscoveredDate: "01-11-2026", discoveredBy: "Discovery Scanner" });
    expect(result.exportContext).toEqual({ scope: { network: ["net-1"], system: [], dataDate: "2026-11-01" }, asOf: "2026-10-30", status: "open" });
  });
  it("retains closed findings and clamps the timeline consistently for page and export", async () => {
    const result = await loadFindingsRegisterData({ system: "sys-1", findingsTab: "closed", asOf: "2026-12-01" });
    expect(result.findings.map((row) => row.id)).toEqual(["closed"]);
    expect(result.selectedAsOf).toBe("2026-11-01");
    expect(result.exportContext.status).toBe("closed");
    expect(result.exportContext.scope.system).toEqual(["sys-1"]);
  });
});
