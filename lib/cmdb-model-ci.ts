import { filterSystems, parseFilters } from "@/lib/selectors";
import { matchesSecurityDomain } from "@/lib/security-domain.mjs";
import { isRealNetworkId } from "@/lib/network-scope";
import { modelCiTopologyId, type ModelCiType } from "@/lib/cmdb-ci-types";
import type { Dataset } from "@/lib/types";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export interface CmdbModelCiDetails {
  snapshotDate: string;
  ciId: string;
  ciName: string;
  ciType: ModelCiType;
  criticality: string;
  relatedSystems: string;
  relatedNetworks: string;
  relatedSecurityDomains: string;
  systemIds: string[];
  topologyId: string;
}
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** Derive one logical CI from its recorded system associations at the selected snapshot/scope. */
export function buildCmdbModelCiDetails(dataset: Dataset, ciType: ModelCiType, ciId: string, params: WorkspaceSearchParams): CmdbModelCiDetails | null {
  const filters = parseFilters({ network: params.network, system: params.system, securityDomain: params.securityDomain });
  const field = ciType === "business-service" ? "businessServices" : "missionCapabilities";
  const systems = filterSystems(dataset.ictSystems, filters).filter(system =>
    isRealNetworkId(system.networkId) && system[field].some(ci => ci.id === ciId));
  if (!systems.length) return null;
  const records = systems.flatMap(system => system[field].filter(ci => ci.id === ciId));
  const names = unique(records.map(ci => ci.name.trim()));
  const criticalities = unique(records.map(ci => ci.criticality));
  const networkIds = new Set(systems.map(system => system.networkId));
  const networks = dataset.managedNetworks.filter(network => networkIds.has(network.id) && matchesSecurityDomain(network.securityDomain, filters.securityDomain));
  return {
    snapshotDate: dataset.snapshotDate, ciId, ciType, topologyId: modelCiTopologyId(ciType, ciId),
    ciName: names.join(" / ") || ciId,
    criticality: criticalities.length > 1 ? `${criticalities.join(" / ")} (varies by related system)` : criticalities[0] || "Not recorded",
    relatedSystems: unique(systems.map(system => `${system.name} (${system.id}) — ${unique(system[field].filter(ci => ci.id === ciId).map(ci => ci.criticality)).join(" / ")}`)).join("; "),
    relatedNetworks: unique(networks.map(network => `${network.name} (${network.id})`)).join("; "),
    relatedSecurityDomains: unique(systems.map(system => system.securityDomain)).join(", "),
    systemIds: unique(systems.map(system => system.id))
  };
}

