import { FilterBar } from "@/components/filter-bar";
import { MiniTrendSparkline } from "@/components/mini-trend-sparkline";
import { NetworksTable } from "@/components/networks-table";
import { getTrendAppData } from "@/lib/app-data";
import { deriveOverallStatus } from "@/lib/posture";
import { filterNetworks } from "@/lib/selectors";
import { createSnapshotAnalyticsMemo } from "@/lib/snapshot-analytics-memo";

export default async function NetworksPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { analytics, filterOptions, filters, networks, snapshots, measuresSettings } = await getTrendAppData(
    searchParams
  );

  const findingsByNetwork = new Map<string, number>();
  const p12FindingsByNetwork = new Map<string, number>();
  const p12HighRiskFindingsByNetwork = new Map<string, number>();
  let p12FindingsCount = 0;
  let highRiskP12FindingsCount = 0;
  for (const finding of analytics.findings) {
    findingsByNetwork.set(finding.scope.networkId, (findingsByNetwork.get(finding.scope.networkId) ?? 0) + 1);
    if (finding.priorityRank > 2) {
      continue;
    }
    p12FindingsCount += 1;
    p12FindingsByNetwork.set(finding.scope.networkId, (p12FindingsByNetwork.get(finding.scope.networkId) ?? 0) + 1);
    if (finding.severity === "High Risk") {
      highRiskP12FindingsCount += 1;
      p12HighRiskFindingsByNetwork.set(
        finding.scope.networkId,
        (p12HighRiskFindingsByNetwork.get(finding.scope.networkId) ?? 0) + 1
      );
    }
  }
  const compliantNetworksCount = networks.filter((network) => {
    const rollups = analytics.networkRollups.filter(
      (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
    );
    return deriveOverallStatus(rollups) === "Compliant";
  }).length;

  const nonCompliantNetworksCount = networks.filter((network) => {
    const rollups = analytics.networkRollups.filter(
      (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
    );
    return deriveOverallStatus(rollups) === "Non-compliant";
  }).length;

  const scopedSnapshots = snapshots.slice(-12);
  const getSnapshotAnalytics = createSnapshotAnalyticsMemo(filters, measuresSettings);
  const trendPoints = scopedSnapshots.map((snapshot, index) => {
    const snapshotAnalytics = getSnapshotAnalytics(snapshot);
    const snapshotNetworks = filterNetworks(snapshot.managedNetworks, filters);

    const compliantCount = snapshotNetworks.filter((network) => {
      const rollups = snapshotAnalytics.networkRollups.filter(
        (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
      );
      return deriveOverallStatus(rollups) === "Compliant";
    }).length;

    const nonCompliantCount = snapshotNetworks.filter((network) => {
      const rollups = snapshotAnalytics.networkRollups.filter(
        (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
      );
      return deriveOverallStatus(rollups) === "Non-compliant";
    }).length;

    let snapshotP12FindingsCount = 0;
    let snapshotHighRiskP12FindingsCount = 0;
    for (const finding of snapshotAnalytics.findings) {
      if (finding.priorityRank > 2) {
        continue;
      }
      snapshotP12FindingsCount += 1;
      if (finding.severity === "High Risk") {
        snapshotHighRiskP12FindingsCount += 1;
      }
    }

    return {
      weekLabel: `W${String(scopedSnapshots.length - index).padStart(2, "0")}`,
      compliantNetworksCount: compliantCount,
      nonCompliantNetworksCount: nonCompliantCount,
      highRiskP12FindingsCount: snapshotHighRiskP12FindingsCount,
      p12FindingsCount: snapshotP12FindingsCount
    };
  });

  const compliantNetworksTrend = trendPoints.map((point) => ({
    label: point.weekLabel,
    value: point.compliantNetworksCount
  }));
  const nonCompliantNetworksTrend = trendPoints.map((point) => ({
    label: point.weekLabel,
    value: point.nonCompliantNetworksCount
  }));
  const highRiskP12Trend = trendPoints.map((point) => ({
    label: point.weekLabel,
    value: point.highRiskP12FindingsCount
  }));
  const p12FindingsTrend = trendPoints.map((point) => ({
    label: point.weekLabel,
    value: point.p12FindingsCount
  }));

  return (
    <div className="relative left-1/2 w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 space-y-4 md:w-[min(2100px,calc(100vw-3rem))]">
      <section className="panel p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Networks View</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-100">Network Roll-up Posture</h1>
        <p className="mt-2 text-sm text-slate-300/80">
          Drill down by network, review SPI posture roll-up, and inspect changes since last snapshot.
        </p>
      </section>

      <FilterBar
        options={filterOptions}
        filters={filters}
        hiddenFields={["ictSystem", "systemCriticality", "environment"]}
        enableLoadingOverlay
      />

      <section className="panel p-4">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Networks KPI Snapshot</h2>
        <p className="mt-2 text-xs text-slate-300/75">
          KPI trends over the last 12 weeks in the current filtered scope.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="panel-alt border-emerald-400/25 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Total number of compliant Networks
            </p>
            <p className="mt-1 text-2xl font-semibold text-emerald-100">{compliantNetworksCount}</p>
            <MiniTrendSparkline points={compliantNetworksTrend} stroke="#22c55e" />
          </div>
          <div className="panel-alt border-red-400/25 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Total number of non-compliant Networks
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{nonCompliantNetworksCount}</p>
            <MiniTrendSparkline points={nonCompliantNetworksTrend} stroke="#ef4444" />
          </div>
          <div className="panel-alt border-red-400/25 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Total number of High Risk P1-P2 findings
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{highRiskP12FindingsCount}</p>
            <MiniTrendSparkline points={highRiskP12Trend} stroke="#f97316" />
          </div>
          <div className="panel-alt border-amber-400/25 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Total number of P1-P2 findings
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-100">{p12FindingsCount}</p>
            <MiniTrendSparkline points={p12FindingsTrend} stroke="#f59e0b" />
          </div>
        </div>
      </section>

      <NetworksTable
        networks={networks}
        networkRollups={analytics.networkRollups}
        findingsByNetwork={findingsByNetwork}
        p12FindingsByNetwork={p12FindingsByNetwork}
        p12HighRiskFindingsByNetwork={p12HighRiskFindingsByNetwork}
      />
    </div>
  );
}
