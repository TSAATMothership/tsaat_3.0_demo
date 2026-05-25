import {
  datasetCacheSignature,
  filtersCacheKey,
  getCachedAnalytics,
  settingsCacheSignature
} from "@/lib/analytics-cache";
import { getCachedCoreAppData, getCachedTrendAppData } from "@/lib/app-data-cache";
import {
  type DatasetLoadProfile,
  loadDiscoveryToolsSettings,
  loadDatasetForDate,
  loadFindingPriorityDefinitions,
  loadFindingDisplayConfiguration,
  loadKpiDefinitions,
  loadLatestSnapshotsForDate,
  loadMeasuresSettings,
  loadSeverityDefinitions,
  loadSpiDefinitions
} from "@/lib/data-loader";
import { extractDataDateParam } from "@/lib/data-date";
import { findingDisplayConfigurationCacheSignature } from "@/lib/findings-config";
import { kpiDefinitionsCacheSignature } from "@/lib/kpi-definitions";
import { severityDefinitionsCacheSignature, spiDefinitionsCacheSignature } from "@/lib/spi-definitions";
import { buildFilterOptions, filterNetworks, filterSystems, parseFilters } from "@/lib/selectors";
import { stableCacheKey } from "@/lib/server-cache";
import { buildTrendPoints } from "@/lib/trends";
import { timeAsync, timeSync } from "@/lib/perf";

export interface AppDataOptions {
  profile?: DatasetLoadProfile;
}

export async function getCoreAppData(
  searchParams: Record<string, string | string[] | undefined> = {},
  options: AppDataOptions = {}
) {
  const dataDate = extractDataDateParam(searchParams);
  const profile = options.profile ?? "full";
  const [
    dataset,
    discoveryToolsSettings,
    kpiDefinitions,
    spiDefinitions,
    severityDefinitions,
    priorityDefinitions,
    findingDisplayConfiguration
  ] = await Promise.all([
    loadDatasetForDate(dataDate, { profile }),
    loadDiscoveryToolsSettings(),
    loadKpiDefinitions(),
    loadSpiDefinitions(),
    loadSeverityDefinitions(),
    loadFindingPriorityDefinitions(),
    loadFindingDisplayConfiguration()
  ]);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions, priorityDefinitions);
  const filters = parseFilters(searchParams);

  const cacheKey = stableCacheKey([
    "core",
    profile,
    dataDate ?? "",
    datasetCacheSignature(dataset),
    kpiDefinitionsCacheSignature(kpiDefinitions),
    spiDefinitionsCacheSignature(spiDefinitions),
    severityDefinitionsCacheSignature(severityDefinitions),
    JSON.stringify(priorityDefinitions),
    findingDisplayConfigurationCacheSignature(findingDisplayConfiguration),
    filtersCacheKey(filters),
    settingsCacheSignature(measuresSettings, discoveryToolsSettings)
  ]);

  return getCachedCoreAppData(cacheKey, async () => timeAsync(`getCoreAppData:${profile}`, async () => {
    const analytics = timeSync("getCachedAnalytics", () => getCachedAnalytics(
      dataset,
      filters,
      spiDefinitions,
      severityDefinitions,
      measuresSettings,
      discoveryToolsSettings
    ));
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
      priorityDefinitions,
      findingDisplayConfiguration,
      measuresSettings,
      discoveryToolsSettings
    };
  }));
}

export async function getTrendAppData(
  searchParams: Record<string, string | string[] | undefined> = {},
  lookback = 12,
  options: { includeTrendPoints?: boolean; profile?: DatasetLoadProfile } = {}
) {
  const dataDate = extractDataDateParam(searchParams);
  const profile = options.profile ?? "full";
  const [core, snapshots] = await Promise.all([
    getCoreAppData(searchParams, { profile }),
    loadLatestSnapshotsForDate(dataDate, lookback, { profile })
  ]);
  const cacheKey = stableCacheKey([
    "trend",
    profile,
    dataDate ?? "",
    lookback,
    Boolean(options.includeTrendPoints),
    datasetCacheSignature(core.dataset),
    snapshots.map((snapshot) => datasetCacheSignature(snapshot)),
    kpiDefinitionsCacheSignature(core.kpiDefinitions),
    spiDefinitionsCacheSignature(core.spiDefinitions),
    severityDefinitionsCacheSignature(core.severityDefinitions),
    JSON.stringify(core.priorityDefinitions),
    findingDisplayConfigurationCacheSignature(core.findingDisplayConfiguration),
    filtersCacheKey(core.filters),
    settingsCacheSignature(core.measuresSettings, core.discoveryToolsSettings)
  ]);

  return getCachedTrendAppData(cacheKey, async () => timeAsync(`getTrendAppData:${profile}:${lookback}`, async () => {
    const trendPoints = options.includeTrendPoints
      ? buildTrendPoints(snapshots, core.filters, core.spiDefinitions, core.measuresSettings, core.discoveryToolsSettings)
      : undefined;

    return {
      ...core,
      snapshots,
      trendPoints
    };
  }));
}
