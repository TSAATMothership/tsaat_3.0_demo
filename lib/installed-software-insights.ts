import { DISCOVERY_AGE_BUCKETS, NOT_RECORDED, discoveryAge } from "@/lib/endpoint-explorer";
import { softwareFacetCounts, softwareValue, type InstalledSoftwareRecord } from "@/lib/installed-software-explorer";

/** Presentation of the Explorer's already scoped rows; no independent inventory or risk rules. */
export function buildInstalledSoftwareInsights(rows: readonly InstalledSoftwareRecord[], snapshotDate: string) {
  const products = softwareFacetCounts(rows, "softwareName");
  const versions = new Map<string, Set<string>>();
  const productEndpoints = new Map<string, Set<string>>();
  const ages = new Map<string, number>();
  for (const row of rows) {
    const name = softwareValue(row, "softwareName"), version = softwareValue(row, "softwareVersion");
    if (name !== NOT_RECORDED) {
      if (!versions.has(name)) versions.set(name, new Set());
      if (version !== NOT_RECORDED) versions.get(name)!.add(version);
    }
    if (!productEndpoints.has(name)) productEndpoints.set(name, new Set());
    productEndpoints.get(name)!.add(row.assetId);
    const age = discoveryAge(row, snapshotDate);
    ages.set(age, (ages.get(age) ?? 0) + 1);
  }
  const missing = (key: "softwareVersion" | "filePath" | "discoveredBy") => rows.filter(row => softwareValue(row, key) === NOT_RECORDED).length;
  const total = rows.length, missingVersion = missing("softwareVersion");
  const versionSpread = products.filter(row => (versions.get(row.value)?.size ?? 0) > 1)
    .map(row => ({ ...row, versions: versions.get(row.value)!.size, endpoints: productEndpoints.get(row.value)!.size }))
    .sort((a, b) => b.versions - a.versions || b.count - a.count || a.value.localeCompare(b.value));
  return {
    snapshotDate, total, endpoints: new Set(rows.map(row => row.assetId)).size,
    products: products.filter(row => row.value !== NOT_RECORDED),
    unnamed: products.find(row => row.value === NOT_RECORDED)?.count ?? 0,
    versionSpread, missingVersion, knownVersion: total - missingVersion,
    versionPercent: total ? Math.round((total - missingVersion) / total * 100) : null,
    missingPath: missing("filePath"), missingSource: missing("discoveredBy"),
    recency: DISCOVERY_AGE_BUCKETS.map(value => ({ value, count: ages.get(value) ?? 0 })),
    stale: (ages.get(DISCOVERY_AGE_BUCKETS[2]) ?? 0) + (ages.get(DISCOVERY_AGE_BUCKETS[3]) ?? 0),
    undated: ages.get(NOT_RECORDED) ?? 0, afterSnapshot: ages.get("After snapshot") ?? 0,
    sources: softwareFacetCounts(rows, "discoveredBy"), operatingSystems: softwareFacetCounts(rows, "osName"),
    topThree: products.filter(row => row.value !== NOT_RECORDED).slice(0, 3).reduce((sum, row) => sum + row.count, 0)
  };
}
export type InstalledSoftwareInsightsModel = ReturnType<typeof buildInstalledSoftwareInsights>;
