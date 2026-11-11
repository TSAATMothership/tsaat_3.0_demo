import "server-only";
import { loadSnapshotsForDateWindow, loadSpiDefinitions, loadKpiDefinitions, loadSeverityDefinitions, loadFindingPriorityDefinitions,
  loadMeasuresSettings, loadDiscoveryToolsSettings, loadSnapshotKpiEvaluationsForAnalyticsScope } from "@/lib/data-loader";
import { getCachedAnalytics } from "@/lib/analytics-cache";
import { buildKpiRows, buildSpiRows } from "@/lib/measures";
import { resolveKpiScope } from "@/lib/kpi-scope";
import { parseFilters } from "@/lib/selectors";
import { firstSearchParam, todayDateKey } from "@/lib/data-date";
import { buildMeasuresTrends, measureHistory, measurePeriodStart, measureSnapshotsInPeriod, MEASURE_HISTORY_OPTIONS, type MeasureObservation } from "@/lib/measures-trends";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

export async function loadMeasuresTrends(params: WorkspaceSearchParams) {
  const requested = firstSearchParam(params.dataDate);
  const cutoff = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && Number.isFinite(Date.parse(requested)) && new Date(requested).toISOString().slice(0, 10) === requested ? requested : todayDateKey();
  const history = measureHistory(params.measureHistory), from = measurePeriodStart(history, cutoff);
  const months = MEASURE_HISTORY_OPTIONS.find(option => option.value === history)!.months;
  // Summary snapshots contain the authoritative SPI results and KPI system attributes.
  const [historyRows, spis, kpis, severities, priorities, discovery] = await Promise.all([
    loadSnapshotsForDateWindow(cutoff, months, { profile: "summary" }), loadSpiDefinitions(), loadKpiDefinitions(),
    loadSeverityDefinitions(), loadFindingPriorityDefinitions(), loadDiscoveryToolsSettings()
  ]);
  const settings = await loadMeasuresSettings(spis, severities, priorities);
  const filters = parseFilters({ network: params.network, system: params.system, securityDomain: params.securityDomain });
  const snapshots = measureSnapshotsInPeriod(historyRows, from, cutoff);
  const observations: MeasureObservation[] = [];
  // Keep SQL process concurrency bounded even when a year contains daily snapshots.
  for (let index = 0; index < snapshots.length; index += 4) {
    observations.push(...await Promise.all(snapshots.slice(index, index + 4).map(async dataset => {
      const analytics = getCachedAnalytics(dataset, filters, spis, severities, settings, discovery);
      const scope = resolveKpiScope(dataset, filters);
      const results = await loadSnapshotKpiEvaluationsForAnalyticsScope({ dataset, analytics, ...scope, kpiDefinitions: kpis });
      return { snapshotDate: dataset.snapshotDate, snapshotId: dataset.snapshotId, kpis: buildKpiRows(kpis, results), spis: buildSpiRows(analytics, spis) };
    })));
  }
  return buildMeasuresTrends(observations, kpis, spis, params, cutoff);
}
