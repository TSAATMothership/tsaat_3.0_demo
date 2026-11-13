import type { Dataset } from "@/lib/types";
import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

/** Retain ARP owners as context even when their own domain is excluded by the final projector. */
export function topologyReadAssets(dataset: Dataset, scope: WorkspaceSearchParams) {
  const networks = scopeIds(scope.network), systems = scopeIds(scope.system);
  if (!networks.length && !systems.length) return [];
  const memberships = new Map<string, Set<string>>();
  const add = (assetId: string, systemId: string) => {
    const ids = memberships.get(assetId) ?? new Set<string>(); ids.add(systemId); memberships.set(assetId, ids);
  };
  for (const system of dataset.ictSystems) for (const environment of system.environments)
    for (const id of environment.assetIds) add(id, system.id);
  for (const asset of dataset.assets) if (asset.systemContext) add(asset.id, asset.systemContext.systemId);
  const byId = new Map(dataset.assets.map(asset => [asset.id, asset]));
  const selected = dataset.assets.filter(asset => {
    if (networks.length && !networks.includes(asset.networkId)) return false;
    const owner = asset.type === "ip-node" ? byId.get(asset.arpOwnerAssetId ?? "") : undefined;
    return !systems.length || systems.some(id => memberships.get(asset.id)?.has(id) ||
      (owner?.networkId === asset.networkId && memberships.get(owner.id)?.has(id)));
  });
  const ids = new Set(selected.map(asset => asset.id));
  for (const asset of selected) if (asset.type === "ip-node" && asset.arpOwnerAssetId) {
    const owner = byId.get(asset.arpOwnerAssetId);
    if (owner?.networkId === asset.networkId) ids.add(owner.id);
  }
  return dataset.assets.filter(asset => ids.has(asset.id));
}
