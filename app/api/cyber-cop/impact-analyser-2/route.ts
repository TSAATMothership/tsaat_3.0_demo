import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import { buildCyberCopImpactAnalyserRows } from "@/lib/cyber-cop-impact-analyser";
import { applyAssetFilters } from "@/lib/selectors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { analytics, dataset, filters, systems } = await getCoreAppData(queryObject);
  const filteredAssets = applyAssetFilters(dataset.assets, systems, filters);
  const rows = buildCyberCopImpactAnalyserRows(filteredAssets, analytics.findings, systems);

  return NextResponse.json({
    snapshotDate: dataset.snapshotDate,
    rows,
    totalRows: rows.length
  });
}
