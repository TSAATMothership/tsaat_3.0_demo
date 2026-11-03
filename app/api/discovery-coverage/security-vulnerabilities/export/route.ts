import { parseSecurityDomainScope } from "@/lib/security-domain.mjs";
import type { ExplorerTableFilters } from "@/lib/explorer-table";
import { NextRequest, NextResponse } from "next/server";
import { loadSecurityVulnerabilityExplorerData } from "@/lib/data-loader";
import { filterVulnerabilityRows, parseVulnerabilityFilters } from "@/lib/security-vulnerability-explorer";
import { buildSecurityVulnerabilityWorkbook } from "@/lib/security-vulnerability-workbook";
import { INVENTORY_XLSX_TYPE } from "@/lib/inventory-explorer-workbook";
import { normalizeDataDate } from "@/lib/data-date";
import { scopeIds } from "@/lib/workspace-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let scope: { network: string[]; system: string[]; securityDomain?: string; dataDate: string };
  let filters: ExplorerTableFilters;
  try {
    const input = await request.json();
    const validIds = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 10000 && value.every((id) => typeof id === "string" && id.length <= 255);
    if (!validIds(input.scope?.network) || !validIds(input.scope?.system) || typeof input.scope?.dataDate !== "string" || !normalizeDataDate(input.scope.dataDate)) throw new Error("Invalid scope.");
    scope = { network: scopeIds(input.scope.network), system: scopeIds(input.scope.system), securityDomain: parseSecurityDomainScope(input.scope.securityDomain), dataDate: input.scope.dataDate };
    if ((!scope.network.length && !scope.system.length) || (scope.network.length && scope.system.length)) throw new Error("Select networks or ICT systems.");
    filters = parseVulnerabilityFilters(input.filters);
  } catch {
    return NextResponse.json({ error: "Invalid vulnerability export filters or scope." }, { status: 400 });
  }
  try {
    const data = await loadSecurityVulnerabilityExplorerData(scope);
    const workbook = buildSecurityVulnerabilityWorkbook(filterVulnerabilityRows(data.rows, filters));
    return new Response(Uint8Array.from(workbook).buffer, { headers: {
      "Content-Type": INVENTORY_XLSX_TYPE,
      "Content-Disposition": `attachment; filename="security-vulnerability-explorer-${data.snapshotDate}.xlsx"`,
      "Cache-Control": "no-store"
    } });
  } catch {
    return NextResponse.json({ error: "Unable to export security vulnerability records." }, { status: 503 });
  }
}
