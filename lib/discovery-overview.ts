import { DISCOVERY_AGE_BUCKETS, discoveryAge, NOT_RECORDED, type EndpointRecord, type DiscoveryAge } from "@/lib/endpoint-explorer";
import { softwareValue, type InstalledSoftwareRecord } from "@/lib/installed-software-explorer";
import type { ShadowItRecord } from "@/lib/shadow-it-explorer";
import type { ScopedDiscoveryToolCoverageModel } from "@/lib/scoped-discovery-tool-coverage";
import { vulnerabilityValue, type SecurityVulnerabilityRecord } from "@/lib/security-vulnerability-explorer";
import type { PatchManagementRow, PatchStatus } from "@/lib/patch-management-explorer";

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

export function buildDiscoveryOverview({ coverage, endpoints, software, shadow, vulnerabilities, patches, snapshotDate }: {
  coverage: ScopedDiscoveryToolCoverageModel;
  endpoints: readonly EndpointRecord[];
  software: readonly InstalledSoftwareRecord[];
  shadow: readonly ShadowItRecord[];
  vulnerabilities: readonly SecurityVulnerabilityRecord[];
  patches: readonly PatchManagementRow[];
  snapshotDate: string;
}) {
  const applicableChecks = coverage.toolCards.reduce((sum, tool) => sum + tool.applicable, 0);
  const coveredChecks = coverage.toolCards.reduce((sum, tool) => sum + tool.covered, 0);
  const gaps = coverage.assetCoverages.filter((row) => !row.coverageCompliance).length;
  const unmapped = coverage.assetCoverages.filter((row) => !Object.values(row.toolValues).some((value) => value !== null)).length;
  const severityCounts = new Map<string, number>();
  for (const row of vulnerabilities) {
    const severity = vulnerabilityValue(row, "severity");
    severityCounts.set(severity, (severityCounts.get(severity) ?? 0) + 1);
  }
  const severityOrder = ["Critical", "High", "Medium", "Low", "Informational"];
  const severityRank = (severity: string) => severityOrder.includes(severity) ? severityOrder.indexOf(severity) : severityOrder.length;
  const statuses: PatchStatus[] = ["Patched", "Not patched", "Failed", "Restart required", "In progress", "Unknown"];
  const patched = patches.filter(row => row.status === "Patched").length;
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
    vulnerabilities: {
      total: vulnerabilities.length,
      distinctCves: new Set(vulnerabilities.map(row => row.cve)).size,
      affectedEndpoints: new Set(vulnerabilities.map(row => row.assetId)).size,
      criticalHigh: (severityCounts.get("Critical") ?? 0) + (severityCounts.get("High") ?? 0),
      severities: [...severityCounts].map(([severity, count]) => ({ severity, count }))
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.severity.localeCompare(b.severity)),
      missingRemediation: vulnerabilities.filter(row => vulnerabilityValue(row, "remediationGuidance") === NOT_RECORDED).length,
      sampleObservations: vulnerabilities.filter(row => row.source.startsWith("Sample")).length
    },
    patches: {
      total: patches.length, patched,
      verifiedPercent: patches.length ? Math.round(patched / patches.length * 1000) / 10 : null,
      statuses: statuses.map(status => ({ status, count: patches.filter(row => row.status === status).length })),
      overdue: patches.filter(row => row.daysOverdue > 0).length,
      unknown: patches.filter(row => row.status === "Unknown").length,
      sampleObservations: patches.filter(row => row.source?.startsWith("Sample")).length
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
