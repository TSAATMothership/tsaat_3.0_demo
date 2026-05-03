import { Asset, AssetType, Finding, FindingSeverity, SpiId } from "@/lib/types";
import { ASSET_TYPES } from "@/lib/asset-taxonomy";
import { SPI_IDS, SPI_PRIORITY_ORDER } from "@/lib/spi-metadata";

export const MEASURES_SEVERITY_OPTIONS: FindingSeverity[] = [
  "Critical Exposure",
  "High Risk",
  "Major",
  "Moderate",
  "Data Gap"
];

export const MEASURES_SELECTABLE_SEVERITY_OPTIONS: Exclude<FindingSeverity, "Data Gap">[] =
  MEASURES_SEVERITY_OPTIONS.filter(
    (severity): severity is Exclude<FindingSeverity, "Data Gap"> => severity !== "Data Gap"
);

export const MEASURES_ASSET_TYPES: AssetType[] = [...ASSET_TYPES];
export const MEASURES_SPI_IDS: SpiId[] = [...SPI_IDS];
export const MEASURES_PRIORITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
export type MeasuresPriorityRank = (typeof MEASURES_PRIORITY_OPTIONS)[number];

export interface MeasuresSettings {
  updatedAt: string;
  severityMatrix: Record<string, FindingSeverity>;
  priorityMatrix: Record<string, MeasuresPriorityRank>;
}

const DEFAULT_SEVERITY_BY_SPI: Record<SpiId, FindingSeverity> = {
  1: "Major",
  2: "Moderate",
  3: "Critical Exposure",
  4: "High Risk",
  5: "High Risk",
  6: "High Risk",
  7: "Critical Exposure",
  8: "Major",
  9: "Moderate",
  10: "Moderate"
};

export function severityMatrixKey(spiId: SpiId, assetType: AssetType): string {
  return `${spiId}:${assetType}`;
}

export function priorityMatrixKey(spiId: SpiId): string {
  return String(spiId);
}

export function defaultMeasuresSettings(): MeasuresSettings {
  const severityMatrix: Record<string, FindingSeverity> = {};
  const priorityMatrix: Record<string, MeasuresPriorityRank> = {};

  for (const spiId of MEASURES_SPI_IDS) {
    for (const assetType of MEASURES_ASSET_TYPES) {
      severityMatrix[severityMatrixKey(spiId, assetType)] = DEFAULT_SEVERITY_BY_SPI[spiId];
    }
    priorityMatrix[priorityMatrixKey(spiId)] = SPI_PRIORITY_ORDER[spiId] as MeasuresPriorityRank;
  }

  return {
    updatedAt: new Date().toISOString(),
    severityMatrix,
    priorityMatrix
  };
}

function isFindingSeverity(value: unknown): value is FindingSeverity {
  return typeof value === "string" && MEASURES_SEVERITY_OPTIONS.includes(value as FindingSeverity);
}

function normalizeSeverityValue(value: FindingSeverity): FindingSeverity {
  return value === "Data Gap" ? "Moderate" : value;
}

function isSpiId(value: unknown): value is SpiId {
  return typeof value === "number" && Number.isInteger(value) && MEASURES_SPI_IDS.includes(value as SpiId);
}

function isMeasuresPriorityRank(value: unknown): value is MeasuresPriorityRank {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    MEASURES_PRIORITY_OPTIONS.includes(value as MeasuresPriorityRank)
  );
}

function isAssetType(value: unknown): value is AssetType {
  return typeof value === "string" && MEASURES_ASSET_TYPES.includes(value as AssetType);
}

export function normalizeMeasuresSettings(input: unknown): MeasuresSettings {
  const fallback = defaultMeasuresSettings();
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const candidate = input as { updatedAt?: unknown; severityMatrix?: unknown; priorityMatrix?: unknown };
  const severityMatrix: Record<string, FindingSeverity> = { ...fallback.severityMatrix };
  const priorityMatrix: Record<string, MeasuresPriorityRank> = { ...fallback.priorityMatrix };

  if (candidate.severityMatrix && typeof candidate.severityMatrix === "object") {
    for (const [rawKey, rawSeverity] of Object.entries(candidate.severityMatrix as Record<string, unknown>)) {
      const [spiIdText, assetTypeText] = rawKey.split(":");
      const spiId = Number(spiIdText);
      if (!isSpiId(spiId) || !isAssetType(assetTypeText) || !isFindingSeverity(rawSeverity)) {
        continue;
      }
      severityMatrix[severityMatrixKey(spiId, assetTypeText)] = normalizeSeverityValue(rawSeverity);
    }
  }

  if (candidate.priorityMatrix && typeof candidate.priorityMatrix === "object") {
    for (const [rawKey, rawPriority] of Object.entries(candidate.priorityMatrix as Record<string, unknown>)) {
      const spiId = Number(rawKey);
      const priority = typeof rawPriority === "string" ? Number(rawPriority) : rawPriority;
      if (!isSpiId(spiId) || !isMeasuresPriorityRank(priority)) {
        continue;
      }
      priorityMatrix[priorityMatrixKey(spiId)] = priority;
    }
  }

  const updatedAt =
    typeof candidate.updatedAt === "string" && !Number.isNaN(new Date(candidate.updatedAt).getTime())
      ? candidate.updatedAt
      : fallback.updatedAt;

  return {
    updatedAt,
    severityMatrix,
    priorityMatrix
  };
}

function findingAssetType(finding: Finding, assetsById: Map<string, Asset>): AssetType | null {
  const evidenceAssetType = finding.evidence.assetType;
  if (typeof evidenceAssetType === "string" && isAssetType(evidenceAssetType)) {
    return evidenceAssetType;
  }

  const asset = assetsById.get(finding.scope.assetId);
  return asset?.type ?? null;
}

export function applyMeasuresSeveritySettings(
  findings: Finding[],
  assets: Asset[],
  settings: MeasuresSettings
): Finding[] {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  return findings.map((finding) => {
    if (!isSpiId(finding.spiId)) {
      return finding;
    }

    const assetType = findingAssetType(finding, assetsById);
    if (!assetType) {
      return finding;
    }

    const mappedSeverity = settings.severityMatrix[severityMatrixKey(finding.spiId, assetType)];
    if (!mappedSeverity) {
      return finding;
    }

    return {
      ...finding,
      severity: mappedSeverity
    };
  });
}

export function applyMeasuresPrioritySettings(findings: Finding[], settings: MeasuresSettings): Finding[] {
  return findings.map((finding) => {
    if (finding.complianceStatus !== "Non-compliant" || !isSpiId(finding.spiId)) {
      return finding;
    }

    const mappedPriority = settings.priorityMatrix[priorityMatrixKey(finding.spiId)];
    if (!isMeasuresPriorityRank(mappedPriority)) {
      return finding;
    }

    return {
      ...finding,
      priorityRank: mappedPriority
    };
  });
}
