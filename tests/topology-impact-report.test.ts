import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { PDFDocument, PDFPage, PDFRawStream } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { traceTopology, traceTopologySelection, type TopologyExplorerModel, type TopologyExplorerNode } from "@/lib/topology-explorer";
import { topologyImpactReportJob, topologyImpactNarrative } from "@/lib/topology-impact-report";
import { createTopologyImpactPdf } from "@/lib/topology-impact-pdf";

const node = (id: string, kind: TopologyExplorerNode["kind"] = "asset"): TopologyExplorerNode => ({ id: `${kind}:${id}`, sourceId: id, kind,
  name: `${kind} ${id}`, type: kind === "mission" ? "Mission Service" : kind, hostname: "", ip: "", domain: kind === "asset" ? "UNKNOWN" : "", software: [], cves: [] });
function fixture(count = 2): TopologyExplorerModel {
  const assets = Array.from({ length: count }, (_, i) => node(`a${i}`));
  return { snapshotDate: "2026-11-07", nodes: [node("n1", "network"), node("s1", "system"), node("s2", "system"), node("b1", "business"), node("m1", "mission"), ...assets, node("sibling")],
    edges: [
      { id: "host", source: "network:n1", target: "system:s1", kind: "hosting", label: "hosts" },
      { id: "shared-host", source: "network:n1", target: "system:s2", kind: "hosting", label: "hosts" },
      { id: "business", source: "business:b1", target: "system:s1", kind: "association", label: "depends on" },
      { id: "mission", source: "mission:m1", target: "system:s1", kind: "association", label: "depends on" },
      ...assets.map(asset => ({ id: asset.id, source: "system:s1", target: asset.id, kind: "membership" as const, label: "contains CI", environments: ["Production"] })),
      { id: "sibling", source: "system:s2", target: "asset:sibling", kind: "membership", label: "contains CI", environments: ["Test"] }
    ] };
}
const generated = new Date("2026-11-12T01:02:03Z");
const job = (model = fixture(), roots = ["system:s1"], mode: "business-impact" | "dependencies" = "dependencies") => topologyImpactReportJob(model,
  traceTopologySelection(model, roots, mode), "Selected results", new URLSearchParams("network=n1&securityDomain=UNKNOWN&topologyAll=1"), ["CI type: Endpoint CI"], "hierarchical", new Map(), generated);

