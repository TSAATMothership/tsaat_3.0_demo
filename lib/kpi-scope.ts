import { filterRealNetworks } from "@/lib/network-scope";
import { filterSystems } from "@/lib/selectors";
import type { Dataset, Filters, ICTSystem, ManagedNetwork } from "@/lib/types";
import { scopeIds } from "@/lib/workspace-navigation";
import { matchesSecurityDomain } from "@/lib/security-domain.mjs";

export interface KpiScope {
  systems: ICTSystem[];
  networks: ManagedNetwork[];
}

/** KPIs assess systems; network selection finds systems through their infrastructure. */
export function resolveKpiScope(dataset: Dataset, filters: Filters): KpiScope {
  const selectedNetworks = new Set(scopeIds(filters.managedNetwork));
  const assetById = new Map(dataset.assets.map((asset) => [asset.id, asset]));
  const networksBySystem = new Map<string, Set<string>>();
  const addNetwork = (systemId: string, networkId: string) => {
    const ids = networksBySystem.get(systemId) ?? new Set<string>();
    ids.add(networkId);
    networksBySystem.set(systemId, ids);
  };
  for (const asset of dataset.assets) {
    if (asset.systemContext) addNetwork(asset.systemContext.systemId, asset.networkId);
  }
  // Shared infrastructure can be listed in several systems' environments.
  for (const system of dataset.ictSystems) {
    for (const environment of system.environments) {
      for (const assetId of environment.assetIds) {
        const asset = assetById.get(assetId);
        if (asset) addNetwork(system.id, asset.networkId);
      }
    }
  }
  const systems = filterSystems(dataset.ictSystems, { ...filters, managedNetwork: undefined })
    .filter((system) => !selectedNetworks.size ||
      [...(networksBySystem.get(system.id) ?? [])].some((id) => selectedNetworks.has(id)));
  const systemNetworkIds = new Set(systems.flatMap((system) => [...(networksBySystem.get(system.id) ?? [])]));
  const networks = filterRealNetworks(dataset.managedNetworks).filter((network) => matchesSecurityDomain(network.securityDomain, filters.securityDomain) &&
    (selectedNetworks.size ? selectedNetworks.has(network.id) : systemNetworkIds.has(network.id)));
  return { systems, networks };
}
