import Link from "next/link";
import { ManagedNetwork, RollupResult } from "@/lib/types";
import { deriveOverallStatus } from "@/lib/posture";
import { PostureBadge } from "@/components/posture-badge";

export function NetworksTable({
  networks,
  networkRollups,
  findingsByNetwork,
  p12FindingsByNetwork,
  p12HighRiskFindingsByNetwork
}: {
  networks: ManagedNetwork[];
  networkRollups: RollupResult[];
  findingsByNetwork: Map<string, number>;
  p12FindingsByNetwork: Map<string, number>;
  p12HighRiskFindingsByNetwork: Map<string, number>;
}) {
  return (
    <div className="panel overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
          <tr>
            <th className="px-3 py-2">Network</th>
            <th className="px-3 py-2">Classification</th>
            <th className="px-3 py-2">Assets</th>
            <th className="px-3 py-2">Posture</th>
            <th className="px-3 py-2">Open Findings</th>
            <th className="px-3 py-2">P1-P2 Findings</th>
            <th className="px-3 py-2">P1-P2 Findings (High Risk)</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {networks.map((network) => {
            const rollups = networkRollups.filter(
              (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
            );
            const posture = deriveOverallStatus(rollups);
            return (
              <tr key={network.id} className="border-t border-sky-400/10">
                <td className="px-3 py-3 text-slate-100">{network.name}</td>
                <td className="px-3 py-3 text-slate-300">{network.classification ?? "-"}</td>
                <td className="px-3 py-3 text-slate-300">{network.assetIds.length}</td>
                <td className="px-3 py-3">
                  <PostureBadge status={posture} />
                </td>
                <td className="px-3 py-3 text-slate-200">{findingsByNetwork.get(network.id) ?? 0}</td>
                <td className="px-3 py-3 text-slate-200">{p12FindingsByNetwork.get(network.id) ?? 0}</td>
                <td className="px-3 py-3 text-slate-200">
                  {p12HighRiskFindingsByNetwork.get(network.id) ?? 0}
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/networks/${network.id}`}
                    data-filter-loading="true"
                    data-filter-loading-message="Loading network page..."
                    className="text-sky-200 underline"
                  >
                    Drill Down
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
