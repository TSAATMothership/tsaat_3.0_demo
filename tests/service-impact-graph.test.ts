import { describe, expect, it } from "vitest";
import { buildServiceImpactGraph, filterServiceImpactGraph, generateImpactCoordinates, impactGraphNeighbours, impactGraphTotals, interpolateImpactPositions, layoutServiceImpactGraph, serviceImpactRiskView, serviceImpactScene, type ImpactDirection } from "@/lib/service-impact-graph";
import type { ServiceImpactFinding, ServiceImpactModel } from "@/lib/service-impact";

const finding = (id: string, assetId: string, systemId: string, severity: string): ServiceImpactFinding => ({ id, assetId, systemId, severity,
  spiId: 1, spiName: "Configured SPI", title: id, priority: 1, environment: "Production", timestamp: "2026-11-01", duration: 3, recommendedAction: "Review evidence" });
function fixture(): ServiceImpactModel {
  return { snapshotDate: "2026-11-04", unattributedFindings: 2, severities: [],
    systems: ["a", "b", "empty"].map(id => ({ id, name: `System ${id}`, appId: `APP-${id}`, criticality: "Critical" })),
    business: [{ id: "a", name: "Shared service", criticality: "Critical", systemIds: ["a", "b"] }],
    mission: [{ id: "a", name: "Shared capability", criticality: "Critical", systemIds: ["a", "b"] }],
    assets: ["a", "b", "no-findings"].map(id => ({ id, name: `Device ${id}`, ip: "10.0.0.1", model: "Server", lastDiscovered: "2026-11-01",
      discoveredBy: "Scanner", type: "server", systemId: id === "b" ? "b" : "a", systemName: "System", environment: "Production", securityDomain: "PROTECTED", vulnerabilities: [] })),
    findings: [finding("1", "a", "a", "Critical Exposure"), finding("2", "a", "a", "High Risk"), finding("3", "a", "a", "Custom severity"), finding("4", "b", "b", "High Risk")] };
}

