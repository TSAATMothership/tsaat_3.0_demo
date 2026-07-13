import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import { buildCyberCopImpactAnalyserRows } from "@/lib/cyber-cop-impact-analyser";
import { applyAssetFilters } from "@/lib/selectors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const diagramSystemIdsParam = request.nextUrl.searchParams.get("diagramSystemIds");
  const diagramSystemIds = diagramSystemIdsParam === null ? null : new Set(readCsvParam(diagramSystemIdsParam));
  const { analytics, dataset, filters, systems } = await getCoreAppData(queryObject);
  const filteredAssets = applyAssetFilters(dataset.assets, systems, filters);
  const analyserAssets = diagramSystemIds
    ? filteredAssets.filter((asset) => {
        const systemId = asset.systemContext?.systemId;
        return systemId ? diagramSystemIds.has(systemId) : false;
      })
    : filteredAssets;
  const rows = buildCyberCopImpactAnalyserRows(analyserAssets, analytics.findings, systems);

  return NextResponse.json({
    snapshotDate: dataset.snapshotDate,
    rows,
    totalRows: rows.length
  });
}
