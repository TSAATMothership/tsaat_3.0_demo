import { buildKpiReportModels } from "@/lib/kpi-report-model";
import { SPI_REPORT_ASSET_TYPE_GROUPS, spiReportAssetTypeGroup, type SpiReportAssetTypeBreakdown } from "@/lib/spi-report-model";
import { buildTaskingReportHref } from "@/lib/tasking-report-links";
import type { MeasureRecord } from "@/lib/measures-explorer";
import { buildSpiRows, type KpiRow } from "@/lib/measures";
import type { SpiDefinition } from "@/lib/spi-definitions";
import type { AnalyticsResult, Dataset, Filters } from "@/lib/types";

export function buildKpiExplorerRows(rows: KpiRow[], filters: Filters, snapshotDate: string): MeasureRecord[] {
  return buildKpiReportModels(rows).map((row) => ({
    id: row.id, name: row.name, description: row.description, successMeasure: row.successMeasure,
    scorePercent: row.scorePercent, compliant: row.compliant, nonCompliant: row.nonCompliant, unknown: row.unknown, total: row.total,
    reportHref: row.reportAvailable ? buildTaskingReportHref({ kind: "kpi", id: row.id, filters, dataDate: snapshotDate }) : null,
    trendHref: row.reportAvailable ? buildTaskingReportHref({ kind: "kpi-trend", id: row.id, filters, dataDate: snapshotDate }) : null,
    assetTypeBreakdown: [], highPriorityCount: row.sourceRow.highPriorityCount
  }));
}
export function buildSpiExplorerRows(dataset: Dataset, analytics: AnalyticsResult, definitions: SpiDefinition[], filters: Filters): MeasureRecord[] {
  // Summary/table payloads need aggregate counts, not the PDF report's per-CI annexes.
  const rows = buildSpiRows(analytics, definitions);
  const groups = new Map(rows.map((row) => [row.spiId, new Map(SPI_REPORT_ASSET_TYPE_GROUPS.map((group) => [group.id, { ...group, nonCompliant: 0, unknown: 0 } as SpiReportAssetTypeBreakdown]))]));
  const assetTypes = new Map(dataset.assets.map((asset) => [asset.id, asset.type]));
  for (const asset of analytics.evaluations) {
    const type = spiReportAssetTypeGroup(assetTypes.get(asset.assetId) ?? asset.assetType);
    for (const result of asset.evaluations) {
      const group = groups.get(result.spiId)?.get(type);
      if (group && result.status === "Non-compliant") group.nonCompliant += 1;
      if (group && result.status === "Unknown") group.unknown += 1;
    }
  }
  return rows.map((row) => ({
    id: `SPI-${row.spiId}`, name: row.name, description: row.description, successMeasure: row.successMeasure,
    scorePercent: row.scorePercent, compliant: row.compliant, nonCompliant: row.nonCompliant, unknown: row.unknown, total: row.total,
    reportHref: row.reportAvailable ? buildTaskingReportHref({ kind: "spi", id: String(row.spiId), filters, dataDate: dataset.snapshotDate }) : null,
    trendHref: row.trendReportAvailable ? buildTaskingReportHref({ kind: "spi-trend", id: String(row.spiId), filters, dataDate: dataset.snapshotDate }) : null,
    assetTypeBreakdown: Array.from(groups.get(row.spiId)!.values())
  }));
}
