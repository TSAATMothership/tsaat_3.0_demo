import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonaProvider } from "@/components/persona-provider";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Page from "@/app/governance/discovery-insights/page";
import Legacy from "@/app/discovery-coverage/page";
import { loadDiscoveryOverview } from "@/lib/discovery-overview-data";
import { buildDiscoveryOverview } from "@/lib/discovery-overview";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { WORKSPACE_GROUPS, activeWorkspaceItem } from "@/lib/workspace-navigation";
import { isDataDateScopedPath } from "@/lib/data-date";
import { defaultPersonaSettings, parsePersonaSettings, personaAllowsHref } from "@/lib/personas";
vi.mock("@/lib/discovery-overview-data", () => ({ loadDiscoveryOverview: vi.fn() }));
vi.mock("@/components/route-ready-marker", () => ({ RouteReadyMarker: () => React.createElement("span", { "data-ready": true }) }));
vi.mock("next/navigation", async original => ({ ...await original<typeof import("next/navigation")>(), redirect: (url: string) => { throw new Error("Redirect:" + url); } }));
const fixture = () => ({ model: buildDiscoveryOverview({ snapshotDate: "2026-10-31", coverage: buildScopedDiscoveryToolCoverage([], defaultDiscoveryToolsSettings()), endpoints: [], software: [], shadow: [], vulnerabilities: [], patches: [] }),
  scope: { network: ["net-1"], securityDomain: "NONE", dataDate: "2026-10-31" }, scopeLabels: { networks: ["Example network (net-1)"], systems: [], domains: [] } });
beforeEach(() => { vi.stubGlobal("React", React); vi.mocked(loadDiscoveryOverview).mockReset().mockResolvedValue(fixture()); });
afterEach(() => vi.unstubAllGlobals());
it("moves the existing page identity below Software Insights and resolves legacy bookmarks to the same permission", () => {
  const governance = WORKSPACE_GROUPS.find(g => g.id === "governance")!.items;
  const softwareIndex = governance.findIndex(p => p.id === "governance-software-insights");
  expect(governance.slice(softwareIndex, softwareIndex + 2).map(p => p.label)).toEqual(["Installed Software Insights", "Discovery Insights"]);
  expect(WORKSPACE_GROUPS.find(g => g.id === "discovery")!.items.some(p => p.id === "discovery-overview")).toBe(false);
  expect(activeWorkspaceItem("/governance/discovery-insights", new URLSearchParams())?.id).toBe("discovery-overview");
  expect(activeWorkspaceItem("/discovery-coverage", new URLSearchParams("discoveryView=overview"))?.id).toBe("discovery-overview");
  expect(isDataDateScopedPath("/governance/discovery-insights")).toBe(true);
  const settings = defaultPersonaSettings(); settings.personas[0].sections = ["discovery"]; settings.personas[0].pages = ["discovery-overview"];
  expect(parsePersonaSettings(settings)).toEqual(settings);
  for (const url of ["/governance/discovery-insights", "/discovery-coverage?discoveryView=overview"]) {
    expect(personaAllowsHref(settings, "analyst", url)).toBe(false);
    const enabled = structuredClone(settings); enabled.personas[0].sections.push("governance");
    expect(personaAllowsHref(enabled, "analyst", url)).toBe(true);
    enabled.personas[0].pages = []; expect(personaAllowsHref(enabled, "analyst", url)).toBe(false);
  }
});
it("redirects legacy links before reading data, preserving header scope/domain/date only", async () => {
  const params = { discoveryView: "overview", system: "sys-1", securityDomain: "SECRET", dataDate: "2026-10-31", discoveryFilters: "local" };
  await expect(Legacy({ searchParams: params })).rejects.toThrow("Redirect:/governance/discovery-insights?system=sys-1&securityDomain=SECRET&dataDate=2026-10-31");
  await expect(Legacy({ searchParams: { discoveryView: "overview" } })).rejects.toThrow("Redirect:/governance/discovery-insights");
  expect(loadDiscoveryOverview).not.toHaveBeenCalled();
});
it("loads only with scope, ignores Explorer facets, and renders empty evidence at the resolved snapshot", async () => {
  await Page({ searchParams: {} }); expect(loadDiscoveryOverview).not.toHaveBeenCalled();
  const html = renderToStaticMarkup(React.createElement(PersonaProvider, { children: await Page({ searchParams: { network: "net-1", securityDomain: "NONE", dataDate: "2026-11-01", discoveryFilters: "ignored" } }) }));
  expect(loadDiscoveryOverview).toHaveBeenCalledWith({ network: "net-1", system: undefined, securityDomain: "NONE", dataDate: "2026-11-01" });
  expect(html).toContain("No discovery records in this scope"); expect(html).toContain("N/A"); expect(html).toMatch(/datetime="2026-10-31"/i);
  for (const chapter of ["footprint", "coverage", "evidence", "security", "actions"]) expect(html).toContain(`id="discovery-insights-${chapter}"`);
  expect(html).toContain("Generate PDF"); expect(html).not.toContain("NaN");
});
it("shows a scoped retry without leaking provider failures or presenting zero counts", async () => {
  vi.mocked(loadDiscoveryOverview).mockRejectedValueOnce(Error("Private server connection"));
  const html = renderToStaticMarkup(await Page({ searchParams: { system: "sys-1", securityDomain: "SECRET", dataDate: "2026-10-31" } }));
  expect(html).toContain('role="alert"'); expect(html).toContain("system=sys-1"); expect(html).toContain("dataDate=2026-10-31");
  expect(html).not.toContain("Private"); expect(html).not.toContain("No discovery records");
});
