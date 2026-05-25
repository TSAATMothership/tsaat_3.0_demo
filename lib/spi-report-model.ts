import { ASSET_TYPE_LABELS } from "@/lib/asset-taxonomy";
import { buildSpiRows, SpiRow } from "@/lib/measures";
import { remediationActionsForSpi } from "@/lib/tasking";
import { SpiDefinition, spiDefinitionById } from "@/lib/spi-definitions";
import { AnalyticsResult, Asset, AssetType, ComplianceStatus, Dataset, SpiId } from "@/lib/types";

export type SpiReportAssetTypeGroupId =
  | "server"
  | "workstation"
  | "network-device"
  | "storage-device"
  | "printer-device"
  | "other";

export interface SpiReportAssetTypeBreakdown {
  id: SpiReportAssetTypeGroupId;
  label: string;
  nonCompliant: number;
  unknown: number;
}

export interface SpiReportAnnexRow {
  assetId: string;
  ciName: string;
  assetType: AssetType;
  assetTypeLabel: string;
  score: ComplianceStatus;
  reasons: string[];
}

export interface SpiReportModel {
  spiId: SpiId;
  name: string;
  reportName: string;
  indicatorLabel: string;
  description: string;
  successMeasure: string;
  scorePercent: number;
  compliant: number;
  nonCompliant: number;
  unknown: number;
  total: number;
  assetTypeBreakdown: SpiReportAssetTypeBreakdown[];
  reportAvailable: boolean;
  trendReportAvailable: boolean;
  reportDetailKey: string;
  observedNonCompliantCondition: string;
  observedUnknownCondition: string;
  remediationActions: string[];
  annexA: SpiReportAnnexRow[];
  annexB: SpiReportAnnexRow[];
}

export interface SpiReportSnapshotInput {
  dataset: Dataset;
  analytics: AnalyticsResult;
}

export interface SpiTrendReportPoint {
  snapshotDate: string;
  scorePercent: number;
  compliant: number;
  nonCompliant: number;
  unknown: number;
  total: number;
  assetTypeBreakdown: SpiReportAssetTypeBreakdown[];
}

export interface SpiTrendReportModel {
  reportName: string;
  current: SpiReportModel;
  rangeStartDate: string;
  rangeEndDate: string;
  trendPoints: SpiTrendReportPoint[];
}

const ASSET_TYPE_GROUPS: Array<{ id: SpiReportAssetTypeGroupId; label: string }> = [
  { id: "server", label: "Servers" },
  { id: "workstation", label: "Workstations" },
  { id: "network-device", label: "Network Devices" },
  { id: "storage-device", label: "Storage Devices" },
  { id: "printer-device", label: "Printer Devices" },
  { id: "other", label: "Other Devices" }
];

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(1));
}

export function spiReportAssetTypeGroup(assetType: AssetType): SpiReportAssetTypeGroupId {
  if (
    assetType === "server" ||
    assetType === "workstation" ||
    assetType === "network-device" ||
    assetType === "storage-device" ||
    assetType === "printer-device"
  ) {
    return assetType;
  }
  return "other";
}

function ciNameForAsset(asset: Asset | undefined, assetId: string): string {
  if (!asset) {
    return assetId;
  }
  return asset.name || asset.hostname || asset.id;
}

function sortAnnexRows(left: SpiReportAnnexRow, right: SpiReportAnnexRow): number {
  if (left.score !== right.score) {
    if (left.score === "Non-compliant") return -1;
    if (right.score === "Non-compliant") return 1;
  }

  const typeDiff = left.assetTypeLabel.localeCompare(right.assetTypeLabel);
  if (typeDiff !== 0) {
    return typeDiff;
  }
  return left.ciName.localeCompare(right.ciName);
}

