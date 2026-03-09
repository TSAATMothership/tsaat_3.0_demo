import { FilterBar } from "@/components/filter-bar";
import { MiniTrendSparkline } from "@/components/mini-trend-sparkline";
import {
  NetworksActionPanel,
  NetworksOverviewPanel
} from "@/components/networks-cop-panels";
import { NetworksTable } from "@/components/networks-table";
import { NetworksTabs } from "@/components/networks-tabs";
import { getTrendAppData } from "@/lib/app-data";
import { deriveOverallStatus } from "@/lib/posture";
import { applyAssetFilters, filterNetworks } from "@/lib/selectors";
import { createSnapshotAnalyticsMemo } from "@/lib/snapshot-analytics-memo";
import { Asset, ComplianceStatus, Finding, FindingSeverity } from "@/lib/types";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function complianceScore(statuses: ComplianceStatus[]): number {
  if (!statuses.length) {
    return 0;
  }

  const compliant = statuses.filter((status) => status === "Compliant").length;
  return Number(((compliant / statuses.length) * 100).toFixed(1));
}

function dpeComplianceScore(statuses: Array<{ environmentType: string | null; status: ComplianceStatus }>): number {
  return complianceScore(
    statuses.filter((item) => item.environmentType === "Production").map((item) => item.status)
  );
}

function dseComplianceScore(statuses: Array<{ environmentType: string | null; status: ComplianceStatus }>): number {
  return complianceScore(
    statuses
      .filter((item) => item.environmentType !== null && item.environmentType !== "Production")
      .map((item) => item.status)
  );
}

function complianceFromRollupCounts(
  rollups: Array<{
    counts: { compliant: number; nonCompliant: number; unknown: number };
  }>
): number {
  const totals = rollups.reduce(
    (accumulator, rollup) => {
      accumulator.compliant += rollup.counts.compliant;
      accumulator.nonCompliant += rollup.counts.nonCompliant;
      accumulator.unknown += rollup.counts.unknown;
      return accumulator;
    },
    { compliant: 0, nonCompliant: 0, unknown: 0 }
  );

  const denominator = totals.compliant + totals.nonCompliant + totals.unknown;
  if (!denominator) {
    return 0;
  }

  return Number(((totals.compliant / denominator) * 100).toFixed(1));
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

function buildOpenFindingsDailySeries(
  findings: Finding[],
  severity: "High Risk" | "Critical Exposure",
  endDateKey: string,
  days = 365
) {
  const endDate = parseUtcDateKey(endDateKey);
  const startDate = addUtcDays(endDate, -(days - 1));
  const startDateKey = toUtcDateKey(startDate);
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

    if (openedDateKey >= startDateKey && openedDateKey <= endDateKey) {
      events.set(openedDateKey, (events.get(openedDateKey) ?? 0) + 1);
    }
    if (closedDateKey && closedDateKey >= startDateKey && closedDateKey <= endDateKey) {
      events.set(closedDateKey, (events.get(closedDateKey) ?? 0) - 1);
    }
  }

  const points: Array<{ date: string; label: string; count: number }> = [];
  let running = openAtWindowStart;
  for (let offset = 0; offset < days; offset += 1) {
    const pointDate = addUtcDays(startDate, offset);
    const pointDateKey = toUtcDateKey(pointDate);
    running += events.get(pointDateKey) ?? 0;
    points.push({
      date: pointDateKey,
      label: formatUtcDay(pointDate),
      count: Math.max(0, running)
    });
  }

  return points;
}

function buildWeeklyRiskTrend(
  highRiskDaily: Array<{ date: string; count: number }>,
  criticalExposureDaily: Array<{ date: string; count: number }>,
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
    return {
      weekLabel: formatUtcDay(pointDate),
      highRiskCount: highRiskByDate.get(pointDateKey) ?? 0,
      criticalExposureCount: criticalExposureByDate.get(pointDateKey) ?? 0
    };
  });
}

function differenceInWholeUtcDays(fromDate: Date, toDate: Date): number {
  const deltaMs = toDate.getTime() - fromDate.getTime();
  return Math.max(0, Math.floor(deltaMs / 86_400_000));
}

function throughputWeekIndex(startDate: Date, dateKey: string, weeks: number): number {
  const date = parseUtcDateKey(dateKey);
  const diffDays = differenceInWholeUtcDays(startDate, date);
  if (diffDays < 0 || diffDays >= weeks * 7) {
    return -1;
  }
  return Math.floor(diffDays / 7);
}

