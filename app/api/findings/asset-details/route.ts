import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import { workflowStatusAtAsOf } from "@/lib/finding-status";
import { Finding } from "@/lib/types";

export const dynamic = "force-dynamic";

interface AssetDetailsRow {
  assetId: string;
  assetName: string;
  assetIpAddress: string;
  assetType: string;
  criticalExposureFindings: number;
  highRiskFindings: number;
  totalFindings: number;
  assetChangeAssignmentGroup: string;
  assetIncidentAssignmentGroup: string;
  owner: string;
}

function toSearchParamsRecord(
  source: URLSearchParams,
  keysToExclude: Set<string>
): Record<string, string | string[] | undefined> {
  const record: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of source.entries()) {
    if (keysToExclude.has(key)) {
      continue;
    }

    const current = record[key];
    if (typeof current === "undefined") {
      record[key] = value;
      continue;
    }
    if (Array.isArray(current)) {
      current.push(value);
      record[key] = current;
      continue;
    }
    record[key] = [current, value];
  }
  return record;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isDateOnly(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

function clampDateOnly(value: string, min: string, max: string): string {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function findingMatchesSearch(finding: Finding, normalizedSearchTerm: string): boolean {
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

function readEvidenceStringValue(
  evidence: Record<string, string | number | boolean | null>,
  candidateKeys: string[]
): string | null {
  if (!candidateKeys.length) {
    return null;
  }

  const evidenceEntries = Object.entries(evidence).map(([key, value]) => [key.toLowerCase(), value] as const);
  for (const candidateKey of candidateKeys) {
    const matched = evidenceEntries.find(([key]) => key === candidateKey.toLowerCase());
    if (!matched) {
      continue;
    }
    const value = matched[1];
    if (value === null) {
      continue;
    }
    const text = String(value).trim();
    if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") {
      continue;
    }
    return text;
  }
  return null;
}

function formatAssetTypeLabel(value?: string | null): string {
  if (!value) {
    return "Unknown";
  }
  if (value === "network-device") {
    return "Network Device";
  }
  if (value === "workstation") {
    return "Workstation";
  }
  if (value === "server") {
    return "Server";
  }
  return value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildAssetRows(findings: Finding[]): AssetDetailsRow[] {
  const byAsset = new Map<string, AssetDetailsRow>();

  for (const finding of findings) {
    const assetId = finding.scope.assetId;
    const existing = byAsset.get(assetId);
    if (!existing) {
      const assetName =
        readEvidenceStringValue(finding.evidence, ["assetName", "asset_name", "hostname", "assetHostname"]) ?? assetId;
      const assetIpAddress =
        readEvidenceStringValue(finding.evidence, [
          "assetIpAddress",
          "assetIp",
          "ipAddress",
          "ip",
          "ipv4Address",
          "ipv4",
          "ip_address"
        ]) ?? "Not available";
      const assetType = formatAssetTypeLabel(readEvidenceStringValue(finding.evidence, ["assetType", "asset_type", "type"]));
      const assetChangeAssignmentGroup =
        readEvidenceStringValue(finding.evidence, [
          "assetChangeAssignmentGroup",
          "changeAssignmentGroup",
          "changeGroup",
          "change_assignment_group"
        ]) ?? "Not assigned";
      const assetIncidentAssignmentGroup =
        readEvidenceStringValue(finding.evidence, [
          "assetIncidentAssignmentGroup",
          "incidentAssignmentGroup",
          "incidentGroup",
          "incident_assignment_group"
        ]) ?? "Not assigned";
      const owner =
        readEvidenceStringValue(finding.evidence, ["assetOwner", "owner", "serviceOwner"]) ?? "Not assigned";

      byAsset.set(assetId, {
        assetId,
        assetName,
        assetIpAddress,
        assetType,
        criticalExposureFindings: 0,
        highRiskFindings: 0,
        totalFindings: 0,
        assetChangeAssignmentGroup,
        assetIncidentAssignmentGroup,
        owner
      });
    }

    const row = byAsset.get(assetId);
    if (!row) {
      continue;
    }

    row.totalFindings += 1;
    if (finding.severity === "Critical Exposure") {
      row.criticalExposureFindings += 1;
    }
    if (finding.severity === "High Risk") {
      row.highRiskFindings += 1;
    }
  }

  return Array.from(byAsset.values()).sort((a, b) => {
    if (b.totalFindings !== a.totalFindings) {
      return b.totalFindings - a.totalFindings;
    }
    return a.assetName.localeCompare(b.assetName);
  });
}

export async function GET(request: NextRequest) {
  const drillthroughSpiId = Number(request.nextUrl.searchParams.get("drillthroughSpiId"));
  const drillthroughTitle = request.nextUrl.searchParams.get("drillthroughTitle")?.trim();
  const drillthroughFindingId = request.nextUrl.searchParams.get("drillthroughFindingId")?.trim();

  if (!Number.isInteger(drillthroughSpiId) || !drillthroughTitle) {
    return NextResponse.json(
      { error: "Missing required query parameters: drillthroughSpiId, drillthroughTitle." },
      { status: 400 }
    );
  }

  const requestParams = toSearchParamsRecord(
    request.nextUrl.searchParams,
    new Set(["drillthroughSpiId", "drillthroughTitle", "drillthroughFindingId"])
  );
  const { analytics, dataset } = await getCoreAppData(requestParams);

  const today = isDateOnly(dataset.snapshotDate) ? dataset.snapshotDate : new Date().toISOString().slice(0, 10);
  const historyStartDate = new Date(`${today}T00:00:00.000Z`);
  historyStartDate.setUTCFullYear(historyStartDate.getUTCFullYear() - 2);
  const historyStart = historyStartDate.toISOString().slice(0, 10);
  const requestedAsOf = firstParam(requestParams.asOf)?.trim();
  const selectedAsOf = isDateOnly(requestedAsOf) ? clampDateOnly(requestedAsOf, historyStart, today) : today;

  const requestedTab = firstParam(requestParams.findingsTab)?.trim().toLowerCase();
  const selectedStatus: "open" | "closed" = requestedTab === "closed" ? "closed" : "open";
  const requestedSpi = Number(firstParam(requestParams.spi));
  const selectedSpi = Number.isInteger(requestedSpi) && requestedSpi >= 1 && requestedSpi <= 10 ? requestedSpi : undefined;
  const requestedPriority = Number(firstParam(requestParams.priority));
  const selectedPriority =
    Number.isInteger(requestedPriority) && requestedPriority >= 1 && requestedPriority !== 90
      ? requestedPriority
      : undefined;
  const selectedSeverity = firstParam(requestParams.severity)?.trim() || undefined;
  const selectedSearchTerm = firstParam(requestParams.search)?.trim() ?? "";
  const normalizedSearchTerm = selectedSearchTerm.toLowerCase();

  const timelineStatusByFindingId = new Map<string, "open" | "closed">();
  const timelineFindings = analytics.findings.filter((finding) => {
    const timelineStatus = workflowStatusAtAsOf(finding, selectedAsOf);
    if (!timelineStatus) {
      return false;
    }
    timelineStatusByFindingId.set(finding.id, timelineStatus);
    return true;
  });

  const filteredFindings = timelineFindings.filter((finding) => {
    if (selectedSpi && finding.spiId !== selectedSpi) {
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
    const timelineStatus = timelineStatusByFindingId.get(finding.id);
    if (!timelineStatus || timelineStatus !== selectedStatus) {
      return false;
    }
    return true;
  });

  const relatedFindings = filteredFindings.filter(
    (finding) => finding.spiId === drillthroughSpiId && finding.title === drillthroughTitle
  );

  const fallbackFinding =
    drillthroughFindingId
      ? filteredFindings.find((finding) => finding.id === drillthroughFindingId) ??
        timelineFindings.find((finding) => finding.id === drillthroughFindingId)
      : undefined;
  const scopedFindings = relatedFindings.length ? relatedFindings : fallbackFinding ? [fallbackFinding] : [];
  const rows = buildAssetRows(scopedFindings);

  return NextResponse.json({
    rows,
    linkedAssets: rows.length,
    relatedFindingsCount: scopedFindings.length
  });
}
