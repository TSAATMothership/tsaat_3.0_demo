import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect, notFound } from "next/navigation";
import NetworkDetailsPage from "@/app/networks/[networkId]/page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((href: string) => { throw new Error(`Redirect: ${href}`); }),
  notFound: vi.fn(() => { throw new Error("Not found"); })
}));
beforeEach(() => vi.clearAllMocks());

describe("retired network details page", () => {
  it("opens the replacement panel for the requested network and preserves the snapshot", () => {
    const href = "/network-risk-profile?network=net-a&networkDetails=net-a&dataDate=2026-10-30";
    expect(() => NetworkDetailsPage({ params: { networkId: "net-a" }, searchParams: {
      network: "net-other", system: "sys-a", dataDate: "2026-10-30", detailTab: "inventory", page: "3"
    } })).toThrow(`Redirect: ${href}`);
    expect(redirect).toHaveBeenCalledWith(href);
  });
  it("safely encodes network IDs and ignores invalid dates", () => {
    expect(() => NetworkDetailsPage({ params: { networkId: "net/a & b" }, searchParams: { dataDate: "invalid" } }))
      .toThrow("Redirect: /network-risk-profile?network=net%2Fa+%26+b&networkDetails=net%2Fa+%26+b");
  });
  it("continues to reject the synthetic network", () => {
    expect(() => NetworkDetailsPage({ params: { networkId: "net-unassigned" }, searchParams: {} })).toThrow("Not found");
    expect(notFound).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
