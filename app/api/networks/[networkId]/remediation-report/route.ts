import { documentResponse } from "@/lib/documents/server-response";
import { orderReportFindings } from "@/lib/documents/finding-order";
import type { LegacyNarrativePdfData } from "@/lib/documents/legacy-pdf-data";
import { matchesSecurityDomain, securityDomainFilter } from "@/lib/security-domain.mjs";
import { deviceFindingRows, deviceCoverageRows, DEVICE_FINDING_COLUMNS, DEVICE_COVERAGE_COLUMNS } from "@/lib/device-report";
import { NextRequest, NextResponse } from "next/server";
import { buildAnalytics } from "@/lib/analytics";
import { discoveryCoverageByAssetId, discoveryCoverageForAssetId } from "@/lib/discovery-coverage";
import {
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadMeasuresSettings,
  loadSeverityDefinitions,
  loadSpiDefinitions
} from "@/lib/data-loader";
import { isUnassignedNetworkId } from "@/lib/network-scope";
import { evaluationMatchesSpiFeature, SPI_FEATURE_OS_NON_COMPLIANT } from "@/lib/spi-features";
import { Asset, ComplianceStatus } from "@/lib/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type KpiFilterKey =
  | "nonCompliantAssets"
  | "nonCompliantServers"
  | "nonCompliantOs"
  | "nonCompliantEnvironments"
  | "p12Findings"
  | "highRiskP12Findings"
  | "outOfWarrantyAssets"
  | "nonCompliantDiscoveryCoverage";
