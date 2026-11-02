import type { MeasureRecord } from "@/lib/measures-explorer";
import type { MeasuresSettings, FindingPriorityDefinition } from "@/lib/measures-settings";
import type { SeverityDefinition, SpiDefinition } from "@/lib/spi-definitions";
import type { AnalyticsResult } from "@/lib/types";
import { findingsByDuration } from "@/lib/findings-duration";

function indicatorSummary(rows: readonly MeasureRecord[], order: "non-compliant" | "compliance" = "non-compliant") {
  return {
    total: rows.length,
    nonCompliant: rows.filter((row) => row.nonCompliant > 0).length,
    unknown: rows.filter((row) => row.unknown > 0).length,
    fullyCompliant: rows.filter((row) => row.total > 0 && row.compliant === row.total).length,
    unassessed: rows.filter((row) => row.total === 0).length,
    review: rows.filter((row) => row.nonCompliant > 0 || row.unknown > 0)
      .sort((a, b) => (order === "compliance" ? a.scorePercent - b.scorePercent : 0)
        || b.nonCompliant - a.nonCompliant || b.unknown - a.unknown || a.id.localeCompare(b.id, undefined, { numeric: true }))
  };
}
function assessmentSummary(rows: readonly MeasureRecord[]) {
  const assessed = rows.reduce((sum, row) => sum + row.total, 0);
  const compliant = rows.reduce((sum, row) => sum + row.compliant, 0);
  const nonCompliant = rows.reduce((sum, row) => sum + row.nonCompliant, 0);
  const unknown = rows.reduce((sum, row) => sum + row.unknown, 0);
  return { assessed, compliant, nonCompliant, unknown, percent: assessed ? Math.round(compliant / assessed * 1000) / 10 : null };
}
export function buildMeasuresSummary({ kpis, spis, analytics, settings, spiDefinitions, severityDefinitions, priorityDefinitions, snapshotDate }: {
  kpis: MeasureRecord[]; spis: MeasureRecord[]; analytics: AnalyticsResult; settings: MeasuresSettings;
  spiDefinitions: SpiDefinition[]; severityDefinitions: SeverityDefinition[]; priorityDefinitions: FindingPriorityDefinition[];
  snapshotDate: string;
}) {
  const activeIds = new Set(spiDefinitions.map((definition) => definition.spiId));
  const open = analytics.findings.filter((finding) => finding.status === "open");
  const affected = analytics.evaluations.filter((asset) => asset.evaluations.some((evaluation) => activeIds.has(evaluation.spiId) && evaluation.status === "Non-compliant"));
  const unknown = analytics.evaluations.filter((asset) => asset.evaluations.some((evaluation) => activeIds.has(evaluation.spiId) && evaluation.status === "Unknown"));
  const severities = [...severityDefinitions].sort((a, b) => a.displayOrder - b.displayOrder).map((definition) => ({
    key: definition.severityKey, label: definition.label, count: open.filter((finding) => finding.severity === definition.severityKey).length
  }));
  for (const finding of open) {
    if (!severities.some((item) => item.key === finding.severity)) severities.push({ key: finding.severity, label: finding.severity, count: open.filter((row) => row.severity === finding.severity).length });
  }
  const priorityFocus = spiDefinitions.map((definition) => {
    const rank = settings.priorityMatrix[String(definition.spiId)] ?? definition.priorityOrder;
    const configured = priorityDefinitions.find((item) => item.priorityRank === rank);
    return {
      id: `SPI-${definition.spiId}`, name: definition.name, rank,
      priority: configured?.label ?? `P${rank}`,
      nonCompliant: open.filter((finding) => finding.spiId === definition.spiId && finding.complianceStatus === "Non-compliant").length
    };
  }).filter((row) => row.nonCompliant > 0).sort((a, b) => a.rank - b.rank || b.nonCompliant - a.nonCompliant || a.id.localeCompare(b.id));
  return {
    kpis: indicatorSummary(kpis), spis: indicatorSummary(spis, "compliance"),
    totalCis: new Set(analytics.evaluations.map((asset) => asset.assetId)).size,
    affectedCis: new Set(affected.map((asset) => asset.assetId)).size,
    unknownCis: new Set(unknown.map((asset) => asset.assetId)).size,
    affectedNetworks: new Set(affected.map((asset) => asset.networkId)).size,
    affectedSystems: new Set(affected.map((asset) => asset.systemId).filter(Boolean)).size,
    kpiAssessment: assessmentSummary(kpis),
    spiAssessment: assessmentSummary(spis),
    openFindings: open.length,
    findingsByDuration: findingsByDuration(open, snapshotDate),
    openUnknownFindings: open.filter((finding) => finding.complianceStatus === "Unknown").length,
    severities, priorityFocus, settingsUpdatedAt: settings.updatedAt
  };
}
export type MeasuresSummaryModel = ReturnType<typeof buildMeasuresSummary>;
