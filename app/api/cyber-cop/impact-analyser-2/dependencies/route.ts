import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import { buildCyberCopIctSystemDependencyRows } from "@/lib/cyber-cop-impact-analyser";
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
  const selectedSystemIds = readCsvParam(request.nextUrl.searchParams.get("diagramSystemIds"));
  const { dataset, filters } = await getCoreAppData(queryObject);
  const eligibleSourceAssetIds = applyAssetFilters(dataset.assets, dataset.ictSystems, filters).map(
    (asset) => asset.id
  );
  const networkNameById = new Map(dataset.managedNetworks.map((network) => [network.id, network.name]));
  const rows = buildCyberCopIctSystemDependencyRows({
    assets: dataset.assets,
    ciDependencies: dataset.ciDependencies ?? [],
    systems: dataset.ictSystems,
    selectedSystemIds,
    sourceAssetIds: eligibleSourceAssetIds,
    networkNameById
  });

  return NextResponse.json({
    snapshotDate: dataset.snapshotDate,
    rows,
    totalRows: rows.length
  });
}
