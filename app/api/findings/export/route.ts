import Papa from "papaparse";
import { NextRequest, NextResponse } from "next/server";
import { buildAnalytics } from "@/lib/analytics";
import { loadCurrentDataset, loadMeasuresSettings } from "@/lib/data-loader";
import { workflowStatusAtAsOf } from "@/lib/finding-status";
import { parseFilters } from "@/lib/selectors";

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
  const [dataset, measuresSettings] = await Promise.all([loadCurrentDataset(), loadMeasuresSettings()]);
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

  const format = request.nextUrl.searchParams.get("format") ?? "json";
  const filters = parseFilters(searchParams);
  const analytics = buildAnalytics(dataset, dataset.ictSystems, filters, measuresSettings);
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
  const selectedSpi = Number.isInteger(requestedSpi) && requestedSpi >= 1 && requestedSpi <= 10 ? requestedSpi : undefined;
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
  const findings = analytics.findings
    .map((finding) => ({
      finding,
      asOfStatus: workflowStatusAtAsOf(finding, selectedAsOf)
    }))
    .filter((item) => {
      if (!item.asOfStatus) {
        return false;
      }
      const { finding, asOfStatus } = item;
    if (selectedSpi && finding.spiId !== selectedSpi) {
      return false;
    }
    if (selectedStatus && asOfStatus !== selectedStatus) {
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
  })
    .map(({ finding, asOfStatus }) => ({
      ...finding,
      status: asOfStatus
    }));

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
