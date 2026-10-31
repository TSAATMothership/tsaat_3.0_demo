import type { DiscoveryComplianceFilters } from "@/lib/discovery-compliance-explorer";
import type { EndpointFilters } from "@/lib/endpoint-explorer";
import type { SoftwareFilters } from "@/lib/installed-software-explorer";
import type { ShadowFilters } from "@/lib/shadow-it-explorer";
import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

type ExplorerFilters = {
  tools: never;
  compliance: DiscoveryComplianceFilters;
  endpoints: EndpointFilters;
  "installed-software": SoftwareFilters;
  "shadow-it": ShadowFilters;
};

/** Only carry the shared workspace scope; local filters belong to their destination. */
export function discoveryExplorerHref<V extends keyof ExplorerFilters>(
  view: V, scope: WorkspaceSearchParams, snapshotDate: string, filters?: ExplorerFilters[V]
): string {
  const query = new URLSearchParams({ discoveryView: view, dataDate: snapshotDate });
  for (const key of ["network", "system"] as const) {
    const ids = scopeIds(scope[key]);
    if (ids.length) query.set(key, ids.join(","));
  }
  if (filters) query.set("discoveryFilters", JSON.stringify(filters));
  return `/discovery-coverage?${query}`;
}

/** Treat a malformed or out-of-date deep link as the unfiltered explorer. */
export function initialDiscoveryFilters<T>(
  value: string | string[] | undefined, parse: (value: unknown) => T, empty: () => T
): T {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw.length > 12000) return empty();
  try { return parse(JSON.parse(raw)); } catch { return empty(); }
}