function buildActionThroughput(findings: Finding[], endDateKey: string, weeks = 13) {
  const endDate = parseUtcDateKey(endDateKey);
  const startDate = addUtcDays(endDate, -(weeks * 7 - 1));

  const rows = Array.from({ length: weeks }, (_, index) => {
    const weekEndDate = addUtcDays(startDate, index * 7 + 6);
    return {
      weekLabel: formatUtcDay(weekEndDate),
      openedCount: 0,
      closedCount: 0,
      netChange: 0
    };
  });

  for (const finding of findings) {
    const openedDateKey = toFindingDateKey(finding.timestamp);
    if (openedDateKey) {
      const openedIndex = throughputWeekIndex(startDate, openedDateKey, weeks);
      if (openedIndex >= 0) {
        rows[openedIndex].openedCount += 1;
      }
    }

    const closedDateKey = toFindingDateKey(finding.closedTimestamp);
    if (closedDateKey) {
      const closedIndex = throughputWeekIndex(startDate, closedDateKey, weeks);
      if (closedIndex >= 0) {
        rows[closedIndex].closedCount += 1;
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    netChange: row.openedCount - row.closedCount
  }));
}

const actionAgeBucketBoundaries: Array<{ label: string; minDays: number; maxDays: number | null }> = [
  { label: "0-30d", minDays: 0, maxDays: 30 },
  { label: "31-60d", minDays: 31, maxDays: 60 },
  { label: "61-90d", minDays: 61, maxDays: 90 },
  { label: "91-180d", minDays: 91, maxDays: 180 },
  { label: "181d+", minDays: 181, maxDays: null }
];

function resolveActionAgeBucket(ageDays: number): string {
  for (const bucket of actionAgeBucketBoundaries) {
    if (ageDays < bucket.minDays) {
      continue;
    }
    if (bucket.maxDays === null || ageDays <= bucket.maxDays) {
      return bucket.label;
    }
  }
  return actionAgeBucketBoundaries[actionAgeBucketBoundaries.length - 1].label;
}

function buildActionAgeBuckets(openFindings: Finding[], endDateKey: string) {
  const today = parseUtcDateKey(endDateKey);
  const rowsByLabel = new Map(
    actionAgeBucketBoundaries.map((bucket) => [
      bucket.label,
      {
        bucketLabel: bucket.label,
        criticalExposureCount: 0,
        highRiskCount: 0,
        otherCount: 0,
        total: 0
      }
    ])
  );

  for (const finding of openFindings) {
    const openedDateKey = toFindingDateKey(finding.timestamp);
    if (!openedDateKey) {
      continue;
    }

    const ageDays = differenceInWholeUtcDays(parseUtcDateKey(openedDateKey), today);
    const bucketLabel = resolveActionAgeBucket(ageDays);
    const row = rowsByLabel.get(bucketLabel);
    if (!row) {
      continue;
    }

    if (finding.severity === "Critical Exposure") {
      row.criticalExposureCount += 1;
    } else if (finding.severity === "High Risk") {
      row.highRiskCount += 1;
    } else {
      row.otherCount += 1;
    }
    row.total += 1;
  }

  return actionAgeBucketBoundaries
    .map((bucket) => rowsByLabel.get(bucket.label))
    .filter((row): row is { bucketLabel: string; criticalExposureCount: number; highRiskCount: number; otherCount: number; total: number } => Boolean(row));
}

