export const SYSTEMS_BLAST_RADIUS_SELECTION_EVENT = "tsaat:systems-blast-radius-selection";

export interface SystemsBlastRadiusSelectionDetail {
  systemId: string | null;
}

export function dispatchSystemsBlastRadiusSelection(detail: SystemsBlastRadiusSelectionDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<SystemsBlastRadiusSelectionDetail>(SYSTEMS_BLAST_RADIUS_SELECTION_EVENT, { detail }));
}

