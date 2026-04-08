import { Asset, Filters, ICTSystem, ManagedNetwork } from "@/lib/types";

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): Filters {
  const getValue = (key: string): string | undefined => {
    const value = searchParams[key];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  return {
    managedNetwork: getValue("network") || undefined,
    ictSystem: getValue("system") || undefined,
    systemCriticality: (getValue("criticality") as Filters["systemCriticality"]) || undefined,
    securityDomain: (getValue("securityDomain") as Filters["securityDomain"]) || undefined,
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

  return assets.filter((asset) => {
    if (filters.managedNetwork && asset.networkId !== filters.managedNetwork) {
      return false;
    }

    if (filters.assetType && asset.type !== filters.assetType) {
      return false;
    }

    if (filters.securityDomain && asset.securityDomain !== filters.securityDomain) {
      return false;
    }

    const systemId = asset.systemContext?.systemId;
    const system = systemId ? systemById.get(systemId) : undefined;

    if (filters.ictSystem && systemId !== filters.ictSystem) {
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

export function filterNetworks(networks: ManagedNetwork[], filters: Filters): ManagedNetwork[] {
  if (!filters.managedNetwork) {
    return networks;
  }
  return networks.filter((network) => network.id === filters.managedNetwork);
}

export function filterSystems(systems: ICTSystem[], filters: Filters): ICTSystem[] {
  return systems.filter((system) => {
    if (filters.managedNetwork && system.networkId !== filters.managedNetwork) {
      return false;
    }
    if (filters.ictSystem && system.id !== filters.ictSystem) {
      return false;
    }
    if (filters.systemCriticality && system.criticality !== filters.systemCriticality) {
      return false;
    }
    if (filters.securityDomain && system.securityDomain !== filters.securityDomain) {
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
    networks: networks.map((network) => ({ id: network.id, label: network.name })),
    systems: systems.map((system) => ({ id: system.id, label: system.name })),
    systemCriticalities: (["Critical", "Non-Critical"] as const).map((criticality) => ({
      id: criticality,
      label: criticality
    })),
    securityDomains: (["Secret", "Protected", "Unclassified"] as const).map((domain) => ({
      id: domain,
      label: domain
    })),
    missionCapabilities: Array.from(capabilities.entries()).map(([id, label]) => ({ id, label })),
    businessServices: Array.from(services.entries()).map(([id, label]) => ({ id, label }))
  };
}
