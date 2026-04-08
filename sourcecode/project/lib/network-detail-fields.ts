import { ManagedNetwork } from "@/lib/types";

export interface ResolvedNetworkDetailFields {
  description: string;
  owner: string;
  supportEmail: string;
  serviceCatalogueUrl: string;
  atoNumber: string;
  diisUrl: string;
  grcUrl: string;
}

function fallbackDescription(network: ManagedNetwork): string {
  if (network.description?.trim()) {
    return network.description.trim();
  }

  const classificationLabel = network.classification ?? "multi-domain";
  return `${network.name} is a ${classificationLabel} managed network segment in current TSAAT scope.`;
}

function fallbackOwner(network: ManagedNetwork): string {
  if (network.owner?.trim()) {
    return network.owner.trim();
  }

  return `${network.name} Operations Team`;
}

function fallbackSupportEmail(network: ManagedNetwork): string {
  if (network.supportEmail?.trim()) {
    return network.supportEmail.trim();
  }

  const normalizedId = network.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `network-support+${normalizedId}@tsaat.local`;
}

function fallbackServiceCatalogueUrl(network: ManagedNetwork): string {
  if (network.serviceCatalogueUrl?.trim()) {
    return network.serviceCatalogueUrl.trim();
  }

  return `/networks/${network.id}`;
}

function fallbackAtoNumber(network: ManagedNetwork): string {
  if (network.atoNumber?.trim()) {
    return network.atoNumber.trim();
  }

  const normalizedId = network.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase();
  return `ATO-${normalizedId}`;
}

function fallbackDiisUrl(network: ManagedNetwork): string {
  if (network.diisUrl?.trim()) {
    return network.diisUrl.trim();
  }

  return `https://diis.defence.gov.au/networks/${encodeURIComponent(network.id)}`;
}

function fallbackGrcUrl(network: ManagedNetwork, atoNumber: string): string {
  if (network.grcUrl?.trim()) {
    return network.grcUrl.trim();
  }

  return `https://grc.defence.gov.au/ato/${encodeURIComponent(atoNumber)}`;
}

export function resolveNetworkDetailFields(network: ManagedNetwork): ResolvedNetworkDetailFields {
  const atoNumber = fallbackAtoNumber(network);

  return {
    description: fallbackDescription(network),
    owner: fallbackOwner(network),
    supportEmail: fallbackSupportEmail(network),
    serviceCatalogueUrl: fallbackServiceCatalogueUrl(network),
    atoNumber,
    diisUrl: fallbackDiisUrl(network),
    grcUrl: fallbackGrcUrl(network, atoNumber)
  };
}
