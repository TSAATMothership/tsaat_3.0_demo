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

export function discoveryOverviewActions({ coverage, endpoints, software, shadow, vulnerabilities, patches }: DiscoveryOverviewModel) {
  return [
    { title: "Review critical and high CVE observations", detail: "Validate the exposure and review the recorded remediation action.", count: vulnerabilities.criticalHigh, unit: "observations", id: "action-0" as const },
    { title: "Review overdue patch actions", detail: "Check recorded deadlines, ownership and maintenance plans, including exceptions.", count: patches.overdue, unit: "servers", id: "action-1" as const },
    { title: "Refresh unknown patch evidence", detail: "Complete missing evidence or refresh stale assessments before confirming patch status.", count: patches.unknown, unit: "servers", id: "action-2" as const },
    { title: "Close required tool coverage gaps", detail: "Inspect missing tools for each CI and restore discovery coverage.", count: coverage.gaps, unit: "CIs", id: "action-3" as const },
    { title: "Identify unknown IP nodes", detail: "Use IP scan and ARP evidence to investigate unidentified devices.", count: shadow.total, unit: "IP nodes", id: "action-4" as const },
    { title: "Refresh older endpoint discoveries", detail: "Review discoveries more than 30 days before the snapshot.", count: endpoints.stale, unit: "endpoints", id: "action-5" as const },
    { title: "Resolve missing discovery dates", detail: "Check collection evidence where the discovery date is missing.", count: endpoints.undated, unit: "endpoints", id: "action-6" as const },
    { title: "Complete software version evidence", detail: "Review software installations with no recorded version.", count: software.missingVersion, unit: "installations", id: "action-7" as const }
  ].filter((action) => action.count > 0);

}

export const DISCOVERY_OVERVIEW_NOTES = [
  "Coverage uses the saved tool-to-CI type mappings. Discovery age is measured against the selected snapshot; over 30 days is a review prompt and does not change coverage compliance.",
  "Software counts represent individual installations, including repeated products on different endpoints.",
  "Vulnerability totals use the same scoped observations as Security Vulnerability Explorer, detected on or before the snapshot. Repeated CVEs on different endpoints remain separate observations; source severity is not a new risk score.",
  "Patch totals use the same server status and recorded due dates as Patch Management Explorer. The verified percentage includes unknown servers in its denominator and is N/A when no servers are in scope. CVE observations do not prove that an OS patch is missing.",
  "ARP owner endpoints supply the observation table; they are distinct from the unidentified IP nodes. Shadow IT includes observations associated with selected systems through these owners."
];
