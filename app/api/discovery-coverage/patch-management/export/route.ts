import { parseSecurityDomainScope } from "@/lib/security-domain.mjs";
import { NextRequest, NextResponse } from "next/server";
import type { ExplorerTableFilters } from "@/lib/explorer-table";
import { loadPatchManagementExplorerData } from "@/lib/data-loader";
import { filterPatchRows, parsePatchFilters, PATCH_VIEWS, type PatchView } from "@/lib/patch-management-explorer";
import { buildPatchManagementWorkbook } from "@/lib/patch-management-workbook";
import { INVENTORY_XLSX_TYPE } from "@/lib/inventory-explorer-workbook";
import { normalizeDataDate } from "@/lib/data-date";
import { scopeIds } from "@/lib/workspace-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  let scope: { network: string[]; system: string[]; securityDomain?: string; dataDate: string }, filters: ExplorerTableFilters, view: PatchView;
  try {
    const input = await request.json();
    const validIds = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 10000 && value.every(id => typeof id === "string" && id.length <= 255);
    if (!validIds(input.scope?.network) || !validIds(input.scope?.system) || typeof input.scope?.dataDate !== "string" || !normalizeDataDate(input.scope.dataDate)) throw new Error("Invalid scope.");
    scope = { network: scopeIds(input.scope.network), system: scopeIds(input.scope.system), securityDomain: parseSecurityDomainScope(input.scope.securityDomain), dataDate: input.scope.dataDate };
    if ((!scope.network.length && !scope.system.length) || (scope.network.length && scope.system.length)) throw new Error("Select one scope kind.");
    const selected = PATCH_VIEWS.find(view => view.id === input.view);
    if (!selected) throw new Error("Invalid patch view.");
    view = selected.id;
    filters = parsePatchFilters(input.filters);
  } catch { return NextResponse.json({ error: "Invalid patch export scope, view or filters." }, { status: 400 }); }
  try {
    const data = await loadPatchManagementExplorerData(scope);
    const workbook = buildPatchManagementWorkbook(filterPatchRows(data.rows, filters, view));
    return new Response(Uint8Array.from(workbook).buffer, { headers: { "Content-Type": INVENTORY_XLSX_TYPE,
      "Content-Disposition": `attachment; filename="patch-management-explorer-${data.snapshotDate}.xlsx"`, "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Unable to export server patch records." }, { status: 503 }); }
}
