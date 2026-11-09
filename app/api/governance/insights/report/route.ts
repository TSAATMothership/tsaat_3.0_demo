import { NextRequest, NextResponse } from "next/server";
import { parseSecurityDomainScope } from "@/lib/security-domain.mjs";
import { hasWorkspaceScope, scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { loadGovernanceInsights } from "@/lib/governance-insights-data";
import { documentResponse } from "@/lib/documents/server-response";
import type { InsightsDocumentJob } from "@/lib/documents/insights";

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
    const data = await loadGovernanceInsights(scope);
    return documentResponse(request, { version: 1, kind: "insights-cyber", title: "Cyber Terrain Insights",
      filename: `cyber-terrain-insights-${data.model.snapshotDate}.pdf`, generatedAt: new Date().toISOString(),
      data: { model: data.model, insights: data.insights, scopeLabels: data.scopeLabels, snapshotGeneratedAt: data.snapshotGeneratedAt,
        impact: { unattributedFindings: data.impact.unattributedFindings, missionCount: data.impact.mission.length, businessCount: data.impact.business.length } }
    } satisfies InsightsDocumentJob);
  } catch {
    return NextResponse.json({ error: "Unable to generate the Insights PDF. Please try again." }, { status: 503 });
  }
}
