import { ASSET_TYPES, formatAssetTypeLabel, type CanonicalAssetType } from "@/lib/asset-taxonomy";
import {
  Asset,
  AssetType,
  EnvironmentType,
  Finding,
  FindingSeverity,
  HighRiskCveDetail,
  ICTSystem,
  ManagedNetwork,
  SecurityDomain
} from "@/lib/types";

export interface CyberCopImpactAnalyserRow {
  findingId: string | null;
  systemId: string | null;
  systemName: string;
  environmentType: EnvironmentType | null;
  assetId: string;
  assetName: string;
  assetHostname: string;
  assetType: AssetType;
  assetIpAddress: string;
  networkId: string;
  networkName: string;
  hasIctSystem: boolean;
  serverId: string;
  serverName: string;
  serverHostname: string;
  securityDomain: SecurityDomain;
  severity: FindingSeverity | null;
  spiId: number | null;
  spiLabel: string;
  hasOpenFinding: boolean;
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
  environment?: string | string[] | null;
  securityDomain?: string | string[] | null;
  findingCriticality?: string | string[] | null;
  search?: string | null;
  selectedSearchAxis?: string | null;
  selectedSearchValue?: string | null;
  spiId?: number | null;
  systemIds?: string[] | null;
  assetType?: string | string[] | null;
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
  if (axisKey === "network") {
    return row.networkName;
  }
  if (axisKey === "system") {
    return row.hasIctSystem ? row.systemName : "";
  }
  if (axisKey === "environment") {
    return row.hasIctSystem ? row.environmentType ?? "Unassigned" : "";
  }
  if (axisKey === "asset") {
    return row.assetId;
  }
  if (axisKey === "server") {
    return row.serverName;
  }
  if (axisKey === "severity") {
    return row.severity ?? "";
  }
  if (axisKey === "spi") {
    return row.spiLabel;
  }
  if (axisKey === "securityDomain") {
    return row.securityDomain;
  }
  if (axisKey === "assetType") {
    return row.assetType;
  }
  return "";
}

function assetDisplayName(asset: Asset): string {
  return asset.name || asset.hostname || asset.id;
}

function rowForAssetFinding(
  asset: Asset,
  finding: Finding | null,
  systemNameById: Map<string, string>,
  options: {
    networkNameById?: Map<string, string>;
    fallbackNetworkName?: string;
    forcedSystem?: Pick<ICTSystem, "id" | "name">;
    environmentTypeByAssetId?: Map<string, EnvironmentType>;
  } = {}
): CyberCopImpactAnalyserRow {
  const candidateSystemId = options.forcedSystem?.id ?? finding?.scope.systemId ?? asset.systemContext?.systemId ?? null;
  const forcedSystemName = candidateSystemId === options.forcedSystem?.id ? options.forcedSystem.name : undefined;
  const hasIctSystem = Boolean(candidateSystemId && (forcedSystemName || systemNameById.has(candidateSystemId)));
  const systemId = hasIctSystem ? candidateSystemId : null;
  const assetName = assetDisplayName(asset);
  const assetHostname = asset.hostname || asset.name || asset.id;
  const networkId = finding?.scope.networkId ?? asset.networkId;
  const modelEnvironmentType = options.environmentTypeByAssetId?.get(asset.id) ?? null;
  return {
    findingId: finding?.id ?? null,
    systemId,
    systemName: systemId ? forcedSystemName ?? systemNameById.get(systemId) ?? "Unassigned ICT System" : "Unassigned ICT System",
    environmentType: hasIctSystem ? finding?.scope.environmentType ?? modelEnvironmentType ?? asset.systemContext?.environmentType ?? null : null,
    assetId: asset.id,
    assetName,
    assetHostname,
    assetType: asset.type,
    assetIpAddress: resolveAssetIpAddress(asset),
    networkId,
    networkName: options.networkNameById?.get(networkId) ?? options.fallbackNetworkName ?? networkId,
    hasIctSystem,
    serverId: asset.id,
    serverName: assetName,
    serverHostname: assetHostname,
    securityDomain: asset.securityDomain,
    severity: finding?.severity ?? null,
    spiId: finding?.spiId ?? null,
    spiLabel: finding ? `SPI ${finding.spiId}` : "",
    hasOpenFinding: Boolean(finding)
  };
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
    if (!systemId || !systemNameById.has(systemId)) {
      continue;
    }

    rows.push(rowForAssetFinding(asset, finding, systemNameById));
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
    const severityDiff = severityOrder.indexOf(left.severity ?? "Data Gap") - severityOrder.indexOf(right.severity ?? "Data Gap");
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return (left.spiId ?? 0) - (right.spiId ?? 0);
  });
}

