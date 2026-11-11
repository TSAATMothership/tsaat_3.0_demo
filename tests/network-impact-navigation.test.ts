import { describe, expect, it } from "vitest";
import { filterNetworkImpactAssetRows } from "@/lib/network-impact-navigation";

describe("legacy network impact data API asset filter", () => {
  it("keeps every row for one exact ID and never broadens blank, repeated or unknown filters", () => {
    const rows = [{ assetId: "ci-1", findingId: null }, { assetId: "ci-1", findingId: "f-1" }, { assetId: "ci-10", findingId: "f-10" }];
    expect(filterNetworkImpactAssetRows(rows, new URLSearchParams("impactAssetId=ci-1"))).toEqual(rows.slice(0, 2));
    for (const query of ["impactAssetId=", "impactAssetId=missing", "impactAssetId=ci-1&impactAssetId=ci-10"])
      expect(filterNetworkImpactAssetRows(rows, new URLSearchParams(query))).toEqual([]);
    expect(filterNetworkImpactAssetRows(rows, new URLSearchParams())).toEqual(rows);
  });
});
