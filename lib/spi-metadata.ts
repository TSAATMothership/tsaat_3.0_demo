import rawSpiDefinitions from "@/data/spi-definitions.json";
import { AssetType, SpiId } from "@/lib/types";

export interface SpiDefinition {
  spiId: SpiId;
  name: string;
  description: string;
  successMeasure: string;
  priorityOrder: number;
  recommendedAction: string;
  applicableAssetTypes: AssetType[];
}

const SPI_ID_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const ASSET_TYPE_VALUES: AssetType[] = ["server", "workstation", "network-device"];

function isSpiId(value: unknown): value is SpiId {
  return typeof value === "number" && Number.isInteger(value) && SPI_ID_VALUES.includes(value as SpiId);
}

function isAssetType(value: unknown): value is AssetType {
  return typeof value === "string" && ASSET_TYPE_VALUES.includes(value as AssetType);
}

function nonEmptyText(value: unknown, fieldName: string, spiId?: number): string {
  if (typeof value !== "string" || !value.trim()) {
    const spiLabel = spiId ? ` for SPI ${spiId}` : "";
    throw new Error(`Invalid SPI metadata: missing ${fieldName}${spiLabel}.`);
  }
  return value.trim();
}

function normalizeSpiDefinitions(input: unknown): SpiDefinition[] {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid SPI metadata: root object is required.");
  }

  const root = input as { spis?: unknown };
  if (!Array.isArray(root.spis)) {
    throw new Error("Invalid SPI metadata: 'spis' must be an array.");
  }

  const seen = new Set<number>();
  const normalized: SpiDefinition[] = [];

  for (const rawItem of root.spis) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }
    const item = rawItem as Record<string, unknown>;
    const spiId = item.spiId;
    if (!isSpiId(spiId)) {
      throw new Error("Invalid SPI metadata: spiId must be an integer in range 1..10.");
    }
    if (seen.has(spiId)) {
      throw new Error(`Invalid SPI metadata: duplicate spiId ${spiId}.`);
    }
    seen.add(spiId);

    const applicableAssetTypes = Array.isArray(item.applicableAssetTypes)
      ? item.applicableAssetTypes.filter(isAssetType)
      : [];
    if (!applicableAssetTypes.length) {
      throw new Error(`Invalid SPI metadata: applicableAssetTypes missing for SPI ${spiId}.`);
    }

    const priorityOrder = Number(item.priorityOrder);
    if (!Number.isFinite(priorityOrder)) {
      throw new Error(`Invalid SPI metadata: priorityOrder missing for SPI ${spiId}.`);
    }

    normalized.push({
      spiId,
      name: nonEmptyText(item.name, "name", spiId),
      description: nonEmptyText(item.description, "description", spiId),
      successMeasure: nonEmptyText(item.successMeasure, "successMeasure", spiId),
      priorityOrder,
      recommendedAction: nonEmptyText(item.recommendedAction, "recommendedAction", spiId),
      applicableAssetTypes
    });
  }

  for (const requiredSpiId of SPI_ID_VALUES) {
    if (!seen.has(requiredSpiId)) {
      throw new Error(`Invalid SPI metadata: missing SPI ${requiredSpiId}.`);
    }
  }

  return normalized.sort((a, b) => a.spiId - b.spiId);
}

function toRecord<T>(rows: SpiDefinition[], selector: (row: SpiDefinition) => T): Record<SpiId, T> {
  const entries = rows.map((row) => [row.spiId, selector(row)] as const);
  return Object.fromEntries(entries) as Record<SpiId, T>;
}

export const SPI_DEFINITIONS = normalizeSpiDefinitions(rawSpiDefinitions);
export const SPI_IDS: SpiId[] = SPI_DEFINITIONS.map((row) => row.spiId);
export const SPI_NAMES = toRecord(SPI_DEFINITIONS, (row) => row.name);
export const SPI_DESCRIPTIONS = toRecord(SPI_DEFINITIONS, (row) => row.description);
export const SPI_SUCCESS_MEASURES = toRecord(SPI_DEFINITIONS, (row) => row.successMeasure);
export const SPI_PRIORITY_ORDER = toRecord(SPI_DEFINITIONS, (row) => row.priorityOrder);
export const SPI_ACTIONS = toRecord(SPI_DEFINITIONS, (row) => row.recommendedAction);
export const SPI_APPLICABLE_ASSET_TYPES = toRecord(SPI_DEFINITIONS, (row) => row.applicableAssetTypes);

export function isSpiApplicableToAssetType(spiId: SpiId, assetType: AssetType): boolean {
  return SPI_APPLICABLE_ASSET_TYPES[spiId]?.includes(assetType) ?? false;
}
