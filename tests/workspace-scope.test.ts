import { applyAssetFilters, filterNetworks, filterSystems, parseFilters } from "@/lib/selectors";
import type { Asset, ICTSystem, ManagedNetwork } from "@/lib/types";
import { activeWorkspaceItem, hasWorkspaceScope, isWorkspaceItemVisible, sameWorkspaceScope, scopeIds, updateWorkspaceScope, WORKSPACE_GROUPS, WORKSPACE_LINKS, workspaceHref, workspaceScopeUpdateHref } from "@/lib/workspace-navigation";
import { describe, expect, it } from "vitest";

const systems = ["a", "b", "c"].map((id) => ({
  id: `sys-${id}`, name: `System ${id}`, networkId: `net-${id}`, criticality: "Critical", securityDomain: "PROTECTED",
  adfPlatform: false, enterprisePlatform: false, modellingStatus: true, diisDefined: true,
  missionCapabilities: [], businessServices: [], environments: []
})) as ICTSystem[];
const networks = systems.map((system) => ({ id: system.networkId, name: system.networkId, ictSystemIds: [system.id], assetIds: [] })) as unknown as ManagedNetwork[];
const assets = systems.map((system) => ({ id: system.id.replace("sys", "asset"), networkId: system.networkId, systemContext: { systemId: system.id, environmentType: "Production" } })) as Asset[];

describe("workspace scope", () => {
  it("keeps header selections on the empty workspace until a sidebar view is chosen", () => {
    const current = new URLSearchParams("system=sys-a&copView=ict-system-impact-analyser&dataDate=2026-10-30&page=3");
    const next = updateWorkspaceScope(current, "network", ["net-a", "net-b"]);
    const target = new URL(workspaceHref("/", next), "http://localhost");
    expect(target.pathname).toBe("/");
    expect(activeWorkspaceItem(target.pathname, target.searchParams)).toBeUndefined();
    expect(target.searchParams.has("copView")).toBe(false);
    expect(target.searchParams.has("system")).toBe(false);
    expect(target.searchParams.has("page")).toBe(false);
    expect(target.searchParams.get("network")).toBe("net-a,net-b");
    expect(target.searchParams.get("dataDate")).toBe("2026-10-30");
    const destination = new URL(workspaceHref("/discovery-coverage?discoveryView=endpoints", target.searchParams), "http://localhost");
    expect(activeWorkspaceItem(destination.pathname, destination.searchParams)?.label).toBe("End Point Explorer");
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
  it("preserves the current view, when applying header filters", () => {
    for (const item of [...WORKSPACE_GROUPS.flatMap((group) => group.items), ...WORKSPACE_LINKS]) {
      const current = new URL(workspaceHref(item.href, new URLSearchParams("network=net-a&dataDate=2026-10-31")), "http://localhost");
      current.searchParams.set("page", "3");
      const draft = updateWorkspaceScope(current.searchParams, "system", ["sys-a", "sys-b"]);
      const updated = new URL(workspaceScopeUpdateHref(current.pathname, draft), current.origin);
      const expectedHref = item.href;
      const selected = activeWorkspaceItem(updated.pathname, updated.searchParams)!;
      expect(selected.href).toBe(expectedHref);
      expect(updated.searchParams.get("dataDate")).toBe("2026-10-31");
      expect(updated.searchParams.get("system")).toBe("sys-a,sys-b");
      expect(updated.searchParams.has("network")).toBe(false);
      expect(updated.searchParams.has("page")).toBe(false);
      expect(isWorkspaceItemVisible(selected, updated.searchParams, selected.href)).toBe(selected.sidebar !== false);
      const cleared = updateWorkspaceScope(draft, "system", []);
      expect(activeWorkspaceItem(updated.pathname, cleared)?.href).toBe(expectedHref);
      expect(hasWorkspaceScope(Object.fromEntries(cleared))).toBe(false);
    }
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
  it("preserves scope and date across every sidebar destination without leaking local tabs", () => {
    const current = new URLSearchParams("system=sys-a,sys-b&dataDate=2026-10-30&copView=impact&severity=High");
    for (const item of [...WORKSPACE_GROUPS.flatMap((group) => group.items), ...WORKSPACE_LINKS]) {
      const target = new URL(workspaceHref(item.href, current), "http://localhost");
      expect(target.searchParams.get("system")).toBe("sys-a,sys-b");
      expect(target.searchParams.get("dataDate")).toBe("2026-10-30");
      expect(target.searchParams.has("severity")).toBe(false);
      expect(activeWorkspaceItem(target.pathname, target.searchParams)?.label).toBe(item.label);
    }
    for (const retiredView of ["action", "networks-spi-heatmap", "systems-spi-heatmap", "network-impact-analyser"]) {
      expect(activeWorkspaceItem("/cyber-cop", new URLSearchParams(`copView=${retiredView}&network=net-a`))).toBeUndefined();
      expect(WORKSPACE_GROUPS.flatMap(group => group.items).some(item => item.href.includes(`copView=${retiredView}`))).toBe(false);
    }
  });
});
