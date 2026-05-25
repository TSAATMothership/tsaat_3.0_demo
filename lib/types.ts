import type { CanonicalAssetType } from "@/lib/asset-taxonomy";

export type AssetType = CanonicalAssetType;

export type EnvironmentType = "Production" | "Development" | "UAT" | "Test";

export type SecurityDomain = "Secret" | "Protected" | "Unclassified";

export type SupportStatus = "Supported" | "OutOfSupport" | "Unknown";

export type ComplianceStatus = "Compliant" | "Non-compliant" | "Unknown";

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
  apmNumber?: string;
  diisUrl?: string;
  grcUrl?: string;
  discoveryStatus: NetworkDiscoveryStatus;
  ictSystemIds: string[];
  assetIds: string[];
  targetStateAssets?: Partial<Record<AssetType, string[]>>;
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
  majorVersion: number | null;
  version: string;
  supportStatus: SupportStatus;
  currentSupportedMajor: number | null;
  nMinus: number | null;
}

export interface InstalledSoftware {
  name: string;
  version: string;
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

export type Asset =
  | ServerAsset
  | WorkstationAsset
  | NetworkDeviceAsset
  | StorageDeviceAsset
  | PrinterDeviceAsset
  | OtherAsset;

export interface ReferenceVersions {
  osCurrentMajor: Record<string, number>;
  softwareSupportMatrix: Record<string, string[]>;
}

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
  generatedAt: string;
  snapshotDate: string;
  managedNetworks: ManagedNetwork[];
  ictSystems: ICTSystem[];
  assets: Asset[];
  ciDependencies?: CiDependency[];
  findings?: Finding[];
}

export type SpiId = number;

export interface SpiEvaluation {
  spiId: SpiId;
  outcomeKey?: string;
  status: ComplianceStatus;
  evidence: Record<string, string | number | boolean | null>;
  reasons: string[];
}

export interface AssetSpiEvaluation {
  assetId: string;
  assetType: AssetType;
  networkId: string;
  systemId: string | null;
  environmentType: EnvironmentType | null;
  securityDomain: SecurityDomain;
  systemCriticality: SystemCriticality | null;
  discoveryCoverageCompliant: boolean;
  evaluations: SpiEvaluation[];
}

export interface RollupCounts {
  compliant: number;
  nonCompliant: number;
  unknown: number;
  impactedAssets: number;
}

export interface RollupResult {
  scopeType: "network" | "system" | "environment";
  scopeId: string;
  spiId: SpiId;
  status: ComplianceStatus;
  counts: RollupCounts;
}

export type FindingSeverity = string;

export type FindingWorkflowStatus = "open" | "closed";

export interface Finding {
  id: string;
  spiId: SpiId;
  priorityRank: number;
  severity: FindingSeverity;
  status: FindingWorkflowStatus;
  complianceStatus: ComplianceStatus;
  timestamp: string;
  closedTimestamp?: string | null;
  scope: {
    networkId: string;
    systemId: string | null;
    environmentType: EnvironmentType | null;
    assetId: string;
  };
  title: string;
  evidence: Record<string, string | number | boolean | null>;
  recommendedAction: string;
}

export interface Filters {
  managedNetwork?: string;
  ictSystem?: string;
  systemCriticality?: SystemCriticality;
  securityDomain?: SecurityDomain;
  environment?: EnvironmentType;
  assetType?: AssetType;
  severity?: FindingSeverity;
  missionCapability?: string;
  businessService?: string;
}

export interface TrendPoint {
  weekLabel: string;
  snapshotDate: string;
  compliancePercent: number;
  nonCompliantCount: number;
  unknownCount: number;
  highRiskCount: number;
  criticalExposureCount: number;
  immediateActionCount: number;
}

export interface AnalyticsResult {
  evaluations: AssetSpiEvaluation[];
  findings: Finding[];
  networkRollups: RollupResult[];
  systemRollups: RollupResult[];
  environmentRollups: RollupResult[];
  overallCompliancePercent: number;
  statusTotals: RollupCounts;
  productionCriticalExposureAssetIds: string[];
}
