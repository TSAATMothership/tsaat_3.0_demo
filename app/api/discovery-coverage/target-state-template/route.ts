import { NextRequest, NextResponse } from "next/server";
import { normalizeDataDate } from "@/lib/data-date";
import { loadDatasetForDate } from "@/lib/data-loader";
import { isUnassignedNetworkId } from "@/lib/discovery-filter-scope";
import {
  NETWORK_TARGET_STATE_TEMPLATE_CONTENT_TYPE,
  networkTargetStateTemplateContentDisposition
} from "@/lib/network-target-state-template-links";
import { buildNetworkTargetStateTemplateWorkbook } from "@/lib/network-target-state-template-workbook";

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

  const workbook = await buildNetworkTargetStateTemplateWorkbook(network);
  const workbookArrayBuffer = Uint8Array.from(workbook).buffer;

  return new Response(workbookArrayBuffer, {
    headers: {
      "Content-Type": NETWORK_TARGET_STATE_TEMPLATE_CONTENT_TYPE,
      "Content-Disposition": networkTargetStateTemplateContentDisposition(network.name)
    }
  });
}
