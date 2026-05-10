import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import {
  Asset,
  EnvironmentType,
  Finding,
  FindingSeverity,
  HighRiskCveDetail,
  ICTSystem,
  ManagedNetwork,
  SecurityDomain
} from "@/lib/types";

export interface CyberCopImpactAnalyserRow {
  findingId: string;
  systemId: string;
  systemName: string;
  environmentType: EnvironmentType | null;
  serverId: string;
  serverName: string;
  serverHostname: string;
  securityDomain: SecurityDomain;
  severity: FindingSeverity;
  spiId: number;
  spiLabel: string;
}

export interface CyberCopImpactAnalyserFindingRow {
  id: string;
  sourceFindingId?: string | null;
  assetId: string;
  assetName: string;
  assetType: string;
  assetIpAddress: string;
  assetChangeAssignmentGroup: string;
  assetIncidentAssignmentGroup: string;
  owner: string;
  spiId: number;
  timestamp: string;
  closedTimestamp: string | null;
  timestampLabel: string;
  title: string;
  priorityRank: number;
  severity: FindingSeverity;
  workflowStatus: "open" | "closed";
  scopeLabel: string;
  systemId?: string | null;
  networkId?: string | null;
  environmentType?: string | null;
  evidencePreview: string;
  recommendedAction: string;
}

export interface CyberCopImpactAnalyserLocalFilters {
  environment?: string | null;
  securityDomain?: string | null;
  findingCriticality?: string | null;
  search?: string | null;
  selectedSearchAxis?: string | null;
  selectedSearchValue?: string | null;
  spiId?: number | null;
  systemIds?: string[] | null;
}

const severityOrder: FindingSeverity[] = ["Critical Exposure", "High Risk", "Major", "Moderate", "Data Gap"];

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }) + " UTC";
}

function toEvidenceString(value: string | number | boolean | null): string {
  if (value === null) {
    return "null";
  }
  return String(value);
}

function readEvidenceStringValue(
  evidence: Record<string, string | number | boolean | null>,
  keys: string[]
): string | undefined {
  const evidenceEntries = Object.entries(evidence).map(([key, value]) => [key.toLowerCase(), value] as const);
  for (const candidateKey of keys) {
    const matched = evidenceEntries.find(([key]) => key === candidateKey.toLowerCase());
    if (!matched || matched[1] === null) {
      continue;
    }
    const text = String(matched[1]).trim();
    if (text && text.toLowerCase() !== "null" && text.toLowerCase() !== "undefined") {
      return text;
    }
  }
  return undefined;
}

function resolveAssetIpAddress(asset: Asset): string {
  const candidate = asset as Asset & {
    ipAddress?: string | null;
    ip?: string | null;
    ipv4?: string | null;
    ipv4Address?: string | null;
    primaryIp?: string | null;
  };
  const value =
    candidate.ipAddress ?? candidate.ip ?? candidate.ipv4 ?? candidate.ipv4Address ?? candidate.primaryIp ?? null;
  if (!value || !String(value).trim()) {
    return "N/A";
  }
  return String(value).trim();
}

function impactAnalyserRowAxisValue(row: CyberCopImpactAnalyserRow, axisKey: string): string {
  if (axisKey === "system") {
    return row.systemName;
  }
  if (axisKey === "environment") {
    return row.environmentType ?? "Unassigned";
  }
  if (axisKey === "server") {
    return row.serverName;
  }
  if (axisKey === "severity") {
    return row.severity;
  }
  if (axisKey === "spi") {
    return row.spiLabel;
  }
  if (axisKey === "securityDomain") {
    return row.securityDomain;
  }
  return "";
}

