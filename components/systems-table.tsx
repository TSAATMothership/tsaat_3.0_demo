import Link from "next/link";
import { ICTSystem, RollupResult } from "@/lib/types";
import { deriveOverallStatus } from "@/lib/posture";
import { PostureBadge } from "@/components/posture-badge";

export function SystemsTable({
  systems,
  systemRollups,
  environmentRollups,
  findingsBySystem,
  complianceScoreBySystem
}: {
  systems: ICTSystem[];
  systemRollups: RollupResult[];
  environmentRollups: RollupResult[];
  findingsBySystem: Map<string, number>;
  complianceScoreBySystem: Map<string, number>;
}) {
  return (
    <div className="panel overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
          <tr>
            <th className="px-3 py-2">ICT System</th>
            <th className="px-3 py-2">Mission Capabilities</th>
            <th className="px-3 py-2">Business Services</th>
            <th className="w-[170px] px-3 py-2">Overall Posture</th>
            <th className="w-[170px] px-3 py-2">Production Posture</th>
            <th className="w-[150px] px-3 py-2">Compliance Score</th>
            <th className="px-3 py-2">Open Findings</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {systems.map((system) => {
            const rollups = systemRollups.filter(
              (rollup) => rollup.scopeType === "system" && rollup.scopeId === system.id
            );
            const productionRollups = environmentRollups.filter(
              (rollup) =>
                rollup.scopeType === "environment" && rollup.scopeId === `${system.id}::Production`
            );
            return (
              <tr key={system.id} className="border-t border-sky-400/10 align-top">
                <td className="px-3 py-3 text-slate-100">{system.name}</td>
                <td className="px-3 py-3 text-slate-300">
                  {system.missionCapabilities.map((capability) => capability.name).join(", ")}
                </td>
                <td className="px-3 py-3 text-slate-300">
                  {system.businessServices.map((service) => service.name).join(", ")}
                </td>
                <td className="w-[170px] px-3 py-3">
                  <PostureBadge status={deriveOverallStatus(rollups)} />
                </td>
                <td className="w-[170px] px-3 py-3">
                  <PostureBadge status={deriveOverallStatus(productionRollups)} />
                </td>
                <td className="w-[150px] px-3 py-3 text-slate-100">
                  {(complianceScoreBySystem.get(system.id) ?? 0).toFixed(1)}%
                </td>
                <td className="px-3 py-3 text-slate-200">{findingsBySystem.get(system.id) ?? 0}</td>
                <td className="px-3 py-3">
                  <Link
                    href={`/systems/${system.id}`}
                    data-filter-loading="true"
                    data-filter-loading-message="Loading system page..."
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
