import { buildAnalytics } from "@/lib/analytics";
import { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { MeasuresSettings } from "@/lib/measures-settings";
import { ServerMemoryCache } from "@/lib/server-cache";
import {
  SeverityDefinition,
  SpiDefinition,
  severityDefinitionsCacheSignature,
  spiDefinitionsCacheSignature
} from "@/lib/spi-definitions";
import { AnalyticsResult, Dataset, Filters } from "@/lib/types";

const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;
const ANALYTICS_CACHE_MAX_ENTRIES = 300;

const analyticsCache = new ServerMemoryCache<AnalyticsResult>({
  namespace: "analytics",
  ttlMs: ANALYTICS_CACHE_TTL_MS,
  maxEntries: ANALYTICS_CACHE_MAX_ENTRIES
});

export function filtersCacheKey(filters: Filters): string {
  return JSON.stringify([
    filters.managedNetwork ?? "",
    filters.ictSystem ?? "",
    filters.systemCriticality ?? "",
    filters.securityDomain ?? "",
    filters.environment ?? "",
    filters.assetType ?? "",
    filters.severity ?? "",
    filters.missionCapability ?? "",
    filters.businessService ?? ""
  ]);
}

export function datasetCacheSignature(dataset: Dataset): string {
  return [
    dataset.snapshotDate,
    dataset.generatedAt,
    dataset.managedNetworks.length,
    dataset.ictSystems.length,
    dataset.assets.length
  ].join("|");
}

export function settingsCacheSignature(
  measuresSettings: MeasuresSettings,
  discoveryToolsSettings: DiscoveryToolsSettings
): string {
  const measuresVersion = measuresSettings.updatedAt ?? JSON.stringify(measuresSettings);
  const discoveryVersion = discoveryToolsSettings.updatedAt ?? JSON.stringify(discoveryToolsSettings);
  return `${measuresVersion}|${discoveryVersion}`;
}

function analyticsCacheKey(
  dataset: Dataset,
  filters: Filters,
  spiDefinitions: SpiDefinition[],
  severityDefinitions: SeverityDefinition[],
  measuresSettings: MeasuresSettings,
  discoveryToolsSettings: DiscoveryToolsSettings
): string {
  return [
    datasetCacheSignature(dataset),
    filtersCacheKey(filters),
    spiDefinitionsCacheSignature(spiDefinitions),
    severityDefinitionsCacheSignature(severityDefinitions),
    settingsCacheSignature(measuresSettings, discoveryToolsSettings)
  ].join("::");
}

export function getCachedAnalytics(
  dataset: Dataset,
  filters: Filters,
  spiDefinitions: SpiDefinition[],
  severityDefinitions: SeverityDefinition[],
  measuresSettings: MeasuresSettings,
  discoveryToolsSettings: DiscoveryToolsSettings
): AnalyticsResult {
  const key = analyticsCacheKey(dataset, filters, spiDefinitions, severityDefinitions, measuresSettings, discoveryToolsSettings);
  const cached = analyticsCache.get(key);
  if (cached) {
    return cached;
  }

  const value = buildAnalytics(dataset, dataset.ictSystems, filters, spiDefinitions, measuresSettings, discoveryToolsSettings);
  analyticsCache.set(key, value);
  return value;
}

export function clearAnalyticsCache(): void {
  analyticsCache.clear();
}

export function __resetAnalyticsCacheForTest(): void {
  clearAnalyticsCache();
  analyticsCache.resetStats();
}
