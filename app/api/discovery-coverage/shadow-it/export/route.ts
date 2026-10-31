import { NextRequest, NextResponse } from "next/server";
import { loadShadowItExplorerData } from "@/lib/data-loader";
import { filterShadowRows, parseShadowFilters, type ShadowFilters } from "@/lib/shadow-it-explorer";
import { buildShadowItWorkbook } from "@/lib/shadow-it-workbook";
import { INVENTORY_XLSX_TYPE } from "@/lib/inventory-explorer-workbook";
import { normalizeDataDate } from "@/lib/data-date";
import { scopeIds } from "@/lib/workspace-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let scope: { network: string[]; system: string[]; dataDate: string };
  let filters: ShadowFilters;
  try {
    const input = await request.json();
    const validIds = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 10000 && value.every((id) => typeof id === "string" && id.length <= 255);
    if (!validIds(input.scope?.network) || !validIds(input.scope?.system) || typeof input.scope?.dataDate !== "string" || !normalizeDataDate(input.scope.dataDate)) throw new Error("Invalid scope.");
    scope = { network: scopeIds(input.scope.network), system: scopeIds(input.scope.system), dataDate: input.scope.dataDate };
    if ((!scope.network.length && !scope.system.length) || (scope.network.length && scope.system.length)) throw new Error("Select networks or ICT systems.");
    filters = parseShadowFilters(input.filters);
  } catch {
    return NextResponse.json({ error: "Invalid Shadow IT export filters or scope." }, { status: 400 });
  }
  try {
    const data = await loadShadowItExplorerData(scope);
    const workbook = buildShadowItWorkbook(filterShadowRows(data.rows, filters, data.snapshotDate));
    return new Response(Uint8Array.from(workbook).buffer, { headers: {
      "Content-Type": INVENTORY_XLSX_TYPE,
      "Content-Disposition": `attachment; filename="shadow-it-explorer-${data.snapshotDate}.xlsx"`,
      "Cache-Control": "no-store"
    } });
  } catch {
    return NextResponse.json({ error: "Unable to export Shadow IT records." }, { status: 503 });
  }
}
