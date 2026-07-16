import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import {
  buildCyberCopImpactAnalyserRows,
  buildNetworkImpactAnalyserModelAssetIds,
  buildNetworkImpactAnalyserRows
} from "@/lib/cyber-cop-impact-analyser";
import { buildNetworkTopologyData } from "@/lib/network-topology";
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
  const diagramNetworkIdsParam = request.nextUrl.searchParams.get("diagramNetworkIds");
  const diagramSystemIds = diagramSystemIdsParam === null ? null : new Set(readCsvParam(diagramSystemIdsParam));
  const { analytics, dataset, filters, systems, networks } = await getCoreAppData(queryObject);

  if (diagramNetworkIdsParam !== null) {
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
    const networkNameById = new Map(dataset.managedNetworks.map((network) => [network.id, network.name]));
    const rows = buildNetworkImpactAnalyserRows({
      assets: networkScopedAssets,
      findings: analytics.findings,
      systems: dataset.ictSystems,
      modelAssetIds,
      networkNameById
    });

    return NextResponse.json({
      snapshotDate: dataset.snapshotDate,
      rows,
      totalRows: rows.length
    });
  }

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
