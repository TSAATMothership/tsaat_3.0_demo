import { buildAssetDetailsRow, type AssetDeviceDetails } from "@/lib/findings-assets";
import type { FindingDisplayConfiguration } from "@/lib/findings-config";
import { findingDurationDays } from "@/lib/findings-duration";
import { buildInventoryWorkbookSheets } from "@/lib/inventory-explorer-workbook";
import type { Finding } from "@/lib/types";

export function buildFindingsWorkbook(
  findings: readonly Finding[],
  asOf: string,
  assetDetailsByAssetId: Record<string, AssetDeviceDetails>,
  configuration: FindingDisplayConfiguration,
  exportedAt = new Date()
): Uint8Array {
  // A CI can have several findings. Its identifier links both sheets without duplicating inventory rows.
  const assets = [...new Map(findings.map((finding) => [finding.scope.assetId, finding])).values()]
    .map((finding) => buildAssetDetailsRow(finding, assetDetailsByAssetId, configuration));
  return buildInventoryWorkbookSheets([
    {
      name: "Findings",
      columns: [
        { label: "Finding ID", width: 40 }, { label: "Priority", width: 12, numeric: true },
        { label: "SPI", width: 10, numeric: true }, { label: "Severity", width: 22 },
        { label: "Status", width: 14 }, { label: "Compliance Status", width: 24 },
        { label: "Timestamp (UTC)", width: 28, date: true }, { label: "Duration (days)", width: 20, numeric: true },
        { label: "Network ID", width: 30 }, { label: "ICT System ID", width: 30 },
        { label: "Environment", width: 20 }, { label: "CI ID", width: 40 },
        { label: "SPI Description", width: 60 }, { label: "Evidence", width: 80 },
        { label: "Recommended Action", width: 70 }
      ],
      rows: findings.map((finding) => [
        finding.id, finding.priorityRank, finding.spiId, finding.severity, finding.status, finding.complianceStatus,
        finding.timestamp, findingDurationDays(finding, asOf), finding.scope.networkId, finding.scope.systemId,
        finding.scope.environmentType, finding.scope.assetId, finding.title, JSON.stringify(finding.evidence), finding.recommendedAction
      ])
    },
    {
      name: "Affected CIs",
      columns: [
        { label: "Device Name", width: 40 }, { label: "Device IP", width: 42 }, { label: "Device Model", width: 32 },
        { label: "Last Discovered Date", width: 26 }, { label: "Discovered By", width: 32 },
        { label: "Asset Type", width: 22 }, { label: "CI ID", width: 40 }
      ],
      // Keep the drill-through's day-month-year display, including its explicit missing-data labels.
      rows: assets.map((asset) => [asset.deviceName, asset.deviceIp, asset.deviceModel, asset.lastDiscoveredDate,
        asset.discoveredBy, asset.assetType, asset.assetId])
    }
  ], exportedAt);
}
