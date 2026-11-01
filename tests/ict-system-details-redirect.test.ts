import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import IctSystemDetailsPage from "@/app/systems/[systemId]/page";

vi.mock("next/navigation", () => ({ redirect: vi.fn((href: string) => { throw new Error(`Redirect: ${href}`); }) }));
beforeEach(() => vi.clearAllMocks());

describe("retired ICT system details page", () => {
  it("opens the requested system's panel and retains the selected snapshot", () => {
    const href = "/ict-system-risk-profile?system=sys-a&systemDetails=sys-a&dataDate=2026-11-01";
    expect(() => IctSystemDetailsPage({ params: { systemId: "sys-a" }, searchParams: {
      network: "net-a", system: "sys-other", dataDate: "2026-11-01", systemDetailTab: "inventory", page: "3"
    } })).toThrow(`Redirect: ${href}`);
    expect(redirect).toHaveBeenCalledExactlyOnceWith(href);
  });
  it("uses the current snapshot when no query parameters are supplied", () => {
    expect(() => IctSystemDetailsPage({ params: { systemId: "sys-a" } }))
      .toThrow("Redirect: /ict-system-risk-profile?system=sys-a&systemDetails=sys-a");
  });
  it("encodes system IDs and ignores invalid dates", () => {
    expect(() => IctSystemDetailsPage({ params: { systemId: "sys/a & b" }, searchParams: { dataDate: "invalid" } }))
      .toThrow("Redirect: /ict-system-risk-profile?system=sys%2Fa+%26+b&systemDetails=sys%2Fa+%26+b");
  });
});
