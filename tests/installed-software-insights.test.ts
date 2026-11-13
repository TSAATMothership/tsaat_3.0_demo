import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildInstalledSoftwareInsights } from "@/lib/installed-software-insights";
import { emptySoftwareFilters, filterSoftwareRows, parseSoftwareFilters, type InstalledSoftwareRecord } from "@/lib/installed-software-explorer";
import { WORKSPACE_GROUPS, activeWorkspaceItem } from "@/lib/workspace-navigation";
import { defaultPersonaSettings, parsePersonaSettings, personaShowsPage, personaAllowsHref } from "@/lib/personas";
import { PersonaProvider } from "@/components/persona-provider";
import { SoftwareInsightsBriefing } from "@/components/software-insights-briefing";
import DiscoveryPage from "@/app/discovery-coverage/page";
import GovernanceSoftwarePage from "@/app/governance/installed-software-insights/page";

const readSoftware = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data-loader", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/data-loader")>(), loadInstalledSoftwareExplorerData: readSoftware }));
const date = "2026-10-31";
const row = (patch: Partial<InstalledSoftwareRecord> = {}): InstalledSoftwareRecord => ({
  assetId: "a1", softwareOrdinal: 1, softwareName: "Alpha", softwareVersion: "1", filePath: null,
  lastDiscoveredDate: date, discoveredBy: "Agent", deviceName: "Endpoint", deviceModel: null,
  osName: "Windows", osVersion: null, osPatchLevel: null, ...patch
});
const rows = [row(), row({ softwareOrdinal: 2, softwareVersion: "2", lastDiscoveredDate: "2026-09-30" }),
  row({ assetId: "a2", softwareVersion: " 1 ", discoveredBy: null, lastDiscoveredDate: "2026-11-01" }),
  row({ assetId: "a3", softwareName: "Beta", softwareVersion: null, lastDiscoveredDate: "invalid" }),
  row({ assetId: "a4", softwareName: "  ", softwareVersion: "5", lastDiscoveredDate: null })];
beforeEach(() => { vi.stubGlobal("React", React); readSoftware.mockReset(); readSoftware.mockResolvedValue({ snapshotDate: date, rows }); });
afterEach(() => vi.unstubAllGlobals());
async function render(params: Record<string, string | string[] | undefined> = {}) {
  return renderToStaticMarkup(React.createElement(PersonaProvider, { children: await DiscoveryPage({ searchParams: { discoveryView: "installed-software-insights", ...params } }) }));
}
async function renderGovernance(params: Record<string, string | string[]> = {}) {
  return renderToStaticMarkup(React.createElement(PersonaProvider, { children: await GovernanceSoftwarePage({ searchParams: params }) }));
}

