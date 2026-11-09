import { documentResponse } from "@/lib/documents/server-response";
import type { WorkbookDocumentJob } from "@/lib/documents/workbooks";
import { parseSecurityDomainScope } from "@/lib/security-domain.mjs";
import Papa from "papaparse";
import { NextRequest, NextResponse } from "next/server";
import { buildAnalytics } from "@/lib/analytics";
import {
  loadCurrentDataset,
  loadDiscoveryToolsSettings,
  loadSnapshotEffectiveFindings,
  loadMeasuresSettings,
  loadSeverityDefinitions,
  loadSpiDefinitions
} from "@/lib/data-loader";
import { parseFilters } from "@/lib/selectors";

import type { FindingsExportContext } from "@/lib/findings-export";
import { loadFindingsRegisterData } from "@/lib/findings-register-data";
import { scopeIds } from "@/lib/workspace-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isDateOnly(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

function findingMatchesSearch(
  finding: {
    id: string;
    spiId: number;
    priorityRank: number;
    severity: string;
    status: string;
    complianceStatus: string;
    timestamp: string;
    title: string;
    recommendedAction: string;
    scope: { networkId: string; systemId: string | null; environmentType: string | null; assetId: string };
    evidence: Record<string, string | number | boolean | null>;
  },
  normalizedSearchTerm: string
) {
  if (!normalizedSearchTerm) {
    return true;
  }

  const evidenceText = Object.entries(finding.evidence)
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(" ");

  const text = [
    finding.id,
    `SPI ${finding.spiId}`,
    `P${finding.priorityRank}`,
    finding.severity,
    finding.status,
    finding.complianceStatus,
    finding.timestamp,
    finding.title,
    finding.recommendedAction,
    finding.scope.networkId,
    finding.scope.systemId ?? "",
    finding.scope.environmentType ?? "",
    finding.scope.assetId,
    evidenceText
  ]
    .join(" ")
    .toLowerCase();

  return text.includes(normalizedSearchTerm);
}

