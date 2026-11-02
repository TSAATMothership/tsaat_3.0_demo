import { buildRiskEntityDetails, type RiskEntityDetailsModel } from "@/lib/risk-entity-details";
import type { Asset, ICTSystem, ManagedNetwork } from "@/lib/types";

export interface IctSystemDetailsModel extends RiskEntityDetailsModel {
  apmNumber: string;
  linkedNetworks: Array<Pick<ManagedNetwork, "id" | "name" | "criticality"> & { classification: string }>;
}

export function buildIctSystemDetails(system: ICTSystem, assets: Asset[], linkedNetworks: ManagedNetwork[]): IctSystemDetailsModel {
  return {
    ...buildRiskEntityDetails(system, assets),
    apmNumber: system.apmNumber?.trim() || "",
    linkedNetworks: [...new Map(linkedNetworks.map(network => [network.id, network])).values()]
      .sort((a, b) => a.name.localeCompare(b.name, "en-AU", { numeric: true }) || a.id.localeCompare(b.id))
      .map(({ id, name, criticality, classification }) => ({ id, name, criticality, classification: classification?.trim() || "Not recorded" }))
  };
}

export function ictSystemDetailsHref(systemId: string, dataDate?: string): string {
  const params = new URLSearchParams({ system: systemId, systemDetails: systemId });
  if (dataDate) params.set("dataDate", dataDate);
  return `/ict-system-risk-profile?${params}`;
}
