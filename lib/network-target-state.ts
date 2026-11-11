import { ASSET_TYPES, createAssetTypeRecord } from "@/lib/asset-taxonomy";
import type { AssetType, ManagedNetwork } from "@/lib/types";

export type NetworkTargetStateCellState =
  | "ok"
  | "target-missing"
  | "discovery-missing"
  | "target-and-discovery-missing";

export interface NetworkTargetStateCellSummary {
  targetTotal: number;
  discoveredTotal: number;
  discoveredSetTotal: number;
  state: NetworkTargetStateCellState;
  coveragePercent: number;
}

export interface NetworkTargetStateCellPresentation {
  showChart: boolean;
  displayTargetTotal: number;
  displayDiscoveredTotal: number;
  missingMessage: string | null;
  missingMessagePlacement: "below-chart" | "message-only" | null;
}

export interface NetworkTargetStateRowSummary {
  targetStateProvided: boolean;
  byAssetType: Record<AssetType, NetworkTargetStateCellSummary>;
}

interface DiscoveredAssetNameRow {
  networkId: string;
  assetType: AssetType;
  name: string;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function normalizeTargetStateAssetName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeNameList(values: readonly string[]): string[] {
  const normalized: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const next = normalizeTargetStateAssetName(value);
    if (next) {
      normalized.push(next);
    }
  }
  return normalized;
}

function buildNameCount(values: readonly string[]): Map<string, number> {
  const countByName = new Map<string, number>();
  for (const value of values) {
    countByName.set(value, (countByName.get(value) ?? 0) + 1);
  }
  return countByName;
}

export function calculateMatchedTargetStateAssets(
  targetAssetNames: readonly string[],
  discoveredAssetNames: readonly string[]
): number {
  const normalizedTargets = normalizeNameList(targetAssetNames);
  const normalizedDiscovered = normalizeNameList(discoveredAssetNames);
  if (!normalizedTargets.length || !normalizedDiscovered.length) {
    return 0;
  }

  const targetNameCounts = buildNameCount(normalizedTargets);
  const discoveredNameCounts = buildNameCount(normalizedDiscovered);

  let matched = 0;
  for (const [name, targetCount] of targetNameCounts.entries()) {
    matched += Math.min(targetCount, discoveredNameCounts.get(name) ?? 0);
  }
  return matched;
}

export function summarizeTargetStateAssetType(
  targetAssetNames: readonly string[],
  discoveredAssetNames: readonly string[]
): NetworkTargetStateCellSummary {
  const normalizedTargetNames = normalizeNameList(targetAssetNames);
  const normalizedDiscoveredNames = normalizeNameList(discoveredAssetNames);
  const targetTotal = normalizedTargetNames.length;
  const discoveredSetTotal = normalizedDiscoveredNames.length;
  if (targetTotal <= 0) {
    const hasDiscoveredNames = discoveredSetTotal > 0;
    return {
      targetTotal: 0,
      discoveredTotal: 0,
      discoveredSetTotal,
      state: hasDiscoveredNames ? "target-missing" : "target-and-discovery-missing",
      coveragePercent: 0
    };
  }

  const discoveredTotal = calculateMatchedTargetStateAssets(normalizedTargetNames, normalizedDiscoveredNames);
  if (discoveredTotal <= 0) {
    return {
      targetTotal,
      discoveredTotal: 0,
      discoveredSetTotal,
      state: "discovery-missing",
      coveragePercent: 0
    };
  }

  return {
    targetTotal,
    discoveredTotal,
    discoveredSetTotal,
    state: "ok",
    coveragePercent: clampPercent(Number(((discoveredTotal / targetTotal) * 100).toFixed(1)))
  };
}

export function describeNetworkTargetStateCellPresentation(
  summary: NetworkTargetStateCellSummary
): NetworkTargetStateCellPresentation {
  if (summary.state === "target-and-discovery-missing") {
    return {
      showChart: false,
      displayTargetTotal: summary.targetTotal,
      displayDiscoveredTotal: summary.discoveredSetTotal,
      missingMessage: "Target State Missing + Discovery Missing",
      missingMessagePlacement: "message-only"
    };
  }

  if (summary.state === "target-missing") {
    return {
      showChart: true,
      displayTargetTotal: summary.targetTotal,
      displayDiscoveredTotal: summary.discoveredSetTotal,
      missingMessage: "Target State Missing",
      missingMessagePlacement: "below-chart"
    };
  }

  if (summary.state === "discovery-missing") {
    return {
      showChart: true,
      displayTargetTotal: summary.targetTotal,
      displayDiscoveredTotal: summary.discoveredSetTotal,
      missingMessage: "Discovery Missing",
      missingMessagePlacement: "below-chart"
    };
  }

  return {
    showChart: true,
    displayTargetTotal: summary.targetTotal,
    displayDiscoveredTotal: summary.discoveredTotal,
    missingMessage: null,
    missingMessagePlacement: null
  };
}

function combineNetworkAssetTypeKey(networkId: string, assetType: AssetType): string {
  return `${networkId}::${assetType}`;
}

export function buildNetworkTargetStateSummary(
  networks: Pick<ManagedNetwork, "id" | "targetStateAssets">[],
  discoveredAssets: DiscoveredAssetNameRow[]
): Map<string, NetworkTargetStateRowSummary> {
  const discoveredByNetworkAssetType = new Map<string, string[]>();
  for (const asset of discoveredAssets) {
    const key = combineNetworkAssetTypeKey(asset.networkId, asset.assetType);
    const existing = discoveredByNetworkAssetType.get(key);
    if (existing) {
      existing.push(asset.name);
    } else {
      discoveredByNetworkAssetType.set(key, [asset.name]);
    }
  }

  const summaryByNetworkId = new Map<string, NetworkTargetStateRowSummary>();
  for (const network of networks) {
    const byAssetType = createAssetTypeRecord((assetType) => {
      const targetAssetNames = network.targetStateAssets?.[assetType] ?? [];
      const discoveredAssetNames = discoveredByNetworkAssetType.get(combineNetworkAssetTypeKey(network.id, assetType)) ?? [];
      return summarizeTargetStateAssetType(targetAssetNames, discoveredAssetNames);
    });
    const targetStateProvided = ASSET_TYPES.some((assetType) => byAssetType[assetType].targetTotal > 0);

    summaryByNetworkId.set(network.id, {
      targetStateProvided,
      byAssetType
    });
  }

  return summaryByNetworkId;
}
