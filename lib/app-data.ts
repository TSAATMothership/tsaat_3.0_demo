import { buildAnalytics } from "@/lib/analytics";
import {
  loadDatasetForDate,
  loadLatestSnapshotsForDate,
  loadMeasuresSettings
} from "@/lib/data-loader";
import { extractDataDateParam } from "@/lib/data-date";
import { buildFilterOptions, filterNetworks, filterSystems, parseFilters } from "@/lib/selectors";
import { buildTrendPoints } from "@/lib/trends";

export async function getCoreAppData(searchParams: Record<string, string | string[] | undefined> = {}) {
  const dataDate = extractDataDateParam(searchParams);
  const [dataset, measuresSettings] = await Promise.all([loadDatasetForDate(dataDate), loadMeasuresSettings()]);
  const filters = parseFilters(searchParams);

  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, measuresSettings);
  const networks = filterNetworks(dataset.managedNetworks, filters);
  const systems = filterSystems(dataset.ictSystems, filters);
  const filterOptions = buildFilterOptions(dataset.managedNetworks, dataset.ictSystems);

  return {
    dataset,
    filters,
    analytics,
    networks,
    systems,
    filterOptions,
    measuresSettings
  };
}

export async function getTrendAppData(
  searchParams: Record<string, string | string[] | undefined> = {},
  lookback = 12,
  options: { includeTrendPoints?: boolean } = {}
) {
  const dataDate = extractDataDateParam(searchParams);
  const [core, snapshots] = await Promise.all([
    getCoreAppData(searchParams),
    loadLatestSnapshotsForDate(dataDate, lookback)
  ]);
  const trendPoints = options.includeTrendPoints
    ? buildTrendPoints(snapshots, core.filters, core.measuresSettings)
    : undefined;

  return {
    ...core,
    snapshots,
    trendPoints
  };
}
