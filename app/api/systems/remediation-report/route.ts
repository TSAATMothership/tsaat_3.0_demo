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
import { applyAssetFilters, filterSystems, parseFilters } from "@/lib/selectors";
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
  return `dct-remediation-report-systems-scope-${safeDate}.pdf`;
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
  const systems = filterSystems(dataset.ictSystems, filters);
  const scopedSystemIds = new Set(systems.map((system) => system.id));

  const findings = orderReportFindings(analytics.findings.filter(
    (finding) => Boolean(finding.scope.systemId) && scopedSystemIds.has(finding.scope.systemId as string)
  ));
  const p12Findings = findings.filter((finding) => finding.priorityRank <= 2);
  const highRiskFindings = findings.filter((finding) => finding.severity === "High Risk");
  const nonCompliantFindings = findings.filter((finding) => finding.complianceStatus === "Non-compliant");

  const scopedStatuses = analytics.evaluations
    .filter((evaluation) => Boolean(evaluation.systemId) && scopedSystemIds.has(evaluation.systemId as string))
    .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
  const compliantStatusCount = scopedStatuses.filter((status) => status === "Compliant").length;
  const nonCompliantStatusCount = scopedStatuses.filter((status) => status === "Non-compliant").length;
  const unknownStatusCount = scopedStatuses.filter((status) => status === "Unknown").length;
  const scopedComplianceScore = complianceScore(scopedStatuses);
  const scopedPosture = overallStatusFromStatuses(scopedStatuses);

  const filteredAssets: Asset[] = applyAssetFilters(dataset.assets, systems, filters).filter((asset) => {
    const systemId = asset.systemContext?.systemId;
    return Boolean(systemId) && scopedSystemIds.has(systemId as string);
  });

  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const nonCompliantAssetCount = filteredAssets.filter((asset) => {
    const evaluation = evaluationByAssetId.get(asset.id);
    return evaluation ? evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant") : false;
  }).length;

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

  const discoveryCoverageServerGaps = filteredAssets
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
  lines.push("# ICT System Scope Remediation Report");
  lines.push("");
  lines.push("## Report Name");
  lines.push("ICT System Scope Remediation Report");
  lines.push("");
  lines.push("## Timestamp");
  lines.push(`Generated At: ${generatedAt}`);
  lines.push(`Snapshot Date: ${dataset.snapshotDate}`);
  lines.push("");
  lines.push("## Introduction");
  lines.push(
    "This executive brief provides a concise remediation view of cyber posture across the currently scoped ICT systems, aligned to active filters."
  );
  lines.push("");
  lines.push("## Audience");
  lines.push(
    "ICT system owners, service managers, cyber assurance stakeholders, and remediation delivery teams."
  );
  lines.push("");
  lines.push("## Executive Summary");
  lines.push(
    `Current scoped posture is ${scopedPosture} with a compliance score of ${scopedComplianceScore}%. The scope includes ${systems.length} ICT system(s), ${filteredAssets.length} asset(s), and ${findings.length} total finding(s), including ${p12Findings.length} P1-P2 and ${highRiskFindings.length} High Risk finding(s).`
  );
  lines.push("");
  lines.push("## Findings Summary Including Impacts");
  lines.push(
    `Non-compliance currently affects ${nonCompliantAssetCount} asset(s), creating elevated service and assurance risk where unresolved findings intersect with production and mission-critical operations. Discovery coverage review identifies ${discoveryCoverageServerGaps.length} server(s) with tool coverage gaps that may reduce visibility and delay response prioritization.`
  );
  lines.push("");
  lines.push("## Recommendations to Remediate");
  lines.push(
    prioritizedActions.length
      ? `Prioritize closure of repeated non-compliance actions with named ownership and due dates. Immediate attention should be given to: ${topActionSummary}. Concurrently remediate discovery coverage gaps to strengthen control verification and reporting confidence.`
      : "Maintain current control posture, continue scheduled assurance cycles, and enforce governance controls to sustain compliance outcomes."
  );
  lines.push("");
  lines.push("## Scope Summary");
  lines.push(`- ICT Systems in Scope: ${systems.length}`);
  lines.push(`- Assets in Scope: ${filteredAssets.length}`);
  lines.push(`- Assets with Non-compliance: ${nonCompliantAssetCount}`);
  lines.push(`- Findings in Scope: ${findings.length}`);
  lines.push(`- P1-P2 Findings in Scope: ${p12Findings.length}`);
  lines.push(`- High Risk Findings in Scope: ${highRiskFindings.length}`);
  lines.push(`- Compliance Score (Scoped): ${scopedComplianceScore}%`);
  lines.push(`- Overall Posture (Scoped): ${scopedPosture}`);
  lines.push("");
  lines.push("## Filters Applied");
  lines.push(`- ICT System: ${filters.ictSystem ?? "All"}`);
  lines.push(`- Criticality: ${filters.systemCriticality ?? "All"}`);
  lines.push(`- Security Domain: ${filters.securityDomain ?? "All"}`);
  lines.push(`- Environment: ${filters.environment ?? "All"}`);
  lines.push(`- Asset Type: ${filters.assetType ?? "All"}`);
  lines.push(`- Severity: ${filters.severity ?? "All"}`);
  lines.push(`- Mission Capability: ${filters.missionCapability ?? "All"}`);
  lines.push(`- Business Service: ${filters.businessService ?? "All"}`);
  lines.push("");
  lines.push("## ICT Systems in Scope");
  if (!systems.length) {
    lines.push("- No ICT systems in the current scope.");
  } else {
    for (const system of systems.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`- ${system.name} (${system.id})`);
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
  lines.push("- This report is generated from the ICT Systems page and reflects the active filter scope.");

    const pageTitle = "ICT Systems Remediation Report";
  const topAction = prioritizedActions[0];
  const visual: LegacyNarrativePdfData["visual"] = {
    pageTitle: "ICT Systems Remediation Report",
    subtitle: "Visualisation of scoped ICT system compliance, finding concentrations, and discovery coverage pressure.",
    cards: [
        { label: "Compliance Score", value: `${scopedComplianceScore}%`, tone: "good" },
        { label: "Systems in Scope", value: `${systems.length}`, tone: "neutral" },
        { label: "Assets in Scope", value: `${filteredAssets.length}`, tone: "neutral" },
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
        `${nonCompliantAssetCount} asset(s) in the current ICT system scope are non-compliant.`,
        `${discoveryCoverageServerGaps.length} server(s) have discovery tool coverage gaps.`,
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
  return documentResponse(request, { version: 1, kind: "pdf-systems-remediation", filename, title: pageTitle, generatedAt, data });
}
