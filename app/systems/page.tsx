import { FilterBar } from "@/components/filter-bar";
import {
  SystemsOverviewPanel,
  SystemsPostureKpiSummary
} from "@/components/systems-cop-panels";
import { SystemsTable } from "@/components/systems-table";
import { SystemsTabs } from "@/components/systems-tabs";
import { getTrendAppData } from "@/lib/app-data";
import { buildHighRiskCveIndexByAssetId } from "@/lib/cve";
import { extractDataDateParam, todayDateKey } from "@/lib/data-date";
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
  const endDateKey =
    highRiskDaily[highRiskDaily.length - 1]?.date ?? criticalExposureDaily[criticalExposureDaily.length - 1]?.date;
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

export default async function SystemsPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const selectedDataDate = extractDataDateParam(searchParams);
  const { network: _ignoredNetwork, ...systemsOnlySearchParams } = searchParams;
  const {
    analytics,
    filterOptions,
    filters,
    systems,
    networks,
    dataset
  } = await getTrendAppData(
    systemsOnlySearchParams,
    12,
    { profile: "risk-summary" }
  );

  const requestedTab = firstParam(searchParams.systemsTab)?.trim().toLowerCase();
  const activeTab: "overview" | "posture" = requestedTab === "posture" ? "posture" : "overview";

  const scopedSystemIds = new Set(systems.map((system) => system.id));
  const totalSystemsCount = systems.length;
  const filteredAssets: Asset[] = applyAssetFilters(dataset.assets, systems, filters).filter((asset) => {
    const systemId = asset.systemContext?.systemId;
    return Boolean(systemId) && scopedSystemIds.has(systemId as string);
  });
  const filteredAssetsById = new Map(filteredAssets.map((asset) => [asset.id, asset]));
  const systemScopedEvaluations = analytics.evaluations.filter(
    (evaluation) => Boolean(evaluation.systemId) && scopedSystemIds.has(evaluation.systemId as string)
  );
  const systemScopedFindings = analytics.findings.filter(
    (finding) => Boolean(finding.scope.systemId) && scopedSystemIds.has(finding.scope.systemId as string)
  );
  const openFindings = systemScopedFindings.filter((finding) => finding.status === "open");

  const criticalFindingsBySystem = new Map<string, number>();
  const highFindingsBySystem = new Map<string, number>();
  const otherFindingsBySystem = new Map<string, number>();

  let criticalHighRiskFindingsCount = 0;

  for (const finding of openFindings) {
    const systemId = finding.scope.systemId as string;
    if (finding.severity === "Critical Exposure") {
      criticalHighRiskFindingsCount += 1;
      criticalFindingsBySystem.set(systemId, (criticalFindingsBySystem.get(systemId) ?? 0) + 1);
    } else if (finding.severity === "High Risk") {
      criticalHighRiskFindingsCount += 1;
      highFindingsBySystem.set(systemId, (highFindingsBySystem.get(systemId) ?? 0) + 1);
    } else {
      otherFindingsBySystem.set(systemId, (otherFindingsBySystem.get(systemId) ?? 0) + 1);
    }
  }

  const complianceScoreBySystem = systems.reduce((map, system) => {
    const statuses = analytics.evaluations
      .filter((evaluation) => evaluation.systemId === system.id)
      .flatMap((evaluation) => evaluation.evaluations.map((item) => item.status));

    const compliantCount = statuses.filter((status) => status === "Compliant").length;
    const score = statuses.length ? Number(((compliantCount / statuses.length) * 100).toFixed(1)) : 0;
    map.set(system.id, score);
    return map;
  }, new Map<string, number>());
  const discoveryComplianceScoreBySystem = systems.reduce((map, system) => {
    const relevantEvaluations = analytics.evaluations.filter((evaluation) => evaluation.systemId === system.id);
    const total = relevantEvaluations.length;
    const compliant = relevantEvaluations.filter((evaluation) => evaluation.discoveryCoverageCompliant).length;
    const score = total ? Number(((compliant / total) * 100).toFixed(1)) : 0;
    map.set(system.id, score);
    return map;
  }, new Map<string, number>());

  const compliantSystemsCount = systems.filter((system) => {
    const rollups = analytics.systemRollups.filter(
      (rollup) => rollup.scopeType === "system" && rollup.scopeId === system.id
    );
    return deriveOverallStatus(rollups) === "Compliant";
  }).length;

  const systemsMeetingDiscoveryRequirementsCount = systems.filter((system) => {
    const relevantEvaluations = analytics.evaluations.filter((evaluation) => evaluation.systemId === system.id);
    return relevantEvaluations.length > 0 && relevantEvaluations.every((evaluation) => evaluation.discoveryCoverageCompliant);
  }).length;
  const totalFindingsCount = openFindings.length;

  const endpointCountBySystem = filteredAssets.reduce((map, asset) => {
    const systemId = asset.systemContext?.systemId;
    if (!systemId || !scopedSystemIds.has(systemId)) {
      return map;
    }
    map.set(systemId, (map.get(systemId) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  const blastRadiusPoints = systems
    .map((system) => ({
      systemId: system.id,
      systemName: system.name,
      endpointCount: endpointCountBySystem.get(system.id) ?? 0,
      criticalHighRiskFindingsCount:
        (criticalFindingsBySystem.get(system.id) ?? 0) + (highFindingsBySystem.get(system.id) ?? 0)
    }))
    .sort((a, b) => {
      if (b.endpointCount !== a.endpointCount) {
        return b.endpointCount - a.endpointCount;
      }
      if (b.criticalHighRiskFindingsCount !== a.criticalHighRiskFindingsCount) {
        return b.criticalHighRiskFindingsCount - a.criticalHighRiskFindingsCount;
      }
      return a.systemName.localeCompare(b.systemName);
    });

  const statusesWithEnvironment = systemScopedEvaluations.flatMap((evaluation) =>
    evaluation.evaluations.map((item) => ({
      environmentType: evaluation.environmentType,
      status: item.status
    }))
  );
  const overviewComplianceCounts = complianceCounts(statusesWithEnvironment.map((item) => item.status));
  const overviewComplianceTotal =
    overviewComplianceCounts.compliant + overviewComplianceCounts.nonCompliant + overviewComplianceCounts.unknown;
  const overviewComplianceScore = scoreFromCounts(overviewComplianceCounts);
  const overviewDiscoveryComplianceCounts = systemScopedEvaluations.reduce(
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
    systemScopedFindings,
    "High Risk",
    chartWindowEndDateKey,
    dataset.snapshotDate
  );
  const criticalExposureDaily = buildOpenFindingsDailySeries(
    systemScopedFindings,
    "Critical Exposure",
    chartWindowEndDateKey,
    dataset.snapshotDate
  );
  const weeklyRiskTrend = buildWeeklyRiskTrend(highRiskDaily, criticalExposureDaily, 13);

  const systemOwnerById = new Map(dataset.ictSystems.map((system) => [system.id, system.owner?.trim() ?? ""]));
  const highRiskCvesByAssetId = buildHighRiskCveIndexByAssetId(filteredAssets);
  const riskProfileFindings = systemScopedFindings
    .map((finding) => {
      const asset = filteredAssetsById.get(finding.scope.assetId);
      const evidencePreview =
        Object.entries(finding.evidence)
          .slice(0, 2)
          .map(([key, value]) => `${key}: ${toEvidenceString(value)}`)
          .join(" | ") || "No evidence captured";
      const systemId = finding.scope.systemId ?? asset?.systemContext?.systemId ?? null;
      const networkId = finding.scope.networkId ?? asset?.networkId ?? null;
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
        (systemId ? systemOwnerById.get(systemId)?.trim() || "Not assigned" : "Not assigned");

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
  const modelledSystemsCount = systems.filter((system) => system.modellingStatus).length;
  const systemsNotModelled = systems.filter((system) => !system.modellingStatus).length;
  const modelledPercent = totalSystemsCount ? Number(((modelledSystemsCount / totalSystemsCount) * 100).toFixed(1)) : 0;
  const notModelledPercent = totalSystemsCount
    ? Number(((systemsNotModelled / totalSystemsCount) * 100).toFixed(1))
    : 0;

  return (
    <div className="relative left-1/2 -my-5 flex h-[calc(100vh-11rem)] w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden md:-my-8 md:h-[calc(100vh-12rem)] md:w-[min(2100px,calc(100vw-3rem))]">
      <section className="panel shrink-0 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">ICT Systems View</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">ICT System Cyber Security Posture</h1>
        <p className="mt-1 text-sm text-slate-300/80">
          ICT-system-scoped operational posture with Cyber COP aligned overview and posture views.
        </p>
      </section>

      <SystemsTabs activeTab={activeTab} />

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "overview" ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            <div className="-mt-4">
              <FilterBar
                options={filterOptions}
                filters={filters}
                hiddenFields={["managedNetwork"]}
                enableLoadingOverlay
              />
            </div>
            <div className="min-h-0">
              <SystemsOverviewPanel
                snapshotDate={dataset.snapshotDate}
                scoreCards={[
                  {
                    title: "Compliance Score",
                    score: overviewComplianceScore,
                    total: overviewComplianceTotal,
                    contextLabel: "Current ICT system overview scope",
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
                  modelledCount: modelledSystemsCount,
                  notModelledCount: systemsNotModelled,
                  totalCount: totalSystemsCount
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
            <div className="-mt-4">
              <FilterBar
                options={filterOptions}
                filters={filters}
                hiddenFields={["managedNetwork"]}
                enableLoadingOverlay
              />
            </div>

            <SystemsPostureKpiSummary
              compliantSystemsCount={compliantSystemsCount}
              systemsMeetingDiscoveryRequirementsCount={systemsMeetingDiscoveryRequirementsCount}
              totalSystemsCount={totalSystemsCount}
              criticalHighRiskFindingsCount={criticalHighRiskFindingsCount}
              totalFindingsCount={totalFindingsCount}
              blastRadiusPoints={blastRadiusPoints}
            />

            <div className="min-h-0">
              <SystemsTable
                systems={systems}
                assetCountBySystem={endpointCountBySystem}
                criticalFindingsBySystem={criticalFindingsBySystem}
                highFindingsBySystem={highFindingsBySystem}
                otherFindingsBySystem={otherFindingsBySystem}
                complianceScoreBySystem={complianceScoreBySystem}
                discoveryComplianceScoreBySystem={discoveryComplianceScoreBySystem}
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
