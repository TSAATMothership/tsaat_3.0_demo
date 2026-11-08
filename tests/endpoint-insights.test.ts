import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { EndpointInsights } from "@/components/endpoint-insights";
import { PersonaProvider } from "@/components/persona-provider";
import Page from "@/app/governance/end-point-insights/page";
import { loadDiscoveryOverview } from "@/lib/discovery-overview-data";
import { loadEndpointExplorerData } from "@/lib/data-loader";
import { buildDiscoveryOverview } from "@/lib/discovery-overview";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { filterEndpointRows, parseEndpointFilters, type EndpointRecord } from "@/lib/endpoint-explorer";
import { WORKSPACE_GROUPS, activeWorkspaceItem } from "@/lib/workspace-navigation";
import { defaultPersonaSettings, parsePersonaSettings, personaAllowsHref } from "@/lib/personas";
import { isDataDateScopedPath } from "@/lib/data-date";

vi.mock("@/lib/discovery-overview-data", () => ({ loadDiscoveryOverview: vi.fn() }));
vi.mock("@/lib/data-loader", () => ({ loadEndpointExplorerData: vi.fn() }));
vi.mock("@/components/route-ready-marker", () => ({ RouteReadyMarker: () => React.createElement("span", { "data-ready": true }) }));
const snapshotDate = "2026-10-31";
const rows: EndpointRecord[] = ["2026-10-31", "2026-10-01", "2026-09-30", "2026-07-01", null, "invalid", "2026-11-01"].map((date, index) => ({
  assetId: `ci-${index}`, name: `CI ${index}`, ciType: index % 2 ? "Server" : "Printer Device", managedNetwork: "Network A",
  securityDomain: index % 2 ? "PROTECTED" : "UNKNOWN", ipAddress: index % 2 ? "10.0.0.1" : null,
  macAddress: index % 2 ? " " : "AA:BB:CC:DD:EE:FF", deviceModel: null, discoveredBy: index % 2 ? "Scanner" : " ", lastDiscoveredDate: date
}));
function fixture(records = rows): Awaited<ReturnType<typeof loadDiscoveryOverview>> {
  return { model: buildDiscoveryOverview({ snapshotDate, coverage: buildScopedDiscoveryToolCoverage([], defaultDiscoveryToolsSettings()),
    endpoints: records, software: [], shadow: [], vulnerabilities: [], patches: [] }),
    scope: { network: ["net-1"], system: [], securityDomain: "PROTECTED,UNKNOWN", dataDate: snapshotDate },
    scopeLabels: { networks: ["Network A (net-1)"], systems: [], domains: ["PROTECTED", "UNKNOWN"] } };
}
const render = (content: React.ReactNode) => renderToStaticMarkup(React.createElement(PersonaProvider, { children: content }));
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.mocked(loadDiscoveryOverview).mockReset().mockResolvedValue(fixture());
  vi.mocked(loadEndpointExplorerData).mockReset().mockResolvedValue({ rows, snapshotDate });
});
afterEach(() => vi.unstubAllGlobals());

