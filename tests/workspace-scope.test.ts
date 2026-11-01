import { describe, expect, it } from "vitest";
import { applyAssetFilters, filterNetworks, filterSystems, parseFilters } from "@/lib/selectors";
import { filtersCacheKey } from "@/lib/analytics-cache";
import { activeWorkspaceItem, hasWorkspaceScope, isWorkspaceItemVisible, resolveCopView, sameWorkspaceScope, scopeIds, updateWorkspaceScope, workspaceHref, workspaceScopeUpdateHref, WORKSPACE_GROUPS, WORKSPACE_LINKS } from "@/lib/workspace-navigation";
import type { Asset, ICTSystem, ManagedNetwork } from "@/lib/types";

const systems = ["a", "b", "c"].map((id) => ({
  id: `sys-${id}`, name: `System ${id}`, networkId: `net-${id}`, criticality: "Critical", securityDomain: "Protected",
  adfPlatform: false, enterprisePlatform: false, modellingStatus: true, diisDefined: true,
  missionCapabilities: [], businessServices: [], environments: []
})) as ICTSystem[];
const networks = systems.map((system) => ({ id: system.networkId, name: system.networkId, ictSystemIds: [system.id], assetIds: [] })) as unknown as ManagedNetwork[];
const assets = systems.map((system) => ({ id: system.id.replace("sys", "asset"), networkId: system.networkId, systemContext: { systemId: system.id, environmentType: "Production" } })) as Asset[];

