import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import { buildHighRiskCveIndexByAssetId } from "@/lib/cve";
import {
  buildCyberCopImpactAnalyserFindingRows,
  buildNetworkImpactAnalyserModelAssetIds,
  buildNetworkImpactAnalyserRows,
  filterCyberCopImpactAnalyserRows,
  pickHighRiskCvesByAssetId
} from "@/lib/cyber-cop-impact-analyser";
import { isUnassignedNetworkId } from "@/lib/network-scope";
import { buildNetworkTopologyData } from "@/lib/network-topology";

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

export async function GET(request: NextRequest, { params }: { params: { networkId: string } }) {
  if (isUnassignedNetworkId(params.networkId)) {
    return NextResponse.json({ error: "Network not found" }, { status: 404 });
  }

  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const selectedSpiId = readNumberParam(request.nextUrl.searchParams.get("spiId"));
  const diagramSystemIdsParam = request.nextUrl.searchParams.get("diagramSystemIds");
  const { analytics, dataset, systems } = await getCoreAppData(queryObject);
  const network = dataset.managedNetworks.find((item) => item.id === params.networkId);
  if (!network) {
    return NextResponse.json({ error: "Network not found" }, { status: 404 });
  }

  const topologyData = buildNetworkTopologyData(dataset, analytics, network.id, network.name);
  const modelAssetIds = buildNetworkImpactAnalyserModelAssetIds({
    network,
    assets: dataset.assets,
    topologyModelAssetIds: topologyData.modelAssetIds
  });
  const modelAssetIdSet = new Set(modelAssetIds);
  const modelAssets = dataset.assets.filter((asset) => modelAssetIdSet.has(asset.id));
  const allRows = buildNetworkImpactAnalyserRows({
    assets: dataset.assets,
    findings: analytics.findings,
    systems,
    modelAssetIds,
    networkName: network.name
  });
  const locallyFilteredRows = filterCyberCopImpactAnalyserRows(allRows, {
    environment: request.nextUrl.searchParams.get("diagramEnvironment"),
    securityDomain: request.nextUrl.searchParams.get("diagramSecurityDomain"),
    findingCriticality: request.nextUrl.searchParams.get("diagramFindingCriticality"),
    assetType: request.nextUrl.searchParams.get("diagramAssetType"),
    search: request.nextUrl.searchParams.get("diagramSearch"),
    selectedSearchAxis: request.nextUrl.searchParams.get("diagramSearchAxis"),
    selectedSearchValue: request.nextUrl.searchParams.get("diagramSearchValue"),
    systemIds: diagramSystemIdsParam === null ? null : readCsvParam(diagramSystemIdsParam)
  });
  const selectedRows = filterCyberCopImpactAnalyserRows(locallyFilteredRows, { spiId: selectedSpiId });
  const localFindingIds = new Set(
    locallyFilteredRows.map((row) => row.findingId).filter((findingId): findingId is string => Boolean(findingId))
  );
  const selectedFindingIds = new Set(
    selectedRows.map((row) => row.findingId).filter((findingId): findingId is string => Boolean(findingId))
  );
  const riskRows = buildCyberCopImpactAnalyserFindingRows({
    findings: analytics.findings,
    scopedAssets: modelAssets,
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
  const highRiskCvesByAssetId = buildHighRiskCveIndexByAssetId(modelAssets);
  const assetIds = new Set(allFindings.map((finding) => finding.assetId));

  return NextResponse.json({
    snapshotDate: dataset.snapshotDate,
    selectedSpiId,
    findings: selectedFindings,
    allFindings,
    totalCount: selectedRows.filter((row) => row.findingId).length,
    assetHighRiskCvesByAssetId: pickHighRiskCvesByAssetId(highRiskCvesByAssetId, assetIds)
  });
}
