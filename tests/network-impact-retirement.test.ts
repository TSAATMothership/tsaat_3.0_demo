import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import CyberCopPage from "@/app/cyber-cop/page";
import { getCoreAppData } from "@/lib/app-data";
import { COP_VIEWS, WORKSPACE_GROUPS, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

vi.mock("next/navigation", () => ({ redirect: vi.fn((href: string) => { throw new Error("Redirect: " + href); }) }));
vi.mock("@/lib/app-data", () => ({ getCoreAppData: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe("retired Network Impact Analyser", () => {
  it("has no selectable workspace view or navigation entry", () => {
    expect(COP_VIEWS).not.toContain("network-impact-analyser");
    expect(WORKSPACE_GROUPS.flatMap(group => group.items).some(item => item.href.includes("network-impact-analyser"))).toBe(false);
  });
  it.each([
    [{ network: ["net-a", "net-b"], dataDate: "2026-10-31", securityDomain: "SECRET", impactAssetId: "asset-a", diagramNetworkIds: "net-a" },
      "/network-risk-profile?network=net-a%2Cnet-b&securityDomain=SECRET&dataDate=2026-10-31"],
    [{ system: "sys-a", dataDate: "2026-10-30", securityDomain: "PROTECTED,UNKNOWN", impactAssetId: "missing" },
      "/ict-system-risk-profile?system=sys-a&securityDomain=PROTECTED%2CUNKNOWN&dataDate=2026-10-30"],
    [{ securityDomain: "NONE" }, "/network-risk-profile?securityDomain=NONE"],
    [{}, "/network-risk-profile"],
    [{ copView: ["network-impact-analyser", "impact"], network: "net-a" }, "/network-risk-profile?network=net-a"]
  ] satisfies Array<[WorkspaceSearchParams, string]>)("redirects old links with applied scope/date before loading analyser data (%#)", async (params, target) => {
    const searchParams: WorkspaceSearchParams = { copView: "network-impact-analyser", ...params };
    await expect(CyberCopPage({ searchParams })).rejects.toThrow("Redirect: " + target);
    expect(redirect).toHaveBeenCalledExactlyOnceWith(target);
    expect(getCoreAppData).not.toHaveBeenCalled();
  });
});
