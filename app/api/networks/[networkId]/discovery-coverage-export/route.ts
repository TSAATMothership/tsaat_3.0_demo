import Papa from "papaparse";
import { NextRequest, NextResponse } from "next/server";
import { buildAnalytics } from "@/lib/analytics";
import { evaluateDiscoveryCoverage } from "@/lib/discovery-coverage";
import { loadDatasetForDate, loadDiscoveryToolsSettings, loadMeasuresSettings } from "@/lib/data-loader";
import { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { isUnassignedNetworkId } from "@/lib/network-scope";
import {
  buildScopedDiscoveryToolCoverage,
  discoveryCoverageValueLabel
} from "@/lib/scoped-discovery-tool-coverage";
import { Asset, ComplianceStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

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

function isDiscoveryCoverageCompliant(asset: Asset, discoveryToolsSettings: DiscoveryToolsSettings): boolean {
  const coverage = evaluateDiscoveryCoverage(asset, discoveryToolsSettings);
  return coverage.coverageCompliance;
}

function resolveAssetIpAddress(asset: Asset): string {
  const candidate = asset as Asset & {
    ipAddress?: string | null;
    ip?: string | null;
    ipv4?: string | null;
    ipv4Address?: string | null;
    primaryIp?: string | null;
  };
  const value =
    candidate.ipAddress ?? candidate.ip ?? candidate.ipv4 ?? candidate.ipv4Address ?? candidate.primaryIp ?? null;
  if (!value || !String(value).trim()) {
    return "N/A";
  }
  return String(value).trim();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { networkId: string } }
) {
  const requestedDataDate = request.nextUrl.searchParams.get("dataDate")?.trim() || undefined;
  const [dataset, measuresSettings, discoveryToolsSettings] = await Promise.all([
    loadDatasetForDate(requestedDataDate),
    loadMeasuresSettings(),
    loadDiscoveryToolsSettings()
  ]);

  if (isUnassignedNetworkId(params.networkId)) {
    return NextResponse.json(
      { error: "Unassigned Systems is not a network and cannot be used for network exports." },
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
    { managedNetwork: network.id },
    measuresSettings,
    discoveryToolsSettings
  );
  const assets = dataset.assets.filter((asset) => asset.networkId === network.id);
  const allFindings = analytics.findings;
  const requestedKpiFilter = request.nextUrl.searchParams.get("kpiFilter") ?? undefined;
  const selectedKpiFilter = isKpiFilterKey(requestedKpiFilter) ? requestedKpiFilter : undefined;
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
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
      return evaluation.evaluations.some(
        (evaluationItem) =>
          (evaluationItem.spiId === 1 || evaluationItem.spiId === 2) && evaluationItem.status === "Non-compliant"
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
      return !isDiscoveryCoverageCompliant(asset, discoveryToolsSettings);
    }
    return true;
  };

  const selectedDiscoverySearchTerm = request.nextUrl.searchParams.get("discoverySearch")?.trim().toLowerCase() ?? "";
  const selectedDiscoveryAssetType = request.nextUrl.searchParams.get("discoveryAssetType")?.trim() ?? "";
  const requestedDiscoveryToolFilter = request.nextUrl.searchParams.get("discoveryToolFilter")?.trim().toLowerCase();
  const scopedAssets = selectedKpiFilter ? assets.filter((asset) => matchesSelectedKpiFilter(asset)) : assets;
  const discoveryToolCoverageModel = buildScopedDiscoveryToolCoverage(scopedAssets, discoveryToolsSettings);
  const applicableDiscoveryToolIds = new Set(discoveryToolCoverageModel.toolColumns.map((tool) => tool.id));
  const selectedDiscoveryToolFilter =
    requestedDiscoveryToolFilter && applicableDiscoveryToolIds.has(requestedDiscoveryToolFilter)
      ? requestedDiscoveryToolFilter
      : undefined;

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
        assetIpAddress: resolveAssetIpAddress(asset),
        type: asset.type,
        environment: asset.systemContext?.environmentType ?? "-",
        ...toolValues,
        coverageCompliance: (coverage?.coverageCompliance ?? true) ? "Yes" : "No"
      };
    })
    .filter((row) => {
      if (selectedDiscoveryAssetType && row.type !== selectedDiscoveryAssetType) {
        return false;
      }
      if (selectedDiscoveryToolFilter) {
        const coverage = discoveryToolCoverageModel.assetCoverageById.get(row.assetId);
        if (coverage?.toolValues[selectedDiscoveryToolFilter] !== 0) {
          return false;
        }
      }
      if (!selectedDiscoverySearchTerm) {
        return true;
      }
      const text = [row.assetId, row.asset, row.assetIpAddress, row.type, row.environment].join(" ").toLowerCase();
      return text.includes(selectedDiscoverySearchTerm);
    })
    .sort((a, b) => a.asset.localeCompare(b.asset));

  const csv = Papa.unparse(rows);
  const safeNetworkId = network.id.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const safeDate = dataset.snapshotDate.replace(/[^0-9-]/g, "");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=network-discovery-coverage-${safeNetworkId}-${safeDate}.csv`
    }
  });
}
