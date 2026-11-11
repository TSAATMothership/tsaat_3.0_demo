import { NextRequest, NextResponse } from "next/server";
import { normalizeDataDate } from "@/lib/data-date";
import { parseSecurityDomainScope } from "@/lib/security-domain.mjs";
import { hasWorkspaceScope, scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { loadInventoryContext } from "@/lib/inventory-context-data";
import { loadEndpointExplorerData, loadSecurityVulnerabilityExplorerData } from "@/lib/data-loader";
import { documentResponse } from "@/lib/documents/server-response";
import type { InsightsDocumentJob } from "@/lib/documents/insights";
import { INVENTORY_INSIGHT_REPORTS, type InventoryInsightReport } from "@/lib/inventory-insights-report-links";

export async function inventoryInsightsReport(request: NextRequest, kind: InventoryInsightReport) {
  let scope: WorkspaceSearchParams;
  try {
    const query = request.nextUrl.searchParams, dates = query.getAll("dataDate");
    if (dates.length > 1 || (dates.length && (!normalizeDataDate(dates[0]) || new Date(`${dates[0]}T00:00:00Z`).toISOString().slice(0, 10) !== dates[0]))) throw Error("Invalid date");
    const readIds = (key: string) => {
      const ids = scopeIds(query.getAll(key));
      if (ids.length > 10000 || ids.some(id => id.length > 255)) throw Error("Invalid scope");
      return ids;
    };
    scope = { network: readIds("network"), system: readIds("system"), dataDate: dates[0],
      securityDomain: parseSecurityDomainScope(query.has("securityDomain") ? query.getAll("securityDomain") : undefined) };
    if (!hasWorkspaceScope(scope)) throw Error("Missing scope");
  } catch {
    return NextResponse.json({ error: "Select a valid network or ICT system scope, security domains and snapshot date." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const report = INVENTORY_INSIGHT_REPORTS[kind];
  try {
    const data = await loadInventoryContext(scope);
    const common = { version: 1 as const, title: report.title, filename: `${report.slug}-${data.model.snapshotDate}.pdf`, generatedAt: new Date().toISOString() };
    const job: InsightsDocumentJob = kind === "endpoints"
      ? { ...common, kind: "insights-endpoint", data: { model: data.model, scopeLabels: data.scopeLabels, rows: (await loadEndpointExplorerData(data.scope)).rows } }
      : { ...common, kind: "insights-vulnerability", data: { model: data.model, scopeLabels: data.scopeLabels, rows: (await loadSecurityVulnerabilityExplorerData(data.scope)).rows } };
    return documentResponse(request, job);
  } catch {
    return NextResponse.json({ error: `Unable to generate the ${report.title} report. Please retry.` }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
