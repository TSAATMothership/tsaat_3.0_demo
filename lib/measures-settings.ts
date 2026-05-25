import { ASSET_TYPES } from "@/lib/asset-taxonomy";
import { SeverityDefinition, SpiDefinition } from "@/lib/spi-definitions";
import { Asset, AssetType, Finding, FindingSeverity, SpiId } from "@/lib/types";

export const MEASURES_ASSET_TYPES: AssetType[] = [...ASSET_TYPES];
export const MEASURES_PRIORITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
export type MeasuresPriorityRank = (typeof MEASURES_PRIORITY_OPTIONS)[number];

export interface MeasuresSettings {
  updatedAt: string;
  severityMatrix: Record<string, FindingSeverity>;
  priorityMatrix: Record<string, MeasuresPriorityRank>;
}

export function severityMatrixKey(spiId: SpiId, assetType: AssetType): string {
  return `${spiId}:${assetType}`;
}

export function priorityMatrixKey(spiId: SpiId): string {
  return String(spiId);
}

function severityKeys(severityDefinitions: SeverityDefinition[]): Set<string> {
  return new Set(severityDefinitions.map((definition) => definition.severityKey));
}

function firstSelectableSeverity(severityDefinitions: SeverityDefinition[]): FindingSeverity {
  return (
    severityDefinitions.find(
      (definition) => definition.selectableInSettings && definition.severityKey === "Moderate"
    )?.severityKey ??
    severityDefinitions.find((definition) => definition.selectableInSettings)?.severityKey ??
    "Moderate"
  );
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

function isSpiId(value: unknown, spiDefinitions: SpiDefinition[]): value is SpiId {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    spiDefinitions.some((definition) => definition.spiId === value)
  );
}

function normalizeSeverityValue(
  value: FindingSeverity,
  severityDefinitions: SeverityDefinition[],
  fallback: FindingSeverity
): FindingSeverity {
  const definition = severityDefinitions.find((item) => item.severityKey === value);
  return definition?.selectableInSettings ? value : fallback;
}

export function selectableSeverityDefinitions(severityDefinitions: SeverityDefinition[]): SeverityDefinition[] {
  return severityDefinitions.filter((definition) => definition.selectableInSettings);
}

export function defaultMeasuresSettings(
  spiDefinitions: SpiDefinition[],
  severityDefinitions: SeverityDefinition[]
): MeasuresSettings {
  const severityMatrix: Record<string, FindingSeverity> = {};
  const priorityMatrix: Record<string, MeasuresPriorityRank> = {};
  const validSeverities = severityKeys(severityDefinitions);
  const defaultSelectableSeverity = firstSelectableSeverity(severityDefinitions);

  for (const definition of spiDefinitions) {
    const defaultSeverity = validSeverities.has(definition.defaultSeverity)
      ? normalizeSeverityValue(definition.defaultSeverity, severityDefinitions, defaultSelectableSeverity)
      : defaultSelectableSeverity;

    for (const assetType of MEASURES_ASSET_TYPES) {
      severityMatrix[severityMatrixKey(definition.spiId, assetType)] = defaultSeverity;
    }

    const priorityRank = isMeasuresPriorityRank(definition.priorityOrder) ? definition.priorityOrder : 7;
    priorityMatrix[priorityMatrixKey(definition.spiId)] = priorityRank;
  }

  return {
    updatedAt: new Date().toISOString(),
    severityMatrix,
    priorityMatrix
  };
}

export function normalizeMeasuresSettings(
  input: unknown,
  spiDefinitions: SpiDefinition[],
  severityDefinitions: SeverityDefinition[]
): MeasuresSettings {
  const fallback = defaultMeasuresSettings(spiDefinitions, severityDefinitions);
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const validSeverities = severityKeys(severityDefinitions);
  const defaultSelectableSeverity = firstSelectableSeverity(severityDefinitions);
  const candidate = input as { updatedAt?: unknown; severityMatrix?: unknown; priorityMatrix?: unknown };
  const severityMatrix: Record<string, FindingSeverity> = { ...fallback.severityMatrix };
  const priorityMatrix: Record<string, MeasuresPriorityRank> = { ...fallback.priorityMatrix };

  if (candidate.severityMatrix && typeof candidate.severityMatrix === "object") {
    for (const [rawKey, rawSeverity] of Object.entries(candidate.severityMatrix as Record<string, unknown>)) {
      const [spiIdText, assetTypeText] = rawKey.split(":");
      const spiId = Number(spiIdText);
      if (
        !isSpiId(spiId, spiDefinitions) ||
        !isAssetType(assetTypeText) ||
        typeof rawSeverity !== "string" ||
        !validSeverities.has(rawSeverity)
      ) {
        continue;
      }
      severityMatrix[severityMatrixKey(spiId, assetTypeText)] = normalizeSeverityValue(
        rawSeverity,
        severityDefinitions,
        defaultSelectableSeverity
      );
    }
  }

  if (candidate.priorityMatrix && typeof candidate.priorityMatrix === "object") {
    for (const [rawKey, rawPriority] of Object.entries(candidate.priorityMatrix as Record<string, unknown>)) {
      const spiId = Number(rawKey);
      const priority = typeof rawPriority === "string" ? Number(rawPriority) : rawPriority;
      if (!isSpiId(spiId, spiDefinitions) || !isMeasuresPriorityRank(priority)) {
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
    if (finding.complianceStatus !== "Non-compliant") {
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
