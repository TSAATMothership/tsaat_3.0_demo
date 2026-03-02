import { FilterBar } from "@/components/filter-bar";
import { MiniTrendSparkline } from "@/components/mini-trend-sparkline";
import { SystemsTable } from "@/components/systems-table";
import { getTrendAppData } from "@/lib/app-data";
import { deriveOverallStatus } from "@/lib/posture";
import { filterSystems } from "@/lib/selectors";
import { createSnapshotAnalyticsMemo } from "@/lib/snapshot-analytics-memo";

export default async function SystemsPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { analytics, filterOptions, filters, systems, snapshots, measuresSettings } = await getTrendAppData(
    searchParams
  );

  const findingsBySystem = analytics.findings.reduce((map, finding) => {
    if (!finding.scope.systemId) {
      return map;
    }
    map.set(finding.scope.systemId, (map.get(finding.scope.systemId) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  const complianceScoreBySystem = systems.reduce((map, system) => {
    const statuses = analytics.evaluations
      .filter((evaluation) => evaluation.systemId === system.id)
      .flatMap((evaluation) => evaluation.evaluations.map((item) => item.status));

    const compliantCount = statuses.filter((status) => status === "Compliant").length;
    const score = statuses.length ? Number(((compliantCount / statuses.length) * 100).toFixed(1)) : 0;
    map.set(system.id, score);
    return map;
  }, new Map<string, number>());

  const compliantSystemsCount = systems.filter((system) => {
    const rollups = analytics.systemRollups.filter(
      (rollup) => rollup.scopeType === "system" && rollup.scopeId === system.id
    );
    return deriveOverallStatus(rollups) === "Compliant";
  }).length;

  const nonCompliantSystemsCount = systems.filter((system) => {
    const rollups = analytics.systemRollups.filter(
      (rollup) => rollup.scopeType === "system" && rollup.scopeId === system.id
    );
    return deriveOverallStatus(rollups) === "Non-compliant";
  }).length;

  let highRiskP12FindingsCount = 0;
  let p12FindingsCount = 0;
  for (const finding of analytics.findings) {
    if (finding.priorityRank > 2) {
      continue;
    }
    p12FindingsCount += 1;
    if (finding.severity === "High Risk") {
      highRiskP12FindingsCount += 1;
    }
  }

  const scopedSnapshots = snapshots.slice(-12);
  const getSnapshotAnalytics = createSnapshotAnalyticsMemo(filters, measuresSettings);
  const trendPoints = scopedSnapshots.map((snapshot, index) => {
    const snapshotAnalytics = getSnapshotAnalytics(snapshot);
    const snapshotSystems = filterSystems(snapshot.ictSystems, filters);

    const compliantCount = snapshotSystems.filter((system) => {
      const rollups = snapshotAnalytics.systemRollups.filter(
        (rollup) => rollup.scopeType === "system" && rollup.scopeId === system.id
      );
      return deriveOverallStatus(rollups) === "Compliant";
    }).length;

    const nonCompliantCount = snapshotSystems.filter((system) => {
      const rollups = snapshotAnalytics.systemRollups.filter(
        (rollup) => rollup.scopeType === "system" && rollup.scopeId === system.id
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
      compliantSystemsCount: compliantCount,
      nonCompliantSystemsCount: nonCompliantCount,
      highRiskP12FindingsCount: snapshotHighRiskP12FindingsCount,
      p12FindingsCount: snapshotP12FindingsCount
    };
  });

  const compliantSystemsTrend = trendPoints.map((point) => ({
    label: point.weekLabel,
    value: point.compliantSystemsCount
  }));
  const nonCompliantSystemsTrend = trendPoints.map((point) => ({
    label: point.weekLabel,
    value: point.nonCompliantSystemsCount
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
    <div className="space-y-4">
      <section className="panel p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">ICT System View</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-100">System Roll-up and Environment Breakdown</h1>
        <p className="mt-2 text-sm text-slate-300/85">
          Mission and business context linked to cyber posture, including production-specific prioritization.
        </p>
      </section>

      <FilterBar options={filterOptions} filters={filters} enableLoadingOverlay />

      <section className="panel p-4">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">ICT System KPI Snapshot</h2>
        <p className="mt-2 text-xs text-slate-300/75">
          KPI trends over the last 12 weeks in the current filtered scope.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="panel-alt border-emerald-400/25 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Total number of compliant ICT Systems
            </p>
            <p className="mt-1 text-2xl font-semibold text-emerald-100">{compliantSystemsCount}</p>
            <MiniTrendSparkline points={compliantSystemsTrend} stroke="#22c55e" />
          </div>
          <div className="panel-alt border-red-400/25 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Total number of non-compliant ICT Systems
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{nonCompliantSystemsCount}</p>
            <MiniTrendSparkline points={nonCompliantSystemsTrend} stroke="#ef4444" />
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

      <SystemsTable
        systems={systems}
        systemRollups={analytics.systemRollups}
        environmentRollups={analytics.environmentRollups}
        findingsBySystem={findingsBySystem}
        complianceScoreBySystem={complianceScoreBySystem}
      />
    </div>
  );
}
