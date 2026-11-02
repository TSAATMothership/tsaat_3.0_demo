import { deviceReportDetails, type DeviceReportDetails } from "@/lib/device-report";
import { readConfiguredEvidenceValue, type FindingDisplayConfiguration } from "@/lib/findings-config";
import type { Finding } from "@/lib/types";

export type AssetDeviceDetails = DeviceReportDetails & { assetType: string };
export interface AssetDetailsRow extends AssetDeviceDetails {
  assetId: string;
}

function formatAssetTypeLabel(value?: string | null): string {
  if (!value) {
    return "Unknown";
  }
  if (value === "network-device") {
    return "Network Device";
  }
  if (value === "storage-device") {
    return "Storage Device";
  }
  if (value === "printer-device") {
    return "Printer Device";
  }
  return value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildAssetDetailsRow(
  finding: Finding,
  assetDetailsByAssetId: Record<string, AssetDeviceDetails>,
  findingDisplayConfiguration: FindingDisplayConfiguration
): AssetDetailsRow {
  const assetId = finding.scope.assetId;
  const device = assetDetailsByAssetId[assetId] ?? {
    ...deviceReportDetails(undefined, assetId),
    deviceName: readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "asset_name", assetId) ?? assetId,
    deviceIp: readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "asset_ip_address", "Not recorded") ?? "Not recorded",
    assetType: readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "asset_type") ?? "Unknown"
  };

  return { ...device, assetId, assetType: formatAssetTypeLabel(device.assetType) };
}
