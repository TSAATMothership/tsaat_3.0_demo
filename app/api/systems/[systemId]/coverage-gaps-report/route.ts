import { documentResponse } from "@/lib/documents/server-response";
import type { LegacyNarrativePdfData } from "@/lib/documents/legacy-pdf-data";
import { matchesSecurityDomain, securityDomainFilter } from "@/lib/security-domain.mjs";
import { deviceCoverageRows, DEVICE_COVERAGE_COLUMNS } from "@/lib/device-report";
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
import { evaluationMatchesSpiFeature, SPI_FEATURE_OS_NON_COMPLIANT } from "@/lib/spi-features";
import { Asset, ComplianceStatus, EnvironmentType } from "@/lib/types";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type KpiFilterKey =
  | "nonCompliantServers"
  | "nonCompliantOs"
  | "nonCompliantEnvironments"
  | "p12Findings"
  | "highRiskP12Findings"
  | "outOfWarrantyAssets"
  | "nonCompliantDiscoveryCoverage";
const KPI_FILTER_LABELS: Record<KpiFilterKey, string> = {
  nonCompliantServers: "Total Non-compliant Servers",
  nonCompliantOs: "Total Non-compliant OS",
  nonCompliantEnvironments: "Total Non-compliant Environments",
  p12Findings: "Total P1-P2 Findings",
  highRiskP12Findings: "Total P1-P2 High Risk Findings",
  outOfWarrantyAssets: "Total Physical Assets Out of Warranty",
  nonCompliantDiscoveryCoverage: "Assets non-compliant with discovery coverage"
};
function isKpiFilterKey(value: string | null): value is KpiFilterKey {
  if (!value) {
    return false;
  }
  return value in KPI_FILTER_LABELS;
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
function nonCompliantEnvironmentTypesForScope(
  environments: Array<{ type: EnvironmentType }>,
  evaluations: Array<{
    assetId: string;
    environmentType: EnvironmentType | null;
    evaluations: Array<{ status: ComplianceStatus }>;
  }>,
  scopedAssetIds: Set<string>
): Set<EnvironmentType> {
  const nonCompliant = new Set<EnvironmentType>();
  for (const environment of environments) {
    const statuses = evaluations
      .filter(
        (evaluation) => evaluation.environmentType === environment.type && scopedAssetIds.has(evaluation.assetId)
      )
      .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));

    if (overallStatusFromStatuses(statuses) === "Non-compliant") {
      nonCompliant.add(environment.type);
    }
  }
  return nonCompliant;
}
function discoveryCoverageForAsset(asset: Asset, coverageByAsset: ReturnType<typeof discoveryCoverageByAssetId>) {
  const coverage = discoveryCoverageForAssetId(asset.id, coverageByAsset);
  return {
    missingTools: coverage.missingToolNames,
    coverageCompliance: coverage.coverageCompliance
  };
}
function reportFileName(systemId: string, snapshotDate: string): string {
  const safeId = systemId.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const safeDate = snapshotDate.replace(/[^0-9-]/g, "");
  return `tsaat-coverage-gaps-report-${safeId}-${safeDate}.pdf`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { systemId: string } }
) {
  const [dataset, discoveryToolsSettings, spiDefinitions, severityDefinitions] = await Promise.all([
    loadDatasetForDate(request.nextUrl.searchParams.get("dataDate") ?? undefined),
    loadDiscoveryToolsSettings(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const storedDiscoveryCoverageByAsset = discoveryCoverageByAssetId(dataset.discoveryCoverageEvaluations);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);
  const system = dataset.ictSystems.find((item) => item.id === params.systemId);

  if (!system) {
    return NextResponse.json({ error: "ICT System not found." }, { status: 404 });
  }

  const analytics = buildAnalytics(
    dataset,
    dataset.ictSystems,
    { ictSystem: system.id, securityDomain: securityDomainFilter(request.nextUrl.searchParams.get("securityDomain")) },
    spiDefinitions,
    measuresSettings,
    discoveryToolsSettings
  );
  const assets = dataset.assets.filter((asset) => matchesSecurityDomain(asset.securityDomain, request.nextUrl.searchParams.get("securityDomain")) && asset.systemContext?.systemId === system.id);
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const p12Findings = analytics.findings.filter((finding) => finding.priorityRank <= 2);

  const requestedEnvironment = request.nextUrl.searchParams.get("environment");
  const selectedEnvironment = system.environments.some((environment) => environment.type === requestedEnvironment)
    ? (requestedEnvironment as EnvironmentType)
    : undefined;
  const requestedKpiFilter = request.nextUrl.searchParams.get("kpiFilter");
  const selectedKpiFilter = isKpiFilterKey(requestedKpiFilter) ? requestedKpiFilter : undefined;
  const serverSearchTerm = request.nextUrl.searchParams.get("serverSearch")?.trim() ?? "";
  const normalizedServerSearchTerm = serverSearchTerm.toLowerCase();

  const searchMatchedAssets = normalizedServerSearchTerm
    ? assets.filter((asset) => {
        if (asset.type !== "server") {
          return false;
        }
        return (
          asset.hostname.toLowerCase().includes(normalizedServerSearchTerm) ||
          asset.id.toLowerCase().includes(normalizedServerSearchTerm)
        );
      })
    : assets;
  const searchMatchedAssetIds = new Set(searchMatchedAssets.map((asset) => asset.id));

  const searchMatchedFindings = p12Findings.filter((finding) => searchMatchedAssetIds.has(finding.scope.assetId));
  const searchMatchedP12AssetIds = new Set(searchMatchedFindings.map((finding) => finding.scope.assetId));
  const searchMatchedHighRiskP12AssetIds = new Set(
    searchMatchedFindings
      .filter((finding) => finding.severity === "High Risk")
      .map((finding) => finding.scope.assetId)
  );

  const nonCompliantEnvironmentTypes = nonCompliantEnvironmentTypesForScope(
    system.environments,
    analytics.evaluations,
    searchMatchedAssetIds
  );

  const matchesSelectedKpiFilter = (asset: Asset): boolean => {
    if (!selectedKpiFilter) {
      return true;
    }

    if (selectedKpiFilter === "nonCompliantServers") {
      if (asset.type !== "server") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      return evaluation ? evaluation.evaluations.some((item) => item.status === "Non-compliant") : false;
    }

    if (selectedKpiFilter === "nonCompliantOs") {
      if (asset.type !== "server" && asset.type !== "workstation") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      return evaluation
        ? evaluation.evaluations.some((item) =>
            evaluationMatchesSpiFeature(item, SPI_FEATURE_OS_NON_COMPLIANT, spiDefinitions)
          )
        : false;
    }

    if (selectedKpiFilter === "nonCompliantEnvironments") {
      const environmentType = asset.systemContext?.environmentType;
      return environmentType ? nonCompliantEnvironmentTypes.has(environmentType) : false;
    }

    if (selectedKpiFilter === "p12Findings") {
      return searchMatchedP12AssetIds.has(asset.id);
    }

    if (selectedKpiFilter === "highRiskP12Findings") {
      return searchMatchedHighRiskP12AssetIds.has(asset.id);
    }

    if (selectedKpiFilter === "outOfWarrantyAssets") {
      return asset.lifecycle.warrantyStatus === "OutOfWarranty";
    }

    if (selectedKpiFilter === "nonCompliantDiscoveryCoverage") {
      return !discoveryCoverageForAsset(asset, storedDiscoveryCoverageByAsset).coverageCompliance;
    }

    return true;
  };

  const kpiMatchedAssets = selectedKpiFilter
    ? searchMatchedAssets.filter((asset) => matchesSelectedKpiFilter(asset))
    : searchMatchedAssets;

  const filteredAssets = selectedEnvironment
    ? kpiMatchedAssets.filter((asset) => asset.systemContext?.environmentType === selectedEnvironment)
    : kpiMatchedAssets;
  const filteredServers = filteredAssets.filter((asset) => asset.type === "server");

  const serverCoverageGaps = filteredServers
    .map((asset) => {
      const coverage = discoveryCoverageForAsset(asset, storedDiscoveryCoverageByAsset);

      return {
        assetId: asset.id,
        hostname: asset.hostname,
        environment: asset.systemContext?.environmentType ?? "-",
        missingTools: coverage.missingTools
      };
    })
    .filter((item) => item.missingTools.length > 0)
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const generatedAt = new Date().toISOString();
  const lines: string[] = [];
  lines.push("# ICT System Discovery Coverage Gaps Report");
  lines.push("");
  lines.push(`Generated At: ${generatedAt}`);
  lines.push(`Snapshot Date: ${dataset.snapshotDate}`);
  lines.push("");
  lines.push("## ICT System Scope");
  lines.push(`- ICT System: ${system.name} (${system.id})`);
  lines.push(`- Network: ${system.networkId}`);
  lines.push(`- Servers in Scope: ${filteredServers.length}`);
  lines.push(`- Servers with Discovery Coverage Gaps: ${serverCoverageGaps.length}`);
  lines.push("");
  lines.push("## Filters Applied");
  lines.push(`- Environment: ${selectedEnvironment ?? "All Environments"}`);
  lines.push(`- Server Search: ${serverSearchTerm || "None"}`);
  lines.push(`- KPI Filter: ${selectedKpiFilter ? KPI_FILTER_LABELS[selectedKpiFilter] : "None"}`);
  lines.push("");
  lines.push("## Required Discovery Tool Deployment by Server");

  if (!serverCoverageGaps.length) {
    lines.push("- All servers in scope are discovery coverage compliant.");
  } else {
    lines.push("- Device details and required tools are listed in the coverage table following this summary.");
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("- This report reflects current ICT System drill-through filters and focuses on server discovery tool gaps.");

    const pageTitle = `${system.name} Coverage Gaps Report`;
  const tables: LegacyNarrativePdfData["tables"] = [];
  if (serverCoverageGaps.length)
    tables.push({
        sectionTitle: "Required Discovery Tool Deployment by Server", columns: DEVICE_COVERAGE_COLUMNS, rows: deviceCoverageRows(serverCoverageGaps, dataset) });
  const filename = reportFileName(system.id, dataset.snapshotDate);
  const data: LegacyNarrativePdfData = { snapshotDate: dataset.snapshotDate, pageTitle, lines, tables };
  return documentResponse(request, { version: 1, kind: "pdf-system-coverage-gaps", filename, title: pageTitle, generatedAt, data });
}