export function buildCyberCopImpactAnalyserRows(
  assets: Asset[],
  findings: Finding[],
  systems: Array<Pick<ICTSystem, "id" | "name">>
): CyberCopImpactAnalyserRow[] {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const systemNameById = new Map(systems.map((system) => [system.id, system.name]));
  const rows: CyberCopImpactAnalyserRow[] = [];

  for (const finding of findings) {
    if (finding.status !== "open") {
      continue;
    }

    const asset = assetsById.get(finding.scope.assetId);
    if (!asset || asset.type !== "server") {
      continue;
    }

    const systemId = finding.scope.systemId ?? asset.systemContext?.systemId ?? null;
    if (!systemId) {
      continue;
    }

    rows.push({
      findingId: finding.id,
      systemId,
      systemName: systemNameById.get(systemId) ?? "Unassigned ICT System",
      environmentType: finding.scope.environmentType ?? asset.systemContext?.environmentType ?? null,
      serverId: asset.id,
      serverName: asset.name || asset.hostname || asset.id,
      serverHostname: asset.hostname || asset.name || asset.id,
      securityDomain: asset.securityDomain,
      severity: finding.severity,
      spiId: finding.spiId,
      spiLabel: `SPI ${finding.spiId}`
    });
  }

  return rows.sort((left, right) => {
    const systemDiff = left.systemName.localeCompare(right.systemName);
    if (systemDiff !== 0) {
      return systemDiff;
    }
    const environmentDiff = (left.environmentType ?? "Unassigned").localeCompare(right.environmentType ?? "Unassigned");
    if (environmentDiff !== 0) {
      return environmentDiff;
    }
    const serverDiff = left.serverName.localeCompare(right.serverName);
    if (serverDiff !== 0) {
      return serverDiff;
    }
    const severityDiff = severityOrder.indexOf(left.severity) - severityOrder.indexOf(right.severity);
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return left.spiId - right.spiId;
  });
}

export function filterCyberCopImpactAnalyserRows(
  rows: CyberCopImpactAnalyserRow[],
  filters: CyberCopImpactAnalyserLocalFilters
): CyberCopImpactAnalyserRow[] {
  const normalizedSearch = filters.search?.trim().toLowerCase() ?? "";
  const environmentFilter = filters.environment && filters.environment !== "all" ? filters.environment : null;
  const domainFilter = filters.securityDomain && filters.securityDomain !== "all" ? filters.securityDomain : null;
  const severityFilter =
    filters.findingCriticality && filters.findingCriticality !== "all" ? filters.findingCriticality : null;
  const spiFilter = filters.spiId && Number.isInteger(filters.spiId) ? filters.spiId : null;
  const selectedSearchAxis = filters.selectedSearchAxis?.trim() || null;
  const selectedSearchValue = filters.selectedSearchValue?.trim() || null;
  const systemIdFilter = filters.systemIds
    ? new Set(filters.systemIds.map((id) => id.trim()).filter(Boolean))
    : null;

  return rows.filter((row) => {
    if (systemIdFilter && !systemIdFilter.has(row.systemId)) {
      return false;
    }
    if (environmentFilter && (row.environmentType ?? "Unassigned") !== environmentFilter) {
      return false;
    }
    if (domainFilter && row.securityDomain !== domainFilter) {
      return false;
    }
    if (severityFilter && row.severity !== severityFilter) {
      return false;
    }
    if (spiFilter && row.spiId !== spiFilter) {
      return false;
    }
    if (selectedSearchAxis && selectedSearchValue) {
      return impactAnalyserRowAxisValue(row, selectedSearchAxis) === selectedSearchValue;
    }
    if (normalizedSearch) {
      const haystack = [
        row.systemName,
        row.environmentType ?? "Unassigned",
        row.serverName,
        row.serverHostname,
        row.severity,
        row.spiLabel,
        row.securityDomain
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(normalizedSearch)) {
        return false;
      }
    }
    return true;
  });
}