export function buildNetworkImpactAnalyserRows({
  assets,
  findings,
  systems,
  modelAssetIds,
  networkName
}: {
  assets: Asset[];
  findings: Finding[];
  systems: Array<Pick<ICTSystem, "id" | "name">>;
  modelAssetIds: Iterable<string>;
  networkName?: string;
}): CyberCopImpactAnalyserRow[] {
  const modelAssetIdSet = new Set(modelAssetIds);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const systemNameById = new Map(systems.map((system) => [system.id, system.name]));
  const scopedAssets = Array.from(modelAssetIdSet)
    .map((assetId) => assetsById.get(assetId))
    .filter((asset): asset is Asset => Boolean(asset))
    .sort((left, right) => assetDisplayName(left).localeCompare(assetDisplayName(right)));
  const rowOptions = { fallbackNetworkName: networkName };
  const rows: CyberCopImpactAnalyserRow[] = scopedAssets.map((asset) =>
    rowForAssetFinding(asset, null, systemNameById, rowOptions)
  );

  for (const finding of findings) {
    if (finding.status !== "open" || !modelAssetIdSet.has(finding.scope.assetId)) {
      continue;
    }
    const asset = assetsById.get(finding.scope.assetId);
    if (!asset) {
      continue;
    }
    rows.push(rowForAssetFinding(asset, finding, systemNameById, rowOptions));
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
    const assetDiff = left.assetName.localeCompare(right.assetName);
    if (assetDiff !== 0) {
      return assetDiff;
    }
    if (left.hasOpenFinding !== right.hasOpenFinding) {
      return left.hasOpenFinding ? 1 : -1;
    }
    const severityDiff = severityOrder.indexOf(left.severity ?? "Data Gap") - severityOrder.indexOf(right.severity ?? "Data Gap");
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return (left.spiId ?? 0) - (right.spiId ?? 0);
  });
}

export function buildNetworkImpactAnalyserModelAssetIds({
  network,
  assets,
  topologyModelAssetIds
}: {
  network: Pick<ManagedNetwork, "id" | "assetIds">;
  assets: Array<Pick<Asset, "id" | "networkId">>;
  topologyModelAssetIds: Iterable<string>;
}): string[] {
  const modelAssetIds = new Set<string>();
  for (const assetId of topologyModelAssetIds) {
    modelAssetIds.add(assetId);
  }
  for (const assetId of network.assetIds) {
    modelAssetIds.add(assetId);
  }
  for (const asset of assets) {
    if (asset.networkId === network.id) {
      modelAssetIds.add(asset.id);
    }
  }
  return Array.from(modelAssetIds).sort((left, right) => left.localeCompare(right));
}

function buildSystemModelEnvironmentMap(system: Pick<ICTSystem, "environments">): Map<string, EnvironmentType> {
  const environmentTypeByAssetId = new Map<string, EnvironmentType>();
  for (const environment of system.environments) {
    for (const assetId of environment.assetIds) {
      if (!environmentTypeByAssetId.has(assetId)) {
        environmentTypeByAssetId.set(assetId, environment.type);
      }
    }
  }
  return environmentTypeByAssetId;
}

export function buildSystemImpactAnalyserModelAssetIds({
  system,
  assets,
  topologyModelAssetIds
}: {
  system: Pick<ICTSystem, "id" | "environments">;
  assets: Array<Pick<Asset, "id" | "systemContext">>;
  topologyModelAssetIds: Iterable<string>;
}): string[] {
  const modelAssetIds = new Set<string>();
  for (const assetId of topologyModelAssetIds) {
    modelAssetIds.add(assetId);
  }
  for (const environment of system.environments) {
    for (const assetId of environment.assetIds) {
      modelAssetIds.add(assetId);
    }
  }
  for (const asset of assets) {
    if (asset.systemContext?.systemId === system.id) {
      modelAssetIds.add(asset.id);
    }
  }
  return Array.from(modelAssetIds).sort((left, right) => left.localeCompare(right));
}