function formatActionDate(dateKey: string): string {
  return parseUtcDateKey(dateKey).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function buildActionOldestOpenFindings(
  openFindings: Finding[],
  networkNameById: Map<string, string>,
  endDateKey: string,
  topCount = 12
) {
  const today = parseUtcDateKey(endDateKey);

  return openFindings
    .map((finding) => {
      const openedDateKey = toFindingDateKey(finding.timestamp);
      if (!openedDateKey) {
        return null;
      }

      return {
        findingId: finding.id,
        title: finding.title,
        severity: finding.severity,
        spiLabel: `SPI ${finding.spiId}`,
        networkName: networkNameById.get(finding.scope.networkId) ?? "Unassigned",
        openedDate: formatActionDate(openedDateKey),
        ageDays: differenceInWholeUtcDays(parseUtcDateKey(openedDateKey), today)
      };
    })
    .filter((row): row is { findingId: string; title: string; severity: FindingSeverity; spiLabel: string; networkName: string; openedDate: string; ageDays: number } => Boolean(row))
    .sort((a, b) => {
      if (b.ageDays !== a.ageDays) {
        return b.ageDays - a.ageDays;
      }
      return a.findingId.localeCompare(b.findingId);
    })
    .slice(0, topCount);
}

function buildActionQuickWins(openFindings: Finding[], topCount = 10) {
  const grouped = new Map<
    string,
    {
      actionText: string;
      criticalExposureCount: number;
      highRiskCount: number;
      otherCount: number;
      total: number;
      networkIds: Set<string>;
    }
  >();

  for (const finding of openFindings) {
    const actionText = finding.recommendedAction?.trim() || "No recommended action provided";
    const key = actionText.toLowerCase();
    const row = grouped.get(key) ?? {
      actionText,
      criticalExposureCount: 0,
      highRiskCount: 0,
      otherCount: 0,
      total: 0,
      networkIds: new Set<string>()
    };

    if (finding.severity === "Critical Exposure") {
      row.criticalExposureCount += 1;
    } else if (finding.severity === "High Risk") {
      row.highRiskCount += 1;
    } else {
      row.otherCount += 1;
    }
    row.total += 1;
    if (finding.scope.networkId) {
      row.networkIds.add(finding.scope.networkId);
    }
    grouped.set(key, row);
  }

  return Array.from(grouped.values())
    .sort((a, b) => {
      const severeA = a.criticalExposureCount + a.highRiskCount;
      const severeB = b.criticalExposureCount + b.highRiskCount;
      if (severeB !== severeA) {
        return severeB - severeA;
      }
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.actionText.localeCompare(b.actionText);
    })
    .slice(0, topCount)
    .map((row) => ({
      actionText: row.actionText,
      criticalExposureCount: row.criticalExposureCount,
      highRiskCount: row.highRiskCount,
      otherCount: row.otherCount,
      total: row.total,
      networkCount: row.networkIds.size
    }));
}

export default async function NetworksPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { analytics, filterOptions, filters, networks, snapshots, measuresSettings, dataset, systems } = await getTrendAppData(
    searchParams
  );

  const requestedTab = firstParam(searchParams.networksTab)?.trim().toLowerCase();
  const activeTab: "overview" | "action" | "posture" =
    requestedTab === "action" ? "action" : requestedTab === "posture" ? "posture" : "overview";

  const findingsByNetwork = new Map<string, number>();
  const p12FindingsByNetwork = new Map<string, number>();
  const p12HighRiskFindingsByNetwork = new Map<string, number>();
  const p12CriticalExposureFindingsByNetwork = new Map<string, number>();

  let p12FindingsCount = 0;
  let highRiskP12FindingsCount = 0;
  let criticalExposureP12FindingsCount = 0;

  for (const finding of analytics.findings) {
    findingsByNetwork.set(finding.scope.networkId, (findingsByNetwork.get(finding.scope.networkId) ?? 0) + 1);
    if (finding.priorityRank > 2) {
      continue;
    }

    p12FindingsCount += 1;
    p12FindingsByNetwork.set(finding.scope.networkId, (p12FindingsByNetwork.get(finding.scope.networkId) ?? 0) + 1);

    if (finding.severity === "High Risk") {
      highRiskP12FindingsCount += 1;
      p12HighRiskFindingsByNetwork.set(
        finding.scope.networkId,
        (p12HighRiskFindingsByNetwork.get(finding.scope.networkId) ?? 0) + 1
      );
    }

    if (finding.severity === "Critical Exposure") {
      criticalExposureP12FindingsCount += 1;
      p12CriticalExposureFindingsByNetwork.set(
        finding.scope.networkId,
        (p12CriticalExposureFindingsByNetwork.get(finding.scope.networkId) ?? 0) + 1
      );
    }
  }

  const compliantNetworksCount = networks.filter((network) => {
    const rollups = analytics.networkRollups.filter(
      (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
    );
    return deriveOverallStatus(rollups) === "Compliant";
  }).length;

  const nonCompliantNetworksCount = networks.filter((network) => {
    const rollups = analytics.networkRollups.filter(
      (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
    );
    return deriveOverallStatus(rollups) === "Non-compliant";
  }).length;

  const scopedSnapshots = snapshots.slice(-12);
  const getSnapshotAnalytics = createSnapshotAnalyticsMemo(filters, measuresSettings);
  const trendPoints = scopedSnapshots.map((snapshot, index) => {
    const snapshotAnalytics = getSnapshotAnalytics(snapshot);
    const snapshotNetworks = filterNetworks(snapshot.managedNetworks, filters);

    const compliantCount = snapshotNetworks.filter((network) => {
      const rollups = snapshotAnalytics.networkRollups.filter(
        (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
      );
      return deriveOverallStatus(rollups) === "Compliant";
    }).length;

    const nonCompliantCount = snapshotNetworks.filter((network) => {
      const rollups = snapshotAnalytics.networkRollups.filter(
        (rollup) => rollup.scopeType === "network" && rollup.scopeId === network.id
      );
      return deriveOverallStatus(rollups) === "Non-compliant";
    }).length;

    let snapshotP12FindingsCount = 0;
    let snapshotHighRiskP12FindingsCount = 0;
    let snapshotCriticalExposureP12FindingsCount = 0;

    for (const finding of snapshotAnalytics.findings) {
      if (finding.priorityRank > 2) {
        continue;
      }
      snapshotP12FindingsCount += 1;
      if (finding.severity === "High Risk") {
        snapshotHighRiskP12FindingsCount += 1;
      }
      if (finding.severity === "Critical Exposure") {
        snapshotCriticalExposureP12FindingsCount += 1;
      }
    }

    return {
      weekLabel: `W${String(scopedSnapshots.length - index).padStart(2, "0")}`,
      compliantNetworksCount: compliantCount,
      nonCompliantNetworksCount: nonCompliantCount,
      criticalExposureP12FindingsCount: snapshotCriticalExposureP12FindingsCount,
      highRiskP12FindingsCount: snapshotHighRiskP12FindingsCount,
      p12FindingsCount: snapshotP12FindingsCount
    };
  });

  const compliantNetworksTrend = trendPoints.map((point) => ({
    label: point.weekLabel,
    value: point.compliantNetworksCount
  }));
  const nonCompliantNetworksTrend = trendPoints.map((point) => ({
    label: point.weekLabel,
    value: point.nonCompliantNetworksCount
  }));
  const criticalExposureP12Trend = trendPoints.map((point) => ({
    label: point.weekLabel,
    value: point.criticalExposureP12FindingsCount
  }));
  const highRiskP12Trend = trendPoints.map((point) => ({
    label: point.weekLabel,
    value: point.highRiskP12FindingsCount
  }));
  const p12FindingsTrend = trendPoints.map((point) => ({
    label: point.weekLabel,
    value: point.p12FindingsCount
  }));

  const statusesWithEnvironment = analytics.evaluations.flatMap((evaluation) =>
    evaluation.evaluations.map((item) => ({
      environmentType: evaluation.environmentType,
      status: item.status
    }))
  );

  const scopedNetworkIds = new Set(networks.map((network) => network.id));
  const scopedNetworkRollups = analytics.networkRollups.filter(
    (rollup) => rollup.scopeType === "network" && scopedNetworkIds.has(rollup.scopeId)
  );
  const networksCompliance = complianceFromRollupCounts(scopedNetworkRollups);

  const openFindings = analytics.findings.filter((finding) => finding.status === "open");
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

  const todayDateKey = toUtcDateKey(new Date());
  const highRiskDaily = buildOpenFindingsDailySeries(analytics.findings, "High Risk", todayDateKey);
  const criticalExposureDaily = buildOpenFindingsDailySeries(analytics.findings, "Critical Exposure", todayDateKey);
  const weeklyRiskTrend = buildWeeklyRiskTrend(highRiskDaily, criticalExposureDaily, 13);

  const filteredAssets: Asset[] = applyAssetFilters(dataset.assets, systems, filters);
  const outOfWarranty = filteredAssets.filter((asset) => asset.lifecycle.warrantyStatus === "OutOfWarranty").length;
  const discoveryCoverageGaps = analytics.evaluations.filter((evaluation) => !evaluation.discoveryCoverageCompliant).length;
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

  const immediateAction = highRiskOpenCount + criticalExposureOpenCount;
  const plannedRemediation = openFindings.filter(
    (finding) => finding.priorityRank >= 3 && finding.priorityRank < 90
  ).length;
  const actionThroughput = buildActionThroughput(analytics.findings, todayDateKey, 13);
  const actionAgeBuckets = buildActionAgeBuckets(openFindings, todayDateKey);
  const networkNameById = new Map(dataset.managedNetworks.map((network) => [network.id, network.name]));
  const actionOldestOpenFindings = buildActionOldestOpenFindings(openFindings, networkNameById, todayDateKey, 12);
  const actionQuickWins = buildActionQuickWins(openFindings, 10);

  return (
    <div className="relative left-1/2 -my-5 flex h-[calc(100vh-11rem)] w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden md:-my-8 md:h-[calc(100vh-12rem)] md:w-[min(2100px,calc(100vw-3rem))]">
      <section className="panel shrink-0 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Networks View</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">Network Cyber Security Posture</h1>
        <p className="mt-1 text-sm text-slate-300/80">
          Network-scoped operational posture with Cyber COP aligned overview and action views.
        </p>
      </section>

      <NetworksTabs activeTab={activeTab} />

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "overview" ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            <div className="-mt-4">
              <FilterBar
                options={filterOptions}
                filters={filters}
                hiddenFields={["ictSystem", "systemCriticality", "environment"]}
                enableLoadingOverlay
              />
            </div>
            <div className="min-h-0">
              <NetworksOverviewPanel
                snapshotDate={dataset.snapshotDate}
                complianceScores={{
                  overall: analytics.overallCompliancePercent,
                  dse: dseComplianceScore(statusesWithEnvironment),
                  dpe: dpeComplianceScore(statusesWithEnvironment),
                  networks: networksCompliance
                }}
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
                dailyHighRisk={highRiskDaily}
                dailyCriticalExposure={criticalExposureDaily}
              />
            </div>
          </div>
        ) : activeTab === "action" ? (
          <NetworksActionPanel
            actionPlan={{
              immediateAction,
              plannedRemediation,
              outOfWarranty,
              discoveryCoverageGaps,
              networkNotDiscovered
            }}
            actionThroughput={actionThroughput}
            actionAgeBuckets={actionAgeBuckets}
            actionOldestOpenFindings={actionOldestOpenFindings}
            actionQuickWins={actionQuickWins}
          />
        ) : (
          <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2">
            <div className="-mt-4">
              <FilterBar
                options={filterOptions}
                filters={filters}
                hiddenFields={["ictSystem", "systemCriticality", "environment"]}
                enableLoadingOverlay
              />
            </div>

            <section className="panel p-3">
              <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Networks KPI Snapshot</h2>
              <p className="mt-1 text-xs text-slate-300/75">
                KPI trends over the last 12 weeks in the current filtered scope.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <div className="panel-alt border-emerald-400/25 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                    Total number of compliant Networks
                  </p>
                  <p className="mt-1 text-xl font-semibold text-emerald-100">{compliantNetworksCount}</p>
                  <MiniTrendSparkline points={compliantNetworksTrend} stroke="#22c55e" heightClassName="h-48" />
                </div>
                <div className="panel-alt border-red-400/25 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                    Total number of non-compliant Networks
                  </p>
                  <p className="mt-1 text-xl font-semibold text-red-100">{nonCompliantNetworksCount}</p>
                  <MiniTrendSparkline points={nonCompliantNetworksTrend} stroke="#ef4444" heightClassName="h-48" />
                </div>
                <div className="panel-alt border-red-400/25 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                    Total number of Critical Exposure P1-P2 findings
                  </p>
                  <p className="mt-1 text-xl font-semibold text-red-100">{criticalExposureP12FindingsCount}</p>
                  <MiniTrendSparkline points={criticalExposureP12Trend} stroke="#ef4444" heightClassName="h-48" />
                </div>
                <div className="panel-alt border-red-400/25 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                    Total number of High Risk P1-P2 findings
                  </p>
                  <p className="mt-1 text-xl font-semibold text-red-100">{highRiskP12FindingsCount}</p>
                  <MiniTrendSparkline points={highRiskP12Trend} stroke="#f97316" heightClassName="h-48" />
                </div>
                <div className="panel-alt border-amber-400/25 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                    Total number of P1-P2 findings
                  </p>
                  <p className="mt-1 text-xl font-semibold text-amber-100">{p12FindingsCount}</p>
                  <MiniTrendSparkline points={p12FindingsTrend} stroke="#f59e0b" heightClassName="h-48" />
                </div>
              </div>
            </section>

            <div className="min-h-0">
              <NetworksTable
                networks={networks}
                networkRollups={analytics.networkRollups}
                findingsByNetwork={findingsByNetwork}
                p12FindingsByNetwork={p12FindingsByNetwork}
                p12HighRiskFindingsByNetwork={p12HighRiskFindingsByNetwork}
                p12CriticalExposureFindingsByNetwork={p12CriticalExposureFindingsByNetwork}
                scrollable
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
