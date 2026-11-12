import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { parseFilters, filterNetworks, filterSystems } from "@/lib/selectors";
import { matchesSecurityDomain } from "@/lib/security-domain.mjs";
import { isRealNetworkId } from "@/lib/network-scope";
import { hasWorkspaceScope, scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { layoutTopologyGraph, type ImpactGraph, type ImpactLayout, type ImpactNodePosition } from "@/lib/topology-layout";
import type { Dataset } from "@/lib/types";

export type TopologyKind = "business" | "mission" | "network" | "system" | "asset";
export const TOPOLOGY_KINDS: Record<TopologyKind, { label: string; short: string; color: string }> = {
  business: { label: "Business Service", short: "BS", color: "#bba0ff" },
  mission: { label: formatAssetTypeLabel("mission-capability"), short: "MS", color: "#53d7c0" },
  network: { label: "Managed Network", short: "NET", color: "#fbab75" },
  system: { label: "ICT System", short: "SYS", color: "#79bfff" },
  asset: { label: "Endpoint CI", short: "CI", color: "#f1cb80" }
};
export interface TopologyExplorerNode {
  id: string; sourceId: string; kind: TopologyKind; name: string; type: string;
  hostname: string; ip: string; domain: string; software: string[]; cves: string[];
  scope?: { network?: string; system?: string };
}
export interface TopologyExplorerEdge {
  id: string; source: string; target: string; label: string;
  kind: "membership" | "association" | "hosting" | "hierarchy" | "observation";
  environments?: string[];
}
export interface TopologyExplorerModel {
  snapshotDate: string; nodes: TopologyExplorerNode[]; edges: TopologyExplorerEdge[];
}
export const TOPOLOGY_MODES = [{ id: "business-impact", label: "Business Impact" }, { id: "dependencies", label: "Dependencies" }] as const;
export type TopologyMode = typeof TOPOLOGY_MODES[number]["id"];
export const parseTopologyMode = (value: string | null | undefined): TopologyMode => value === "dependencies" ? "dependencies" : "business-impact";
export interface TopologyLookup { name: string; software: string; cve: string; ip: string; kind: string }
export const emptyTopologyLookup = (): TopologyLookup => ({ name: "", software: "", cve: "", ip: "", kind: "" });
const key = (kind: TopologyKind, id: string) => `${kind}:${id}`;
const sorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** Recorded model relationships, independently scoped by each CI's security domain. */
export function buildTopologyExplorer(dataset: Dataset, params: WorkspaceSearchParams): TopologyExplorerModel {
  const model: TopologyExplorerModel = { snapshotDate: dataset.snapshotDate, nodes: [], edges: [] };
  if (!hasWorkspaceScope(params)) return model;
  const systemScope = scopeIds(params.system), networkScope = scopeIds(params.network);
  if (networkScope.length && !networkScope.some(isRealNetworkId)) return model;
  const filters = parseFilters({ network: params.network, system: params.system, securityDomain: params.securityDomain });
  const systems = filterSystems(dataset.ictSystems, filters).filter(system => isRealNetworkId(system.networkId));
  const networks = filterNetworks(dataset.managedNetworks, filters, dataset.ictSystems);
  // Environment membership can record multiple systems; retain every in-scope association.
  const memberships = new Map<string, Set<string>>();
  const environments = new Map<string, Set<string>>();
  const assetById = new Map(dataset.assets.map(asset => [asset.id, asset]));
  const addMembership = (asset: string, system: string, environment: string) => {
    const ids = memberships.get(asset) ?? new Set(); ids.add(system); memberships.set(asset, ids);
    const identity = JSON.stringify([asset, system]), values = environments.get(identity) ?? new Set();
    if (environment) values.add(environment);
    environments.set(identity, values);
  };
  for (const system of dataset.ictSystems) for (const environment of system.environments) for (const assetId of environment.assetIds) addMembership(assetId, system.id, environment.type);
  for (const asset of dataset.assets) if (asset.systemContext) addMembership(asset.id, asset.systemContext.systemId, asset.systemContext.environmentType);
  const assets = dataset.assets.filter(asset => {
    if (!isRealNetworkId(asset.networkId) || !matchesSecurityDomain(asset.securityDomain, filters.securityDomain)) return false;
    if (networkScope.length && !networkScope.includes(asset.networkId)) return false;
    const ids = memberships.get(asset.id) ?? new Set<string>();
    const owner = asset.type === "ip-node" && asset.arpOwnerAssetId ? assetById.get(asset.arpOwnerAssetId) : undefined;
    const ownerIds = owner?.networkId === asset.networkId ? memberships.get(owner.id) : undefined;
    return !systemScope.length || systemScope.some(id => ids.has(id) || ownerIds?.has(id));
  });
  const nodes = new Map<string, TopologyExplorerNode>();
  const add = (kind: TopologyKind, sourceId: string, name: string, domain = "") => {
    const id = key(kind, sourceId);
    if (!nodes.has(id)) nodes.set(id, { id, sourceId, kind, name, type: TOPOLOGY_KINDS[kind].label, hostname: "", ip: "", domain, software: [], cves: [] });
    return nodes.get(id)!;
  };
  for (const network of networks) add("network", network.id, network.name, network.securityDomain).scope = { network: network.id };
  for (const system of systems) {
    add("system", system.id, system.name, system.securityDomain).scope = { system: system.id };
    for (const [kind, associations] of [["business", system.businessServices], ["mission", system.missionCapabilities]] as const) for (const association of associations) {
      const node = add(kind, association.id, association.name);
      node.scope = { system: sorted([...(node.scope?.system?.split(",") ?? []), system.id]).join(",") };
    }
  }
  for (const asset of assets) {
    Object.assign(add("asset", asset.id, asset.name || asset.hostname || asset.id, asset.securityDomain), {
      type: formatAssetTypeLabel(asset.type), hostname: asset.hostname || "", ip: asset.ipAddress?.trim() || "", scope: { network: asset.networkId },
      software: "installedSoftware" in asset ? sorted(asset.installedSoftware.map(item => `${item.name} ${item.version}`.trim())) : [],
      cves: sorted(asset.vulnerabilities.map(item => item.cve))
    });
  }
  const edges = new Map<string, TopologyExplorerEdge>();
  const edge = (source: string, target: string, label: string, kind: TopologyExplorerEdge["kind"], environments?: string[]) => {
    if (source === target || !nodes.has(source) || !nodes.has(target)) return;
    const id = JSON.stringify([source, target, kind]); edges.set(id, { id, source, target, label, kind, ...(environments ? { environments } : {}) });
  };
  for (const system of systems) {
    const id = key("system", system.id);
    edge(key("network", system.networkId), id, "hosts", "hosting");
    for (const service of system.businessServices) edge(key("business", service.id), id, "depends on", "association");
    for (const mission of system.missionCapabilities) edge(key("mission", mission.id), id, "depends on", "association");
    if (system.parentSystemId) edge(key("system", system.parentSystemId), id, "contains system", "hierarchy");
    for (const child of system.childSystemIds ?? []) edge(id, key("system", child), "contains system", "hierarchy");
  }
  for (const network of networks) {
    const id = key("network", network.id);
    if (network.parentNetworkId) edge(key("network", network.parentNetworkId), id, "contains network", "hierarchy");
    for (const child of network.childNetworkIds ?? []) edge(id, key("network", child), "contains network", "hierarchy");
  }
  for (const asset of assets) {
    const id = key("asset", asset.id);
    edge(key("network", asset.networkId), id, "contains CI", "membership");
    for (const systemId of memberships.get(asset.id) ?? []) edge(key("system", systemId), id, "contains CI", "membership", sorted([...(environments.get(JSON.stringify([asset.id, systemId])) ?? [])]));
    if (asset.type === "ip-node" && asset.arpOwnerAssetId && assetById.get(asset.arpOwnerAssetId)?.networkId === asset.networkId) edge(key("asset", asset.arpOwnerAssetId), id, "observed in ARP table", "observation");
  }
  model.nodes = [...nodes.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  model.edges = [...edges.values()].sort((a, b) => a.id.localeCompare(b.id));
  return model;
}

function walkTopology(seeds: Iterable<string>, edges: TopologyExplorerEdge[], reverse = false) {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const from = reverse ? edge.target : edge.source, to = reverse ? edge.source : edge.target;
    const list = adjacency.get(from) ?? []; list.push(to); adjacency.set(from, list);
  }
  const visited = new Set(seeds), queue = [...visited];
  for (let index = 0; index < queue.length; index++) for (const next of adjacency.get(queue[index]) ?? []) {
    if (!visited.has(next)) { visited.add(next); queue.push(next); }
  }
  return visited;
}

/** All entered fields combine with AND. Inventory/IP/CVE filters match endpoint evidence only. */
export function lookupTopology(nodes: TopologyExplorerNode[], filters: TopologyLookup) {
  const contains = (value: string, query: string) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  return nodes.filter(node => (!filters.kind || node.kind === filters.kind)
    && contains(`${node.name} ${node.hostname} ${node.sourceId}`, filters.name)
    && (!filters.ip.trim() || contains(node.ip, filters.ip))
    && (!filters.software.trim() || node.software.some(value => contains(value, filters.software)))
    && (!filters.cve.trim() || node.cves.some(value => contains(value, filters.cve))));
}

/** Context walks never expand down from an ancestor into unrelated sibling branches. */
export function traceTopology(model: TopologyExplorerModel, rootId: string, mode: TopologyMode = "business-impact") {
  return traceTopologySelection(model, [rootId], mode);
}

/** Trace all selected results in one pass, including results beyond the lookup's current page. */
export function traceTopologySelection(model: TopologyExplorerModel, selectedIds: readonly string[], mode: TopologyMode = "business-impact") {
  const nodesById = new Map(model.nodes.map(node => [node.id, node]));
  const rootIds = [...new Set(selectedIds)].filter(id => nodesById.has(id));
  if (!rootIds.length) return { nodes: [], edges: [], rootIds, mode, memberCount: 0 };
  // Dependencies includes only declared model links. ARP observation remains Business Impact context.
  const context = model.edges.filter(edge => mode === "business-impact" || edge.kind !== "observation");
  const descendants = walkTopology(rootIds,
    context.filter(edge => mode === "dependencies" || nodesById.get(edge.target)?.kind !== "asset"));
  const memberCount = [...descendants].filter(id => nodesById.get(id)?.kind === "asset").length;
  // Add ancestors only after expansion; hosting networks/shared systems cannot seed sibling branches.
  const visited = walkTopology(descendants, context, true);
  return { mode, rootIds, nodes: model.nodes.filter(node => visited.has(node.id)),
    edges: context.filter(edge => visited.has(edge.source) && visited.has(edge.target)), memberCount };
}

export function layoutTopology(graph: Pick<TopologyExplorerModel, "nodes" | "edges">, kind: ImpactLayout, compact = false): Map<string, ImpactNodePosition> {
  if (kind === "hierarchical" && compact) {
    // Narrow screens keep readable two-column tiers and grow vertically instead of shrinking every label.
    const positions = new Map<string, ImpactNodePosition>();
    let y = 0;
    for (const kinds of [["business", "mission"], ["network", "system"], ["asset"]]) {
      const nodes = graph.nodes.filter(node => kinds.includes(node.kind));
      nodes.forEach((node, index) => positions.set(node.id, { x: nodes.length === 1 ? 100 : (index % 2) * 200, y: y + Math.floor(index / 2) * 130 }));
      if (nodes.length) y += Math.ceil(nodes.length / 2) * 130 + 70;
    }
    return positions;
  }
  // Reuse Impact Topology's layouts; network and system nodes share its model tier.
  const impact: ImpactGraph = { edges: graph.edges, nodes: graph.nodes.map(node => ({ ...node,
    kind: node.kind === "network" ? "system" : node.kind })) };
  return layoutTopologyGraph(impact, { kind, direction: "top-down", circularMode: "radial" });
}