describe("Service impact graph projection", () => {
  it("uses only selected systems and their affected CIs, with scoped shared-service counts", () => {
    const graph = buildServiceImpactGraph(fixture(), ["a", "a"]);
    expect(graph.nodes.map(node => node.id).sort()).toEqual(["asset:a", "business:a", "mission:a", "system:a"]);
    for (const node of graph.nodes) expect(node).toMatchObject({ findings: 3, critical: 1, high: 1, affectedCis: 1, systemIds: ["a"] });
    expect(graph.nodes[0].severities["Custom severity"]).toBe(1);
    expect(graph.edges).toHaveLength(3);
    expect(graph.edges.map(edge => edge.label).sort()).toEqual(["contains", "depends on", "depends on"]);
  });
  it("does not widen an empty or unknown system selection", () => {
    expect(buildServiceImpactGraph(fixture(), [])).toEqual({ nodes: [], edges: [] });
    expect(buildServiceImpactGraph(fixture(), ["missing"])).toEqual({ nodes: [], edges: [] });
  });
  it("keeps zero-finding systems and distinct IDs across entity kinds", () => {
    const graph = buildServiceImpactGraph(fixture(), ["a", "b", "empty"]);
    expect(graph.nodes.find(node => node.id === "system:empty")).toMatchObject({ findings: 0, affectedCis: 0 });
    expect(new Set(graph.nodes.map(node => node.id)).size).toBe(graph.nodes.length);
    expect(graph.nodes.find(node => node.id === "business:a")).toMatchObject({ findings: 4, affectedCis: 2 });
    expect(graph.edges.every(edge => graph.nodes.some(node => node.id === edge.source) && graph.nodes.some(node => node.id === edge.target))).toBe(true);
  });
  it("never restores findings or assets excluded by the header-scoped model", () => {
    const model = fixture(); model.assets = model.assets.filter(asset => asset.id !== "b"); model.findings = model.findings.filter(row => row.systemId !== "b");
    const graph = buildServiceImpactGraph(model, ["a", "b"]);
    expect(graph.nodes.find(node => node.id === "system:b")?.findings).toBe(0);
    expect(graph.nodes.some(node => node.id === "asset:b")).toBe(false);
    expect(graph.nodes.find(node => node.id === "business:a")?.findings).toBe(3);
  });
  it("expands only the requested system and can reveal a searched collapsed asset", () => {
    const graph = buildServiceImpactGraph(fixture(), ["a", "b"]);
    expect(serviceImpactScene(graph, [], null, false).nodes.every(node => node.kind !== "asset")).toBe(true);
    expect(serviceImpactScene(graph, ["a"], null, false).nodes.filter(node => node.kind === "asset").map(node => node.id)).toEqual(["asset:a"]);
    expect(serviceImpactScene(graph, [], "asset:b", false).nodes.some(node => node.id === "asset:b")).toBe(true);
  });
  it("focuses on recorded neighbours without borrowing the other system's assets", () => {
    const graph = buildServiceImpactGraph(fixture(), ["a", "b"]);
    const expected = new Set(["system:a", "business:a", "mission:a", "asset:a"]);
    expect(impactGraphNeighbours(graph, "system:a")).toEqual(expected);
    expect(new Set(serviceImpactScene(graph, [], "system:a", true).nodes.map(node => node.id))).toEqual(expected);
  });
  it("expands all systems without restoring CIs excluded by the risk filters or changing totals", () => {
    const graph = filterServiceImpactGraph(buildServiceImpactGraph(fixture(), ["a", "b"]), ["Critical Exposure"], 1, 1);
    const totals = impactGraphTotals(graph);
    expect(serviceImpactScene(graph, ["a", "b"], null, false).nodes.filter(node => node.kind === "asset").map(node => node.id)).toEqual(["asset:a"]);
    expect(serviceImpactScene(graph, [], null, false).nodes.filter(node => node.kind === "asset")).toEqual([]);
    expect(impactGraphTotals(graph)).toEqual(totals);
  });
  it("bounds large scenes, reports omitted nodes and prioritises a searched node and its system", () => {
    const model = fixture();
    for (let i = 0; i < 180; i++) {
      const id = `device-${i}`; model.assets.push({ ...model.assets[0], id }); model.findings.push(finding(`finding-${i}`, id, "a", "High Risk"));
    }
    const graph = buildServiceImpactGraph(model, ["a"]);
    const scene = serviceImpactScene(graph, ["a"], "asset:device-179", false);
    expect(scene.nodes).toHaveLength(140);
    expect(scene.omitted).toBe(graph.nodes.length - 140);
    expect(scene.nodes.slice(0, 2).map(node => node.id)).toEqual(["asset:device-179", "system:a"]);
    const ids = new Set(scene.nodes.map(node => node.id));
    expect(scene.edges.every(edge => ids.has(edge.source) && ids.has(edge.target))).toBe(true);
    expect(graph.nodes).toHaveLength(184);
  });
  it("lays out empty, disconnected and connected scenes deterministically without mutating data", () => {
    expect(layoutServiceImpactGraph({ nodes: [], edges: [] }).size).toBe(0);
    const graph = buildServiceImpactGraph(fixture(), ["a", "b", "empty"]);
    const original = structuredClone(graph), positions = layoutServiceImpactGraph(graph);
    expect(positions).toEqual(layoutServiceImpactGraph(graph));
    expect(graph).toEqual(original);
    expect(positions.size).toBe(graph.nodes.length);
    for (const point of positions.values()) expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
    expect(new Set([...positions.values()].map(point => `${point.x}:${point.y}`)).size).toBe(graph.nodes.length);
  });
});

