import { getCachedAnalytics } from "@/lib/analytics-cache";
import { defaultDiscoveryToolsSettings, DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { MeasuresSettings } from "@/lib/measures-settings";
import { SeverityDefinition, SpiDefinition } from "@/lib/spi-definitions";
import { AnalyticsResult, Dataset, Filters } from "@/lib/types";

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

export function createSnapshotAnalyticsMemo(
  filters: Filters,
  spiDefinitions: SpiDefinition[],
  severityDefinitions: SeverityDefinition[],
  measuresSettings: MeasuresSettings,
  discoveryToolsSettings: DiscoveryToolsSettings = defaultDiscoveryToolsSettings()
) {
  const filterKey = filtersKey(filters);
  const cache = new Map<string, AnalyticsResult>();

  return (snapshot: Dataset): AnalyticsResult => {
    const key = `${snapshot.snapshotDate}::${snapshot.generatedAt}::${filterKey}`;
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    const computed = getCachedAnalytics(
      snapshot,
      filters,
      spiDefinitions,
      severityDefinitions,
      measuresSettings,
      discoveryToolsSettings
    );
    cache.set(key, computed);
    return computed;
  };
}
