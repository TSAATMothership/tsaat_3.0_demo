import { ManagedNetwork, RollupResult } from "@/lib/types";
import { deriveOverallStatus } from "@/lib/posture";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";
import { NetworksTableClient, type NetworkTableRow } from "@/components/networks-table-client";

function complianceScoreFromRollups(rollups: RollupResult[]): number {
  const totals = rollups.reduce(
    (accumulator, rollup) => {
      accumulator.compliant += rollup.counts.compliant;
      accumulator.nonCompliant += rollup.counts.nonCompliant;
      accumulator.unknown += rollup.counts.unknown;
      return accumulator;
    },
    { compliant: 0, nonCompliant: 0, unknown: 0 }
  );

  const denominator = totals.compliant + totals.nonCompliant + totals.unknown;
  if (!denominator) {
    return 0;
  }

  return Number(((totals.compliant / denominator) * 100).toFixed(1));
}

export function NetworksTable({
  networks,
  networkRollups,
  p12FindingsByNetwork,
  p12HighRiskFindingsByNetwork,
  p12CriticalExposureFindingsByNetwork,
  discoveryComplianceScoreByNetwork,
  scrollable = false
}: {
  networks: ManagedNetwork[];
  networkRollups: RollupResult[];
  p12FindingsByNetwork: Map<string, number>;
  p12HighRiskFindingsByNetwork: Map<string, number>;
  p12CriticalExposureFindingsByNetwork: Map<string, number>;
  discoveryComplianceScoreByNetwork: Map<string, number>;
  scrollable?: boolean;
}) {
  const rows: NetworkTableRow[] = networks.map((network) => {
    const rollups = networkRollups.filter(
      (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
    );
    const posture = deriveOverallStatus(rollups);
    const complianceScore = complianceScoreFromRollups(rollups);
    const detailFields = resolveNetworkDetailFields(network);

    return {
      id: network.id,
      name: network.name,
      classification: network.classification ?? "-",
      assetCount: network.assetIds.length,
      posture,
      p12Findings: p12FindingsByNetwork.get(network.id) ?? 0,
      p12HighRiskFindings: p12HighRiskFindingsByNetwork.get(network.id) ?? 0,
      p12CriticalExposureFindings: p12CriticalExposureFindingsByNetwork.get(network.id) ?? 0,
      complianceScore,
      discoveryComplianceScore: discoveryComplianceScoreByNetwork.get(network.id) ?? 0,
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