export function buildCyberCopImpactAnalyserFindingRows({
  findings,
  scopedAssets,
  allAssets,
  systems,
  networks
}: {
  findings: Finding[];
  scopedAssets: Asset[];
  allAssets: Asset[];
  systems: ICTSystem[];
  networks: ManagedNetwork[];
}): CyberCopImpactAnalyserFindingRow[] {
  const scopedAssetsById = new Map(scopedAssets.map((asset) => [asset.id, asset]));
  const allAssetsById = new Map(allAssets.map((asset) => [asset.id, asset]));
  const systemOwnerById = new Map(systems.map((system) => [system.id, system.owner?.trim() ?? ""]));
  const networkOwnerById = new Map(networks.map((network) => [network.id, network.owner?.trim() ?? ""]));

  return findings
    .map((finding) => {
      const asset = scopedAssetsById.get(finding.scope.assetId) ?? allAssetsById.get(finding.scope.assetId);
      const evidencePreview =
        Object.entries(finding.evidence)
          .slice(0, 2)
          .map(([key, value]) => `${key}: ${toEvidenceString(value)}`)
          .join(" | ") || "No evidence captured";
      const networkId = finding.scope.networkId ?? asset?.networkId ?? null;
      const systemId = finding.scope.systemId ?? asset?.systemContext?.systemId ?? null;
      const environmentType = finding.scope.environmentType ?? asset?.systemContext?.environmentType ?? null;
      const scopeLabel = [
        `Asset ${finding.scope.assetId}`,
        networkId ? `Network ${networkId}` : "Network n/a",
        systemId ? `System ${systemId}` : "System n/a",
        environmentType ? `Env ${environmentType}` : "Env n/a"
      ].join(" | ");
      const assetName =
        readEvidenceStringValue(finding.evidence, ["assetName", "asset_name"]) ??
        asset?.name ??
        asset?.hostname ??
        finding.scope.assetId;
      const assetType = formatAssetTypeLabel(
        readEvidenceStringValue(finding.evidence, ["assetType", "asset_type"]) ?? asset?.type ?? null
      );
      const assetIpAddress =
        readEvidenceStringValue(finding.evidence, [
          "assetIpAddress",
          "assetIp",
          "ipAddress",
          "ip",
          "ipv4Address",
          "ipv4",
          "ip_address"
        ]) ?? (asset ? resolveAssetIpAddress(asset) : "N/A");
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
        readEvidenceStringValue(finding.evidence, ["assetOwner", "owner", "serviceOwner"]) ??
        (systemId
          ? systemOwnerById.get(systemId)?.trim() || networkOwnerById.get(networkId ?? "")?.trim() || "Not assigned"
          : networkOwnerById.get(networkId ?? "")?.trim() || "Not assigned");

      return {
        id: `risk-${finding.id}`,
        sourceFindingId: finding.id,
        assetId: finding.scope.assetId,
        assetName,
        assetType,
        assetIpAddress,
        assetChangeAssignmentGroup,
        assetIncidentAssignmentGroup,
        owner,
        spiId: finding.spiId,
        timestamp: finding.timestamp,
        closedTimestamp: finding.closedTimestamp ?? null,
        timestampLabel: formatTimestamp(finding.timestamp),
        title: finding.title,
        priorityRank: finding.priorityRank,
        severity: finding.severity,
        workflowStatus: finding.status,
        scopeLabel,
        systemId,
        networkId,
        environmentType,
        evidencePreview,
        recommendedAction: finding.recommendedAction
      };
    })
    .sort((a, b) => {
      if (a.priorityRank !== b.priorityRank) {
        return a.priorityRank - b.priorityRank;
      }
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return bTime - aTime;
    });
}

export function pickHighRiskCvesByAssetId(
  highRiskCvesByAssetId: Record<string, HighRiskCveDetail[]>,
  assetIds: Iterable<string>
): Record<string, HighRiskCveDetail[]> {
  const result: Record<string, HighRiskCveDetail[]> = {};
  for (const assetId of assetIds) {
    const cves = highRiskCvesByAssetId[assetId];
    if (cves?.length) {
      result[assetId] = cves;
    }
  }
  return result;
}
