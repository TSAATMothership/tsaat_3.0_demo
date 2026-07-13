import { discoveryCoverageByAssetId, discoveryCoverageForAssetId, type DiscoveryCoverageValue } from "@/lib/discovery-coverage";
import type { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import type { Asset, StoredDiscoveryCoverageEvaluation } from "@/lib/types";

export interface ScopedDiscoveryToolColumn {
  id: string;
  label: string;
}

export interface ScopedDiscoveryToolCard extends ScopedDiscoveryToolColumn {
  covered: number;
  missing: number;
  applicable: number;
  coveragePercent: number;
  chartBackground: string;
}

export interface ScopedDiscoveryAssetCoverage {
  assetId: string;
  toolValues: Record<string, DiscoveryCoverageValue>;
  coverageCompliance: boolean;
}

export interface ScopedDiscoveryToolCoverageModel {
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
  const assetTypes = new Set(assets.map((asset) => asset.type));
  const coverageByAsset = discoveryCoverageByAssetId(discoveryCoverageEvaluations);
  const toolColumns = settings.tools
    .filter((tool) => Array.from(assetTypes).some((assetType) => tool.assetTypeScope[assetType] !== "na"))
    .map((tool) => ({ id: tool.id, label: tool.name }));

  const assetCoverages = assets.map((asset) => {
    const coverage = discoveryCoverageForAssetId(asset.id, coverageByAsset);
    return {
      assetId: asset.id,
      toolValues: coverage.toolValues,
      coverageCompliance: coverage.coverageCompliance
    };
  });
  const assetCoverageById = new Map(assetCoverages.map((coverage) => [coverage.assetId, coverage]));

  const toolCards = toolColumns.map((tool) => {
    const values = assetCoverages.map((coverage) => coverage.toolValues[tool.id]);
    const applicable = values.filter((value) => value !== null && typeof value !== "undefined").length;
    const covered = values.filter((value) => value === 1).length;
    const missing = values.filter((value) => value === 0).length;

    return {
      ...tool,
      covered,
      missing,
      applicable,
      coveragePercent: toPercent(covered, applicable),
      chartBackground: cardBackground(covered, applicable)
    };
  });

  return {
    toolColumns,
    toolCards,
    assetCoverages,
    assetCoverageById
  };
}