describe("workspace scope", () => {
  it("hides opposite-scope sidebar items and restores them when cleared", () => {
    const items = [...WORKSPACE_GROUPS.flatMap((group) => group.items), ...WORKSPACE_LINKS];
    const hiddenHrefs = (query: string) => items.filter((item) => !isWorkspaceItemVisible(item, new URLSearchParams(query))).map((item) => item.href);
    expect(hiddenHrefs("network=net-a,net-b")).toEqual([
      "/cyber-cop?copView=systems-spi-heatmap", "/cyber-cop?copView=ict-system-impact-analyser", "/ict-system-risk-profile"
    ]);
    expect(hiddenHrefs("system=sys-a,sys-b")).toEqual([
      "/cyber-cop?copView=networks-spi-heatmap", "/cyber-cop?copView=network-impact-analyser", "/network-risk-profile"
    ]);
    expect(hiddenHrefs("")).toEqual([]);
  });
  it("keeps header selections on the empty workspace until a sidebar view is chosen", () => {
    const current = new URLSearchParams("system=sys-a&copView=systems-spi-heatmap&dataDate=2026-10-30&page=3");
    const next = updateWorkspaceScope(current, "network", ["net-a", "net-b"]);
    const target = new URL(workspaceHref("/", next), "http://localhost");
    expect(target.pathname).toBe("/");
    expect(activeWorkspaceItem(target.pathname, target.searchParams)).toBeUndefined();
    expect(target.searchParams.has("copView")).toBe(false);
    expect(target.searchParams.has("system")).toBe(false);
    expect(target.searchParams.has("page")).toBe(false);
    expect(target.searchParams.get("network")).toBe("net-a,net-b");
    expect(target.searchParams.get("dataDate")).toBe("2026-10-30");
    const destination = new URL(workspaceHref("/measures?measuresTab=measures-spi", target.searchParams), "http://localhost");
    expect(activeWorkspaceItem(destination.pathname, destination.searchParams)?.label).toBe("Security Posture Indicators (SPIs)");
    expect(destination.searchParams.get("network")).toBe("net-a,net-b");
    expect(destination.searchParams.get("dataDate")).toBe("2026-10-30");
    const systemSelection = updateWorkspaceScope(target.searchParams, "system", ["sys-b", "sys-c"]);
    expect(workspaceHref("/", systemSelection)).toBe("/?system=sys-b%2Csys-c&dataDate=2026-10-30");
    expect(workspaceHref("/", updateWorkspaceScope(systemSelection, "system", []))).toBe("/?dataDate=2026-10-30");
  });
  it("starts empty and accepts multiple repeated or comma-separated selections", () => {
    expect(hasWorkspaceScope({})).toBe(false);
    expect(scopeIds(["net-b,net-a", "net-b", ""])).toEqual(["net-a", "net-b"]);
    expect(parseFilters({ network: ["net-b", "net-a"] }).managedNetwork).toBe("net-a,net-b");
  });
  it("stages multiple edits without changing the applied scope and recognises a reverted edit", () => {
    const applied = new URLSearchParams("network=net-a&dataDate=2026-10-31&copView=impact&page=3");
    const draft = updateWorkspaceScope(applied, "network", ["net-a", "net-b"]);
    expect(applied.get("network")).toBe("net-a");
    expect(applied.get("page")).toBe("3");
    expect(sameWorkspaceScope(applied, draft)).toBe(false);
    const reordered = new URLSearchParams("network=net-b&network=net-a");
    expect(sameWorkspaceScope(draft, reordered)).toBe(true);
    expect(sameWorkspaceScope(applied, updateWorkspaceScope(draft, "network", ["net-a"]))).toBe(true);
    const switched = updateWorkspaceScope(draft, "system", ["sys-a", "sys-b"]);
    expect(switched.has("network")).toBe(false);
    expect(applied.get("network")).toBe("net-a");
    expect(sameWorkspaceScope(applied, switched)).toBe(false);
  });
  it("preserves the current view, or selects the matching risk profile, when applying header filters", () => {
    for (const item of [...WORKSPACE_GROUPS.flatMap((group) => group.items), ...WORKSPACE_LINKS]) {
      const current = new URL(workspaceHref(item.href, new URLSearchParams("network=net-a&dataDate=2026-10-31")), "http://localhost");
      current.searchParams.set("page", "3");
      const draft = updateWorkspaceScope(current.searchParams, "system", ["sys-a", "sys-b"]);
      const updated = new URL(workspaceScopeUpdateHref(current.pathname, draft), current.origin);
      const expectedHref = item.href === "/network-risk-profile" ? "/ict-system-risk-profile" : item.href;
      const selected = activeWorkspaceItem(updated.pathname, updated.searchParams)!;
      expect(selected.href).toBe(expectedHref);
      expect(updated.searchParams.get("dataDate")).toBe("2026-10-31");
      expect(updated.searchParams.get("system")).toBe("sys-a,sys-b");
      expect(updated.searchParams.has("network")).toBe(false);
      expect(updated.searchParams.has("page")).toBe(false);
      expect(isWorkspaceItemVisible(selected, updated.searchParams, selected.href)).toBe(true);
      const cleared = updateWorkspaceScope(draft, "system", []);
      expect(activeWorkspaceItem(updated.pathname, cleared)?.href).toBe(expectedHref);
      expect(hasWorkspaceScope(Object.fromEntries(cleared))).toBe(false);
    }
  });
  it("keeps risk-profile visibility aligned with applied scope even if the opposite profile was active", () => {
    const items = WORKSPACE_GROUPS.flatMap(group => group.items);
    const network = items.find(item => item.href === "/network-risk-profile")!;
    const system = items.find(item => item.href === "/ict-system-risk-profile")!;
    for (const active of [network.href, system.href, undefined]) {
      expect(isWorkspaceItemVisible(network, new URLSearchParams("network=net-a&network=net-b"), active)).toBe(true);
      expect(isWorkspaceItemVisible(system, new URLSearchParams("network=net-a,net-b"), active)).toBe(false);
      expect(isWorkspaceItemVisible(network, new URLSearchParams("system=sys-a,sys-b"), active)).toBe(false);
      expect(isWorkspaceItemVisible(system, new URLSearchParams("system=sys-a&system=sys-b"), active)).toBe(true);
      expect(isWorkspaceItemVisible(network, new URLSearchParams(), active)).toBe(true);
      expect(isWorkspaceItemVisible(system, new URLSearchParams(), active)).toBe(true);
    }
    const params = new URLSearchParams("network=net-a,net-b&dataDate=2026-10-30");
    expect(workspaceScopeUpdateHref(system.href, params)).toBe("/network-risk-profile?network=net-a%2Cnet-b&dataDate=2026-10-30");
    expect(workspaceScopeUpdateHref(network.href, updateWorkspaceScope(params, "system", ["sys-b"])))
      .toBe("/ict-system-risk-profile?dataDate=2026-10-30&system=sys-b");
  });
  it("uses the risk profiles when navigating from entity detail pages", () => {
    const params = new URLSearchParams("network=net-b&dataDate=2026-10-31");
    expect(activeWorkspaceItem("/networks/net-a", params)?.href).toBe("/network-risk-profile");
    expect(workspaceScopeUpdateHref("/networks/net-a", params)).toBe("/network-risk-profile?network=net-b&dataDate=2026-10-31");
    expect(activeWorkspaceItem("/systems/sys-a", params)?.href).toBe("/ict-system-risk-profile");
    expect(workspaceScopeUpdateHref("/systems/sys-a", params)).toBe("/network-risk-profile?network=net-b&dataDate=2026-10-31");
  });
  it("switches scope exclusively while preserving the date and selected view", () => {
    const params = new URLSearchParams("network=net-a,net-b&dataDate=2026-10-30&copView=impact&page=3");
    const changed = updateWorkspaceScope(params, "system", ["sys-b", "sys-c"]);
    expect(changed.get("network")).toBeNull();
    expect(changed.get("system")).toBe("sys-b,sys-c");
    expect(changed.get("dataDate")).toBe("2026-10-30");
    expect(changed.get("copView")).toBe("impact");
    expect(changed.has("page")).toBe(false);
    expect(hasWorkspaceScope(Object.fromEntries(updateWorkspaceScope(changed, "system", [])))).toBe(false);
    expect(updateWorkspaceScope(params, "system", []).get("network")).toBe("net-a,net-b");
  });
  it("filters assets and posture lists to the union of selected networks", () => {
    const filters = parseFilters({ network: "net-a,net-c" });
    expect(applyAssetFilters(assets, systems, filters).map((asset) => asset.id)).toEqual(["asset-a", "asset-c"]);
    expect(filterSystems(systems, filters).map((system) => system.id)).toEqual(["sys-a", "sys-c"]);
    expect(filterNetworks(networks, filters, systems).map((network) => network.id)).toEqual(["net-a", "net-c"]);
  });
  it("filters system selections across networks and never broadens unknown IDs to all data", () => {
    const filters = parseFilters({ system: "sys-b,sys-c" });
    expect(applyAssetFilters(assets, systems, filters).map((asset) => asset.id)).toEqual(["asset-b", "asset-c"]);
    expect(filterNetworks(networks, filters, systems).map((network) => network.id)).toEqual(["net-b", "net-c"]);
    expect(filterSystems(systems, filters).map((system) => system.id)).toEqual(["sys-b", "sys-c"]);
    expect(applyAssetFilters(assets, systems, parseFilters({ system: "missing" }))).toEqual([]);
    expect(filterNetworks(networks, parseFilters({ system: "missing" }), systems)).toEqual([]);
  });
  it("uses distinct cache entries for different selections with stable ordering", () => {
    expect(filtersCacheKey(parseFilters({ network: "net-a,net-b" }))).toBe(filtersCacheKey(parseFilters({ network: "net-b,net-a" })));
    expect(filtersCacheKey(parseFilters({ network: "net-a,net-b" }))).not.toBe(filtersCacheKey(parseFilters({ network: "net-a" })));
  });
  it("preserves scope and date across every sidebar destination without leaking local tabs", () => {
    const current = new URLSearchParams("system=sys-a,sys-b&dataDate=2026-10-30&copView=impact&severity=High");
    for (const item of [...WORKSPACE_GROUPS.flatMap((group) => group.items), ...WORKSPACE_LINKS]) {
      const target = new URL(workspaceHref(item.href, current), "http://localhost");
      expect(target.searchParams.get("system")).toBe("sys-a,sys-b");
      expect(target.searchParams.get("dataDate")).toBe("2026-10-30");
      expect(target.searchParams.has("severity")).toBe(false);
      expect(activeWorkspaceItem(target.pathname, target.searchParams)?.label).toBe(item.label);
    }
    expect(resolveCopView("action")).toBe("overview");
  });
});
