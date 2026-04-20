export const ASSET_TYPES = [
  "server",
  "workstation",
  "network-device",
  "storage-device",
  "printer-device",
  "other"
] as const;

export type CanonicalAssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<CanonicalAssetType, string> = {
  server: "Server",
  workstation: "Workstation",
  "network-device": "Network Device",
  "storage-device": "Storage Device",
  "printer-device": "Printer Device",
  other: "Other"
};

export function isAssetType(value: unknown): value is CanonicalAssetType {
  return typeof value === "string" && ASSET_TYPES.includes(value as CanonicalAssetType);
}

function toTitleCaseAssetType(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function assetTypeLabel(assetType: CanonicalAssetType): string {
  return ASSET_TYPE_LABELS[assetType];
}

export function formatAssetTypeLabel(value?: string | null): string {
  if (!value) {
    return "Unknown";
  }
  if (isAssetType(value)) {
    return assetTypeLabel(value);
  }
  return toTitleCaseAssetType(value);
}

export function createAssetTypeRecord<T>(factory: (assetType: CanonicalAssetType) => T): Record<CanonicalAssetType, T> {
  const entries = ASSET_TYPES.map((assetType) => [assetType, factory(assetType)] as const);
  return Object.fromEntries(entries) as Record<CanonicalAssetType, T>;
}
