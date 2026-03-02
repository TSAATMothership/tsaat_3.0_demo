export type AssetType = "server" | "workstation" | "network-device";

export type EnvironmentType = "Production" | "Development" | "UAT" | "Test";

export type SecurityDomain = "Secret" | "Protected" | "Unclassified";

export type SupportStatus = "Supported" | "OutOfSupport" | "Unknown";

export type ComplianceStatus = "Compliant" | "Non-compliant" | "Unknown";

export type VulnerabilitySeverity = "Low" | "Medium" | "High" | "Critical";

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
  classification?: string;
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
  cve: string;
  severity: VulnerabilitySeverity;
  detectedDate: string;
  source: string;
}

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

export type Asset = ServerAsset | WorkstationAsset | NetworkDeviceAsset;

export interface ReferenceVersions {
  osCurrentMajor: Record<string, number>;
  softwareSupportMatrix: Record<string, string[]>;
}

export interface Dataset {
  generatedAt: string;
  snapshotDate: string;
  managedNetworks: ManagedNetwork[];
  ictSystems: ICTSystem[];
  assets: Asset[];
  findings?: Finding[];
}

export type SpiId =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10;

export interface SpiEvaluation {
  spiId: SpiId;
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

export type FindingSeverity =
  | "High Risk"
  | "Critical Exposure"
  | "Major"
  | "Moderate"
  | "Data Gap";

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
