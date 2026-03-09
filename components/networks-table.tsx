import { ManagedNetwork, RollupResult } from "@/lib/types";
import { deriveOverallStatus } from "@/lib/posture";
import { NetworksTableClient, type NetworkTableRow } from "@/components/networks-table-client";

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

export function NetworksTable({
  networks,
  networkRollups,
  findingsByNetwork,
  p12FindingsByNetwork,
  p12HighRiskFindingsByNetwork,
  p12CriticalExposureFindingsByNetwork,
  scrollable = false
}: {
  networks: ManagedNetwork[];
  networkRollups: RollupResult[];
  findingsByNetwork: Map<string, number>;
  p12FindingsByNetwork: Map<string, number>;
  p12HighRiskFindingsByNetwork: Map<string, number>;
  p12CriticalExposureFindingsByNetwork: Map<string, number>;
  scrollable?: boolean;
}) {
  const rows: NetworkTableRow[] = networks.map((network) => {
    const rollups = networkRollups.filter(
      (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
    );
    const posture = deriveOverallStatus(rollups);

    const atoNumber = fallbackAtoNumber(network);

    return {
      id: network.id,
      name: network.name,
      classification: network.classification ?? "-",
      assetCount: network.assetIds.length,
      posture,
      openFindings: findingsByNetwork.get(network.id) ?? 0,
      p12Findings: p12FindingsByNetwork.get(network.id) ?? 0,
      p12HighRiskFindings: p12HighRiskFindingsByNetwork.get(network.id) ?? 0,
      p12CriticalExposureFindings: p12CriticalExposureFindingsByNetwork.get(network.id) ?? 0,
      description: fallbackDescription(network),
      owner: fallbackOwner(network),
      supportEmail: fallbackSupportEmail(network),
      serviceCatalogueUrl: fallbackServiceCatalogueUrl(network),
      atoNumber,
      diisUrl: fallbackDiisUrl(network),
      grcUrl: fallbackGrcUrl(network, atoNumber)
    };
  });

  return <NetworksTableClient rows={rows} scrollable={scrollable} />;
}
