import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import { buildHighRiskCveIndexByAssetId } from "@/lib/cve";
import {
  buildCyberCopImpactAnalyserFindingRows,
  buildCyberCopImpactAnalyserRows,
  filterCyberCopImpactAnalyserRows,
  pickHighRiskCvesByAssetId
} from "@/lib/cyber-cop-impact-analyser";
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
  const { analytics, dataset, filters, systems } = await getCoreAppData(queryObject);
  const filteredAssets = applyAssetFilters(dataset.assets, systems, filters);
  const allRows = buildCyberCopImpactAnalyserRows(filteredAssets, analytics.findings, systems);
  const locallyFilteredRows = filterCyberCopImpactAnalyserRows(allRows, {
    environment: request.nextUrl.searchParams.get("diagramEnvironment"),
    securityDomain: request.nextUrl.searchParams.get("diagramSecurityDomain"),
    findingCriticality: request.nextUrl.searchParams.get("diagramFindingCriticality"),
    search: request.nextUrl.searchParams.get("diagramSearch"),
    selectedSearchAxis: request.nextUrl.searchParams.get("diagramSearchAxis"),
    selectedSearchValue: request.nextUrl.searchParams.get("diagramSearchValue"),
    systemIds: diagramSystemIdsParam === null ? null : readCsvParam(diagramSystemIdsParam)
  });
  const selectedRows = filterCyberCopImpactAnalyserRows(locallyFilteredRows, { spiId: selectedSpiId });
  const localFindingIds = new Set(locallyFilteredRows.map((row) => row.findingId));
  const selectedFindingIds = new Set(selectedRows.map((row) => row.findingId));
  const riskRows = buildCyberCopImpactAnalyserFindingRows({
    findings: analytics.findings,
    scopedAssets: filteredAssets,
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
  const highRiskCvesByAssetId = buildHighRiskCveIndexByAssetId(filteredAssets);
  const assetIds = new Set(allFindings.map((finding) => finding.assetId));

  return NextResponse.json({
    snapshotDate: dataset.snapshotDate,
    selectedSpiId,
    findings: selectedFindings,
    allFindings,
    totalCount: selectedRows.length,
    assetHighRiskCvesByAssetId: pickHighRiskCvesByAssetId(highRiskCvesByAssetId, assetIds)
  });
}
