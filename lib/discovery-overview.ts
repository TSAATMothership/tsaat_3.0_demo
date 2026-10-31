import { DISCOVERY_AGE_BUCKETS, discoveryAge, NOT_RECORDED, type EndpointRecord, type DiscoveryAge } from "@/lib/endpoint-explorer";
import { softwareValue, type InstalledSoftwareRecord } from "@/lib/installed-software-explorer";
import type { ShadowItRecord } from "@/lib/shadow-it-explorer";
import type { ScopedDiscoveryToolCoverageModel } from "@/lib/scoped-discovery-tool-coverage";

export const STALE_DISCOVERY_AGES: DiscoveryAge[] = [DISCOVERY_AGE_BUCKETS[2], DISCOVERY_AGE_BUCKETS[3]];

function discoveryQuality(rows: readonly { lastDiscoveredDate: string | null; discoveredBy: string | null }[], snapshotDate: string) {
  const ages = DISCOVERY_AGE_BUCKETS.map((age) => ({ age, count: 0 }));
  let missingSource = 0;
  for (const row of rows) {
    ages.find((bucket) => bucket.age === discoveryAge(row, snapshotDate))!.count += 1;
    if (!row.discoveredBy?.trim()) missingSource += 1;
  }
  return {
    ages, missingSource,
    stale: ages.filter(({ age }) => STALE_DISCOVERY_AGES.includes(age)).reduce((sum, { count }) => sum + count, 0),
    undated: ages.find(({ age }) => age === NOT_RECORDED)!.count,
    afterSnapshot: ages.find(({ age }) => age === "After snapshot")!.count
  };
}

export function buildDiscoveryOverview({ coverage, endpoints, software, shadow, snapshotDate }: {
  coverage: ScopedDiscoveryToolCoverageModel;
  endpoints: readonly EndpointRecord[];
  software: readonly InstalledSoftwareRecord[];
  shadow: readonly ShadowItRecord[];
  snapshotDate: string;
}) {
  const applicableChecks = coverage.toolCards.reduce((sum, tool) => sum + tool.applicable, 0);
  const coveredChecks = coverage.toolCards.reduce((sum, tool) => sum + tool.covered, 0);
  const gaps = coverage.assetCoverages.filter((row) => !row.coverageCompliance).length;
  const unmapped = coverage.assetCoverages.filter((row) => !Object.values(row.toolValues).some((value) => value !== null)).length;
  return {
    snapshotDate,
    coverage: {
      total: coverage.assetCoverages.length, gaps, unmapped,
      compliant: coverage.assetCoverages.length - gaps,
      applicableChecks, coveredChecks, missingChecks: applicableChecks - coveredChecks,
      percent: applicableChecks ? Math.round(coveredChecks / applicableChecks * 1000) / 10 : null,
      tools: [...coverage.toolCards].sort((a, b) => b.missing - a.missing || a.label.localeCompare(b.label)),
      ciTypes: coverage.ciTypeTotals.filter((row) => row.inScope > 0)
    },
    endpoints: { total: endpoints.length, ...discoveryQuality(endpoints, snapshotDate) },
    software: {
      total: software.length,
      products: new Set(software.map((row) => softwareValue(row, "softwareName"))).size,
      endpoints: new Set(software.map((row) => row.assetId)).size,
      missingVersion: software.filter((row) => !row.softwareVersion?.trim()).length,
      ...discoveryQuality(software, snapshotDate)
    },
    shadow: {
      total: shadow.length,
      ipScan: shadow.filter((row) => row.discoveryApproach === "IP Scan").length,
      arp: shadow.filter((row) => row.discoveryApproach === "ARP Table").length,
      owners: new Set(shadow.filter((row) => row.discoveryApproach === "ARP Table" && row.ownerAssetId).map((row) => row.ownerAssetId)).size,
      ...discoveryQuality(shadow, snapshotDate)
    }
  };
}
export type DiscoveryOverviewModel = ReturnType<typeof buildDiscoveryOverview>;
