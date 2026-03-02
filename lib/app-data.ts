import { buildAnalytics } from "@/lib/analytics";
import { loadCurrentDataset, loadLatestSnapshots, loadMeasuresSettings } from "@/lib/data-loader";
import { buildFilterOptions, filterNetworks, filterSystems, parseFilters } from "@/lib/selectors";
import { buildTrendPoints } from "@/lib/trends";

export async function getCoreAppData(searchParams: Record<string, string | string[] | undefined> = {}) {
  const [dataset, measuresSettings] = await Promise.all([loadCurrentDataset(), loadMeasuresSettings()]);
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
  const [core, snapshots] = await Promise.all([getCoreAppData(searchParams), loadLatestSnapshots(lookback)]);
  const trendPoints = options.includeTrendPoints
    ? buildTrendPoints(snapshots, core.filters, core.measuresSettings)
    : undefined;

  return {
    ...core,
    snapshots,
    trendPoints
  };
}