const KPI_FILTER_LABELS: Record<KpiFilterKey, string> = {
  nonCompliantAssets: "Total Non-compliant Assets",
  nonCompliantServers: "Total Non-compliant Servers",
  nonCompliantOs: "Total Non-compliant OS",
  nonCompliantEnvironments: "Total Non-compliant Environments",
  p12Findings: "Total P1-P2 Findings",
  highRiskP12Findings: "Total P1-P2 High Risk Findings",
  outOfWarrantyAssets: "Total Physical Assets Out of Warranty",
  nonCompliantDiscoveryCoverage: "Assets non-compliant with discovery coverage"
};
function isKpiFilterKey(value: string | undefined): value is KpiFilterKey {
  if (!value) {
    return false;
  }
  return value in KPI_FILTER_LABELS;
}
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
function reportFileName(networkId: string, snapshotDate: string): string {
  const safeId = networkId.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const safeDate = snapshotDate.replace(/[^0-9-]/g, "");
  return `dct-remediation-report-network-${safeId}-${safeDate}.pdf`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { networkId: string } }
) {
  const [dataset, discoveryToolsSettings, spiDefinitions, severityDefinitions] = await Promise.all([
    loadDatasetForDate(request.nextUrl.searchParams.get("dataDate") ?? undefined),
    loadDiscoveryToolsSettings(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const storedDiscoveryCoverageByAsset = discoveryCoverageByAssetId(dataset.discoveryCoverageEvaluations);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);

  if (isUnassignedNetworkId(params.networkId)) {
    return NextResponse.json(
      { error: "Unassigned Systems is not a network and cannot be used for network reports." },
      { status: 400 }
    );
  }

  const network = dataset.managedNetworks.find((item) => item.id === params.networkId);

  if (!network) {
    return NextResponse.json({ error: "Managed network not found." }, { status: 404 });
  }

  const analytics = buildAnalytics(
    dataset,
    dataset.ictSystems,
    { managedNetwork: network.id, securityDomain: securityDomainFilter(request.nextUrl.searchParams.get("securityDomain")) },
    spiDefinitions,
    measuresSettings,
    discoveryToolsSettings
  );
  const assets = dataset.assets.filter((asset) => matchesSecurityDomain(asset.securityDomain, request.nextUrl.searchParams.get("securityDomain")) && asset.networkId === network.id);
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const allFindings = analytics.findings;
  const requestedKpiFilter = request.nextUrl.searchParams.get("kpiFilter") ?? undefined;
  const selectedKpiFilter = isKpiFilterKey(requestedKpiFilter) ? requestedKpiFilter : undefined;
  const p12AssetIds = new Set(
    allFindings.filter((finding) => finding.priorityRank <= 2).map((finding) => finding.scope.assetId)
  );
  const highRiskP12AssetIds = new Set(
    allFindings
      .filter((finding) => finding.priorityRank <= 2 && finding.severity === "High Risk")
      .map((finding) => finding.scope.assetId)
  );
  const nonCompliantEnvironmentTypes = new Set(
    (["Production", "Development", "UAT", "Test"] as const).filter((environmentType) => {
      const statuses = analytics.evaluations
        .filter((evaluation) => evaluation.environmentType === environmentType)
        .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
      return overallStatusFromStatuses(statuses) === "Non-compliant";
    })
  );

  const matchesSelectedKpiFilter = (asset: (typeof assets)[number]): boolean => {
    if (!selectedKpiFilter) {
      return true;
    }
    if (selectedKpiFilter === "nonCompliantAssets") {
      const evaluation = evaluationByAssetId.get(asset.id);
      if (!evaluation) {
        return false;
      }
      return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
    }
    if (selectedKpiFilter === "nonCompliantServers") {
      if (asset.type !== "server") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      if (!evaluation) {
        return false;
      }
      return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
    }
    if (selectedKpiFilter === "nonCompliantOs") {
      if (asset.type !== "server" && asset.type !== "workstation") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      if (!evaluation) {
        return false;
      }
      return evaluation.evaluations.some((evaluationItem) =>
        evaluationMatchesSpiFeature(evaluationItem, SPI_FEATURE_OS_NON_COMPLIANT, spiDefinitions)
      );
    }
    if (selectedKpiFilter === "nonCompliantEnvironments") {
      const environmentType = asset.systemContext?.environmentType;
      return environmentType ? nonCompliantEnvironmentTypes.has(environmentType) : false;
    }
    if (selectedKpiFilter === "p12Findings") {
      return p12AssetIds.has(asset.id);
    }
    if (selectedKpiFilter === "highRiskP12Findings") {
      return highRiskP12AssetIds.has(asset.id);
    }
    if (selectedKpiFilter === "outOfWarrantyAssets") {
      return asset.lifecycle.warrantyStatus === "OutOfWarranty";
    }
    if (selectedKpiFilter === "nonCompliantDiscoveryCoverage") {
      return !discoveryCoverageForAsset(asset, storedDiscoveryCoverageByAsset).coverageCompliance;
    }
    return true;
  };

  const scopedAssets = selectedKpiFilter ? assets.filter((asset) => matchesSelectedKpiFilter(asset)) : assets;
  const scopedAssetIds = new Set(scopedAssets.map((asset) => asset.id));
  const findings = orderReportFindings(allFindings.filter((finding) => scopedAssetIds.has(finding.scope.assetId)));
  const p12Findings = findings.filter((finding) => finding.priorityRank <= 2);
  const highRiskFindings = findings.filter((finding) => finding.severity === "High Risk");
  const nonCompliantFindings = findings.filter((finding) => finding.complianceStatus === "Non-compliant");

  const scopedStatuses = analytics.evaluations
    .filter((evaluation) => scopedAssetIds.has(evaluation.assetId))
    .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
  const scopedComplianceScore = complianceScore(scopedStatuses);
  const scopedPosture = overallStatusFromStatuses(scopedStatuses);

  const nonCompliantAssetCount = scopedAssets.filter((asset) => {
    const evaluation = evaluationByAssetId.get(asset.id);
    return evaluation ? evaluation.evaluations.some((item) => item.status === "Non-compliant") : false;
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

  const maxFindingsInReport = 200;
  const findingsForReport = findings.slice(0, maxFindingsInReport);
  const isFindingsTruncated = findings.length > findingsForReport.length;

  const generatedAt = new Date().toISOString();
  const lines: string[] = [];
  lines.push("# Network Remediation Report");
  lines.push("");
  lines.push(`Generated At: ${generatedAt}`);
  lines.push(`Snapshot Date: ${dataset.snapshotDate}`);
  lines.push("");
  lines.push("## Network Summary");
  lines.push(`- Network: ${network.name} (${network.id})`);
  lines.push(`- Classification: ${network.classification ?? "Unspecified"}`);
  lines.push(`- Compliance Score (Scoped): ${scopedComplianceScore}%`);
  lines.push(`- Overall Posture (Scoped): ${scopedPosture}`);
  lines.push(`- Assets in Scope: ${scopedAssets.length}`);
  lines.push(`- Assets with Non-compliance: ${nonCompliantAssetCount}`);
  lines.push(`- Findings in Scope: ${findings.length}`);
  lines.push(`- P1-P2 Findings in Scope: ${p12Findings.length}`);
  lines.push(`- High Risk Findings in Scope: ${highRiskFindings.length}`);
  lines.push("");
  lines.push("## Filters Applied");
  lines.push(`- Network: ${network.name} (${network.id})`);
  lines.push(`- KPI Filter: ${selectedKpiFilter ? KPI_FILTER_LABELS[selectedKpiFilter] : "None"}`);
  lines.push("- Drill-through Context: Network scope");
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
  lines.push("- This report is generated from the current network drill-through scope.");

    const pageTitle = `${network.name} Remediation Report`;
  const tables: LegacyNarrativePdfData["tables"] = [];
  if (findingsForReport.length)
    tables.push({
        sectionTitle: "Findings Register (Scoped)", columns: DEVICE_FINDING_COLUMNS, rows: deviceFindingRows(findingsForReport, dataset) });
  if (discoveryCoverageServerGaps.length)
    tables.push({
        sectionTitle: "Discovery Coverage Gap Remediation Plan", columns: DEVICE_COVERAGE_COLUMNS, rows: deviceCoverageRows(discoveryCoverageServerGaps, dataset) });
  const filename = reportFileName(network.id, dataset.snapshotDate);
  const data: LegacyNarrativePdfData = { snapshotDate: dataset.snapshotDate, pageTitle, lines, tables };
  return documentResponse(request, { version: 1, kind: "pdf-network-remediation", filename, title: pageTitle, generatedAt, data });
}
