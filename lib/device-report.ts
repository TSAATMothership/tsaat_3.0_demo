import type { Asset, Dataset, Finding } from "@/lib/types";

export interface DeviceReportDetails {
  deviceName: string;
  deviceIp: string;
  deviceModel: string;
  lastDiscoveredDate: string;
  discoveredBy: string;
}

const recorded = (value: string | null | undefined) => value?.trim() || "Not recorded";

export function deviceReportDetails(asset: Asset | undefined, fallbackId: string): DeviceReportDetails {
  const date = asset?.lastDiscoveredDate?.trim();
  const dateParts = date?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  return {
    deviceName: asset?.name?.trim() || asset?.hostname?.trim() || fallbackId,
    deviceIp: recorded(asset?.ipAddress),
    deviceModel: recorded(asset?.deviceModel),
    lastDiscoveredDate: dateParts ? `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}` : recorded(date),
    discoveredBy: recorded(asset?.discoveredBy)
  };
}

export const DEVICE_REPORT_COLUMNS = [
  { label: "Device Name", key: "deviceName", weight: 1.5 },
  { label: "Device IP", key: "deviceIp", weight: 1.1 },
  { label: "Device Model", key: "deviceModel", weight: 1.3 },
  { label: "Last Discovered Date", key: "lastDiscoveredDate", weight: 1.05 },
  { label: "Discovered By", key: "discoveredBy", weight: 1.15 }
] as const;

export interface DeviceReportRow { device: DeviceReportDetails; details: string[] }

export const DEVICE_FINDING_COLUMNS = [
  { label: "Finding / Classification", weight: 1.6 },
  { label: "Finding Details / Remediation", weight: 3 }
];

export const DEVICE_COVERAGE_COLUMNS = [
  { label: "Device Context", weight: 2 },
  { label: "Missing Discovery Tools", weight: 2 }
];

export function deviceCoverageRows(gaps: Array<{ assetId: string; missingTools: string[] }>, dataset: Dataset): DeviceReportRow[] {
  const assetById = new Map(dataset.assets.map(asset => [asset.id, asset]));
  const systems = new Map(dataset.ictSystems.map(system => [system.id, system.name]));
  const networks = new Map(dataset.managedNetworks.map(network => [network.id, network.name]));
  return gaps.map(gap => {
    const asset = assetById.get(gap.assetId);
    const systemId = asset?.systemContext?.systemId;
    return { device: deviceReportDetails(asset, gap.assetId), details: [
      `CI ID: ${gap.assetId}\nHostname: ${recorded(asset?.hostname)}\nType: ${asset?.type ?? "Not recorded"}\nNetwork: ${networks.get(asset?.networkId ?? "") ?? asset?.networkId ?? "Not recorded"}\nICT System: ${systems.get(systemId ?? "") ?? systemId ?? "Not recorded"}\nEnvironment: ${asset?.systemContext?.environmentType ?? "Not recorded"}`,
      gap.missingTools.join(", ") || "None"
    ] };
  });
}

export function deviceFindingRows(findings: Finding[], dataset: Dataset): DeviceReportRow[] {
  const assetById = new Map(dataset.assets.map(asset => [asset.id, asset]));
  const systems = new Map(dataset.ictSystems.map(system => [system.id, `${system.name} (${system.id})`]));
  const networks = new Map(dataset.managedNetworks.map(network => [network.id, `${network.name} (${network.id})`]));
  return findings.map(finding => ({
    device: deviceReportDetails(assetById.get(finding.scope.assetId), finding.scope.assetId),
    details: [
      `${finding.id}\nP${finding.priorityRank} | SPI-${finding.spiId}\n${finding.severity}\n${finding.complianceStatus} | ${finding.status}\n${finding.timestamp}`,
      `CI ID: ${finding.scope.assetId}\nHostname: ${recorded(assetById.get(finding.scope.assetId)?.hostname)}\nNetwork: ${networks.get(finding.scope.networkId) ?? finding.scope.networkId}\nICT System: ${systems.get(finding.scope.systemId ?? "") ?? finding.scope.systemId ?? "Not recorded"}\nEnvironment: ${finding.scope.environmentType ?? "Not recorded"}\n${finding.title}\nAction: ${finding.recommendedAction}`
    ]
  }));
}
