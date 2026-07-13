const MISSING_REFERENCE_LABEL = "Missing";

type NetworkReferenceSource = {
  atoNumber?: string | null;
  diisId?: string | null;
  diisUrl?: string | null;
};

export interface NetworkReferenceFields {
  atoNumber: string;
  diisId: string;
  diisHref?: string;
}

export function resolveNetworkReferenceFields(network: NetworkReferenceSource): NetworkReferenceFields {
  const storedAtoNumber = network.atoNumber?.trim();
  const storedDiisId = network.diisId?.trim();
  const storedDiisUrl = network.diisUrl?.trim();

  return {
    atoNumber: storedAtoNumber || MISSING_REFERENCE_LABEL,
    diisId: storedDiisId || MISSING_REFERENCE_LABEL,
    ...(storedDiisId && storedDiisUrl ? { diisHref: storedDiisUrl } : {})
  };
}
