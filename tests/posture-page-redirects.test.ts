import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import NetworksPage from "@/app/networks/page";
import SystemsPage from "@/app/systems/page";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

vi.mock("next/navigation", () => ({ redirect: vi.fn((href: string) => { throw new Error(`Redirect: ${href}`); }) }));
beforeEach(() => vi.clearAllMocks());

describe("retired posture page redirects", () => {
  it.each([
    [NetworksPage, { network: ["net-a", "net-b"], dataDate: "2026-10-31", networksTab: "posture", page: "3" }, "/network-risk-profile?network=net-a%2Cnet-b&dataDate=2026-10-31"],
    [SystemsPage, { system: "sys-a,sys-b", dataDate: "2026-10-30", systemsTab: "action", severity: "High Risk" }, "/ict-system-risk-profile?system=sys-a%2Csys-b&dataDate=2026-10-30"],
    [NetworksPage, { system: "sys-a", dataDate: "2026-10-30" }, "/ict-system-risk-profile?system=sys-a&dataDate=2026-10-30"],
    [SystemsPage, { network: "net-a" }, "/network-risk-profile?network=net-a"],
    [NetworksPage, {}, "/network-risk-profile"],
    [SystemsPage, {}, "/ict-system-risk-profile"]
  ] as const)("retains header selections and date when opening an old posture link (%#)", (Page, searchParams, target) => {
    expect(() => Page({ searchParams: searchParams as WorkspaceSearchParams })).toThrow(`Redirect: ${target}`);
    expect(redirect).toHaveBeenCalledExactlyOnceWith(target);
  });
});
