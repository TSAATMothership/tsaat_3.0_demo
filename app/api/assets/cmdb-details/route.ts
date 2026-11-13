import { NextRequest, NextResponse } from "next/server";
import { buildCmdbAssetDetails } from "@/lib/cmdb-drill-through";
import { buildCmdbAssetView, buildCmdbModelCiView } from "@/lib/cmdb-attributes";
import { isModelCiType } from "@/lib/cmdb-ci-types";
import { buildCmdbModelCiDetails } from "@/lib/cmdb-model-ci";
import { loadCmdbAttributeDefinitions } from "@/lib/cmdb-attribute-loader";
import { DATA_DATE_PARAM, normalizeDataDate } from "@/lib/data-date";
import { loadCmdbDatasetForDate } from "@/lib/data-loader";

export const dynamic = "force-dynamic";

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
  const ciType = request.nextUrl.searchParams.get("ciType");
  if (ciType !== null && !isModelCiType(ciType)) return json({ error: "Unsupported CMDB CI type." }, 400);

  const dataDate = normalizeDataDate(request.nextUrl.searchParams.get(DATA_DATE_PARAM));
  const dataset = await loadCmdbDatasetForDate(dataDate, isModelCiType(ciType) ? undefined : assetId);
  if (isModelCiType(ciType)) {
    const params = request.nextUrl.searchParams;
    const ci = buildCmdbModelCiDetails(dataset, ciType, assetId, {
      network: params.has("network") ? params.getAll("network") : undefined,
      system: params.has("system") ? params.getAll("system") : undefined,
      securityDomain: params.has("securityDomain") ? params.getAll("securityDomain") : undefined
    });
    if (!ci) return json({ error: "CI not found in the selected snapshot and scope." }, 404);
    try {
      return json({ snapshotDate: dataset.snapshotDate, asset: buildCmdbModelCiView(ci, await loadCmdbAttributeDefinitions(ciType)) });
    } catch {
      return json({ error: "Unable to load the CMDB attribute configuration. Please retry." }, 503);
    }
  }
  const asset = buildCmdbAssetDetails(dataset, assetId);
  if (!asset) {
    return json({ error: "Asset not found in the selected snapshot." }, 404);
  }

  try {
    const definitions = await loadCmdbAttributeDefinitions(asset.assetType);
    return json({ snapshotDate: dataset.snapshotDate, asset: buildCmdbAssetView(asset, definitions) });
  } catch {
    return json({ error: "Unable to load the CMDB attribute configuration. Please retry." }, 503);
  }
}
