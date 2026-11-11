import { documentResponse } from "@/lib/documents/server-response";
import type { WorkbookDocumentJob } from "@/lib/documents/workbooks";
import { parseSecurityDomainScope } from "@/lib/security-domain.mjs";
import { NextRequest, NextResponse } from "next/server";
import { loadEndpointExplorerData } from "@/lib/data-loader";
import { filterEndpointRows, parseEndpointFilters, type EndpointFilters } from "@/lib/endpoint-explorer";
import { normalizeDataDate } from "@/lib/data-date";
import { scopeIds } from "@/lib/workspace-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let scope: { network: string[]; system: string[]; securityDomain?: string; dataDate: string };
  let filters: EndpointFilters;
  try {
    const input = await request.json();
    const validIds = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 10000 && value.every((id) => typeof id === "string" && id.length <= 255);
    if (!validIds(input.scope?.network) || !validIds(input.scope?.system) || typeof input.scope?.dataDate !== "string" || !normalizeDataDate(input.scope.dataDate)) throw new Error("Invalid scope.");
    scope = { network: scopeIds(input.scope.network), system: scopeIds(input.scope.system), securityDomain: parseSecurityDomainScope(input.scope.securityDomain), dataDate: input.scope.dataDate };
    if ((!scope.network.length && !scope.system.length) || (scope.network.length && scope.system.length)) throw new Error("Select networks or ICT systems.");
    filters = parseEndpointFilters(input.filters);
  } catch {
    return NextResponse.json({ error: "Invalid endpoint export filters or scope." }, { status: 400 });
  }
  try {
    const data = await loadEndpointExplorerData(scope);
    const matching = filterEndpointRows(data.rows, filters, data.snapshotDate);
    return documentResponse(request, { version: 1, kind: "xlsx-endpoints", title: "End Point Explorer",
      filename: `end-point-explorer-${data.snapshotDate}.xlsx`, generatedAt: new Date().toISOString(),
      data: { rows: matching, snapshotDate: data.snapshotDate } } satisfies WorkbookDocumentJob);
  } catch {
    return NextResponse.json({ error: "Unable to export endpoint records." }, { status: 503 });
  }
}
