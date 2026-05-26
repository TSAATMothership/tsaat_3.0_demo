import { FilterBar } from "@/components/filter-bar";
import {
  NetworksOverviewPanel,
  NetworksPostureKpiSummary
} from "@/components/networks-cop-panels";
import { NetworksTable } from "@/components/networks-table";
import { NetworksTabs } from "@/components/networks-tabs";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { getTrendAppData } from "@/lib/app-data";
import { buildHighRiskCveIndexByAssetId } from "@/lib/cve";
import { extractDataDateParam, todayDateKey } from "@/lib/data-date";
import { filterRealNetworkEvaluations, filterRealNetworkFindings, filterRealNetworks } from "@/lib/network-scope";
import { deriveOverallStatus } from "@/lib/posture";
import { applyAssetFilters } from "@/lib/selectors";
import { Asset, ComplianceStatus, Finding, FindingSeverity } from "@/lib/types";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function complianceCounts(statuses: ComplianceStatus[]) {
  return statuses.reduce(
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
}

function scoreFromCounts(counts: { compliant: number; nonCompliant: number; unknown?: number; other?: number }) {
  const denominator = counts.compliant + counts.nonCompliant + (counts.unknown ?? 0) + (counts.other ?? 0);
  return denominator ? Number(((counts.compliant / denominator) * 100).toFixed(1)) : 0;
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

function buildOpenFindingsDailySeries(
  findings: Finding[],
  severity: "High Risk" | "Critical Exposure",
  endDateKey: string,
  dataAvailableUntilDateKey: string,
  days = 365
) {
  const endDate = parseUtcDateKey(endDateKey);
  const startDate = addUtcDays(endDate, -(days - 1));
  const startDateKey = toUtcDateKey(startDate);
  const effectiveDataEndDateKey =
    dataAvailableUntilDateKey <= endDateKey ? dataAvailableUntilDateKey : endDateKey;
  const events = new Map<string, number>();
  let openAtWindowStart = 0;

  for (const finding of findings) {
    if (finding.severity !== severity) {
      continue;
    }

    const openedDateKey = toFindingDateKey(finding.timestamp);
    if (!openedDateKey) {
      continue;
    }
    const closedDateKey = toFindingDateKey(finding.closedTimestamp);

    if (openedDateKey < startDateKey && (!closedDateKey || closedDateKey >= startDateKey)) {
      openAtWindowStart += 1;
    }

    if (openedDateKey >= startDateKey && openedDateKey <= effectiveDataEndDateKey) {
      events.set(openedDateKey, (events.get(openedDateKey) ?? 0) + 1);
    }
    if (closedDateKey && closedDateKey >= startDateKey && closedDateKey <= effectiveDataEndDateKey) {
      events.set(closedDateKey, (events.get(closedDateKey) ?? 0) - 1);
    }
  }

  const points: Array<{ date: string; label: string; count: number | null }> = [];
  let running = openAtWindowStart;
  let hasObservedData = openAtWindowStart > 0;
  for (let offset = 0; offset < days; offset += 1) {
    const pointDate = addUtcDays(startDate, offset);
    const pointDateKey = toUtcDateKey(pointDate);
    if (pointDateKey > effectiveDataEndDateKey) {
      points.push({
        date: pointDateKey,
        label: formatUtcDay(pointDate),
        count: null
      });
      continue;
    }
    if (events.has(pointDateKey)) {
      hasObservedData = true;
    }
    running += events.get(pointDateKey) ?? 0;
    points.push({
      date: pointDateKey,
      label: formatUtcDay(pointDate),
      count: hasObservedData ? Math.max(0, running) : null
    });
  }

  return points;
}

function buildWeeklyRiskTrend(
  highRiskDaily: Array<{ date: string; count: number | null }>,
  criticalExposureDaily: Array<{ date: string; count: number | null }>,
  weeks = 13
) {
  const endDateKey = highRiskDaily[highRiskDaily.length - 1]?.date ?? criticalExposureDaily[criticalExposureDaily.length - 1]?.date;
  if (!endDateKey) {
    return [];
  }

  const endDate = parseUtcDateKey(endDateKey);
  const highRiskByDate = new Map(highRiskDaily.map((point) => [point.date, point.count]));
  const criticalExposureByDate = new Map(criticalExposureDaily.map((point) => [point.date, point.count]));

  return Array.from({ length: weeks }, (_, index) => {
    const weekOffset = weeks - 1 - index;
    const pointDate = addUtcDays(endDate, -weekOffset * 7);
    const pointDateKey = toUtcDateKey(pointDate);
    const highRiskCount = highRiskByDate.has(pointDateKey)
      ? (highRiskByDate.get(pointDateKey) ?? null)
      : null;
    const criticalExposureCount = criticalExposureByDate.has(pointDateKey)
      ? (criticalExposureByDate.get(pointDateKey) ?? null)
      : null;
    return {
      weekLabel: formatUtcDay(pointDate),
      highRiskCount,
      criticalExposureCount
    };
  });
}

export default async function NetworksPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const selectedDataDate = extractDataDateParam(searchParams);
  const {
    analytics,
    filterOptions,
    filters,
    networks,
    dataset,
    systems
  } = await getTrendAppData(
    searchParams,
    12,
    { profile: "risk-summary" }
  );

  const requestedTab = firstParam(searchParams.networksTab)?.trim().toLowerCase();
  const activeTab: "overview" | "posture" = requestedTab === "posture" ? "posture" : "overview";
  const filtersSection = (
    <div className="-mt-4">
      <FilterBar
        options={filterOptions}
        filters={filters}
        hiddenFields={["ictSystem", "systemCriticality", "environment"]}
        enableLoadingOverlay
      />
    </div>
  );

  const scopedNetworkIds = new Set(filterRealNetworks(networks).map((network) => network.id));
  const networkScopedEvaluations = filterRealNetworkEvaluations(analytics.evaluations).filter((evaluation) =>
    scopedNetworkIds.has(evaluation.networkId)
  );
  const networkScopedFindings = filterRealNetworkFindings(analytics.findings).filter((finding) =>
    scopedNetworkIds.has(finding.scope.networkId)
  );
  const openFindings = networkScopedFindings.filter((finding) => finding.status === "open");
  const filteredAssets: Asset[] = applyAssetFilters(dataset.assets, systems, filters).filter((asset) =>
    scopedNetworkIds.has(asset.networkId)
  );
  const filteredAssetsById = new Map(filteredAssets.map((asset) => [asset.id, asset]));
  const criticalFindingsByNetwork = new Map<string, number>();
  const highFindingsByNetwork = new Map<string, number>();
  const otherFindingsByNetwork = new Map<string, number>();
  const discoveryComplianceScoreByNetwork = new Map<string, number>();

  let criticalHighRiskFindingsCount = 0;

  for (const finding of openFindings) {
    if (finding.severity === "Critical Exposure") {
      criticalHighRiskFindingsCount += 1;
      criticalFindingsByNetwork.set(
        finding.scope.networkId,
        (criticalFindingsByNetwork.get(finding.scope.networkId) ?? 0) + 1
      );
    } else if (finding.severity === "High Risk") {
      criticalHighRiskFindingsCount += 1;
      highFindingsByNetwork.set(
        finding.scope.networkId,
        (highFindingsByNetwork.get(finding.scope.networkId) ?? 0) + 1
      );
    } else {
      otherFindingsByNetwork.set(
        finding.scope.networkId,
        (otherFindingsByNetwork.get(finding.scope.networkId) ?? 0) + 1
      );
    }
  }

  const discoveryCoverageTotalsByNetwork = new Map<string, { compliant: number; total: number }>();
  for (const evaluation of networkScopedEvaluations) {
    const current = discoveryCoverageTotalsByNetwork.get(evaluation.networkId) ?? { compliant: 0, total: 0 };
    current.total += 1;
    if (evaluation.discoveryCoverageCompliant) {
      current.compliant += 1;
    }
    discoveryCoverageTotalsByNetwork.set(evaluation.networkId, current);
  }
  for (const [networkId, counts] of discoveryCoverageTotalsByNetwork.entries()) {
    const score = counts.total ? Number(((counts.compliant / counts.total) * 100).toFixed(1)) : 0;
    discoveryComplianceScoreByNetwork.set(networkId, score);
  }

  const compliantNetworksCount = networks.filter((network) => {
    const rollups = analytics.networkRollups.filter(
      (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
    );
    return deriveOverallStatus(rollups) === "Compliant";
  }).length;
  const networksMeetingDiscoveryRequirementsCount = networks.filter((network) => {
    const counts = discoveryCoverageTotalsByNetwork.get(network.id);
    return Boolean(counts && counts.total > 0 && counts.compliant === counts.total);
  }).length;
  const totalFindingsCount = openFindings.length;
  const endpointCountByNetwork = filteredAssets.reduce((map, asset) => {
    const networkId = asset.networkId;
    if (!scopedNetworkIds.has(networkId)) {
      return map;
    }
    map.set(networkId, (map.get(networkId) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  const blastRadiusPoints = networks
    .map((network) => ({
      networkId: network.id,
      networkName: network.name,
      endpointCount: endpointCountByNetwork.get(network.id) ?? 0,
      criticalHighRiskFindingsCount:
        (criticalFindingsByNetwork.get(network.id) ?? 0) + (highFindingsByNetwork.get(network.id) ?? 0)
    }))
    .sort((a, b) => {
      if (b.endpointCount !== a.endpointCount) {
        return b.endpointCount - a.endpointCount;
      }
      if (b.criticalHighRiskFindingsCount !== a.criticalHighRiskFindingsCount) {
        return b.criticalHighRiskFindingsCount - a.criticalHighRiskFindingsCount;
      }
      return a.networkName.localeCompare(b.networkName);
    });

  const statusesWithEnvironment = networkScopedEvaluations.flatMap((evaluation) =>
    evaluation.evaluations.map((item) => ({
      environmentType: evaluation.environmentType,
      status: item.status
    }))
  );
  const overviewComplianceCounts = complianceCounts(statusesWithEnvironment.map((item) => item.status));
  const overviewComplianceTotal =
    overviewComplianceCounts.compliant + overviewComplianceCounts.nonCompliant + overviewComplianceCounts.unknown;
  const overviewComplianceScore = scoreFromCounts(overviewComplianceCounts);
  const overviewDiscoveryComplianceCounts = networkScopedEvaluations.reduce(
    (accumulator, evaluation) => {
      const sourceAsset = filteredAssetsById.get(evaluation.assetId);
      const isOther =
        sourceAsset?.lifecycle.eolStatus === "Unknown" || sourceAsset?.lifecycle.warrantyStatus === "Unknown";

      if (isOther) {
        accumulator.other += 1;
      } else if (evaluation.discoveryCoverageCompliant) {
        accumulator.compliant += 1;
      } else {
        accumulator.nonCompliant += 1;
      }
      return accumulator;
    },
    { compliant: 0, nonCompliant: 0, other: 0 }
  );
  const overviewDiscoveryComplianceTotal =
    overviewDiscoveryComplianceCounts.compliant +
    overviewDiscoveryComplianceCounts.nonCompliant +
    overviewDiscoveryComplianceCounts.other;
  const overviewDiscoveryComplianceScore = scoreFromCounts(overviewDiscoveryComplianceCounts);

  const severityOrder: FindingSeverity[] = ["Critical Exposure", "High Risk", "Major", "Moderate", "Data Gap"];
  const severityCounts = openFindings.reduce<Map<FindingSeverity, number>>((accumulator, finding) => {
    accumulator.set(finding.severity, (accumulator.get(finding.severity) ?? 0) + 1);
    return accumulator;
  }, new Map());
  const severitySummary = severityOrder.map((severity) => ({
    severity,
    count: severityCounts.get(severity) ?? 0
  }));

  const highRiskOpenCount = severityCounts.get("High Risk") ?? 0;
  const criticalExposureOpenCount = severityCounts.get("Critical Exposure") ?? 0;
  const p1p2Count = openFindings.filter((finding) => finding.priorityRank <= 2).length;

  const chartAnchorDateKey = selectedDataDate ?? dataset.snapshotDate;
  const chartWindowEndDateKey = selectedDataDate ?? todayDateKey();
  const highRiskDaily = buildOpenFindingsDailySeries(
    networkScopedFindings,
    "High Risk",
    chartWindowEndDateKey,
    dataset.snapshotDate
  );
  const criticalExposureDaily = buildOpenFindingsDailySeries(
    networkScopedFindings,
    "Critical Exposure",
    chartWindowEndDateKey,
    dataset.snapshotDate
  );
  const weeklyRiskTrend = buildWeeklyRiskTrend(highRiskDaily, criticalExposureDaily, 13);

  const networkOwnerById = new Map(filterRealNetworks(dataset.managedNetworks).map((network) => [network.id, network.owner?.trim() ?? ""]));
  const systemOwnerById = new Map(dataset.ictSystems.map((system) => [system.id, system.owner?.trim() ?? ""]));
  const highRiskCvesByAssetId = buildHighRiskCveIndexByAssetId(filteredAssets);
  const riskProfileFindings = networkScopedFindings
    .map((finding) => {
      const asset = filteredAssetsById.get(finding.scope.assetId);
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
        networkId,
        systemId,
        environmentType,
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
  const totalNetworksCount = networks.length;
  const modelledNetworksCount = networks.filter(
    (network) => network.discoveryStatus !== "Discovery Non Enabled"
  ).length;
  const networkNotDiscovered = networks.filter(
    (network) => network.discoveryStatus === "Discovery Non Enabled"
  ).length;
  const modelledPercent = totalNetworksCount
    ? Number(((modelledNetworksCount / totalNetworksCount) * 100).toFixed(1))
    : 0;
  const notModelledPercent = totalNetworksCount
    ? Number(((networkNotDiscovered / totalNetworksCount) * 100).toFixed(1))
    : 0;

  return (
    <div className="relative left-1/2 -my-5 flex h-[calc(100vh-11rem)] w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden md:-my-8 md:h-[calc(100vh-12rem)] md:w-[min(2100px,calc(100vw-3rem))]">
      <RouteReadyMarker pathname="/networks" searchParams={searchParams} />
      <section className="panel shrink-0 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Networks View</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">Network Cyber Security Posture</h1>
        <p className="mt-1 text-sm text-slate-300/80">
          Network-scoped operational posture with Cyber COP aligned overview and posture views.
        </p>
      </section>

      <NetworksTabs activeTab={activeTab} />

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "overview" ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            {filtersSection}
            <div className="min-h-0">
              <NetworksOverviewPanel
                snapshotDate={dataset.snapshotDate}
                scoreCards={[
                  {
                    title: "Compliance Score",
                    score: overviewComplianceScore,
                    total: overviewComplianceTotal,
                    contextLabel: "Current network overview scope",
                    segments: [
                      {
                        label: "Compliant",
                        shortLabel: "C",
                        value: overviewComplianceCounts.compliant,
                        barClassName: "h-full bg-emerald-400/90",
                        chipClassName: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                      },
                      {
                        label: "Non-compliant",
                        shortLabel: "NC",
                        value: overviewComplianceCounts.nonCompliant,
                        barClassName: "h-full bg-rose-400/90",
                        chipClassName: "border-rose-300/25 bg-rose-500/10 text-rose-100"
                      },
                      {
                        label: "Unknown",
                        shortLabel: "U",
                        value: overviewComplianceCounts.unknown,
                        barClassName: "h-full bg-slate-400/90",
                        chipClassName: "border-slate-400/25 bg-slate-500/10 text-slate-100"
                      }
                    ]
                  },
                  {
                    title: "Discovery Compliance Score",
                    score: overviewDiscoveryComplianceScore,
                    total: overviewDiscoveryComplianceTotal,
                    contextLabel: "Current discovery scope",
                    segments: [
                      {
                        label: "Compliant",
                        shortLabel: "C",
                        value: overviewDiscoveryComplianceCounts.compliant,
                        barClassName: "h-full bg-emerald-400/90",
                        chipClassName: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                      },
                      {
                        label: "Non-compliant",
                        shortLabel: "NC",
                        value: overviewDiscoveryComplianceCounts.nonCompliant,
                        barClassName: "h-full bg-rose-400/90",
                        chipClassName: "border-rose-300/25 bg-rose-500/10 text-rose-100"
                      },
                      {
                        label: "Other",
                        shortLabel: "O",
                        value: overviewDiscoveryComplianceCounts.other,
                        barClassName: "h-full bg-slate-400/90",
                        chipClassName: "border-slate-400/25 bg-slate-500/10 text-slate-100"
                      }
                    ]
                  }
                ]}
                modellingCoverage={{
                  modelledPercent,
                  notModelledPercent,
                  modelledCount: modelledNetworksCount,
                  notModelledCount: networkNotDiscovered,
                  totalCount: totalNetworksCount
                }}
                riskProfile={{
                  openFindings: openFindings.length,
                  p1p2Count,
                  highRiskOpenCount,
                  criticalExposureOpenCount,
                  severitySummary,
                  weeklyTrend: weeklyRiskTrend
                }}
                riskFindings={riskProfileFindings}
                assetHighRiskCvesByAssetId={highRiskCvesByAssetId}
                asOfDate={chartAnchorDateKey}
                dailyHighRisk={highRiskDaily}
                dailyCriticalExposure={criticalExposureDaily}
              />
            </div>
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2">
            {filtersSection}

            <NetworksPostureKpiSummary
              compliantNetworksCount={compliantNetworksCount}
              networksMeetingDiscoveryRequirementsCount={networksMeetingDiscoveryRequirementsCount}
              totalNetworksCount={totalNetworksCount}
              criticalHighRiskFindingsCount={criticalHighRiskFindingsCount}
              totalFindingsCount={totalFindingsCount}
              blastRadiusPoints={blastRadiusPoints}
            />

            <div className="min-h-0">
              <NetworksTable
                networks={networks}
                networkRollups={analytics.networkRollups}
                criticalFindingsByNetwork={criticalFindingsByNetwork}
                highFindingsByNetwork={highFindingsByNetwork}
                otherFindingsByNetwork={otherFindingsByNetwork}
                discoveryComplianceScoreByNetwork={discoveryComplianceScoreByNetwork}
                riskFindings={riskProfileFindings}
                assetHighRiskCvesByAssetId={highRiskCvesByAssetId}
                asOfDate={chartAnchorDateKey}
                scrollable
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
