import { Asset, Filters, ICTSystem, ManagedNetwork } from "@/lib/types";
import { filterRealNetworks, normalizeManagedNetworkFilter } from "@/lib/network-scope";
import { scopeIds } from "@/lib/workspace-navigation";
import { matchesSecurityDomain, securityDomainFilter, SECURITY_DOMAINS } from "@/lib/security-domain.mjs";

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): Filters {
  const getValue = (key: string): string | undefined => {
    const value = searchParams[key];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  return {
    managedNetwork: scopeIds(searchParams.network).filter((id) => normalizeManagedNetworkFilter(id)).join(",") || undefined,
    ictSystem: scopeIds(searchParams.system).join(",") || undefined,
    systemCriticality: (getValue("criticality") as Filters["systemCriticality"]) || undefined,
    securityDomain: securityDomainFilter(searchParams.securityDomain),
    environment: (getValue("environment") as Filters["environment"]) || undefined,
    assetType: (getValue("assetType") as Filters["assetType"]) || undefined,
    severity: (getValue("severity") as Filters["severity"]) || undefined,
    missionCapability: getValue("mission") || undefined,
    businessService: getValue("service") || undefined
  };
}

export function applyAssetFilters(
  assets: Asset[],
  systems: ICTSystem[],
  filters: Filters
): Asset[] {
  const systemById = new Map(systems.map((system) => [system.id, system]));
  const networkIds = scopeIds(filters.managedNetwork).filter((id) => normalizeManagedNetworkFilter(id));
  const systemIds = scopeIds(filters.ictSystem);

  return assets.filter((asset) => {
    if (networkIds.length && !networkIds.includes(asset.networkId)) {
      return false;
    }

    if (filters.assetType && asset.type !== filters.assetType) {
      return false;
    }

    if (!matchesSecurityDomain(asset.securityDomain, filters.securityDomain)) {
      return false;
    }

    const systemId = asset.systemContext?.systemId;
    const system = systemId ? systemById.get(systemId) : undefined;

    if (systemIds.length && (!systemId || !systemIds.includes(systemId))) {
      return false;
    }

    if (filters.systemCriticality && system?.criticality !== filters.systemCriticality) {
      return false;
    }

    if (filters.environment && asset.systemContext?.environmentType !== filters.environment) {
      return false;
    }

    if (
      filters.missionCapability &&
      !system?.missionCapabilities.some((capability) => capability.id === filters.missionCapability)
    ) {
      return false;
    }

    if (
      filters.businessService &&
      !system?.businessServices.some((service) => service.id === filters.businessService)
    ) {
      return false;
    }

    return true;
  });
}

export function filterNetworks(networks: ManagedNetwork[], filters: Filters, systems: ICTSystem[] = []): ManagedNetwork[] {
  const realNetworks = filterRealNetworks(networks);
  const networkIds = scopeIds(filters.managedNetwork).filter((id) => normalizeManagedNetworkFilter(id));
  const systemIds = scopeIds(filters.ictSystem);
  const systemNetworkIds = new Set(systems.filter((system) => systemIds.includes(system.id)).map((system) => system.networkId));
  return realNetworks.filter((network) => matchesSecurityDomain(network.securityDomain, filters.securityDomain) && (!networkIds.length || networkIds.includes(network.id)) && (!systemIds.length || systemNetworkIds.has(network.id)));
}

export function filterSystems(systems: ICTSystem[], filters: Filters): ICTSystem[] {
  const networkIds = scopeIds(filters.managedNetwork).filter((id) => normalizeManagedNetworkFilter(id));
  const systemIds = scopeIds(filters.ictSystem);
  return systems.filter((system) => {
    if (networkIds.length && !networkIds.includes(system.networkId)) {
      return false;
    }
    if (systemIds.length && !systemIds.includes(system.id)) {
      return false;
    }
    if (filters.systemCriticality && system.criticality !== filters.systemCriticality) {
      return false;
    }
    if (!matchesSecurityDomain(system.securityDomain, filters.securityDomain)) {
      return false;
    }
    if (
      filters.missionCapability &&
      !system.missionCapabilities.some((capability) => capability.id === filters.missionCapability)
    ) {
      return false;
    }
    if (
      filters.businessService &&
      !system.businessServices.some((service) => service.id === filters.businessService)
    ) {
      return false;
    }
    return true;
  });
}

export function buildFilterOptions(networks: ManagedNetwork[], systems: ICTSystem[]) {
  const capabilities = new Map<string, string>();
  const services = new Map<string, string>();

  for (const system of systems) {
    for (const capability of system.missionCapabilities) {
      capabilities.set(capability.id, capability.name);
    }
    for (const service of system.businessServices) {
      services.set(service.id, service.name);
    }
  }

  return {
    networks: filterRealNetworks(networks).map((network) => ({ id: network.id, label: network.name })),
    systems: systems.map((system) => ({ id: system.id, label: system.name })),
    systemCriticalities: (["Critical", "Non-Critical"] as const).map((criticality) => ({
      id: criticality,
      label: criticality
    })),
    securityDomains: SECURITY_DOMAINS.map((domain) => ({
      id: domain,
      label: domain
    })),
    missionCapabilities: Array.from(capabilities.entries()).map(([id, label]) => ({ id, label })),
    businessServices: Array.from(services.entries()).map(([id, label]) => ({ id, label }))
  };
}
