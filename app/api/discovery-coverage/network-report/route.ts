import { documentResponse } from "@/lib/documents/server-response";

import { NextRequest, NextResponse } from "next/server";
import {
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadMeasuresSettings,
  loadSeverityDefinitions,
  loadSpiDefinitions
} from "@/lib/data-loader";
import { isUnassignedNetworkId } from "@/lib/discovery-filter-scope";
import { buildNetworkDiscoveryReportModel } from "@/lib/network-discovery-report-model";
import {
  networkDiscoveryReportDataDateFromSearchParams,
  networkDiscoveryReportFilename
} from "@/lib/network-discovery-report-links";
import { parseFilters } from "@/lib/selectors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const networkId = request.nextUrl.searchParams.get("network")?.trim();
  if (!networkId) {
    return errorResponse("Missing network parameter.", 400);
  }
  if (isUnassignedNetworkId(networkId)) {
    return errorResponse("Unassigned Systems is not a network and cannot be used for network discovery reports.", 400);
  }

  const requestedDataDate = networkDiscoveryReportDataDateFromSearchParams(request.nextUrl.searchParams);
  const [dataset, discoveryToolsSettings, spiDefinitions, severityDefinitions] = await Promise.all([
    loadDatasetForDate(requestedDataDate, { profile: "summary" }),
    loadDiscoveryToolsSettings(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);
  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(queryObject);
  const model = buildNetworkDiscoveryReportModel({
    dataset,
    discoveryToolsSettings,
    measuresSettings,
    spiDefinitions,
    networkId,
    filters
  });

  if (!model) {
    return errorResponse("Network row not found for supplied id.", 404);
  }

  return documentResponse(request, { version: 1, kind: "pdf-network-discovery", title: model.reportName,
    filename: networkDiscoveryReportFilename(networkId, dataset.snapshotDate), generatedAt: new Date().toISOString(), data: model });
}
