import type { CanonicalAssetType } from "@/lib/asset-taxonomy";
import type { SecurityDomain } from "@/lib/security-domain.mjs";
export type { SecurityDomain } from "@/lib/security-domain.mjs";

export type AssetType = CanonicalAssetType;

export type EnvironmentType = "Production" | "Development" | "UAT" | "Test";


export type SupportStatus = "Supported" | "OutOfSupport" | "Unknown";

export type VulnerabilitySeverity = "Low" | "Medium" | "High" | "Critical";
export type VulnerabilityExploitability =
  | "No Known Exploit"
  | "Proof of Concept"
  | "Exploitable"
  | "Known Exploited";

export type EolStatus = "Supported" | "EOL" | "Unknown";

export type WarrantyStatus = "InWarranty" | "OutOfWarranty" | "Unknown";

export type Criticality = "Critical" | "Non-Critical";
export type SystemCriticality = Criticality;
export type NetworkDiscoveryStatus = "Discovery Enabled" | "Discovery Non Enabled";

export interface MissionCapability {
  id: string;
  name: string;
  criticality: Criticality;
}

export interface BusinessService {
  id: string;
  name: string;
  criticality: Criticality;
}

export interface ManagedNetwork {
  id: string;
  name: string;
  securityDomain: SecurityDomain;
  criticality: Criticality;
  adfPlatform: boolean;
  enterprisePlatform: boolean;
  modellingStatus: boolean;
  parentNetworkId?: string;
  childNetworkIds?: string[];
  classification?: string;
  description?: string;
  owner?: string;
  supportEmail?: string;
  serviceCatalogueUrl?: string;
  diisId?: string;
  atoNumber?: string;
  diisUrl?: string;
  grcUrl?: string;
  discoveryStatus: NetworkDiscoveryStatus;
  ictSystemIds: string[];
  assetIds: string[];
}

export interface SystemEnvironment {
  id: string;
  name: string;
  type: EnvironmentType;
  assetIds: string[];
}

export interface ICTSystem {
  id: string;
  name: string;
  adfPlatform: boolean;
  enterprisePlatform: boolean;
  parentSystemId?: string;
  childSystemIds?: string[];
  description?: string;
  diisId?: string;
  owner?: string;
  supportEmail?: string;
  serviceCatalogueUrl?: string;
  atoNumber?: string;
  apmNumber?: string;
  diisUrl?: string;
  grcUrl?: string;
  modellingStatus: boolean;
  diisDefined: boolean;
  networkId: string;
  criticality: SystemCriticality;
  securityDomain: SecurityDomain;
  missionCapabilities: MissionCapability[];
  businessServices: BusinessService[];
  environments: SystemEnvironment[];
}

export interface OperatingSystem {
  family: string;
  vendor: string;
  patchLevel?: string | null;
  version: string;
  supportStatus: SupportStatus;
}

export interface InstalledSoftware {
  name: string;
  version: string;
  filePath?: string | null;
  lastDiscoveredDate?: string | null;
  discoveredBy?: string | null;
  supportStatus: SupportStatus;
}

export interface PatchState {
  isLatest: boolean | null;
  lastPatchedDate: string | null;
}

export interface Vulnerability {
  id: string;
  assetId: string;
  cve: string;
  cveName?: string | null;
  /** CVE record creation/reservation date, independent of endpoint detection or capture. */
  cveCreatedDate?: string | null;
  softwareName?: string | null;
  softwareVersion?: string | null;
  referenceUrl?: string | null;
  description: string;
  remediationGuidance: string;
  criticality: VulnerabilitySeverity;
  severity: VulnerabilitySeverity;
  exploitability: VulnerabilityExploitability;
  detectedDate: string;
  capturedAt: string;
  source: string;
}

export interface CveVulnerabilityDetail {
  cve: string;
  description: string;
  remediationGuidance: string;
  criticality: VulnerabilitySeverity;
  exploitability: VulnerabilityExploitability;
  capturedAt: string;
}

export type HighRiskCveDetail = CveVulnerabilityDetail;

export interface Lifecycle {
  eolStatus: EolStatus;
  warrantyStatus: WarrantyStatus;
}

export interface SystemContext {
  systemId: string;
  environmentType: EnvironmentType;
}

interface BaseAsset {
  id: string;
  name: string;
  hostname: string;
  ipAddress?: string | null;
  macAddress?: string | null;
  deviceModel?: string | null;
  lastDiscoveredDate?: string | null;
  discoveredBy?: string | null;
  cmdbRecordUrl?: string | null;
  networkId: string;
  securityDomain: SecurityDomain;
  lifecycle: Lifecycle;
  vulnerabilities: Vulnerability[];
  systemContext?: SystemContext;
}

export interface ServerAsset extends BaseAsset {
  type: "server";
  operatingSystem: OperatingSystem | null;
  installedSoftware: InstalledSoftware[];
}

export interface WorkstationAsset extends BaseAsset {
  type: "workstation";
  operatingSystem: OperatingSystem | null;
  installedSoftware: InstalledSoftware[];
}

export interface NetworkDeviceAsset extends BaseAsset {
  type: "network-device";
  networkOs: OperatingSystem | null;
  patchState: PatchState | null;
}

export interface StorageDeviceAsset extends BaseAsset {
  type: "storage-device";
}

export interface PrinterDeviceAsset extends BaseAsset {
  type: "printer-device";
}

export interface OtherAsset extends BaseAsset {
  type: "other";
}

export interface IpNodeAsset extends BaseAsset {
  type: "ip-node";
  discoveryApproach: "IP Scan" | "ARP Table";
  arpOwnerAssetId: string | null;
}

export type Asset =
  | ServerAsset
  | WorkstationAsset
  | NetworkDeviceAsset
  | StorageDeviceAsset
  | PrinterDeviceAsset
  | OtherAsset
  | IpNodeAsset;

export type CiDependencyType = "Logical Dependency" | "Flow Dependency";

export interface CiDependency {
  id: string;
  sourceAssetId: string;
  targetAssetId: string;
  dependencyType: CiDependencyType;
  protocol?: string | null;
  sourcePort?: number | null;
  targetPort?: number | null;
  observationMethod?: string | null;
  observedAt?: string | null;
}

export interface Dataset {
  snapshotId?: number;
  generatedAt: string;
  snapshotDate: string;
  cacheSignature?: string;
  managedNetworks: ManagedNetwork[];
  ictSystems: ICTSystem[];
  assets: Asset[];
  discoveryCoverageEvaluations?: StoredDiscoveryCoverageEvaluation[];
  ciDependencies?: CiDependency[];
}

export type DiscoveryCoverageValue = 1 | 0 | null;

export interface StoredDiscoveryCoverageEvaluation {
  assetId: string;
  toolValues: Record<string, DiscoveryCoverageValue>;
  missingToolIds: string[];
  missingToolNames: string[];
  coverageCompliance: boolean;
}

export interface Filters {
  managedNetwork?: string;
  ictSystem?: string;
  systemCriticality?: SystemCriticality;
  /** Canonical comma-separated domains; undefined means all, NONE means empty. */
  securityDomain?: string;
  environment?: EnvironmentType;
  assetType?: AssetType;
  missionCapability?: string;
  businessService?: string;
}
