import type { Asset, Dataset, ICTSystem, OperatingSystem } from "@/lib/types";

export interface CmdbAssetDetails {
  snapshotDate: string;
  assetId: string;
  assetName: string;
  assetHostname: string;
  assetType: Asset["type"];
  assetIpAddress: string;
  networkId: string;
  networkName: string;
  hasIctSystem: boolean;
  systemId: string | null;
  systemName: string;
  environmentType: string | null;
  securityDomain: Asset["securityDomain"];
  cmdbRecordUrl: string | null;
  lifecycleEolStatus: string;
  lifecycleWarrantyStatus: string;
  operatingSystemSummary: string | null;
  networkOsSummary: string | null;
  patchStateSummary: string | null;
  installedSoftwareCount: number;
  vulnerabilityCount: number;
  criticalVulnerabilityCount: number;
}

function resolveAssetIpAddress(asset: Asset): string {
  const candidate = asset as Asset & {
    ipAddress?: string | null;
    ip?: string | null;
    ipv4?: string | null;
    ipv4Address?: string | null;
    primaryIp?: string | null;
  };
  const value = candidate.ipAddress ?? candidate.ip ?? candidate.ipv4 ?? candidate.ipv4Address ?? candidate.primaryIp;
  return value && String(value).trim() ? String(value).trim() : "N/A";
}

function formatOperatingSystemSummary(operatingSystem: OperatingSystem | null | undefined): string | null {
  if (!operatingSystem) {
    return null;
  }
  const name = [operatingSystem.vendor, operatingSystem.family, operatingSystem.version]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return [name || "Operating system recorded", operatingSystem.supportStatus].filter(Boolean).join(" | ");
}

function resolveSystemContext(dataset: Dataset, asset: Asset): {
  system: ICTSystem | null;
  environmentType: string | null;
} {
  const directSystemId = asset.systemContext?.systemId;
  const directSystem = directSystemId
    ? dataset.ictSystems.find((system) => system.id === directSystemId) ?? null
    : null;
  const declaredSystem =
    dataset.ictSystems.find((system) =>
      system.environments.some((environment) => environment.assetIds.includes(asset.id))
    ) ?? null;
  const system = directSystem ?? declaredSystem;
  const declaredEnvironment = system?.environments.find((environment) => environment.assetIds.includes(asset.id));
  return {
    system,
    environmentType: asset.systemContext?.environmentType ?? declaredEnvironment?.type ?? null
  };
}

export function buildCmdbAssetDetails(dataset: Dataset, assetId: string): CmdbAssetDetails | null {
  const asset = dataset.assets.find((candidate) => candidate.id === assetId);
  if (!asset) {
    return null;
  }

  const network = dataset.managedNetworks.find((candidate) => candidate.id === asset.networkId);
  const { system, environmentType } = resolveSystemContext(dataset, asset);
  const operatingSystemSummary =
    asset.type === "server" || asset.type === "workstation"
      ? formatOperatingSystemSummary(asset.operatingSystem)
      : null;
  const networkOsSummary = asset.type === "network-device" ? formatOperatingSystemSummary(asset.networkOs) : null;
  const patchStateSummary =
    asset.type === "network-device" && asset.patchState
      ? [
          asset.patchState.isLatest === null
            ? "Latest: Unknown"
            : asset.patchState.isLatest
              ? "Latest: Yes"
              : "Latest: No",
          asset.patchState.lastPatchedDate ? `Last patched: ${asset.patchState.lastPatchedDate}` : null
        ]
          .filter(Boolean)
          .join(" | ")
      : null;

  return {
    snapshotDate: dataset.snapshotDate,
    assetId: asset.id,
    assetName: asset.name || asset.hostname || asset.id,
    assetHostname: asset.hostname || asset.name || asset.id,
    assetType: asset.type,
    assetIpAddress: resolveAssetIpAddress(asset),
    networkId: asset.networkId,
    networkName: network?.name ?? asset.networkId,
    hasIctSystem: Boolean(system),
    systemId: system?.id ?? null,
    systemName: system?.name ?? "Not linked to ICT system",
    environmentType,
    securityDomain: asset.securityDomain,
    cmdbRecordUrl: asset.cmdbRecordUrl?.trim() || null,
    lifecycleEolStatus: asset.lifecycle.eolStatus,
    lifecycleWarrantyStatus: asset.lifecycle.warrantyStatus,
    operatingSystemSummary,
    networkOsSummary,
    patchStateSummary,
    installedSoftwareCount:
      asset.type === "server" || asset.type === "workstation" ? asset.installedSoftware.length : 0,
    vulnerabilityCount: asset.vulnerabilities.length,
    criticalVulnerabilityCount: asset.vulnerabilities.filter(
      (vulnerability) => vulnerability.severity === "Critical" || vulnerability.criticality === "Critical"
    ).length
  };
}
