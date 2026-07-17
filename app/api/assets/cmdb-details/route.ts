import { NextRequest, NextResponse } from "next/server";
import { buildCmdbAssetDetails } from "@/lib/cmdb-drill-through";
import { DATA_DATE_PARAM, normalizeDataDate } from "@/lib/data-date";
import { loadDatasetForDate } from "@/lib/data-loader";

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

  const dataDate = normalizeDataDate(request.nextUrl.searchParams.get(DATA_DATE_PARAM));
  const dataset = await loadDatasetForDate(dataDate, { profile: "full" });
  const asset = buildCmdbAssetDetails(dataset, assetId);
  if (!asset) {
    return json({ error: "Asset not found in the selected snapshot." }, 404);
  }

  return json({ snapshotDate: dataset.snapshotDate, asset });
}
