import { documentResponse } from "@/lib/documents/server-response";
import { orderReportFindings } from "@/lib/documents/finding-order";
import type { LegacyNarrativePdfData } from "@/lib/documents/legacy-pdf-data";
import { deviceFindingRows, deviceCoverageRows, DEVICE_FINDING_COLUMNS, DEVICE_COVERAGE_COLUMNS } from "@/lib/device-report";
import { NextRequest } from "next/server";
import { buildAnalytics } from "@/lib/analytics";
import { discoveryCoverageByAssetId, discoveryCoverageForAssetId } from "@/lib/discovery-coverage";
import {
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadMeasuresSettings,
  loadSeverityDefinitions,
  loadSpiDefinitions
} from "@/lib/data-loader";
import {
  filterRealNetworkAssets,
  filterRealNetworkEvaluations,
  filterRealNetworkFindings,
  filterRealNetworks
} from "@/lib/network-scope";
import { parseFilters } from "@/lib/selectors";
import { Asset, ComplianceStatus } from "@/lib/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function complianceScore(statuses: ComplianceStatus[]): number {
  if (!statuses.length) {
    return 0;
  }
  const compliant = statuses.filter((status) => status === "Compliant").length;
  return Number(((compliant / statuses.length) * 100).toFixed(1));
}
function overallStatusFromStatuses(statuses: ComplianceStatus[]): ComplianceStatus {
  if (!statuses.length) {
    return "Unknown";
  }
  if (statuses.some((status) => status === "Non-compliant")) {
    return "Non-compliant";
  }
  if (statuses.some((status) => status === "Unknown")) {
    return "Unknown";
  }
  return "Compliant";
}
function discoveryCoverageForAsset(asset: Asset, coverageByAsset: ReturnType<typeof discoveryCoverageByAssetId>) {
  const coverage = discoveryCoverageForAssetId(asset.id, coverageByAsset);
  return {
    missingTools: coverage.missingToolNames,
    coverageCompliance: coverage.coverageCompliance
  };
}
function reportFileName(snapshotDate: string): string {
  const safeDate = snapshotDate.replace(/[^0-9-]/g, "");
  return `dct-remediation-report-networks-scope-${safeDate}.pdf`;
}

