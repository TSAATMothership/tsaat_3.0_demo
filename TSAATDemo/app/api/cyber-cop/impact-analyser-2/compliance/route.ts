import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import { buildServerComplianceModel } from "@/lib/server-compliance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const assetId = request.nextUrl.searchParams.get("assetId")?.trim() ?? "";
  if (!assetId) {
    return json({ error: "Missing required query parameter: assetId." }, 400);
  }

  const queryObject = Object.fromEntries(request.nextUrl.searchParams.entries());
  const preferredSystemId = request.nextUrl.searchParams.get("systemId")?.trim() || null;
  const { dataset, spiDefinitions, discoveryToolsSettings } = await getCoreAppData(queryObject);
  const model = buildServerComplianceModel({
    dataset,
    assetId,
    spiDefinitions,
    discoveryToolsSettings,
    preferredSystemId
  });
  if (!model) {
    return json({ error: "Server asset not found in the selected snapshot." }, 404);
  }

  return json(model);
}
