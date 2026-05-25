import {
  datasetCacheSignature,
  filtersCacheKey,
  getCachedAnalytics,
  settingsCacheSignature
} from "@/lib/analytics-cache";
import { getCachedCoreAppData, getCachedTrendAppData } from "@/lib/app-data-cache";
import {
  loadDiscoveryToolsSettings,
  loadDatasetForDate,
  loadKpiDefinitions,
  loadLatestSnapshotsForDate,
  loadMeasuresSettings,
  loadSeverityDefinitions,
  loadSpiDefinitions
} from "@/lib/data-loader";
import { extractDataDateParam } from "@/lib/data-date";
import { kpiDefinitionsCacheSignature } from "@/lib/kpi-definitions";
import { severityDefinitionsCacheSignature, spiDefinitionsCacheSignature } from "@/lib/spi-definitions";
import { buildFilterOptions, filterNetworks, filterSystems, parseFilters } from "@/lib/selectors";
import { stableCacheKey } from "@/lib/server-cache";
import { buildTrendPoints } from "@/lib/trends";

export async function getCoreAppData(searchParams: Record<string, string | string[] | undefined> = {}) {
  const dataDate = extractDataDateParam(searchParams);
  const [dataset, discoveryToolsSettings, kpiDefinitions, spiDefinitions, severityDefinitions] = await Promise.all([
    loadDatasetForDate(dataDate),
    loadDiscoveryToolsSettings(),
    loadKpiDefinitions(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);
  const filters = parseFilters(searchParams);

  const cacheKey = stableCacheKey([
    "core",
    dataDate ?? "",
    datasetCacheSignature(dataset),
    kpiDefinitionsCacheSignature(kpiDefinitions),
    spiDefinitionsCacheSignature(spiDefinitions),
    severityDefinitionsCacheSignature(severityDefinitions),
    filtersCacheKey(filters),
    settingsCacheSignature(measuresSettings, discoveryToolsSettings)
  ]);

  return getCachedCoreAppData(cacheKey, async () => {
    const analytics = getCachedAnalytics(
      dataset,
      filters,
      spiDefinitions,
      severityDefinitions,
      measuresSettings,
      discoveryToolsSettings
    );
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
      kpiDefinitions,
      spiDefinitions,
      severityDefinitions,
      measuresSettings,
      discoveryToolsSettings
    };
  });
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
  const cacheKey = stableCacheKey([
    "trend",
    dataDate ?? "",
    lookback,
    Boolean(options.includeTrendPoints),
    datasetCacheSignature(core.dataset),
    snapshots.map((snapshot) => datasetCacheSignature(snapshot)),
    kpiDefinitionsCacheSignature(core.kpiDefinitions),
    spiDefinitionsCacheSignature(core.spiDefinitions),
    severityDefinitionsCacheSignature(core.severityDefinitions),
    filtersCacheKey(core.filters),
    settingsCacheSignature(core.measuresSettings, core.discoveryToolsSettings)
  ]);

  return getCachedTrendAppData(cacheKey, async () => {
    const trendPoints = options.includeTrendPoints
      ? buildTrendPoints(snapshots, core.filters, core.spiDefinitions, core.measuresSettings, core.discoveryToolsSettings)
      : undefined;

    return {
      ...core,
      snapshots,
      trendPoints
    };
  });
}
