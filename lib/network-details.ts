import { buildRiskEntityDetails, type RiskEntityDetailsModel } from "@/lib/risk-entity-details";
import type { Asset, ICTSystem, ManagedNetwork } from "@/lib/types";

export interface NetworkDetailsModel extends RiskEntityDetailsModel {
  linkedSystems: Array<Pick<ICTSystem, "id" | "name" | "criticality" | "securityDomain">>;
}

export function buildNetworkDetails(network: ManagedNetwork, assets: Asset[], linkedSystems: ICTSystem[]): NetworkDetailsModel {
  return {
    ...buildRiskEntityDetails(network, assets),
    linkedSystems: [...new Map(linkedSystems.map(system => [system.id, system])).values()]
      .sort((a, b) => a.name.localeCompare(b.name, "en-AU", { numeric: true }) || a.id.localeCompare(b.id))
      .map(({ id, name, criticality, securityDomain }) => ({ id, name, criticality, securityDomain }))
  };
}

export function networkDetailsHref(networkId: string, dataDate?: string, securityDomain?: string): string {
  const params = new URLSearchParams({ network: networkId, networkDetails: networkId });
  if (dataDate) params.set("dataDate", dataDate);
  if (securityDomain) params.set("securityDomain", securityDomain);
  return `/network-risk-profile?${params}`;
}