describe("Graph risk filters", () => {
  it("aligns node counts, range bounds and details with each selected severity set", () => {
    const graph = buildServiceImpactGraph(fixture(), ["a", "b", "empty"]);
    const critical = serviceImpactRiskView(graph, ["Critical Exposure"], { min: 1, max: null });
    expect(critical).toMatchObject({ minimum: 1, maximum: 1, maxCount: 1, observedMaximum: 1 });
    expect(critical.graph.nodes).toHaveLength(4);
    expect(critical.graph.nodes.every(node => node.findings === 1 && node.high === 0 && node.findingRows[0].id === "1")).toBe(true);
    const high = serviceImpactRiskView(graph, ["High Risk"], { min: 1, max: null });
    expect(high.maximum).toBe(2);
    expect(high.graph.nodes.find(node => node.id === "business:a")).toMatchObject({ findings: 2, critical: 0, high: 2 });
    const combined = serviceImpactRiskView(graph, ["Critical Exposure", "High Risk"], { min: 2, max: 2 });
    expect(combined).toMatchObject({ minimum: 2, maximum: 2, maxCount: 3 });
    expect(combined.graph.nodes.map(node => node.id).sort()).toEqual(["asset:a", "system:a"]);
    expect(combined.graph.nodes.every(node => node.findings === 2 && node.findingRows.length === 2 && node.severities["Custom severity"] === undefined)).toBe(true);
    expect(impactGraphTotals(combined.graph).findings).toBe(2);
    expect(serviceImpactRiskView(graph, ["Custom severity"], { min: 1, max: null }).maximum).toBe(1);
  });
  it("keeps empty severity selections empty and never treats absent risk observations as matching positive counts", () => {
    const graph = buildServiceImpactGraph(fixture(), ["a", "b", "empty"]);
    expect(serviceImpactRiskView(graph, [], { min: 0, max: null }).graph.nodes).toEqual([]);
    expect(serviceImpactRiskView(graph, ["Not observed"], { min: 1, max: null })).toMatchObject({ observedMaximum: 0, minimum: 1, graph: { nodes: [], edges: [] } });
    expect(serviceImpactRiskView(graph, ["Not observed"], { min: 0, max: null }).graph.nodes.every(node => node.findings === 0)).toBe(true);
    expect(serviceImpactRiskView(graph, null, { min: 0, max: null }).graph).toEqual(graph);
  });
  it("shows matching devices when their parent system is excluded by the count range", () => {
    const model = fixture();
    model.assets.push({ ...model.assets[0], id: "second-device" });
    model.findings.push(finding("second-critical", "second-device", "a", "Critical Exposure"));
    const filtered = filterServiceImpactGraph(buildServiceImpactGraph(model, ["a", "b"]), ["Critical Exposure"], 1, 1);
    expect(filtered.nodes.map(node => node.id).sort()).toEqual(["asset:a", "asset:second-device"]);
    const scene = serviceImpactScene(filtered, [], null, false);
    expect(scene.nodes).toHaveLength(2);
    expect(scene.collapsed).toBe(0);
    expect(scene.edges).toEqual([]); // Never restore the excluded system or manufacture relationships.
    expect(serviceImpactScene(filtered, [], "asset:a", true).nodes.map(node => node.id)).toEqual(["asset:a"]);
  });
  it("combines selected severities and applies inclusive counts to every node without restoring excluded neighbours", () => {
    const graph = buildServiceImpactGraph(fixture(), ["a", "b", "empty"]), original = structuredClone(graph);
    const filtered = filterServiceImpactGraph(graph, ["Critical Exposure", "High Risk"], 2, 2);
    expect(filtered.nodes.map(node => node.id).sort()).toEqual(["asset:a", "system:a"]);
    expect(filtered.nodes.every(node => node.findings === 2 && node.critical === 1 && node.high === 1)).toBe(true);
    expect(filtered.edges).toHaveLength(1);
    expect(impactGraphTotals(filtered)).toMatchObject({ findings: 2, affectedCis: 1, systems: 1 });
    expect(graph).toEqual(original);
  });
  it("retains configured/unfamiliar severity keys and deduplicates shared findings in filtered totals", () => {
    const graph = filterServiceImpactGraph(buildServiceImpactGraph(fixture(), ["a", "b"]), ["Custom severity"], 1, 1);
    expect(graph.nodes).toHaveLength(4);
    expect(impactGraphTotals(graph)).toMatchObject({ findings: 1, critical: 0, high: 0, affectedCis: 1 });
    expect(graph.nodes.every(node => node.findingRows.every(row => row.severity === "Custom severity"))).toBe(true);
  });
  it("keeps explicit empty selections empty, handles missing severities and supports a deliberate zero-count range", () => {
    const graph = buildServiceImpactGraph(fixture(), ["a", "b", "empty"]);
    expect(filterServiceImpactGraph(graph, [], 0, 100)).toEqual({ nodes: [], edges: [] });
    expect(filterServiceImpactGraph(graph, ["Not observed"], 1, 100).nodes).toEqual([]);
    expect(filterServiceImpactGraph(graph, ["High Risk"], 2, 1).nodes).toEqual([]);
    expect(filterServiceImpactGraph(graph, ["High Risk"], 0, 0).nodes.map(node => node.id)).toEqual(["system:empty"]);
    expect(filterServiceImpactGraph(graph, ["High Risk"], 0, 100).nodes).toHaveLength(graph.nodes.length);
  });
  it("does not change filtered totals when the scene is expanded or focused", () => {
    const graph = filterServiceImpactGraph(buildServiceImpactGraph(fixture(), ["a", "b"]), ["High Risk"], 1, 10);
    const totals = impactGraphTotals(graph);
    serviceImpactScene(graph, ["a"], "system:a", true);
    expect(impactGraphTotals(graph)).toEqual(totals);
    expect(totals).toMatchObject({ findings: 2, affectedCis: 2 });
  });
});