function buildModelFromRow(
  dataset: Dataset,
  analytics: AnalyticsResult,
  row: SpiRow,
  spiDefinitions: SpiDefinition[]
): SpiReportModel {
  const assetById = new Map(dataset.assets.map((asset) => [asset.id, asset]));
  const breakdownByGroup = new Map<SpiReportAssetTypeGroupId, SpiReportAssetTypeBreakdown>(
    ASSET_TYPE_GROUPS.map((group) => [
      group.id,
      {
        id: group.id,
        label: group.label,
        nonCompliant: 0,
        unknown: 0
      }
    ])
  );
  const annexA: SpiReportAnnexRow[] = [];
  const annexB: SpiReportAnnexRow[] = [];

  for (const assetEvaluation of analytics.evaluations) {
    const spiEvaluation = assetEvaluation.evaluations.find((evaluation) => evaluation.spiId === row.spiId);
    if (!spiEvaluation) {
      continue;
    }

    const asset = assetById.get(assetEvaluation.assetId);
    const assetType = asset?.type ?? assetEvaluation.assetType;
    const group = breakdownByGroup.get(spiReportAssetTypeGroup(assetType));
    if (group && spiEvaluation.status === "Non-compliant") {
      group.nonCompliant += 1;
    }
    if (group && spiEvaluation.status === "Unknown") {
      group.unknown += 1;
    }

    const annexRow: SpiReportAnnexRow = {
      assetId: assetEvaluation.assetId,
      ciName: ciNameForAsset(asset, assetEvaluation.assetId),
      assetType,
      assetTypeLabel: ASSET_TYPE_LABELS[assetType],
      score: spiEvaluation.status,
      reasons: spiEvaluation.reasons
    };

    if (spiEvaluation.status === "Unknown") {
      annexB.push(annexRow);
    } else {
      annexA.push(annexRow);
    }
  }

  const definition = spiDefinitionById(spiDefinitions).get(row.spiId);
  const unknownPercent = toPercent(row.unknown, row.total);

  return {
    spiId: row.spiId,
    name: row.name,
    reportName: `SPI ${row.spiId} Report: ${row.name}`,
    indicatorLabel: `SPI-${row.spiId}`,
    description: row.description,
    successMeasure: row.successMeasure,
    scorePercent: row.scorePercent,
    compliant: row.compliant,
    nonCompliant: row.nonCompliant,
    unknown: row.unknown,
    total: row.total,
    assetTypeBreakdown: ASSET_TYPE_GROUPS.map((group) => breakdownByGroup.get(group.id)).filter(
      (group): group is SpiReportAssetTypeBreakdown => Boolean(group)
    ),
    reportAvailable: row.reportAvailable,
    trendReportAvailable: row.trendReportAvailable,
    reportDetailKey: row.reportDetailKey,
    observedNonCompliantCondition:
      row.nonCompliant > 0
        ? `Detected ${row.nonCompliant} non-compliant CI(s) for SPI-${row.spiId}. Current measured compliance is ${row.scorePercent}% across ${row.total} CI(s).`
        : `No non-compliant CI(s) detected for SPI-${row.spiId} in the current filtered scope.`,
    observedUnknownCondition:
      row.unknown > 0
        ? `Detected ${unknownPercent}% (${row.unknown}) across ${row.total} CI(s) where the score cannot be calculated.`
        : `No Unknown CI score(s) detected for SPI-${row.spiId} in the current filtered scope.`,
    remediationActions: remediationActionsForSpi(row, spiDefinitions),
    annexA: annexA.sort(sortAnnexRows),
    annexB: annexB.sort(sortAnnexRows)
  };
}

export function buildSpiReportModel({
  dataset,
  analytics,
  spiId,
  spiDefinitions
}: {
  dataset: Dataset;
  analytics: AnalyticsResult;
  spiId: number;
  spiDefinitions: SpiDefinition[];
}): SpiReportModel | null {
  const row = buildSpiRows(analytics, spiDefinitions).find((item) => item.spiId === spiId);
  return row ? buildModelFromRow(dataset, analytics, row, spiDefinitions) : null;
}

export function buildSpiReportModels(
  dataset: Dataset,
  analytics: AnalyticsResult,
  spiDefinitions: SpiDefinition[]
): SpiReportModel[] {
  return buildSpiRows(analytics, spiDefinitions).map((row) => buildModelFromRow(dataset, analytics, row, spiDefinitions));
}

export function buildSpiTrendReportModel({
  snapshots,
  spiId,
  spiDefinitions
}: {
  snapshots: SpiReportSnapshotInput[];
  spiId: number;
  spiDefinitions: SpiDefinition[];
}): SpiTrendReportModel | null {
  const snapshotModels = snapshots
    .map(({ dataset, analytics }) => {
      const model = buildSpiReportModel({ dataset, analytics, spiId, spiDefinitions });
      return model ? { dataset, model } : null;
    })
    .filter((item): item is { dataset: Dataset; model: SpiReportModel } => Boolean(item));

  if (!snapshotModels.length) {
    return null;
  }

  const current = snapshotModels[snapshotModels.length - 1].model;
  const trendPoints: SpiTrendReportPoint[] = snapshotModels.map(({ dataset, model }) => ({
    snapshotDate: dataset.snapshotDate,
    scorePercent: model.scorePercent,
    compliant: model.compliant,
    nonCompliant: model.nonCompliant,
    unknown: model.unknown,
    total: model.total,
    assetTypeBreakdown: model.assetTypeBreakdown
  }));

  return {
    reportName: `SPI ${current.spiId} Trend Report: ${current.name}`,
    current,
    rangeStartDate: trendPoints[0].snapshotDate,
    rangeEndDate: trendPoints[trendPoints.length - 1].snapshotDate,
    trendPoints
  };
}
