import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import { buildHighRiskCveIndexByAssetId } from "@/lib/cve";
import {
  buildCyberCopImpactAnalyserFindingRows,
  buildCyberCopImpactAnalyserRows,
  buildNetworkImpactAnalyserModelAssetIds,
  buildNetworkImpactAnalyserRows,
  filterCyberCopImpactAnalyserRows,
  pickHighRiskCvesByAssetId
} from "@/lib/cyber-cop-impact-analyser";
import { buildNetworkTopologyData } from "@/lib/network-topology";
import { applyAssetFilters } from "@/lib/selectors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readNumberParam(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function readCsvParam(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const selectedSpiId = readNumberParam(request.nextUrl.searchParams.get("spiId"));
  const diagramSystemIdsParam = request.nextUrl.searchParams.get("diagramSystemIds");
  const diagramNetworkIdsParam = request.nextUrl.searchParams.get("diagramNetworkIds");
  const { analytics, dataset, filters, systems, networks } = await getCoreAppData(queryObject);
  const isNetworkScope = diagramNetworkIdsParam !== null;
  let scopedAssets = applyAssetFilters(dataset.assets, systems, filters);
  let allRows = buildCyberCopImpactAnalyserRows(scopedAssets, analytics.findings, systems);

  if (isNetworkScope) {
    const requestedNetworkIds = new Set(readCsvParam(diagramNetworkIdsParam));
    const selectedNetworks = networks.filter((network) => requestedNetworkIds.has(network.id));
    const networkScopedAssets = applyAssetFilters(dataset.assets, dataset.ictSystems, filters);
    const networkScopedAssetIds = new Set(networkScopedAssets.map((asset) => asset.id));
    const modelAssetIds = new Set<string>();
    for (const network of selectedNetworks) {
      const topologyData = buildNetworkTopologyData(dataset, analytics, network.id, network.name);
      for (const assetId of buildNetworkImpactAnalyserModelAssetIds({
        network,
        assets: dataset.assets,
        topologyModelAssetIds: topologyData.modelAssetIds
      })) {
        if (networkScopedAssetIds.has(assetId)) {
          modelAssetIds.add(assetId);
        }
      }
    }
    scopedAssets = networkScopedAssets.filter((asset) => modelAssetIds.has(asset.id));
    const networkNameById = new Map(dataset.managedNetworks.map((network) => [network.id, network.name]));
    allRows = buildNetworkImpactAnalyserRows({
      assets: networkScopedAssets,
      findings: analytics.findings,
      systems: dataset.ictSystems,
      modelAssetIds,
      networkNameById
    });
  }

  const locallyFilteredRows = filterCyberCopImpactAnalyserRows(allRows, {
    environment: request.nextUrl.searchParams.get("diagramEnvironment"),
    securityDomain: request.nextUrl.searchParams.get("diagramSecurityDomain"),
    findingCriticality: request.nextUrl.searchParams.get("diagramFindingCriticality"),
    assetType: request.nextUrl.searchParams.get("diagramAssetType"),
    search: request.nextUrl.searchParams.get("diagramSearch"),
    selectedSearchAxis: request.nextUrl.searchParams.get("diagramSearchAxis"),
    selectedSearchValue: request.nextUrl.searchParams.get("diagramSearchValue"),
    systemIds: isNetworkScope || diagramSystemIdsParam === null ? null : readCsvParam(diagramSystemIdsParam)
  });
  const selectedRows = filterCyberCopImpactAnalyserRows(locallyFilteredRows, { spiId: selectedSpiId });
  const localFindingIds = new Set(locallyFilteredRows.map((row) => row.findingId));
  const selectedFindingIds = new Set(selectedRows.map((row) => row.findingId));
  const riskRows = buildCyberCopImpactAnalyserFindingRows({
    findings: analytics.findings,
    scopedAssets,
    allAssets: dataset.assets,
    systems: dataset.ictSystems,
    networks: dataset.managedNetworks
  });
  const allFindings = riskRows.filter(
    (finding) =>
      finding.workflowStatus === "open" &&
      Boolean(finding.sourceFindingId) &&
      localFindingIds.has(finding.sourceFindingId as string)
  );
  const selectedFindings = selectedSpiId
    ? allFindings.filter(
        (finding) =>
          finding.spiId === selectedSpiId &&
          Boolean(finding.sourceFindingId) &&
          selectedFindingIds.has(finding.sourceFindingId as string)
      )
    : [];
  const highRiskCvesByAssetId = buildHighRiskCveIndexByAssetId(scopedAssets);
  const assetIds = new Set(allFindings.map((finding) => finding.assetId));

  return NextResponse.json({
    snapshotDate: dataset.snapshotDate,
    selectedSpiId,
    findings: selectedFindings,
    allFindings,
    totalCount: isNetworkScope ? selectedRows.filter((row) => row.findingId).length : selectedRows.length,
    assetHighRiskCvesByAssetId: pickHighRiskCvesByAssetId(highRiskCvesByAssetId, assetIds)
  });
}
