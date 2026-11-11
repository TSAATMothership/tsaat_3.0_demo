import type { CmdbAssetView } from "@/lib/cmdb-attributes";
import { scopeIds } from "@/lib/workspace-navigation";
import { securityDomainFilter } from "@/lib/security-domain.mjs";

/** Pin the loaded CMDB evidence and retain only header scope, not another explorer's filters. */
export function cmdbTopologyHref(asset: Pick<CmdbAssetView, "assetId" | "networkId" | "snapshotDate"> & Partial<Pick<CmdbAssetView, "topologyId" | "systemIds">>, workspaceSearch: string, topologyNetworkId?: string, topologySystemIds?: string): string {
  const source = new URLSearchParams(workspaceSearch);
  const target = new URLSearchParams({ discoveryView: "topology", topologyCi: asset.topologyId ?? `asset:${asset.assetId}`, dataDate: asset.snapshotDate });
  if (source.get("discoveryView") === "topology" && source.get("topologyMode") === "dependencies") target.set("topologyMode", "dependencies");
  for (const key of ["network", "system"] as const) {
    const ids = scopeIds(source.getAll(key));
    if (ids.length) target.set(key, ids.join(","));
  }
  if (topologyNetworkId) { target.delete("system"); target.set("network", topologyNetworkId); }
  if (topologySystemIds) { target.delete("network"); target.set("system", scopeIds(topologySystemIds).join(",")); }
  if (!target.has("network") && !target.has("system")) {
    if (asset.systemIds?.length) target.set("system", scopeIds(asset.systemIds).join(","));
    else if (asset.networkId) target.set("network", asset.networkId);
  }
  const domain = securityDomainFilter(source.has("securityDomain") ? source.getAll("securityDomain") : undefined);
  if (domain) target.set("securityDomain", domain);
  return `/discovery-coverage?${target}`;
}
