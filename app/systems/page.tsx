import { FilterBar } from "@/components/filter-bar";
import { MiniTrendSparkline } from "@/components/mini-trend-sparkline";
import {
  SystemsActionPanel,
  SystemsOverviewPanel
} from "@/components/systems-cop-panels";
import { SystemsTable } from "@/components/systems-table";
import { SystemsTabs } from "@/components/systems-tabs";
import { getTrendAppData } from "@/lib/app-data";
import { extractDataDateParam, todayDateKey } from "@/lib/data-date";
import { deriveOverallStatus } from "@/lib/posture";
import { applyAssetFilters, filterSystems } from "@/lib/selectors";
import { createSnapshotAnalyticsMemo } from "@/lib/snapshot-analytics-memo";
import { Asset, ComplianceStatus, Finding, FindingSeverity } from "@/lib/types";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function toQueryEntries(searchParams: Record<string, string | string[] | undefined>): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        entries.push([key, item]);
      }
    } else if (typeof value === "string") {
      entries.push([key, value]);
    }
  }
  return entries;
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
    .filter(
      (
        row
      ): row is {
        bucketLabel: string;
        criticalExposureCount: number;
        highRiskCount: number;
        otherCount: number;
        total: number;
      } => Boolean(row)
    );
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
  systemNameById: Map<string, string>,
  endDateKey: string,
  topCount = 12
) {
  const today = parseUtcDateKey(endDateKey);

  return openFindings
    .map((finding) => {
      const openedDateKey = toFindingDateKey(finding.timestamp);
      if (!openedDateKey || !finding.scope.systemId) {
        return null;
      }

      return {
        findingId: finding.id,
        title: finding.title,
        severity: finding.severity,
        spiLabel: `SPI ${finding.spiId}`,
        systemName: systemNameById.get(finding.scope.systemId) ?? "Unassigned",
        impactedDevices:
          typeof finding.evidence.assetName === "string" && finding.evidence.assetName.trim().length > 0
            ? finding.evidence.assetName
            : finding.scope.assetId,
        openedDate: formatActionDate(openedDateKey),
        ageDays: differenceInWholeUtcDays(parseUtcDateKey(openedDateKey), today)
      };
    })
    .filter(
      (
        row
      ): row is {
        findingId: string;
        title: string;
        severity: FindingSeverity;
        spiLabel: string;
        systemName: string;
        impactedDevices: string;
        openedDate: string;
        ageDays: number;
      } => Boolean(row)
    )
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
      systemIds: Set<string>;
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
      systemIds: new Set<string>()
    };

    if (finding.severity === "Critical Exposure") {
      row.criticalExposureCount += 1;
    } else if (finding.severity === "High Risk") {
      row.highRiskCount += 1;
    } else {
      row.otherCount += 1;
    }
    row.total += 1;
    if (finding.scope.systemId) {
      row.systemIds.add(finding.scope.systemId);
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
      systemCount: row.systemIds.size
    }));
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
    snapshots,
    measuresSettings,
    discoveryToolsSettings,
    dataset
  } = await getTrendAppData(
    systemsOnlySearchParams
  );
  const queryEntries = toQueryEntries(systemsOnlySearchParams);
  const remediationReportHref = (() => {
    const params = new URLSearchParams();
    for (const [key, value] of queryEntries) {
      params.append(key, value);
    }
    const query = params.toString();
    return query ? `/api/systems/remediation-report?${query}` : "/api/systems/remediation-report";
  })();

  const requestedTab = firstParam(searchParams.systemsTab)?.trim().toLowerCase();
  const activeTab: "overview" | "action" | "posture" =
    requestedTab === "action" ? "action" : requestedTab === "posture" ? "posture" : "overview";

  const scopedSystemIds = new Set(systems.map((system) => system.id));
  const systemScopedFindings = analytics.findings.filter(
    (finding) => Boolean(finding.scope.systemId) && scopedSystemIds.has(finding.scope.systemId as string)
  );

  const findingsBySystem = new Map<string, number>();
  const p12FindingsBySystem = new Map<string, number>();
  const p12HighRiskFindingsBySystem = new Map<string, number>();
  const p12CriticalExposureFindingsBySystem = new Map<string, number>();

  let p12FindingsCount = 0;
  let highRiskP12FindingsCount = 0;
  let criticalExposureP12FindingsCount = 0;

  for (const finding of systemScopedFindings) {
    const systemId = finding.scope.systemId as string;
    findingsBySystem.set(systemId, (findingsBySystem.get(systemId) ?? 0) + 1);
    if (finding.priorityRank > 2) {
      continue;
    }

    p12FindingsCount += 1;
    p12FindingsBySystem.set(systemId, (p12FindingsBySystem.get(systemId) ?? 0) + 1);

    if (finding.severity === "High Risk") {
      highRiskP12FindingsCount += 1;
      p12HighRiskFindingsBySystem.set(systemId, (p12HighRiskFindingsBySystem.get(systemId) ?? 0) + 1);
    }

    if (finding.severity === "Critical Exposure") {
      criticalExposureP12FindingsCount += 1;
      p12CriticalExposureFindingsBySystem.set(
        systemId,
        (p12CriticalExposureFindingsBySystem.get(systemId) ?? 0) + 1
      );
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

  const nonCompliantSystemsCount = systems.filter((system) => {
    const rollups = analytics.systemRollups.filter(
      (rollup) => rollup.scopeType === "system" && rollup.scopeId === system.id
    );
    return deriveOverallStatus(rollups) === "Non-compliant";
  }).length;

  const scopedSnapshots = snapshots.slice(-12);
  const getSnapshotAnalytics = createSnapshotAnalyticsMemo(filters, measuresSettings, discoveryToolsSettings);
  const trendPoints = scopedSnapshots.map((snapshot, index) => {
    const snapshotAnalytics = getSnapshotAnalytics(snapshot);
    const snapshotSystems = filterSystems(snapshot.ictSystems, filters);
    const snapshotSystemIds = new Set(snapshotSystems.map((system) => system.id));
    const snapshotSystemFindings = snapshotAnalytics.findings.filter(
      (finding) => Boolean(finding.scope.systemId) && snapshotSystemIds.has(finding.scope.systemId as string)
    );

    const compliantCount = snapshotSystems.filter((system) => {
      const rollups = snapshotAnalytics.systemRollups.filter(
        (rollup) => rollup.scopeType === "system" && rollup.scopeId === system.id
      );
      return deriveOverallStatus(rollups) === "Compliant";
    }).length;

    const nonCompliantCount = snapshotSystems.filter((system) => {
      const rollups = snapshotAnalytics.systemRollups.filter(
        (rollup) => rollup.scopeType === "system" && rollup.scopeId === system.id
      );
      return deriveOverallStatus(rollups) === "Non-compliant";
    }).length;

    let snapshotP12FindingsCount = 0;
    let snapshotHighRiskP12FindingsCount = 0;
    let snapshotCriticalExposureP12FindingsCount = 0;

    for (const finding of snapshotSystemFindings) {
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
      compliantSystemsCount: compliantCount,
      nonCompliantSystemsCount: nonCompliantCount,
      criticalExposureP12FindingsCount: snapshotCriticalExposureP12FindingsCount,
      highRiskP12FindingsCount: snapshotHighRiskP12FindingsCount,
      p12FindingsCount: snapshotP12FindingsCount
    };
  });

  const compliantSystemsTrend = trendPoints.map((point) => ({
    label: point.weekLabel,
    value: point.compliantSystemsCount
  }));
  const nonCompliantSystemsTrend = trendPoints.map((point) => ({
    label: point.weekLabel,
    value: point.nonCompliantSystemsCount
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

  const statusesWithEnvironment = analytics.evaluations
    .filter((evaluation) => Boolean(evaluation.systemId) && scopedSystemIds.has(evaluation.systemId as string))
    .flatMap((evaluation) =>
      evaluation.evaluations.map((item) => ({
        environmentType: evaluation.environmentType,
        status: item.status
      }))
    );

  const scopedSystemRollups = analytics.systemRollups.filter(
    (rollup) => rollup.scopeType === "system" && scopedSystemIds.has(rollup.scopeId)
  );
  const systemsCompliance = complianceFromRollupCounts(scopedSystemRollups);

  const openFindings = systemScopedFindings.filter((finding) => finding.status === "open");
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

  const filteredAssets: Asset[] = applyAssetFilters(dataset.assets, systems, filters).filter((asset) => {
    const systemId = asset.systemContext?.systemId;
    return Boolean(systemId) && scopedSystemIds.has(systemId as string);
  });
  const outOfWarranty = filteredAssets.filter((asset) => asset.lifecycle.warrantyStatus === "OutOfWarranty").length;
  const discoveryCoverageGaps = analytics.evaluations.filter(
    (evaluation) =>
      Boolean(evaluation.systemId) &&
      scopedSystemIds.has(evaluation.systemId as string) &&
      !evaluation.discoveryCoverageCompliant
  ).length;
  const totalSystemsCount = systems.length;
  const modelledSystemsCount = systems.filter((system) => system.modellingStatus).length;
  const systemsNotModelled = systems.filter((system) => !system.modellingStatus).length;
  const modelledPercent = totalSystemsCount ? Number(((modelledSystemsCount / totalSystemsCount) * 100).toFixed(1)) : 0;
  const notModelledPercent = totalSystemsCount
    ? Number(((systemsNotModelled / totalSystemsCount) * 100).toFixed(1))
    : 0;

  const immediateAction = highRiskOpenCount + criticalExposureOpenCount;
  const plannedRemediation = openFindings.filter(
    (finding) => finding.priorityRank >= 3 && finding.priorityRank < 90
  ).length;
  const nonCompliantOs = analytics.evaluations.filter(
    (evaluation) =>
      Boolean(evaluation.systemId) &&
      scopedSystemIds.has(evaluation.systemId as string) &&
      (evaluation.assetType === "server" || evaluation.assetType === "workstation") &&
      evaluation.evaluations.some(
        (evaluationItem) =>
          (evaluationItem.spiId === 1 || evaluationItem.spiId === 2) && evaluationItem.status === "Non-compliant"
      )
  ).length;
  const actionThroughput = buildActionThroughput(systemScopedFindings, chartAnchorDateKey, 13);
  const actionAgeBuckets = buildActionAgeBuckets(openFindings, chartAnchorDateKey);
  const systemNameById = new Map(dataset.ictSystems.map((system) => [system.id, system.name]));
  const actionOldestOpenFindings = buildActionOldestOpenFindings(
    openFindings,
    systemNameById,
    chartAnchorDateKey,
    12
  );
  const actionQuickWins = buildActionQuickWins(openFindings, 10);

  return (
    <div className="relative left-1/2 -my-5 flex h-[calc(100vh-11rem)] w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden md:-my-8 md:h-[calc(100vh-12rem)] md:w-[min(2100px,calc(100vw-3rem))]">
      <section className="panel shrink-0 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">ICT Systems View</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">ICT System Cyber Security Posture</h1>
        <p className="mt-1 text-sm text-slate-300/80">
          ICT-system-scoped operational posture with Cyber COP aligned overview and action views.
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
                complianceScores={{
                  overall: complianceScore(statusesWithEnvironment.map((item) => item.status)),
                  dse: dseComplianceScore(statusesWithEnvironment),
                  dpe: dpeComplianceScore(statusesWithEnvironment),
                  systems: systemsCompliance
                }}
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
                dailyHighRisk={highRiskDaily}
                dailyCriticalExposure={criticalExposureDaily}
              />
            </div>
          </div>
        ) : activeTab === "action" ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            <div className="-mt-4">
              <FilterBar
                options={filterOptions}
                filters={filters}
                hiddenFields={["managedNetwork"]}
                enableLoadingOverlay
                actions={
                  <a
                    href={remediationReportHref}
                    className="inline-flex h-[42px] items-center justify-center whitespace-nowrap rounded-md border border-amber-300/45 bg-amber-500/15 px-4 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-500/25"
                  >
                    Generate Remediation Report
                  </a>
                }
              />
            </div>
            <div className="min-h-0">
              <SystemsActionPanel
                actionPlan={{
                  immediateAction,
                  plannedRemediation,
                  nonCompliantOs,
                  outOfWarranty,
                  discoveryCoverageGaps,
                  systemsNotModelled
                }}
                actionThroughput={actionThroughput}
                actionAgeBuckets={actionAgeBuckets}
                actionOldestOpenFindings={actionOldestOpenFindings}
                actionQuickWins={actionQuickWins}
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

            <section className="panel p-3">
              <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">ICT Systems KPI Snapshot</h2>
              <p className="mt-1 text-xs text-slate-300/75">
                KPI trends over the last 12 weeks in the current filtered scope.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <div className="panel-alt border-emerald-400/25 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                    Total number of compliant ICT Systems
                  </p>
                  <p className="mt-1 text-xl font-semibold text-emerald-100">{compliantSystemsCount}</p>
                  <MiniTrendSparkline points={compliantSystemsTrend} stroke="#22c55e" heightClassName="h-16" />
                </div>
                <div className="panel-alt border-red-400/25 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                    Total number of non-compliant ICT Systems
                  </p>
                  <p className="mt-1 text-xl font-semibold text-red-100">{nonCompliantSystemsCount}</p>
                  <MiniTrendSparkline points={nonCompliantSystemsTrend} stroke="#ef4444" heightClassName="h-16" />
                </div>
                <div className="panel-alt border-red-400/25 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                    Total number of Critical Exposure P1-P2 findings
                  </p>
                  <p className="mt-1 text-xl font-semibold text-red-100">{criticalExposureP12FindingsCount}</p>
                  <MiniTrendSparkline points={criticalExposureP12Trend} stroke="#ef4444" heightClassName="h-16" />
                </div>
                <div className="panel-alt border-red-400/25 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                    Total number of High Risk P1-P2 findings
                  </p>
                  <p className="mt-1 text-xl font-semibold text-red-100">{highRiskP12FindingsCount}</p>
                  <MiniTrendSparkline points={highRiskP12Trend} stroke="#f97316" heightClassName="h-16" />
                </div>
                <div className="panel-alt border-amber-400/25 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                    Total number of P1-P2 findings
                  </p>
                  <p className="mt-1 text-xl font-semibold text-amber-100">{p12FindingsCount}</p>
                  <MiniTrendSparkline points={p12FindingsTrend} stroke="#f59e0b" heightClassName="h-16" />
                </div>
              </div>
            </section>

            <div className="min-h-0">
              <SystemsTable
                systems={systems}
                systemRollups={analytics.systemRollups}
                environmentRollups={analytics.environmentRollups}
                findingsBySystem={findingsBySystem}
                complianceScoreBySystem={complianceScoreBySystem}
                discoveryComplianceScoreBySystem={discoveryComplianceScoreBySystem}
                scrollable
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
