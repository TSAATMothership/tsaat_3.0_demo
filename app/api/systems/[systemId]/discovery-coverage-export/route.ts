import Papa from "papaparse";
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
import {
  buildScopedDiscoveryToolCoverage,
  discoveryCoverageValueLabel
} from "@/lib/scoped-discovery-tool-coverage";
import { evaluationMatchesSpiFeature, SPI_FEATURE_OS_NON_COMPLIANT } from "@/lib/spi-features";
import type { Asset, ComplianceStatus, EnvironmentType } from "@/lib/types";

export const dynamic = "force-dynamic";

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

function isKpiFilterKey(value: string | undefined): value is KpiFilterKey {
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

function isDiscoveryCoverageCompliant(asset: Asset, coverageByAsset: ReturnType<typeof discoveryCoverageByAssetId>): boolean {
  const coverage = discoveryCoverageForAssetId(asset.id, coverageByAsset);
  return coverage.coverageCompliance;
}

export async function GET(request: NextRequest, { params }: { params: { systemId: string } }) {
  const requestedDataDate = request.nextUrl.searchParams.get("dataDate")?.trim() || undefined;
  const [dataset, discoveryToolsSettings, spiDefinitions, severityDefinitions] = await Promise.all([
    loadDatasetForDate(requestedDataDate),
    loadDiscoveryToolsSettings(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);
  const storedDiscoveryCoverageByAsset = discoveryCoverageByAssetId(dataset.discoveryCoverageEvaluations);

  const system = dataset.ictSystems.find((item) => item.id === params.systemId);
  if (!system) {
    return NextResponse.json({ error: "ICT system not found." }, { status: 404 });
  }

  const analytics = buildAnalytics(
    dataset,
    dataset.ictSystems,
    { ictSystem: system.id },
    spiDefinitions,
    measuresSettings,
    discoveryToolsSettings
  );
  const assets = dataset.assets.filter((asset) => asset.systemContext?.systemId === system.id);
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const p12Findings = analytics.findings.filter((finding) => finding.priorityRank <= 2);
  const requestedEnvironment = request.nextUrl.searchParams.get("environment")?.trim();
  const selectedEnvironment = system.environments.some((environment) => environment.type === requestedEnvironment)
    ? (requestedEnvironment as EnvironmentType)
    : undefined;
  const requestedKpiFilter = request.nextUrl.searchParams.get("kpiFilter") ?? undefined;
  const selectedKpiFilter = isKpiFilterKey(requestedKpiFilter) ? requestedKpiFilter : undefined;
  const serverSearchTerm = request.nextUrl.searchParams.get("serverSearch")?.trim().toLowerCase() ?? "";

  const searchMatchedAssets = serverSearchTerm
    ? assets.filter((asset) => {
        if (asset.type !== "server") {
          return false;
        }
        return asset.hostname.toLowerCase().includes(serverSearchTerm) || asset.id.toLowerCase().includes(serverSearchTerm);
      })
    : assets;
  const searchMatchedAssetIds = new Set(searchMatchedAssets.map((asset) => asset.id));
  const searchMatchedP12AssetIds = new Set(
    p12Findings.filter((finding) => searchMatchedAssetIds.has(finding.scope.assetId)).map((finding) => finding.scope.assetId)
  );
  const searchMatchedHighRiskP12AssetIds = new Set(
    p12Findings
      .filter((finding) => searchMatchedAssetIds.has(finding.scope.assetId) && finding.severity === "High Risk")
      .map((finding) => finding.scope.assetId)
  );
  const nonCompliantEnvironmentTypes = new Set(
    system.environments
      .map((environment) => environment.type)
      .filter((environmentType) => {
        const statuses = analytics.evaluations
          .filter(
            (evaluation) => evaluation.environmentType === environmentType && searchMatchedAssetIds.has(evaluation.assetId)
          )
          .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
        return overallStatusFromStatuses(statuses) === "Non-compliant";
      })
  );

  const matchesSelectedKpiFilter = (asset: (typeof assets)[number]): boolean => {
    if (!selectedKpiFilter) {
      return true;
    }
    if (selectedKpiFilter === "nonCompliantServers") {
      if (asset.type !== "server") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      return Boolean(evaluation?.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant"));
    }
    if (selectedKpiFilter === "nonCompliantOs") {
      if (asset.type !== "server" && asset.type !== "workstation") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      return Boolean(
        evaluation?.evaluations.some((evaluationItem) =>
          evaluationMatchesSpiFeature(evaluationItem, SPI_FEATURE_OS_NON_COMPLIANT, spiDefinitions)
        )
      );
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
      return !isDiscoveryCoverageCompliant(asset, storedDiscoveryCoverageByAsset);
    }
    return true;
  };

  const scopedAssets = (selectedKpiFilter ? searchMatchedAssets.filter((asset) => matchesSelectedKpiFilter(asset)) : searchMatchedAssets)
    .filter((asset) => !selectedEnvironment || asset.systemContext?.environmentType === selectedEnvironment);
  const discoveryToolCoverageModel = buildScopedDiscoveryToolCoverage(
    scopedAssets,
    discoveryToolsSettings,
    dataset.discoveryCoverageEvaluations
  );
  const rows = scopedAssets
    .map((asset) => {
      const coverage = discoveryToolCoverageModel.assetCoverageById.get(asset.id);
      const toolValues = Object.fromEntries(
        discoveryToolCoverageModel.toolColumns.map((tool) => [
          tool.label,
          discoveryCoverageValueLabel(coverage?.toolValues[tool.id])
        ])
      );
      return {
        assetId: asset.id,
        asset: asset.hostname,
        type: asset.type,
        environment: asset.systemContext?.environmentType ?? "-",
        ...toolValues,
        coverageCompliance: (coverage?.coverageCompliance ?? true) ? "Yes" : "No"
      };
    })
    .sort((a, b) => a.asset.localeCompare(b.asset));

  const csv = Papa.unparse(rows);
  const safeSystemId = system.id.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const safeDate = dataset.snapshotDate.replace(/[^0-9-]/g, "");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=system-discovery-coverage-${safeSystemId}-${safeDate}.csv`
    }
  });
}
