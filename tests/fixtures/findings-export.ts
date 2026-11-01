import type { AssetDeviceDetails } from "@/lib/findings-assets";
import type { FindingDisplayConfiguration } from "@/lib/findings-config";
import type { FindingsExportContext } from "@/lib/findings-export";
import type { Asset, Finding } from "@/lib/types";
import { deviceReportDetails } from "@/lib/device-report";

export const configuration: FindingDisplayConfiguration = {
  sourcePolicies: [], generationPolicies: [], workflowStatuses: [], buckets: [], registerColumns: [],
  evidenceFields: ["asset_name", "asset_ip_address", "asset_type"].map((purposeKey, displayOrder) => ({
    fieldKey: purposeKey, purposeKey, displayOrder, label: purposeKey, candidateKeys: [purposeKey], fallbackValue: null, enabled: true
  }))
};
export const exportContext: FindingsExportContext = {
  scope: { network: ["net-1"], system: [], dataDate: "2026-11-01" }, asOf: "2026-10-30", status: "open"
};
export const asset: Asset = {
  id: "0001", name: "=1+1 <gateway> & partner", hostname: "gateway-1", networkId: "net-1", type: "network-device", securityDomain: "Protected",
  ipAddress: "010.001.001.002", deviceModel: "Edge Model 100", lastDiscoveredDate: "2026-11-01T23:15:00Z", discoveredBy: "Discovery Scanner",
  lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" }, vulnerabilities: [], networkOs: null, patchState: null,
  systemContext: { systemId: "sys-1", environmentType: "Production" }
};
export const assetDetails: Record<string, AssetDeviceDetails> = {
  [asset.id]: { ...deviceReportDetails(asset, asset.id), assetType: asset.type },
  unrelated: { ...deviceReportDetails(undefined, "unrelated"), assetType: "server" }
};
export function finding(id = "finding-1", assetId = asset.id, status: "open" | "closed" = "open"): Finding {
  return { id, spiId: 1, priorityRank: 1, severity: "High Risk", status, complianceStatus: "Non-compliant", timestamp: "2026-10-01T23:30:00Z",
    scope: { assetId, networkId: "net-1", systemId: "sys-1", environmentType: "Production" },
    title: "Upgrade required", recommendedAction: "Upgrade the device", evidence: { asset_name: "Evidence fallback", asset_ip_address: "192.0.2.9", asset_type: "storage-device" } };
}