it("adds Governance navigation and preserves saved page selection without auto-granting access", () => {
  const items = WORKSPACE_GROUPS.find(group => group.id === "governance")!.items;
  const discoveryIndex = items.findIndex(item => item.id === "discovery-overview");
  expect(items.slice(discoveryIndex, discoveryIndex + 2).map(item => item.label)).toEqual(["Discovery Insights", "End Point Insights"]);
  const href = "/governance/end-point-insights";
  expect(activeWorkspaceItem(href, new URLSearchParams())?.id).toBe("governance-endpoint-insights");
  expect(isDataDateScopedPath(href)).toBe(true);
  const settings = defaultPersonaSettings();
  expect(personaAllowsHref(settings, "analyst", href)).toBe(true);
  settings.personas[0].pages = settings.personas[0].pages.filter(id => id !== "governance-endpoint-insights");
  expect(personaAllowsHref(parsePersonaSettings(settings), "analyst", href)).toBe(false);
  settings.personas[0].pages.push("governance-endpoint-insights"); settings.personas[0].sections = ["discovery"];
  expect(personaAllowsHref(settings, "analyst", href)).toBe(false);
});
it("does not read inventory until a workspace scope is selected", async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: {} }));
  expect(loadDiscoveryOverview).not.toHaveBeenCalled(); expect(loadEndpointExplorerData).not.toHaveBeenCalled();
  expect(html).toContain("data-ready"); expect(html).not.toContain("endpoint-insights-title");
});
it("pins endpoint facets to the resolved snapshot and ignores local Explorer filters", async () => {
  const html = render(await Page({ searchParams: { network: "net-1", securityDomain: "PROTECTED,UNKNOWN", dataDate: "2026-11-01", discoveryFilters: "ignored", assetType: "server" } }));
  expect(loadDiscoveryOverview).toHaveBeenCalledWith({ network: "net-1", system: undefined, securityDomain: "PROTECTED,UNKNOWN", dataDate: "2026-11-01" });
  expect(loadEndpointExplorerData).toHaveBeenCalledWith(fixture().scope);
  expect(html).toContain(`dateTime="${snapshotDate}"`); expect(html).not.toContain("ignored");
  expect(html).toContain("Generate PDF"); expect(html).toContain("/api/governance/end-point-insights/report?");
  for (const id of ["inventory", "gaps", "freshness", "coverage", "actions"]) expect(html).toContain(`id="endpoint-insights-${id}"`);
});
it("reconciles every endpoint evidence link, including whitespace, invalid dates, future dates and UNKNOWN", () => {
  const html = render(React.createElement(EndpointInsights, { ...fixture(), rows }));
  const links = [...html.matchAll(/<a\b[^>]*data-endpoint-insight-count="(\d+)"[^>]*>/g)];
  let checked = 0;
  for (const match of links) {
    const href = match[0].match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&").replaceAll("&quot;", '"');
    if (!href) continue;
    const params = new URL(href, "http://localhost").searchParams;
    expect(params.get("dataDate")).toBe(snapshotDate); expect(params.get("network")).toBe("net-1");
    expect(params.get("securityDomain")).toBe("PROTECTED,UNKNOWN");
    if (params.get("discoveryView") !== "endpoints") continue;
    const filters = parseEndpointFilters(JSON.parse(params.get("discoveryFilters")!));
    expect(filterEndpointRows(rows, filters, snapshotDate).length, JSON.stringify(filters)).toBe(Number(match[1])); checked++;
  }
  expect(checked).toBeGreaterThan(20);
  expect(html).toContain("not the number of devices still undiscovered"); expect(html).toContain("Some fields may not apply");
  expect(html).toContain("can fall back to identifiers"); expect(html).toContain("UNKNOWN");
});
it("shows empty evidence and N/A without claiming completeness", () => {
  const html = render(React.createElement(EndpointInsights, { ...fixture([]), rows: [] }));
  expect(html).toContain("No endpoint records in this scope"); expect(html).toContain("N/A");
  expect(html).not.toMatch(/NaN|Infinity/); expect(html).toContain("does not establish complete discovery");
  expect(html).toContain("No required tool checks");
});
it.each(["overview", "endpoint"])("renders a scoped, sanitized retry on %s read failure", async (failedRead) => {
  if (failedRead === "overview") vi.mocked(loadDiscoveryOverview).mockRejectedValueOnce(Error("Private server details"));
  else vi.mocked(loadEndpointExplorerData).mockRejectedValueOnce(Error("Private server details"));
  const html = renderToStaticMarkup(await Page({ searchParams: { system: "sys-1", securityDomain: "SECRET", dataDate: snapshotDate } }));
  expect(html).toContain('role="alert"'); expect(html).toContain("system=sys-1"); expect(html).toContain("securityDomain=SECRET");
  expect(html).not.toContain("Private"); expect(html).not.toContain("No endpoint records");
});