describe("Installed Software Insights", () => {
  it("counts installations separately from endpoints/products and ignores missing versions in variation", () => {
    const original = structuredClone(rows), result = buildInstalledSoftwareInsights(rows, date);
    expect(result).toMatchObject({ total: 5, endpoints: 4, unnamed: 1, missingVersion: 1, knownVersion: 4, versionPercent: 80, missingPath: 5, missingSource: 1, topThree: 4 });
    expect(result.products).toEqual([{ value: "Alpha", count: 3 }, { value: "Beta", count: 1 }]);
    expect(result.versionSpread).toEqual([{ value: "Alpha", count: 3, versions: 2, endpoints: 2 }]);
    expect(rows).toEqual(original);
  });
  it("partitions discovery ages relative to snapshot and retains future/invalid/missing dates", () => {
    const result = buildInstalledSoftwareInsights(rows, date);
    expect(result).toMatchObject({ stale: 1, undated: 2, afterSnapshot: 1 });
    expect(result.recency.reduce((sum, item) => sum + item.count, 0)).toBe(rows.length);
    const boundaryRows = [0, 7, 8, 30, 31, 90, 91].map(days => row({ lastDiscoveredDate: new Date(Date.parse(date) - days * 86400000).toISOString() }));
    expect(buildInstalledSoftwareInsights(boundaryRows, date).recency.map(item => item.count)).toEqual([2, 2, 2, 1, 0, 0]);
    expect(buildInstalledSoftwareInsights(rows, "2026-12-01").stale).toBe(2);
  });
  it("keeps empty denominators and absent evidence separate from a healthy score", () => {
    expect(buildInstalledSoftwareInsights([], date)).toMatchObject({ total: 0, endpoints: 0, products: [], versionSpread: [], versionPercent: null });
    expect(buildInstalledSoftwareInsights([row({ softwareVersion: null })], date)).toMatchObject({ versionPercent: 0, versionSpread: [] });
  });
  it("does not merge distinct spelling/case or invent variation from missing versions", () => {
    const result = buildInstalledSoftwareInsights([row({ softwareName: "Alpha " }), row({ softwareName: "alpha", softwareVersion: "2" }), row({ softwareName: "Alpha", softwareVersion: null })], date);
    expect(result.products).toHaveLength(2); expect(result.versionSpread).toEqual([]);
  });
  it("removes the dashboard from the page catalogue while retaining the Governance briefing", () => {
    const items = WORKSPACE_GROUPS.flatMap(group => group.items);
    expect(items.some(item => item.id === "discovery-software-insights")).toBe(false);
    expect(activeWorkspaceItem("/discovery-coverage", new URLSearchParams("discoveryView=installed-software-insights"))).toBeUndefined();
    const settings = defaultPersonaSettings();
    expect(personaShowsPage(settings, "analyst", "discovery-software-insights")).toBe(false);
    expect(personaShowsPage(settings, null, "discovery-software-insights")).toBe(false);
    const briefing = items.find(item => item.id === "governance-software-insights")!;
    expect(briefing.label).toBe("Installed Software Insights");
    expect(personaAllowsHref(settings, "analyst", briefing.href)).toBe(true);
    settings.personas[0].pages = settings.personas[0].pages.filter(id => id !== briefing.id);
    expect(personaAllowsHref(parsePersonaSettings(settings), "analyst", briefing.href)).toBe(false);
  });
  it.each([{}, { network: "net-1", securityDomain: "NONE", dataDate: date },
    { network: ["net-1", "net-2"], system: "sys-1", securityDomain: "SECRET", dataDate: "2026-09-12", discoveryFilters: "obsolete" }
  ])("retires old dashboard bookmarks without querying inventory: %j", async params => {
    readSoftware.mockRejectedValue(new Error("The retired page must not read inventory"));
    const html = await render(params);
    expect(html).toContain("This feature has been retired");
    expect(html).toContain("data-route-ready-key");
    expect(html).not.toContain('class="software-insights');
    expect(readSoftware).not.toHaveBeenCalled();
    const url = new URL(html.match(/href="([^"]+)"/)![1].replaceAll("&amp;", "&"), "http://localhost");
    expect(url.pathname).toBe("/discovery-coverage");
    expect(url.searchParams.get("discoveryView")).toBe("endpoints");
    for (const key of ["network", "system", "securityDomain", "dataDate"] as const) {
      const value = params[key];
      expect(url.searchParams.get(key)).toBe(value ? [value].flat().join(",") : null);
    }
    expect(url.searchParams.has("discoveryFilters")).toBe(false);
  });
  it("renders the standalone Governance briefing and PDF with only shared scope and the resolved snapshot", async () => {
    const html = await renderGovernance({ network: ["net-1", "net-2"], system: "sys-1", securityDomain: "SECRET", dataDate: "2026-11-01", discoveryFilters: "stale", environment: "Production" });
    expect(readSoftware).toHaveBeenCalledExactlyOnceWith({ network: ["net-1", "net-2"], system: "sys-1", securityDomain: "SECRET", dataDate: "2026-11-01" });
    expect(html).not.toContain('Governance / Software intelligence');
    expect(html).not.toContain('<h1>Installed Software Insights</h1>');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain('<h1 id="software-briefing-title">Software<br/><em>Insights.</em></h1>');
    expect(html).toContain('data-route-ready-key='); expect(html).toContain(`data-software-snapshot="${date}"`);
    expect(html).not.toContain('role="tablist"'); expect(html).not.toContain('software-dashboard-grid');
    expect(html.match(/id="software-briefing-(?:footprint|concentration|variation|evidence)"/g)).toHaveLength(4);
    const href = html.match(/data-insights-report="([^"]+)"/)![1].replaceAll("&amp;", "&");
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe('/api/discovery/installed-software-insights/report');
    expect(Object.fromEntries(url.searchParams)).toEqual({ network: 'net-1,net-2', system: 'sys-1', securityDomain: 'SECRET', dataDate: date });
  });
  it("keeps the Governance no-scope, empty and sanitized retry states distinct", async () => {
    expect(await renderGovernance()).not.toContain('<h1'); expect(readSoftware).not.toHaveBeenCalled();
    readSoftware.mockResolvedValueOnce({ snapshotDate: date, rows: [] });
    const empty = await renderGovernance({ network: 'absent' });
    expect(empty).toContain('No installed software in this selection'); expect(empty).not.toContain('data-insights-report=');
    readSoftware.mockRejectedValueOnce(new Error('Private provider details'));
    const error = await renderGovernance({ system: 'sys-1', securityDomain: 'NONE', dataDate: date, discoveryFilters: 'stale' });
    expect(error).toContain('Software insights are temporarily unavailable'); expect(error).toContain('data-route-ready-key=');
    expect(error).toContain('/governance/installed-software-insights?system=sys-1&amp;securityDomain=NONE&amp;dataDate=' + date);
    expect(error).not.toContain('Private'); expect(error.match(/href="([^"]+)"/)![1]).not.toContain('stale'); expect(error).not.toContain('No installed software in this selection');
  });
  it("presents an anchored briefing with evidence counts matching Explorer under the selected scope", () => {
    const html = renderToStaticMarkup(React.createElement(PersonaProvider, { children: React.createElement(SoftwareInsightsBriefing, {
      model: buildInstalledSoftwareInsights(rows, date), scope: { system: "sys-1", securityDomain: "SECRET", dataDate: "2026-11-01" }
    }) }));
    expect(html).toContain('aria-label="Software inventory briefing"');
    expect(html).toContain('src="/software-terrain.svg"');
    expect(html).toContain('aria-label="Installations with a recorded version: 80%"');
    for (const chapter of ["footprint", "concentration", "variation", "evidence"]) {
      expect(html).toContain(`href="#software-briefing-${chapter}"`);
      expect(html).toContain(`id="software-briefing-${chapter}"`);
    }
    expect(html.match(/class="insight-decision"/g)).toHaveLength(6);
    const links = [...html.matchAll(/<a\s[^>]*data-software-count="\d+"[^>]*>/g)];
    expect(links).toHaveLength(11);
    for (const [tag] of links) {
      const params = new URL(tag.match(/href="([^"]+)"/)![1].replaceAll("&amp;", "&"), "http://localhost").searchParams;
      expect(params.get("system")).toBe("sys-1"); expect(params.get("securityDomain")).toBe("SECRET"); expect(params.get("dataDate")).toBe(date);
      expect(params.get("discoveryView")).toBe("installed-software");
      const encodedFilters = params.get("discoveryFilters");
      const filters = encodedFilters ? parseSoftwareFilters(JSON.parse(encodedFilters)) : emptySoftwareFilters();
      expect(filterSoftwareRows(rows, filters, date)).toHaveLength(Number(tag.match(/data-software-count="(\d+)"/)![1]));
    }
  });
  it("keeps absent product names and version splits explicit in the briefing", () => {
    const html = renderToStaticMarkup(React.createElement(PersonaProvider, { children: React.createElement(SoftwareInsightsBriefing, {
      model: buildInstalledSoftwareInsights([row({ softwareName: undefined, softwareVersion: null })], date), scope: { network: "net-1" }
    }) }));
    expect(html).toContain("No named products are recorded in this selection.");
    expect(html).toContain("No recorded version split in this scope.");
    expect(html).toContain("Missing version evidence is still reviewed separately.");
    expect(html).toContain('aria-label="Installations with a recorded version: 0%"');
    expect(html).toContain("These counts can overlap and must not be added together.");
  });
});