describe("Impact layouts and transitions", () => {
  const graph = () => buildServiceImpactGraph(fixture(), ["a", "b", "empty"]);
  it.each(["left-right", "right-left", "top-down", "bottom-up"] as ImpactDirection[])("orders every directed edge in the %s hierarchy", direction => {
    const input = graph(), positions = layoutServiceImpactGraph(input, { kind: "hierarchical", direction });
    const axis = direction === "left-right" || direction === "right-left" ? "x" : "y";
    const sign = direction === "right-left" || direction === "bottom-up" ? -1 : 1;
    for (const edge of input.edges) expect((positions.get(edge.target)![axis] - positions.get(edge.source)![axis]) * sign).toBeGreaterThan(0);
    expect(new Set([...positions.values()].map(point => `${point.x}:${point.y}`)).size).toBe(input.nodes.length);
  });
  it("places circular nodes on a single circle and radial nodes in hub/neighbour/periphery rings", () => {
    const input = graph();
    const circle = layoutServiceImpactGraph(input, { kind: "circular" });
    expect(new Set([...circle.values()].map(point => Math.round(Math.hypot(point.x, point.y)))).size).toBe(1);
    const radial = layoutServiceImpactGraph(input, { kind: "circular", circularMode: "radial" });
    const centre = [...radial].find(([, point]) => point.x === 0 && point.y === 0)!;
    expect(centre).toBeDefined();
    expect(new Set([...radial.values()].map(point => Math.round(Math.hypot(point.x, point.y)))).size).toBeGreaterThan(2);
    const neighbours = [...impactGraphNeighbours(input, centre[0])].filter(id => id !== centre[0]);
    expect(new Set(neighbours.map(id => Math.round(Math.hypot(radial.get(id)!.x, radial.get(id)!.y)))).size).toBe(1);
    expect(radial.size).toBe(input.nodes.length); // Includes disconnected systems.
    const points = [...radial.values()];
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++)
      expect(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)).toBeGreaterThan(65);
  });
  it("generates repeatable X/Y coordinates and keeps them stable through filtering and expansion", () => {
    const input = graph(), coordinates = generateImpactCoordinates(input);
    expect(coordinates).toEqual(generateImpactCoordinates({ ...input, nodes: [...input.nodes].reverse() }));
    expect(new Set([...coordinates.values()].map(point => `${point.x}:${point.y}`)).size).toBe(input.nodes.length);
    const filtered = filterServiceImpactGraph(input, ["Critical Exposure"], 1, 5);
    const positions = layoutServiceImpactGraph(filtered, { kind: "spatial", coordinates });
    for (const node of filtered.nodes) expect(positions.get(node.id)).toEqual(coordinates.get(node.id));
    coordinates.set("asset:a", { x: -120, y: 800 });
    expect(layoutServiceImpactGraph(input, { kind: "spatial", coordinates }).get("asset:a")).toEqual({ x: -120, y: 800 });
    coordinates.set("asset:a", { x: Infinity, y: NaN });
    expect(layoutServiceImpactGraph(input, { kind: "spatial", coordinates }).get("asset:a")).toEqual(generateImpactCoordinates(input).get("asset:a"));
  });
  it.each(["force", "hierarchical", "circular", "spatial"] as const)("handles empty/single scenes and finite deterministic %s coordinates without mutations", kind => {
    expect(layoutServiceImpactGraph({ nodes: [], edges: [] }, { kind }).size).toBe(0);
    const input = graph(), original = structuredClone(input), points = layoutServiceImpactGraph(input, { kind });
    expect(points).toEqual(layoutServiceImpactGraph(input, { kind })); expect(input).toEqual(original);
    expect(layoutServiceImpactGraph({ nodes: [input.nodes[0]], edges: [] }, { kind }).size).toBe(1);
    expect([...points.values()].every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });
  it("uses connection weights in the force simulation without changing other layout families", () => {
    const input = graph(), weighted = { ...input, edges: input.edges.map(edge => ({ ...edge, weight: 4 })) };
    expect(layoutServiceImpactGraph(input)).not.toEqual(layoutServiceImpactGraph(weighted));
    expect(layoutServiceImpactGraph(input, { kind: "circular" })).toEqual(layoutServiceImpactGraph(weighted, { kind: "circular" }));
  });
  it("interpolates endpoints and intermediate frames, including newly visible and removed nodes", () => {
    const from = new Map([["a", { x: 0, y: 10 }], ["removed", { x: 100, y: 100 }]]);
    const to = new Map([["a", { x: 100, y: 210 }], ["new", { x: 20, y: 40 }]]);
    expect(interpolateImpactPositions(from, to, 0).get("a")).toEqual(from.get("a"));
    expect(interpolateImpactPositions(from, to, .5).get("a")).toEqual({ x: 50, y: 110 });
    expect(interpolateImpactPositions(from, to, 1)).toEqual(to);
    expect(interpolateImpactPositions(from, to, 2)).toEqual(to);
    expect(interpolateImpactPositions(from, to, .4).has("removed")).toBe(false);
    expect(interpolateImpactPositions(from, to, .4).get("new")).toEqual(to.get("new"));
    expect(from.get("a")).toEqual({ x: 0, y: 10 });
  });
});