export async function GET(request: NextRequest) {
  const [dataset, discoveryToolsSettings, spiDefinitions, severityDefinitions] = await Promise.all([
    loadDatasetForDate(request.nextUrl.searchParams.get("dataDate") ?? undefined),
    loadDiscoveryToolsSettings(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const storedDiscoveryCoverageByAsset = discoveryCoverageByAssetId(dataset.discoveryCoverageEvaluations);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(queryObject);
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, spiDefinitions, measuresSettings, discoveryToolsSettings);

  const scopedEvaluations = filterRealNetworkEvaluations(analytics.evaluations);
  const scopedAssetIds = new Set(scopedEvaluations.map((evaluation) => evaluation.assetId));
  const scopedAssets = filterRealNetworkAssets(dataset.assets.filter((asset) => scopedAssetIds.has(asset.id)));
  const scopedNetworkIds = new Set(scopedAssets.map((asset) => asset.networkId));
  const scopedNetworks = filterRealNetworks(dataset.managedNetworks)
    .filter((network) => scopedNetworkIds.has(network.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const findings = orderReportFindings(filterRealNetworkFindings(analytics.findings));
  const p12Findings = findings.filter((finding) => finding.priorityRank <= 2);
  const highRiskFindings = findings.filter((finding) => finding.severity === "High Risk");
  const nonCompliantFindings = findings.filter((finding) => finding.complianceStatus === "Non-compliant");

  const scopedStatuses = scopedEvaluations.flatMap((evaluation) =>
    evaluation.evaluations.map((evaluationItem) => evaluationItem.status)
  );
  const compliantStatusCount = scopedStatuses.filter((status) => status === "Compliant").length;
  const nonCompliantStatusCount = scopedStatuses.filter((status) => status === "Non-compliant").length;
  const unknownStatusCount = scopedStatuses.filter((status) => status === "Unknown").length;
  const scopedComplianceScore = complianceScore(scopedStatuses);
  const scopedPosture = overallStatusFromStatuses(scopedStatuses);

  const nonCompliantAssetCount = scopedEvaluations.filter((evaluation) =>
    evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant")
  ).length;

  const actionCounts = new Map<string, number>();
  for (const finding of nonCompliantFindings) {
    const action = finding.recommendedAction.trim() || "Review finding details and assign remediation owner.";
    actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
  }
  const prioritizedActions = Array.from(actionCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });

  const discoveryCoverageServerGaps = scopedAssets
    .filter((asset) => asset.type === "server")
    .map((asset) => {
      const coverage = discoveryCoverageForAsset(asset, storedDiscoveryCoverageByAsset);
      return {
        assetId: asset.id,
        hostname: asset.hostname,
        missingTools: coverage.missingTools
      };
    })
    .filter((item) => item.missingTools.length > 0)
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const maxFindingsInReport = 300;
  const findingsForReport = findings.slice(0, maxFindingsInReport);
  const isFindingsTruncated = findings.length > findingsForReport.length;

  const generatedAt = new Date().toISOString();
  const topActionSummary = prioritizedActions
    .slice(0, 3)
    .map(([action, count]) => `${count}x ${action}`)
    .join("; ");
  const lines: string[] = [];
  lines.push("# Network Scope Remediation Report");
  lines.push("");
  lines.push("## Report Name");
  lines.push("Network Scope Remediation Report");
  lines.push("");
  lines.push("## Timestamp");
  lines.push(`Generated At: ${generatedAt}`);
  lines.push(`Snapshot Date: ${dataset.snapshotDate}`);
  lines.push("");
  lines.push("## Introduction");
  lines.push(
    "This executive brief provides a concise remediation view of cyber posture across the currently scoped managed networks, aligned to active filters."
  );
  lines.push("");
  lines.push("## Audience");
  lines.push(
    "Senior responsible owners, network operations leadership, cyber security governance, and remediation delivery teams."
  );
  lines.push("");
  lines.push("## Executive Summary");
  lines.push(
    `Current scoped posture is ${scopedPosture} with a compliance score of ${scopedComplianceScore}%. The scope includes ${scopedNetworks.length} network(s), ${scopedAssets.length} asset(s), and ${findings.length} total finding(s), including ${p12Findings.length} P1-P2 and ${highRiskFindings.length} High Risk finding(s).`
  );
  lines.push("");
  lines.push("## Findings Summary Including Impacts");
  lines.push(
    `Non-compliance currently affects ${nonCompliantAssetCount} asset(s) and presents operational risk to service continuity, cyber resilience, and patch/remediation throughput. Discovery coverage review shows ${discoveryCoverageServerGaps.length} server(s) with missing discovery tool alignment, which may reduce visibility confidence for timely risk triage.`
  );
  lines.push("");
  lines.push("## Recommendations to Remediate");
  lines.push(
    prioritizedActions.length
      ? `Prioritize closure of recurrent non-compliance actions with accountable owners and delivery dates. Immediate focus should be placed on: ${topActionSummary}. In parallel, close discovery tooling gaps on affected servers to improve detection confidence and remediation tracking.`
      : "Maintain current control posture, continue scheduled assurance activities, and enforce governance checks to prevent regression."
  );
  lines.push("");
  lines.push("## Scope Summary");
  lines.push(`- Networks in Scope: ${scopedNetworks.length}`);
  lines.push(`- Assets in Scope: ${scopedAssets.length}`);
  lines.push(`- Assets with Non-compliance: ${nonCompliantAssetCount}`);
  lines.push(`- Findings in Scope: ${findings.length}`);
  lines.push(`- P1-P2 Findings in Scope: ${p12Findings.length}`);
  lines.push(`- High Risk Findings in Scope: ${highRiskFindings.length}`);
  lines.push(`- Compliance Score (Scoped): ${scopedComplianceScore}%`);
  lines.push(`- Overall Posture (Scoped): ${scopedPosture}`);
  lines.push("");
  lines.push("## Filters Applied");
  lines.push(`- Network: ${filters.managedNetwork ?? "All"}`);
  lines.push(`- ICT System: ${filters.ictSystem ?? "All"}`);
  lines.push(`- Criticality: ${filters.systemCriticality ?? "All"}`);
  lines.push(`- Security Domain: ${filters.securityDomain ?? "All"}`);
  lines.push(`- Environment: ${filters.environment ?? "All"}`);
  lines.push(`- Asset Type: ${filters.assetType ?? "All"}`);
  lines.push(`- Severity: ${filters.severity ?? "All"}`);
  lines.push(`- Mission Capability: ${filters.missionCapability ?? "All"}`);
  lines.push(`- Business Service: ${filters.businessService ?? "All"}`);
  lines.push("");
  lines.push("## Networks in Scope");
  if (!scopedNetworks.length) {
    lines.push("- No networks in the current scope.");
  } else {
    for (const network of scopedNetworks) {
      lines.push(`- ${network.name} (${network.id})`);
    }
  }

  lines.push("");
  lines.push("## Findings Register (Scoped)");
  if (!findingsForReport.length) {
    lines.push("- No findings in the current scope.");
  } else {
    lines.push("- Full finding details and device inventory columns are listed in the device register following this summary.");
  }
  if (isFindingsTruncated) {
    lines.push(`- Report truncated to first ${maxFindingsInReport} findings. Total scoped findings: ${findings.length}.`);
  }

  lines.push("");
  lines.push("## Required Actions to Remediate Non-compliance");
  if (!prioritizedActions.length) {
    lines.push("- No non-compliant findings in scope.");
  } else {
    for (const [action, count] of prioritizedActions) {
      lines.push(`- (${count}) ${action}`);
    }
  }

  lines.push("");
  lines.push("## Discovery Coverage Gap Remediation Plan");
  if (!discoveryCoverageServerGaps.length) {
    lines.push("- All servers in scope are discovery coverage compliant.");
  } else {
    lines.push(`- Servers requiring discovery tool deployment: ${discoveryCoverageServerGaps.length}`);
    lines.push("- Device details and required tools are listed in the discovery coverage table following this summary.");
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("- This report is generated from the Networks page and reflects the active filter scope.");

    const pageTitle = "Networks Remediation Report";
  const topAction = prioritizedActions[0];
  const visual: LegacyNarrativePdfData["visual"] = {
    pageTitle: "Networks Remediation Report",
    subtitle: "At-a-glance network posture visualisation with compliance mix, finding pressure, and coverage gaps.",
    cards: [
        { label: "Compliance Score", value: `${scopedComplianceScore}%`, tone: "good" },
        { label: "Networks in Scope", value: `${scopedNetworks.length}`, tone: "neutral" },
        { label: "Assets in Scope", value: `${scopedAssets.length}`, tone: "neutral" },
        { label: "Findings in Scope", value: `${findings.length}`, tone: "warning" }
    ],
    bars: [
        { label: "Non-compliant Assets", value: nonCompliantAssetCount, color: [0.82, 0.3, 0.29] },
        { label: "P1-P2 Findings", value: p12Findings.length, color: [0.17, 0.47, 0.77] },
        { label: "High Risk Findings", value: highRiskFindings.length, color: [0.86, 0.51, 0.2] },
        { label: "Discovery Gap Servers", value: discoveryCoverageServerGaps.length, color: [0.55, 0.38, 0.79] },
        { label: "Top Action Frequency", value: topAction?.[1] ?? 0, color: [0.35, 0.59, 0.83] }
    ],
    segments: [
        { label: "Compliant", value: compliantStatusCount, color: [0.2, 0.62, 0.42] },
        { label: "Non-compliant", value: nonCompliantStatusCount, color: [0.82, 0.3, 0.29] },
        { label: "Unknown", value: unknownStatusCount, color: [0.89, 0.66, 0.28] }
    ],
    insights: [
        `Scoped posture is ${scopedPosture} at ${scopedComplianceScore}% compliance.`,
        `${nonCompliantAssetCount} asset(s) currently carry non-compliance conditions requiring action.`,
        `${discoveryCoverageServerGaps.length} server(s) have discovery tool gaps that may reduce detection confidence.`,
        topAction ? `Most frequent remediation action: ${topAction[0]} (${topAction[1]} occurrence(s)).` : "No recurring remediation action pattern in current scope."
    ]
};
  const tables: LegacyNarrativePdfData["tables"] = [];
  if (findingsForReport.length)
    tables.push({
        sectionTitle: "Findings Register (Scoped)", columns: DEVICE_FINDING_COLUMNS, rows: deviceFindingRows(findingsForReport, dataset) });
  if (discoveryCoverageServerGaps.length)
    tables.push({
        sectionTitle: "Discovery Coverage Gap Remediation Plan", columns: DEVICE_COVERAGE_COLUMNS, rows: deviceCoverageRows(discoveryCoverageServerGaps, dataset) });
  const filename = reportFileName(dataset.snapshotDate);
  const data: LegacyNarrativePdfData = { snapshotDate: dataset.snapshotDate, pageTitle, lines, visual, tables };
  return documentResponse(request, { version: 1, kind: "pdf-networks-remediation", filename, title: pageTitle, generatedAt, data });
}
