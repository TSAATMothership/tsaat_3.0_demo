export const SECURITY_DOMAINS = Object.freeze(["PROTECTED", "SECRET", "UNKNOWN"]);

/** Legacy labels and missing/unsupported classifications have an explicit domain. */
export function normalizeSecurityDomain(value) {
  const domain = typeof value === "string" ? value.trim().toUpperCase() : "";
  return domain === "PROTECTED" || domain === "SECRET" ? domain : "UNKNOWN";
}

export function normalizeNetworkSecurityDomain(value, classification) {
  if (value != null) return normalizeSecurityDomain(value);
  // Preserve the existing seed generator's Restricted-network to Secret-domain mapping.
  return normalizeSecurityDomain(typeof classification === "string" && classification.trim().toUpperCase() === "RESTRICTED" ? "SECRET" : classification);
}

/** Omitted means all; NONE (or an explicitly empty selection) means no domains. */
export function securityDomainSelection(value) {
  if (value == null) return [...SECURITY_DOMAINS];
  const values = (Array.isArray(value) ? value : [value]).flatMap(part => String(part).split(","))
    .map(part => part.trim().toUpperCase()).map(part => part === "UNCLASSIFIED" ? "UNKNOWN" : part);
  return SECURITY_DOMAINS.filter(domain => values.includes(domain));
}

export function securityDomainFilter(value) {
  const selected = securityDomainSelection(value);
  return selected.length === SECURITY_DOMAINS.length ? undefined : selected.join(",") || "NONE";
}

export function parseSecurityDomainScope(value) {
  if (value === undefined) return undefined;
  const values = Array.isArray(value) ? value : [value];
  if (values.length > 3 || values.some(part => typeof part !== "string" || part.length > 100 ||
    part.split(",").some(item => ![...SECURITY_DOMAINS, "UNCLASSIFIED", "NONE"].includes(item.trim().toUpperCase())))) {
    throw new Error("Invalid security domain scope.");
  }
  return securityDomainFilter(value);
}

export function matchesSecurityDomain(value, filter) {
  return securityDomainSelection(filter).includes(normalizeSecurityDomain(value));
}

/** Non-mutating read compatibility and explicit stored-data migration share one mapping. */
export function normalizeDatasetSecurityDomains(dataset) {
  return {
    ...dataset,
    managedNetworks: dataset.managedNetworks.map(network => ({ ...network,
      securityDomain: normalizeNetworkSecurityDomain(network.securityDomain, network.classification) })),
    ictSystems: dataset.ictSystems.map(system => ({ ...system, securityDomain: normalizeSecurityDomain(system.securityDomain) })),
    assets: dataset.assets.map(asset => ({ ...asset, securityDomain: normalizeSecurityDomain(asset.securityDomain) }))
  };
}
