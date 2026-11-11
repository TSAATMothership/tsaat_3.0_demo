import type { ComplianceHeatmapModel } from "@/lib/compliance-heatmap";
import type { NetworkDetailsModel } from "@/lib/network-details";
import type { IctSystemDetailsModel } from "@/lib/ict-system-details";
import { findingDurationDays, findingsByDuration } from "@/lib/findings-duration";
import { measuresScopeParams } from "@/lib/measures-explorer";
import type { SeverityDefinition } from "@/lib/spi-definitions";
import type { Asset, AssetSpiEvaluation, ComplianceStatus, Criticality, Finding, Filters, NetworkDiscoveryStatus } from "@/lib/types";

export type RiskProfileKind = "network" | "system";
const DAY = 86_400_000;

function assessmentCounts(statuses: ComplianceStatus[]) {
  const compliant = statuses.filter(status => status === "Compliant").length;
  const nonCompliant = statuses.filter(status => status === "Non-compliant").length;
  return { compliant, nonCompliant, unknown: statuses.length - compliant - nonCompliant, total: statuses.length,
    percent: statuses.length ? Math.round(compliant / statuses.length * 1000) / 10 : null };
}

export function groupRiskItems<T>(items: T[], scopeId: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const id = scopeId(item);
    const group = groups.get(id) ?? [];
    group.push(item);
    groups.set(id, group);
  }
  return groups;
}

export function summarizeRiskAssets(assets: Asset[], evaluations: AssetSpiEvaluation[], findings: Finding[], snapshotDate: string) {
  const evaluationById = new Map(evaluations.map(evaluation => [evaluation.assetId, evaluation]));
  const spi = assessmentCounts(evaluations.flatMap(evaluation => evaluation.evaluations.map(item => item.status)));
  const discovery = assessmentCounts(assets.map(asset => {
    const evaluation = evaluationById.get(asset.id);
    return !evaluation ? "Unknown" : evaluation.discoveryCoverageCompliant ? "Compliant" : "Non-compliant";
  }));
  const unassessedCis = assets.filter(asset => !evaluationById.get(asset.id)?.evaluations.length).length;
  const open = findings.filter(finding => finding.status === "open");
  const ages = open.map(finding => findingDurationDays(finding, snapshotDate)).filter((age): age is number => age !== null);
  return {
    ciCount: assets.length, spi, discovery, unassessedCis,
    status: !spi.total ? "No assessments" : spi.nonCompliant ? "Non-compliant" : spi.unknown || unassessedCis ? "Unknown" : "Compliant",
    openFindings: open.length, critical: open.filter(finding => finding.severity === "Critical Exposure").length,
    high: open.filter(finding => finding.severity === "High Risk").length, overdue: ages.filter(age => age > 90).length,
    oldestDays: ages.length ? ages.reduce((maximum, age) => Math.max(maximum, age), 0) : null
  };
}

function dayNumber(timestamp?: string | null): number | null {
  if (!timestamp) return null;
  const value = Date.parse(timestamp);
  return Number.isFinite(value) ? Math.floor(value / DAY) : null;
}

/** Reconstruct recorded open findings, with closure effective on the recorded UTC date. */
export function buildRiskTrend(findings: Finding[], snapshotDate: string) {
  const end = dayNumber(snapshotDate)!;
  const start = end - 364;
  const events = { critical: new Map<number, number>(), high: new Map<number, number>() };
  let undated = 0;
  for (const finding of findings) {
    const series = finding.severity === "Critical Exposure" ? events.critical : finding.severity === "High Risk" ? events.high : null;
    if (!series) continue;
    const opened = dayNumber(finding.timestamp);
    const closed = finding.status === "closed" ? dayNumber(finding.closedTimestamp) : null;
    if (opened === null || (finding.status === "closed" && (closed === null || closed < opened))) { undated += 1; continue; }
    if (opened > end || (closed !== null && closed < start)) continue;
    const first = Math.max(start, opened);
    series.set(first, (series.get(first) ?? 0) + 1);
    if (closed !== null && closed <= end) series.set(closed, (series.get(closed) ?? 0) - 1);
  }
  let critical = 0;
  let high = 0;
  const points = Array.from({ length: 365 }, (_, offset) => {
    const day = start + offset;
    critical += events.critical.get(day) ?? 0;
    high += events.high.get(day) ?? 0;
    return { date: new Date(day * DAY).toISOString().slice(0, 10), critical, high };
  });
  return { points, undated };
}

export function summarizeRiskFindings(findings: Finding[], snapshotDate: string, severityDefinitions: SeverityDefinition[]) {
  const open = findings.filter(finding => finding.status === "open");
  const severities = [...severityDefinitions].sort((a, b) => a.displayOrder - b.displayOrder)
    .map(definition => ({ key: definition.severityKey, label: definition.label, count: 0 }));
  for (const finding of open) {
    let severity = severities.find(item => item.key === finding.severity);
    if (!severity) { severity = { key: finding.severity, label: finding.severity, count: 0 }; severities.push(severity); }
    severity.count += 1;
  }
  return { severities, findingsByDuration: findingsByDuration(open, snapshotDate), trend: buildRiskTrend(findings, snapshotDate),
    openFindings: open.length, severeFindings: open.filter(finding => finding.severity === "Critical Exposure" || finding.severity === "High Risk").length,
    overdueFindings: open.filter(finding => (findingDurationDays(finding, snapshotDate) ?? 0) > 90).length,
    p1p2: open.filter(finding => finding.priorityRank > 0 && finding.priorityRank <= 2).length };
}

export const compareRiskRows = (a: RiskProfileRow, b: RiskProfileRow) =>
  b.critical - a.critical || b.high - a.high || b.overdue - a.overdue || b.openFindings - a.openFindings || a.name.localeCompare(b.name);

export function riskProfileHref(path: string, filters: Filters, snapshotDate: string, kind: RiskProfileKind, entityId?: string, extra: Record<string, string> = {}): string {
  const params = measuresScopeParams(filters, snapshotDate);
  if (entityId) params.set(kind, entityId);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `${path}?${params}`;
}

export type RiskProfileRow = ReturnType<typeof summarizeRiskAssets> & {
  id: string; name: string; securityDomain: string; classification: string; criticality: Criticality; modellingStatus: boolean;
  owner: string; description: string; context: string;
  systemCount?: number; discoveryStatus?: NetworkDiscoveryStatus;
  networkCount?: number; atoNumber?: string; diisId?: string;
  networkDetails?: NetworkDetailsModel;
  systemDetails?: IctSystemDetailsModel;
};
export type RiskProfileModel = ReturnType<typeof summarizeRiskFindings> & Pick<ReturnType<typeof summarizeRiskAssets>, "ciCount" | "spi" | "discovery" | "unassessedCis"> & {
  kind: RiskProfileKind; snapshotDate: string; rows: RiskProfileRow[]; entityCount: number; compliantCount: number;
  networkCount: number; systemCount: number; modelled: number;
  metadata: Array<{ label: string; count: number; total: number }>;
  heatmap: ComplianceHeatmapModel;
};
