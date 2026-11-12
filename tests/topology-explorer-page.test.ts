import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Page from "@/app/discovery-coverage/page";
import { loadTopologyExplorer } from "@/lib/topology-explorer-data";
vi.mock("@/lib/topology-explorer-data", () => ({ loadTopologyExplorer: vi.fn() }));
vi.mock("@/components/topology-explorer", () => ({ TopologyExplorer: () => React.createElement("article", { "data-topology-explorer": true }) }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("React", React); }); afterEach(() => vi.unstubAllGlobals());
it("waits for scope without loading topology", async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: { discoveryView: "topology" } }));
  expect(loadTopologyExplorer).not.toHaveBeenCalled(); expect(html).toContain("data-route-ready-key");
});
it("loads the requested scope/date and marks the topology ready", async () => {
  vi.mocked(loadTopologyExplorer).mockResolvedValue({ snapshotDate: "2026-11-07", nodes: [], edges: [] });
  const params = { discoveryView: "topology", network: "n1", dataDate: "2026-11-07", securityDomain: "SECRET" };
  const html = renderToStaticMarkup(await Page({ searchParams: params }));
  expect(loadTopologyExplorer).toHaveBeenCalledWith(params); expect(html).toContain("data-topology-explorer"); expect(html).toContain("data-route-ready-key");
});
it("keeps lookup and scope on sanitized error Retry", async () => {
  vi.mocked(loadTopologyExplorer).mockRejectedValue(new Error("private SQL connection details"));
  const html = renderToStaticMarkup(await Page({ searchParams: { discoveryView: "topology", system: "s1", securityDomain: "SECRET", dataDate: "2026-11-07", topologyCi: "asset:a", topology_cve: "CVE-2024", topologyMode: "dependencies", topology_filters: '{"ip":["10.0.0.1"]}' } }));
  expect(html).not.toContain("private SQL"); expect(html).toContain("temporarily unavailable");
  for (const value of ["discoveryView=topology", "system=s1", "securityDomain=SECRET", "dataDate=2026-11-07", "topologyCi=asset%3Aa", "topology_cve=CVE-2024"]) expect(html).toContain(value);
  expect(html).toContain('topologyMode=dependencies'); expect(html).toContain('topology_filters=');
  const all = renderToStaticMarkup(await Page({ searchParams: { discoveryView: 'topology', network: 'n1', topologyAll: '1' } }));
  expect(all).toContain('topologyAll=1');
});
