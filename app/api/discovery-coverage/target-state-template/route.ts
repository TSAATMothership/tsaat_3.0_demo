import { documentResponse } from "@/lib/documents/server-response";
import type { WorkbookDocumentJob } from "@/lib/documents/workbooks";
import { NextRequest, NextResponse } from "next/server";
import { normalizeDataDate } from "@/lib/data-date";
import { loadDatasetForDate } from "@/lib/data-loader";
import { isUnassignedNetworkId } from "@/lib/discovery-filter-scope";
import {
  networkTargetStateTemplateFilename
} from "@/lib/network-target-state-template-links";

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
    return errorResponse("Unassigned Systems is not a network and cannot be used for target-state templates.", 400);
  }

  const requestedDataDate = normalizeDataDate(request.nextUrl.searchParams.get("dataDate"));
  const dataset = await loadDatasetForDate(requestedDataDate, { profile: "summary" });
  const network = dataset.managedNetworks.find((candidate) => candidate.id === networkId);
  if (!network) {
    return errorResponse("Network row not found for supplied id.", 404);
  }

  return documentResponse(request, { version: 1, kind: "xlsx-target-state", title: "Network target-state template",
    filename: networkTargetStateTemplateFilename(network.name), generatedAt: new Date().toISOString(),
    data: { network, snapshotDate: dataset.snapshotDate } } satisfies WorkbookDocumentJob);
}
