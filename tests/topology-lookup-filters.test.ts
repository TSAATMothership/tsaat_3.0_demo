import { describe, expect, it } from "vitest";
import { NOT_RECORDED } from "@/lib/endpoint-explorer";
import { emptyTopologyLookup, lookupTopology, type TopologyExplorerNode } from "@/lib/topology-explorer";
import { filterTopologyNodes, parseTopologyColumnFilters, serializeTopologyColumnFilters, topologyFacetCounts, topologyFilterValues, topologyNameLabel } from "@/lib/topology-lookup-filters";

const node = (id: string, patch: Partial<TopologyExplorerNode> = {}): TopologyExplorerNode => ({ id: `asset:${id}`, sourceId: id, kind: "asset", name: "Server " + id,
  type: "Server", hostname: "host-" + id, ip: "10.0.0." + id, domain: "SECRET", software: [], cves: [], ...patch });
const nodes = [node("1", { software: ["Alpha 1", "Alpha 1", "Beta 2"], cves: ["CVE-2026-1"] }),
  node("2", { software: ["Alpha 1"], cves: ["CVE-2026-2"] }), node("3", { software: ["Alpha 10"], ip: "" }),
  node("4", { software: [" "] }), node("sys", { id: "system:sys", kind: "system", hostname: "", ip: "", type: "ICT System" })];
describe("Topology header filters", () => {
  it("offers searchable names, IDs and hostnames without duplicate tokens", () => {
    expect(topologyFilterValues(nodes[0], "name")).toEqual(["asset:1"]);
    expect(topologyNameLabel(nodes[0])).toBe("Server 1 · 1 · host-1");
    expect(topologyNameLabel(node("1", { name: "host-1" }))).toBe("host-1 · 1");
    expect(topologyFilterValues(nodes[4], "kind")).toEqual(["ICT System"]);
  });
  it("keeps CI selection tied to identity when the display name changes", () => {
    const selected = { name: topologyFilterValues(nodes[0], "name") }, renamed = { ...nodes[0], name: "Renamed server" };
    expect(filterTopologyNodes([renamed, nodes[1]], parseTopologyColumnFilters(serializeTopologyColumnFilters(selected)))).toEqual([renamed]);
    expect(serializeTopologyColumnFilters(selected)).not.toContain("Server 1");
  });
  it("keeps both former mission type labels working under the Mission Service label", () => {
    const mission = node("mission", { id: "mission:mission", kind: "mission", type: "Mission Service" });
    const filters = parseTopologyColumnFilters(JSON.stringify({ kind: ["Mission Capability", "Mission System", "Mission Service"], name: ["mission:mission"] }));
    expect(filters).toEqual({ kind: ["Mission Service"], name: ["mission:mission"] });
    expect(filterTopologyNodes([...nodes, mission], filters)).toEqual([mission]);
    expect(parseTopologyColumnFilters(serializeTopologyColumnFilters(filters))).toEqual(filters);
    expect(topologyFacetCounts([mission], filters, "kind")).toEqual([{ value: "Mission Service", count: 1 }]);
  });
  it("combines exact multi-selections with OR within fields and AND between fields", () => {
    expect(filterTopologyNodes(nodes, { software: ["Alpha 1", "Beta 2"] }).map(row => row.sourceId)).toEqual(["1", "2"]);
    expect(filterTopologyNodes(nodes, { software: ["Alpha 1"], cve: ["CVE-2026-2"], kind: ["Endpoint CI"] }).map(row => row.sourceId)).toEqual(["2"]);
    expect(filterTopologyNodes(nodes, { kind: ["ICT System", "Endpoint CI"] })).toEqual(nodes);
    expect(filterTopologyNodes(nodes, { name: topologyFilterValues(nodes[0], "name"), ip: ["10.0.0.2"] })).toEqual([]);
    expect(filterTopologyNodes(nodes, { software: ["alpha 1"] })).toEqual([]);
    expect(filterTopologyNodes(nodes, {})).toEqual(nodes);
  });
  it("counts each CI once per option and excludes a facet's own selection", () => {
    expect(topologyFacetCounts(nodes, { software: ["Beta 2"] }, "software").find(row => row.value === "Alpha 1")?.count).toBe(2);
    expect(topologyFacetCounts(nodes, { software: ["Alpha 1"], cve: ["CVE-2026-1"] }, "software")).toEqual([{ value: "Alpha 1", count: 1 }, { value: "Beta 2", count: 1 }]);
    expect(topologyFacetCounts(nodes, { software: ["Alpha 1"] }, "kind")).toEqual([{ value: "Endpoint CI", count: 2 }]);
  });
  it("keeps absent endpoint evidence explicit without treating model CIs as endpoints", () => {
    expect(filterTopologyNodes(nodes, { software: [NOT_RECORDED] }).map(row => row.sourceId)).toEqual(["4"]);
    expect(filterTopologyNodes(nodes, { ip: [NOT_RECORDED] }).map(row => row.sourceId)).toEqual(["3"]);
    expect(topologyFilterValues(nodes[4], "software")).toEqual([]);
    expect(filterTopologyNodes(nodes, { cve: [NOT_RECORDED] }).map(row => row.sourceId)).toEqual(["3", "4"]);
    expect(topologyFacetCounts([], {}, "kind")).toEqual([]);
  });
  it("retains legacy partial-match bookmarks alongside new selections without changing nodes", () => {
    const original = structuredClone(nodes);
    const legacy = lookupTopology(nodes, { ...emptyTopologyLookup(), name: "HOST", software: "alpha" });
    expect(filterTopologyNodes(legacy, { software: ["Alpha 1"] }).map(row => row.sourceId)).toEqual(["1", "2"]);
    expect(nodes).toEqual(original);
  });
  it("round-trips known selections and retains unavailable choices for clearing after a scope change", () => {
    const filters = { name: ["CI with &, commas and Unicode Ω"], kind: ["ICT System"], ip: ["missing IP"] };
    expect(parseTopologyColumnFilters(serializeTopologyColumnFilters(filters))).toEqual(filters);
    expect(parseTopologyColumnFilters('{"kind":["ICT System","ICT System"]}')).toEqual({ kind: ["ICT System"] });
    expect(serializeTopologyColumnFilters({ kind: [] })).toBeNull();
    expect(filterTopologyNodes(nodes, parseTopologyColumnFilters('{"ip":["no longer available"]}'))).toEqual([]);
  });
  it.each([null, "", "bad JSON", "null", "[]", '{"unexpected":["value"]}', '{"name":"value"}', '{"name":[12]}', JSON.stringify({ name: ["x".repeat(1025)] }), JSON.stringify({ name: Array(10001).fill("a") })])("ignores malformed or excessive bookmark filters", encoded => {
    expect(parseTopologyColumnFilters(encoded)).toEqual({});
  });
});
