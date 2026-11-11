import { describe, expect, it } from "vitest";
import { cmdbTopologyHref } from "@/lib/cmdb-topology-navigation";
import { defaultPersonaSettings, personaAllowsHref } from "@/lib/personas";

const asset = { assetId: "srv-123", networkId: "net-1", snapshotDate: "2026-10-31" };
const url = (search: string) => new URL(cmdbTopologyHref(asset, search), "http://localhost");
describe("CMDB to Topology Explorer navigation", () => {
  it("selects the exact CI and resolved CMDB snapshot while retaining network/domain scope", () => {
    const target = url("?network=net-1&securityDomain=SECRET&dataDate=2026-11-01&discoveryView=endpoints");
    expect(target.pathname).toBe("/discovery-coverage");
    expect(Object.fromEntries(target.searchParams)).toEqual({ discoveryView: "topology", topologyCi: "asset:srv-123", dataDate: "2026-10-31", network: "net-1", securityDomain: "SECRET" });
  });
  it("retains selected systems without adding the endpoint network as a second filter", () => {
    const query = url("system=sys-2&system=sys-1,sys-2&securityDomain=UNKNOWN,PROTECTED").searchParams;
    expect(query.get("system")).toBe("sys-1,sys-2"); expect(query.has("network")).toBe(false);
    expect(query.get("securityDomain")).toBe("PROTECTED,UNKNOWN");
  });
  it("retains multiple network IDs and explicit empty domain scope", () => {
    expect(url("network=net-2&network=net-1,net-2&securityDomain=NONE").searchParams.get("network")).toBe("net-1,net-2");
    expect(url("network=net-1&securityDomain=NONE").searchParams.get("securityDomain")).toBe("NONE");
    expect(url("network=net-1&securityDomain=").searchParams.get("securityDomain")).toBe("NONE");
  });
  it("uses the CI network only when opened without a header scope", () => {
    expect(url("").searchParams.get("network")).toBe("net-1");
    expect(url("network=net-other").searchParams.get("network")).toBe("net-other");
    expect(url("system=sys-1").searchParams.has("network")).toBe(false);
    expect(url("network=net-unassigned").searchParams.get("network")).toBe("net-unassigned");
  });
  it("drops unrelated and stale lookup filters, selections and pagination", () => {
    const query = url("network=net-1&topologyCi=asset:old&topology_name=wrong&topology_software=old&topology_cve=CVE-x&topology_ip=10&topology_kind=system&topology_filters=%7B%22kind%22%3A%5B%22ICT%20System%22%5D%7D&discoveryFilters=old&copView=impact&page=12&environment=Test").searchParams;
    expect([...query.keys()].sort()).toEqual(["dataDate", "discoveryView", "network", "topologyCi"]);
  });
  it("encodes IDs as one value without allowing query or fragment injection", () => {
    const id = "server / A&network=outside#fragment";
    const target = new URL(cmdbTopologyHref({ ...asset, assetId: id }, "network=net-1"), "http://localhost");
    expect(target.searchParams.get("topologyCi")).toBe(`asset:${id}`); expect(target.searchParams.getAll("network")).toEqual(["net-1"]); expect(target.hash).toBe("");
  });
  it("preserves a selected Dependencies mode only when navigating from Topology Explorer", () => {
    expect(url('discoveryView=topology&topologyMode=dependencies').searchParams.get('topologyMode')).toBe('dependencies');
    expect(url('discoveryView=endpoints&topologyMode=dependencies').searchParams.has('topologyMode')).toBe(false);
    expect(url('discoveryView=topology&topologyMode=invalid').searchParams.has('topologyMode')).toBe(false);
  });
  it("opens an external dependency peer in its network only when the caller supplies that context", () => {
    const peer = new URL(cmdbTopologyHref(asset, 'discoveryView=topology&topologyMode=dependencies&system=sys-2&network=net-9&securityDomain=PROTECTED', 'net-1'), 'http://localhost');
    expect(peer.searchParams.get('network')).toBe('net-1'); expect(peer.searchParams.has('system')).toBe(false);
    expect(peer.searchParams.get('securityDomain')).toBe('PROTECTED'); expect(peer.searchParams.get('topologyMode')).toBe('dependencies');
  });
  it("resolves to the existing persona-controlled Topology Explorer page", () => {
    const settings = defaultPersonaSettings();
    const analyst = settings.personas.find(persona => persona.id === "analyst")!;
    analyst.pages = analyst.pages.filter(id => id !== "discovery-topology");
    expect(personaAllowsHref(settings, "analyst", cmdbTopologyHref(asset, ""))).toBe(false);
    expect(personaAllowsHref(settings, null, cmdbTopologyHref(asset, ""))).toBe(true);
  });
});
