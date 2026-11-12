import { TOPOLOGY_KINDS, layoutTopology, type TopologyExplorerModel, type TopologyExplorerNode, type traceTopology } from "@/lib/topology-explorer";
import { securityDomainSelection } from "@/lib/security-domain.mjs";
import { scopeIds } from "@/lib/workspace-navigation";
import type { ImpactLayout, ImpactNodePosition } from "@/lib/topology-layout";
import type { DocumentEnvelope } from "@/lib/documents/contracts";

export type TopologyTrace = ReturnType<typeof traceTopology>;
export interface TopologyImpactReportData {
  snapshotDate: string;
  selection: string;
  scope: { networks: string[]; systems: string[]; domains: string[] };
  filters: string[];
  graph: TopologyTrace;
  layout: ImpactLayout;
  positions: Array<{ id: string; x: number; y: number }>;
}
export type TopologyImpactReportJob = DocumentEnvelope<"pdf-topology-impact", TopologyImpactReportData>;

/** Freeze the displayed evidence for generation/retry; no re-query or provider-specific read. */
export function topologyImpactReportJob(model: TopologyExplorerModel, graph: TopologyTrace, selection: string,
  params: URLSearchParams, filters: string[], layout: ImpactLayout, displayedPositions: ReadonlyMap<string, ImpactNodePosition>,
  generatedAt = new Date()): TopologyImpactReportJob {
  const labels = (field: "network" | "system") => scopeIds(params.getAll(field)).map(id => {
    const node = model.nodes.find(node => node.kind === field && node.sourceId === id);
    return node ? `${node.name} (${id})` : id;
  });
  const positions = graph.nodes.every(node => displayedPositions.has(node.id)) ? displayedPositions : layoutTopology(graph, layout);
  const data: TopologyImpactReportData = {
    snapshotDate: model.snapshotDate, selection, filters,
    scope: { networks: labels("network"), systems: labels("system"), domains: securityDomainSelection(params.has("securityDomain") ? params.getAll("securityDomain") : undefined) },
    graph, layout,
    positions: graph.nodes.map(node => ({ id: node.id, ...(displayedPositions.get(node.id) ?? positions.get(node.id) ?? { x: 0, y: 0 }) }))
  };
  return { version: 1, kind: "pdf-topology-impact", filename: `topology-impact-${model.snapshotDate}.pdf`,
    title: "Topology Impact Report", generatedAt: generatedAt.toISOString(), data: structuredClone(data) };
}

/** Describe only recorded paths in this report. Associations alone cannot prove operational impact. */
export function topologyImpactNarrative(data: TopologyImpactReportData) {
  const { graph } = data;
  const selected = new Set(graph.rootIds);
  const counts = Object.fromEntries(Object.keys(TOPOLOGY_KINDS).map(kind => [kind, graph.nodes.filter(node => node.kind === kind).length])) as Record<TopologyExplorerNode["kind"], number>;
  const structural = graph.edges.filter(edge => edge.kind !== "observation");
  const adjacency = new Map<string, string[]>();
  for (const edge of structural) { const targets = adjacency.get(edge.source) ?? []; targets.push(edge.target); adjacency.set(edge.source, targets); }
  const related = (node: TopologyExplorerNode) => {
    const visited = new Set([node.id]), queue = [node.id];
    for (let i = 0; i < queue.length; i++) for (const id of adjacency.get(queue[i]) ?? []) if (!visited.has(id)) { visited.add(id); queue.push(id); }
    return graph.nodes.filter(item => item.id !== node.id && visited.has(item.id));
  };
  const services = graph.nodes.filter(node => node.kind === "business" || node.kind === "mission").map(node => {
    const members = related(node), systems = members.filter(item => item.kind === "system").length, endpoints = members.filter(item => item.kind === "asset").length;
    const selectedEndpoints = members.filter(item => item.kind === "asset" && selected.has(item.id)).length;
    return { node, systems, endpoints, selectedEndpoints,
      narrative: `${node.name} has recorded paths to ${systems} ICT system(s) and ${endpoints} endpoint CI(s) in this view. ${selectedEndpoints} of those endpoints are starting CIs. ${endpoints ? "Review these model associations when assessing a proposed change or disruption." : "No endpoints are included beneath this service in the displayed view; this does not establish that it has no endpoint dependencies."}` };
  });
  const connected = new Set(graph.edges.flatMap(edge => [edge.source, edge.target]));
  const isolated = graph.nodes.filter(node => !connected.has(node.id));
  const summary = [
    `${graph.rootIds.length} starting CI(s) produce a displayed topology of ${graph.nodes.length} distinct CIs and ${graph.edges.length} recorded relationships. Shared nodes and relationships are counted once.`,
    `The view contains ${counts.network} network(s), ${counts.system} ICT system(s), ${counts.business} business service(s), ${counts.mission} mission service(s) and ${counts.asset} endpoint CI(s).`,
    services.length ? "The service associations below identify recorded business and mission context for impact review. They do not establish that every displayed service would fail if a selected CI were unavailable."
      : "No business or mission service association is present in the displayed view. Confirm missing model relationships before drawing conclusions about business impact.",
    isolated.length ? `${isolated.length} displayed CI(s) have no recorded relationship in this view. They are retained in the evidence register; missing links do not prove independence.` : "Every displayed CI has at least one recorded relationship within this view."
  ];
  return { counts, summary, services, isolated };
}
