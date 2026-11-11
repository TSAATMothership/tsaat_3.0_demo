import { documentResponse } from "@/lib/documents/server-response";
import type { WorkbookDocumentJob } from "@/lib/documents/workbooks";
import { parseSecurityDomainScope } from "@/lib/security-domain.mjs";
import { NextRequest, NextResponse } from "next/server";
import { loadInstalledSoftwareExplorerData } from "@/lib/data-loader";
import { filterSoftwareRows, parseSoftwareFilters, type SoftwareFilters } from "@/lib/installed-software-explorer";
import { normalizeDataDate } from "@/lib/data-date";
import { scopeIds } from "@/lib/workspace-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let scope: { network: string[]; system: string[]; securityDomain?: string; dataDate: string };
  let filters: SoftwareFilters;
  try {
    const input = await request.json();
    const validIds = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 10000 && value.every((id) => typeof id === "string" && id.length <= 255);
    if (!validIds(input.scope?.network) || !validIds(input.scope?.system) || typeof input.scope?.dataDate !== "string" || !normalizeDataDate(input.scope.dataDate)) throw new Error("Invalid scope.");
    scope = { network: scopeIds(input.scope.network), system: scopeIds(input.scope.system), securityDomain: parseSecurityDomainScope(input.scope.securityDomain), dataDate: input.scope.dataDate };
    if ((!scope.network.length && !scope.system.length) || (scope.network.length && scope.system.length)) throw new Error("Select networks or ICT systems.");
    filters = parseSoftwareFilters(input.filters);
  } catch {
    return NextResponse.json({ error: "Invalid software export filters or scope." }, { status: 400 });
  }
  try {
    const data = await loadInstalledSoftwareExplorerData(scope);
    return documentResponse(request, { version: 1, kind: "xlsx-software", title: "Installed Software Explorer",
      filename: `installed-software-explorer-${data.snapshotDate}.xlsx`, generatedAt: new Date().toISOString(),
      data: { rows: filterSoftwareRows(data.rows, filters, data.snapshotDate), snapshotDate: data.snapshotDate } } satisfies WorkbookDocumentJob);
  } catch {
    return NextResponse.json({ error: "Unable to export installed software records." }, { status: 503 });
  }
}
