export const UNASSIGNED_NETWORK_ID = "net-unassigned";

type SearchParamValue = string | string[] | undefined;

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

export function removeUnassignedNetworkOption<T extends { networks: Array<{ id: string; label: string }> }>(
  options: T
): T {
  return {
    ...options,
    networks: options.networks.filter((network) => network.id !== UNASSIGNED_NETWORK_ID)
  };
}
