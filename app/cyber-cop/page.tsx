import {
  CyberCopDashboard,
  type CyberCopDailyTrendPoint,
  type CyberCopImpactItem
} from "@/components/cyber-cop-dashboard";
import { FilterBar } from "@/components/filter-bar";
import { getCoreAppData } from "@/lib/app-data";
import { applyAssetFilters } from "@/lib/selectors";
import { Asset, ComplianceStatus, Criticality, Finding, FindingSeverity } from "@/lib/types";

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

function ratioPercent(numerator: number, denominator: number): number {
  if (!denominator) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(1));
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

function countNonCompliantOs(
  assets: Asset[],
  evaluationByAssetId: Map<
    string,
    {
      evaluations: Array<{ spiId: number; status: ComplianceStatus }>;
    }
  >
): number {
  return assets.filter((asset) => {
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
): CyberCopDailyTrendPoint[] {
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
    return {
      weekLabel: formatUtcDay(pointDate),
      highRiskCount: highRiskByDate.get(pointDateKey) ?? 0,
      criticalExposureCount: criticalExposureByDate.get(pointDateKey) ?? 0
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

export default async function CyberCopPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { analytics, filterOptions, filters, dataset, systems, networks } = await getCoreAppData(searchParams);

  const statusesWithEnvironment = analytics.evaluations.flatMap((evaluation) =>
    evaluation.evaluations.map((item) => ({
      environmentType: evaluation.environmentType,
      status: item.status
    }))
  );

  const filteredAssets = applyAssetFilters(dataset.assets, systems, filters);
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const nonCompliantOs = countNonCompliantOs(filteredAssets, evaluationByAssetId);
  const outOfWarranty = filteredAssets.filter((asset) => asset.lifecycle.warrantyStatus === "OutOfWarranty").length;
  const discoveryCoverageGaps = analytics.evaluations.filter((evaluation) => !evaluation.discoveryCoverageCompliant).length;
  const networkNotDiscovered = networks.filter(
    (network) => network.discoveryStatus === "Discovery Non Enabled"
  ).length;

  const criticalIctStatuses = analytics.evaluations
    .filter((evaluation) => evaluation.systemCriticality === "Critical")
    .flatMap((evaluation) => evaluation.evaluations.map((item) => item.status));
  const criticalIctSystemsCompliance = complianceScore(criticalIctStatuses);

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
  const immediateAction = highRiskOpenCount + criticalExposureOpenCount;
  const plannedRemediation = openFindings.filter(
    (finding) => finding.priorityRank >= 3 && finding.priorityRank < 90
  ).length;

  const todayDateKey = toUtcDateKey(new Date());
  const highRiskDaily = buildOpenFindingsDailySeries(analytics.findings, "High Risk", todayDateKey);
  const criticalExposureDaily = buildOpenFindingsDailySeries(analytics.findings, "Critical Exposure", todayDateKey);
  const weeklyRiskTrend = buildWeeklyRiskTrend(highRiskDaily, criticalExposureDaily, 13);

  const missionImpact = buildMissionCapabilityImpact(openFindings, systems);
  const businessImpact = buildBusinessServiceImpact(openFindings, systems);
  const systemImpact = buildSystemImpact(openFindings, systems);
  const diisSystems = systems.filter((system) => system.diisDefined);
  const modelledDiisSystems = diisSystems.filter((system) => system.modellingStatus);
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
    <div className="relative left-1/2 w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 space-y-4 md:w-[min(2100px,calc(100vw-3rem))]">
      <section className="panel relative overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_5%_0%,rgba(14,165,233,0.24),transparent_38%),radial-gradient(circle_at_95%_20%,rgba(249,115,22,0.18),transparent_45%)]" />
        <div className="relative">
          <h1 className="text-3xl font-semibold text-slate-100">Cyber COP</h1>
          <p className="mt-2 whitespace-nowrap text-sm text-slate-300/90">
            Strategic window for the Senior Cyber Operations executive team, showing where effort should be concentrated
            to improve cyber posture across the Defence Cyber Terrain.
          </p>
        </div>
      </section>

      <FilterBar
        options={filterOptions}
        filters={filters}
        hiddenFields={["managedNetwork", "ictSystem", "systemCriticality", "assetType"]}
        enableLoadingOverlay
      />

      <CyberCopDashboard
        snapshotDate={dataset.snapshotDate}
        complianceScores={{
          overall: analytics.overallCompliancePercent,
          dse: dseComplianceScore(statusesWithEnvironment),
          dpe: dpeComplianceScore(statusesWithEnvironment),
          ictSystems: criticalIctSystemsCompliance,
          networks: networksCompliance
        }}
        riskProfile={{
          openFindings: openFindings.length,
          p1p2Count,
          highRiskOpenCount,
          criticalExposureOpenCount,
          severitySummary,
          weeklyTrend: weeklyRiskTrend
        }}
        impact={{
          business: businessImpact,
          mission: missionImpact,
          systems: systemImpact
        }}
        modellingSummary={{
          diisDefinedCount: diisSystems.length,
          modelledCount: modelledDiisSystems.length,
          modelledDiscoveryNonCompliantCount
        }}
        actionPlan={{
          immediateAction,
          plannedRemediation,
          nonCompliantOs,
          outOfWarranty,
          discoveryCoverageGaps,
          networkNotDiscovered,
          unmodelledIctSystems: diisSystems.length - modelledDiisSystems.length
        }}
        dailyHighRisk={highRiskDaily}
        dailyCriticalExposure={criticalExposureDaily}
      />
    </div>
  );
}
