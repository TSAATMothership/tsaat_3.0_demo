import { ASSET_TYPES, createAssetTypeRecord } from "@/lib/asset-taxonomy";
import { discoveryCoverageByAssetId, discoveryCoverageForAssetId, type DiscoveryCoverageValue, type DiscoveryCoverageResult } from "@/lib/discovery-coverage";
import type { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import type { Asset, AssetType, StoredDiscoveryCoverageEvaluation } from "@/lib/types";

export interface ScopedDiscoveryToolColumn {
  id: string;
  label: string;
}

export interface ScopedDiscoveryToolCard extends ScopedDiscoveryToolColumn {
  covered: number;
  missing: number;
  applicable: number;
  applicableByCiType: Record<AssetType, number>;
  coveragePercent: number;
  chartBackground: string;
}

export interface ScopedDiscoveryAssetCoverage extends DiscoveryCoverageResult {
  assetId: string;
}

export interface DiscoveryCoverageCiTypeTotal {
  type: AssetType;
  inScope: number;
  usedInCalculations: number;
}

export interface ScopedDiscoveryToolCoverageModel {
  ciTypeTotals: DiscoveryCoverageCiTypeTotal[];
  toolColumns: ScopedDiscoveryToolColumn[];
  toolCards: ScopedDiscoveryToolCard[];
  assetCoverages: ScopedDiscoveryAssetCoverage[];
  assetCoverageById: Map<string, ScopedDiscoveryAssetCoverage>;
}

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function cardBackground(covered: number, applicable: number): string {
  if (!applicable) {
    return "conic-gradient(rgba(148,163,184,0.92) 0deg 360deg)";
  }
  const coveredStop = (covered / applicable) * 360;
  return `conic-gradient(rgba(52,211,153,0.95) 0deg ${coveredStop}deg, rgba(248,113,113,0.95) ${coveredStop}deg 360deg)`;
}

export function discoveryCoverageValueLabel(value: DiscoveryCoverageValue | undefined): string {
  if (value === null || typeof value === "undefined") {
    return "N/A";
  }
  return String(value);
}

export function buildScopedDiscoveryToolCoverage(
  assets: Asset[],
  settings: DiscoveryToolsSettings,
  discoveryCoverageEvaluations: StoredDiscoveryCoverageEvaluation[] = []
): ScopedDiscoveryToolCoverageModel {
  const countsByType = createAssetTypeRecord(() => 0);
  for (const asset of assets) countsByType[asset.type] += 1;
  const ciTypeTotals = ASSET_TYPES.map((type) => ({
    type,
    inScope: countsByType[type],
    usedInCalculations: settings.tools.some((tool) => tool.assetTypeScope[type] === "required") ? countsByType[type] : 0
  }));
  const assetTypes = ASSET_TYPES.filter((type) => countsByType[type] > 0);
  const coverageByAsset = discoveryCoverageByAssetId(discoveryCoverageEvaluations);
  const applicableTools = settings.tools.filter((tool) => assetTypes.some((assetType) => tool.assetTypeScope[assetType] === "required"));
  const toolColumns = applicableTools.map((tool) => ({ id: tool.id, label: tool.name }));

  const assetCoverages = assets.map((asset) => {
    const coverage = discoveryCoverageForAssetId(asset.id, coverageByAsset);
    const toolValues: Record<string, DiscoveryCoverageValue> = {};
    const missingToolIds: string[] = [];
    const missingToolNames: string[] = [];
    for (const tool of settings.tools) {
      // The saved CI-type mapping defines applicability. SQL provides detection evidence.
      const value = tool.assetTypeScope[asset.type] === "required"
        ? (coverage.toolValues[tool.id] === 1 ? 1 : 0)
        : null;
      toolValues[tool.id] = value;
      if (value === 0) {
        missingToolIds.push(tool.id);
        missingToolNames.push(tool.name);
      }
    }
    return {
      assetId: asset.id,
      toolValues,
      missingToolIds,
      missingToolNames,
      coverageCompliance: missingToolIds.length === 0
    };
  });
  const assetCoverageById = new Map(assetCoverages.map((coverage) => [coverage.assetId, coverage]));

  const toolCards = applicableTools.map((tool) => {
    const values = assetCoverages.map((coverage) => coverage.toolValues[tool.id]);
    const applicableByCiType = createAssetTypeRecord((type) => tool.assetTypeScope[type] === "required" ? countsByType[type] : 0);
    const applicable = Object.values(applicableByCiType).reduce((sum, count) => sum + count, 0);
    const covered = values.filter((value) => value === 1).length;
    const missing = values.filter((value) => value === 0).length;

    return {
      id: tool.id,
      label: tool.name,
      covered,
      missing,
      applicable,
      applicableByCiType,
      coveragePercent: toPercent(covered, applicable),
      chartBackground: cardBackground(covered, applicable)
    };
  });

  return {
    ciTypeTotals,
    toolColumns,
    toolCards,
    assetCoverages,
    assetCoverageById
  };
}
