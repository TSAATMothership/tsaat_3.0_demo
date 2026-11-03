import { describe, expect, it } from "vitest";
import { buildNetworkImpactHref, filterNetworkImpactAssetRows, resolveNetworkImpactAssetFilter } from "@/lib/network-impact-navigation";
import type { Asset } from "@/lib/types";

const asset: Asset = {
  id: "asset&1", name: "Duplicate name", hostname: "host-1", networkId: "net-1", type: "printer-device",
  securityDomain: "PROTECTED", lifecycle: { eolStatus: "Unknown", warrantyStatus: "Unknown" }, vulnerabilities: []
};

describe("CMDB network impact navigation", () => {
  it("preserves repeated header networks, uses the actual snapshot and drops unrelated local filters", () => {
    const url = new URL(buildNetworkImpactHref({ assetId: asset.id, networkId: asset.networkId, snapshotDate: "2026-10-30" },
      "?network=net-1&network=net-2&system=old&dataDate=2026-11-03&severity=Major&search=other&copView=impact"), "http://localhost");
    expect(url.pathname).toBe("/cyber-cop");
    expect([...url.searchParams]).toEqual([
      ["copView", "network-impact-analyser"], ["network", "net-1,net-2"],
      ["dataDate", "2026-10-30"], ["impactAssetId", "asset&1"]
    ]);
  });
  it("preserves system scope and supplies the asset network only when header scope is absent", () => {
    const details = { assetId: asset.id, networkId: asset.networkId, snapshotDate: "2026-10-30" };
    const system = new URL(buildNetworkImpactHref(details, "?system=sys-1,sys-2"), "http://localhost");
    expect(system.searchParams.get("system")).toBe("sys-1,sys-2");
    expect(system.searchParams.has("network")).toBe(false);
    expect(new URL(buildNetworkImpactHref(details, ""), "http://localhost").searchParams.get("network")).toBe("net-1");
  });
  it("resolves only exact asset IDs within the supplied scope and eligible networks", () => {
    expect(resolveNetworkImpactAssetFilter(asset.id, [asset], [{ id: "net-1" }]))
      .toEqual({ assetId: asset.id, assetName: asset.name, networkId: "net-1" });
    for (const id of ["Duplicate name", "missing", "", [asset.id, "asset-2"]]) {
      expect(resolveNetworkImpactAssetFilter(id, [asset], [{ id: "net-1" }])?.networkId).toBeNull();
    }
    expect(resolveNetworkImpactAssetFilter(asset.id, [], [{ id: "net-1" }])?.networkId).toBeNull();
    expect(resolveNetworkImpactAssetFilter(asset.id, [asset], [{ id: "other" }])?.networkId).toBeNull();
    expect(resolveNetworkImpactAssetFilter(undefined, [asset], [])).toBeNull();
  });
  it("keeps every row for one exact ID and never broadens blank, repeated or unknown filters", () => {
    const rows = [{ assetId: "ci-1", findingId: null }, { assetId: "ci-1", findingId: "f-1" }, { assetId: "ci-10", findingId: "f-10" }];
    expect(filterNetworkImpactAssetRows(rows, new URLSearchParams("impactAssetId=ci-1"))).toEqual(rows.slice(0, 2));
    for (const query of ["impactAssetId=", "impactAssetId=missing", "impactAssetId=ci-1&impactAssetId=ci-10"])
      expect(filterNetworkImpactAssetRows(rows, new URLSearchParams(query))).toEqual([]);
    expect(filterNetworkImpactAssetRows(rows, new URLSearchParams())).toEqual(rows);
  });
});
