import { NextRequest, NextResponse } from "next/server";
import { getCoreAppData } from "@/lib/app-data";
import { loadSnapshotEffectiveFindings } from "@/lib/data-loader";
import {
  FindingDisplayConfiguration,
  findingBucketsOfType,
  findingMatchesBucket,
  readConfiguredEvidenceValue
} from "@/lib/findings-config";
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

function buildAssetRows(findings: Finding[], findingDisplayConfiguration: FindingDisplayConfiguration): AssetDetailsRow[] {
  const byAsset = new Map<string, AssetDetailsRow>();
  const severityBuckets = findingBucketsOfType(findingDisplayConfiguration, "severity");
  const primarySeverityBucket = severityBuckets.find((bucket) => bucket.conditionKey === "severity_equals");
  const secondarySeverityBucket = severityBuckets.filter((bucket) => bucket.conditionKey === "severity_equals")[1];

  for (const finding of findings) {
    const assetId = finding.scope.assetId;
    const existing = byAsset.get(assetId);
    if (!existing) {
      const assetName = readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "asset_name", assetId) ?? assetId;
      const assetIpAddress =
        readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "asset_ip_address", "Not available") ??
        "Not available";
      const assetType = formatAssetTypeLabel(readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "asset_type"));
      const assetChangeAssignmentGroup =
        readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "change_assignment_group", "Not assigned") ??
        "Not assigned";
      const assetIncidentAssignmentGroup =
        readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "incident_assignment_group", "Not assigned") ??
        "Not assigned";
      const owner = readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "owner", "Not assigned") ?? "Not assigned";

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
    if (primarySeverityBucket && findingMatchesBucket(finding, primarySeverityBucket)) {
      row.criticalExposureFindings += 1;
    }
    if (secondarySeverityBucket && findingMatchesBucket(finding, secondarySeverityBucket)) {
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
  const { analytics, dataset, spiDefinitions, findingDisplayConfiguration } = await getCoreAppData(requestParams);

  const today = isDateOnly(dataset.snapshotDate) ? dataset.snapshotDate : new Date().toISOString().slice(0, 10);
  const historyStartDate = new Date(`${today}T00:00:00.000Z`);
  historyStartDate.setUTCFullYear(historyStartDate.getUTCFullYear() - 2);
  const historyStart = historyStartDate.toISOString().slice(0, 10);
  const requestedAsOf = firstParam(requestParams.asOf)?.trim();
  const selectedAsOf = isDateOnly(requestedAsOf) ? clampDateOnly(requestedAsOf, historyStart, today) : today;

  const requestedTab = firstParam(requestParams.findingsTab)?.trim().toLowerCase();
  const selectedStatus: "open" | "closed" = requestedTab === "closed" ? "closed" : "open";
  const requestedSpi = Number(firstParam(requestParams.spi));
  const selectedSpi =
    Number.isInteger(requestedSpi) && spiDefinitions.some((definition) => definition.spiId === requestedSpi)
      ? requestedSpi
      : undefined;
  const requestedPriority = Number(firstParam(requestParams.priority));
  const selectedPriority =
    Number.isInteger(requestedPriority) && requestedPriority >= 1 && requestedPriority !== 90
      ? requestedPriority
      : undefined;
  const selectedSeverity = firstParam(requestParams.severity)?.trim() || undefined;
  const selectedSearchTerm = firstParam(requestParams.search)?.trim() ?? "";
  const normalizedSearchTerm = selectedSearchTerm.toLowerCase();

  const filteredAssetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
  const timelineFindings = (dataset.snapshotId
    ? await loadSnapshotEffectiveFindings(dataset.snapshotId, selectedAsOf)
    : analytics.findings
  ).filter((finding) => filteredAssetIds.has(finding.scope.assetId));

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
    if (finding.status !== selectedStatus) {
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
  const rows = buildAssetRows(scopedFindings, findingDisplayConfiguration);

  return NextResponse.json({
    rows,
    linkedAssets: rows.length,
    relatedFindingsCount: scopedFindings.length
  });
}
