import { filterDiscoveryAssets } from "@/lib/discovery-filter-scope";
import type { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { buildLifeCycleManagement } from "@/lib/life-cycle-management";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { applyAssetFilters, parseFilters } from "@/lib/selectors";
import { securityDomainSelection } from "@/lib/security-domain.mjs";
import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import type { Dataset } from "@/lib/types";
import { subtractCalendarMonthsDateKey } from "@/lib/data-date";

export const trendPercent = (part: number, total: number): number | null => total ? Math.round(part / total * 1000) / 10 : null;
export const TREND_HISTORY_OPTIONS = [{ value: "week", label: "1 week" }, { value: "month", label: "1 month" }] as const;
export type TrendHistory = typeof TREND_HISTORY_OPTIONS[number]["value"];
export const trendHistory = (value: WorkspaceSearchParams[string]): TrendHistory => (Array.isArray(value) ? value[0] : value) === "week" ? "week" : "month";
export const trendStartDate = (history: TrendHistory, cutoff: string): string => history === "week"
  ? new Date(Date.parse(`${cutoff}T00:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10)
  : subtractCalendarMonthsDateKey(cutoff, 1);
export function trendMovement(latest: number | null, baseline: number | null, higherIsBetter: boolean) {
  if (latest === null || baseline === null) return { delta: null, tone: "neutral", label: "No comparison" } as const;
  const delta = Math.round((latest - baseline) * 10) / 10;
  return { delta, tone: delta === 0 ? "neutral" : (delta > 0) === higherIsBetter ? "good" : "attention",
    label: delta === 0 ? "Unchanged" : (delta > 0) === higherIsBetter ? "Improving" : "Needs attention" };
}

/** Presentation of existing evaluation results and lifecycle rules, not a new risk score. */
export function buildGovernanceTrends(datasets: Dataset[], settings: DiscoveryToolsSettings, searchParams: WorkspaceSearchParams, cutoff: string) {
  const history = trendHistory(searchParams.trendHistory);
  const from = trendStartDate(history, cutoff);
  const scope = { network: scopeIds(searchParams.network), system: scopeIds(searchParams.system), securityDomain: searchParams.securityDomain };
  // One observed point per day. Never replace absent history with a future snapshot.
  const dates = new Map<string, Dataset>();
  for (const dataset of [...datasets].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate) || (a.snapshotId ?? 0) - (b.snapshotId ?? 0))) {
    if (dataset.snapshotDate >= from && dataset.snapshotDate <= cutoff) dates.set(dataset.snapshotDate, dataset);
  }
  const snapshots = [...dates.values()];
  const observations = snapshots.map(dataset => {
    const assets = filterDiscoveryAssets(applyAssetFilters(dataset.assets, dataset.ictSystems, parseFilters(scope)));
    const ids = new Set(assets.map(asset => asset.id));
    const checks = dataset.spiEvaluations.filter(row => ids.has(row.assetId));
    const evaluated = new Set(checks.map(row => row.assetId));
    const compliant = checks.filter(row => row.status === "Compliant").length;
    const nonCompliant = checks.filter(row => row.status === "Non-compliant").length;
    const unknown = checks.filter(row => row.status === "Unknown").length;
    const lifecycle = buildLifeCycleManagement(dataset, scope);
    const discovery = buildScopedDiscoveryToolCoverage(assets, settings, dataset.discoveryCoverageEvaluations);
    const covered = discovery.toolCards.reduce((sum, tool) => sum + tool.covered, 0);
    const required = discovery.toolCards.reduce((sum, tool) => sum + tool.applicable, 0);
    return { ids, lifecycle, tools: discovery.toolCards.map(({ id, label, covered, missing, applicable }) => ({ id, label, covered, missing, applicable, percent: trendPercent(covered, applicable) })),
      point: { date: dataset.snapshotDate, compliant, nonCompliant, unknown, checks: checks.length,
        uncheckedAssets: assets.filter(asset => asset.type !== "ip-node" && !evaluated.has(asset.id)).length,
        compliance: trendPercent(compliant, checks.length), ...lifecycle.totals,
        lifecycle: trendPercent(lifecycle.totals.serversAtRisk, lifecycle.totals.servers),
        discovery: trendPercent(covered, required), covered, required,
        discoveryGaps: discovery.assetCoverages.filter(row => !row.coverageCompliance).length,
        unmapped: discovery.assetCoverages.filter(row => Object.values(row.toolValues).every(value => value === null)).length,
        unidentified: assets.filter(asset => asset.type === "ip-node").length, scopedAssets: assets.length }
    };
  });
  const latest = observations.at(-1), first = observations[0];
  const latestDataset = snapshots.at(-1);
  const labels = (ids: string[], entities: { id: string; name: string }[]) => ids.map(id => entities.find(row => row.id === id)?.name ?? id);
  return { history, from, cutoff, scope: { ...scope, dataDate: latest?.point.date ?? cutoff },
    scopeLabels: { networks: labels(scope.network, latestDataset?.managedNetworks ?? []), systems: labels(scope.system, latestDataset?.ictSystems ?? []),
      domains: securityDomainSelection(scope.securityDomain) },
    points: observations.map(row => row.point),
    population: { entered: latest && first ? [...latest.ids].filter(id => !first.ids.has(id)).length : 0,
      left: latest && first ? [...first.ids].filter(id => !latest.ids.has(id)).length : 0 },
    tools: (latest?.tools ?? []).map(tool => ({ ...tool, baseline: observations.length > 1 ? first.tools.find(row => row.id === tool.id)?.percent ?? null : null }))
      .sort((a, b) => b.missing - a.missing || a.label.localeCompare(b.label)),
    priorities: (latest?.lifecycle.servers ?? []).filter(row => row.issueCount || row.gaps.length).slice(0, 3)
      .map(({ id, name, system, environment, critical, issueCount, issues, gaps }) => ({ id, name, system, environment, critical, issueCount, issues, gaps }))
  };
}
export type GovernanceTrendsModel = ReturnType<typeof buildGovernanceTrends>;
export type GovernanceTrendPoint = GovernanceTrendsModel["points"][number];
