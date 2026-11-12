import { describe, expect, it, vi } from "vitest";
import { buildTopologyExplorer, emptyTopologyLookup, layoutTopology, lookupTopology, traceTopology, parseTopologyMode } from "@/lib/topology-explorer";
import { WORKSPACE_GROUPS, activeWorkspaceItem } from "@/lib/workspace-navigation";
import { defaultPersonaSettings, personaAllowsHref } from "@/lib/personas";
import type { Dataset, ICTSystem, ManagedNetwork, ServerAsset } from "@/lib/types";
function system(id: string, extra: Partial<ICTSystem> = {}): ICTSystem {
    return { id, name: id, networkId: "n1", securityDomain: "PROTECTED", criticality: "Critical", adfPlatform: false, enterprisePlatform: false,
        modellingStatus: true, diisDefined: true, environments: [], businessServices: [{ id: `bs-${id}`, name: `Service ${id}`, criticality: "Critical" }],
        missionCapabilities: [{ id: `mc-${id}`, name: `Mission ${id}`, criticality: "Critical" }], ...extra };
}
function network(id: string, extra: Partial<ManagedNetwork> = {}): ManagedNetwork {
    return { id, name: id, securityDomain: "PROTECTED", criticality: "Critical", modellingStatus: true, adfPlatform: false, enterprisePlatform: false, discoveryStatus: "Discovery Enabled", assetIds: [], ictSystemIds: [], ...extra };
}
function server(id: string, extra: Partial<ServerAsset> = {}): ServerAsset {
    return { id, name: `Server ${id}`, hostname: `host-${id}`, networkId: "n1", securityDomain: "PROTECTED", type: "server", installedSoftware: [], vulnerabilities: [], operatingSystem: null,
        lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" }, ...extra };
}
export function topologyFixture(): Dataset {
    return { snapshotDate: "2026-11-07", generatedAt: "2026-11-07",
        managedNetworks: [network("n1"), network("n2"), network("n3", { securityDomain: "SECRET" })],
        ictSystems: [system("s1"), system("s2", { environments: [{ id: "e2", name: "Shared", type: "Production", assetIds: ["a"] }] }), system("s3", { networkId: "n2" }), system("s4", { networkId: "n3", securityDomain: "SECRET" })],
        assets: [server("a", { ipAddress: "10.24.1.5", systemContext: { systemId: "s1", environmentType: "Production" }, installedSoftware: [{ name: "OpenSSL", version: "3.0.1", supportStatus: "Supported" }],
                vulnerabilities: [{ id: "v1", assetId: "a", cve: "CVE-2024-1234", description: "", remediationGuidance: "", criticality: "High", severity: "High", exploitability: "No Known Exploit", detectedDate: "2026-11-01", capturedAt: "2026-11-01", source: "Scanner" }] }),
            server("b", { systemContext: { systemId: "s2", environmentType: "Production" } }), server("outside", { networkId: "n2" }), server("secret", { securityDomain: "SECRET", systemContext: { systemId: "s4", environmentType: "Production" } }),
            server("alone", { networkId: "orphan" }),
            { id: "arp", name: "Unidentified", hostname: "", ipAddress: "10.24.1.9", networkId: "n1", securityDomain: "UNKNOWN", type: "ip-node", discoveryApproach: "ARP Table", arpOwnerAssetId: "a", lifecycle: { eolStatus: "Unknown", warrantyStatus: "Unknown" }, vulnerabilities: [] }] };
}
const scope = { network: "n1" };
const ids = (graph: {
    nodes: {
        id: string;
    }[];
}) => graph.nodes.map(node => node.id).sort();
function dependencyFixture(): Dataset {
    const data = topologyFixture();
    data.assets.push(server("c", { systemContext: { systemId: "s1", environmentType: "Production" } }));
    data.ciDependencies = [
        { id: "out", sourceAssetId: "a", targetAssetId: "b", dependencyType: "Flow Dependency", protocol: "TCP", sourcePort: 51000, targetPort: 443, observedAt: "2026-11-06T12:00:00Z", observationMethod: "Flow collector" },
        { id: "in", sourceAssetId: "b", targetAssetId: "a", dependencyType: "Flow Dependency", protocol: "UDP", targetPort: 53 },
        { id: "second", sourceAssetId: "b", targetAssetId: "c", dependencyType: "Flow Dependency" },
        { id: "outside", sourceAssetId: "a", targetAssetId: "outside", dependencyType: "Flow Dependency" },
        { id: "secret", sourceAssetId: "secret", targetAssetId: "a", dependencyType: "Flow Dependency" }
    ];
    return data;
}
describe("Topology graph modes", () => {
    it("retains mode bookmark compatibility", () => {
        for (const value of [undefined, null, "", "upstream", "unexpected"]) expect(parseTopologyMode(value)).toBe("business-impact");
        expect(parseTopologyMode("dependencies")).toBe("dependencies");
    });
    it("shows endpoint model ancestors without communication peers or siblings", () => {
        const graph = traceTopology(buildTopologyExplorer(dependencyFixture(), scope), "asset:a", "dependencies");
        expect(ids(graph)).toEqual(["asset:a", "business:bs-s1", "business:bs-s2", "mission:mc-s1", "mission:mc-s2", "network:n1", "system:s1", "system:s2"]);
        expect(graph.edges.every(edge => !edge.source.startsWith("asset:"))).toBe(true);
        expect(graph.edges.some(edge => edge.source.startsWith("mission:") && edge.target.startsWith("business:"))).toBe(false);
    });
    it.each(["system:s1", "business:bs-s1", "mission:mc-s1"])("expands recorded member endpoints of %s, then ancestors without sibling expansion", root => {
        const graph = traceTopology(buildTopologyExplorer(dependencyFixture(), scope), root, "dependencies");
        expect(graph.memberCount).toBe(2);
        expect(graph.nodes.filter(node => node.kind === "asset").map(node => node.id).sort()).toEqual(["asset:a", "asset:c"]);
        for (const id of ["network:n1", "system:s2", "business:bs-s2", "mission:mc-s2"]) expect(ids(graph)).toContain(id);
        expect(traceTopology(buildTopologyExplorer(dependencyFixture(), scope), root).nodes.some(node => node.kind === "asset")).toBe(false);
    });
    it("includes network CIs even when no system membership is recorded", () => {
        const graph = traceTopology(buildTopologyExplorer(dependencyFixture(), { ...scope, securityDomain: "PROTECTED" }), "network:n1", "dependencies");
        expect(graph.memberCount).toBe(3);
        expect(graph.nodes.filter(node => node.kind === "asset").map(node => node.id).sort()).toEqual(["asset:a", "asset:b", "asset:c"]);
        expect(ids(graph)).not.toContain("asset:outside");
    });
    it("ignores both types of CI dependency without altering stored records", () => {
        const data = dependencyFixture();
        data.ciDependencies!.push({ id: "logical", sourceAssetId: "a", targetAssetId: "outside", dependencyType: "Logical Dependency" });
        const before = JSON.stringify(data);
        const model = buildTopologyExplorer(data, scope);
        expect(JSON.stringify(data)).toBe(before);
        const without = { ...data, ciDependencies: undefined };
        expect(model).toEqual(buildTopologyExplorer(without, scope));
        expect(model.edges.every(edge => ["membership", "association", "hosting", "hierarchy", "observation"].includes(edge.kind))).toBe(true);
    });
    it("excludes ARP observations from Dependencies without fabricating system membership", () => {
        const model = buildTopologyExplorer(topologyFixture(), { system: "s1" });
        const graph = traceTopology(model, "asset:arp", "dependencies");
        expect(ids(graph)).toEqual(["asset:arp", "network:n1"]);
        expect(graph.edges.map(edge => edge.kind)).toEqual(["membership"]);
        expect(ids(traceTopology(model, "system:s1", "dependencies"))).not.toContain("asset:arp");
        expect(traceTopology(model, "asset:arp").edges.some(edge => edge.kind === "observation")).toBe(true);
    });
    it("keeps system, network and independent security-domain restrictions", () => {
        const data = dependencyFixture();
        data.ictSystems[1].securityDomain = "SECRET";
        const graph = traceTopology(buildTopologyExplorer(data, { system: "s1", securityDomain: "PROTECTED" }), "system:s1", "dependencies");
        expect(graph.memberCount).toBe(2);
        for (const id of ["system:s2", "business:bs-s2", "mission:mc-s2", "asset:b", "asset:outside", "asset:secret"]) expect(ids(graph)).not.toContain(id);
        expect(buildTopologyExplorer(data, { ...scope, securityDomain: "NONE" }).nodes).toEqual([]);
    });
    it("retains every environment type per system membership and deduplicates overlapping context", () => {
        const data = topologyFixture();
        data.ictSystems[0].environments = [
            { id: "prod", name: "Live", type: "Production", assetIds: ["a", "a"] },
            { id: "test", name: "Test", type: "Test", assetIds: ["a"] }
        ];
        const graph = traceTopology(buildTopologyExplorer(data, scope), "asset:a", "dependencies");
        const memberships = graph.edges.filter(edge => edge.target === "asset:a" && edge.source === "system:s1");
        expect(memberships).toHaveLength(1);
        expect(memberships[0].environments).toEqual(["Production", "Test"]);
        expect(graph.edges.find(edge => edge.source === "system:s2" && edge.target === "asset:a")?.environments).toEqual(["Production"]);
        expect(graph.edges.find(edge => edge.source === "network:n1" && edge.target === "asset:a")?.environments).toBeUndefined();
    });
    it("expands explicit hierarchy safely through cycles and duplicate declarations", () => {
        const data = topologyFixture();
        data.ictSystems[0].childSystemIds = ["s2", "s2"];
        data.ictSystems[1].parentSystemId = "s1";
        data.ictSystems[1].childSystemIds = ["s1"];
        const graph = traceTopology(buildTopologyExplorer(data, scope), "system:s1", "dependencies");
        expect(graph.memberCount).toBe(2);
        expect(new Set(graph.edges.map(edge => edge.id)).size).toBe(graph.edges.length);
        expect(ids(graph)).toContain("asset:b");
    });
    it("leaves missing membership unknown and unavailable roots empty", () => {
        const model = buildTopologyExplorer(topologyFixture(), { network: "orphan" });
        expect(ids(traceTopology(model, "asset:alone", "dependencies"))).toEqual(["asset:alone"]);
        expect(traceTopology(model, "asset:alone", "dependencies").edges).toEqual([]);
        expect(traceTopology(model, "missing", "dependencies").nodes).toEqual([]);
    });
});
describe("Topology lookup and recorded paths", () => {
    it("includes every CI category, including endpoints without findings, and excludes other networks", () => {
        const model = buildTopologyExplorer(topologyFixture(), scope);
        expect(new Set(model.nodes.map(node => node.kind))).toEqual(new Set(["asset", "system", "network", "business", "mission"]));
        expect(ids(model)).toContain("asset:b");
        expect(ids(model)).not.toContain("asset:outside");
        expect(ids(model)).not.toContain("system:s3");
        expect(ids(model)).not.toContain("business:bs-s3");
    });
    it("combines case-insensitive name, software/version, CVE and IP filters without searching unrelated attributes", () => {
        const nodes = buildTopologyExplorer(topologyFixture(), scope).nodes;
        for (const field of [{ name: "HOST-A" }, { name: "Server a" }, { software: "openssl" }, { software: "3.0.1" }, { cve: "cve-2024-1234" }, { ip: "10.24.1.5" }]) {
            expect(lookupTopology(nodes, { ...emptyTopologyLookup(), ...field }).map(node => node.id)).toEqual(["asset:a"]);
        }
        expect(lookupTopology(nodes, { name: " a ", software: "OpenSSL", cve: "CVE-2024", ip: "10.24", kind: "asset" }).map(node => node.id)).toEqual(["asset:a"]);
        expect(lookupTopology(nodes, { ...emptyTopologyLookup(), software: "OpenSSL", cve: "CVE-0000" })).toEqual([]);
        expect(lookupTopology(nodes, { ...emptyTopologyLookup(), software: "Service" })).toEqual([]);
        expect(lookupTopology(nodes, { ...emptyTopologyLookup(), kind: "system" })).toHaveLength(2);
        expect(lookupTopology(nodes, { ...emptyTopologyLookup(), ip: "10.24.1." })).toHaveLength(2);
    });
    it("traces all recorded memberships upstream to both services and missions, without sibling endpoints", () => {
        const trace = traceTopology(buildTopologyExplorer(topologyFixture(), scope), "asset:a");
        expect(trace.mode).toBe("business-impact");
        expect(ids(trace)).toEqual(["asset:a", "business:bs-s1", "business:bs-s2", "mission:mc-s1", "mission:mc-s2", "network:n1", "system:s1", "system:s2"]);
        expect(trace.edges.filter(edge => edge.kind === "association")).toHaveLength(4);
        expect(trace.edges.some(edge => edge.source.startsWith("mission:") && edge.target.startsWith("business:"))).toBe(false);
    });
    it.each(["business:bs-s1", "mission:mc-s1", "system:s1", "network:n1"])("traces %s downstream to systems/networks without endpoint expansion", root => {
        const graph = traceTopology(buildTopologyExplorer(topologyFixture(), scope), root);
        expect(graph.mode).toBe("business-impact");
        expect(ids(graph)).toContain("network:n1");
        expect(ids(graph)).toContain("system:s1");
        expect(graph.nodes.some(node => node.kind === "asset")).toBe(false);
        if (root !== "network:n1")
            expect(ids(graph)).not.toContain("system:s2");
        if (root !== "network:n1")
            expect(ids(graph)).not.toContain("business:bs-s2");
        else
            expect(ids(graph)).toContain("business:bs-s2");
        expect(ids(graph)).toContain("business:bs-s1");
        expect(ids(graph)).toContain("mission:mc-s1");
    });
    it("retains explicit system/network hierarchies, deduplicates edges and terminates cycles", () => {
        const data = topologyFixture();
        data.ictSystems[0].childSystemIds = ["s2", "s2"];
        data.ictSystems[1].parentSystemId = "s1";
        data.managedNetworks[0].childNetworkIds = ["n2"];
        data.managedNetworks[1].childNetworkIds = ["n1"];
        const model = buildTopologyExplorer(data, { network: "n1,n2" });
        const down = traceTopology(model, "system:s1");
        expect(ids(down)).toContain("system:s2");
        expect(down.edges.filter(edge => edge.kind === "hierarchy" && edge.source.startsWith("system:"))).toHaveLength(1);
        expect(ids(traceTopology(model, "network:n1"))).toContain("network:n2");
        expect(new Set(model.edges.map(edge => edge.id)).size).toBe(model.edges.length);
    });
    it("preserves independent domain boundaries and does not leak filtered CI metadata", () => {
        const data = topologyFixture();
        data.ictSystems[0].securityDomain = "SECRET";
        const model = buildTopologyExplorer(data, { ...scope, securityDomain: "PROTECTED", environment: "Test", assetType: "printer-device" });
        expect(ids(model)).toContain("asset:a");
        expect(ids(model)).not.toContain("system:s1");
        expect(ids(model)).not.toContain("business:bs-s1");
        expect(JSON.stringify(model)).not.toContain("Server secret");
        expect(ids(model)).not.toContain("asset:arp");
        expect(model.edges.every(edge => ids(model).includes(edge.source) && ids(model).includes(edge.target))).toBe(true);
        expect(buildTopologyExplorer(data, { ...scope, securityDomain: "NONE" }).nodes).toEqual([]);
        expect(buildTopologyExplorer(data, {}).nodes).toEqual([]);
        expect(buildTopologyExplorer(data, { network: "net-unassigned" }).nodes).toEqual([]);
    });
    it("supports shared system membership and explicit ARP observation without inventing CI membership", () => {
        const model = buildTopologyExplorer(topologyFixture(), { system: "s1" });
        expect(ids(model)).toContain("asset:arp");
        expect(ids(model)).not.toContain("asset:b");
        const trace = traceTopology(model, "asset:arp");
        expect(ids(trace)).toContain("business:bs-s1");
        expect(trace.edges.find(edge => edge.target === "asset:arp" && edge.source === "asset:a")?.label).toBe("observed in ARP table");
        expect(trace.edges.some(edge => edge.source === "system:s1" && edge.target === "asset:arp")).toBe(false);
        expect(ids(buildTopologyExplorer(topologyFixture(), { system: "s2" }))).toContain("asset:a");
    });
    it("leaves missing associations empty and never substitutes another selected CI", () => {
        const model = buildTopologyExplorer(topologyFixture(), { network: "orphan" });
        expect(ids(traceTopology(model, "asset:alone"))).toEqual(["asset:alone"]);
        expect(traceTopology(model, "asset:alone").edges).toEqual([]);
        expect(traceTopology(model, "missing").nodes).toEqual([]);
    });
    it("does not use an ARP owner from a different network to assign scope or paths", () => {
        const data = topologyFixture();
        data.assets.find(asset => asset.id === "arp")!.networkId = "n2";
        expect(ids(buildTopologyExplorer(data, { system: "s1" }))).not.toContain("asset:arp");
        const trace = traceTopology(buildTopologyExplorer(data, { network: "n1,n2" }), "asset:arp");
        expect(ids(trace)).not.toContain("asset:a");
        expect(ids(trace)).not.toContain("system:s1");
    });
    it("keeps every node in readable compact hierarchical tiers", () => {
        const graph = traceTopology(buildTopologyExplorer(topologyFixture(), scope), "asset:a");
        const positions = layoutTopology(graph, "hierarchical", true);
        expect(positions.size).toBe(graph.nodes.length);
        expect(Math.max(...[...positions.values()].map(point => point.x))).toBe(200);
        expect(new Set([...positions.values()].map(point => `${point.x}:${point.y}`)).size).toBe(graph.nodes.length);
    });
    it.each(["hierarchical", "force", "circular"] as const)("reuses stable finite %s layout coordinates without mutating relationships", layout => {
        const graph = traceTopology(buildTopologyExplorer(topologyFixture(), scope), "asset:a"), before = JSON.stringify(graph);
        const positions = layoutTopology(graph, layout);
        expect(positions.size).toBe(graph.nodes.length);
        expect([...positions.values()].every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
        expect(layoutTopology(graph, layout)).toEqual(positions);
        expect(JSON.stringify(graph)).toBe(before);
    });
    it("places Topology Explorer after Shadow IT and retains persona visibility controls", () => {
        const items = WORKSPACE_GROUPS.find(group => group.id === "discovery")!.items;
        const item = items[items.findIndex(item => item.id === "discovery-shadow-it") + 1];
        expect(item.id).toBe("discovery-topology");
        expect(activeWorkspaceItem("/discovery-coverage", new URLSearchParams("discoveryView=topology"))?.id).toBe(item.id);
        const settings = defaultPersonaSettings();
        settings.personas[1].pages = settings.personas[1].pages.filter(page => page !== item.id);
        expect(personaAllowsHref(settings, "life-cycle-management", item.href)).toBe(false);
        expect(personaAllowsHref(settings, null, item.href)).toBe(true);
    });
});
vi.mock("@/lib/data-loader", () => ({ loadDatasetForDate: vi.fn() }));
import { loadDatasetForDate } from "@/lib/data-loader";
import { loadTopologyExplorer } from "@/lib/topology-explorer-data";
it("loads one full historical snapshot using the shared facade", async () => {
    vi.mocked(loadDatasetForDate).mockResolvedValue(topologyFixture());
    const model = await loadTopologyExplorer({ ...scope, dataDate: ["2026-11-08"] });
    expect(loadDatasetForDate).toHaveBeenCalledWith("2026-11-08", { profile: "full" });
    expect(model.snapshotDate).toBe("2026-11-07");
});
