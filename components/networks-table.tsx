import { ManagedNetwork, RollupResult } from "@/lib/types";
import type { HighRiskCveDetail } from "@/lib/types";
import type { NetworkDetailRiskFindingRow } from "@/components/network-detail-risk-charts";
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
  criticalFindingsByNetwork,
  highFindingsByNetwork,
  otherFindingsByNetwork,
  discoveryComplianceScoreByNetwork,
  riskFindings,
  assetHighRiskCvesByAssetId = {},
  asOfDate,
  scrollable = false
}: {
  networks: ManagedNetwork[];
  networkRollups: RollupResult[];
  criticalFindingsByNetwork: Map<string, number>;
  highFindingsByNetwork: Map<string, number>;
  otherFindingsByNetwork: Map<string, number>;
  discoveryComplianceScoreByNetwork: Map<string, number>;
  riskFindings: NetworkDetailRiskFindingRow[];
  assetHighRiskCvesByAssetId?: Record<string, HighRiskCveDetail[]>;
  asOfDate?: string;
  scrollable?: boolean;
}) {
  const rows: NetworkTableRow[] = networks.map((network) => {
    const rollups = networkRollups.filter(
      (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
    );
    const complianceScore = complianceScoreFromRollups(rollups);
    const detailFields = resolveNetworkDetailFields(network);

    return {
      id: network.id,
      name: network.name,
      classification: network.classification ?? "-",
      assetCount: network.assetIds.length,
      criticalFindings: criticalFindingsByNetwork.get(network.id) ?? 0,
      highFindings: highFindingsByNetwork.get(network.id) ?? 0,
      otherFindings: otherFindingsByNetwork.get(network.id) ?? 0,
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

  return (
    <NetworksTableClient
      rows={rows}
      riskFindings={riskFindings}
      assetHighRiskCvesByAssetId={assetHighRiskCvesByAssetId}
      asOfDate={asOfDate}
      scrollable={scrollable}
    />
  );
}
