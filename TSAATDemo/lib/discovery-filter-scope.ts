import {
  filterRealNetworkAssets,
  filterRealNetworks,
  isUnassignedNetworkId,
  UNASSIGNED_NETWORK_ID
} from "@/lib/network-scope";

export { isUnassignedNetworkId, UNASSIGNED_NETWORK_ID };

type SearchParamValue = string | string[] | undefined;

export type DiscoveryNetworkModellingStatusFilter = "modelled" | "not-modelled";
export type DiscoveryEnabledFilter = "enabled" | "not-enabled";

export interface DiscoveryNetworkStatusFilters {
  modellingStatus?: DiscoveryNetworkModellingStatusFilter;
  discoveryEnabled?: DiscoveryEnabledFilter;
}

function firstParam(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function sanitizeDiscoverySearchParams<T extends Record<string, SearchParamValue>>(searchParams: T): T {
  const sanitized = { ...searchParams };
  if (firstParam(sanitized.network) === UNASSIGNED_NETWORK_ID) {
    delete sanitized.network;
  }
  return sanitized;
}

export function filterDiscoveryNetworks<T extends { id: string }>(networks: T[]): T[] {
  return filterRealNetworks(networks);
}

export function normalizeDiscoveryNetworkModellingStatus(
  value: SearchParamValue
): DiscoveryNetworkModellingStatusFilter | undefined {
  const normalized = firstParam(value)?.trim().toLowerCase();
  if (normalized === "modelled" || normalized === "not-modelled") {
    return normalized;
  }
  return undefined;
}

export function normalizeDiscoveryEnabled(value: SearchParamValue): DiscoveryEnabledFilter | undefined {
  const normalized = firstParam(value)?.trim().toLowerCase();
  if (normalized === "enabled" || normalized === "not-enabled") {
    return normalized;
  }
  return undefined;
}

export function filterDiscoveryNetworksByStatus<T extends { modellingStatus: boolean; discoveryStatus: string }>(
  networks: T[],
  filters: DiscoveryNetworkStatusFilters
): T[] {
  return networks.filter((network) => {
    if (filters.modellingStatus === "modelled" && !network.modellingStatus) {
      return false;
    }
    if (filters.modellingStatus === "not-modelled" && network.modellingStatus) {
      return false;
    }
    if (filters.discoveryEnabled === "enabled" && network.discoveryStatus !== "Discovery Enabled") {
      return false;
    }
    if (filters.discoveryEnabled === "not-enabled" && network.discoveryStatus === "Discovery Enabled") {
      return false;
    }
    return true;
  });
}

export function filterDiscoveryAssets<T extends { networkId: string }>(assets: T[]): T[] {
  return filterRealNetworkAssets(assets);
}

export function removeUnassignedNetworkOption<T extends { networks: Array<{ id: string; label: string }> }>(
  options: T
): T {
  return {
    ...options,
    networks: filterDiscoveryNetworks(options.networks)
  };
}
