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
it("renders all lookup fields, keyboard nodes, exact graph title and missing-association guidance", () => {
  const html = renderToStaticMarkup(React.createElement(TopologyExplorer, { model }));
  for (const label of ["CI name or ID", "Installed software", "CVE code", "IP address", "CI type"]) expect(html).toContain(label);
  expect(html.slice(0, html.indexOf('class="topology-workspace"')).match(/aria-haspopup="dialog"/g)).toHaveLength(5);
  expect(html).toContain('aria-label="Filter Installed software"');
  expect(html).not.toContain('placeholder="Name, hostname or CI ID"');
  expect(html).toContain('data-topology-node="asset:a"'); expect(html).toContain('aria-label="Server: Server A"');
  expect(html).toContain("<title>Server A — Server</title>"); expect(html).toContain("No recorded paths");
  expect(html).toContain("No business service or mission capability"); expect(html).not.toContain("NaN");
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
it("renders Dependencies, recorded communication evidence and an explicit no-observation state", () => {
  query.value += '&topologyMode=dependencies';
  const emptyHtml = renderToStaticMarkup(React.createElement(TopologyExplorer, { model }));
  expect(emptyHtml).toContain('data-topology-mode="dependencies"'); expect(emptyHtml).toContain('No recorded communication in this scope');
  const peer = { ...model.nodes[0], id: 'asset:b', sourceId: 'b', name: 'Server B' };
  const html = renderToStaticMarkup(React.createElement(TopologyExplorer, { model: { ...model, nodes: [...model.nodes, peer], edges: [
    { id: 'flow', source: 'asset:b', target: 'asset:a', kind: 'communication', label: 'communicates with', observations: [{ id: 'dep', protocol: 'TCP', sourcePort: 50000, targetPort: 443, observationMethod: 'Collector', observedAt: '2026-11-07T00:00:00.000Z' }] }
  ] } }));
  expect(html).toContain('data-source="asset:b" data-target="asset:a"'); expect(html).toContain('Receives from');
  for (const value of ['Communication observations', 'TCP', '50000', '443', 'Collector', '2026-11-07T00:00:00.000Z']) expect(html).toContain(value);
  expect(html).not.toContain('No recorded communication in this scope');
});
it("keeps stale selection and empty scope explicit", () => {
  const html = renderToStaticMarkup(React.createElement(TopologyExplorer, { model: { ...model, nodes: [] } }));
  expect(html).toContain("No CIs in this scope"); expect(html).toContain("previously selected CI is unavailable"); expect(html).not.toContain("data-topology-node");
});
it("counts distinct displayed neighbours in shared node badges while retaining directed evidence", () => {
  query.value += '&topologyMode=dependencies';
  const peer = { ...model.nodes[0], id: 'asset:b', sourceId: 'b', name: 'Server B' };
  const observations = [{ id: 'dep', protocol: 'TCP', sourcePort: null, targetPort: 443, observationMethod: null, observedAt: null }];
  const html = renderToStaticMarkup(React.createElement(TopologyExplorer, { model: { ...model, nodes: [...model.nodes, peer], edges: [
    { id: 'out', source: 'asset:a', target: 'asset:b', kind: 'communication', label: 'communicates with', observations },
    { id: 'in', source: 'asset:b', target: 'asset:a', kind: 'communication', label: 'communicates with', observations }
  ] } }));
  expect(html.match(/class="impact-graph-count"[^>]*>1<\/text>/g)).toHaveLength(2);
  expect(html).toContain('<dt>Connected CIs</dt><dd>1</dd>');
  expect(html).toContain('<dt>Relationships</dt><dd>2</dd>');
  expect(html).toContain('Communicates with'); expect(html).toContain('Receives from');
  expect(html).toContain('Badges count connected CIs in this graph');
  expect(html).toContain('Find in this graph'); expect(html).not.toContain('matching findings');
});
