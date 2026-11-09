import { beforeEach, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import OverviewPage from "@/app/governance/overview/page";
import { activeWorkspaceItem, isWorkspaceItemVisible, workspaceScopeUpdateHref, WORKSPACE_GROUPS, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
vi.mock("next/navigation", () => ({ redirect: vi.fn((href: string) => { throw new Error(`Redirect: ${href}`); }) }));
beforeEach(() => vi.clearAllMocks());
it.each<{ params: WorkspaceSearchParams; expected: string }>([
  { params: {}, expected: "/governance/trends" },
  { params: { network: ["net-a", "net-b"], securityDomain: "SECRET", dataDate: "2026-10-31", trendHistory: "week" }, expected: "/governance/trends?network=net-a&network=net-b&securityDomain=SECRET&dataDate=2026-10-31&trendHistory=week" },
  { params: { system: "sys-1,sys-2", securityDomain: "NONE", dataDate: "2026-10-30" }, expected: "/governance/trends?system=sys-1%2Csys-2&securityDomain=NONE&dataDate=2026-10-30" }
])("redirects retired Overview bookmarks retaining header scope and date: $expected", ({ params, expected }) => {
  expect(() => OverviewPage({ searchParams: params })).toThrow(`Redirect: ${expected}`);
  expect(redirect).toHaveBeenCalledExactlyOnceWith(expected);
});
it("keeps retired Overview out of the ordered Governance briefings for either scope", () => {
  const group = WORKSPACE_GROUPS[0];
  expect(group.id).toBe("governance");
  expect(group.items.map(item => item.label)).toEqual([
    "Trends", "Cyber Terrain Insights", "Installed Software Insights", "Discovery Insights",
    "End Point Insights", "Security Vulnerability Insights"
  ]);
  expect(group.items.map(item => item.id)).not.toContain("governance-overview");
  for (const query of ["", "network=net-1", "system=sys-1"]) {
    const params = new URLSearchParams(query);
    expect(group.items.filter(item => isWorkspaceItemVisible(item, params))).toEqual(group.items);
    expect(activeWorkspaceItem("/governance/overview", params)?.id).toBe("governance-trends");
    expect(workspaceScopeUpdateHref("/governance/overview", params)).toBe("/governance/trends" + (query ? `?${query}` : ""));
  }
});
