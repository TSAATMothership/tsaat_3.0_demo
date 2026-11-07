import { NextRequest, NextResponse } from "next/server";
import { parseSecurityDomainScope } from "@/lib/security-domain.mjs";
import { hasWorkspaceScope, scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { loadSoftwareInsightsReport } from "@/lib/software-insights-report-data";
import { createSoftwareInsightsPdf } from "@/lib/software-insights-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  let scope: WorkspaceSearchParams;
  try {
    const query = request.nextUrl.searchParams, dates = query.getAll("dataDate");
    if (dates.length > 1 || (dates.length && (!/^\d{4}-\d{2}-\d{2}$/.test(dates[0]) || new Date(dates[0] + "T00:00:00Z").toISOString().slice(0, 10) !== dates[0]))) throw new Error("Invalid date");
    const ids = (key: string) => {
      const values = scopeIds(query.getAll(key));
      if (values.length > 10000 || values.some(value => value.length > 255)) throw new Error("Invalid scope");
      return values;
    };
    scope = { network: ids("network"), system: ids("system"), dataDate: dates[0],
      securityDomain: parseSecurityDomainScope(query.has("securityDomain") ? query.getAll("securityDomain") : undefined) };
    if (!hasWorkspaceScope(scope)) throw new Error("Missing scope");
  } catch {
    return NextResponse.json({ error: "Select a valid network or ICT system, security domains and snapshot date." }, { status: 400 });
  }
  try {
    const data = await loadSoftwareInsightsReport(scope), bytes = await createSoftwareInsightsPdf(data);
    return new Response(Uint8Array.from(bytes).buffer, { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="software-insights-${data.model.snapshotDate}.pdf"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"
    } });
  } catch {
    return NextResponse.json({ error: "Unable to generate the Software Insights PDF. Please try again." }, { status: 503 });
  }
}
