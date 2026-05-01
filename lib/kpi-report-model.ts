import { KpiRow, buildKpiRows } from "@/lib/measures";
import { AnalyticsResult, ICTSystem, ManagedNetwork } from "@/lib/types";

export interface KpiReportModel {
  id: string;
  name: string;
  reportName: string;
  indicatorLabel: string;
  description: string;
  successMeasure: string;
  score: string;
  scorePercent: number;
  compliant: number;
  nonCompliant: number;
  unknown: number;
  total: number;
  reportAvailable: boolean;
  sourceRow: KpiRow;
}

export interface KpiReportSnapshotInput {
  snapshotDate: string;
  analytics: AnalyticsResult;
  systems: ICTSystem[];
  networks: ManagedNetwork[];
}

export interface KpiTrendReportPoint {
  snapshotDate: string;
  scorePercent: number;
  compliant: number;
  nonCompliant: number;
  unknown: number;
  total: number;
}

export interface KpiTrendReportModel {
  reportName: string;
  current: KpiReportModel;
  rangeStartDate: string;
  rangeEndDate: string;
  trendPoints: KpiTrendReportPoint[];
}

const KPI_REPORT_AVAILABLE_IDS = new Set(["KPI-5", "KPI-6", "KPI-7", "KPI-8", "KPI-9", "KPI-10"]);

export function isKpiReportAvailable(kpiId: string): boolean {
  return KPI_REPORT_AVAILABLE_IDS.has(kpiId);
}

function toKpiReportModel(row: KpiRow): KpiReportModel {
  return {
    id: row.id,
    name: row.name,
    reportName: `${row.id} Report: ${row.name}`,
    indicatorLabel: row.id,
    description: row.description,
    successMeasure: row.successMeasure,
    score: row.score,
    scorePercent: row.scorePercent,
    compliant: row.compliantCount,
    nonCompliant: row.nonCompliantCount,
    unknown: row.unknownCount,
    total: row.applicableCount,
    reportAvailable: isKpiReportAvailable(row.id),
    sourceRow: row
  };
}

export function buildKpiReportModels(
  analytics: AnalyticsResult,
  systems: ICTSystem[],
  networks: ManagedNetwork[]
): KpiReportModel[] {
  return buildKpiRows(analytics, systems, networks).map(toKpiReportModel);
}

export function buildKpiReportModel({
  analytics,
  systems,
  networks,
  kpiId
}: {
  analytics: AnalyticsResult;
  systems: ICTSystem[];
  networks: ManagedNetwork[];
  kpiId: string;
}): KpiReportModel | null {
  return buildKpiReportModels(analytics, systems, networks).find((model) => model.id === kpiId) ?? null;
}

export function buildKpiTrendReportModel({
  snapshots,
  kpiId
}: {
  snapshots: KpiReportSnapshotInput[];
  kpiId: string;
}): KpiTrendReportModel | null {
  const snapshotModels = snapshots
    .map((snapshot) => {
      const model = buildKpiReportModel({
        analytics: snapshot.analytics,
        systems: snapshot.systems,
        networks: snapshot.networks,
        kpiId
      });
      return model ? { snapshotDate: snapshot.snapshotDate, model } : null;
    })
    .filter((item): item is { snapshotDate: string; model: KpiReportModel } => Boolean(item));

  if (!snapshotModels.length) {
    return null;
  }

  const current = snapshotModels[snapshotModels.length - 1].model;
  if (!current.reportAvailable) {
    return null;
  }

  const trendPoints: KpiTrendReportPoint[] = snapshotModels.map(({ snapshotDate, model }) => ({
    snapshotDate,
    scorePercent: model.scorePercent,
    compliant: model.compliant,
    nonCompliant: model.nonCompliant,
    unknown: model.unknown,
    total: model.total
  }));

  return {
    reportName: `${current.id} Trend Report: ${current.name}`,
    current,
    rangeStartDate: trendPoints[0].snapshotDate,
    rangeEndDate: trendPoints[trendPoints.length - 1].snapshotDate,
    trendPoints
  };
}
