import { ManagedNetwork, RollupResult } from "@/lib/types";
import { deriveOverallStatus } from "@/lib/posture";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";
import { NetworksTableClient, type NetworkTableRow } from "@/components/networks-table-client";

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
    const detailFields = resolveNetworkDetailFields(network);

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
      description: detailFields.description,
      owner: detailFields.owner,
      supportEmail: detailFields.supportEmail,
      serviceCatalogueUrl: detailFields.serviceCatalogueUrl,
      atoNumber: detailFields.atoNumber,
      diisUrl: detailFields.diisUrl,
      grcUrl: detailFields.grcUrl
    };
  });

  return <NetworksTableClient rows={rows} scrollable={scrollable} />;
}
