import Link from "next/link";
import { notFound } from "next/navigation";
import { DrillthroughBackLink } from "@/components/drillthrough-back-link";
import { MiniTrendSparkline } from "@/components/mini-trend-sparkline";
import { NetworkComplianceOverview } from "@/components/network-compliance-overview";
import { NetworkDetailTabs } from "@/components/network-detail-tabs";
import { NetworkDetailRiskCharts } from "@/components/network-detail-risk-charts";
import { ServerStreamHint } from "@/components/server-stream-hint";
import {
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadLatestSnapshotsForDate,
  loadMeasuresSettings,
  loadSeverityDefinitions,
  loadSpiDefinitions
} from "@/lib/data-loader";
import { DiscoveryCoverageValue, evaluateDiscoveryCoverage } from "@/lib/discovery-coverage";
import { MeasuresSettings } from "@/lib/measures-settings";
import { buildAnalytics } from "@/lib/analytics";
import { buildCveVulnerabilityIndexByAssetId, buildHighRiskCveIndexByAssetId } from "@/lib/cve";
import { extractDataDateParam, todayDateKey, withDataDate } from "@/lib/data-date";
import { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { buildLocationKeyFromParamsRecord, encodeLocationKeyForAttribute } from "@/lib/location-key";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";
import { isUnassignedNetworkId } from "@/lib/network-scope";
import { buildNetworkTopologyData } from "@/lib/network-topology";
import { paginate, parsePageState } from "@/lib/pagination";
import {
  buildScopedDiscoveryToolCoverage,
  discoveryCoverageValueLabel
} from "@/lib/scoped-discovery-tool-coverage";
import { Asset, ComplianceStatus, Dataset, Finding, FindingSeverity } from "@/lib/types";
import { SpiDefinition } from "@/lib/spi-definitions";
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

function fallbackFindingSeverity(status: ComplianceStatus, spiId: number, spiDefinitions: SpiDefinition[]): FindingSeverity {
  if (status === "Unknown") {
    return "Data Gap";
  }
  return spiDefinitions.find((definition) => definition.spiId === spiId)?.defaultSeverity ?? "Moderate";
}

function fallbackPriorityRank(status: ComplianceStatus, spiId: number, spiDefinitions: SpiDefinition[]): number {
  if (status === "Unknown") {
    return 90;
  }
  return spiDefinitions.find((definition) => definition.spiId === spiId)?.priorityOrder ?? 99;
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

function segmentWidth(value: number, total: number): string {
  if (!total || value <= 0) {
    return "0%";
  }
  return `${Math.max((value / total) * 100, 2).toFixed(2)}%`;
}

function CompactScoreCard({
  title,
  score,
  total,
  segments,
  contextLabel
}: {
  title: string;
  score: number;
  total: number;
  contextLabel: string;
  segments: Array<{
    label: string;
    shortLabel: string;
    value: number;
    barClassName: string;
    chipClassName: string;
  }>;
}) {
  return (
    <article className="rounded-lg border border-sky-300/25 bg-slate-950/55 p-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300/75">{title}</p>
          <p className="mt-1 text-[11px] text-sky-200/75">{contextLabel}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-semibold leading-none text-emerald-100">{score}%</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-slate-400">{total} checks</p>
        </div>
      </div>

      <div
        className="mt-3 flex h-2.5 overflow-hidden rounded-full border border-sky-300/20 bg-slate-800/80"
        aria-label={`${title}: ${score}%`}
      >
        {total ? (
          segments.map((segment) =>
            segment.value > 0 ? (
              <div
                key={segment.label}
                className={segment.barClassName}
                style={{ width: segmentWidth(segment.value, total) }}
                title={`${segment.label}: ${segment.value}`}
              />
            ) : null
          )
        ) : (
          <div className="h-full w-full bg-slate-600/60" />
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={`rounded-md border px-2 py-1 text-[11px] leading-tight ${segment.chipClassName}`}
            title={segment.label}
          >
            <span className="font-semibold">{segment.shortLabel}</span>{" "}
            <span className="tabular-nums">{segment.value}</span>
          </div>
        ))}
      </div>
    </article>
  );
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

function discoveryCoverageForAsset(asset: Asset, discoveryToolsSettings: DiscoveryToolsSettings) {
  const coverage = evaluateDiscoveryCoverage(asset, discoveryToolsSettings);

  return {
    coverageCompliance: coverage.coverageCompliance
  };
}

function discoveryCoverageValueClass(value: DiscoveryCoverageValue | undefined): string {
  if (value === 1) {
    return "border-emerald-400/35 bg-emerald-500/10 text-emerald-200";
  }
  if (value === 0) {
    return "border-red-400/45 bg-red-500/15 text-red-100";
  }
  return "border-slate-500/40 bg-slate-700/25 text-slate-300";
}

function buildNetworkKpiSnapshotMetrics(
  snapshot: Dataset,
  networkId: string,
  spiDefinitions: SpiDefinition[],
  measuresSettings: MeasuresSettings,
  discoveryToolsSettings: DiscoveryToolsSettings
): NetworkKpiSnapshotMetrics {
  const analytics = buildAnalytics(
    snapshot,
    snapshot.ictSystems,
    { managedNetwork: networkId },
    spiDefinitions,
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
  const [dataset, snapshots, discoveryToolsSettings, spiDefinitions, severityDefinitions] = await Promise.all([
    loadDatasetForDate(requestedDataDate),
    loadLatestSnapshotsForDate(requestedDataDate, 12),
    loadDiscoveryToolsSettings(),
    loadSpiDefinitions(),
    loadSeverityDefinitions()
  ]);
  const measuresSettings = await loadMeasuresSettings(spiDefinitions, severityDefinitions);
  if (isUnassignedNetworkId(params.networkId)) {
    notFound();
  }

  const network = dataset.managedNetworks.find((item) => item.id === params.networkId);

  if (!network) {
    notFound();
  }

  const analytics = buildAnalytics(
    dataset,
    dataset.ictSystems,
    { managedNetwork: network.id },
    spiDefinitions,
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
  const discoveryToolCoverageModel = buildScopedDiscoveryToolCoverage(filteredAssets, discoveryToolsSettings);
  const discoveryToolCoverageCharts = discoveryToolCoverageModel.toolCards;
  const applicableDiscoveryToolIds = new Set(discoveryToolCoverageModel.toolColumns.map((tool) => tool.id));
  const selectedDiscoveryToolFilter =
    requestedDiscoveryToolFilter && applicableDiscoveryToolIds.has(requestedDiscoveryToolFilter)
      ? requestedDiscoveryToolFilter
      : undefined;
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

  const complianceMeasureRows = spiDefinitions.map((definition) => {
    const spiId = definition.spiId;
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
      label: `SPI ${spiId} - ${definition.description}`,
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
  const networkAssetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const systemOwnerById = new Map(
    dataset.ictSystems.map((system) => [system.id, system.owner?.trim() ?? ""])
  );
  const networkOwnerFallback = network.owner?.trim() || "Not assigned";

  const riskProfileFindings = networkScopedFindings
    .map((finding) => {
      const asset = networkAssetsById.get(finding.scope.assetId);
      const evidence = Object.entries(finding.evidence).map(([key, value]) => ({
        key,
        value: toEvidenceString(value)
      }));
      const evidencePreview =
        evidence
          .slice(0, 2)
          .map((item) => `${item.key}: ${item.value}`)
          .join(" | ") || "No evidence captured";
      const systemId = finding.scope.systemId ?? asset?.systemContext?.systemId ?? null;
      const environmentType = finding.scope.environmentType ?? asset?.systemContext?.environmentType ?? null;
      const scopeLabel = [
        `Asset ${finding.scope.assetId}`,
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
        ]) ?? (asset ? resolveAssetIpAddress(asset) : "Not available");
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
        (systemId ? systemOwnerById.get(systemId)?.trim() || networkOwnerFallback : networkOwnerFallback);

      return {
        id: `risk-${finding.id}`,
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
      const definition = spiDefinitions.find((item) => item.spiId === row.spiId);
      const severity = latestFinding?.severity ?? fallbackFindingSeverity(row.status, row.spiId, spiDefinitions);
      const priorityRank = latestFinding?.priorityRank ?? fallbackPriorityRank(row.status, row.spiId, spiDefinitions);
      const title = latestFinding?.title ?? definition?.description ?? `SPI ${row.spiId}`;
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
        measureLabel: `SPI ${row.spiId} - ${definition?.description ?? "Unmapped SPI"}`,
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
    const computed = buildNetworkKpiSnapshotMetrics(
      snapshot,
      network.id,
      spiDefinitions,
      measuresSettings,
      discoveryToolsSettings
    );
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
    networkDeviceCount: filteredAssets.filter((asset) => asset.type === "network-device").length,
    storageDeviceCount: filteredAssets.filter((asset) => asset.type === "storage-device").length,
    printerDeviceCount: filteredAssets.filter((asset) => asset.type === "printer-device").length,
    otherCount: filteredAssets.filter((asset) => asset.type === "other").length
  };
  const networkImpactSystems = dataset.ictSystems
    .filter((system) => system.networkId === network.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const networkAssetTypeFootprint = ([
    "server",
    "workstation",
    "network-device",
    "storage-device",
    "printer-device",
    "other"
  ] as const).map((assetType) => ({
    assetType,
    label: formatAssetTypeLabel(assetType),
    count: assets.filter((asset) => asset.type === assetType).length
  }));
  const cvesByAssetId = buildCveVulnerabilityIndexByAssetId(filteredAssets);
  const highRiskCvesByAssetId = buildHighRiskCveIndexByAssetId(filteredAssets);

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
      const coverage = discoveryToolCoverageModel.assetCoverageById.get(asset.id);
      return {
        assetId: asset.id,
        hostname: asset.hostname,
        assetIpAddress: resolveAssetIpAddress(asset),
        assetType: asset.type,
        environment: asset.systemContext?.environmentType ?? "-",
        ictSystem: asset.systemContext?.systemId ?? "-",
        toolValues: coverage?.toolValues ?? {},
        coverageCompliance: coverage?.coverageCompliance ?? true
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
      if (row.toolValues[selectedDiscoveryToolFilter] !== 0) {
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
  const headerComplianceTotal =
    headerComplianceCounts.compliant + headerComplianceCounts.nonCompliant + headerComplianceCounts.unknown;
  const headerComplianceContextLabel = selectedKpiFilter
    ? KPI_FILTER_LABELS[selectedKpiFilter]
    : activeDetailTab === "compliance-overview"
      ? "Compliance Overview open findings"
      : "Current drill-through scope";
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
          </div>

          <div className="grid w-full gap-2 self-stretch md:grid-cols-2 lg:w-[min(720px,48vw)] lg:self-auto">
            <CompactScoreCard
              title="Compliance Score"
              score={headerComplianceScore}
              total={headerComplianceTotal}
              contextLabel={headerComplianceContextLabel}
              segments={[
                {
                  label: "Compliant",
                  shortLabel: "C",
                  value: headerComplianceCounts.compliant,
                  barClassName: "h-full bg-emerald-400/90",
                  chipClassName: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                },
                {
                  label: "Non-compliant",
                  shortLabel: "NC",
                  value: headerComplianceCounts.nonCompliant,
                  barClassName: "h-full bg-rose-400/90",
                  chipClassName: "border-rose-300/25 bg-rose-500/10 text-rose-100"
                },
                {
                  label: "Unknown",
                  shortLabel: "U",
                  value: headerComplianceCounts.unknown,
                  barClassName: "h-full bg-slate-400/90",
                  chipClassName: "border-slate-400/25 bg-slate-500/10 text-slate-100"
                }
              ]}
            />
            <CompactScoreCard
              title="Discovery Compliance Score"
              score={discoveryComplianceScore}
              total={discoveryComplianceTotal}
              contextLabel="Current discovery scope"
              segments={[
                {
                  label: "Compliant",
                  shortLabel: "C",
                  value: discoveryComplianceCounts.compliant,
                  barClassName: "h-full bg-emerald-400/90",
                  chipClassName: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                },
                {
                  label: "Non-compliant",
                  shortLabel: "NC",
                  value: discoveryComplianceCounts.nonCompliant,
                  barClassName: "h-full bg-rose-400/90",
                  chipClassName: "border-rose-300/25 bg-rose-500/10 text-rose-100"
                },
                {
                  label: "Other",
                  shortLabel: "O",
                  value: discoveryComplianceCounts.other,
                  barClassName: "h-full bg-slate-400/90",
                  chipClassName: "border-slate-400/25 bg-slate-500/10 text-slate-100"
                }
              ]}
            />
          </div>
        </div>
      </section>

      <NetworkDetailTabs activeTab={activeDetailTab} topologyData={topologyData} spiDefinitions={spiDefinitions} />

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
      <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(18rem,0.62fr)_minmax(0,0.95fr)]">
        <section className="panel flex min-h-0 flex-col overflow-hidden p-2.5">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Details Overview</h2>
          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
            <article className="flex h-36 shrink-0 flex-col rounded-xl border border-sky-300/35 bg-slate-950/55 p-2.5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200/90">Description</h3>
              <div className="mt-2 min-h-0 flex-1 overflow-auto pr-1">
                <p className="text-sm leading-5 text-slate-200/90">{networkDetailFields.description}</p>
              </div>
            </article>

            <article className="rounded-xl border border-sky-300/35 bg-slate-950/55 p-2.5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200/90">Operational Contacts</h3>
              <dl className="mt-2 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="rounded-lg border border-sky-300/15 bg-slate-900/55 px-2 py-1.5">
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Owner</dt>
                  <dd className="mt-0.5 text-slate-100">{networkDetailFields.owner}</dd>
                </div>
                <div className="rounded-lg border border-sky-300/15 bg-slate-900/55 px-2 py-1.5">
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Support Email</dt>
                  <dd className="mt-0.5 truncate text-sky-100">
                    <a
                      className="underline decoration-sky-300/60 underline-offset-2"
                      href={`mailto:${networkDetailFields.supportEmail}`}
                    >
                      {networkDetailFields.supportEmail}
                    </a>
                  </dd>
                </div>
                <div className="rounded-lg border border-sky-300/15 bg-slate-900/55 px-2 py-1.5 md:col-span-2 xl:col-span-1 2xl:col-span-2">
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Service Catalogue Items</dt>
                  <dd className="mt-1 flex flex-wrap gap-2 text-sky-100">
                    <Link
                      href={networkDetailFields.serviceCatalogueUrl}
                      className="rounded-md border border-sky-300/25 bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-100 hover:border-sky-200/60"
                      target={isExternalLink(networkDetailFields.serviceCatalogueUrl) ? "_blank" : undefined}
                      rel={isExternalLink(networkDetailFields.serviceCatalogueUrl) ? "noreferrer" : undefined}
                    >
                      Support Request
                    </Link>
                    <Link
                      href={networkDetailFields.serviceCatalogueUrl}
                      className="rounded-md border border-sky-300/25 bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-100 hover:border-sky-200/60"
                      target={isExternalLink(networkDetailFields.serviceCatalogueUrl) ? "_blank" : undefined}
                      rel={isExternalLink(networkDetailFields.serviceCatalogueUrl) ? "noreferrer" : undefined}
                    >
                      Issue Request
                    </Link>
                  </dd>
                </div>
              </dl>
            </article>

            <div className="min-h-0 flex-1 space-y-1.5 overflow-auto pr-1">
              <article className="security-accreditation-pulse rounded-xl border border-yellow-300/90 bg-sky-400/16 p-2 shadow-[0_0_14px_rgba(253,224,71,0.32)]">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-100">Security Accreditation</h3>
                <dl className="mt-1.5 text-sm">
                  <div className="rounded-md border border-yellow-200/25 bg-slate-950/45 px-2 py-1">
                    <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-300/85">ATO</dt>
                    <dd className="truncate font-semibold text-slate-100">{networkDetailFields.atoNumber}</dd>
                  </div>
                </dl>
              </article>
            </div>
          </div>
        </section>

        <section className="panel flex min-h-0 flex-col overflow-hidden p-2.5">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Impact Overview</h2>
          <div className="mt-2 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-1.5 md:grid-cols-2 md:grid-rows-1 xl:grid-cols-1 xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
            <article className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-sky-300/35 bg-slate-950/55 p-2.5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200/90">Linked ICT Systems</h3>
              <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
                {networkImpactSystems.length ? (
                  <ul className="space-y-1.5 text-sm text-slate-200">
                    {networkImpactSystems.map((system) => (
                      <li key={system.id} className="rounded-lg border border-sky-300/20 bg-slate-900/55 px-2 py-1.5">
                        <Link
                          href={withDataDate(`/systems/${system.id}`, requestedDataDate)}
                          className="font-semibold text-sky-100 underline decoration-sky-300/50 underline-offset-2"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {system.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-300/80">
                          {system.criticality} / {system.securityDomain}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg border border-sky-300/20 bg-slate-900/55 px-2 py-1.5 text-sm text-slate-300/85">
                    No linked ICT systems in this snapshot.
                  </p>
                )}
              </div>
            </article>

            <article className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-sky-300/35 bg-slate-950/55 p-2.5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200/90">Asset Type Footprint</h3>
              <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
                <div className="grid gap-1.5 text-sm">
                  {networkAssetTypeFootprint.map((row) => (
                    <div
                      key={row.assetType}
                      className="flex items-center justify-between gap-3 rounded-lg border border-sky-300/20 bg-slate-900/55 px-2 py-1.5"
                    >
                      <span className="min-w-0 truncate text-slate-200">{row.label}</span>
                      <span className="rounded-md border border-sky-300/20 bg-sky-400/10 px-2 py-0.5 text-xs font-semibold text-sky-100">
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="panel grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-2.5">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Risk Overview</h2>
          <div className="mt-2 min-h-0 overflow-hidden">
            <NetworkDetailRiskCharts
              layout="stacked"
              asOfDate={requestedDataDate ?? todayDateKey()}
              scopeDescription="Open findings by severity in current network detail scope."
              riskProfile={{
                openFindings: openNetworkScopedFindings.length,
                p1p2Count: openNetworkScopedFindings.filter((finding) => finding.priorityRank <= 2).length,
                highRiskOpenCount: riskSeverityCounts.get("High Risk") ?? 0,
                criticalExposureOpenCount: riskSeverityCounts.get("Critical Exposure") ?? 0,
                severitySummary: riskSeveritySummary,
                weeklyTrend: networkDetailWeeklyRiskTrend
            }}
            findings={riskProfileFindings}
            spiDefinitions={spiDefinitions}
            assetHighRiskCvesByAssetId={highRiskCvesByAssetId}
            />
          </div>
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
        assetCvesByAssetId={cvesByAssetId}
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
          <section className="panel p-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Discovery Tool Coverage</h2>
                <p className="mt-0.5 text-[11px] text-slate-300/75">Current network scope by required tool.</p>
              </div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400/80">Click a tool to show gaps</p>
            </div>
            <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-2">
              {discoveryToolCoverageCharts.length ? (
                discoveryToolCoverageCharts.map((tool) => {
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
                    aria-label={`Show non-compliant assets for ${tool.label}`}
                    className={`panel-alt border-sky-300/25 p-2.5 transition hover:bg-slate-900/70 ${
                      isToolFilterActive ? "ring-2 ring-red-300/65" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200">
                        {tool.label}
                      </p>
                      <span className="shrink-0 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-100">
                        {tool.coveragePercent}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800/90">
                      <div className="flex h-full w-full">
                        <div className="h-full bg-emerald-400" style={{ width: `${tool.coveragePercent}%` }} />
                        <div className="h-full bg-red-400" style={{ width: `${100 - tool.coveragePercent}%` }} />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-emerald-100">
                        {tool.covered}/{tool.applicable} covered
                      </span>
                      <span className="text-red-100/90">{tool.missing} gaps</span>
                    </div>
                    {isToolFilterActive ? (
                      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-red-100/90">Filtered gaps</p>
                    ) : null}
                  </Link>
                );
                })
              ) : (
                <div className="panel-alt border-slate-500/30 p-3 text-sm text-slate-300/85">
                  No discovery tools apply to the asset types in this network scope.
                </div>
              )}
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
                    {discoveryToolCoverageModel.toolColumns.map((tool) => (
                      <th key={tool.id} className="px-3 py-2">
                        {tool.label}
                      </th>
                    ))}
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
                      {discoveryToolCoverageModel.toolColumns.map((tool) => {
                        const value = row.toolValues[tool.id];
                        return (
                          <td key={tool.id} className="px-3 py-2">
                            <span className={`rounded-full border px-2 py-0.5 text-xs ${discoveryCoverageValueClass(value)}`}>
                              {discoveryCoverageValueLabel(value)}
                            </span>
                          </td>
                        );
                      })}
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
                      <td
                        colSpan={6 + discoveryToolCoverageModel.toolColumns.length}
                        className="px-3 py-6 text-center text-sm text-slate-300/80"
                      >
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
                    SPI {option} - {spiDefinitions.find((definition) => definition.spiId === option)?.description ?? "Unmapped SPI"}
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
