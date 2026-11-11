import { documentResponse } from "@/lib/documents/server-response";
import type { WorkbookDocumentJob } from "@/lib/documents/workbooks";
import { parseSecurityDomainScope } from "@/lib/security-domain.mjs";
import { NextRequest, NextResponse } from "next/server";
import type { ExplorerTableFilters } from "@/lib/explorer-table";
import { loadPatchManagementExplorerData } from "@/lib/data-loader";
import { filterPatchRows, parsePatchFilters, PATCH_VIEWS, type PatchView } from "@/lib/patch-management-explorer";
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
    return documentResponse(request, { version: 1, kind: "xlsx-patches", title: "Patch Management Explorer",
      filename: `patch-management-explorer-${data.snapshotDate}.xlsx`, generatedAt: new Date().toISOString(),
      data: { rows: filterPatchRows(data.rows, filters, view), snapshotDate: data.snapshotDate } } satisfies WorkbookDocumentJob);
  } catch { return NextResponse.json({ error: "Unable to export server patch records." }, { status: 503 }); }
}
