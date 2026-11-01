import { severityMatrixKey, type MeasuresSettings } from "@/lib/measures-settings";
import type { SeverityDefinition, SpiDefinition } from "@/lib/spi-definitions";
import type { Asset, AssetSpiEvaluation, AssetType } from "@/lib/types";

// Compact cell values keep large device inventories inexpensive to send to the browser.
export type HeatmapStatus = 0 | 1 | 2 | 3;
export const HEATMAP_STATUSES = ["Compliant", "Non-compliant", "Unknown", "Not applicable"] as const;
export const HEATMAP_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#243d4f"] as const;
export interface HeatmapSpi {
  id: number; name: string; description: string; severity: string;
  severityByAssetType: Partial<Record<AssetType, string>>;
}
export interface HeatmapDevice {
  id: string; name: string; ip: string; assetType: AssetType; status: 0 | 1 | 2;
  cells: HeatmapStatus[]; compliant: number; nonCompliant: number; unknown: number;
}
export interface ComplianceHeatmapModel {
  spis: HeatmapSpi[]; devices: HeatmapDevice[];
  groups: { compliant: number; nonCompliant: number; unknown: number };
}

export function buildComplianceHeatmap({ assets, evaluations, spiDefinitions, severityDefinitions, measuresSettings }: {
  assets: Asset[]; evaluations: AssetSpiEvaluation[]; spiDefinitions: SpiDefinition[];
  severityDefinitions: SeverityDefinition[]; measuresSettings: MeasuresSettings;
}): ComplianceHeatmapModel {
  const severityByKey = new Map(severityDefinitions.map(definition => [definition.severityKey, definition]));
  const rank = (key: string) => severityByKey.get(key)?.displayOrder ?? Number.MAX_SAFE_INTEGER;
  const label = (key: string) => severityByKey.get(key)?.label ?? key;
  const assetTypes = [...new Set(assets.map(asset => asset.type))];
  const definitions = spiDefinitions.filter(definition => definition.enabled).map(definition => {
    const severities = assetTypes.filter(type => definition.applicableAssetTypes.includes(type)).map(type => ({
      type, severity: measuresSettings.severityMatrix[severityMatrixKey(definition.spiId, type)] ?? definition.defaultSeverity
    }));
    const highest = severities.map(item => item.severity).sort((a, b) => rank(a) - rank(b))[0] ?? definition.defaultSeverity;
    return { definition, rank: rank(highest), column: { id: definition.spiId, name: definition.name,
      description: definition.description, severity: label(highest),
      severityByAssetType: Object.fromEntries(severities.map(item => [item.type, label(item.severity)])) } };
  }).sort((a, b) => b.rank - a.rank || a.definition.displayOrder - b.definition.displayOrder || a.definition.spiId - b.definition.spiId);
  const evaluationsByAsset = new Map(evaluations.map(evaluation => [evaluation.assetId,
    new Map(evaluation.evaluations.map(item => [item.spiId, item.status]))]));
  const devices = assets.map((asset): HeatmapDevice => {
    const recorded = evaluationsByAsset.get(asset.id);
    const cells = definitions.map(({ definition }): HeatmapStatus => {
      if (!definition.applicableAssetTypes.includes(asset.type)) return 3;
      const status = recorded?.get(definition.spiId);
      return status === "Compliant" ? 0 : status === "Non-compliant" ? 1 : 2;
    });
    const compliant = cells.filter(cell => cell === 0).length;
    const nonCompliant = cells.filter(cell => cell === 1).length;
    const unknown = cells.filter(cell => cell === 2).length;
    return { id: asset.id, name: asset.name?.trim() || asset.hostname?.trim() || asset.id,
      ip: asset.ipAddress?.trim() || "Not recorded", assetType: asset.type, cells, compliant, nonCompliant, unknown,
      status: nonCompliant ? 1 : unknown || !compliant ? 2 : 0 };
  }).sort((a, b) => a.status - b.status || a.name.localeCompare(b.name, "en", { numeric: true }) || a.id.localeCompare(b.id));
  return { spis: definitions.map(item => item.column), devices, groups: {
    compliant: devices.filter(device => device.status === 0).length,
    nonCompliant: devices.filter(device => device.status === 1).length,
    unknown: devices.filter(device => device.status === 2).length
  } };
}

export const HEATMAP_HEADER_HEIGHT = 164;
export function heatmapCellSize(deviceCount: number, spiCount: number, width: number, height: number, labelWidth: number): number {
  return Math.max(12, Math.min(40, Math.floor((width - labelWidth - 16) / Math.max(1, spiCount)),
    Math.floor((height - HEATMAP_HEADER_HEIGHT - 16) / Math.max(1, deviceCount))));
}

/** Render only the visible device rows; every row remains reachable through the scroll bar. */
export function heatmapRowWindow(count: number, cellSize: number, scrollTop: number, height: number) {
  const first = Math.max(0, Math.floor(scrollTop / cellSize) - 8);
  const start = Math.min(Math.max(0, count - 1), first);
  return { start, end: Math.min(count, Math.ceil((scrollTop + height) / cellSize) + 8) };
}
