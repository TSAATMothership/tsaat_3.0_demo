import { buildAnalytics } from "@/lib/analytics";
import { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { MeasuresSettings } from "@/lib/measures-settings";
import { AnalyticsResult, Dataset, Filters } from "@/lib/types";

const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;
const ANALYTICS_CACHE_MAX_ENTRIES = 300;

interface AnalyticsCacheEntry {
  value: AnalyticsResult;
  expiresAt: number;
  lastAccessedAt: number;
}

const analyticsCache = new Map<string, AnalyticsCacheEntry>();

function filtersKey(filters: Filters): string {
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

function datasetSignature(dataset: Dataset): string {
  return [
    dataset.snapshotDate,
    dataset.generatedAt,
    dataset.managedNetworks.length,
    dataset.ictSystems.length,
    dataset.assets.length
  ].join("|");
}

function settingsSignature(
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
  measuresSettings: MeasuresSettings,
  discoveryToolsSettings: DiscoveryToolsSettings
): string {
  return [
    datasetSignature(dataset),
    filtersKey(filters),
    settingsSignature(measuresSettings, discoveryToolsSettings)
  ].join("::");
}

function pruneAnalyticsCache(now: number): void {
  for (const [key, entry] of analyticsCache.entries()) {
    if (entry.expiresAt <= now) {
      analyticsCache.delete(key);
    }
  }

  if (analyticsCache.size <= ANALYTICS_CACHE_MAX_ENTRIES) {
    return;
  }

  const entriesByAccess = Array.from(analyticsCache.entries()).sort(
    (a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt
  );
  const toDelete = analyticsCache.size - ANALYTICS_CACHE_MAX_ENTRIES;
  for (let index = 0; index < toDelete; index += 1) {
    analyticsCache.delete(entriesByAccess[index][0]);
  }
}

export function getCachedAnalytics(
  dataset: Dataset,
  filters: Filters,
  measuresSettings: MeasuresSettings,
  discoveryToolsSettings: DiscoveryToolsSettings
): AnalyticsResult {
  const now = Date.now();
  const key = analyticsCacheKey(dataset, filters, measuresSettings, discoveryToolsSettings);
  const cached = analyticsCache.get(key);
  if (cached && cached.expiresAt > now) {
    cached.lastAccessedAt = now;
    return cached.value;
  }

  const value = buildAnalytics(dataset, dataset.ictSystems, filters, measuresSettings, discoveryToolsSettings);
  analyticsCache.set(key, {
    value,
    expiresAt: now + ANALYTICS_CACHE_TTL_MS,
    lastAccessedAt: now
  });
  pruneAnalyticsCache(now);
  return value;
}

