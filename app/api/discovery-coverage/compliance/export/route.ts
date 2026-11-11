import { documentResponse } from "@/lib/documents/server-response";
import type { WorkbookDocumentJob } from "@/lib/documents/workbooks";
import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import { buildDiscoveryComplianceRows, filterDiscoveryComplianceRows, parseDiscoveryComplianceFilters, type DiscoveryComplianceFilters } from "@/lib/discovery-compliance-explorer";
import { filterDiscoveryAssets, sanitizeDiscoverySearchParams } from "@/lib/discovery-filter-scope";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { normalizeDataDate } from "@/lib/data-date";
import { hasWorkspaceScope, scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let scope: WorkspaceSearchParams;
  let filters: DiscoveryComplianceFilters;
  try {
    const input = await request.json();
    if (!input.scope || typeof input.scope !== "object" || Array.isArray(input.scope)) throw new Error("Invalid scope.");
    const raw = input.scope as Record<string, unknown>;
    if (typeof raw.dataDate !== "string" || !normalizeDataDate(raw.dataDate)) throw new Error("Invalid date.");
    scope = { dataDate: raw.dataDate };
    for (const key of ["network", "system", "securityDomain", "environment", "assetType", "severity", "mission", "service"]) {
      const value = raw[key];
      if (value === undefined) continue;
      if (typeof value !== "string" && !Array.isArray(value)) throw new Error("Invalid scope value.");
      const values = Array.isArray(value) ? value : [value];
      if (values.length > 10000 || !values.every((item) => typeof item === "string" && item.length <= 1024)) throw new Error("Invalid scope value.");
      scope[key] = key === "network" || key === "system" ? scopeIds(value) : values[0];
    }
    scope = sanitizeDiscoverySearchParams(scope);
    if (!hasWorkspaceScope(scope)) throw new Error("Select a network or ICT system.");
    filters = parseDiscoveryComplianceFilters(input.filters);
  } catch {
    return NextResponse.json({ error: "Invalid discovery compliance export filters or scope." }, { status: 400 });
  }
  try {
    const { dataset, analytics, discoveryToolsSettings } = await getCoreAppData(scope, { profile: "summary" });
    const assetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
    const assets = filterDiscoveryAssets(dataset.assets.filter((asset) => assetIds.has(asset.id)));
    const coverage = buildScopedDiscoveryToolCoverage(assets, discoveryToolsSettings, dataset.discoveryCoverageEvaluations);
    const rows = filterDiscoveryComplianceRows(buildDiscoveryComplianceRows(assets, coverage.assetCoverageById, dataset), filters);
    return documentResponse(request, { version: 1, kind: "xlsx-compliance", title: "Discovery Compliance Explorer",
      filename: `discovery-compliance-explorer-${dataset.snapshotDate}.xlsx`, generatedAt: new Date().toISOString(),
      data: { rows, snapshotDate: dataset.snapshotDate } } satisfies WorkbookDocumentJob);
  } catch {
    return NextResponse.json({ error: "Unable to export discovery compliance records." }, { status: 503 });
  }
}