export async function GET(request: NextRequest) {
  const [dataset, discoveryToolsSettings, spiDefinitions, severityDefinitions] = await Promise.all([
    loadCurrentDataset(),
    loadDiscoveryToolsSettings(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

  const format = request.nextUrl.searchParams.get("format") ?? "json";
  const filters = parseFilters(searchParams);
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, spiDefinitions, measuresSettings, discoveryToolsSettings);
  const today = isDateOnly(dataset.snapshotDate) ? dataset.snapshotDate : new Date().toISOString().slice(0, 10);
  const historyStartDate = new Date(`${today}T00:00:00.000Z`);
  historyStartDate.setUTCFullYear(historyStartDate.getUTCFullYear() - 2);
  const historyStart = historyStartDate.toISOString().slice(0, 10);
  const requestedAsOf = request.nextUrl.searchParams.get("asOf")?.trim();
  const selectedAsOf = isDateOnly(requestedAsOf)
    ? requestedAsOf < historyStart
      ? historyStart
      : requestedAsOf > today
      ? today
      : requestedAsOf
    : today;
  const requestedSpi = Number(request.nextUrl.searchParams.get("spi"));
  const selectedSpi = spiDefinitions.some((definition) => definition.spiId === requestedSpi) ? requestedSpi : undefined;
  const requestedStatus = request.nextUrl.searchParams.get("status")?.trim().toLowerCase();
  const selectedStatus = requestedStatus === "open" || requestedStatus === "closed" ? requestedStatus : undefined;
  const requestedPriority = Number(request.nextUrl.searchParams.get("priority"));
  const selectedPriority =
    Number.isInteger(requestedPriority) && requestedPriority >= 1 && requestedPriority !== 90
      ? requestedPriority
      : undefined;
  const selectedSeverity = request.nextUrl.searchParams.get("severity")?.trim() || undefined;
  const selectedSearchTerm = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const normalizedSearchTerm = selectedSearchTerm.toLowerCase();
  const filteredAssetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
  const findings = (dataset.snapshotId
    ? await loadSnapshotEffectiveFindings(dataset.snapshotId, selectedAsOf)
    : analytics.findings
  ).filter((finding) => {
    if (!filteredAssetIds.has(finding.scope.assetId)) {
      return false;
    }
    if (selectedSpi && finding.spiId !== selectedSpi) {
      return false;
    }
    if (selectedStatus && finding.status !== selectedStatus) {
      return false;
    }
    if (selectedPriority && finding.priorityRank !== selectedPriority) {
      return false;
    }
    if (selectedSeverity && finding.severity !== selectedSeverity) {
      return false;
    }
    if (!findingMatchesSearch(finding, normalizedSearchTerm)) {
      return false;
    }
    return true;
  });

  if (format === "csv") {
    const rows = findings.map((finding) => ({
      id: finding.id,
      priorityRank: finding.priorityRank,
      spiId: finding.spiId,
      severity: finding.severity,
      status: finding.status,
      complianceStatus: finding.complianceStatus,
      timestamp: finding.timestamp,
      networkId: finding.scope.networkId,
      systemId: finding.scope.systemId ?? "",
      environment: finding.scope.environmentType ?? "",
      assetId: finding.scope.assetId,
      title: finding.title,
      evidence: JSON.stringify(finding.evidence),
      recommendedAction: finding.recommendedAction
    }));

    const csv = Papa.unparse(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=dct-findings.csv"
      }
    });
  }

  return NextResponse.json({ findings, generatedAt: new Date().toISOString() });
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validIds(value: unknown, limit: number): value is string[] {
  return Array.isArray(value) && value.length <= limit && value.every((id) =>
    typeof id === "string" && id.trim().length > 0 && id.length <= 255);
}

export async function POST(request: NextRequest) {
  let context: FindingsExportContext;
  let findingIds: string[];
  try {
    const input = await request.json();
    if (!validIds(input.scope?.network, 10000) || !validIds(input.scope?.system, 10000)
      || !validDate(input.scope?.dataDate) || !validDate(input.asOf)
      || (input.status !== "open" && input.status !== "closed")
      || !validIds(input.findingIds, 1048575) || !input.findingIds.length) throw new Error("Invalid export.");
    const scope = { network: scopeIds(input.scope.network), system: scopeIds(input.scope.system), securityDomain: parseSecurityDomainScope(input.scope.securityDomain), dataDate: input.scope.dataDate };
    if ((!scope.network.length && !scope.system.length) || (scope.network.length && scope.system.length)) throw new Error("Invalid scope.");
    context = { scope, asOf: input.asOf, status: input.status };
    findingIds = [...new Set(input.findingIds as string[])];
  } catch {
    return NextResponse.json({ error: "Invalid findings export selection or scope." }, { status: 400 });
  }
  try {
    const data = await loadFindingsRegisterData({ ...context.scope, asOf: context.asOf, findingsTab: context.status });
    const byId = new Map(data.findings.map((finding) => [finding.id, finding]));
    // Only export canonical findings in the displayed scope/status/date, in the user's filtered sort order.
    if (data.exportContext.scope.dataDate !== context.scope.dataDate || data.selectedAsOf !== context.asOf
      || findingIds.some((id) => !byId.has(id))) {
      return NextResponse.json({ error: "Findings have changed. Refresh the register and try again." }, { status: 409 });
    }
    return documentResponse(request, { version: 1, kind: "xlsx-findings", title: "Findings and affected CIs",
      filename: `dct-findings-${context.asOf}.xlsx`, generatedAt: new Date().toISOString(),
      data: { findings: findingIds.map(id => byId.get(id)!), asOf: context.asOf,
        assetDetailsByAssetId: data.assetDetailsByAssetId, configuration: data.findingDisplayConfiguration } } satisfies WorkbookDocumentJob);
  } catch {
    return NextResponse.json({ error: "Unable to export findings and affected CIs." }, { status: 503 });
  }
}
