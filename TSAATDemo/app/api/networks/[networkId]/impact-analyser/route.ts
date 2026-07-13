import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import {
  buildNetworkImpactAnalyserModelAssetIds,
  buildNetworkImpactAnalyserRows
} from "@/lib/cyber-cop-impact-analyser";
import { isUnassignedNetworkId } from "@/lib/network-scope";
import { buildNetworkTopologyData } from "@/lib/network-topology";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { networkId: string } }) {
  if (isUnassignedNetworkId(params.networkId)) {
    return NextResponse.json({ error: "Network not found" }, { status: 404 });
  }

  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
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
  const rows = buildNetworkImpactAnalyserRows({
    assets: dataset.assets,
    findings: analytics.findings,
    systems,
    modelAssetIds,
    networkName: network.name
  });

  return NextResponse.json({
    snapshotDate: dataset.snapshotDate,
    rows,
    totalRows: rows.length
  });
}
