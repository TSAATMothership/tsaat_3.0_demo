export const UNASSIGNED_NETWORK_ID = "net-unassigned";

export function isUnassignedNetworkId(networkId: string | null | undefined): boolean {
  return networkId?.trim() === UNASSIGNED_NETWORK_ID;
}

export function isRealNetworkId(networkId: string | null | undefined): boolean {
  return Boolean(networkId?.trim()) && !isUnassignedNetworkId(networkId);
}

export function normalizeManagedNetworkFilter(networkId: string | null | undefined): string | undefined {
  const normalized = networkId?.trim();
  if (!normalized || isUnassignedNetworkId(normalized)) {
    return undefined;
  }
  return normalized;
}

export function filterRealNetworks<T extends { id: string }>(networks: T[]): T[] {
  return networks.filter((network) => isRealNetworkId(network.id));
}

export function filterRealNetworkAssets<T extends { networkId: string }>(assets: T[]): T[] {
  return assets.filter((asset) => isRealNetworkId(asset.networkId));
}

export function filterRealNetworkEvaluations<T extends { networkId: string }>(evaluations: T[]): T[] {
  return evaluations.filter((evaluation) => isRealNetworkId(evaluation.networkId));
}

export function filterRealNetworkFindings<T extends { scope: { networkId: string } }>(findings: T[]): T[] {
  return findings.filter((finding) => isRealNetworkId(finding.scope.networkId));
}