describe("all matching topology and impact report", () => {
  it("includes all matches beyond page 50, deduplicates roots and shared context, and excludes unrelated siblings", () => {
    const model = fixture(73), roots = model.nodes.filter(node => node.kind === "asset" && node.id !== "asset:sibling").map(node => node.id);
    const graph = traceTopologySelection(model, [...roots, roots[0], "missing"], "dependencies");
    expect(graph.rootIds).toEqual(roots); expect(graph.memberCount).toBe(73);
    expect(graph.nodes.some(node => node.id === "asset:a72")).toBe(true);
    expect(graph.nodes.some(node => node.id === "asset:sibling" || node.id === "system:s2")).toBe(false);
    expect(graph.nodes.filter(node => node.id === "system:s1")).toHaveLength(1);
    expect(new Set(graph.edges.map(edge => edge.id)).size).toBe(graph.edges.length);
    expect(traceTopologySelection(model, [], "dependencies").nodes).toEqual([]);
    expect(traceTopologySelection(model, ["missing"]).edges).toEqual([]);
    expect(traceTopologySelection(model, ["system:s1"])).toEqual(traceTopology(model, "system:s1"));
  });
  it("retains all selected endpoints in Business Impact without expanding unrelated model endpoints", () => {
    const graph = traceTopologySelection(fixture(), ["system:s1", "asset:a0"], "business-impact");
    expect(graph.nodes.filter(node => node.kind === "asset").map(node => node.id)).toEqual(["asset:a0"]);
    const deps = traceTopologySelection(fixture(), ["system:s1", "asset:a0"], "dependencies");
    expect(deps.memberCount).toBe(2);
    expect(deps.rootIds).toEqual(["system:s1", "asset:a0"]);
  });
  it("captures exact graph, resolved date, header scope, filters and moved positions without later mutation", () => {
    const model = fixture(), graph = traceTopology(model, "asset:a0", "dependencies"), filters = ["Name: a0"];
    const moved = new Map([["asset:a0", { x: 123, y: 456 }]]);
    const report = topologyImpactReportJob(model, graph, "asset a0", new URLSearchParams("network=n1&system=s1&securityDomain=UNKNOWN&dataDate=2026-11-08"), filters, "circular", moved, generated);
    expect(report.filename).toBe("topology-impact-2026-11-07.pdf");
    expect(report.data.scope).toEqual({ networks: ["network n1 (n1)"], systems: ["system s1 (s1)"], domains: ["UNKNOWN"] });
    expect(report.data.graph).toEqual(graph); expect(report.data.graph.nodes).not.toBe(graph.nodes);
    expect(report.data.positions.find(point => point.id === "asset:a0")).toEqual({ id: "asset:a0", x: 123, y: 456 });
    graph.nodes[0].name = "Changed"; filters.push("Changed"); moved.set("asset:a0", { x: 0, y: 0 });
    expect(report.data.graph.nodes[0].name).not.toBe("Changed"); expect(report.data.filters).toEqual(["Name: a0"]);
  });
  it("uses only displayed structural paths for service narratives and explains missing evidence", () => {
    const model = fixture();
    model.edges.push({ id: "arp", source: "asset:a0", target: "asset:sibling", kind: "observation", label: "observed in ARP table" });
    const report = job(model, ["system:s1", "asset:sibling"], "business-impact");
    const narrative = topologyImpactNarrative(report.data);
    expect(narrative.services[0].endpoints).toBe(1); // The structural member is included as the ARP observer's ancestor.
    expect(narrative.services[0].selectedEndpoints).toBe(0); // ARP does not create a service path to the selected peer.
    expect(topologyImpactNarrative(job(model, ["system:s1"], "business-impact").data).services[0].narrative).toContain("does not establish");
    expect(narrative.summary.join(" ")).toContain("do not establish that every displayed service would fail");
    const isolated = { ...fixture(), edges: [] };
    expect(topologyImpactNarrative(job(isolated, ["asset:a0"]).data).isolated).toHaveLength(1);
  });
  it("renders complete evidence and useful narratives with long names, CVEs, software and pagination", async () => {
    const model = fixture(65);
    model.nodes.find(node => node.id === "asset:a64")!.name = "LAST-ENDPOINT " + "Long recorded name ".repeat(30);
    model.nodes.find(node => node.id === "asset:a64")!.cves = ["CVE-2026-12345"];
    model.nodes.find(node => node.id === "asset:a64")!.software = Array.from({ length: 80 }, (_, i) => `EvidenceSoftware${i} version 1.0`);
    const report = job(model);
    const bytes = await createTopologyImpactPdf(report.data, generated, { loadAsset: async name => new Uint8Array(readFileSync("public" + name)) });
    const pdf = await PDFDocument.load(bytes);
    const texts: string[] = [];
    for (const [, object] of pdf.context.enumerateIndirectObjects()) if (object instanceof PDFRawStream) {
      try { const content = inflateSync(object.contents).toString("latin1"); texts.push(...Array.from(content.matchAll(/<([0-9A-F]+)> Tj/g), match => Buffer.from(match[1], "hex").toString("latin1"))); } catch { /* Embedded image bytes are not page text. */ }
    }
    const text = texts.join(" ");
    for (const label of ["Executive impact brief", "Displayed topology", "Model and service context", "Service impact narrative", "Cyber analyst review", "Complete CI register", "Complete relationship register", "Endpoint evidence register", "LAST-ENDPOINT", "a64", "CVE-2026-12345", "EvidenceSoftware79", "Production", "not an outage simulation"]) expect(text).toContain(label);
    expect(pdf.getPageCount()).toBeGreaterThan(9);
    expect(pdf.getTitle()).toBe("Topology Impact Report");
    expect(text).not.toContain("asset sibling");
    expect(report.data.graph.nodes).toHaveLength(69);
  });
  it("wraps long service headings and scope labels within print margins", async () => {
    const model = fixture(1);
    model.nodes.find(node => node.kind === "business")!.name = "Long service name ".repeat(80) + "service-end";
    const report = job(model);
    report.data.scope.networks = ["Long network selection ".repeat(100) + "scope-end"];
    const spy = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      await createTopologyImpactPdf(report.data, generated, { loadAsset: async name => new Uint8Array(readFileSync("public" + name)) });
      const text = spy.mock.calls.map(([label]) => label).join(" ");
      expect(text).toContain("service-end"); expect(text).toContain("scope-end"); expect(text).toContain("continued");
      for (const [label, options] of spy.mock.calls) {
        expect(options?.y, label).toBeGreaterThanOrEqual(20); expect(options?.y, label).toBeLessThanOrEqual(818);
        expect(options?.x, label).toBeGreaterThanOrEqual(32);
        expect((options?.x ?? 0) + (options?.font?.widthOfTextAtSize(label, options.size ?? 10) ?? 0), label).toBeLessThanOrEqual(564);
      }
    } finally { spy.mockRestore(); }
  });
});