export function buildSystemImpactAnalyserRows({
  assets,
  findings,
  systems,
  system,
  modelAssetIds,
  networkNameById
}: {
  assets: Asset[];
  findings: Finding[];
  systems: Array<Pick<ICTSystem, "id" | "name">>;
  system: Pick<ICTSystem, "id" | "name" | "environments">;
  modelAssetIds: Iterable<string>;
  networkNameById?: Map<string, string>;
}): CyberCopImpactAnalyserRow[] {
  const modelAssetIdSet = new Set(modelAssetIds);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const systemNameById = new Map(systems.map((item) => [item.id, item.name]));
  const environmentTypeByAssetId = buildSystemModelEnvironmentMap(system);
  const scopedAssets = Array.from(modelAssetIdSet)
    .map((assetId) => assetsById.get(assetId))
    .filter((asset): asset is Asset => Boolean(asset))
    .sort((left, right) => assetDisplayName(left).localeCompare(assetDisplayName(right)));
  const rowOptions = {
    networkNameById,
    forcedSystem: { id: system.id, name: system.name },
    environmentTypeByAssetId
  };
  const rows: CyberCopImpactAnalyserRow[] = scopedAssets.map((asset) =>
    rowForAssetFinding(asset, null, systemNameById, rowOptions)
  );

  for (const finding of findings) {
    if (finding.status !== "open" || !modelAssetIdSet.has(finding.scope.assetId)) {
      continue;
    }
    const asset = assetsById.get(finding.scope.assetId);
    if (!asset) {
      continue;
    }
    rows.push(rowForAssetFinding(asset, finding, systemNameById, rowOptions));
  }

  return rows.sort((left, right) => {
    const environmentDiff = (left.environmentType ?? "Unassigned").localeCompare(right.environmentType ?? "Unassigned");
    if (environmentDiff !== 0) {
      return environmentDiff;
    }
    const assetDiff = left.assetName.localeCompare(right.assetName);
    if (assetDiff !== 0) {
      return assetDiff;
    }
    if (left.hasOpenFinding !== right.hasOpenFinding) {
      return left.hasOpenFinding ? 1 : -1;
    }
    const severityDiff = severityOrder.indexOf(left.severity ?? "Data Gap") - severityOrder.indexOf(right.severity ?? "Data Gap");
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return (left.spiId ?? 0) - (right.spiId ?? 0);
  });
}

function normalizeLocalFilterValues(value: string | string[] | null | undefined): Set<string> | null {
  const rawValues = Array.isArray(value) ? value : (value ?? "").split(",");
  const values = rawValues.map((entry) => entry.trim()).filter((entry) => entry && entry !== "all");
  return values.length ? new Set(values) : null;
}

export function filterCyberCopImpactAnalyserRows(
  rows: CyberCopImpactAnalyserRow[],
  filters: CyberCopImpactAnalyserLocalFilters
): CyberCopImpactAnalyserRow[] {
  const normalizedSearch = filters.search?.trim().toLowerCase() ?? "";
  const environmentFilter = normalizeLocalFilterValues(filters.environment);
  const domainFilter = normalizeLocalFilterValues(filters.securityDomain);
  const severityFilter = normalizeLocalFilterValues(filters.findingCriticality);
  const spiFilter = filters.spiId && Number.isInteger(filters.spiId) ? filters.spiId : null;
  const selectedSearchAxis = filters.selectedSearchAxis?.trim() || null;
  const selectedSearchValue = filters.selectedSearchValue?.trim() || null;
  const systemIdFilter = filters.systemIds
    ? new Set(filters.systemIds.map((id) => id.trim()).filter(Boolean))
    : null;
  const assetTypeFilter = normalizeLocalFilterValues(filters.assetType);

  return rows.filter((row) => {
    if (systemIdFilter && (!row.systemId || !systemIdFilter.has(row.systemId))) {
      return false;
    }
    if (assetTypeFilter && !assetTypeFilter.has(row.assetType)) {
      return false;
    }
    if (environmentFilter && !environmentFilter.has(row.environmentType ?? "Unassigned")) {
      return false;
    }
    if (domainFilter && !domainFilter.has(row.securityDomain)) {
      return false;
    }
    if (severityFilter && (!row.severity || !severityFilter.has(row.severity))) {
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
        row.networkName,
        row.systemName,
        row.environmentType ?? "Unassigned",
        row.assetName,
        row.assetHostname,
        formatAssetTypeLabel(row.assetType),
        row.serverName,
        row.serverHostname,
        row.severity ?? "",
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

export function readAssetTypeParam(value: string | null): CanonicalAssetType | null {
  if (!value || value === "all") {
    return null;
  }
  return ASSET_TYPES.includes(value as CanonicalAssetType) ? (value as CanonicalAssetType) : null;
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
