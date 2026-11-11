import { documentResponse } from "@/lib/documents/server-response";
import type { WorkbookDocumentJob } from "@/lib/documents/workbooks";
import { parseSecurityDomainScope } from "@/lib/security-domain.mjs";
import { NextRequest, NextResponse } from "next/server";
import { loadShadowItExplorerData } from "@/lib/data-loader";
import { filterShadowRows, parseShadowFilters, type ShadowFilters } from "@/lib/shadow-it-explorer";
import { normalizeDataDate } from "@/lib/data-date";
import { scopeIds } from "@/lib/workspace-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let scope: { network: string[]; system: string[]; securityDomain?: string; dataDate: string };
  let filters: ShadowFilters;
  try {
    const input = await request.json();
    const validIds = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 10000 && value.every((id) => typeof id === "string" && id.length <= 255);
    if (!validIds(input.scope?.network) || !validIds(input.scope?.system) || typeof input.scope?.dataDate !== "string" || !normalizeDataDate(input.scope.dataDate)) throw new Error("Invalid scope.");
    scope = { network: scopeIds(input.scope.network), system: scopeIds(input.scope.system), securityDomain: parseSecurityDomainScope(input.scope.securityDomain), dataDate: input.scope.dataDate };
    if ((!scope.network.length && !scope.system.length) || (scope.network.length && scope.system.length)) throw new Error("Select networks or ICT systems.");
    filters = parseShadowFilters(input.filters);
  } catch {
    return NextResponse.json({ error: "Invalid Shadow IT export filters or scope." }, { status: 400 });
  }
  try {
    const data = await loadShadowItExplorerData(scope);
    return documentResponse(request, { version: 1, kind: "xlsx-shadow-it", title: "Shadow IT Explorer",
      filename: `shadow-it-explorer-${data.snapshotDate}.xlsx`, generatedAt: new Date().toISOString(),
      data: { rows: filterShadowRows(data.rows, filters, data.snapshotDate), snapshotDate: data.snapshotDate } } satisfies WorkbookDocumentJob);
  } catch {
    return NextResponse.json({ error: "Unable to export Shadow IT records." }, { status: 503 });
  }
}
