import Link from "next/link";
import { notFound } from "next/navigation";
import { MiniTrendSparkline } from "@/components/mini-trend-sparkline";
import { NetworkComplianceOverview } from "@/components/network-compliance-overview";
import { NetworkDetailRiskCharts } from "@/components/network-detail-risk-charts";
import { PostureBadge } from "@/components/posture-badge";
import { ServerStreamHint } from "@/components/server-stream-hint";
import { SystemDetailTabId, SystemDetailTabs } from "@/components/system-detail-tabs";
import { buildAnalytics } from "@/lib/analytics";
import { PRIORITY_ORDER, SPI_DESCRIPTIONS } from "@/lib/constants";
import { SPI_IDS } from "@/lib/spi-metadata";
import {
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadLatestSnapshotsForDate,
  loadMeasuresSettings
} from "@/lib/data-loader";
import { DiscoveryCoverageValue, evaluateDiscoveryCoverage } from "@/lib/discovery-coverage";
import { extractDataDateParam, withDataDate } from "@/lib/data-date";
import { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { buildLocationKeyFromParamsRecord, encodeLocationKeyForAttribute } from "@/lib/location-key";
import { MeasuresSettings } from "@/lib/measures-settings";
import { paginate, parsePageState } from "@/lib/pagination";
import { Asset, ComplianceStatus, Dataset, EnvironmentType, Finding, FindingSeverity } from "@/lib/types";
import { Suspense } from "react";

type KpiFilterKey =
  | "nonCompliantServers"
  | "nonCompliantOs"
  | "nonCompliantEnvironments"
  | "p12Findings"
  | "highRiskP12Findings"
  | "outOfWarrantyAssets"
  | "nonCompliantDiscoveryCoverage";

const KPI_FILTER_LABELS: Record<KpiFilterKey, string> = {
  nonCompliantServers: "Total Non-compliant Servers",
  nonCompliantOs: "Total Non-compliant OS",
  nonCompliantEnvironments: "Total Non-compliant Environments",
  p12Findings: "Total P1-P2 Findings",
  highRiskP12Findings: "Total P1-P2 High Risk Findings",
  outOfWarrantyAssets: "Total Physical Assets Out of Warranty",
  nonCompliantDiscoveryCoverage: "Assets non-compliant with discovery coverage"
};

function isKpiFilterKey(value: string | undefined): value is KpiFilterKey {
  if (!value) {
    return false;
  }
  return value in KPI_FILTER_LABELS;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseUtcDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatUtcDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function isExternalLink(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function findingMatchesSearch(finding: Finding, normalizedSearchTerm: string) {
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

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return `${parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  })} UTC`;
}

function toEvidenceString(value: string | number | boolean | null): string {
  if (value === null) {
    return "null";
  }
  return String(value);
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

function fallbackFindingSeverity(status: ComplianceStatus, spiId: number): FindingSeverity {
  if (status === "Unknown") {
    return "Data Gap";
  }
  if (spiId === 4 || spiId === 5 || spiId === 6) {
    return "High Risk";
  }
  if (spiId === 1 || spiId === 3 || spiId === 7 || spiId === 8) {
    return "Major";
  }
  return "Moderate";
}

function fallbackPriorityRank(status: ComplianceStatus, spiId: number): number {
  if (status === "Unknown") {
    return 90;
  }
  const mapped = PRIORITY_ORDER[spiId as keyof typeof PRIORITY_ORDER];
  return mapped ?? 99;
}

function toFindingDateKey(timestamp?: string | null): string | null {
  if (!timestamp) {
    return null;
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return toUtcDateKey(parsed);
}

function buildSystemDetailWeeklyRiskTrend(
  findings: Finding[],
  endDateKey: string,
  dataAvailableUntilDateKey: string,
  weeks = 13
) {
  const endDate = parseUtcDateKey(endDateKey);
  const effectiveDataEndDateKey =
    dataAvailableUntilDateKey <= endDateKey ? dataAvailableUntilDateKey : endDateKey;
  const earliestSevereOpenedDateKey = findings
    .filter((finding) => finding.severity === "High Risk" || finding.severity === "Critical Exposure")
    .map((finding) => toFindingDateKey(finding.timestamp))
    .filter((dateKey): dateKey is string => Boolean(dateKey))
    .sort()[0];

  return Array.from({ length: weeks }, (_, index) => {
    const weekOffset = weeks - 1 - index;
    const pointDate = addUtcDays(endDate, -weekOffset * 7);
    const pointDateKey = toUtcDateKey(pointDate);

    if (
      pointDateKey > effectiveDataEndDateKey ||
      (earliestSevereOpenedDateKey && pointDateKey < earliestSevereOpenedDateKey) ||
      !earliestSevereOpenedDateKey
    ) {
      return {
        weekLabel: formatUtcDay(pointDate),
        highRiskCount: null,
        criticalExposureCount: null
      };
    }

    let highRiskCount = 0;
    let criticalExposureCount = 0;

    for (const finding of findings) {
      if (finding.severity !== "High Risk" && finding.severity !== "Critical Exposure") {
        continue;
      }

      const openedDateKey = toFindingDateKey(finding.timestamp);
      if (!openedDateKey || openedDateKey > pointDateKey) {
        continue;
      }

      const closedDateKey = toFindingDateKey(finding.closedTimestamp);
      if (closedDateKey && closedDateKey <= pointDateKey) {
        continue;
      }

      if (finding.severity === "High Risk") {
        highRiskCount += 1;
      } else {
        criticalExposureCount += 1;
      }
    }

    return {
      weekLabel: formatUtcDay(pointDate),
      highRiskCount,
      criticalExposureCount
    };
  });
}

function complianceScore(statuses: ComplianceStatus[]): number {
  if (!statuses.length) {
    return 0;
  }
  const compliant = statuses.filter((status) => status === "Compliant").length;
  return Number(((compliant / statuses.length) * 100).toFixed(1));
}

function overallStatusFromStatuses(statuses: ComplianceStatus[]): ComplianceStatus {
  if (!statuses.length) {
    return "Unknown";
  }
  if (statuses.some((status) => status === "Non-compliant")) {
    return "Non-compliant";
  }
  if (statuses.some((status) => status === "Unknown")) {
    return "Unknown";
  }
  return "Compliant";
}

function patchLevelLabel(nMinus: number | null): string {
  if (nMinus === null) {
    return "Unknown";
  }
  if (nMinus <= 0) {
    return "N";
  }
  if (nMinus === 1) {
    return "N-1";
  }
  if (nMinus === 2) {
    return "N-2";
  }
  return `N-${nMinus}`;
}

function n2PlusStatusLabel(nMinus: number | null): string {
  if (nMinus === null) {
    return "Unknown";
  }
  return nMinus <= 2 ? "Within N-2+" : "Outside N-2+";
}

function coverageFlag(value: DiscoveryCoverageValue | undefined): number {
  return value === 0 ? 0 : 1;
}

function discoveryCoverageForAsset(asset: Asset, discoveryToolsSettings: DiscoveryToolsSettings) {
  const coverage = evaluateDiscoveryCoverage(asset, discoveryToolsSettings);
  const ucmdb = coverageFlag(coverage.toolValues.ucmdb);
  const tanium = coverageFlag(coverage.toolValues.tanium);
  const tenable = coverageFlag(coverage.toolValues.tenable);
  const snow = coverageFlag(coverage.toolValues.snow);
  const seviceNow = coverageFlag(coverage.toolValues.servicenow ?? coverage.toolValues["service-now"]);
  const dsocSiem = coverageFlag(coverage.toolValues["dsoc-siem"] ?? coverage.toolValues.siem);
  const elastic = coverageFlag(coverage.toolValues.elastic);

  return {
    ucmdb,
    tanium,
    tenable,
    snow,
    seviceNow,
    dsocSiem,
    elastic,
    coverageCompliance: coverage.coverageCompliance
  };
}

interface SystemKpiSnapshotMetrics {
  nonCompliantServers: number;
  nonCompliantOs: number;
  nonCompliantEnvironments: number;
  p12Findings: number;
  highRiskP12Findings: number;
  outOfWarrantyAssets: number;
  nonCompliantDiscoveryCoverage: number;
}

function buildSystemKpiSnapshotMetrics(
  snapshot: Dataset,
  systemId: string,
  selectedEnvironment: EnvironmentType | undefined,
  serverSearchTerm: string,
  measuresSettings: MeasuresSettings,
  discoveryToolsSettings: DiscoveryToolsSettings
): SystemKpiSnapshotMetrics {
  const system = snapshot.ictSystems.find((item) => item.id === systemId);
  if (!system) {
    return {
      nonCompliantServers: 0,
      nonCompliantOs: 0,
      nonCompliantEnvironments: 0,
      p12Findings: 0,
      highRiskP12Findings: 0,
      outOfWarrantyAssets: 0,
      nonCompliantDiscoveryCoverage: 0
    };
  }

  const analytics = buildAnalytics(
    snapshot,
    snapshot.ictSystems,
    { ictSystem: systemId },
    measuresSettings,
    discoveryToolsSettings
  );
  const assets = snapshot.assets.filter((asset) => asset.systemContext?.systemId === systemId);
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const p12Findings = analytics.findings.filter((finding) => finding.priorityRank <= 2);

  const normalizedServerSearchTerm = serverSearchTerm.trim().toLowerCase();
  const searchMatchedAssets = normalizedServerSearchTerm
    ? assets.filter((asset) => {
        if (asset.type !== "server") {
          return false;
        }
        return (
          asset.hostname.toLowerCase().includes(normalizedServerSearchTerm) ||
          asset.id.toLowerCase().includes(normalizedServerSearchTerm)
        );
      })
    : assets;

  const envInSnapshot =
    selectedEnvironment && system.environments.some((environment) => environment.type === selectedEnvironment)
      ? selectedEnvironment
      : undefined;

  const searchMatchedAssetIds = new Set(searchMatchedAssets.map((asset) => asset.id));
  const assetsInCountScope = envInSnapshot
    ? searchMatchedAssets.filter((asset) => asset.systemContext?.environmentType === envInSnapshot)
    : searchMatchedAssets;
  const assetsInCountScopeIds = new Set(assetsInCountScope.map((asset) => asset.id));

  const findingsInCountScope = p12Findings.filter((finding) => {
    if (!assetsInCountScopeIds.has(finding.scope.assetId)) {
      return false;
    }
    if (envInSnapshot && finding.scope.environmentType !== envInSnapshot) {
      return false;
    }
    return true;
  });

  const nonCompliantServers = assetsInCountScope.filter((asset) => {
    if (asset.type !== "server") {
      return false;
    }
    const evaluation = evaluationByAssetId.get(asset.id);
    if (!evaluation) {
      return false;
    }
    return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
  }).length;

  const nonCompliantOs = assetsInCountScope.filter((asset) => {
    if (asset.type !== "server" && asset.type !== "workstation") {
      return false;
    }
    const evaluation = evaluationByAssetId.get(asset.id);
    if (!evaluation) {
      return false;
    }
    return evaluation.evaluations.some(
      (evaluationItem) =>
        (evaluationItem.spiId === 1 || evaluationItem.spiId === 2) && evaluationItem.status === "Non-compliant"
    );
  }).length;

  const nonCompliantEnvironments = (envInSnapshot ? [envInSnapshot] : system.environments.map((env) => env.type))
    .filter((environmentType) => {
      const statuses = analytics.evaluations
        .filter(
          (evaluation) => evaluation.environmentType === environmentType && searchMatchedAssetIds.has(evaluation.assetId)
        )
        .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
      return overallStatusFromStatuses(statuses) === "Non-compliant";
    })
    .length;

  const highRiskP12Findings = findingsInCountScope.filter((finding) => finding.severity === "High Risk").length;
  const outOfWarrantyAssets = assetsInCountScope.filter(
    (asset) => asset.lifecycle.warrantyStatus === "OutOfWarranty"
  ).length;
  const nonCompliantDiscoveryCoverage = assetsInCountScope.filter(
    (asset) => !discoveryCoverageForAsset(asset, discoveryToolsSettings).coverageCompliance
  ).length;

  return {
    nonCompliantServers,
    nonCompliantOs,
    nonCompliantEnvironments,
    p12Findings: findingsInCountScope.length,
    highRiskP12Findings,
    outOfWarrantyAssets,
    nonCompliantDiscoveryCoverage
  };
}

function environmentCardsForScope(
  environments: Array<{ type: EnvironmentType }>,
  evaluations: Array<{
    assetId: string;
    environmentType: EnvironmentType | null;
    evaluations: Array<{ status: ComplianceStatus }>;
  }>,
  p12Findings: Finding[],
  scopedAssetIds: Set<string>,
  assetNameById: Map<string, string>
) {
  return environments.map((environment) => {
    const environmentEvaluations = evaluations.filter(
      (evaluation) => evaluation.environmentType === environment.type && scopedAssetIds.has(evaluation.assetId)
    );
    const statuses = environmentEvaluations.flatMap((evaluation) =>
      evaluation.evaluations.map((evaluationItem) => evaluationItem.status)
    );
    const environmentFindings = p12Findings.filter(
      (finding) => finding.scope.environmentType === environment.type && scopedAssetIds.has(finding.scope.assetId)
    );
    const affectedAssets = summarizeAffectedAssets(environmentFindings, assetNameById);

    return {
      type: environment.type,
      posture: overallStatusFromStatuses(statuses),
      complianceScore: complianceScore(statuses),
      assetCount: environmentEvaluations.length,
      findingCount: environmentFindings.length,
      affectedAssets
    };
  });
}

function summarizeAffectedAssets(
  findings: Finding[],
  assetNameById: Map<string, string>
): Array<{ assetId: string; hostname: string; p1: number; p2: number }> {
  const counts = findings.reduce((map, finding) => {
    const current = map.get(finding.scope.assetId) ?? { p1: 0, p2: 0 };
    if (finding.priorityRank === 1) {
      current.p1 += 1;
    }
    if (finding.priorityRank === 2) {
      current.p2 += 1;
    }
    map.set(finding.scope.assetId, current);
    return map;
  }, new Map<string, { p1: number; p2: number }>());

  return Array.from(counts.entries())
    .map(([assetId, count]) => ({
      assetId,
      hostname: assetNameById.get(assetId) ?? assetId,
      p1: count.p1,
      p2: count.p2
    }))
    .sort((a, b) => {
      const totalDiff = b.p1 + b.p2 - (a.p1 + a.p2);
      if (totalDiff !== 0) {
        return totalDiff;
      }
      return a.hostname.localeCompare(b.hostname);
    });
}

export default async function SystemDetailPage({
  params,
  searchParams
}: {
  params: { systemId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const requestParams = searchParams ?? {};
  const requestedDataDate = extractDataDateParam(requestParams);
  const [dataset, snapshots, measuresSettings, discoveryToolsSettings] = await Promise.all([
    loadDatasetForDate(requestedDataDate),
    loadLatestSnapshotsForDate(requestedDataDate, 12),
    loadMeasuresSettings(),
    loadDiscoveryToolsSettings()
  ]);
  const system = dataset.ictSystems.find((item) => item.id === params.systemId);

  if (!system) {
    notFound();
  }

  const missionSummary =
    system.missionCapabilities.map((capability) => capability.name).join(", ") || "assigned mission capabilities";
  const serviceSummary = system.businessServices.map((service) => service.name).join(", ") || "assigned business services";
  const systemDescription =
    system.description?.trim() ||
    `${system.name} is a ${system.criticality.toLowerCase()} ICT system in the ${system.securityDomain} domain supporting ${missionSummary} and ${serviceSummary}.`;
  const systemOwner = system.owner?.trim() || `${system.name} Operations Team`;
  const systemSupportEmail = system.supportEmail?.trim() || `ict-support+${system.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}@tsaat.local`;
  const systemServiceCatalogueUrl = system.serviceCatalogueUrl?.trim() || `/systems/${system.id}`;
  const systemAtoNumber = system.atoNumber?.trim() || `ATO-${system.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`;
  const systemDiisId = system.diisId?.trim() || `DIIS-${system.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`;
  const systemDiisUrl = system.diisUrl?.trim() || `https://diis.defence.gov.au/systems/${encodeURIComponent(system.id)}`;
  const systemGrcUrl = system.grcUrl?.trim() || `https://grc.defence.gov.au/ato/${encodeURIComponent(systemAtoNumber)}`;
  const systemApmNumber = `APM-${system.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`;
  const systemApmUrl = `https://apm.defence.gov.au/applications/${encodeURIComponent(systemApmNumber)}`;

  const analytics = buildAnalytics(
    dataset,
    dataset.ictSystems,
    { ictSystem: system.id },
    measuresSettings,
    discoveryToolsSettings
  );

  const assets = dataset.assets.filter((asset) => asset.systemContext?.systemId === system.id);
  const assetNameById = new Map(assets.map((asset) => [asset.id, asset.hostname]));
  const findings = analytics.findings;
  const p12Findings = findings.filter((finding) => finding.priorityRank <= 2);

  const requestedEnvironment = firstParam(requestParams.environment);
  const selectedEnvironment = system.environments.some((environment) => environment.type === requestedEnvironment)
    ? (requestedEnvironment as EnvironmentType)
    : undefined;
  const requestedKpiFilter = firstParam(requestParams.kpiFilter);
  const selectedKpiFilter = isKpiFilterKey(requestedKpiFilter) ? requestedKpiFilter : undefined;
  const requestedDetailTab = firstParam(requestParams.systemDetailTab)?.trim().toLowerCase();
  const activeDetailTab: SystemDetailTabId =
    requestedDetailTab === "discovery-compliance"
      ? "discovery-compliance"
      : requestedDetailTab === "compliance-overview"
        ? "compliance-overview"
        : "system-details";
  const requestedP12Spi = Number(firstParam(requestParams.p12Spi));
  const selectedP12Spi =
    Number.isInteger(requestedP12Spi) && requestedP12Spi >= 1 && requestedP12Spi <= 10 ? requestedP12Spi : undefined;
  const requestedP12Priority = Number(firstParam(requestParams.p12Priority));
  const selectedP12Priority =
    Number.isInteger(requestedP12Priority) && requestedP12Priority >= 1 ? requestedP12Priority : undefined;
  const selectedP12Severity = firstParam(requestParams.p12Severity)?.trim() || undefined;
  const selectedP12SearchTerm = firstParam(requestParams.p12Search)?.trim() ?? "";
  const normalizedP12SearchTerm = selectedP12SearchTerm.toLowerCase();

  const serverSearchTerm = firstParam(requestParams.serverSearch)?.trim() ?? "";
  const normalizedServerSearchTerm = serverSearchTerm.toLowerCase();
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));

  const searchMatchedAssets = normalizedServerSearchTerm
    ? assets.filter((asset) => {
        if (asset.type !== "server") {
          return false;
        }
        return (
          asset.hostname.toLowerCase().includes(normalizedServerSearchTerm) ||
          asset.id.toLowerCase().includes(normalizedServerSearchTerm)
        );
      })
    : assets;

  const searchMatchedAssetIds = new Set(searchMatchedAssets.map((asset) => asset.id));
  const searchMatchedFindings = p12Findings.filter((finding) => searchMatchedAssetIds.has(finding.scope.assetId));
  const searchMatchedP12AssetIds = new Set(searchMatchedFindings.map((finding) => finding.scope.assetId));
  const searchMatchedHighRiskP12AssetIds = new Set(
    searchMatchedFindings
      .filter((finding) => finding.severity === "High Risk")
      .map((finding) => finding.scope.assetId)
  );

  const environmentCardsBeforeKpi = environmentCardsForScope(
    system.environments,
    analytics.evaluations,
    p12Findings,
    searchMatchedAssetIds,
    assetNameById
  );
  const nonCompliantEnvironmentTypes = new Set(
    environmentCardsBeforeKpi
      .filter((environment) => environment.posture === "Non-compliant")
      .map((environment) => environment.type)
  );

  const matchesSelectedKpiFilter = (asset: (typeof assets)[number]): boolean => {
    if (!selectedKpiFilter) {
      return true;
    }
    if (selectedKpiFilter === "nonCompliantServers") {
      if (asset.type !== "server") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      if (!evaluation) {
        return false;
      }
      return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
    }
    if (selectedKpiFilter === "nonCompliantOs") {
      if (asset.type !== "server" && asset.type !== "workstation") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      if (!evaluation) {
        return false;
      }
      return evaluation.evaluations.some(
        (evaluationItem) =>
          (evaluationItem.spiId === 1 || evaluationItem.spiId === 2) && evaluationItem.status === "Non-compliant"
      );
    }
    if (selectedKpiFilter === "nonCompliantEnvironments") {
      const environmentType = asset.systemContext?.environmentType;
      return environmentType ? nonCompliantEnvironmentTypes.has(environmentType) : false;
    }
    if (selectedKpiFilter === "p12Findings") {
      return searchMatchedP12AssetIds.has(asset.id);
    }
    if (selectedKpiFilter === "highRiskP12Findings") {
      return searchMatchedHighRiskP12AssetIds.has(asset.id);
    }
    if (selectedKpiFilter === "outOfWarrantyAssets") {
      return asset.lifecycle.warrantyStatus === "OutOfWarranty";
    }
    if (selectedKpiFilter === "nonCompliantDiscoveryCoverage") {
      return !discoveryCoverageForAsset(asset, discoveryToolsSettings).coverageCompliance;
    }
    return true;
  };

  const kpiMatchedAssets = selectedKpiFilter
    ? searchMatchedAssets.filter((asset) => matchesSelectedKpiFilter(asset))
    : searchMatchedAssets;
  const kpiMatchedAssetIds = new Set(kpiMatchedAssets.map((asset) => asset.id));

  const environmentCards = environmentCardsForScope(
    system.environments,
    analytics.evaluations,
    p12Findings,
    kpiMatchedAssetIds,
    assetNameById
  );

  const selectedLabel = selectedEnvironment ?? "All Environments";
  const environmentCardsCountScope = selectedEnvironment
    ? environmentCardsBeforeKpi.filter((environment) => environment.type === selectedEnvironment)
    : environmentCardsBeforeKpi;

  const assetsInCountScope = selectedEnvironment
    ? searchMatchedAssets.filter((asset) => asset.systemContext?.environmentType === selectedEnvironment)
    : searchMatchedAssets;
  const assetsInCountScopeIds = new Set(assetsInCountScope.map((asset) => asset.id));
  const findingsInCountScope = p12Findings.filter((finding) => {
    if (!assetsInCountScopeIds.has(finding.scope.assetId)) {
      return false;
    }
    if (selectedEnvironment && finding.scope.environmentType !== selectedEnvironment) {
      return false;
    }
    return true;
  });

  const nonCompliantServerCount = assetsInCountScope.filter((asset) => {
    if (asset.type !== "server") {
      return false;
    }
    const evaluation = evaluationByAssetId.get(asset.id);
    if (!evaluation) {
      return false;
    }
    return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
  }).length;

  const nonCompliantOsCount = assetsInCountScope.filter((asset) => {
    if (asset.type !== "server" && asset.type !== "workstation") {
      return false;
    }
    const evaluation = evaluationByAssetId.get(asset.id);
    if (!evaluation) {
      return false;
    }
    return evaluation.evaluations.some(
      (evaluationItem) =>
        (evaluationItem.spiId === 1 || evaluationItem.spiId === 2) && evaluationItem.status === "Non-compliant"
    );
  }).length;

  const nonCompliantEnvironmentCount = environmentCardsCountScope.filter(
    (environment) => environment.posture === "Non-compliant"
  ).length;

  const highRiskP12Count = findingsInCountScope.filter((finding) => finding.severity === "High Risk").length;

  const outOfWarrantyAssetCount = assetsInCountScope.filter(
    (asset) => asset.lifecycle.warrantyStatus === "OutOfWarranty"
  ).length;
  const nonCompliantDiscoveryCoverageCount = assetsInCountScope.filter(
    (asset) => !discoveryCoverageForAsset(asset, discoveryToolsSettings).coverageCompliance
  ).length;

  const filteredAssets = selectedEnvironment
    ? kpiMatchedAssets.filter((asset) => asset.systemContext?.environmentType === selectedEnvironment)
    : kpiMatchedAssets;
  const assetPageState = parsePageState(requestParams, "page", "pageSize");
  const coveragePageState = parsePageState(requestParams, "coveragePage", "coveragePageSize");
  const findingsPageState = parsePageState(requestParams, "findingsPage", "findingsPageSize");

  const filteredAssetIds = new Set(filteredAssets.map((asset) => asset.id));

  const filteredFindings = p12Findings.filter((finding) => {
    if (!filteredAssetIds.has(finding.scope.assetId)) {
      return false;
    }
    if (selectedEnvironment && finding.scope.environmentType !== selectedEnvironment) {
      return false;
    }
    return true;
  });
  const systemScopedRiskFindings = findings.filter((finding) => {
    if (!filteredAssetIds.has(finding.scope.assetId)) {
      return false;
    }
    if (selectedEnvironment && finding.scope.environmentType !== selectedEnvironment) {
      return false;
    }
    return true;
  });
  const openSystemScopedRiskFindings = systemScopedRiskFindings.filter((finding) => finding.status === "open");
  const riskSeverityOrder: FindingSeverity[] = ["Critical Exposure", "High Risk", "Major", "Moderate", "Data Gap"];
  const riskSeverityCounts = openSystemScopedRiskFindings.reduce<Map<FindingSeverity, number>>((accumulator, finding) => {
    accumulator.set(finding.severity, (accumulator.get(finding.severity) ?? 0) + 1);
    return accumulator;
  }, new Map());
  const riskSeveritySummary = riskSeverityOrder.map((severity) => ({
    severity,
    count: riskSeverityCounts.get(severity) ?? 0
  }));
  const systemDetailWeeklyRiskTrend = buildSystemDetailWeeklyRiskTrend(
    systemScopedRiskFindings,
    requestedDataDate ?? dataset.snapshotDate,
    dataset.snapshotDate,
    13
  );
  const p12SpiOptions = Array.from(new Set(filteredFindings.map((finding) => finding.spiId))).sort((a, b) => a - b);
  const p12PriorityOptions = Array.from(new Set(filteredFindings.map((finding) => finding.priorityRank))).sort(
    (a, b) => a - b
  );
  const p12SeverityOptions = Array.from(new Set(filteredFindings.map((finding) => finding.severity)));
  const p12SectionFindings = filteredFindings.filter((finding) => {
    if (selectedP12Spi && finding.spiId !== selectedP12Spi) {
      return false;
    }
    if (selectedP12Priority && finding.priorityRank !== selectedP12Priority) {
      return false;
    }
    if (selectedP12Severity && finding.severity !== selectedP12Severity) {
      return false;
    }
    if (!findingMatchesSearch(finding, normalizedP12SearchTerm)) {
      return false;
    }
    return true;
  });
  const preservedP12Params = Object.entries(requestParams).flatMap(([key, value]) => {
    if (key === "p12Spi" || key === "p12Priority" || key === "p12Severity" || key === "p12Search") {
      return [];
    }
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value.length ? [{ key, value: value[0] }] : [];
    }
    return [{ key, value }];
  });
  const clearP12FiltersHref = (() => {
    const params = new URLSearchParams();
    for (const param of preservedP12Params) {
      params.set(param.key, param.value);
    }
    const query = params.toString();
    return query ? `/systems/${system.id}?${query}#p12-findings` : `/systems/${system.id}#p12-findings`;
  })();

  const discoveryCoverageRows = filteredAssets
    .map((asset) => {
      const coverage = discoveryCoverageForAsset(asset, discoveryToolsSettings);

      return {
        assetId: asset.id,
        hostname: asset.hostname,
        assetType: asset.type,
        environment: asset.systemContext?.environmentType ?? "-",
        ucmdb: coverage.ucmdb,
        tanium: coverage.tanium,
        tenable: coverage.tenable,
        snow: coverage.snow,
        seviceNow: coverage.seviceNow,
        dsocSiem: coverage.dsocSiem,
        elastic: coverage.elastic,
        coverageCompliance: coverage.coverageCompliance
      };
    })
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const p12ByAsset = filteredFindings.reduce((map, finding) => {
    const current = map.get(finding.scope.assetId) ?? { p1: 0, p2: 0 };
    if (finding.priorityRank === 1) {
      current.p1 += 1;
    } else if (finding.priorityRank === 2) {
      current.p2 += 1;
    }
    map.set(finding.scope.assetId, current);
    return map;
  }, new Map<string, { p1: number; p2: number }>());

  const p12CountByAsset = new Map<string, number>();
  for (const [assetId, count] of p12ByAsset.entries()) {
    p12CountByAsset.set(assetId, count.p1 + count.p2);
  }

  const osAssetRows = filteredAssets
    .filter((asset) => asset.type === "server" || asset.type === "workstation")
    .map((asset) => {
      const os = asset.operatingSystem;
      const nMinus = os?.nMinus ?? null;
      const p12 = p12ByAsset.get(asset.id) ?? { p1: 0, p2: 0 };
      const p12Status =
        p12.p1 > 0 ? `P1 (${p12.p1})` : p12.p2 > 0 ? `P2 (${p12.p2})` : "No P1-P2";

      return {
        assetId: asset.id,
        hostname: asset.hostname,
        assetType: asset.type,
        environment: asset.systemContext?.environmentType ?? "-",
        osName: os ? `${os.vendor} ${os.family}` : "Unknown",
        version: os?.version ?? "Unknown",
        patchLevel: patchLevelLabel(nMinus),
        n2Status: n2PlusStatusLabel(nMinus),
        supportStatus: os?.supportStatus ?? "Unknown",
        p1: p12.p1,
        p2: p12.p2,
        p12Status
      };
    })
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const osSummaryMap = new Map<
    string,
    {
      osName: string;
      version: string;
      patchLevel: string;
      n2Status: string;
      supportStatus: string;
      assetCount: number;
      p1: number;
      p2: number;
    }
  >();

  for (const row of osAssetRows) {
    const key = [row.osName, row.version, row.patchLevel, row.n2Status, row.supportStatus].join("::");
    const current = osSummaryMap.get(key) ?? {
      osName: row.osName,
      version: row.version,
      patchLevel: row.patchLevel,
      n2Status: row.n2Status,
      supportStatus: row.supportStatus,
      assetCount: 0,
      p1: 0,
      p2: 0
    };
    current.assetCount += 1;
    current.p1 += row.p1;
    current.p2 += row.p2;
    osSummaryMap.set(key, current);
  }

  const osTotals = Array.from(osSummaryMap.values()).sort((a, b) => {
    if (a.assetCount !== b.assetCount) {
      return b.assetCount - a.assetCount;
    }
    const osComparison = a.osName.localeCompare(b.osName);
    if (osComparison !== 0) {
      return osComparison;
    }
    return a.version.localeCompare(b.version);
  });
  const coverageRowsPage = paginate(discoveryCoverageRows, coveragePageState.page, coveragePageState.pageSize);
  const assetRowsPage = paginate(filteredAssets, assetPageState.page, assetPageState.pageSize);
  const findingsRowsPage = paginate(p12SectionFindings, findingsPageState.page, findingsPageState.pageSize);

  const selectedStatuses = analytics.evaluations
    .filter((evaluation) => filteredAssetIds.has(evaluation.assetId))
    .filter((evaluation) => !selectedEnvironment || evaluation.environmentType === selectedEnvironment)
    .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
  const selectedComplianceScore = complianceScore(selectedStatuses);
  const selectedPosture = overallStatusFromStatuses(selectedStatuses);
  const filteredAssetsById = new Map(filteredAssets.map((asset) => [asset.id, asset]));

  const scopedEvaluationRows = analytics.evaluations
    .filter((evaluation) => filteredAssetIds.has(evaluation.assetId))
    .flatMap((evaluation) =>
      evaluation.evaluations.map((item) => ({
        assetId: evaluation.assetId,
        spiId: item.spiId,
        status: item.status,
        reasons: item.reasons
      }))
    );

  const complianceOverviewStatuses = scopedEvaluationRows.map((row) => row.status);
  const complianceOverviewSummaryCounts = complianceOverviewStatuses.reduce(
    (accumulator, status) => {
      if (status === "Compliant") {
        accumulator.compliant += 1;
      } else if (status === "Non-compliant") {
        accumulator.nonCompliant += 1;
      } else {
        accumulator.unknown += 1;
      }
      return accumulator;
    },
    { compliant: 0, nonCompliant: 0, unknown: 0 }
  );
  const complianceOverviewScore = complianceScore(complianceOverviewStatuses);

  const complianceMeasureRows = SPI_IDS.map((spiId) => {
    const scopedSpiEvaluations = scopedEvaluationRows.filter((row) => row.spiId === spiId);
    const compliant = scopedSpiEvaluations.filter((row) => row.status === "Compliant").length;
    const nonCompliant = scopedSpiEvaluations.filter((row) => row.status === "Non-compliant").length;
    const unknown = scopedSpiEvaluations.filter((row) => row.status === "Unknown").length;
    const impactedAssetIds = new Set<string>();
    const reasonCounts = new Map<string, number>();

    for (const row of scopedSpiEvaluations) {
      if (row.status !== "Compliant") {
        impactedAssetIds.add(row.assetId);
      }
      if (row.status !== "Non-compliant") {
        continue;
      }
      for (const reason of row.reasons) {
        const normalizedReason = reason.trim();
        if (!normalizedReason) {
          continue;
        }
        reasonCounts.set(normalizedReason, (reasonCounts.get(normalizedReason) ?? 0) + 1);
      }
    }

    const total = compliant + nonCompliant + unknown;
    const score = total ? Number(((compliant / total) * 100).toFixed(1)) : 0;
    const topReasons = Array.from(reasonCounts.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) {
          return b[1] - a[1];
        }
        return a[0].localeCompare(b[0]);
      })
      .slice(0, 3)
      .map(([reason]) => reason);

    return {
      spiId,
      label: `SPI ${spiId} - ${SPI_DESCRIPTIONS[spiId]}`,
      total,
      compliant,
      nonCompliant,
      unknown,
      score,
      impactedAssets: impactedAssetIds.size,
      topReasons
    };
  });

  const systemScopedFindings = findings.filter((finding) => filteredAssetIds.has(finding.scope.assetId));
  const latestFindingByAssetAndSpi = systemScopedFindings.reduce((map, finding) => {
    const key = `${finding.scope.assetId}:${finding.spiId}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, finding);
      return map;
    }
    const currentTime = new Date(current.timestamp).getTime();
    const candidateTime = new Date(finding.timestamp).getTime();
    if (candidateTime > currentTime) {
      map.set(key, finding);
    }
    return map;
  }, new Map<string, Finding>());

  const systemOwnerFallback = system.owner?.trim() || "Not assigned";

  const complianceOverviewFindings = scopedEvaluationRows
    .filter((row) => row.status !== "Compliant")
    .map((row) => {
      const asset = filteredAssetsById.get(row.assetId);
      const latestFinding = latestFindingByAssetAndSpi.get(`${row.assetId}:${row.spiId}`);
      const evidenceFromFinding = latestFinding
        ? Object.entries(latestFinding.evidence).map(([key, value]) => ({
            key,
            value: toEvidenceString(value)
          }))
        : [];
      const evidenceFromEvaluation = row.reasons
        .map((reason) => reason.trim())
        .filter(Boolean)
        .map((reason, index) => ({
          key: index === 0 ? "reason" : `reason ${index + 1}`,
          value: reason
        }));
      const evidence =
        evidenceFromFinding.length > 0
          ? evidenceFromFinding
          : evidenceFromEvaluation.length > 0
            ? evidenceFromEvaluation
            : [{ key: "evaluationStatus", value: row.status }];
      const evidencePreview = evidence
        .slice(0, 2)
        .map((item) => `${item.key}: ${item.value}`)
        .join(" | ");
      const scopeLabel = [
        `Asset ${row.assetId}`,
        system.id ? `System ${system.id}` : "System n/a",
        asset?.systemContext?.environmentType ? `Env ${asset.systemContext.environmentType}` : "Env n/a"
      ].join(" | ");
      const assetName =
        (latestFinding
          ? readEvidenceStringValue(latestFinding.evidence, ["assetName", "asset_name"])
          : null) ??
        asset?.name ??
        asset?.hostname ??
        row.assetId;
      const assetType = formatAssetTypeLabel(
        (latestFinding
          ? readEvidenceStringValue(latestFinding.evidence, ["assetType", "asset_type"])
          : null) ?? asset?.type ?? null
      );
      const assetIpAddress =
        (latestFinding
          ? readEvidenceStringValue(latestFinding.evidence, [
              "assetIpAddress",
              "assetIp",
              "ipAddress",
              "ip",
              "ipv4Address",
              "ipv4",
              "ip_address"
            ])
          : null) ??
        (asset ? resolveAssetIpAddress(asset) : "Not available");
      const assetChangeAssignmentGroup =
        (latestFinding
          ? readEvidenceStringValue(latestFinding.evidence, [
              "assetChangeAssignmentGroup",
              "changeAssignmentGroup",
              "changeGroup",
              "change_assignment_group"
            ])
          : null) ?? "Not assigned";
      const assetIncidentAssignmentGroup =
        (latestFinding
          ? readEvidenceStringValue(latestFinding.evidence, [
              "assetIncidentAssignmentGroup",
              "incidentAssignmentGroup",
              "incidentGroup",
              "incident_assignment_group"
            ])
          : null) ?? "Not assigned";
      const owner =
        (latestFinding
          ? readEvidenceStringValue(latestFinding.evidence, ["assetOwner", "owner", "serviceOwner"])
          : null) ?? systemOwnerFallback;

      const timestamp = latestFinding?.timestamp ?? `${dataset.snapshotDate}T00:00:00.000Z`;
      const severity = latestFinding?.severity ?? fallbackFindingSeverity(row.status, row.spiId);
      const priorityRank = latestFinding?.priorityRank ?? fallbackPriorityRank(row.status, row.spiId);
      const title = latestFinding?.title ?? SPI_DESCRIPTIONS[row.spiId];
      const recommendedAction =
        latestFinding?.recommendedAction ??
        (row.reasons.length
          ? row.reasons.join(" | ")
          : `Investigate and remediate SPI ${row.spiId} non-compliance for the impacted asset.`);

      return {
        id: latestFinding ? `${latestFinding.id}-current` : `current-${row.assetId}-spi-${row.spiId}`,
        assetId: row.assetId,
        assetName,
        assetType,
        assetIpAddress,
        assetChangeAssignmentGroup,
        assetIncidentAssignmentGroup,
        owner,
        spiId: row.spiId,
        timestamp,
        closedTimestamp: null,
        closedTimestampLabel: null,
        title,
        timestampLabel: formatTimestamp(timestamp),
        measureLabel: `SPI ${row.spiId} - ${SPI_DESCRIPTIONS[row.spiId]}`,
        priorityRank,
        severity,
        workflowStatus: "open" as const,
        complianceStatus: row.status,
        evaluationStatus: row.status,
        scopeLabel,
        evidencePreview: evidencePreview || "No evidence captured",
        evidence,
        recommendedAction
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

  const assetTypeSummary = {
    totalAssets: filteredAssets.length,
    serverCount: filteredAssets.filter((asset) => asset.type === "server").length,
    workstationCount: filteredAssets.filter((asset) => asset.type === "workstation").length,
    networkDeviceCount: filteredAssets.filter((asset) => asset.type === "network-device").length
  };

  const selectedComplianceSummaryCounts = selectedStatuses.reduce(
    (accumulator, status) => {
      if (status === "Compliant") {
        accumulator.compliant += 1;
      } else if (status === "Non-compliant") {
        accumulator.nonCompliant += 1;
      } else {
        accumulator.unknown += 1;
      }
      return accumulator;
    },
    { compliant: 0, nonCompliant: 0, unknown: 0 }
  );

  const headerComplianceCounts =
    activeDetailTab === "compliance-overview" ? complianceOverviewSummaryCounts : selectedComplianceSummaryCounts;
  const headerComplianceScore = activeDetailTab === "compliance-overview" ? complianceOverviewScore : selectedComplianceScore;
  const complianceChartTotal =
    headerComplianceCounts.compliant + headerComplianceCounts.nonCompliant + headerComplianceCounts.unknown;
  const complianceChartCompliantStop = complianceChartTotal
    ? (headerComplianceCounts.compliant / complianceChartTotal) * 360
    : 0;
  const complianceChartNonCompliantStop = complianceChartTotal
    ? ((headerComplianceCounts.compliant + headerComplianceCounts.nonCompliant) / complianceChartTotal) * 360
    : 0;
  const complianceChartBackground = complianceChartTotal
    ? `conic-gradient(rgba(52,211,153,0.95) 0deg ${complianceChartCompliantStop}deg, rgba(248,113,113,0.95) ${complianceChartCompliantStop}deg ${complianceChartNonCompliantStop}deg, rgba(148,163,184,0.92) ${complianceChartNonCompliantStop}deg 360deg)`
    : "conic-gradient(rgba(148,163,184,0.92) 0deg 360deg)";

  const discoveryComplianceCounts = discoveryCoverageRows.reduce(
    (accumulator, row) => {
      const sourceAsset = filteredAssetsById.get(row.assetId);
      const isOther =
        sourceAsset?.lifecycle.eolStatus === "Unknown" || sourceAsset?.lifecycle.warrantyStatus === "Unknown";

      if (isOther) {
        accumulator.other += 1;
      } else if (row.coverageCompliance) {
        accumulator.compliant += 1;
      } else {
        accumulator.nonCompliant += 1;
      }
      return accumulator;
    },
    { compliant: 0, nonCompliant: 0, other: 0 }
  );
  const discoveryComplianceTotal =
    discoveryComplianceCounts.compliant + discoveryComplianceCounts.nonCompliant + discoveryComplianceCounts.other;
  const discoveryComplianceScore = discoveryComplianceTotal
    ? Number(((discoveryComplianceCounts.compliant / discoveryComplianceTotal) * 100).toFixed(1))
    : 0;
  const discoveryComplianceCompliantStop = discoveryComplianceTotal
    ? (discoveryComplianceCounts.compliant / discoveryComplianceTotal) * 360
    : 0;
  const discoveryComplianceNonCompliantStop = discoveryComplianceTotal
    ? ((discoveryComplianceCounts.compliant + discoveryComplianceCounts.nonCompliant) / discoveryComplianceTotal) * 360
    : 0;
  const discoveryComplianceChartBackground = discoveryComplianceTotal
    ? `conic-gradient(rgba(52,211,153,0.95) 0deg ${discoveryComplianceCompliantStop}deg, rgba(248,113,113,0.95) ${discoveryComplianceCompliantStop}deg ${discoveryComplianceNonCompliantStop}deg, rgba(148,163,184,0.92) ${discoveryComplianceNonCompliantStop}deg 360deg)`
    : "conic-gradient(rgba(148,163,184,0.92) 0deg 360deg)";

  const discoveryToolCoverageCharts = [
    { id: "ucmdb", label: "UCMDB", accessor: (row: (typeof discoveryCoverageRows)[number]) => row.ucmdb },
    { id: "tanium", label: "Tanium", accessor: (row: (typeof discoveryCoverageRows)[number]) => row.tanium },
    { id: "tenable", label: "Tenable", accessor: (row: (typeof discoveryCoverageRows)[number]) => row.tenable },
    { id: "servicenow", label: "ServiceNow", accessor: (row: (typeof discoveryCoverageRows)[number]) => row.seviceNow }
  ].map((tool) => {
    const total = discoveryCoverageRows.length;
    const compliant = discoveryCoverageRows.filter((row) => tool.accessor(row) === 1).length;
    const nonCompliant = Math.max(total - compliant, 0);
    const score = total ? Number(((compliant / total) * 100).toFixed(1)) : 0;
    const compliantStop = total ? (compliant / total) * 360 : 0;
    const nonCompliantStop = total ? ((compliant + nonCompliant) / total) * 360 : 0;
    const chartBackground = total
      ? `conic-gradient(rgba(52,211,153,0.95) 0deg ${compliantStop}deg, rgba(248,113,113,0.95) ${compliantStop}deg ${nonCompliantStop}deg, rgba(148,163,184,0.92) ${nonCompliantStop}deg 360deg)`
      : "conic-gradient(rgba(148,163,184,0.92) 0deg 360deg)";
    return {
      ...tool,
      total,
      compliant,
      nonCompliant,
      score,
      chartBackground
    };
  });

  const scopeHref = (scope: {
    environment?: EnvironmentType;
    serverSearch?: string;
    kpiFilter?: KpiFilterKey;
  }) => {
    const params = new URLSearchParams();
    if (requestedDataDate) {
      params.set("dataDate", requestedDataDate);
    }
    if (scope.environment) {
      params.set("environment", scope.environment);
    }
    if (scope.serverSearch) {
      params.set("serverSearch", scope.serverSearch);
    }
    if (scope.kpiFilter) {
      params.set("kpiFilter", scope.kpiFilter);
    }
    const query = params.toString();
    return query ? `/systems/${system.id}?${query}` : `/systems/${system.id}`;
  };
  const scopedPageHref = (updates: Record<string, string | undefined>, hash?: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(requestParams)) {
      if (!value) {
        continue;
      }
      params.set(key, Array.isArray(value) ? value[0] : value);
    }
    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    const href = query ? `/systems/${system.id}?${query}` : `/systems/${system.id}`;
    return hash ? `${href}#${hash}` : href;
  };

  const environmentHref = (environment?: EnvironmentType) => {
    return scopeHref({
      environment,
      serverSearch: serverSearchTerm || undefined,
      kpiFilter: selectedKpiFilter
    });
  };
  const kpiFilterHref = (kpiFilter?: KpiFilterKey) =>
    scopeHref({
      environment: selectedEnvironment,
      serverSearch: serverSearchTerm || undefined,
      kpiFilter
    });
  const snapshotByDate = new Map<string, Dataset>();
  for (const snapshot of snapshots) {
    snapshotByDate.set(snapshot.snapshotDate, snapshot);
  }
  snapshotByDate.set(dataset.snapshotDate, dataset);

  const last12Snapshots = Array.from(snapshotByDate.values())
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
    .slice(-12);

  const kpiTrendSeries = last12Snapshots.map((snapshot, index) => {
    const metrics = buildSystemKpiSnapshotMetrics(
      snapshot,
      system.id,
      selectedEnvironment,
      serverSearchTerm,
      measuresSettings,
      discoveryToolsSettings
    );
    return {
      weekLabel: `W${String(last12Snapshots.length - index).padStart(2, "0")}`,
      ...metrics
    };
  });

  const trendPointsFor = (key: keyof SystemKpiSnapshotMetrics) =>
    kpiTrendSeries.map((point) => ({
      label: point.weekLabel,
      value: point[key]
    }));

  const nonCompliantServersTrend = trendPointsFor("nonCompliantServers");
  const nonCompliantOsTrend = trendPointsFor("nonCompliantOs");
  const nonCompliantEnvironmentsTrend = trendPointsFor("nonCompliantEnvironments");
  const p12FindingsTrend = trendPointsFor("p12Findings");
  const highRiskP12Trend = trendPointsFor("highRiskP12Findings");
  const outOfWarrantyTrend = trendPointsFor("outOfWarrantyAssets");
  const nonCompliantDiscoveryCoverageTrend = trendPointsFor("nonCompliantDiscoveryCoverage");
  const routeReadyLocationKey = buildLocationKeyFromParamsRecord(`/systems/${system.id}`, requestParams);

  return (
    <div
      className="relative left-1/2 -my-5 flex h-[calc(100vh-11rem)] w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden md:-my-8 md:h-[calc(100vh-12rem)] md:w-[min(2100px,calc(100vw-3rem))]"
      data-route-ready-key={encodeLocationKeyForAttribute(routeReadyLocationKey)}
    >
      <section className="panel shrink-0 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href={withDataDate("/systems?systemsTab=posture", requestedDataDate)} className="text-xs text-sky-200 underline">
              Back to ICT Systems
            </Link>
            <h1 className="mt-2 text-3xl font-semibold text-slate-100">{system.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <PostureBadge status={selectedPosture} />
              <span className="rounded-full border border-sky-400/25 px-3 py-1 text-xs text-slate-200">
                Network: {system.networkId}
              </span>
              <span className="rounded-full border border-sky-400/25 px-3 py-1 text-xs text-slate-200">
                Assets: {filteredAssets.length}
              </span>
              <span className="rounded-full border border-sky-400/25 px-3 py-1 text-xs text-slate-200">
                Scope: {selectedLabel}
              </span>
              {serverSearchTerm ? (
                <span className="rounded-full border border-sky-300/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-100">
                  Server search: {serverSearchTerm}
                </span>
              ) : null}
              {selectedKpiFilter ? (
                <span className="rounded-full border border-amber-300/45 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                  KPI filter: {KPI_FILTER_LABELS[selectedKpiFilter]}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid min-w-[250px] gap-3 self-stretch md:grid-cols-2 lg:self-auto">
            <div className="panel-alt border-sky-300/25 p-4">
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Compliance Score</p>
                <div
                  className="mx-auto mt-3 flex h-28 w-28 items-center justify-center rounded-full border border-sky-200/45"
                  style={{ background: complianceChartBackground }}
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-950/95">
                    <span className="text-2xl font-semibold text-emerald-100">{headerComplianceScore}%</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-300/80">
                  C {headerComplianceCounts.compliant} | NC {headerComplianceCounts.nonCompliant} | U{" "}
                  {headerComplianceCounts.unknown}
                </p>
                <p className="mt-1 text-[11px] text-sky-200/90">Aligned to current drill-through context</p>
              </div>
            </div>
            <div className="panel-alt border-sky-300/25 p-4">
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Discovery Compliance Score</p>
                <div
                  className="mx-auto mt-3 flex h-28 w-28 items-center justify-center rounded-full border border-sky-200/45"
                  style={{ background: discoveryComplianceChartBackground }}
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-950/95">
                    <span className="text-2xl font-semibold text-emerald-100">{discoveryComplianceScore}%</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-300/80">
                  C {discoveryComplianceCounts.compliant} | NC {discoveryComplianceCounts.nonCompliant} | Other{" "}
                  {discoveryComplianceCounts.other}
                </p>
                <p className="mt-1 text-[11px] text-sky-200/90">Aligned to current drill-through context</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SystemDetailTabs activeTab={activeDetailTab} />

      <div
        className={
          activeDetailTab === "compliance-overview" ||
          activeDetailTab === "discovery-compliance" ||
          activeDetailTab === "system-details"
            ? "min-h-0 flex-1 overflow-hidden pr-1"
            : "min-h-0 flex-1 space-y-4 overflow-auto pr-1"
        }
      >
      {activeDetailTab === "compliance-overview" ? (
      <NetworkComplianceOverview
        networkName={system.name}
        asOfDate={requestedDataDate ?? dataset.snapshotDate}
        summary={{
          score: complianceOverviewScore,
          total: complianceOverviewStatuses.length,
          compliant: complianceOverviewSummaryCounts.compliant,
          nonCompliant: complianceOverviewSummaryCounts.nonCompliant,
          unknown: complianceOverviewSummaryCounts.unknown
        }}
        assetTypeSummary={assetTypeSummary}
        measures={complianceMeasureRows}
        findings={complianceOverviewFindings}
      />
      ) : null}

      {activeDetailTab === "system-details" ? (
      <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
      <section className="panel flex min-h-0 flex-col overflow-hidden p-2.5">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">System Details</h2>
        <div className="mt-2 min-h-0 overflow-auto pr-1">
        <div className="grid gap-1.5 xl:grid-cols-2">
          <article className="rounded-xl border border-sky-300/35 bg-slate-950/55 p-2.5 xl:row-span-2">
            <h3 className="text-base font-medium text-slate-100">Description</h3>
            <p className="mt-2 text-sm leading-5 text-slate-200/90">{systemDescription}</p>
          </article>

          <article className="rounded-xl border border-sky-300/35 bg-slate-950/55 p-2.5">
            <dl className="space-y-3.5">
              <div>
                <dt className="text-base font-medium text-slate-100">Owner:</dt>
                <dd className="mt-0.5 text-sm text-slate-200">{systemOwner}</dd>
              </div>
              <div>
                <dt className="text-base font-medium text-slate-100">Support Email:</dt>
                <dd className="mt-0.5 text-sm text-sky-100">
                  <a className="underline decoration-sky-300/60 underline-offset-2" href={`mailto:${systemSupportEmail}`}>
                    {systemSupportEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-base font-medium text-slate-100">Service Catalogue Item:</dt>
                <dd className="mt-0.5 text-sm text-sky-100">
                  <ul className="list-disc space-y-0.5 pl-5">
                    <li>
                      <Link
                        href={systemServiceCatalogueUrl}
                        className="underline decoration-sky-300/60 underline-offset-2"
                        target={isExternalLink(systemServiceCatalogueUrl) ? "_blank" : undefined}
                        rel={isExternalLink(systemServiceCatalogueUrl) ? "noreferrer" : undefined}
                      >
                        Support Request
                      </Link>
                    </li>
                    <li>
                      <Link
                        href={systemServiceCatalogueUrl}
                        className="underline decoration-sky-300/60 underline-offset-2"
                        target={isExternalLink(systemServiceCatalogueUrl) ? "_blank" : undefined}
                        rel={isExternalLink(systemServiceCatalogueUrl) ? "noreferrer" : undefined}
                      >
                        Issue Request
                      </Link>
                    </li>
                  </ul>
                </dd>
              </div>
            </dl>
          </article>

          <article className="security-accreditation-pulse rounded-xl border border-yellow-300/90 bg-sky-400/16 p-2.5 shadow-[0_0_14px_rgba(253,224,71,0.32)]">
            <h3 className="text-base font-medium text-slate-100">Security Accreditation</h3>
            <div className="mt-2 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-slate-300/85">
                  <tr>
                    <th className="px-2 py-1.5">Authority to Operate (ATO)</th>
                    <th className="px-2 py-1.5">DIIS ID</th>
                    <th className="px-2 py-1.5">Links</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-sky-300/30 text-slate-100">
                    <td className="px-2 py-2 font-semibold text-slate-100">{systemAtoNumber}</td>
                    <td className="px-2 py-2 text-slate-100">{systemDiisId}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-3 text-sky-100">
                        <Link
                          href={systemDiisUrl}
                          className="underline decoration-sky-300/70 underline-offset-2"
                          target={isExternalLink(systemDiisUrl) ? "_blank" : undefined}
                          rel={isExternalLink(systemDiisUrl) ? "noreferrer" : undefined}
                        >
                          View in DIIS
                        </Link>
                        <Link
                          href={systemGrcUrl}
                          className="underline decoration-sky-300/70 underline-offset-2"
                          target={isExternalLink(systemGrcUrl) ? "_blank" : undefined}
                          rel={isExternalLink(systemGrcUrl) ? "noreferrer" : undefined}
                        >
                          View in Cyber GRC Portal
                        </Link>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <article className="security-accreditation-pulse rounded-xl border border-lime-300/90 bg-sky-400/16 p-2.5 shadow-[0_0_14px_rgba(190,242,100,0.34)]">
            <h3 className="text-base font-medium text-slate-100">Application Portfolio Management</h3>
            <div className="mt-2 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-slate-300/85">
                  <tr>
                    <th className="px-2 py-1.5">APM Number</th>
                    <th className="px-2 py-1.5">Links</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-sky-300/30 text-slate-100">
                    <td className="px-2 py-2 font-semibold text-slate-100">{systemApmNumber}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-3 text-sky-100">
                        <Link
                          href={systemApmUrl}
                          className="underline decoration-sky-300/70 underline-offset-2"
                          target={isExternalLink(systemApmUrl) ? "_blank" : undefined}
                          rel={isExternalLink(systemApmUrl) ? "noreferrer" : undefined}
                        >
                          View in APM
                        </Link>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <article className="security-accreditation-pulse rounded-xl border border-fuchsia-300/90 bg-sky-400/16 p-2.5 shadow-[0_0_14px_rgba(232,121,249,0.34)]">
            <h3 className="text-base font-medium text-slate-100">Defence ICT Inventory System</h3>
            <div className="mt-2 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-slate-300/85">
                  <tr>
                    <th className="px-2 py-1.5">DIIS ID</th>
                    <th className="px-2 py-1.5">Links</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-sky-300/30 text-slate-100">
                    <td className="px-2 py-2 font-semibold text-slate-100">{systemDiisId}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-3 text-sky-100">
                        <Link
                          href={systemDiisUrl}
                          className="underline decoration-sky-300/70 underline-offset-2"
                          target={isExternalLink(systemDiisUrl) ? "_blank" : undefined}
                          rel={isExternalLink(systemDiisUrl) ? "noreferrer" : undefined}
                        >
                          View in DIIS
                        </Link>
                        <Link
                          href={systemGrcUrl}
                          className="underline decoration-sky-300/70 underline-offset-2"
                          target={isExternalLink(systemGrcUrl) ? "_blank" : undefined}
                          rel={isExternalLink(systemGrcUrl) ? "noreferrer" : undefined}
                        >
                          View in Cyber GRC Portal
                        </Link>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-xl border border-sky-300/35 bg-slate-950/55 p-2.5">
            <h3 className="text-base font-medium text-slate-100">Mission Capabilities</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
              {system.missionCapabilities.map((capability) => (
                <li key={capability.id} className="rounded-lg border border-sky-300/20 bg-slate-900/55 px-2 py-1.5">
                  {capability.name} ({capability.criticality})
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-sky-300/35 bg-slate-950/55 p-2.5">
            <h3 className="text-base font-medium text-slate-100">Business Services</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
              {system.businessServices.map((service) => (
                <li key={service.id} className="rounded-lg border border-sky-300/20 bg-slate-900/55 px-2 py-1.5">
                  {service.name} ({service.criticality})
                </li>
              ))}
            </ul>
          </article>
        </div>
        </div>
      </section>

      <section className="panel min-h-0 overflow-hidden p-2.5">
        <NetworkDetailRiskCharts
          layout="stacked"
          scopeDescription="Open findings by severity in current ICT system detail scope."
          riskProfile={{
            openFindings: openSystemScopedRiskFindings.length,
            p1p2Count: openSystemScopedRiskFindings.filter((finding) => finding.priorityRank <= 2).length,
            highRiskOpenCount: riskSeverityCounts.get("High Risk") ?? 0,
            criticalExposureOpenCount: riskSeverityCounts.get("Critical Exposure") ?? 0,
            severitySummary: riskSeveritySummary,
            weeklyTrend: systemDetailWeeklyRiskTrend
          }}
        />
      </section>
      </div>
      ) : null}

      {activeDetailTab === "discovery-compliance" ? (
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
        <section className="panel p-4">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Discovery Tool Coverage</h2>
          <p className="mt-1 text-xs text-slate-300/80">
            Coverage score by discovery tool across the current ICT System drill-through context.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {discoveryToolCoverageCharts.map((tool) => (
              <article key={tool.id} className="panel-alt border-sky-300/25 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">{tool.label}</p>
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full border border-sky-200/45"
                    style={{ background: tool.chartBackground }}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950/95">
                      <span className="text-sm font-semibold text-emerald-100">{tool.score}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-100">
                      {tool.compliant}/{tool.total} covered
                    </p>
                    <p className="mt-1 text-xs text-red-100/90">{tool.nonCompliant} non-compliant</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="asset-discovery-coverage" className="panel flex min-h-0 flex-col overflow-hidden">
          <h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
            Asset Discovery Coverage ({selectedLabel})
          </h2>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                <tr>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Environment</th>
                  <th className="px-3 py-2">UCMDB</th>
                  <th className="px-3 py-2">Tanium</th>
                  <th className="px-3 py-2">Tenable</th>
                  <th className="px-3 py-2">SNOW</th>
                  <th className="px-3 py-2">ServiceNow</th>
                  <th className="px-3 py-2">DSOC SIEM</th>
                  <th className="px-3 py-2">Elastic</th>
                  <th className="px-3 py-2">Coverage Compliance</th>
                </tr>
              </thead>
              <tbody>
                {coverageRowsPage.items.map((row) => (
                  <tr key={row.assetId} className="border-t border-sky-400/10">
                    <td className="px-3 py-2 text-slate-100">{row.hostname}</td>
                    <td className="px-3 py-2 text-slate-300">{row.assetType}</td>
                    <td className="px-3 py-2 text-slate-300">{row.environment}</td>
                    <td className="px-3 py-2 text-slate-200">{row.ucmdb}</td>
                    <td className="px-3 py-2 text-slate-200">{row.tanium}</td>
                    <td className="px-3 py-2 text-slate-200">{row.tenable}</td>
                    <td className="px-3 py-2 text-slate-200">{row.snow}</td>
                    <td className="px-3 py-2 text-slate-200">{row.seviceNow}</td>
                    <td className="px-3 py-2 text-slate-200">{row.dsocSiem}</td>
                    <td className="px-3 py-2 text-slate-200">{row.elastic}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          row.coverageCompliance
                            ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                            : "border-red-400/45 bg-red-500/15 text-red-100"
                        }`}
                      >
                        {row.coverageCompliance ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
                {coverageRowsPage.totalItems === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-6 text-center text-sm text-slate-300/80">
                      No assets in this scope.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {coverageRowsPage.totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-400/10 px-4 py-3 text-xs text-slate-300/85">
              <p>
                Showing {(coverageRowsPage.currentPage - 1) * coverageRowsPage.pageSize + 1}-
                {Math.min(coverageRowsPage.currentPage * coverageRowsPage.pageSize, coverageRowsPage.totalItems)} of{" "}
                {coverageRowsPage.totalItems}
              </p>
              <div className="flex items-center gap-2">
                {coverageRowsPage.currentPage > 1 ? (
                  <a
                    href={scopedPageHref(
                      { coveragePage: String(coverageRowsPage.currentPage - 1) },
                      "asset-discovery-coverage"
                    )}
                    data-filter-loading="true"
                    data-filter-loading-message="Loading discovery coverage page..."
                    className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 hover:bg-slate-800/70"
                  >
                    Previous
                  </a>
                ) : (
                  <span className="rounded-md border border-slate-700/70 px-3 py-1 text-slate-500">Previous</span>
                )}
                <span>
                  Page {coverageRowsPage.currentPage} of {coverageRowsPage.totalPages}
                </span>
                {coverageRowsPage.currentPage < coverageRowsPage.totalPages ? (
                  <a
                    href={scopedPageHref(
                      { coveragePage: String(coverageRowsPage.currentPage + 1) },
                      "asset-discovery-coverage"
                    )}
                    data-filter-loading="true"
                    data-filter-loading-message="Loading discovery coverage page..."
                    className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 hover:bg-slate-800/70"
                  >
                    Next
                  </a>
                ) : (
                  <span className="rounded-md border border-slate-700/70 px-3 py-1 text-slate-500">Next</span>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>
      ) : null}
      </div>
    </div>
  );
}
