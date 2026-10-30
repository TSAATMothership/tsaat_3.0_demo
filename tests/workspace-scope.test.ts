import { describe, expect, it } from "vitest";
import { applyAssetFilters, filterNetworks, filterSystems, parseFilters } from "@/lib/selectors";
import { filtersCacheKey } from "@/lib/analytics-cache";
import { activeWorkspaceItem, hasWorkspaceScope, isWorkspaceItemVisible, resolveCopView, scopeIds, updateWorkspaceScope, workspaceHref, workspaceLocationForScope, WORKSPACE_GROUPS, WORKSPACE_LINKS } from "@/lib/workspace-navigation";
import type { Asset, ICTSystem, ManagedNetwork } from "@/lib/types";

const systems = ["a", "b", "c"].map((id) => ({
  id: `sys-${id}`, name: `System ${id}`, networkId: `net-${id}`, criticality: "Critical", securityDomain: "Protected",
  adfPlatform: false, enterprisePlatform: false, modellingStatus: true, diisDefined: true,
  missionCapabilities: [], businessServices: [], environments: []
})) as ICTSystem[];
const networks = systems.map((system) => ({ id: system.networkId, name: system.networkId, ictSystemIds: [system.id], assetIds: [] })) as unknown as ManagedNetwork[];
const assets = systems.map((system) => ({ id: system.id.replace("sys", "asset"), networkId: system.networkId, systemContext: { systemId: system.id, environmentType: "Production" } })) as Asset[];

describe("workspace scope", () => {
  it("hides exactly the three opposite-scope sidebar items and restores them when cleared", () => {
    const items = [...WORKSPACE_GROUPS.flatMap((group) => group.items), ...WORKSPACE_LINKS];
    const hiddenHrefs = (query: string) => items.filter((item) => !isWorkspaceItemVisible(item, new URLSearchParams(query))).map((item) => item.href);
    expect(hiddenHrefs("network=net-a,net-b")).toEqual([
      "/cyber-cop?copView=systems-spi-heatmap", "/cyber-cop?copView=ict-system-impact-analyser", "/systems"
    ]);
    expect(hiddenHrefs("system=sys-a,sys-b")).toEqual([
      "/cyber-cop?copView=networks-spi-heatmap", "/cyber-cop?copView=network-impact-analyser", "/networks"
    ]);
    expect(hiddenHrefs("")).toEqual([]);
  });
  it("returns a now-hidden view to Cyber COP without losing scope or date", () => {
    const next = new URLSearchParams("network=net-a,net-b&copView=systems-spi-heatmap&dataDate=2026-10-30");
    const target = new URL(workspaceLocationForScope("/cyber-cop", next), "http://localhost");
    expect(target.pathname).toBe("/cyber-cop");
    expect(target.searchParams.has("copView")).toBe(false);
    expect(target.searchParams.get("network")).toBe("net-a,net-b");
    expect(target.searchParams.get("dataDate")).toBe("2026-10-30");
    expect(workspaceLocationForScope("/systems/sys-a", new URLSearchParams("network=net-a"))).toBe("/cyber-cop?network=net-a");
    expect(workspaceLocationForScope("/networks", new URLSearchParams("system=sys-a"))).toBe("/cyber-cop?system=sys-a");
    expect(workspaceLocationForScope("/measures", new URLSearchParams("system=sys-a&measuresTab=measures-spi"))).toBe("/measures?system=sys-a&measuresTab=measures-spi");
  });
  it("starts empty and accepts multiple repeated or comma-separated selections", () => {
    expect(hasWorkspaceScope({})).toBe(false);
    expect(scopeIds(["net-b,net-a", "net-b", ""])).toEqual(["net-a", "net-b"]);
    expect(parseFilters({ network: ["net-b", "net-a"] }).managedNetwork).toBe("net-a,net-b");
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
