import { NOT_RECORDED } from "@/lib/endpoint-explorer";
import { TOPOLOGY_KINDS, type TopologyExplorerNode } from "@/lib/topology-explorer";

export const TOPOLOGY_FILTER_COLUMNS = [
  { key: "name", label: "CI name or ID" },
  { key: "software", label: "Installed software" },
  { key: "cve", label: "CVE code" },
  { key: "ip", label: "IP address" },
  { key: "kind", label: "CI type" }
] as const;
export type TopologyFilterColumn = typeof TOPOLOGY_FILTER_COLUMNS[number]["key"];
export type TopologyColumnFilters = Partial<Record<TopologyFilterColumn, string[]>>;

export function topologyNameLabel(node: TopologyExplorerNode): string {
  return [node.name, node.sourceId, node.hostname].filter((value, index, all) => value && all.indexOf(value) === index).join(" · ");
}

/** Displayed choices come from the existing scoped projection; no new evidence is inferred. */
export function topologyFilterValues(node: TopologyExplorerNode, column: TopologyFilterColumn): string[] {
  if (column === "name") return [node.id]; // Stable identity keeps bookmarks compact and survives display-name changes.
  if (column === "kind") return [TOPOLOGY_KINDS[node.kind].label];
  // Model CIs do not have endpoint software, CVE or IP evidence, even when endpoints are associated.
  if (node.kind !== "asset") return [];
  const values = column === "software" ? node.software : column === "cve" ? node.cves : [node.ip];
  const recorded = [...new Set(values.map(value => value.trim()).filter(Boolean))];
  return recorded.length ? recorded : [NOT_RECORDED];
}

/** Match any selected value within a field and all selected fields, as in End Point Explorer. */
export function filterTopologyNodes(nodes: readonly TopologyExplorerNode[], filters: TopologyColumnFilters, except?: TopologyFilterColumn) {
  return nodes.filter(node => TOPOLOGY_FILTER_COLUMNS.every(({ key }) => key === except || !filters[key]?.length ||
    topologyFilterValues(node, key).some(value => filters[key]!.includes(value))));
}

/** One count per CI per value; facet options respect every filter except their own field. */
export function topologyFacetCounts(nodes: readonly TopologyExplorerNode[], filters: TopologyColumnFilters, column: TopologyFilterColumn) {
  const counts = new Map<string, number>();
  for (const node of filterTopologyNodes(nodes, filters, column)) for (const value of topologyFilterValues(node, column)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Read only known fields and bounded string selections; older topology_* text bookmarks remain separate. */
export function parseTopologyColumnFilters(encoded: string | null | undefined): TopologyColumnFilters {
  if (!encoded) return {};
  try {
    const value: unknown = JSON.parse(encoded);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: TopologyColumnFilters = {};
    for (const [key, values] of Object.entries(value)) {
      const column = TOPOLOGY_FILTER_COLUMNS.find(column => column.key === key);
      if (!column || !Array.isArray(values) || values.length > 10000 || !values.every(item => typeof item === "string" && item.length <= 1024)) return {};
      if (values.length) result[column.key] = [...new Set(values)];
    }
    return result;
  } catch { return {}; }
}

export function serializeTopologyColumnFilters(filters: TopologyColumnFilters): string | null {
  const entries = TOPOLOGY_FILTER_COLUMNS.filter(({ key }) => filters[key]?.length).map(({ key }) => [key, filters[key]]);
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : null;
}
