import { describe, expect, it } from "vitest";
import { resolveNetworkReferenceFields } from "@/lib/network-reference-fields";

describe("network reference fields", () => {
  it("shows Missing for absent stored ATO and DIIS values", () => {
    expect(resolveNetworkReferenceFields({})).toEqual({
      atoNumber: "Missing",
      diisId: "Missing"
    });
  });

  it("uses the stored ATO number and DIIS ID when present", () => {
    expect(
      resolveNetworkReferenceFields({
        atoNumber: " ATO-12345 ",
        diisId: " DIIS-NET-099 ",
        diisUrl: " https://diis.defence.gov.au/networks/DIIS-NET-99 "
      })
    ).toEqual({
      atoNumber: "ATO-12345",
      diisId: "DIIS-NET-099",
      diisHref: "https://diis.defence.gov.au/networks/DIIS-NET-99"
    });
  });

  it("does not derive DIIS labels or links when the DIIS ID is missing", () => {
    expect(
      resolveNetworkReferenceFields({
        atoNumber: "ATO-12345",
        diisUrl: "https://diis.defence.gov.au/networks/DIIS-NET-99"
      })
    ).toEqual({
      atoNumber: "ATO-12345",
      diisId: "Missing"
    });
  });
});
