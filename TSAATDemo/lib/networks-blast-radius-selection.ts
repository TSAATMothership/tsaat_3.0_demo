export const NETWORKS_BLAST_RADIUS_SELECTION_EVENT = "tsaat:networks-blast-radius-selection";

export interface NetworksBlastRadiusSelectionDetail {
  networkId: string | null;
}

export function dispatchNetworksBlastRadiusSelection(detail: NetworksBlastRadiusSelectionDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<NetworksBlastRadiusSelectionDetail>(NETWORKS_BLAST_RADIUS_SELECTION_EVENT, { detail }));
}

