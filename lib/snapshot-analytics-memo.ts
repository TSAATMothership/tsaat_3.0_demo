import { buildAnalytics } from "@/lib/analytics";
import { defaultMeasuresSettings, MeasuresSettings } from "@/lib/measures-settings";
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
  measuresSettings: MeasuresSettings = defaultMeasuresSettings()
) {
  const filterKey = filtersKey(filters);
  const cache = new Map<string, AnalyticsResult>();

  return (snapshot: Dataset): AnalyticsResult => {
    const key = `${snapshot.snapshotDate}::${filterKey}`;
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    const computed = buildAnalytics(snapshot, snapshot.ictSystems, filters, measuresSettings);
    cache.set(key, computed);
    return computed;
  };
}
