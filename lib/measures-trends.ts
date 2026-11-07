import { firstSearchParam, subtractCalendarMonthsDateKey } from "@/lib/data-date";
import { securityDomainSelection } from "@/lib/security-domain.mjs";
import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import type { SpiDefinition } from "@/lib/spi-definitions";
import type { KpiRow, SpiRow } from "@/lib/measures";

export const MEASURE_HISTORY_OPTIONS = [
  { value: "week", label: "1 week", months: 1 }, { value: "4weeks", label: "4 weeks", months: 1 },
  { value: "3months", label: "3 months", months: 3 }, { value: "6months", label: "6 months", months: 6 },
  { value: "12months", label: "12 months", months: 12 }
] as const;
export type MeasureHistory = typeof MEASURE_HISTORY_OPTIONS[number]["value"];
export type MeasureTrendTab = "kpi" | "spi";
export function measureHistory(value: WorkspaceSearchParams[string]): MeasureHistory {
  return MEASURE_HISTORY_OPTIONS.find(option => option.value === firstSearchParam(value))?.value ?? "4weeks";
}
export const measureTrendTab = (value: WorkspaceSearchParams[string]): MeasureTrendTab => firstSearchParam(value) === "spi" ? "spi" : "kpi";
export function measurePeriodStart(history: MeasureHistory, cutoff: string): string {
  return history === "week" || history === "4weeks"
    ? new Date(Date.parse(cutoff + "T00:00:00Z") - (history === "week" ? 7 : 28) * 86400000).toISOString().slice(0, 10)
    : subtractCalendarMonthsDateKey(cutoff, MEASURE_HISTORY_OPTIONS.find(option => option.value === history)!.months);
}
/** Inclusive actual dates, one latest revision per day; never use the reader's future fallback. */
export function measureSnapshotsInPeriod<T extends { snapshotDate: string; snapshotId?: number }>(snapshots: T[], from: string, cutoff: string): T[] {
  const dates = new Map<string, T>();
  for (const snapshot of [...snapshots].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate) || (a.snapshotId ?? 0) - (b.snapshotId ?? 0))) {
    if (snapshot.snapshotDate >= from && snapshot.snapshotDate <= cutoff) dates.set(snapshot.snapshotDate, snapshot);
  }
  return [...dates.values()];
}
export interface MeasureTrendPoint {
  date: string; compliant: number; nonCompliant: number; unknown: number; total: number; percent: number | null; recorded: boolean;
}
export interface MeasureTrendSeries {
  id: string; name: string; description: string; successMeasure: string; unit: "ICT systems" | "CI checks"; points: MeasureTrendPoint[];
}
export interface MeasureObservation { snapshotDate: string; snapshotId?: number; kpis: KpiRow[]; spis: SpiRow[] }
export function measureMovement(points: MeasureTrendPoint[]) {
  const first = points[0]?.percent, last = points.at(-1)?.percent;
  const delta = points.length < 2 || first == null || last == null ? null : Math.round((last - first) * 10) / 10;
  return { delta, label: delta === null ? "No comparison" : delta > 0 ? "Improving" : delta < 0 ? "Declining" : "Unchanged",
    tone: delta === null ? "muted" : delta > 0 ? "good" : delta < 0 ? "bad" : "neutral" };
}
export function buildMeasuresTrends(observations: MeasureObservation[], kpiDefinitions: KpiDefinition[], spiDefinitions: SpiDefinition[], params: WorkspaceSearchParams, cutoff: string) {
  const history = measureHistory(params.measureHistory), from = measurePeriodStart(history, cutoff);
  const snapshots = measureSnapshotsInPeriod(observations, from, cutoff);
  const point = (date: string, row?: { compliant: number; nonCompliant: number; unknown: number; total: number; scorePercent: number }): MeasureTrendPoint => ({
    date, compliant: row?.compliant ?? 0, nonCompliant: row?.nonCompliant ?? 0, unknown: row?.unknown ?? 0, total: row?.total ?? 0,
    percent: row && row.total > 0 ? row.scorePercent : null, recorded: Boolean(row)
  });
  const kpi: MeasureTrendSeries[] = [...kpiDefinitions].sort((a, b) => a.displayOrder - b.displayOrder).map(definition => ({
    id: definition.id, name: definition.name, description: definition.description, successMeasure: definition.successMeasure, unit: "ICT systems",
    points: snapshots.map(snapshot => {
      const row = snapshot.kpis.find(row => row.id === definition.id);
      return point(snapshot.snapshotDate, row ? { compliant: row.compliantCount, nonCompliant: row.nonCompliantCount, unknown: row.unknownCount, total: row.applicableCount, scorePercent: row.scorePercent } : undefined);
    })
  }));
  const spi: MeasureTrendSeries[] = [...spiDefinitions].sort((a, b) => a.displayOrder - b.displayOrder).map(definition => ({
    id: `SPI-${definition.spiId}`, name: definition.name, description: definition.description, successMeasure: definition.successMeasure, unit: "CI checks",
    points: snapshots.map(snapshot => point(snapshot.snapshotDate, snapshot.spis.find(row => row.spiId === definition.spiId)))
  }));
  return { history, from, cutoff, dates: snapshots.map(snapshot => snapshot.snapshotDate), kpi, spi,
    scope: { network: scopeIds(params.network), system: scopeIds(params.system), securityDomain: params.securityDomain, dataDate: cutoff },
    domains: securityDomainSelection(params.securityDomain) };
}
export type MeasuresTrendsModel = ReturnType<typeof buildMeasuresTrends>;

/** SVG geometry is shared by the overview and detail; a missing result breaks the line. */
export function measureChartGeometry(points: MeasureTrendPoint[], from: string, to: string) {
  const duration = Date.parse(to) - Date.parse(from);
  const plotted = points.map(point => ({ ...point, x: duration ? 40 + (Date.parse(point.date) - Date.parse(from)) / duration * 640 : 360,
    y: point.percent === null ? null : 210 - point.percent / 100 * 180 }));
  const paths: string[] = []; let segment = "";
  for (const point of plotted) {
    if (point.y === null) { if (segment) paths.push(segment); segment = ""; }
    else segment += `${segment ? " L" : "M"}${point.x},${point.y}`;
  }
  if (segment) paths.push(segment);
  return { plotted, paths };
}
