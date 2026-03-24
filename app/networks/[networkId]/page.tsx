import Link from "next/link";
import { notFound } from "next/navigation";
import { DrillthroughBackLink } from "@/components/drillthrough-back-link";
import { MiniTrendSparkline } from "@/components/mini-trend-sparkline";
import { NetworkComplianceOverview } from "@/components/network-compliance-overview";
import { NetworkDetailTabs } from "@/components/network-detail-tabs";
import { NetworkDetailRiskCharts } from "@/components/network-detail-risk-charts";
import { PostureBadge } from "@/components/posture-badge";
import { ServerStreamHint } from "@/components/server-stream-hint";
import {
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadLatestSnapshotsForDate,
  loadMeasuresSettings
} from "@/lib/data-loader";
import { DiscoveryCoverageValue, evaluateDiscoveryCoverage } from "@/lib/discovery-coverage";
import { MeasuresSettings } from "@/lib/measures-settings";
import { buildAnalytics } from "@/lib/analytics";
import { PRIORITY_ORDER, SPI_DESCRIPTIONS } from "@/lib/constants";
import { SPI_IDS } from "@/lib/spi-metadata";
import { extractDataDateParam, todayDateKey, withDataDate } from "@/lib/data-date";
import { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { buildLocationKeyFromParamsRecord, encodeLocationKeyForAttribute } from "@/lib/location-key";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";
import { buildNetworkTopologyData } from "@/lib/network-topology";
import { paginate, parsePageState } from "@/lib/pagination";
import { Asset, ComplianceStatus, Dataset, Finding, FindingSeverity } from "@/lib/types";
import { Suspense } from "react";

type KpiFilterKey =
  | "nonCompliantAssets"
  | "nonCompliantServers"
  | "nonCompliantOs"
  | "nonCompliantEnvironments"
  | "p12Findings"
  | "highRiskP12Findings"
  | "outOfWarrantyAssets"
  | "nonCompliantDiscoveryCoverage";
type DiscoveryToolFilterKey = "ucmdb" | "tanium" | "tenable" | "servicenow";

type NetworkDetailTab = "network-details" | "cyber-posture" | "discovery-compliance" | "compliance-overview";

const KPI_FILTER_LABELS: Record<KpiFilterKey, string> = {
  nonCompliantAssets: "Total Non-compliant Assets",
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

function isDiscoveryToolFilterKey(value: string | undefined): value is DiscoveryToolFilterKey {
  if (!value) {
    return false;
  }
  return value === "ucmdb" || value === "tanium" || value === "tenable" || value === "servicenow";
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
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

function buildNetworkDetailWeeklyRiskTrend(
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

interface NetworkKpiSnapshotMetrics {
  nonCompliantAssets: number;
  nonCompliantServers: number;
  nonCompliantOs: number;
  nonCompliantEnvironments: number;
  p12Findings: number;
  highRiskP12Findings: number;
  outOfWarrantyAssets: number;
  nonCompliantDiscoveryCoverage: number;
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

  return {
    ucmdb,
    tanium,
    tenable,
    snow,
    seviceNow,
    coverageCompliance: coverage.coverageCompliance
  };
}

function buildNetworkKpiSnapshotMetrics(
  snapshot: Dataset,
  networkId: string,
  measuresSettings: MeasuresSettings,
  discoveryToolsSettings: DiscoveryToolsSettings
): NetworkKpiSnapshotMetrics {
  const analytics = buildAnalytics(
    snapshot,
    snapshot.ictSystems,
    { managedNetwork: networkId },
    measuresSettings,
    discoveryToolsSettings
  );
  const assets = snapshot.assets.filter((asset) => asset.networkId === networkId);
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const p12Findings = analytics.findings.filter((finding) => finding.priorityRank <= 2);

  const nonCompliantAssets = assets.filter((asset) => {
    const evaluation = evaluationByAssetId.get(asset.id);
    if (!evaluation) {
      return false;
    }
    return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
  }).length;

  const nonCompliantServers = assets.filter((asset) => {
    if (asset.type !== "server") {
      return false;
    }
    const evaluation = evaluationByAssetId.get(asset.id);
    if (!evaluation) {
      return false;
    }
    return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
  }).length;

  const nonCompliantOs = assets.filter((asset) => {
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

  const nonCompliantEnvironments = (["Production", "Development", "UAT", "Test"] as const).filter(
    (environmentType) => {
      const statuses = analytics.evaluations
        .filter((evaluation) => evaluation.environmentType === environmentType)
        .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
      return overallStatusFromStatuses(statuses) === "Non-compliant";
    }
  ).length;

  const highRiskP12Findings = p12Findings.filter((finding) => finding.severity === "High Risk").length;
  const outOfWarrantyAssets = assets.filter((asset) => asset.lifecycle.warrantyStatus === "OutOfWarranty").length;
  const nonCompliantDiscoveryCoverage = assets.filter(
    (asset) => !discoveryCoverageForAsset(asset, discoveryToolsSettings).coverageCompliance
  ).length;

  return {
    nonCompliantAssets,
    nonCompliantServers,
    nonCompliantOs,
    nonCompliantEnvironments,
    p12Findings: p12Findings.length,
    highRiskP12Findings,
    outOfWarrantyAssets,
    nonCompliantDiscoveryCoverage
  };
}

export default async function NetworkDetailPage({
  params,
  searchParams
}: {
  params: { networkId: string };
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
  const network = dataset.managedNetworks.find((item) => item.id === params.networkId);

  if (!network) {
    notFound();
  }

  const analytics = buildAnalytics(
    dataset,
    dataset.ictSystems,
    { managedNetwork: network.id },
    measuresSettings,
    discoveryToolsSettings
  );
  const topologyData = buildNetworkTopologyData(dataset, analytics, network.id, network.name);
  const assets = dataset.assets.filter((asset) => asset.networkId === network.id);
  const findings = analytics.findings;
  const p12Findings = findings.filter((finding) => finding.priorityRank <= 2);
  const requestedKpiFilter = firstParam(requestParams.kpiFilter);
  const selectedKpiFilter = isKpiFilterKey(requestedKpiFilter) ? requestedKpiFilter : undefined;
  const requestedDetailTab = firstParam(requestParams.networkDetailTab)?.trim().toLowerCase();
  const activeDetailTab: NetworkDetailTab =
    requestedDetailTab === "discovery-compliance"
      ? "discovery-compliance"
      : requestedDetailTab === "compliance-overview"
        ? "compliance-overview"
        : requestedDetailTab === "cyber-posture"
          ? "cyber-posture"
          : "network-details";
  const requestedP12Spi = Number(firstParam(requestParams.p12Spi));
  const selectedP12Spi =
    Number.isInteger(requestedP12Spi) && requestedP12Spi >= 1 && requestedP12Spi <= 10 ? requestedP12Spi : undefined;
  const requestedP12Priority = Number(firstParam(requestParams.p12Priority));
  const selectedP12Priority =
    Number.isInteger(requestedP12Priority) && requestedP12Priority >= 1 ? requestedP12Priority : undefined;
  const selectedP12Severity = firstParam(requestParams.p12Severity)?.trim() || undefined;
  const selectedP12SearchTerm = firstParam(requestParams.p12Search)?.trim() ?? "";
  const normalizedP12SearchTerm = selectedP12SearchTerm.toLowerCase();
  const selectedDiscoverySearchTerm = firstParam(requestParams.discoverySearch)?.trim() ?? "";
  const normalizedDiscoverySearchTerm = selectedDiscoverySearchTerm.toLowerCase();
  const selectedDiscoveryAssetType = firstParam(requestParams.discoveryAssetType)?.trim() ?? "";
  const requestedDiscoveryToolFilter = firstParam(requestParams.discoveryToolFilter)?.trim().toLowerCase();
  const selectedDiscoveryToolFilter = isDiscoveryToolFilterKey(requestedDiscoveryToolFilter)
    ? requestedDiscoveryToolFilter
    : undefined;
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const p12AssetIds = new Set(p12Findings.map((finding) => finding.scope.assetId));
  const highRiskP12AssetIds = new Set(
    p12Findings.filter((finding) => finding.severity === "High Risk").map((finding) => finding.scope.assetId)
  );
  const nonCompliantEnvironmentTypes = new Set(
    (["Production", "Development", "UAT", "Test"] as const).filter((environmentType) => {
      const statuses = analytics.evaluations
        .filter((evaluation) => evaluation.environmentType === environmentType)
        .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
      return overallStatusFromStatuses(statuses) === "Non-compliant";
    })
  );

  const matchesSelectedKpiFilter = (asset: (typeof assets)[number]): boolean => {
    if (!selectedKpiFilter) {
      return true;
    }
    if (selectedKpiFilter === "nonCompliantAssets") {
      const evaluation = evaluationByAssetId.get(asset.id);
      if (!evaluation) {
        return false;
      }
      return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
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
      return p12AssetIds.has(asset.id);
    }
    if (selectedKpiFilter === "highRiskP12Findings") {
      return highRiskP12AssetIds.has(asset.id);
    }
    if (selectedKpiFilter === "outOfWarrantyAssets") {
      return asset.lifecycle.warrantyStatus === "OutOfWarranty";
    }
    if (selectedKpiFilter === "nonCompliantDiscoveryCoverage") {
      return !discoveryCoverageForAsset(asset, discoveryToolsSettings).coverageCompliance;
    }
    return true;
  };

  const filteredAssets = selectedKpiFilter ? assets.filter((asset) => matchesSelectedKpiFilter(asset)) : assets;
  const filteredAssetIds = new Set(filteredAssets.map((asset) => asset.id));
  const coveragePageState = parsePageState(requestParams, "page", "pageSize");
  const inventoryPageState = parsePageState(requestParams, "inventoryPage", "inventoryPageSize");
  const filteredFindings = findings.filter((finding) => filteredAssetIds.has(finding.scope.assetId));
  const networkScopedFindings = findings;
  const openNetworkScopedFindings = networkScopedFindings.filter((finding) => finding.status === "open");
  const riskSeverityOrder: FindingSeverity[] = ["Critical Exposure", "High Risk", "Major", "Moderate", "Data Gap"];
  const riskSeverityCounts = openNetworkScopedFindings.reduce<Map<FindingSeverity, number>>((accumulator, finding) => {
    accumulator.set(finding.severity, (accumulator.get(finding.severity) ?? 0) + 1);
    return accumulator;
  }, new Map());
  const riskSeveritySummary = riskSeverityOrder.map((severity) => ({
    severity,
    count: riskSeverityCounts.get(severity) ?? 0
  }));
  const networkDetailWeeklyRiskTrend = buildNetworkDetailWeeklyRiskTrend(
    networkScopedFindings,
    requestedDataDate ?? todayDateKey(),
    dataset.snapshotDate,
    13
  );
  const filteredP12Findings = filteredFindings.filter((finding) => finding.priorityRank <= 2);
  const p12SpiOptions = Array.from(new Set(filteredP12Findings.map((finding) => finding.spiId))).sort((a, b) => a - b);
  const p12PriorityOptions = Array.from(new Set(filteredP12Findings.map((finding) => finding.priorityRank))).sort(
    (a, b) => a - b
  );
  const p12SeverityOptions = Array.from(new Set(filteredP12Findings.map((finding) => finding.severity)));
  const p12SectionFindings = filteredP12Findings.filter((finding) => {
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
    return query ? `/networks/${network.id}?${query}#p12-findings` : `/networks/${network.id}#p12-findings`;
  })();
  const preservedDiscoveryParams = Object.entries(requestParams).flatMap(([key, value]) => {
    if (key === "discoverySearch" || key === "discoveryAssetType" || key === "discoveryToolFilter" || key === "page") {
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
  const clearDiscoveryFiltersHref = (() => {
    const params = new URLSearchParams();
    for (const param of preservedDiscoveryParams) {
      params.set(param.key, param.value);
    }
    const query = params.toString();
    return query
      ? `/networks/${network.id}?${query}#asset-discovery-coverage`
      : `/networks/${network.id}#asset-discovery-coverage`;
  })();
  const discoveryCoverageExportHref = (() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(requestParams)) {
      if (key === "page") {
        continue;
      }
      if (!value) {
        continue;
      }
      if (Array.isArray(value)) {
        if (value.length) {
          params.set(key, value[0]);
        }
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    return query
      ? `/api/networks/${network.id}/discovery-coverage-export?${query}`
      : `/api/networks/${network.id}/discovery-coverage-export`;
  })();
  const p12CountByAsset = filteredP12Findings.reduce((map, finding) => {
    map.set(finding.scope.assetId, (map.get(finding.scope.assetId) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  const filteredEvaluations = analytics.evaluations.filter((evaluation) => filteredAssetIds.has(evaluation.assetId));
  const statuses = filteredEvaluations.flatMap((evaluation) => evaluation.evaluations.map((item) => item.status));
  const evaluationComplianceSummaryCounts = statuses.reduce(
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
  const networkComplianceScore = complianceScore(statuses);
  const selectedPosture = overallStatusFromStatuses(statuses);

  const scopedEvaluationRows = filteredEvaluations.flatMap((evaluation) =>
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

  const filteredAssetsById = new Map(filteredAssets.map((asset) => [asset.id, asset]));
  const systemOwnerById = new Map(
    dataset.ictSystems.map((system) => [system.id, system.owner?.trim() ?? ""])
  );
  const networkOwnerFallback = network.owner?.trim() || "Not assigned";

  const latestFindingByAssetAndSpi = filteredFindings.reduce((map, finding) => {
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
        asset?.systemContext?.systemId ? `System ${asset.systemContext.systemId}` : "System n/a",
        asset?.systemContext?.environmentType ? `Env ${asset.systemContext.environmentType}` : "Env n/a"
      ].join(" | ");
      const assetName =
        (latestFinding
          ? readEvidenceStringValue(latestFinding.evidence, ["assetName", "asset_name"])
          : null) ??
        asset?.name ??
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
          : null) ??
        (asset?.systemContext?.systemId
          ? systemOwnerById.get(asset.systemContext.systemId)?.trim() || networkOwnerFallback
          : networkOwnerFallback);

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

  const metricsBySnapshotDate = new Map<string, NetworkKpiSnapshotMetrics>();
  const snapshotMetrics = (snapshot: Dataset) => {
    const cached = metricsBySnapshotDate.get(snapshot.snapshotDate);
    if (cached) {
      return cached;
    }
    const computed = buildNetworkKpiSnapshotMetrics(snapshot, network.id, measuresSettings, discoveryToolsSettings);
    metricsBySnapshotDate.set(snapshot.snapshotDate, computed);
    return computed;
  };

  const currentKpis = snapshotMetrics(dataset);
  const nonCompliantAssetCount = currentKpis.nonCompliantAssets;
  const nonCompliantOsCount = currentKpis.nonCompliantOs;
  const p12FindingsCount = currentKpis.p12Findings;
  const highRiskP12Count = currentKpis.highRiskP12Findings;
  const outOfWarrantyAssetCount = currentKpis.outOfWarrantyAssets;
  const nonCompliantDiscoveryCoverageCount = currentKpis.nonCompliantDiscoveryCoverage;
  const assetTypeSummary = {
    totalAssets: filteredAssets.length,
    serverCount: filteredAssets.filter((asset) => asset.type === "server").length,
    workstationCount: filteredAssets.filter((asset) => asset.type === "workstation").length,
    networkDeviceCount: filteredAssets.filter((asset) => asset.type === "network-device").length
  };

  const snapshotByDate = new Map<string, Dataset>();
  for (const snapshot of snapshots) {
    snapshotByDate.set(snapshot.snapshotDate, snapshot);
  }
  snapshotByDate.set(dataset.snapshotDate, dataset);

  const last12Snapshots = Array.from(snapshotByDate.values())
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
    .slice(-12);

  const kpiTrendSeries = last12Snapshots.map((snapshot, index) => {
    const metrics = snapshotMetrics(snapshot);
    return {
      weekLabel: `W${String(last12Snapshots.length - index).padStart(2, "0")}`,
      ...metrics
    };
  });

  const trendPointsFor = (key: keyof NetworkKpiSnapshotMetrics) =>
    kpiTrendSeries.map((point) => ({
      label: point.weekLabel,
      value: point[key]
    }));

  const nonCompliantAssetsTrend = trendPointsFor("nonCompliantAssets");
  const nonCompliantOsTrend = trendPointsFor("nonCompliantOs");
  const p12FindingsTrend = trendPointsFor("p12Findings");
  const highRiskP12Trend = trendPointsFor("highRiskP12Findings");
  const outOfWarrantyTrend = trendPointsFor("outOfWarrantyAssets");
  const nonCompliantDiscoveryCoverageTrend = trendPointsFor("nonCompliantDiscoveryCoverage");

  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];

  const latestAssetMap = new Map(latest.assets.map((asset) => [asset.id, asset]));
  const previousAssetMap = new Map(previous.assets.map((asset) => [asset.id, asset]));

  const changedAssets = filteredAssets.filter((asset) => {
    const before = previousAssetMap.get(asset.id);
    const after = latestAssetMap.get(asset.id);
    if (!before || !after) {
      return true;
    }
    const beforeCritical = before.vulnerabilities.filter((v) => v.severity === "Critical").length;
    const afterCritical = after.vulnerabilities.filter((v) => v.severity === "Critical").length;
    return beforeCritical !== afterCritical;
  });
  const discoveryCoverageRows = filteredAssets
    .map((asset) => {
      const coverage = discoveryCoverageForAsset(asset, discoveryToolsSettings);
      return {
        assetId: asset.id,
        hostname: asset.hostname,
        assetIpAddress: resolveAssetIpAddress(asset),
        assetType: asset.type,
        environment: asset.systemContext?.environmentType ?? "-",
        ictSystem: asset.systemContext?.systemId ?? "-",
        ucmdb: coverage.ucmdb,
        tanium: coverage.tanium,
        tenable: coverage.tenable,
        seviceNow: coverage.seviceNow,
        coverageCompliance: coverage.coverageCompliance
      };
    })
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
  const discoveryAssetTypeOptions = Array.from(new Set(discoveryCoverageRows.map((row) => row.assetType))).sort((a, b) =>
    a.localeCompare(b)
  );
  const discoveryCoverageFilteredRows = discoveryCoverageRows.filter((row) => {
    if (selectedDiscoveryAssetType && row.assetType !== selectedDiscoveryAssetType) {
      return false;
    }
    if (selectedDiscoveryToolFilter) {
      const hasCoverageForSelectedTool =
        selectedDiscoveryToolFilter === "ucmdb"
          ? row.ucmdb === 1
          : selectedDiscoveryToolFilter === "tanium"
            ? row.tanium === 1
            : selectedDiscoveryToolFilter === "tenable"
              ? row.tenable === 1
              : row.seviceNow === 1;
      if (hasCoverageForSelectedTool) {
        return false;
      }
    }
    if (!normalizedDiscoverySearchTerm) {
      return true;
    }
    const text = [row.assetId, row.hostname, row.assetIpAddress, row.assetType, row.environment, row.ictSystem]
      .join(" ")
      .toLowerCase();
    return text.includes(normalizedDiscoverySearchTerm);
  });
  const discoveryCoverageTotal = discoveryCoverageRows.length;
  const discoveryToolCoverageCharts = [
    {
      id: "ucmdb",
      label: "UCMDB",
      covered: discoveryCoverageRows.filter((row) => row.ucmdb === 1).length
    },
    {
      id: "tanium",
      label: "TANIUM",
      covered: discoveryCoverageRows.filter((row) => row.tanium === 1).length
    },
    {
      id: "tenable",
      label: "TENABLE",
      covered: discoveryCoverageRows.filter((row) => row.tenable === 1).length
    },
    {
      id: "servicenow",
      label: "SERVICENOW",
      covered: discoveryCoverageRows.filter((row) => row.seviceNow === 1).length
    }
  ].map((tool) => {
    const coveragePercent = discoveryCoverageTotal
      ? Number(((tool.covered / discoveryCoverageTotal) * 100).toFixed(1))
      : 0;
    const coveredStop = (coveragePercent / 100) * 360;
    return {
      ...tool,
      missing: Math.max(0, discoveryCoverageTotal - tool.covered),
      coveragePercent,
      chartBackground: discoveryCoverageTotal
        ? `conic-gradient(rgba(52,211,153,0.95) 0deg ${coveredStop}deg, rgba(248,113,113,0.95) ${coveredStop}deg 360deg)`
        : "conic-gradient(rgba(148,163,184,0.92) 0deg 360deg)"
    };
  });
  const coverageRowsPage = paginate(discoveryCoverageFilteredRows, coveragePageState.page, coveragePageState.pageSize);
  const inventoryRowsPage = paginate(filteredAssets, inventoryPageState.page, inventoryPageState.pageSize);

  const scopedPageHref = (updates: Record<string, string | undefined>, hash?: string) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(requestParams)) {
      if (!value) {
        continue;
      }
      query.set(key, Array.isArray(value) ? value[0] : value);
    }
    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        query.delete(key);
      } else {
        query.set(key, value);
      }
    }
    const params = query.toString();
    const href = params ? `/networks/${network.id}?${params}` : `/networks/${network.id}`;
    return hash ? `${href}#${hash}` : href;
  };

  const kpiFilterHref = (kpiFilter?: KpiFilterKey) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(requestParams)) {
      if (!value || key === "kpiFilter") {
        continue;
      }
      query.set(key, Array.isArray(value) ? value[0] : value);
    }
    if (kpiFilter) {
      query.set("kpiFilter", kpiFilter);
    }
    const params = query.toString();
    return params ? `/networks/${network.id}?${params}` : `/networks/${network.id}`;
  };

  const networkDetailFields = resolveNetworkDetailFields(network);
  const headerComplianceCounts =
    activeDetailTab === "compliance-overview"
      ? complianceOverviewSummaryCounts
      : evaluationComplianceSummaryCounts;
  const headerComplianceScore =
    activeDetailTab === "compliance-overview" ? complianceOverviewScore : networkComplianceScore;
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
  const routeReadyLocationKey = buildLocationKeyFromParamsRecord(`/networks/${network.id}`, requestParams);

  return (
    <div
      className="relative left-1/2 -my-5 flex h-[calc(100vh-11rem)] w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden md:-my-8 md:h-[calc(100vh-12rem)] md:w-[min(2100px,calc(100vw-3rem))]"
      data-route-ready-key={encodeLocationKeyForAttribute(routeReadyLocationKey)}
    >
      <section className="panel shrink-0 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <DrillthroughBackLink
              href={withDataDate("/networks?networksTab=posture", requestedDataDate)}
              className="text-xs text-sky-200 underline"
              loadingLabel="Returning to Networks..."
            >
              Back to Networks
            </DrillthroughBackLink>
            <h1 className="mt-2 text-3xl font-semibold text-slate-100">{network.name}</h1>
            <div className="mt-3 flex flex-wrap gap-3">
              <PostureBadge status={selectedPosture} />
              <span className="rounded-full border border-sky-400/25 px-3 py-1 text-xs text-slate-200">
                Classification: {network.classification}
              </span>
              <span className="rounded-full border border-sky-400/25 px-3 py-1 text-xs text-slate-200">
                Assets: {filteredAssets.length}
              </span>
            </div>
          </div>

          <div className="grid min-w-[250px] gap-3 self-stretch md:grid-cols-2 lg:self-auto">
            <div className="panel-alt border-sky-300/25 p-4">
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Compliance Score</p>
                <div
                  className="mx-auto mt-3 flex h-28 w-28 items-center justify-center rounded-full border border-sky-200/45"
                  style={{
                    background: complianceChartBackground
                  }}
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-950/95">
                    <span className="text-2xl font-semibold text-emerald-100">{headerComplianceScore}%</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-300/80">
                  {selectedKpiFilter ? "Network scope with KPI filter" : "Network scope"}
                </p>
                {selectedKpiFilter ? (
                  <p className="mt-1 text-[11px] text-sky-200/90">{KPI_FILTER_LABELS[selectedKpiFilter]}</p>
                ) : activeDetailTab === "compliance-overview" ? (
                  <p className="mt-1 text-[11px] text-sky-200/90">Aligned to Compliance Overview (open findings)</p>
                ) : (
                  <p className="mt-1 text-[11px] text-sky-200/90">Aligned to current drill-through context</p>
                )}
              </div>
            </div>
            <div className="panel-alt border-sky-300/25 p-4">
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Discovery Compliance Score</p>
                <div
                  className="mx-auto mt-3 flex h-28 w-28 items-center justify-center rounded-full border border-sky-200/45"
                  style={{
                    background: discoveryComplianceChartBackground
                  }}
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

      <NetworkDetailTabs activeTab={activeDetailTab} topologyData={topologyData} />

      <div
        className={
          activeDetailTab === "compliance-overview" ||
          activeDetailTab === "network-details" ||
          activeDetailTab === "discovery-compliance"
            ? "min-h-0 flex-1 overflow-hidden pr-1"
            : "min-h-0 flex-1 space-y-4 overflow-auto pr-1"
        }
      >
      {activeDetailTab === "network-details" ? (
      <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
        <section className="panel flex min-h-0 flex-col overflow-hidden p-2.5">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Network Details</h2>
          <div className="mt-2 min-h-0 overflow-auto pr-1">
            <div className="grid gap-1.5 xl:grid-cols-2">
              <article className="rounded-xl border border-sky-300/35 bg-slate-950/55 p-2.5 xl:row-span-2">
                <h3 className="text-base font-medium text-slate-100">Description</h3>
                <p className="mt-2 text-sm leading-5 text-slate-200/90">{networkDetailFields.description}</p>
              </article>

              <article className="rounded-xl border border-sky-300/35 bg-slate-950/55 p-2.5">
                <dl className="space-y-3.5">
                  <div>
                    <dt className="text-base font-medium text-slate-100">Owner:</dt>
                    <dd className="mt-0.5 text-sm text-slate-200">{networkDetailFields.owner}</dd>
                  </div>
                  <div>
                    <dt className="text-base font-medium text-slate-100">Support Email:</dt>
                    <dd className="mt-0.5 text-sm text-sky-100">
                      <a
                        className="underline decoration-sky-300/60 underline-offset-2"
                        href={`mailto:${networkDetailFields.supportEmail}`}
                      >
                        {networkDetailFields.supportEmail}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-base font-medium text-slate-100">Service Catalogue Item:</dt>
                    <dd className="mt-0.5 text-sm text-sky-100">
                      <ul className="list-disc space-y-0.5 pl-5">
                        <li>
                          <Link
                            href={networkDetailFields.serviceCatalogueUrl}
                            className="underline decoration-sky-300/60 underline-offset-2"
                            target={isExternalLink(networkDetailFields.serviceCatalogueUrl) ? "_blank" : undefined}
                            rel={isExternalLink(networkDetailFields.serviceCatalogueUrl) ? "noreferrer" : undefined}
                          >
                            Support Request
                          </Link>
                        </li>
                        <li>
                          <Link
                            href={networkDetailFields.serviceCatalogueUrl}
                            className="underline decoration-sky-300/60 underline-offset-2"
                            target={isExternalLink(networkDetailFields.serviceCatalogueUrl) ? "_blank" : undefined}
                            rel={isExternalLink(networkDetailFields.serviceCatalogueUrl) ? "noreferrer" : undefined}
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
                        <th className="px-2 py-1.5">Links</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-sky-300/30 text-slate-100">
                        <td className="px-2 py-2 font-semibold text-slate-100">{networkDetailFields.atoNumber}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-3 text-sky-100">
                            <Link
                              href={networkDetailFields.diisUrl}
                              className="underline decoration-sky-300/70 underline-offset-2"
                              target={isExternalLink(networkDetailFields.diisUrl) ? "_blank" : undefined}
                              rel={isExternalLink(networkDetailFields.diisUrl) ? "noreferrer" : undefined}
                            >
                              View in DIIS
                            </Link>
                            <Link
                              href={networkDetailFields.grcUrl}
                              className="underline decoration-sky-300/70 underline-offset-2"
                              target={isExternalLink(networkDetailFields.grcUrl) ? "_blank" : undefined}
                              rel={isExternalLink(networkDetailFields.grcUrl) ? "noreferrer" : undefined}
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
            </div>
          </div>
        </section>

        <section className="panel min-h-0 overflow-hidden p-2.5">
          <NetworkDetailRiskCharts
            layout="stacked"
            riskProfile={{
              openFindings: openNetworkScopedFindings.length,
              p1p2Count: openNetworkScopedFindings.filter((finding) => finding.priorityRank <= 2).length,
              highRiskOpenCount: riskSeverityCounts.get("High Risk") ?? 0,
              criticalExposureOpenCount: riskSeverityCounts.get("Critical Exposure") ?? 0,
              severitySummary: riskSeveritySummary,
              weeklyTrend: networkDetailWeeklyRiskTrend
            }}
          />
        </section>
      </div>
      ) : null}

      {activeDetailTab === "compliance-overview" ? (
      <NetworkComplianceOverview
        networkName={network.name}
        asOfDate={requestedDataDate ?? todayDateKey()}
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

      {activeDetailTab === "cyber-posture" ? (
      <section className="panel p-4">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">KPI Snapshot</h2>
        <p className="mt-1 text-xs text-slate-300/80">
          Calculated for network scope. Select a tile to filter the whole page. Charts show the last 12
          weeks.
        </p>
        {selectedKpiFilter ? (
          <p className="mt-2 text-xs text-amber-100/90">
            Active KPI filter: {KPI_FILTER_LABELS[selectedKpiFilter]}{" "}
            <Link
              href={kpiFilterHref()}
              scroll={false}
              data-filter-loading="true"
              data-filter-loading-message="Applying KPI filter..."
              className="underline text-sky-200"
            >
              Clear KPI filter
            </Link>
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Link
            href={selectedKpiFilter === "nonCompliantAssets" ? kpiFilterHref() : kpiFilterHref("nonCompliantAssets")}
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-red-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "nonCompliantAssets" ? "ring-2 ring-red-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Total Non-compliant Assets</p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{nonCompliantAssetCount}</p>
            <MiniTrendSparkline points={nonCompliantAssetsTrend} stroke="#ef4444" />
          </Link>
          <Link
            href={selectedKpiFilter === "nonCompliantOs" ? kpiFilterHref() : kpiFilterHref("nonCompliantOs")}
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-amber-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "nonCompliantOs" ? "ring-2 ring-amber-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Total Non-compliant OS</p>
            <p className="mt-1 text-2xl font-semibold text-amber-100">{nonCompliantOsCount}</p>
            <MiniTrendSparkline points={nonCompliantOsTrend} stroke="#f59e0b" />
          </Link>
          <Link
            href={selectedKpiFilter === "p12Findings" ? kpiFilterHref() : kpiFilterHref("p12Findings")}
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-red-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "p12Findings" ? "ring-2 ring-red-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Total P1-P2 Findings</p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{p12FindingsCount}</p>
            <MiniTrendSparkline points={p12FindingsTrend} stroke="#f97316" />
          </Link>
          <Link
            href={
              selectedKpiFilter === "highRiskP12Findings"
                ? kpiFilterHref()
                : kpiFilterHref("highRiskP12Findings")
            }
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-red-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "highRiskP12Findings" ? "ring-2 ring-red-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Total P1-P2 High Risk Findings
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{highRiskP12Count}</p>
            <MiniTrendSparkline points={highRiskP12Trend} stroke="#ef4444" />
          </Link>
          <Link
            href={selectedKpiFilter === "outOfWarrantyAssets" ? kpiFilterHref() : kpiFilterHref("outOfWarrantyAssets")}
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-amber-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "outOfWarrantyAssets" ? "ring-2 ring-amber-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Total Physical Assets Out of Warranty
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-100">{outOfWarrantyAssetCount}</p>
            <MiniTrendSparkline points={outOfWarrantyTrend} stroke="#f59e0b" />
          </Link>
          <Link
            href={
              selectedKpiFilter === "nonCompliantDiscoveryCoverage"
                ? kpiFilterHref()
                : kpiFilterHref("nonCompliantDiscoveryCoverage")
            }
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-red-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "nonCompliantDiscoveryCoverage" ? "ring-2 ring-red-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Assets non-compliant with discovery coverage
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{nonCompliantDiscoveryCoverageCount}</p>
            <MiniTrendSparkline points={nonCompliantDiscoveryCoverageTrend} stroke="#dc2626" />
          </Link>
        </div>
      </section>
      ) : null}

      {activeDetailTab === "discovery-compliance" ? (
      <Suspense
        fallback={
          <section className="panel p-4">
            <p className="text-sm text-slate-300/80">Loading discovery coverage table...</p>
          </section>
        }
      >
        <ServerStreamHint />
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
          <section className="panel p-4">
            <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Discovery Tool Coverage</h2>
            <p className="mt-1 text-xs text-slate-300/80">
              Coverage score by discovery tool across current network scope.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {discoveryToolCoverageCharts.map((tool) => {
                const isToolFilterActive = selectedDiscoveryToolFilter === tool.id;
                const toolFilterHref = scopedPageHref(
                  {
                    discoveryToolFilter: isToolFilterActive ? undefined : tool.id,
                    page: undefined
                  },
                  "asset-discovery-coverage"
                );

                return (
                  <Link
                    key={tool.id}
                    href={toolFilterHref}
                    scroll={false}
                    data-filter-loading="true"
                    data-filter-loading-message="Applying discovery filters..."
                    className={`panel-alt border-sky-300/25 p-3 transition hover:bg-slate-900/70 ${
                      isToolFilterActive ? "ring-2 ring-red-300/65" : ""
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">{tool.label}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div
                        className="flex h-20 w-20 items-center justify-center rounded-full border border-sky-200/45"
                        style={{
                          background: tool.chartBackground
                        }}
                      >
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950/95">
                          <span className="text-sm font-semibold text-emerald-100">{tool.coveragePercent}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-100">
                          {tool.covered}/{discoveryCoverageTotal} covered
                        </p>
                        <p className="mt-1 text-xs text-red-100/90">{tool.missing} non-compliant</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-sky-200/85">
                      {isToolFilterActive ? "Showing non-compliant assets for this tool" : "Select to filter non-compliant assets"}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          <section id="asset-discovery-coverage" className="panel flex min-h-0 flex-col overflow-hidden">
            <h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
              Asset Discovery Coverage (Network Scope)
            </h2>
            <div className="border-b border-sky-400/10 px-4 py-3">
              <form
                action={`/networks/${network.id}#asset-discovery-coverage`}
                method="get"
                data-filter-loading="true"
                data-filter-loading-message="Applying discovery filters..."
                className="flex flex-wrap items-end gap-3 xl:flex-nowrap"
              >
                {preservedDiscoveryParams.map((param) => (
                  <input key={param.key} type="hidden" name={param.key} value={param.value} />
                ))}
                {selectedDiscoveryToolFilter ? (
                  <input type="hidden" name="discoveryToolFilter" value={selectedDiscoveryToolFilter} />
                ) : null}
                <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                  <label htmlFor="discovery-search" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
                    Search
                  </label>
                  <input
                    id="discovery-search"
                    name="discoverySearch"
                    type="search"
                    defaultValue={selectedDiscoverySearchTerm}
                    placeholder="Search asset, id, type, environment..."
                    className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
                  />
                </div>
                <div className="flex min-w-[170px] flex-col gap-1">
                  <label htmlFor="discovery-asset-type" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
                    Asset Type
                  </label>
                  <select
                    id="discovery-asset-type"
                    name="discoveryAssetType"
                    defaultValue={selectedDiscoveryAssetType}
                    className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="">All Asset Types</option>
                    {discoveryAssetTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="shrink-0 rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100"
                >
                  Apply
                </button>
                {selectedDiscoverySearchTerm || selectedDiscoveryAssetType || selectedDiscoveryToolFilter ? (
                  <Link
                    href={clearDiscoveryFiltersHref}
                    scroll={false}
                    data-filter-loading="true"
                    data-filter-loading-message="Applying discovery filters..."
                    className="shrink-0 rounded-md border border-slate-500/40 px-3 py-2 text-xs font-semibold text-slate-200"
                  >
                    Clear
                  </Link>
                ) : null}
                <Link
                  href={discoveryCoverageExportHref}
                  className="shrink-0 rounded-md border border-emerald-300/45 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:border-emerald-200/70"
                >
                  Export to CSV
                </Link>
              </form>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                  <tr>
                    <th className="px-3 py-2">Asset</th>
                    <th className="px-3 py-2">IP Address</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Environment</th>
                    <th className="px-3 py-2">ICT System</th>
                    <th className="px-3 py-2">UCMDB</th>
                    <th className="px-3 py-2">Tanium</th>
                    <th className="px-3 py-2">Tenable</th>
                    <th className="px-3 py-2">SeviceNow</th>
                    <th className="px-3 py-2">Coverage Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageRowsPage.items.map((row) => (
                    <tr key={row.assetId} className="border-t border-sky-400/10">
                      <td className="px-3 py-2 text-slate-100">{row.hostname}</td>
                      <td className="px-3 py-2 text-slate-300">{row.assetIpAddress}</td>
                      <td className="px-3 py-2 text-slate-300">{row.assetType}</td>
                      <td className="px-3 py-2 text-slate-300">{row.environment}</td>
                      <td className="px-3 py-2 text-slate-300">{row.ictSystem}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            row.ucmdb === 1
                              ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                              : "border-red-400/45 bg-red-500/15 text-red-100"
                          }`}
                        >
                          {row.ucmdb}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            row.tanium === 1
                              ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                              : "border-red-400/45 bg-red-500/15 text-red-100"
                          }`}
                        >
                          {row.tanium}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            row.tenable === 1
                              ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                              : "border-red-400/45 bg-red-500/15 text-red-100"
                          }`}
                        >
                          {row.tenable}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            row.seviceNow === 1
                              ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                              : "border-red-400/45 bg-red-500/15 text-red-100"
                          }`}
                        >
                          {row.seviceNow}
                        </span>
                      </td>
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
                      <td colSpan={10} className="px-3 py-6 text-center text-sm text-slate-300/80">
                        No assets match the selected discovery filters.
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
                      href={scopedPageHref({ page: String(coverageRowsPage.currentPage - 1) }, "asset-discovery-coverage")}
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
                      href={scopedPageHref({ page: String(coverageRowsPage.currentPage + 1) }, "asset-discovery-coverage")}
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
      </Suspense>
      ) : null}

      {activeDetailTab === "cyber-posture" ? (
      <Suspense
        fallback={
          <section className="panel p-4">
            <p className="text-sm text-slate-300/80">Loading asset inventory...</p>
          </section>
        }
      >
        <ServerStreamHint />
        <section id="asset-inventory" className="panel overflow-hidden">
        <h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
          Asset Inventory
        </h2>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">System</th>
                <th className="px-3 py-2">Env</th>
                <th className="px-3 py-2">Critical Vulns</th>
                <th className="px-3 py-2">P1-2 Findings</th>
              </tr>
            </thead>
            <tbody>
              {inventoryRowsPage.items.map((asset) => (
                <tr key={asset.id} className="border-t border-sky-400/10">
                  <td className="px-3 py-2 text-slate-100">{asset.hostname}</td>
                  <td className="px-3 py-2 text-slate-300">{asset.type}</td>
                  <td className="px-3 py-2 text-slate-300">{asset.systemContext?.systemId ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-300">{asset.systemContext?.environmentType ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-200">
                    {asset.vulnerabilities.filter((v) => v.severity === "Critical").length}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        (p12CountByAsset.get(asset.id) ?? 0) > 0
                          ? "border-red-400/45 bg-red-500/15 text-red-100"
                          : "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                      }`}
                    >
                      {p12CountByAsset.get(asset.id) ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
              {inventoryRowsPage.totalItems === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-300/80">
                    No assets in this scope.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {inventoryRowsPage.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-400/10 px-4 py-3 text-xs text-slate-300/85">
            <p>
              Showing {(inventoryRowsPage.currentPage - 1) * inventoryRowsPage.pageSize + 1}-
              {Math.min(inventoryRowsPage.currentPage * inventoryRowsPage.pageSize, inventoryRowsPage.totalItems)} of{" "}
              {inventoryRowsPage.totalItems}
            </p>
            <div className="flex items-center gap-2">
              {inventoryRowsPage.currentPage > 1 ? (
                <a
                  href={scopedPageHref(
                    { inventoryPage: String(inventoryRowsPage.currentPage - 1) },
                    "asset-inventory"
                  )}
                  data-filter-loading="true"
                  data-filter-loading-message="Loading inventory page..."
                  className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 hover:bg-slate-800/70"
                >
                  Previous
                </a>
              ) : (
                <span className="rounded-md border border-slate-700/70 px-3 py-1 text-slate-500">Previous</span>
              )}
              <span>
                Page {inventoryRowsPage.currentPage} of {inventoryRowsPage.totalPages}
              </span>
              {inventoryRowsPage.currentPage < inventoryRowsPage.totalPages ? (
                <a
                  href={scopedPageHref(
                    { inventoryPage: String(inventoryRowsPage.currentPage + 1) },
                    "asset-inventory"
                  )}
                  data-filter-loading="true"
                  data-filter-loading-message="Loading inventory page..."
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
      </Suspense>
      ) : null}

      {activeDetailTab === "cyber-posture" ? (
      <section id="p12-findings" className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-400/15 px-4 py-3">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">P1-2 Findings (All Environments)</h2>
        </div>
        <div className="border-b border-sky-400/10 px-4 py-3">
          <form
            action={`/networks/${network.id}#p12-findings`}
            method="get"
            data-filter-loading="true"
            data-filter-loading-message="Applying findings filters..."
            className="flex flex-wrap items-end gap-3 xl:flex-nowrap"
          >
            {preservedP12Params.map((param) => (
              <input key={param.key} type="hidden" name={param.key} value={param.value} />
            ))}
            <div className="flex min-w-[300px] flex-col gap-1">
              <label htmlFor="p12-findings-spi" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
                SPI
              </label>
              <select
                id="p12-findings-spi"
                name="p12Spi"
                defaultValue={selectedP12Spi ? String(selectedP12Spi) : ""}
                className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All SPI</option>
                {p12SpiOptions.map((option) => (
                  <option key={option} value={option}>
                    SPI {option} - {SPI_DESCRIPTIONS[option as keyof typeof SPI_DESCRIPTIONS]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[120px] flex-col gap-1">
              <label
                htmlFor="p12-findings-priority"
                className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70"
              >
                Priority
              </label>
              <select
                id="p12-findings-priority"
                name="p12Priority"
                defaultValue={selectedP12Priority ? String(selectedP12Priority) : ""}
                className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All Priorities</option>
                {p12PriorityOptions.map((option) => (
                  <option key={option} value={option}>
                    P{option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[160px] flex-col gap-1">
              <label
                htmlFor="p12-findings-severity"
                className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70"
              >
                Severity
              </label>
              <select
                id="p12-findings-severity"
                name="p12Severity"
                defaultValue={selectedP12Severity ?? ""}
                className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All Severities</option>
                {p12SeverityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[160px] flex-1 flex-col gap-1">
              <label htmlFor="p12-findings-search" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
                Text Search
              </label>
              <input
                id="p12-findings-search"
                name="p12Search"
                type="search"
                defaultValue={selectedP12SearchTerm}
                placeholder="Search title, scope, evidence, action..."
                className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100"
            >
              Apply
            </button>
            {selectedP12Spi || selectedP12Priority || selectedP12Severity || selectedP12SearchTerm ? (
              <Link
                href={clearP12FiltersHref}
                scroll={false}
                data-filter-loading="true"
                data-filter-loading-message="Applying findings filters..."
                className="shrink-0 rounded-md border border-slate-500/40 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </div>
        <div className="max-h-[420px] overflow-auto p-4">
          <ul className="space-y-2 text-sm">
            {p12SectionFindings.slice(0, 80).map((finding) => (
              <li key={finding.id} className="panel-alt p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">
                  P{finding.priorityRank} | SPI {finding.spiId} | {finding.severity}
                </p>
                <p className="mt-1 text-slate-100">{finding.title}</p>
                <p className="mt-1 text-xs text-slate-300/75">{finding.scope.assetId}</p>
              </li>
            ))}
            {p12SectionFindings.length === 0 ? (
              <li className="panel-alt p-3 text-sm text-emerald-200/90">
                No P1-2 findings match the selected SPI, Priority, Severity, and text search filters.
              </li>
            ) : null}
          </ul>
        </div>
      </section>
      ) : null}
      </div>
    </div>
  );
}
