import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TopologyExplorer } from "@/components/topology-explorer";
import type { TopologyExplorerModel } from "@/lib/topology-explorer";
const query = vi.hoisted(() => ({ value: "network=n1&topologyCi=asset:a" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query.value) }));
vi.mock("@/components/cmdb-drill-through", () => ({ CmdbDeviceName: () => React.createElement("button", null, "CMDB") }));
beforeEach(() => { vi.stubGlobal("React", React); query.value = "network=n1&topologyCi=asset:a"; }); afterEach(() => vi.unstubAllGlobals());
const model: TopologyExplorerModel = { snapshotDate: "2026-11-07", nodes: [{ id: "asset:a", sourceId: "a", kind: "asset", name: "Server A", type: "Server", hostname: "host-a", ip: "10.0.0.1", domain: "PROTECTED", software: [], cves: [] }], edges: [] };
it("renders all results beyond the lookup page and enables export only for a displayed graph", () => {
  query.value = 'network=n1&topologyAll=1&topologyMode=dependencies';
  const nodes = Array.from({ length: 61 }, (_, i) => ({ ...model.nodes[0], id: `asset:a${i}`, sourceId: `a${i}`, name: `Server ${i}` }));
  const html = renderToStaticMarkup(React.createElement(TopologyExplorer, { model: { ...model, nodes } }));
  expect(html.match(/data-topology-result=/g)).toHaveLength(50);
  expect(html.match(/data-topology-node=/g)).toHaveLength(61);
  expect(html).toContain('All matching CIs (61)'); expect(html).toContain('Generate Impact Report');
  expect(html).toContain('data-topology-show-all="true" aria-pressed="true"');
  const empty = renderToStaticMarkup(React.createElement(TopologyExplorer, { model: { ...model, nodes: [] } }));
  expect(empty).toContain('data-topology-impact-report="true" disabled=""');
  expect(empty).toContain('No matching results are available for the graph');
});
it("renders all lookup fields, keyboard nodes, exact graph title and missing-association guidance", () => {
  const html = renderToStaticMarkup(React.createElement(TopologyExplorer, { model }));
  for (const label of ["CI name or ID", "Installed software", "CVE code", "IP address", "CI type"]) expect(html).toContain(label);
  expect(html.slice(0, html.indexOf('class="topology-workspace"')).match(/aria-haspopup="dialog"/g)).toHaveLength(5);
  expect(html).toContain('aria-label="Filter Installed software"');
  expect(html).not.toContain('placeholder="Name, hostname or CI ID"');
  expect(html).toContain('data-topology-node="asset:a"'); expect(html).toContain('aria-label="Server: Server A"');
  expect(html).toContain("<title>Server A — Server</title>"); expect(html).toContain("No recorded paths");
  expect(html).toContain("No business service or mission service"); expect(html).not.toContain("NaN");
  expect(html).toContain('aria-label="Enter full screen"');
  expect(html).toContain('data-topology-fullscreen="true" aria-pressed="false"');
});
it("renders removable selections and legacy search chips while retaining the current graph root", () => {
  query.value += '&topology_name=host&topology_filters=' + encodeURIComponent(JSON.stringify({ ip: ['10.0.0.2'], kind: ['Endpoint CI'] }));
  const html = renderToStaticMarkup(React.createElement(TopologyExplorer, { model }));
  expect(html).toContain('aria-label="Filter IP address, 1 selected"');
  expect(html).toContain('aria-label="Clear IP address filter"');
  expect(html).toContain('aria-label="Clear CI name or ID bookmark search"');
  expect(html).toContain('No matching CIs'); expect(html).toContain('data-topology-node="asset:a"');
});
it("renders accessible Business Impact tabs by default and ignores unsupported modes", () => {
  query.value += '&topologyMode=unsupported';
  const html = renderToStaticMarkup(React.createElement(TopologyExplorer, { model }));
  expect(html).toContain('aria-label="Topology mode"'); expect(html).toContain('role="tabpanel"');
  expect(html).toContain('data-topology-mode="business-impact"'); expect(html).toContain('Business Impact / Upstream');
  expect(html).not.toContain('Communication observations');
});
it("renders model relationship evidence with environment and no communication columns", () => {
  query.value += '&topologyMode=dependencies';
  const emptyHtml = renderToStaticMarkup(React.createElement(TopologyExplorer, { model }));
  expect(emptyHtml).toContain('No recorded paths');
  const system = { ...model.nodes[0], id: 'system:s1', sourceId: 's1', kind: 'system' as const, name: 'System One', type: 'ICT System' };
  const html = renderToStaticMarkup(React.createElement(TopologyExplorer, { model: { ...model, nodes: [...model.nodes, system], edges: [
    { id: 'member', source: 'system:s1', target: 'asset:a', kind: 'membership', label: 'contains CI', environments: ['Production', 'Test'] }
  ] } }));
  for (const value of ['Dependencies / Recorded model relationships', 'Relationship evidence', 'Recorded model relationships', 'Environment', 'Production, Test', 'contains CI']) expect(html).toContain(value);
  for (const value of ['Communication observations', 'Source port', 'Target port', 'Receives from', 'outside lookup scope']) expect(html).not.toContain(value);
  expect(html.match(/class="impact-graph-count"[^>]*>1<\/text>/g)).toHaveLength(2);
  expect(html).toContain('<dt>Connected CIs</dt><dd>1</dd>');
  expect(html).toContain('Badges count connected CIs in this graph');
  expect(html).toContain('Find in this graph');
});
it("keeps stale selection and empty scope explicit", () => {
  const html = renderToStaticMarkup(React.createElement(TopologyExplorer, { model: { ...model, nodes: [] } }));
  expect(html).toContain("No CIs in this scope"); expect(html).toContain("previously selected CI is unavailable"); expect(html).not.toContain("data-topology-node");
});
