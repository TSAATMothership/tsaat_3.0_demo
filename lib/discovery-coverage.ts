import { DiscoveryCoverageValue, StoredDiscoveryCoverageEvaluation } from "@/lib/types";

export type { DiscoveryCoverageValue };

export interface DiscoveryCoverageResult {
  toolValues: Record<string, DiscoveryCoverageValue>;
  missingToolIds: string[];
  missingToolNames: string[];
  coverageCompliance: boolean;
}

export function discoveryCoverageByAssetId(
  evaluations: StoredDiscoveryCoverageEvaluation[] | undefined
): Map<string, StoredDiscoveryCoverageEvaluation> {
  return new Map((evaluations ?? []).map((evaluation) => [evaluation.assetId, evaluation]));
}

export function discoveryCoverageForAssetId(
  assetId: string,
  source: Map<string, StoredDiscoveryCoverageEvaluation> | StoredDiscoveryCoverageEvaluation[] | undefined
): DiscoveryCoverageResult {
  const map = Array.isArray(source) || typeof source === "undefined" ? discoveryCoverageByAssetId(source) : source;
  const stored = map.get(assetId);
  if (!stored) {
    return {
      toolValues: {},
      missingToolIds: [],
      missingToolNames: [],
      coverageCompliance: false
    };
  }

  return {
    toolValues: stored.toolValues,
    missingToolIds: stored.missingToolIds,
    missingToolNames: stored.missingToolNames,
    coverageCompliance: stored.coverageCompliance
  };
}
