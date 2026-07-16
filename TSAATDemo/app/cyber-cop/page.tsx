import {
  CyberCopDashboard,
  type CyberCopActionOldestFindingRow,
  type CyberCopActionQuickWinRow,
  type CyberCopAssetTypeHeatmapAsset,
  type CyberCopDailyTrendPoint,
  type CyberCopImpactItem,
  type CyberCopImpactEnvironmentSplitRow,
  type CyberCopImpactEntityTrend,
  type CyberCopImpactLinks,
  type CyberCopImpactSpiDriver
} from "@/components/cyber-cop-dashboard";
import { FilterBar } from "@/components/filter-bar";
import { FullHeightWorkspace } from "@/components/full-height-workspace";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { buildHighRiskCveIndexByAssetId } from "@/lib/cve";
import { extractDataDateParam, todayDateKey } from "@/lib/data-date";
import { getCoreAppData } from "@/lib/app-data";
import { ASSET_TYPES, formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { buildNetworkTargetStateSummary } from "@/lib/network-target-state";
import { buildNetworkPerformanceReportModel, buildSystemPerformanceReportModel } from "@/lib/performance-report-model";
import { applyAssetFilters } from "@/lib/selectors";
import { evaluationMatchesSpiFeature, SPI_FEATURE_OS_NON_COMPLIANT } from "@/lib/spi-features";
import { SpiDefinition } from "@/lib/spi-definitions";
import { Asset, AssetType, ComplianceStatus, Criticality, Finding, FindingSeverity, SpiId } from "@/lib/types";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function omitSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  keysToOmit: string[]
): Record<string, string | string[] | undefined> {
  const omittedKeys = new Set(keysToOmit);
  const result: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (!omittedKeys.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

function readSpiFilter(
  searchParams: Record<string, string | string[] | undefined>,
  spiDefinitions: SpiDefinition[]
): SpiId | undefined {
  const value = firstParam(searchParams.spi)?.trim();
  const numericValue = Number(value);
  if (spiDefinitions.some((definition) => definition.spiId === numericValue)) {
    return numericValue as SpiId;
  }
  return undefined;
}

function readMeasureSearch(searchParams: Record<string, string | string[] | undefined>): string {
  return firstParam(searchParams.measureSearch)?.trim() ?? "";
}

type ComplianceCounts = { compliant: number; nonCompliant: number; unknown: number };

function complianceCounts(statuses: ComplianceStatus[]): ComplianceCounts {
  return statuses.reduce<ComplianceCounts>(
    (counts, status) => {
      if (status === "Compliant") {
        counts.compliant += 1;
      } else if (status === "Non-compliant") {
        counts.nonCompliant += 1;
      } else {
        counts.unknown += 1;
      }
      return counts;
    },
    { compliant: 0, nonCompliant: 0, unknown: 0 }
  );
}

function scoreFromComplianceCounts(counts: ComplianceCounts): number {
  const total = counts.compliant + counts.nonCompliant + counts.unknown;
  return total ? Number(((counts.compliant / total) * 100).toFixed(1)) : 0;
}

function dpeComplianceCounts(statuses: Array<{ environmentType: string | null; status: ComplianceStatus }>): ComplianceCounts {
  return complianceCounts(statuses.filter((item) => item.environmentType === "Production").map((item) => item.status));
}

function dseComplianceCounts(statuses: Array<{ environmentType: string | null; status: ComplianceStatus }>): ComplianceCounts {
  return complianceCounts(
    statuses
      .filter((item) => item.environmentType !== null && item.environmentType !== "Production")
      .map((item) => item.status)
  );
}

function rollupComplianceCounts(
  rollups: Array<{
    counts: { compliant: number; nonCompliant: number; unknown: number };
  }>
): ComplianceCounts {
  return rollups.reduce<ComplianceCounts>(
    (accumulator, rollup) => {
      accumulator.compliant += rollup.counts.compliant;
      accumulator.nonCompliant += rollup.counts.nonCompliant;
      accumulator.unknown += rollup.counts.unknown;
      return accumulator;
    },
    { compliant: 0, nonCompliant: 0, unknown: 0 }
  );
}

function complianceScoreCard(title: string, contextLabel: string, counts: ComplianceCounts) {
  const total = counts.compliant + counts.nonCompliant + counts.unknown;
  return {
    title,
    score: scoreFromComplianceCounts(counts),
    total,
    contextLabel,
    segments: [
      {
        label: "Compliant",
        shortLabel: "C",
        value: counts.compliant,
        barClassName: "h-full bg-emerald-400/90",
        chipClassName: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
      },
      {
        label: "Non-compliant",
        shortLabel: "NC",
        value: counts.nonCompliant,
        barClassName: "h-full bg-rose-400/90",
        chipClassName: "border-rose-300/25 bg-rose-500/10 text-rose-100"
      },
      {
        label: "Unknown",
        shortLabel: "U",
        value: counts.unknown,
        barClassName: "h-full bg-slate-400/90",
        chipClassName: "border-slate-400/25 bg-slate-500/10 text-slate-100"
      }
    ]
  };
}

function countNonCompliantOs(
  assets: Asset[],
  evaluationByAssetId: Map<
    string,
    {
      evaluations: Array<{ spiId: number; status: ComplianceStatus; outcomeKey?: string }>;
    }
  >,
  spiDefinitions: SpiDefinition[]
): number {
  return assets.filter((asset) => {
    if (asset.type !== "server" && asset.type !== "workstation") {
      return false;
    }
    const evaluation = evaluationByAssetId.get(asset.id);
    if (!evaluation) {
      return false;
    }
    return evaluation.evaluations.some((evaluationItem) =>
      evaluationMatchesSpiFeature(evaluationItem, SPI_FEATURE_OS_NON_COMPLIANT, spiDefinitions)
    );
  }).length;
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
): CyberCopDailyTrendPoint[] {
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

  const points: CyberCopDailyTrendPoint[] = [];
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
  highRiskDaily: CyberCopDailyTrendPoint[],
  criticalExposureDaily: CyberCopDailyTrendPoint[],
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

function buildSystemImpact(
  findings: Finding[],
  systems: Array<{ id: string; name: string; criticality: Criticality }>
): CyberCopImpactItem[] {
  const systemsById = new Map(systems.map((system) => [system.id, system]));
  const impactMap = new Map<
    string,
    CyberCopImpactItem & {
      assets: Set<string>;
    }
  >();

  for (const finding of findings) {
    if (!finding.scope.systemId) {
      continue;
    }
    const system = systemsById.get(finding.scope.systemId);
    if (!system) {
      continue;
    }

    const record =
      impactMap.get(system.id) ??
      {
        id: system.id,
        name: system.name,
        criticality: system.criticality,
        findings: 0,
        highPriority: 0,
        criticalExposureCount: 0,
        highRiskCount: 0,
        impactedAssets: 0,
        assets: new Set<string>()
      };
    record.findings += 1;
    if (finding.priorityRank <= 2) {
      record.highPriority += 1;
    }
    if (finding.severity === "Critical Exposure") {
      record.criticalExposureCount += 1;
    }
    if (finding.severity === "High Risk") {
      record.highRiskCount += 1;
    }
    record.assets.add(finding.scope.assetId);
    record.impactedAssets = record.assets.size;
    impactMap.set(system.id, record);
  }

  return Array.from(impactMap.values())
    .map(({ assets, ...row }) => row)
    .sort((a, b) => {
      if (b.criticalExposureCount !== a.criticalExposureCount) {
        return b.criticalExposureCount - a.criticalExposureCount;
      }
      if (b.highRiskCount !== a.highRiskCount) {
        return b.highRiskCount - a.highRiskCount;
      }
      if (b.findings !== a.findings) {
        return b.findings - a.findings;
      }
      return a.name.localeCompare(b.name);
    });
}

function mergedCriticality(current: Criticality | undefined, next: Criticality): Criticality {
  if (current === "Critical" || next === "Critical") {
    return "Critical";
  }
  return "Non-Critical";
}

function buildMissionCapabilityImpact(
  findings: Finding[],
  systems: Array<{
    id: string;
    missionCapabilities: Array<{ id: string; name: string; criticality: Criticality }>;
  }>
): CyberCopImpactItem[] {
  const systemsById = new Map(systems.map((system) => [system.id, system]));
  const capabilityCriticalityById = new Map<string, Criticality>();
  for (const system of systems) {
    for (const capability of system.missionCapabilities) {
      capabilityCriticalityById.set(
        capability.id,
        mergedCriticality(capabilityCriticalityById.get(capability.id), capability.criticality)
      );
    }
  }
  const impactMap = new Map<
    string,
    CyberCopImpactItem & {
      assets: Set<string>;
    }
  >();

  for (const finding of findings) {
    if (!finding.scope.systemId) {
      continue;
    }
    const system = systemsById.get(finding.scope.systemId);
    if (!system) {
      continue;
    }

    for (const capability of system.missionCapabilities) {
      const record =
        impactMap.get(capability.id) ??
        {
          id: capability.id,
          name: capability.name,
          criticality: capabilityCriticalityById.get(capability.id) ?? capability.criticality,
          findings: 0,
          highPriority: 0,
          criticalExposureCount: 0,
          highRiskCount: 0,
          impactedAssets: 0,
          assets: new Set<string>()
        };
      record.findings += 1;
      if (finding.priorityRank <= 2) {
        record.highPriority += 1;
      }
      if (finding.severity === "Critical Exposure") {
        record.criticalExposureCount += 1;
      }
      if (finding.severity === "High Risk") {
        record.highRiskCount += 1;
      }
      record.assets.add(finding.scope.assetId);
      record.impactedAssets = record.assets.size;
      impactMap.set(capability.id, record);
    }
  }

  return Array.from(impactMap.values())
    .map(({ assets, ...row }) => row)
    .sort((a, b) => {
      if (b.criticalExposureCount !== a.criticalExposureCount) {
        return b.criticalExposureCount - a.criticalExposureCount;
      }
      if (b.highRiskCount !== a.highRiskCount) {
        return b.highRiskCount - a.highRiskCount;
      }
      if (b.findings !== a.findings) {
        return b.findings - a.findings;
      }
      return a.name.localeCompare(b.name);
    });
}

function buildBusinessServiceImpact(
  findings: Finding[],
  systems: Array<{
    id: string;
    businessServices: Array<{ id: string; name: string; criticality: Criticality }>;
  }>
): CyberCopImpactItem[] {
  const systemsById = new Map(systems.map((system) => [system.id, system]));
  const serviceCriticalityById = new Map<string, Criticality>();
  for (const system of systems) {
    for (const service of system.businessServices) {
      serviceCriticalityById.set(
        service.id,
        mergedCriticality(serviceCriticalityById.get(service.id), service.criticality)
      );
    }
  }
  const impactMap = new Map<
    string,
    CyberCopImpactItem & {
      assets: Set<string>;
    }
  >();

  for (const finding of findings) {
    if (!finding.scope.systemId) {
      continue;
    }
    const system = systemsById.get(finding.scope.systemId);
    if (!system) {
      continue;
    }

    for (const service of system.businessServices) {
      const record =
        impactMap.get(service.id) ??
        {
          id: service.id,
          name: service.name,
          criticality: serviceCriticalityById.get(service.id) ?? service.criticality,
          findings: 0,
          highPriority: 0,
          criticalExposureCount: 0,
          highRiskCount: 0,
          impactedAssets: 0,
          assets: new Set<string>()
        };
      record.findings += 1;
      if (finding.priorityRank <= 2) {
        record.highPriority += 1;
      }
      if (finding.severity === "Critical Exposure") {
        record.criticalExposureCount += 1;
      }
      if (finding.severity === "High Risk") {
        record.highRiskCount += 1;
      }
      record.assets.add(finding.scope.assetId);
      record.impactedAssets = record.assets.size;
      impactMap.set(service.id, record);
    }
  }

  return Array.from(impactMap.values())
    .map(({ assets, ...row }) => row)
    .sort((a, b) => {
      if (b.criticalExposureCount !== a.criticalExposureCount) {
        return b.criticalExposureCount - a.criticalExposureCount;
      }
      if (b.highRiskCount !== a.highRiskCount) {
        return b.highRiskCount - a.highRiskCount;
      }
      if (b.findings !== a.findings) {
        return b.findings - a.findings;
      }
      return a.name.localeCompare(b.name);
    });
}

function toImpactSpiDrivers(
  countBySpi: Map<
    number,
    {
      criticalExposureCount: number;
      highRiskCount: number;
      otherCount: number;
    }
  >,
  spiDefinitions: SpiDefinition[]
): CyberCopImpactSpiDriver[] {
  const definitionsById = new Map(spiDefinitions.map((definition) => [definition.spiId, definition]));
  return Array.from(countBySpi.entries())
    .sort((a, b) => {
      const aTotal = a[1].criticalExposureCount + a[1].highRiskCount + a[1].otherCount;
      const bTotal = b[1].criticalExposureCount + b[1].highRiskCount + b[1].otherCount;
      if (bTotal !== aTotal) {
        return bTotal - aTotal;
      }
      return a[0] - b[0];
    })
    .map(([spiId, row]) => ({
      spiId,
      label: `SPI ${spiId}`,
      description: definitionsById.get(spiId)?.description ?? `SPI ${spiId}`,
      criticalExposureCount: row.criticalExposureCount,
      highRiskCount: row.highRiskCount,
      otherCount: row.otherCount,
      count: row.criticalExposureCount + row.highRiskCount + row.otherCount
    }));
}

function buildImpactSpiDrivers(findings: Finding[], spiDefinitions: SpiDefinition[]): CyberCopImpactSpiDriver[] {
  const countBySpi = findings.reduce<
    Map<
      number,
      {
        criticalExposureCount: number;
        highRiskCount: number;
        otherCount: number;
      }
    >
  >((accumulator, finding) => {
    const row = accumulator.get(finding.spiId) ?? {
      criticalExposureCount: 0,
      highRiskCount: 0,
      otherCount: 0
    };

    if (finding.severity === "Critical Exposure") {
      row.criticalExposureCount += 1;
    } else if (finding.severity === "High Risk") {
      row.highRiskCount += 1;
    } else {
      row.otherCount += 1;
    }

    accumulator.set(finding.spiId, row);
    return accumulator;
  }, new Map());

  return toImpactSpiDrivers(countBySpi, spiDefinitions);
}

function buildImpactSpiDriversBySystemId(
  findings: Finding[],
  spiDefinitions: SpiDefinition[]
): Record<string, CyberCopImpactSpiDriver[]> {
  const bySystem = new Map<
    string,
    Map<
      number,
      {
        criticalExposureCount: number;
        highRiskCount: number;
        otherCount: number;
      }
    >
  >();

  for (const finding of findings) {
    if (!finding.scope.systemId) {
      continue;
    }

    const systemCountBySpi = bySystem.get(finding.scope.systemId) ?? new Map();
    const row = systemCountBySpi.get(finding.spiId) ?? {
      criticalExposureCount: 0,
      highRiskCount: 0,
      otherCount: 0
    };

    if (finding.severity === "Critical Exposure") {
      row.criticalExposureCount += 1;
    } else if (finding.severity === "High Risk") {
      row.highRiskCount += 1;
    } else {
      row.otherCount += 1;
    }

    systemCountBySpi.set(finding.spiId, row);
    bySystem.set(finding.scope.systemId, systemCountBySpi);
  }

  return Object.fromEntries(
    Array.from(bySystem.entries()).map(([systemId, countBySpi]) => [
      systemId,
      toImpactSpiDrivers(countBySpi, spiDefinitions)
    ])
  );
}

const impactEnvironmentOrder = ["Production", "Development", "UAT", "Test", "Unassigned"] as const;

function emptyImpactEnvironmentRow(environment: string): CyberCopImpactEnvironmentSplitRow {
  return {
    environment,
    criticalExposureCount: 0,
    highRiskCount: 0,
    otherCount: 0,
    total: 0
  };
}

function buildImpactEnvironmentSplitRows(
  findings: Finding[],
  predicate?: (finding: Finding) => boolean
): CyberCopImpactEnvironmentSplitRow[] {
  const environmentMap = new Map<string, CyberCopImpactEnvironmentSplitRow>(
    impactEnvironmentOrder.map((environment) => [environment, emptyImpactEnvironmentRow(environment)])
  );

  for (const finding of findings) {
    if (predicate && !predicate(finding)) {
      continue;
    }

    const environment = finding.scope.environmentType ?? "Unassigned";
    const record = environmentMap.get(environment) ?? emptyImpactEnvironmentRow(environment);

    if (finding.severity === "Critical Exposure") {
      record.criticalExposureCount += 1;
    } else if (finding.severity === "High Risk") {
      record.highRiskCount += 1;
    } else {
      record.otherCount += 1;
    }
    record.total += 1;
    environmentMap.set(environment, record);
  }

  return impactEnvironmentOrder
    .map((environment) => environmentMap.get(environment))
    .filter((item): item is CyberCopImpactEnvironmentSplitRow => Boolean(item))
    .filter((item) => item.total > 0);
}

function buildImpactEnvironmentSplit(findings: Finding[]): CyberCopImpactEnvironmentSplitRow[] {
  return buildImpactEnvironmentSplitRows(findings);
}

function buildImpactEnvironmentSplitBySystemId(
  findings: Finding[]
): Record<string, CyberCopImpactEnvironmentSplitRow[]> {
  const systemIds = Array.from(
    new Set(findings.map((finding) => finding.scope.systemId).filter((systemId): systemId is string => Boolean(systemId)))
  );

  return Object.fromEntries(
    systemIds.map((systemId) => [
      systemId,
      buildImpactEnvironmentSplitRows(findings, (finding) => finding.scope.systemId === systemId)
    ])
  );
}

function buildOpenSevereFindingsDailySeriesForSystem(
  findings: Finding[],
  systemId: string,
  endDateKey: string,
  days = 365
): CyberCopDailyTrendPoint[] {
  const endDate = parseUtcDateKey(endDateKey);
  const startDate = addUtcDays(endDate, -(days - 1));
  const startDateKey = toUtcDateKey(startDate);
  const events = new Map<string, number>();
  let openAtWindowStart = 0;

  for (const finding of findings) {
    if (
      finding.scope.systemId !== systemId ||
      (finding.severity !== "High Risk" && finding.severity !== "Critical Exposure")
    ) {
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

  const points: CyberCopDailyTrendPoint[] = [];
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

function buildWeeklyEntityTrend(daily: CyberCopDailyTrendPoint[], weeks = 13) {
  const endDateKey = daily[daily.length - 1]?.date;
  if (!endDateKey) {
    return [];
  }

  const endDate = parseUtcDateKey(endDateKey);
  const countsByDate = new Map(daily.map((point) => [point.date, point.count]));

  return Array.from({ length: weeks }, (_, index) => {
    const weekOffset = weeks - 1 - index;
    const pointDate = addUtcDays(endDate, -weekOffset * 7);
    const pointDateKey = toUtcDateKey(pointDate);
    return {
      weekLabel: formatUtcDay(pointDate),
      count: countsByDate.get(pointDateKey) ?? 0
    };
  });
}

function buildImpactEntityTrends(
  findings: Finding[],
  systemImpact: CyberCopImpactItem[],
  endDateKey: string,
  topCount = 5
): CyberCopImpactEntityTrend[] {
  const topSystems = systemImpact
    .map((system) => ({
      ...system,
      riskCount: system.criticalExposureCount + system.highRiskCount
    }))
    .filter((system) => system.riskCount > 0)
    .sort((a, b) => {
      if (b.riskCount !== a.riskCount) {
        return b.riskCount - a.riskCount;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, topCount);

  return topSystems.map((system) => ({
    id: system.id,
    name: system.name,
    criticality: system.criticality,
    riskCount: system.riskCount,
    weeklyTrend: buildWeeklyEntityTrend(
      buildOpenSevereFindingsDailySeriesForSystem(findings, system.id, endDateKey, 365),
      13
    )
  }));
}

function buildImpactLinks(
  scopedSystems: Array<{
    id: string;
    missionCapabilities: Array<{ id: string }>;
    businessServices: Array<{ id: string }>;
  }>
): CyberCopImpactLinks {
  const businessToSystems = new Map<string, Set<string>>();
  const missionToSystems = new Map<string, Set<string>>();

  for (const system of scopedSystems) {
    for (const service of system.businessServices) {
      const systems = businessToSystems.get(service.id) ?? new Set<string>();
      systems.add(system.id);
      businessToSystems.set(service.id, systems);
    }

    for (const capability of system.missionCapabilities) {
      const systems = missionToSystems.get(capability.id) ?? new Set<string>();
      systems.add(system.id);
      missionToSystems.set(capability.id, systems);
    }
  }

  return {
    businessToSystems: Object.fromEntries(
      Array.from(businessToSystems.entries()).map(([id, systemIds]) => [id, Array.from(systemIds)])
    ),
    missionToSystems: Object.fromEntries(
      Array.from(missionToSystems.entries()).map(([id, systemIds]) => [id, Array.from(systemIds)])
    )
  };
}

function buildImpactAssetTypeHeatmapBySystemId(
  assets: Asset[],
  findings: Finding[],
  systems: Array<{ id: string; name: string }>
): Record<string, CyberCopAssetTypeHeatmapAsset[]> {
  const systemNameById = new Map(systems.map((system) => [system.id, system.name]));
  const severeCountsByAssetId = new Map<
    string,
    {
      criticalExposureCount: number;
      highRiskCount: number;
    }
  >();

  for (const finding of findings) {
    if (finding.severity !== "Critical Exposure" && finding.severity !== "High Risk") {
      continue;
    }

    const row = severeCountsByAssetId.get(finding.scope.assetId) ?? {
      criticalExposureCount: 0,
      highRiskCount: 0
    };

    if (finding.severity === "Critical Exposure") {
      row.criticalExposureCount += 1;
    } else {
      row.highRiskCount += 1;
    }
    severeCountsByAssetId.set(finding.scope.assetId, row);
  }

  const bySystem = new Map<string, CyberCopAssetTypeHeatmapAsset[]>();
  for (const asset of assets) {
    const systemId = asset.systemContext?.systemId;
    if (!systemId) {
      continue;
    }

    const counts = severeCountsByAssetId.get(asset.id) ?? {
      criticalExposureCount: 0,
      highRiskCount: 0
    };
    const row: CyberCopAssetTypeHeatmapAsset = {
      id: asset.id,
      name: asset.name || asset.hostname || asset.id,
      hostname: asset.hostname || asset.name || asset.id,
      assetType: asset.type,
      systemId,
      systemName: systemNameById.get(systemId) ?? "Unassigned ICT System",
      environmentType: asset.systemContext?.environmentType ?? null,
      securityDomain: asset.securityDomain,
      criticalExposureCount: counts.criticalExposureCount,
      highRiskCount: counts.highRiskCount,
      severeFindingCount: counts.criticalExposureCount + counts.highRiskCount,
      riskScore: counts.criticalExposureCount * 2 + counts.highRiskCount
    };

    const rows = bySystem.get(systemId) ?? [];
    rows.push(row);
    bySystem.set(systemId, rows);
  }

  return Object.fromEntries(
    Array.from(bySystem.entries()).map(([systemId, rows]) => [
      systemId,
      rows.sort((left, right) => {
        const leftTypeIndex = ASSET_TYPES.indexOf(left.assetType);
        const rightTypeIndex = ASSET_TYPES.indexOf(right.assetType);
        if (leftTypeIndex !== rightTypeIndex) {
          return leftTypeIndex - rightTypeIndex;
        }
        if (right.riskScore !== left.riskScore) {
          return right.riskScore - left.riskScore;
        }
        if (right.criticalExposureCount !== left.criticalExposureCount) {
          return right.criticalExposureCount - left.criticalExposureCount;
        }
        if (right.highRiskCount !== left.highRiskCount) {
          return right.highRiskCount - left.highRiskCount;
        }
        return left.name.localeCompare(right.name);
      })
    ])
  );
}

function differenceInWholeUtcDays(fromDate: Date, toDate: Date): number {
  const deltaMs = toDate.getTime() - fromDate.getTime();
  return Math.max(0, Math.floor(deltaMs / 86_400_000));
}

function formatActionDate(dateKey: string): string {
  return parseUtcDateKey(dateKey).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function buildActionOldestOpenFindings(
  openFindings: Finding[],
  systems: Array<{ id: string; name: string }>,
  endDateKey: string,
  topCount = 12
): CyberCopActionOldestFindingRow[] {
  const systemNameById = new Map(systems.map((system) => [system.id, system.name]));
  const today = parseUtcDateKey(endDateKey);

  return openFindings
    .filter((finding) => finding.severity === "Critical Exposure" || finding.severity === "High Risk")
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
        systemName: (finding.scope.systemId && systemNameById.get(finding.scope.systemId)) || "Unassigned",
        openedDate: formatActionDate(openedDateKey),
        ageDays: differenceInWholeUtcDays(parseUtcDateKey(openedDateKey), today),
        recommendedAction: finding.recommendedAction
      };
    })
    .filter((row): row is CyberCopActionOldestFindingRow => Boolean(row))
    .sort((a, b) => {
      if (b.ageDays !== a.ageDays) {
        return b.ageDays - a.ageDays;
      }
      return a.findingId.localeCompare(b.findingId);
    })
    .slice(0, topCount);
}

function buildActionQuickWins(openFindings: Finding[], topCount = 10): CyberCopActionQuickWinRow[] {
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

export default async function CyberCopPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const measureSearch = readMeasureSearch(searchParams);
  const networkHeatmapSearchParams = omitSearchParams(searchParams, ["system", "criticality", "environment"]);
  const systemHeatmapSearchParams = omitSearchParams(searchParams, ["network"]);
  const [
    { analytics, filterOptions, filters, dataset, systems, networks, spiDefinitions, severityDefinitions },
    networkHeatmapData,
    systemHeatmapData
  ] = await Promise.all([
    getCoreAppData(searchParams),
    getCoreAppData(networkHeatmapSearchParams),
    getCoreAppData(systemHeatmapSearchParams)
  ]);
  const selectedSpiId = readSpiFilter(searchParams, spiDefinitions);
  const selectedDataDate = extractDataDateParam(searchParams);
  const severityOptions: FindingSeverity[] = severityDefinitions.map((definition) => definition.severityKey);
  const networkHeatmapExtraSelects = [
    {
      key: "severity",
      label: "Severity",
      value: networkHeatmapData.filters.severity,
      options: severityOptions.map((severity) => ({ id: severity, label: severity }))
    }
  ];
  const systemHeatmapExtraSelects = [
    {
      key: "severity",
      label: "Severity",
      value: systemHeatmapData.filters.severity,
      options: severityOptions.map((severity) => ({ id: severity, label: severity }))
    }
  ];
  const networkSpiHeatmapModel = buildNetworkPerformanceReportModel({
    dataset: networkHeatmapData.dataset,
    analytics: networkHeatmapData.analytics,
    filters: networkHeatmapData.filters,
    networks: networkHeatmapData.networks,
    systems: networkHeatmapData.systems,
    kpiDefinitions: networkHeatmapData.kpiDefinitions,
    spiDefinitions: networkHeatmapData.spiDefinitions,
    severityDefinitions: networkHeatmapData.severityDefinitions,
    asOfDate: networkHeatmapData.dataset.snapshotDate
  });
  const systemSpiHeatmapModel = buildSystemPerformanceReportModel({
    dataset: systemHeatmapData.dataset,
    analytics: systemHeatmapData.analytics,
    filters: systemHeatmapData.filters,
    networks: systemHeatmapData.networks,
    systems: systemHeatmapData.systems,
    kpiDefinitions: systemHeatmapData.kpiDefinitions,
    spiDefinitions: systemHeatmapData.spiDefinitions,
    severityDefinitions: systemHeatmapData.severityDefinitions,
    asOfDate: systemHeatmapData.dataset.snapshotDate
  });

  const statusesWithEnvironment = analytics.evaluations.flatMap((evaluation) =>
    evaluation.evaluations.map((item) => ({
      environmentType: evaluation.environmentType,
      status: item.status
    }))
  );

  const filteredAssets = applyAssetFilters(dataset.assets, systems, filters);
  const filteredAssetsById = new Map(filteredAssets.map((asset) => [asset.id, asset]));
  const allAssetsById = new Map(dataset.assets.map((asset) => [asset.id, asset]));
  const systemOwnerById = new Map(dataset.ictSystems.map((system) => [system.id, system.owner?.trim() ?? ""]));
  const networkOwnerById = new Map(dataset.managedNetworks.map((network) => [network.id, network.owner?.trim() ?? ""]));
  const highRiskCvesByAssetId = buildHighRiskCveIndexByAssetId(filteredAssets);
  const riskProfileFindings = analytics.findings
    .map((finding) => {
      const asset = filteredAssetsById.get(finding.scope.assetId) ?? allAssetsById.get(finding.scope.assetId);
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
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const nonCompliantOs = countNonCompliantOs(filteredAssets, evaluationByAssetId, spiDefinitions);
  const nonCompliantOsTotal = filteredAssets.filter((asset) => asset.type === "server" || asset.type === "workstation").length;
  const scopedAssetsTotal = filteredAssets.length;
  const scopedServersTotal = filteredAssets.filter((asset) => asset.type === "server").length;
  const assetsOutOfWarrantyEol = filteredAssets.filter(
    (asset) => asset.lifecycle.warrantyStatus === "OutOfWarranty" || asset.lifecycle.eolStatus === "EOL"
  ).length;
  const networksWithoutDiscoveryEnabled = networks.filter(
    (network) => network.discoveryStatus === "Discovery Non Enabled"
  ).length;
  const discoveryEnabledNetworkIds = new Set(
    networks.filter((network) => network.discoveryStatus === "Discovery Enabled").map((network) => network.id)
  );
  const networksDiscoveryNonCompliant = new Set(
    analytics.evaluations
      .filter(
        (evaluation) =>
          discoveryEnabledNetworkIds.has(evaluation.networkId) && !evaluation.discoveryCoverageCompliant
      )
      .map((evaluation) => evaluation.networkId)
  ).size;
  const targetStateSummaryByNetworkId = buildNetworkTargetStateSummary(
    networks,
    filteredAssets.map((asset) => ({
      networkId: asset.networkId,
      assetType: asset.type,
      name: asset.name || asset.hostname || asset.id
    }))
  );
  const networksWithNoTargetState = networks.filter(
    (network) => !targetStateSummaryByNetworkId.get(network.id)?.targetStateProvided
  ).length;

  const criticalIctStatuses = analytics.evaluations
    .filter((evaluation) => evaluation.systemCriticality === "Critical")
    .flatMap((evaluation) => evaluation.evaluations.map((item) => item.status));

  const scopedNetworkIds = new Set(networks.map((network) => network.id));
  const scopedNetworkRollups = analytics.networkRollups.filter(
    (rollup) => rollup.scopeType === "network" && scopedNetworkIds.has(rollup.scopeId)
  );
  const allComplianceCounts = complianceCounts(statusesWithEnvironment.map((item) => item.status));
  const dseCounts = dseComplianceCounts(statusesWithEnvironment);
  const dpeCounts = dpeComplianceCounts(statusesWithEnvironment);
  const criticalIctCounts = complianceCounts(criticalIctStatuses);
  const networkComplianceCounts = rollupComplianceCounts(scopedNetworkRollups);
  const complianceScoreCards = [
    complianceScoreCard("Overall Compliance", "Current Cyber COP scope", allComplianceCounts),
    complianceScoreCard("DSE Compliance", "Non-production environments", dseCounts),
    complianceScoreCard("DPE Compliance", "Production environments", dpeCounts),
    complianceScoreCard("Critical ICT Systems Compliance", "Critical ICT systems", criticalIctCounts),
    complianceScoreCard("Networks Compliance", "Current network scope", networkComplianceCounts)
  ];

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
  const immediateAction = highRiskOpenCount + criticalExposureOpenCount;
  const serversWithCriticalFindings = new Set(
    openFindings
      .filter((finding) => finding.severity === "Critical Exposure")
      .map((finding) => filteredAssetsById.get(finding.scope.assetId))
      .filter((asset): asset is Asset => asset !== undefined && asset.type === "server")
      .map((asset) => asset.id)
  ).size;

  const chartAnchorDateKey = selectedDataDate ?? dataset.snapshotDate;
  const chartWindowEndDateKey = selectedDataDate ?? todayDateKey();
  const highRiskDaily = buildOpenFindingsDailySeries(
    analytics.findings,
    "High Risk",
    chartWindowEndDateKey,
    dataset.snapshotDate
  );
  const criticalExposureDaily = buildOpenFindingsDailySeries(
    analytics.findings,
    "Critical Exposure",
    chartWindowEndDateKey,
    dataset.snapshotDate
  );
  const weeklyRiskTrend = buildWeeklyRiskTrend(highRiskDaily, criticalExposureDaily, 13);

  const missionImpact = buildMissionCapabilityImpact(openFindings, systems);
  const businessImpact = buildBusinessServiceImpact(openFindings, systems);
  const systemImpact = buildSystemImpact(openFindings, systems);
  const impactLinks = buildImpactLinks(systems);
  const impactAssetTypeHeatmapBySystemId = buildImpactAssetTypeHeatmapBySystemId(filteredAssets, openFindings, systems);
  const impactSpiDrivers = buildImpactSpiDrivers(openFindings, spiDefinitions);
  const impactSpiDriversBySystemId = buildImpactSpiDriversBySystemId(openFindings, spiDefinitions);
  const impactEnvironmentSplit = buildImpactEnvironmentSplit(openFindings);
  const impactEnvironmentSplitBySystemId = buildImpactEnvironmentSplitBySystemId(openFindings);
  const impactEntityTrends = buildImpactEntityTrends(analytics.findings, systemImpact, chartAnchorDateKey, 5);
  const actionOldestOpenFindings = buildActionOldestOpenFindings(
    openFindings,
    systems,
    chartAnchorDateKey,
    12
  );
  const actionQuickWins = buildActionQuickWins(openFindings, 10);
  const diisSystems = systems.filter((system) => system.diisDefined);
  const modelledDiisSystems = diisSystems.filter((system) => system.modellingStatus);
  const ictSystemsNotModelled = diisSystems.length - modelledDiisSystems.length;
  const modelledDiisSystemIds = new Set(modelledDiisSystems.map((system) => system.id));
  const modelledDiscoveryNonCompliantCount = new Set(
    analytics.evaluations
      .filter(
        (evaluation) =>
          Boolean(evaluation.systemId) &&
          modelledDiisSystemIds.has(evaluation.systemId as string) &&
          !evaluation.discoveryCoverageCompliant
      )
      .map((evaluation) => evaluation.systemId as string)
  ).size;

  return (
    <FullHeightWorkspace data-cyber-cop-page="true">
      <RouteReadyMarker pathname="/cyber-cop" searchParams={searchParams} />
      <CyberCopDashboard
        snapshotDate={dataset.snapshotDate}
        filtersSlot={
          <div className="-mt-2">
            <FilterBar
              options={filterOptions}
              filters={filters}
              hiddenFields={["managedNetwork", "ictSystem", "systemCriticality", "assetType"]}
              enableLoadingOverlay
            />
          </div>
        }
        networkSpiHeatmapFilterSlot={
          <div className="-mt-2">
            <FilterBar
              options={networkHeatmapData.filterOptions}
              filters={networkHeatmapData.filters}
              hiddenFields={["ictSystem", "systemCriticality", "environment"]}
              extraSelectFields={networkHeatmapExtraSelects}
              enableLoadingOverlay
            />
          </div>
        }
        systemSpiHeatmapFilterSlot={
          <div className="-mt-2">
            <FilterBar
              options={systemHeatmapData.filterOptions}
              filters={systemHeatmapData.filters}
              hiddenFields={["managedNetwork"]}
              extraSelectFields={systemHeatmapExtraSelects}
              enableLoadingOverlay
            />
          </div>
        }
        networkSpiHeatmapModel={networkSpiHeatmapModel}
        systemSpiHeatmapModel={systemSpiHeatmapModel}
        spiDefinitions={spiDefinitions}
        selectedSpiId={selectedSpiId}
        initialMeasureSearch={measureSearch}
        complianceScoreCards={complianceScoreCards}
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
        impact={{
          business: businessImpact,
          mission: missionImpact,
          systems: systemImpact
        }}
        impactLinks={impactLinks}
        impactAssetTypeHeatmapBySystemId={impactAssetTypeHeatmapBySystemId}
        impactSpiDrivers={impactSpiDrivers}
        impactSpiDriversBySystemId={impactSpiDriversBySystemId}
        impactEnvironmentSplit={impactEnvironmentSplit}
        impactEnvironmentSplitBySystemId={impactEnvironmentSplitBySystemId}
        impactEntityTrends={impactEntityTrends}
        actionPlan={{
          immediateAction,
          nonCompliantOs,
          nonCompliantOsTotal,
          assetsOutOfWarrantyEol,
          scopedAssetsTotal,
          serversWithCriticalFindings,
          scopedServersTotal,
          networksWithoutDiscoveryEnabled,
          scopedNetworksTotal: networks.length,
          networksDiscoveryNonCompliant,
          networksWithNoTargetState,
          diisIctSystemsDefined: diisSystems.length,
          ictSystemsNotModelled,
          ictSystemsModelled: modelledDiisSystems.length,
          ictSystemsModelledDiscoveryNonCompliant: modelledDiscoveryNonCompliantCount
        }}
        actionOldestOpenFindings={actionOldestOpenFindings}
        actionQuickWins={actionQuickWins}
        dailyHighRisk={highRiskDaily}
        dailyCriticalExposure={criticalExposureDaily}
      />
    </FullHeightWorkspace>
  );
}
