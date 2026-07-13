import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import {
  buildSystemImpactAnalyserModelAssetIds,
  buildSystemImpactAnalyserRows
} from "@/lib/cyber-cop-impact-analyser";
import { buildSystemTopologyData } from "@/lib/network-topology";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { systemId: string } }) {
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { analytics, dataset, systems } = await getCoreAppData(queryObject);
  const system = dataset.ictSystems.find((item) => item.id === params.systemId);
  if (!system) {
    return NextResponse.json({ error: "ICT system not found" }, { status: 404 });
  }

  const topologyData = buildSystemTopologyData(dataset, analytics, system.id);
  const modelAssetIds = buildSystemImpactAnalyserModelAssetIds({
    system,
    assets: dataset.assets,
    topologyModelAssetIds: topologyData.modelAssetIds
  });
  const networkNameById = new Map(dataset.managedNetworks.map((network) => [network.id, network.name]));
  const rows = buildSystemImpactAnalyserRows({
    assets: dataset.assets,
    findings: analytics.findings,
    systems,
    system,
    modelAssetIds,
    networkNameById
  });

  return NextResponse.json({
    snapshotDate: dataset.snapshotDate,
    rows,
    totalRows: rows.length
  });
}
