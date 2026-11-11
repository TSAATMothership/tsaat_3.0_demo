import { normalizeNetworkSecurityDomain, normalizeSecurityDomain, securityDomainSelection } from "@/lib/security-domain.mjs";
import "server-only";
export { loadPersonaSettings, savePersonaSettings } from "@/lib/sql-persona-settings";

import { ASSET_TYPES as CANONICAL_ASSET_TYPES, createAssetTypeRecord, formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { normalizeDataDate, subtractCalendarMonthsDateKey, todayDateKey } from "@/lib/data-date";
import {
	defaultDiscoveryToolsSettings,
	DiscoveryToolsSettings,
	normalizeDiscoveryToolsScopeUpdate,
	normalizeDiscoveryToolsSettings
} from "@/lib/discovery-tools-settings";
import type { EndpointRecord } from "@/lib/endpoint-explorer";
import type { InstalledSoftwareRecord } from "@/lib/installed-software-explorer";
import { filterRealNetworks } from "@/lib/network-scope";
import { timeAsync } from "@/lib/perf";
import type { SecurityVulnerabilityRecord } from "@/lib/security-vulnerability-explorer";
import { ServerMemoryCache } from "@/lib/server-cache";
import type { ShadowItRecord } from "@/lib/shadow-it-explorer";
import { executeSqlJson, executeSqlText, toSqlUnicodeLiteral } from "@/lib/sql-server";
import {
	Asset,
	AssetType,
	Dataset,
	DiscoveryCoverageValue,
	EnvironmentType,
	StoredDiscoveryCoverageEvaluation
} from "@/lib/types";
import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

type SnapshotRow = {
  snapshotId: number;
  snapshotDate: string;
  generatedAt: string;
};

export type DatasetLoadProfile = "summary" | "full";

type DatasetLoadOptions = {
  profile?: DatasetLoadProfile;
};

export interface WorkspaceFilterOptions {
  networks: Array<{ id: string; label: string; securityDomain: string }>;
  systems: Array<{ id: string; label: string; securityDomain: string }>;
}

export interface EndpointExplorerData { snapshotDate: string; rows: EndpointRecord[] }
export interface InstalledSoftwareExplorerData { snapshotDate: string; rows: InstalledSoftwareRecord[] }
export interface SecurityVulnerabilityExplorerData { snapshotDate: string; rows: SecurityVulnerabilityRecord[] }
export interface ShadowItExplorerData { snapshotDate: string; rows: ShadowItRecord[] }

type SettingsVersionRow = {
  settingsVersionId: number;
  updatedAt: string;
};

type ManagedNetworkRow = {
  securityDomain: string | null;
  id: string;
  name: string;
  criticality: "Critical" | "Non-Critical";
  adfPlatform: boolean;
  enterprisePlatform: boolean;
  modellingStatus?: boolean | number | null;
  classification: string | null;
  description: string | null;
  owner: string | null;
  supportEmail: string | null;
  serviceCatalogueUrl: string | null;
  diisId: string | null;
  atoNumber: string | null;
  diisUrl: string | null;
  grcUrl: string | null;
  discoveryStatus: "Discovery Enabled" | "Discovery Non Enabled";
};

type ManagedNetworkHierarchyRow = {
  parentNetworkId: string;
  childNetworkId: string;
};

type NetworkDeclaredSystemRow = {
  networkId: string;
  systemId: string;
};

type NetworkDeclaredAssetRow = {
  networkId: string;
  assetId: string;
};

type SystemRow = {
  id: string;
  networkId: string;
  name: string;
  adfPlatform: boolean;
  enterprisePlatform: boolean;
  description: string | null;
  diisId: string | null;
  owner: string | null;
  supportEmail: string | null;
  serviceCatalogueUrl: string | null;
  atoNumber: string | null;
  apmNumber: string | null;
  diisUrl: string | null;
  grcUrl: string | null;
  modellingStatus: boolean;
  diisDefined: boolean;
  criticality: "Critical" | "Non-Critical";
  securityDomain: string | null;
};

type SystemHierarchyRow = {
  parentSystemId: string;
  childSystemId: string;
};

type MissionCapabilityRow = {
  systemId: string;
  id: string;
  name: string;
  criticality: "Critical" | "Non-Critical";
};

type BusinessServiceRow = {
  systemId: string;
  id: string;
  name: string;
  criticality: "Critical" | "Non-Critical";
};

type SystemEnvironmentRow = {
  systemId: string;
  id: string;
  name: string;
  type: EnvironmentType;
};

type SystemEnvironmentAssetRow = {
  systemId: string;
  environmentId: string;
  assetId: string;
};

type AssetRow = {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string | null;
  macAddress: string | null;
  deviceModel: string | null;
  lastDiscoveredDate: string | null;
  discoveredBy: string | null;
  discoveryApproach: "IP Scan" | "ARP Table" | null;
  arpOwnerAssetId: string | null;
  cmdbRecordUrl: string | null;
  type: AssetType;
  networkId: string;
  securityDomain: string | null;
  systemId: string | null;
  environmentType: EnvironmentType | null;
  eolStatus: "Supported" | "EOL" | "Unknown";
  warrantyStatus: "InWarranty" | "OutOfWarranty" | "Unknown";
};

type AssetOperatingSystemRow = {
  patchLevel?: string | null;
  assetId: string;
  family: string;
  vendor: string;
  version: string;
  supportStatus: "Supported" | "OutOfSupport" | "Unknown";
};

type AssetPatchStateRow = {
  assetId: string;
  isLatest: boolean | null;
  lastPatchedDate: string | null;
};

type AssetInstalledSoftwareRow = {
  assetId: string;
  ordinal: number;
  name: string;
  version: string;
  filePath?: string | null;
  lastDiscoveredDate?: string | null;
  discoveredBy?: string | null;
  supportStatus: "Supported" | "OutOfSupport" | "Unknown";
};

type AssetVulnerabilityRow = {
  assetId: string;
  id: string;
  cve: string;
  cveName?: string | null;
  cveCreatedDate?: string | null;
  softwareName?: string | null;
  softwareVersion?: string | null;
  referenceUrl?: string | null;
  description: string;
  remediationGuidance: string;
  criticality: "Low" | "Medium" | "High" | "Critical";
  severity: "Low" | "Medium" | "High" | "Critical";
  exploitability: "No Known Exploit" | "Proof of Concept" | "Exploitable" | "Known Exploited";
  detectedDate: string;
  capturedAt: string;
  source: string;
};

type CiDependencyRow = {
  id: string;
  sourceAssetId: string;
  targetAssetId: string;
  dependencyType: "Logical Dependency" | "Flow Dependency";
  protocol: string | null;
  sourcePort: number | null;
  targetPort: number | null;
  observationMethod: string | null;
  observedAt: string | null;
};

type SnapshotPayload = {
  managedNetworks: ManagedNetworkRow[];
  managedNetworkHierarchy: ManagedNetworkHierarchyRow[];
  networkDeclaredSystems: NetworkDeclaredSystemRow[];
  networkDeclaredAssets: NetworkDeclaredAssetRow[];
  ictSystems: SystemRow[];
  ictSystemHierarchy: SystemHierarchyRow[];
  systemMissionCapabilities: MissionCapabilityRow[];
  systemBusinessServices: BusinessServiceRow[];
  systemEnvironments: SystemEnvironmentRow[];
  systemEnvironmentAssets: SystemEnvironmentAssetRow[];
  assets: AssetRow[];
  assetOperatingSystems: AssetOperatingSystemRow[];
  assetNetworkOperatingSystems: AssetOperatingSystemRow[];
  assetPatchStates: AssetPatchStateRow[];
  assetInstalledSoftware: AssetInstalledSoftwareRow[];
  assetVulnerabilities: AssetVulnerabilityRow[];
  ciDependencies: CiDependencyRow[];
};

type DiscoveryCoverageToolValueRow = {
  toolId: string;
  value: DiscoveryCoverageValue;
};

type DiscoveryCoverageArrayValueRow = {
  value: string;
};

type StoredDiscoveryCoverageEvaluationRow = {
  assetId: string;
  toolValues: DiscoveryCoverageToolValueRow[] | null;
  missingToolIds: DiscoveryCoverageArrayValueRow[] | null;
  missingToolNames: DiscoveryCoverageArrayValueRow[] | null;
  coverageCompliance: boolean | number;
};

type DiscoveryToolRow = {
  id: string;
  name: string;
  description: string;
  el2Owner: string;
  el2OperationsManager: string;
};

type DiscoveryToolScopeRow = {
  toolId: string;
  assetType: AssetType;
  scopeSetting: "required" | "na";
};

const DATA_SCHEMA = "tsaat";
const ASSET_TYPES: AssetType[] = [...CANONICAL_ASSET_TYPES];
const SNAPSHOT_ROWS_CACHE_TTL_MS = 60 * 1000;
const DATASET_CACHE_TTL_MS = 30 * 60 * 1000;
const SETTINGS_VERSION_CACHE_TTL_MS = 60 * 1000;
const SETTINGS_BY_VERSION_CACHE_TTL_MS = 5 * 60 * 1000;

const snapshotRowsCache = new ServerMemoryCache<SnapshotRow[]>({
  namespace: "data:snapshot-rows",
  ttlMs: SNAPSHOT_ROWS_CACHE_TTL_MS,
  maxEntries: 1
});

const datasetBySnapshotIdCache = new ServerMemoryCache<Dataset>({
  namespace: "data:dataset",
  ttlMs: DATASET_CACHE_TTL_MS,
  maxEntries: 36,
  sliding: true
});

const workspaceFilterOptionsCache = new ServerMemoryCache<WorkspaceFilterOptions>({
  namespace: "data:workspace-options",
  ttlMs: SNAPSHOT_ROWS_CACHE_TTL_MS,
  maxEntries: 36
});

const endpointExplorerCache = new ServerMemoryCache<EndpointExplorerData>({
  namespace: "data:endpoint-explorer",
  ttlMs: SNAPSHOT_ROWS_CACHE_TTL_MS,
  maxEntries: 36
});

const installedSoftwareExplorerCache = new ServerMemoryCache<InstalledSoftwareExplorerData>({
  namespace: "data:installed-software-explorer",
  ttlMs: SNAPSHOT_ROWS_CACHE_TTL_MS,
  maxEntries: 36
});

const shadowItExplorerCache = new ServerMemoryCache<ShadowItExplorerData>({
  namespace: "data:shadow-it-explorer", ttlMs: SNAPSHOT_ROWS_CACHE_TTL_MS, maxEntries: 36
});
const securityVulnerabilityExplorerCache = new ServerMemoryCache<SecurityVulnerabilityExplorerData>({
  namespace: "data:security-vulnerability-explorer", ttlMs: SNAPSHOT_ROWS_CACHE_TTL_MS, maxEntries: 36
});

const discoveryToolsSettingsVersionCache = new ServerMemoryCache<SettingsVersionRow | null>({
  namespace: "settings:discovery-tools-version",
  ttlMs: SETTINGS_VERSION_CACHE_TTL_MS,
  maxEntries: 1
});

const discoveryToolsSettingsByVersionCache = new ServerMemoryCache<DiscoveryToolsSettings>({
  namespace: "settings:discovery-tools",
  ttlMs: SETTINGS_BY_VERSION_CACHE_TTL_MS,
  maxEntries: 24
});

function targetDateKey(requestedDate: string | undefined): string {
  return normalizeDataDate(requestedDate) ?? todayDateKey();
}

function normalizeDatasetLoadProfile(profile: DatasetLoadProfile | undefined): DatasetLoadProfile {
  return profile === "summary" || profile === "full" ? profile : "full";
}

function coerceIsoTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return value;
}

function normalizeDiscoveryCoverageValue(value: unknown): DiscoveryCoverageValue {
  if (value === 1 || value === "1" || value === true) {
    return 1;
  }
  if (value === 0 || value === "0" || value === false) {
    return 0;
  }
  return null;
}

function normalizeStringArrayRows(rows: DiscoveryCoverageArrayValueRow[] | null | undefined): string[] {
  return (rows ?? [])
    .map((row) => (typeof row.value === "string" ? row.value.trim() : ""))
    .filter((value) => value.length > 0);
}

function normalizeStoredDiscoveryCoverageEvaluations(
  rows: StoredDiscoveryCoverageEvaluationRow[]
): StoredDiscoveryCoverageEvaluation[] {
  return rows
    .filter((row) => typeof row.assetId === "string" && row.assetId.trim().length > 0)
    .map((row) => {
      const toolValues: Record<string, DiscoveryCoverageValue> = {};
      for (const toolValue of row.toolValues ?? []) {
        if (typeof toolValue.toolId === "string" && toolValue.toolId.trim()) {
          toolValues[toolValue.toolId] = normalizeDiscoveryCoverageValue(toolValue.value);
        }
      }

      return {
        assetId: row.assetId,
        toolValues,
        missingToolIds: normalizeStringArrayRows(row.missingToolIds),
        missingToolNames: normalizeStringArrayRows(row.missingToolNames),
        coverageCompliance: Boolean(row.coverageCompliance)
      };
    });
}

function coerceDateKey(value: string): string {
  const normalized = normalizeDataDate(value);
  if (normalized) {
    return normalized;
  }
  return value.slice(0, 10);
}

function toArrayMap<T>(rows: T[], keySelector: (row: T) => string): Map<string, T[]> {
  const mapped = new Map<string, T[]>();
  for (const row of rows) {
    const key = keySelector(row);
    const existing = mapped.get(key);
    if (existing) {
      existing.push(row);
    } else {
      mapped.set(key, [row]);
    }
  }
  return mapped;
}

function toFirstValueMap<T, TValue>(rows: T[], keySelector: (row: T) => string, valueSelector: (row: T) => TValue) {
  const mapped = new Map<string, TValue>();
  for (const row of rows) {
    const key = keySelector(row);
    if (!mapped.has(key)) {
      mapped.set(key, valueSelector(row));
    }
  }
  return mapped;
}

function sortedValues(values: Iterable<string>): string[] {
  return Array.from(values).sort((left, right) => left.localeCompare(right));
}

function ensureValidSnapshotId(snapshotId: number): number {
  if (!Number.isInteger(snapshotId) || snapshotId < 1) {
    throw new Error(`Invalid snapshot identifier '${snapshotId}'.`);
  }
  return snapshotId;
}

async function loadSnapshotRows(): Promise<SnapshotRow[]> {
  return snapshotRowsCache.getOrSet("all", () =>
    executeSqlJson<SnapshotRow[]>(`
IF OBJECT_ID(N'${DATA_SCHEMA}.storage_schema_version', N'U') IS NULL
  THROW 51000, 'Inventory storage v2 is required. Back up the selected database and apply migration 033 before starting this release.', 1;
IF NOT EXISTS (SELECT 1 FROM [${DATA_SCHEMA}].[storage_schema_version] WHERE [version] = 2)
  THROW 51000, 'Unsupported inventory storage version.', 1;
SELECT
  ds.[snapshot_id] AS [snapshotId],
  CONVERT(CHAR(10), ds.[snapshot_date], 23) AS [snapshotDate],
  CONVERT(NVARCHAR(40), ds.[generated_at], 127) AS [generatedAt]
FROM [${DATA_SCHEMA}].[dataset_snapshot] ds
ORDER BY ds.[snapshot_date] ASC, ds.[snapshot_id] ASC
FOR JSON PATH;
`)
  );
}

function selectSnapshotRowForDate(rows: SnapshotRow[], requestedDate: string | undefined): SnapshotRow {
  if (!rows.length) {
    throw new Error("No datasets are available in SQL Server.");
  }

  const target = targetDateKey(requestedDate);
  const matching = rows.filter((row) => row.snapshotDate <= target);
  return matching[matching.length - 1] ?? rows[0];
}

function latestSnapshot(rows: SnapshotRow[]): SnapshotRow {
  if (!rows.length) {
    throw new Error("No datasets are available in SQL Server.");
  }
  return rows[rows.length - 1];
}

async function loadSnapshotPayload(
  snapshotId: number,
  profile: DatasetLoadProfile = "full"
): Promise<SnapshotPayload> {
  const safeSnapshotId = ensureValidSnapshotId(snapshotId);
  const normalizedProfile = normalizeDatasetLoadProfile(profile);
  const includeFullPayload = normalizedProfile === "full";

  const raw = await timeAsync(`loadSnapshotPayload:${safeSnapshotId}:${normalizedProfile}`, () => executeSqlJson<Partial<SnapshotPayload>>(`
DECLARE @snapshotId BIGINT = ${safeSnapshotId};
DECLARE @includeFullPayload BIT = ${includeFullPayload ? 1 : 0};
SELECT
  JSON_QUERY((
    SELECT
      n.[network_id] AS [id],
      n.[name] AS [name],
      n.[criticality] AS [criticality],
      n.[adf_platform] AS [adfPlatform],
      n.[enterprise_platform] AS [enterprisePlatform],
      n.[modelling_status] AS [modellingStatus],
      n.[classification] AS [classification],
      n.[security_domain] AS [securityDomain],
      n.[description] AS [description],
      n.[owner] AS [owner],
      n.[support_email] AS [supportEmail],
      n.[service_catalogue_url] AS [serviceCatalogueUrl],
      n.[diis_id] AS [diisId],
      n.[ato_number] AS [atoNumber],
      n.[diis_url] AS [diisUrl],
      n.[grc_url] AS [grcUrl],
      n.[discovery_status] AS [discoveryStatus]
    FROM [${DATA_SCHEMA}].[managed_network] n
    WHERE n.[snapshot_id] = @snapshotId
    ORDER BY n.[network_id]
    FOR JSON PATH
  )) AS [managedNetworks],
  JSON_QUERY((
    SELECT
      h.[parent_network_id] AS [parentNetworkId],
      h.[child_network_id] AS [childNetworkId]
    FROM [${DATA_SCHEMA}].[managed_network_hierarchy] h
    WHERE h.[snapshot_id] = @snapshotId
    ORDER BY h.[parent_network_id], h.[child_network_id]
    FOR JSON PATH
  )) AS [managedNetworkHierarchy],
  JSON_QUERY((
    SELECT
      nds.[network_id] AS [networkId],
      nds.[system_id] AS [systemId]
    FROM [${DATA_SCHEMA}].[network_declared_system] nds
    WHERE nds.[snapshot_id] = @snapshotId
    ORDER BY nds.[network_id], nds.[system_id]
    FOR JSON PATH
  )) AS [networkDeclaredSystems],
  JSON_QUERY((
    SELECT
      nda.[network_id] AS [networkId],
      nda.[asset_id] AS [assetId]
    FROM [${DATA_SCHEMA}].[network_declared_asset] nda
    WHERE nda.[snapshot_id] = @snapshotId
    ORDER BY nda.[network_id], nda.[asset_id]
    FOR JSON PATH
  )) AS [networkDeclaredAssets],
  JSON_QUERY((
    SELECT
      s.[system_id] AS [id],
      s.[network_id] AS [networkId],
      s.[name] AS [name],
      s.[adf_platform] AS [adfPlatform],
      s.[enterprise_platform] AS [enterprisePlatform],
      s.[description] AS [description],
      s.[diis_id] AS [diisId],
      s.[owner] AS [owner],
      s.[support_email] AS [supportEmail],
      s.[service_catalogue_url] AS [serviceCatalogueUrl],
      s.[ato_number] AS [atoNumber],
      s.[apm_number] AS [apmNumber],
      s.[diis_url] AS [diisUrl],
      s.[grc_url] AS [grcUrl],
      s.[modelling_status] AS [modellingStatus],
      s.[diis_defined] AS [diisDefined],
      s.[criticality] AS [criticality],
      s.[security_domain] AS [securityDomain]
    FROM [${DATA_SCHEMA}].[ict_system] s
    WHERE s.[snapshot_id] = @snapshotId
    ORDER BY s.[system_id]
    FOR JSON PATH
  )) AS [ictSystems],
  JSON_QUERY((
    SELECT
      h.[parent_system_id] AS [parentSystemId],
      h.[child_system_id] AS [childSystemId]
    FROM [${DATA_SCHEMA}].[ict_system_hierarchy] h
    WHERE h.[snapshot_id] = @snapshotId
    ORDER BY h.[parent_system_id], h.[child_system_id]
    FOR JSON PATH
  )) AS [ictSystemHierarchy],
  JSON_QUERY((
    SELECT
      mc.[system_id] AS [systemId],
      mc.[mission_capability_id] AS [id],
      mc.[name] AS [name],
      mc.[criticality] AS [criticality]
    FROM [${DATA_SCHEMA}].[system_mission_capability] mc
    WHERE mc.[snapshot_id] = @snapshotId
    ORDER BY mc.[system_id], mc.[mission_capability_id]
    FOR JSON PATH
  )) AS [systemMissionCapabilities],
  JSON_QUERY((
    SELECT
      bs.[system_id] AS [systemId],
      bs.[business_service_id] AS [id],
      bs.[name] AS [name],
      bs.[criticality] AS [criticality]
    FROM [${DATA_SCHEMA}].[system_business_service] bs
    WHERE bs.[snapshot_id] = @snapshotId
    ORDER BY bs.[system_id], bs.[business_service_id]
    FOR JSON PATH
  )) AS [systemBusinessServices],
  JSON_QUERY((
    SELECT
      se.[system_id] AS [systemId],
      se.[environment_id] AS [id],
      se.[name] AS [name],
      se.[environment_type] AS [type]
    FROM [${DATA_SCHEMA}].[system_environment] se
    WHERE se.[snapshot_id] = @snapshotId
    ORDER BY se.[system_id], se.[environment_id]
    FOR JSON PATH
  )) AS [systemEnvironments],
  JSON_QUERY((
    SELECT
      sea.[system_id] AS [systemId],
      sea.[environment_id] AS [environmentId],
      sea.[asset_id] AS [assetId]
    FROM [${DATA_SCHEMA}].[system_environment_asset] sea
    WHERE sea.[snapshot_id] = @snapshotId
    ORDER BY sea.[system_id], sea.[environment_id], sea.[asset_id]
    FOR JSON PATH
  )) AS [systemEnvironmentAssets],
  JSON_QUERY((
    SELECT
      a.[asset_id] AS [id],
      a.[name] AS [name],
      a.[hostname] AS [hostname],
      a.[ip_address] AS [ipAddress],
      a.[mac_address] AS [macAddress], a.[device_model] AS [deviceModel],
      CASE WHEN a.[last_discovered_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), a.[last_discovered_date], 126) + N'Z' END AS [lastDiscoveredDate],
      a.[discovered_by] AS [discoveredBy], a.[discovery_approach] AS [discoveryApproach], a.[arp_owner_asset_id] AS [arpOwnerAssetId],
      a.[cmdb_record_url] AS [cmdbRecordUrl],
      a.[asset_type] AS [type],
      a.[network_id] AS [networkId],
      a.[security_domain] AS [securityDomain],
      a.[system_id] AS [systemId],
      a.[environment_type] AS [environmentType],
      a.[lifecycle_eol_status] AS [eolStatus],
      a.[lifecycle_warranty_status] AS [warrantyStatus]
    FROM [${DATA_SCHEMA}].[asset] a
    WHERE a.[snapshot_id] = @snapshotId
    ORDER BY a.[asset_id]
    FOR JSON PATH
  )) AS [assets],
  JSON_QUERY((
    SELECT
      aos.[asset_id] AS [assetId],
      aos.[family] AS [family],
      aos.[vendor] AS [vendor],
      aos.[version] AS [version],
      aos.[patch_level] AS [patchLevel],
      aos.[support_status] AS [supportStatus]
    FROM [${DATA_SCHEMA}].[asset_operating_system] aos
    WHERE aos.[snapshot_id] = @snapshotId
    ORDER BY aos.[asset_id]
    FOR JSON PATH
  )) AS [assetOperatingSystems],
  JSON_QUERY((
    SELECT
      nos.[asset_id] AS [assetId],
      nos.[family] AS [family],
      nos.[vendor] AS [vendor],
      nos.[version] AS [version],
      nos.[patch_level] AS [patchLevel],
      nos.[support_status] AS [supportStatus]
    FROM [${DATA_SCHEMA}].[asset_network_os] nos
    WHERE nos.[snapshot_id] = @snapshotId
    ORDER BY nos.[asset_id]
    FOR JSON PATH
  )) AS [assetNetworkOperatingSystems],
  JSON_QUERY((
    SELECT
      ps.[asset_id] AS [assetId],
      ps.[is_latest] AS [isLatest],
      CONVERT(CHAR(10), ps.[last_patched_date], 23) AS [lastPatchedDate]
    FROM [${DATA_SCHEMA}].[asset_patch_state] ps
    WHERE ps.[snapshot_id] = @snapshotId
    ORDER BY ps.[asset_id]
    FOR JSON PATH
  )) AS [assetPatchStates],
  JSON_QUERY(CASE WHEN @includeFullPayload = 1 THEN (
    SELECT
      sw.[asset_id] AS [assetId],
      sw.[software_ordinal] AS [ordinal],
      sw.[name] AS [name],
      sw.[version] AS [version],
      sw.[file_path] AS [filePath],
      CASE WHEN sw.[last_discovered_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), sw.[last_discovered_date], 126) + N'Z' END AS [lastDiscoveredDate],
      sw.[discovered_by] AS [discoveredBy],
      sw.[support_status] AS [supportStatus]
    FROM [${DATA_SCHEMA}].[asset_installed_software] sw
    WHERE sw.[snapshot_id] = @snapshotId
    ORDER BY sw.[asset_id], sw.[software_ordinal]
    FOR JSON PATH
  ) ELSE N'[]' END) AS [assetInstalledSoftware],
  JSON_QUERY(CASE WHEN @includeFullPayload = 1 THEN (
    SELECT
      v.[asset_id] AS [assetId],
      v.[vulnerability_id] AS [id],
      v.[cve] AS [cve],
      v.[cve_name] AS [cveName],
      CONVERT(CHAR(10), v.[cve_created_date], 23) AS [cveCreatedDate],
      v.[software_name] AS [softwareName], v.[software_version] AS [softwareVersion], v.[reference_url] AS [referenceUrl],
      v.[description] AS [description],
      v.[remediation_guidance] AS [remediationGuidance],
      v.[criticality] AS [criticality],
      v.[severity] AS [severity],
      v.[exploitability] AS [exploitability],
      CONVERT(CHAR(10), v.[detected_date], 23) AS [detectedDate],
      CONVERT(NVARCHAR(40), v.[captured_at], 127) AS [capturedAt],
      v.[source] AS [source]
    FROM [${DATA_SCHEMA}].[asset_vulnerability] v
    WHERE v.[snapshot_id] = @snapshotId
    ORDER BY v.[asset_id], v.[vulnerability_id]
    FOR JSON PATH
  ) ELSE N'[]' END) AS [assetVulnerabilities],
  JSON_QUERY(CASE WHEN @includeFullPayload = 1 THEN (
    SELECT
      d.[dependency_id] AS [id],
      d.[source_asset_id] AS [sourceAssetId],
      d.[target_asset_id] AS [targetAssetId],
      d.[dependency_type] AS [dependencyType],
      d.[flow_protocol] AS [protocol],
      d.[source_port] AS [sourcePort],
      d.[target_port] AS [targetPort],
      d.[observation_method] AS [observationMethod],
      CONVERT(NVARCHAR(40), d.[observed_at], 127) AS [observedAt]
    FROM [${DATA_SCHEMA}].[ci_dependency] d
    WHERE d.[snapshot_id] = @snapshotId
    ORDER BY d.[dependency_id]
    FOR JSON PATH
  ) ELSE N'[]' END) AS [ciDependencies]
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
`));

  return {
    managedNetworks: Array.isArray(raw.managedNetworks) ? raw.managedNetworks : [],
    managedNetworkHierarchy: Array.isArray(raw.managedNetworkHierarchy) ? raw.managedNetworkHierarchy : [],
    networkDeclaredSystems: Array.isArray(raw.networkDeclaredSystems) ? raw.networkDeclaredSystems : [],
    networkDeclaredAssets: Array.isArray(raw.networkDeclaredAssets) ? raw.networkDeclaredAssets : [],
    ictSystems: Array.isArray(raw.ictSystems) ? raw.ictSystems : [],
    ictSystemHierarchy: Array.isArray(raw.ictSystemHierarchy) ? raw.ictSystemHierarchy : [],
    systemMissionCapabilities: Array.isArray(raw.systemMissionCapabilities) ? raw.systemMissionCapabilities : [],
    systemBusinessServices: Array.isArray(raw.systemBusinessServices) ? raw.systemBusinessServices : [],
    systemEnvironments: Array.isArray(raw.systemEnvironments) ? raw.systemEnvironments : [],
    systemEnvironmentAssets: Array.isArray(raw.systemEnvironmentAssets) ? raw.systemEnvironmentAssets : [],
    assets: Array.isArray(raw.assets) ? raw.assets : [],
    assetOperatingSystems: Array.isArray(raw.assetOperatingSystems) ? raw.assetOperatingSystems : [],
    assetNetworkOperatingSystems: Array.isArray(raw.assetNetworkOperatingSystems) ? raw.assetNetworkOperatingSystems : [],
    assetPatchStates: Array.isArray(raw.assetPatchStates) ? raw.assetPatchStates : [],
    assetInstalledSoftware: Array.isArray(raw.assetInstalledSoftware) ? raw.assetInstalledSoftware : [],
    assetVulnerabilities: Array.isArray(raw.assetVulnerabilities) ? raw.assetVulnerabilities : [],
    ciDependencies: Array.isArray(raw.ciDependencies) ? raw.ciDependencies : [],
  };
}

async function loadSnapshotDiscoveryCoverageEvaluations(
  snapshotId: number
): Promise<StoredDiscoveryCoverageEvaluation[]> {
  const safeSnapshotId = ensureValidSnapshotId(snapshotId);
  const rows = await timeAsync(`loadSnapshotDiscoveryCoverage:${safeSnapshotId}`, () => executeSqlJson<StoredDiscoveryCoverageEvaluationRow[]>(`
EXEC [${DATA_SCHEMA}].[usp_evaluate_discovery_coverage_snapshot]
  @snapshot_id = ${safeSnapshotId},
  @asset_ids_json = NULL,
  @emit_json = 1;
`));

  return normalizeStoredDiscoveryCoverageEvaluations(rows);
}

function buildDatasetFromSnapshotRow(
  snapshot: SnapshotRow,
  payload: SnapshotPayload,
  discoveryCoverageEvaluations: StoredDiscoveryCoverageEvaluation[],
  cacheSignature: string
): Dataset {
  const networkChildrenRows = toArrayMap(payload.managedNetworkHierarchy, (row) => row.parentNetworkId);
  const networkParentByChild = toFirstValueMap(
    payload.managedNetworkHierarchy,
    (row) => row.childNetworkId,
    (row) => row.parentNetworkId
  );

  const networkSystemIds = new Map<string, Set<string>>();
  for (const row of payload.networkDeclaredSystems) {
    const existing = networkSystemIds.get(row.networkId);
    if (existing) {
      existing.add(row.systemId);
    } else {
      networkSystemIds.set(row.networkId, new Set([row.systemId]));
    }
  }

  const networkAssetIds = new Map<string, Set<string>>();
  for (const row of payload.networkDeclaredAssets) {
    const existing = networkAssetIds.get(row.networkId);
    if (existing) {
      existing.add(row.assetId);
    } else {
      networkAssetIds.set(row.networkId, new Set([row.assetId]));
    }
  }

  const managedNetworks = payload.managedNetworks.map((network) => {
    const childRows = networkChildrenRows.get(network.id) ?? [];
    const childNetworkIds = sortedValues(childRows.map((row) => row.childNetworkId));
    const systemIds = sortedValues(networkSystemIds.get(network.id) ?? []);
    const assetIds = sortedValues(networkAssetIds.get(network.id) ?? []);

    return {
      id: network.id,
      name: network.name,
      criticality: network.criticality,
      adfPlatform: Boolean(network.adfPlatform),
      enterprisePlatform: Boolean(network.enterprisePlatform),
      modellingStatus:
        network.modellingStatus == null
          ? network.discoveryStatus !== "Discovery Non Enabled"
          : Boolean(network.modellingStatus),
      ...(networkParentByChild.get(network.id) ? { parentNetworkId: networkParentByChild.get(network.id) } : {}),
      ...(childNetworkIds.length ? { childNetworkIds } : {}),
      securityDomain: normalizeNetworkSecurityDomain(network.securityDomain, network.classification),
      ...(network.classification ? { classification: network.classification } : {}),
      ...(network.description ? { description: network.description } : {}),
      ...(network.owner ? { owner: network.owner } : {}),
      ...(network.supportEmail ? { supportEmail: network.supportEmail } : {}),
      ...(network.serviceCatalogueUrl ? { serviceCatalogueUrl: network.serviceCatalogueUrl } : {}),
      ...(network.diisId ? { diisId: network.diisId } : {}),
      ...(network.atoNumber ? { atoNumber: network.atoNumber } : {}),
      ...(network.diisUrl ? { diisUrl: network.diisUrl } : {}),
      ...(network.grcUrl ? { grcUrl: network.grcUrl } : {}),
      discoveryStatus: network.discoveryStatus,
      ictSystemIds: systemIds,
      assetIds,
    };
  });

  const systemChildrenRows = toArrayMap(payload.ictSystemHierarchy, (row) => row.parentSystemId);
  const systemParentByChild = toFirstValueMap(
    payload.ictSystemHierarchy,
    (row) => row.childSystemId,
    (row) => row.parentSystemId
  );
  const missionRowsBySystem = toArrayMap(payload.systemMissionCapabilities, (row) => row.systemId);
  const businessRowsBySystem = toArrayMap(payload.systemBusinessServices, (row) => row.systemId);
  const environmentRowsBySystem = toArrayMap(payload.systemEnvironments, (row) => row.systemId);

  const envAssetIdsByKey = new Map<string, Set<string>>();
  for (const row of payload.systemEnvironmentAssets) {
    const mapKey = `${row.systemId}::${row.environmentId}`;
    const existing = envAssetIdsByKey.get(mapKey);
    if (existing) {
      existing.add(row.assetId);
    } else {
      envAssetIdsByKey.set(mapKey, new Set([row.assetId]));
    }
  }

  const ictSystems = payload.ictSystems.map((system) => {
    const childRows = systemChildrenRows.get(system.id) ?? [];
    const childSystemIds = sortedValues(childRows.map((row) => row.childSystemId));
    const missionCapabilities = (missionRowsBySystem.get(system.id) ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      criticality: item.criticality
    }));
    const businessServices = (businessRowsBySystem.get(system.id) ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      criticality: item.criticality
    }));
    const environments = (environmentRowsBySystem.get(system.id) ?? []).map((environment) => {
      const envKey = `${environment.systemId}::${environment.id}`;
      return {
        id: environment.id,
        name: environment.name,
        type: environment.type,
        assetIds: sortedValues(envAssetIdsByKey.get(envKey) ?? [])
      };
    });

    return {
      id: system.id,
      name: system.name,
      adfPlatform: Boolean(system.adfPlatform),
      enterprisePlatform: Boolean(system.enterprisePlatform),
      ...(systemParentByChild.get(system.id) ? { parentSystemId: systemParentByChild.get(system.id) } : {}),
      ...(childSystemIds.length ? { childSystemIds } : {}),
      ...(system.description ? { description: system.description } : {}),
      ...(system.diisId ? { diisId: system.diisId } : {}),
      ...(system.owner ? { owner: system.owner } : {}),
      ...(system.supportEmail ? { supportEmail: system.supportEmail } : {}),
      ...(system.serviceCatalogueUrl ? { serviceCatalogueUrl: system.serviceCatalogueUrl } : {}),
      ...(system.atoNumber ? { atoNumber: system.atoNumber } : {}),
      ...(system.apmNumber ? { apmNumber: system.apmNumber } : {}),
      ...(system.diisUrl ? { diisUrl: system.diisUrl } : {}),
      ...(system.grcUrl ? { grcUrl: system.grcUrl } : {}),
      modellingStatus: Boolean(system.modellingStatus),
      diisDefined: Boolean(system.diisDefined),
      networkId: system.networkId,
      criticality: system.criticality,
      securityDomain: normalizeSecurityDomain(system.securityDomain),
      missionCapabilities,
      businessServices,
      environments
    };
  });

  const operatingSystemsByAssetId = toFirstValueMap(
    payload.assetOperatingSystems,
    (row) => row.assetId,
    (row) => ({
      family: row.family,
      patchLevel: row.patchLevel ?? null,
      vendor: row.vendor,
      version: row.version,
      supportStatus: row.supportStatus
    })
  );

  const networkOperatingSystemsByAssetId = toFirstValueMap(
    payload.assetNetworkOperatingSystems,
    (row) => row.assetId,
    (row) => ({
      family: row.family,
      patchLevel: row.patchLevel ?? null,
      vendor: row.vendor,
      version: row.version,
      supportStatus: row.supportStatus
    })
  );

  const patchStateByAssetId = toFirstValueMap(
    payload.assetPatchStates,
    (row) => row.assetId,
    (row) => ({
      isLatest: row.isLatest,
      lastPatchedDate: row.lastPatchedDate ?? null
    })
  );

  const installedSoftwareRowsByAssetId = toArrayMap(payload.assetInstalledSoftware, (row) => row.assetId);
  const vulnerabilitiesByAssetId = toArrayMap(payload.assetVulnerabilities, (row) => row.assetId);

  const assets = payload.assets.map((assetRow) => {
    const vulnerabilities = (vulnerabilitiesByAssetId.get(assetRow.id) ?? []).map((row) => ({
      id: row.id,
      assetId: row.assetId,
      cve: row.cve,
      cveName: row.cveName ?? null,
      cveCreatedDate: row.cveCreatedDate ?? null,
      softwareName: row.softwareName ?? null, softwareVersion: row.softwareVersion ?? null, referenceUrl: row.referenceUrl ?? null,
      description: row.description,
      remediationGuidance: row.remediationGuidance,
      criticality: row.criticality,
      severity: row.severity,
      exploitability: row.exploitability,
      detectedDate: row.detectedDate,
      capturedAt: coerceIsoTimestamp(row.capturedAt),
      source: row.source
    }));

    const installedSoftware = (installedSoftwareRowsByAssetId.get(assetRow.id) ?? [])
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((row) => ({
        name: row.name,
        version: row.version,
        filePath: row.filePath ?? null,
        lastDiscoveredDate: row.lastDiscoveredDate ?? null,
        discoveredBy: row.discoveredBy ?? null,
        supportStatus: row.supportStatus
      }));

    const common = {
      id: assetRow.id,
      name: assetRow.name,
      hostname: assetRow.hostname,
      macAddress: assetRow.macAddress ?? null,
      deviceModel: assetRow.deviceModel ?? null,
      lastDiscoveredDate: assetRow.lastDiscoveredDate ?? null,
      discoveredBy: assetRow.discoveredBy ?? null,
      cmdbRecordUrl: assetRow.cmdbRecordUrl ?? null,
      networkId: assetRow.networkId,
      securityDomain: normalizeSecurityDomain(assetRow.securityDomain),
      lifecycle: {
        eolStatus: assetRow.eolStatus,
        warrantyStatus: assetRow.warrantyStatus
      },
      vulnerabilities,
      ...(assetRow.systemId && assetRow.environmentType
        ? {
            systemContext: {
              systemId: assetRow.systemId,
              environmentType: assetRow.environmentType
            }
          }
        : {})
    };

    const withIpAddress = common as Asset & { ipAddress?: string | null };
    withIpAddress.ipAddress = assetRow.ipAddress;

    if (assetRow.type === "ip-node") {
      return { ...withIpAddress, type: "ip-node", discoveryApproach: assetRow.discoveryApproach, arpOwnerAssetId: assetRow.arpOwnerAssetId } as Asset;
    }
    if (assetRow.type === "network-device") {
      const networkOs = networkOperatingSystemsByAssetId.get(assetRow.id) ?? null;
      const patchState = patchStateByAssetId.get(assetRow.id) ?? null;
      return {
        ...withIpAddress,
        type: "network-device",
        networkOs,
        patchState
      } as Asset;
    }

    if (assetRow.type === "server" || assetRow.type === "workstation") {
      return {
        ...withIpAddress,
        type: assetRow.type,
        operatingSystem: operatingSystemsByAssetId.get(assetRow.id) ?? null,
        installedSoftware
      } as Asset;
    }

    return {
      ...withIpAddress,
      type: assetRow.type
    } as Asset;
  });


  const ciDependencies = payload.ciDependencies.map((row) => ({
    id: row.id,
    sourceAssetId: row.sourceAssetId,
    targetAssetId: row.targetAssetId,
    dependencyType: row.dependencyType,
    ...(row.protocol ? { protocol: row.protocol } : {}),
    ...(typeof row.sourcePort === "number" ? { sourcePort: row.sourcePort } : {}),
    ...(typeof row.targetPort === "number" ? { targetPort: row.targetPort } : {}),
    ...(row.observationMethod ? { observationMethod: row.observationMethod } : {}),
    ...(row.observedAt ? { observedAt: coerceIsoTimestamp(row.observedAt) } : {})
  }));

  return {
    snapshotId: snapshot.snapshotId,
    generatedAt: coerceIsoTimestamp(snapshot.generatedAt),
    snapshotDate: coerceDateKey(snapshot.snapshotDate),
    cacheSignature,
    managedNetworks,
    ictSystems,
    assets,
    discoveryCoverageEvaluations,
    ciDependencies,
  };
}

async function loadDatasetBySnapshotId(snapshotId: number, snapshots?: SnapshotRow[], options: DatasetLoadOptions = {}): Promise<Dataset> {
  const safeSnapshotId = ensureValidSnapshotId(snapshotId), profile = normalizeDatasetLoadProfile(options.profile);
  const snapshot = (snapshots ?? await loadSnapshotRows()).find(row => row.snapshotId === safeSnapshotId);
  if (!snapshot) throw new Error("Unable to find selected snapshot.");
  const discovery = await loadLatestDiscoveryToolsSettingsVersion();
  const cacheSignature = [safeSnapshotId, profile, snapshot.generatedAt, discovery?.settingsVersionId, discovery?.updatedAt].join("|");
  return datasetBySnapshotIdCache.getOrSet(cacheSignature, async () => {
    const [payload, coverage] = await Promise.all([loadSnapshotPayload(safeSnapshotId, profile), loadSnapshotDiscoveryCoverageEvaluations(safeSnapshotId)]);
    return buildDatasetFromSnapshotRow(snapshot, payload, coverage, cacheSignature);
  });
}

export async function loadCurrentDataset(options: DatasetLoadOptions = {}): Promise<Dataset> {
  const snapshots = await loadSnapshotRows();
  const latest = latestSnapshot(snapshots);
  return loadDatasetBySnapshotId(latest.snapshotId, snapshots, options);
}

export async function loadSnapshots(options: DatasetLoadOptions = {}): Promise<Dataset[]> {
  const snapshots = await loadSnapshotRows();
  return Promise.all(snapshots.map((snapshot) => loadDatasetBySnapshotId(snapshot.snapshotId, snapshots, options)));
}

export async function loadLatestSnapshots(limit = 12, options: DatasetLoadOptions = {}): Promise<Dataset[]> {
  const snapshots = await loadSnapshotRows();
  const latest = snapshots.slice(-Math.max(0, limit));
  return Promise.all(latest.map((snapshot) => loadDatasetBySnapshotId(snapshot.snapshotId, snapshots, options)));
}

export async function loadDatasetTimeline(options: DatasetLoadOptions = {}): Promise<Dataset[]> {
  return loadSnapshots(options);
}

export async function loadDatasetForDate(
  requestedDate?: string,
  options: DatasetLoadOptions = {}
): Promise<Dataset> {
  const snapshots = await loadSnapshotRows();
  const selected = selectSnapshotRowForDate(snapshots, requestedDate);
  return loadDatasetBySnapshotId(selected.snapshotId, snapshots, options);
}

/** Header choices need snapshot names only, never assets, findings or evaluations. */
export async function loadWorkspaceFilterOptionsForDate(requestedDate?: string): Promise<WorkspaceFilterOptions> {
  const snapshots = await loadSnapshotRows();
  const snapshot = selectSnapshotRowForDate(snapshots, requestedDate);
  const snapshotId = ensureValidSnapshotId(snapshot.snapshotId);
  return workspaceFilterOptionsCache.getOrSet(`${snapshotId}:${snapshot.generatedAt}`, async () => {
    const options = await executeSqlJson<WorkspaceFilterOptions>(`
DECLARE @workspaceSnapshotId BIGINT = ${snapshotId};
SELECT
  JSON_QUERY((
    SELECT n.[network_id] AS [id], n.[name] AS [label], n.[security_domain] AS [securityDomain]
    FROM [${DATA_SCHEMA}].[managed_network] n
    WHERE n.[snapshot_id] = @workspaceSnapshotId
    ORDER BY n.[network_id]
    FOR JSON PATH
  )) AS [networks],
  JSON_QUERY((
    SELECT s.[system_id] AS [id], s.[name] AS [label], s.[security_domain] AS [securityDomain]
    FROM [${DATA_SCHEMA}].[ict_system] s
    WHERE s.[snapshot_id] = @workspaceSnapshotId
    ORDER BY s.[system_id]
    FOR JSON PATH
  )) AS [systems]
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
`);
    const byLabel = (left: { label: string }, right: { label: string }) => left.label.localeCompare(right.label);
    return {
      networks: filterRealNetworks(options.networks ?? []).map(option => ({ ...option, securityDomain: normalizeSecurityDomain(option.securityDomain) })).sort(byLabel),
      systems: (options.systems ?? []).map(option => ({ ...option, securityDomain: normalizeSecurityDomain(option.securityDomain) })).sort(byLabel)
    };
  });
}

/** Read only the CMDB fields displayed by the explorer, scoped in SQL. */
export async function loadEndpointExplorerData(searchParams: WorkspaceSearchParams): Promise<EndpointExplorerData> {
  const date = Array.isArray(searchParams.dataDate) ? searchParams.dataDate[0] : searchParams.dataDate;
  const networks = scopeIds(searchParams.network);
  const systems = scopeIds(searchParams.system);
  const domains = securityDomainSelection(searchParams.securityDomain);
  if (!networks.length && !systems.length) return { snapshotDate: targetDateKey(date), rows: [] };
  const snapshot = selectSnapshotRowForDate(await loadSnapshotRows(), date);
  const snapshotId = ensureValidSnapshotId(snapshot.snapshotId);
  const key = JSON.stringify([snapshotId, snapshot.generatedAt, networks, systems, domains]);
  return endpointExplorerCache.getOrSet(key, async () => {
    const rows = await executeSqlJson<EndpointRecord[]>(`
DECLARE @endpointSnapshotId BIGINT = ${snapshotId};
DECLARE @networks NVARCHAR(MAX) = ${networks.length ? toSqlUnicodeLiteral(JSON.stringify(networks)) : "NULL"};
DECLARE @systems NVARCHAR(MAX) = ${systems.length ? toSqlUnicodeLiteral(JSON.stringify(systems)) : "NULL"};
DECLARE @domains NVARCHAR(MAX) = ${toSqlUnicodeLiteral(JSON.stringify(domains))};
SELECT COALESCE((SELECT
  a.[asset_id] AS [assetId],
  COALESCE(NULLIF(a.[name], N''), NULLIF(a.[hostname], N''), a.[asset_id]) AS [name],
  a.[asset_type] AS [ciType], a.[security_domain] AS [securityDomain], a.[ip_address] AS [ipAddress],
  a.[mac_address] AS [macAddress], a.[device_model] AS [deviceModel],
  CASE WHEN a.[last_discovered_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), a.[last_discovered_date], 126) + N'Z' END AS [lastDiscoveredDate],
  a.[discovered_by] AS [discoveredBy],
  COALESCE(n.[name], a.[network_id]) AS [managedNetwork]
FROM [${DATA_SCHEMA}].[asset] a
LEFT JOIN [${DATA_SCHEMA}].[managed_network] n ON n.[snapshot_id] = a.[snapshot_id] AND n.[network_id] = a.[network_id]
WHERE a.[snapshot_id] = @endpointSnapshotId
  AND a.[network_id] <> N'net-unassigned' AND LTRIM(RTRIM(a.[network_id])) <> N''
  AND (@networks IS NULL OR a.[network_id] IN (SELECT [value] FROM OPENJSON(@networks)))
  AND (@systems IS NULL OR a.[system_id] IN (SELECT [value] FROM OPENJSON(@systems)))
  AND a.[security_domain] IN (SELECT [value] FROM OPENJSON(@domains))
ORDER BY a.[name], a.[asset_id]
FOR JSON PATH, INCLUDE_NULL_VALUES), N'[]');
`);
    return { snapshotDate: snapshot.snapshotDate, rows: rows.map((row) => ({ ...row, ciType: formatAssetTypeLabel(row.ciType) })) };
  });
}

/** One scoped inventory query; no analytics, vulnerability or history payloads. */
export async function loadInstalledSoftwareExplorerData(searchParams: WorkspaceSearchParams): Promise<InstalledSoftwareExplorerData> {
  const date = Array.isArray(searchParams.dataDate) ? searchParams.dataDate[0] : searchParams.dataDate;
  const networks = scopeIds(searchParams.network);
  const systems = scopeIds(searchParams.system);
  const domains = securityDomainSelection(searchParams.securityDomain);
  if (!networks.length && !systems.length) return { snapshotDate: targetDateKey(date), rows: [] };
  const snapshot = selectSnapshotRowForDate(await loadSnapshotRows(), date);
  const snapshotId = ensureValidSnapshotId(snapshot.snapshotId);
  return installedSoftwareExplorerCache.getOrSet(JSON.stringify([snapshotId, snapshot.generatedAt, networks, systems, domains]), async () => {
    const rows = await executeSqlJson<InstalledSoftwareRecord[]>(`
DECLARE @softwareSnapshotId BIGINT = ${snapshotId};
DECLARE @networks NVARCHAR(MAX) = ${networks.length ? toSqlUnicodeLiteral(JSON.stringify(networks)) : "NULL"};
DECLARE @systems NVARCHAR(MAX) = ${systems.length ? toSqlUnicodeLiteral(JSON.stringify(systems)) : "NULL"};
DECLARE @domains NVARCHAR(MAX) = ${toSqlUnicodeLiteral(JSON.stringify(domains))};
SELECT COALESCE((SELECT sw.[asset_id] AS [assetId], sw.[software_ordinal] AS [softwareOrdinal],
  sw.[name] AS [softwareName], sw.[version] AS [softwareVersion], sw.[file_path] AS [filePath],
  CASE WHEN sw.[last_discovered_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), sw.[last_discovered_date], 126) + N'Z' END AS [lastDiscoveredDate],
  sw.[discovered_by] AS [discoveredBy],
  COALESCE(NULLIF(a.[name], N''), NULLIF(a.[hostname], N''), a.[asset_id]) AS [deviceName],
  a.[device_model] AS [deviceModel],
  CASE WHEN os.[asset_id] IS NOT NULL THEN os.[family] ELSE nos.[family] END AS [osName],
  CASE WHEN os.[asset_id] IS NOT NULL THEN os.[version] ELSE nos.[version] END AS [osVersion],
  CASE WHEN os.[asset_id] IS NOT NULL THEN os.[patch_level] ELSE nos.[patch_level] END AS [osPatchLevel]
FROM [${DATA_SCHEMA}].[asset_installed_software] sw
JOIN [${DATA_SCHEMA}].[asset] a ON a.[snapshot_id] = sw.[snapshot_id] AND a.[asset_id] = sw.[asset_id]
LEFT JOIN [${DATA_SCHEMA}].[asset_operating_system] os ON os.[snapshot_id] = a.[snapshot_id] AND os.[asset_id] = a.[asset_id]
LEFT JOIN [${DATA_SCHEMA}].[asset_network_os] nos ON nos.[snapshot_id] = a.[snapshot_id] AND nos.[asset_id] = a.[asset_id]
WHERE sw.[snapshot_id] = @softwareSnapshotId
  AND a.[network_id] <> N'net-unassigned' AND LTRIM(RTRIM(a.[network_id])) <> N''
  AND (@networks IS NULL OR a.[network_id] IN (SELECT [value] FROM OPENJSON(@networks)))
  AND (@systems IS NULL OR a.[system_id] IN (SELECT [value] FROM OPENJSON(@systems)))
  AND a.[security_domain] IN (SELECT [value] FROM OPENJSON(@domains))
ORDER BY sw.[name], sw.[version], a.[name], sw.[asset_id], sw.[software_ordinal]
FOR JSON PATH, INCLUDE_NULL_VALUES), N'[]');
`);
    return { snapshotDate: snapshot.snapshotDate, rows };
  });
}

/** Vulnerability observations join endpoint/OS data within the selected snapshot. */
export async function loadSecurityVulnerabilityExplorerData(searchParams: WorkspaceSearchParams): Promise<SecurityVulnerabilityExplorerData> {
  const date = Array.isArray(searchParams.dataDate) ? searchParams.dataDate[0] : searchParams.dataDate;
  const networks = scopeIds(searchParams.network), systems = scopeIds(searchParams.system);
  const domains = securityDomainSelection(searchParams.securityDomain);
  if (!networks.length && !systems.length) return { snapshotDate: targetDateKey(date), rows: [] };
  const snapshot = selectSnapshotRowForDate(await loadSnapshotRows(), date);
  const snapshotId = ensureValidSnapshotId(snapshot.snapshotId);
  return securityVulnerabilityExplorerCache.getOrSet(JSON.stringify([snapshotId, snapshot.generatedAt, networks, systems, domains]), async () => {
    const rows = await executeSqlJson<SecurityVulnerabilityRecord[]>(`
DECLARE @vulnerabilitySnapshotId BIGINT = ${snapshotId};
DECLARE @networks NVARCHAR(MAX) = ${networks.length ? toSqlUnicodeLiteral(JSON.stringify(networks)) : "NULL"};
DECLARE @systems NVARCHAR(MAX) = ${systems.length ? toSqlUnicodeLiteral(JSON.stringify(systems)) : "NULL"};
DECLARE @domains NVARCHAR(MAX) = ${toSqlUnicodeLiteral(JSON.stringify(domains))};
SELECT COALESCE((SELECT v.[asset_id] AS [assetId], v.[vulnerability_id] AS [vulnerabilityId], v.[cve] AS [cve],
  v.[cve_name] AS [cveName], v.[description] AS [description],
  CONVERT(CHAR(10), v.[detected_date], 23) AS [detectedDate],
  CONVERT(CHAR(10), v.[cve_created_date], 23) AS [cveCreatedDate],
  v.[software_name] AS [softwareName], v.[software_version] AS [softwareVersion], v.[reference_url] AS [referenceUrl],
  v.[remediation_guidance] AS [remediationGuidance], v.[severity] AS [severity], v.[source] AS [source],
  COALESCE(NULLIF(a.[name], N''), NULLIF(a.[hostname], N''), a.[asset_id]) AS [deviceName], a.[device_model] AS [deviceModel],
  CASE WHEN os.[asset_id] IS NOT NULL THEN os.[family] ELSE nos.[family] END AS [osName],
  CASE WHEN os.[asset_id] IS NOT NULL THEN os.[version] ELSE nos.[version] END AS [osVersion],
  CASE WHEN os.[asset_id] IS NOT NULL THEN os.[patch_level] ELSE nos.[patch_level] END AS [osPatchLevel]
FROM [${DATA_SCHEMA}].[asset_vulnerability] v
JOIN [${DATA_SCHEMA}].[asset] a ON a.[snapshot_id] = v.[snapshot_id] AND a.[asset_id] = v.[asset_id]
LEFT JOIN [${DATA_SCHEMA}].[asset_operating_system] os ON os.[snapshot_id] = a.[snapshot_id] AND os.[asset_id] = a.[asset_id]
LEFT JOIN [${DATA_SCHEMA}].[asset_network_os] nos ON nos.[snapshot_id] = a.[snapshot_id] AND nos.[asset_id] = a.[asset_id]
WHERE v.[snapshot_id] = @vulnerabilitySnapshotId AND v.[detected_date] <= ${toSqlUnicodeLiteral(snapshot.snapshotDate)}
  AND a.[asset_type] <> N'ip-node'
  AND a.[network_id] <> N'net-unassigned' AND LTRIM(RTRIM(a.[network_id])) <> N''
  AND (@networks IS NULL OR a.[network_id] IN (SELECT [value] FROM OPENJSON(@networks)))
  AND (@systems IS NULL OR a.[system_id] IN (SELECT [value] FROM OPENJSON(@systems)))
  AND a.[security_domain] IN (SELECT [value] FROM OPENJSON(@domains))
ORDER BY v.[cve], a.[name], v.[asset_id], v.[vulnerability_id]
FOR JSON PATH, INCLUDE_NULL_VALUES), N'[]');
`);
    return { snapshotDate: snapshot.snapshotDate, rows };
  });
}

/** IP Node observations; owner details always come from the same snapshot. */
export async function loadShadowItExplorerData(searchParams: WorkspaceSearchParams): Promise<ShadowItExplorerData> {
  const date = Array.isArray(searchParams.dataDate) ? searchParams.dataDate[0] : searchParams.dataDate;
  const networks = scopeIds(searchParams.network);
  const systems = scopeIds(searchParams.system);
  const domains = securityDomainSelection(searchParams.securityDomain);
  if (!networks.length && !systems.length) return { snapshotDate: targetDateKey(date), rows: [] };
  const snapshot = selectSnapshotRowForDate(await loadSnapshotRows(), date);
  const snapshotId = ensureValidSnapshotId(snapshot.snapshotId);
  return shadowItExplorerCache.getOrSet(JSON.stringify([snapshotId, snapshot.generatedAt, networks, systems, domains]), async () => {
    const rows = await executeSqlJson<ShadowItRecord[]>(`
DECLARE @shadowSnapshotId BIGINT = ${snapshotId};
DECLARE @networks NVARCHAR(MAX) = ${networks.length ? toSqlUnicodeLiteral(JSON.stringify(networks)) : "NULL"};
DECLARE @systems NVARCHAR(MAX) = ${systems.length ? toSqlUnicodeLiteral(JSON.stringify(systems)) : "NULL"};
DECLARE @domains NVARCHAR(MAX) = ${toSqlUnicodeLiteral(JSON.stringify(domains))};
SELECT COALESCE((SELECT node.[asset_id] AS [assetId], owner.[asset_id] AS [ownerAssetId],
  node.[ip_address] AS [ipAddress], node.[discovery_approach] AS [discoveryApproach],
  CASE WHEN node.[last_discovered_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), node.[last_discovered_date], 126) + N'Z' END AS [lastDiscoveredDate],
  node.[discovered_by] AS [discoveredBy], owner.[name] AS [endpointName], owner.[asset_type] AS [endpointCiType],
  owner.[ip_address] AS [endpointIpAddress], owner.[mac_address] AS [endpointMacAddress], owner.[device_model] AS [endpointDeviceModel],
  CASE WHEN owner.[last_discovered_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), owner.[last_discovered_date], 126) + N'Z' END AS [endpointLastDiscoveredDate],
  owner.[discovered_by] AS [endpointDiscoveredBy], network.[name] AS [endpointManagedNetwork]
FROM [${DATA_SCHEMA}].[asset] node
LEFT JOIN [${DATA_SCHEMA}].[asset] owner ON node.[discovery_approach] = N'ARP Table'
  AND owner.[snapshot_id] = node.[snapshot_id] AND owner.[asset_id] = node.[arp_owner_asset_id] AND owner.[network_id] = node.[network_id]
LEFT JOIN [${DATA_SCHEMA}].[managed_network] network ON network.[snapshot_id] = owner.[snapshot_id] AND network.[network_id] = owner.[network_id]
WHERE node.[snapshot_id] = @shadowSnapshotId AND node.[asset_type] = N'ip-node'
  AND node.[security_domain] IN (SELECT [value] FROM OPENJSON(@domains))
  AND node.[network_id] <> N'net-unassigned' AND LTRIM(RTRIM(node.[network_id])) <> N''
  AND (@networks IS NULL OR node.[network_id] IN (SELECT [value] FROM OPENJSON(@networks)))
  AND (@systems IS NULL OR node.[system_id] IN (SELECT [value] FROM OPENJSON(@systems)) OR owner.[system_id] IN (SELECT [value] FROM OPENJSON(@systems)))
ORDER BY node.[ip_address], node.[asset_id]
FOR JSON PATH, INCLUDE_NULL_VALUES), N'[]');
`);
    return { snapshotDate: snapshot.snapshotDate, rows: rows.map((row) => ({ ...row,
      endpointCiType: row.endpointCiType ? formatAssetTypeLabel(row.endpointCiType) : null })) };
  });
}

export async function loadLatestSnapshotsForDate(
  requestedDate: string | undefined,
  limit = 12,
  options: DatasetLoadOptions = {}
): Promise<Dataset[]> {
  const snapshots = await loadSnapshotRows();
  const target = targetDateKey(requestedDate);
  const selected = snapshots.filter((snapshot) => snapshot.snapshotDate <= target).slice(-Math.max(0, limit));
  return Promise.all(selected.map((snapshot) => loadDatasetBySnapshotId(snapshot.snapshotId, snapshots, options)));
}

export async function loadSnapshotsForDateWindow(
  requestedDate: string | undefined,
  monthsBack = 12,
  options: DatasetLoadOptions = {}
): Promise<Dataset[]> {
  const snapshots = await loadSnapshotRows();
  const endSnapshot = selectSnapshotRowForDate(snapshots, requestedDate);
  const startDate = subtractCalendarMonthsDateKey(endSnapshot.snapshotDate, monthsBack);
  const selected = snapshots.filter(
    (snapshot) => snapshot.snapshotDate >= startDate && snapshot.snapshotDate <= endSnapshot.snapshotDate
  );
  return Promise.all(selected.map((snapshot) => loadDatasetBySnapshotId(snapshot.snapshotId, snapshots, options)));
}

function clearSettingsDependentCaches(): void {
}

function clearDiscoveryToolsSettingsCaches(): void {
  discoveryToolsSettingsVersionCache.clear();
  discoveryToolsSettingsByVersionCache.clear();
  datasetBySnapshotIdCache.clear();
  clearSettingsDependentCaches();
}

async function loadLatestDiscoveryToolsSettingsVersion(): Promise<SettingsVersionRow | null> {
  return discoveryToolsSettingsVersionCache.getOrSet("latest", () =>
    executeSqlJson<SettingsVersionRow | null>(`
SELECT TOP (1)
  dsv.[settings_version_id] AS [settingsVersionId],
  CONVERT(NVARCHAR(40), dsv.[updated_at], 127) AS [updatedAt]
FROM [${DATA_SCHEMA}].[discovery_tools_settings_version] dsv
ORDER BY dsv.[updated_at] DESC, dsv.[settings_version_id] DESC
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
`)
  );
}

export async function loadDiscoveryToolsSettings(): Promise<DiscoveryToolsSettings> {
  const version = await loadLatestDiscoveryToolsSettingsVersion();

  if (!version) {
    return defaultDiscoveryToolsSettings();
  }

  return discoveryToolsSettingsByVersionCache.getOrSet(
    `version:${version.settingsVersionId}:${version.updatedAt}`,
    async () => {
      const [toolRows, scopeRows] = await Promise.all([
        executeSqlJson<DiscoveryToolRow[]>(`
SELECT
  dt.[tool_id] AS [id],
  dt.[name] AS [name],
  dt.[description] AS [description],
  dt.[el2_owner] AS [el2Owner],
  dt.[el2_operations_manager] AS [el2OperationsManager]
FROM [${DATA_SCHEMA}].[discovery_tool] dt
WHERE dt.[settings_version_id] = ${version.settingsVersionId}
ORDER BY dt.[tool_id]
FOR JSON PATH;
`),
        executeSqlJson<DiscoveryToolScopeRow[]>(`
SELECT
  dts.[tool_id] AS [toolId],
  dts.[asset_type] AS [assetType],
  dts.[scope_setting] AS [scopeSetting]
FROM [${DATA_SCHEMA}].[discovery_tool_asset_scope] dts
WHERE dts.[settings_version_id] = ${version.settingsVersionId}
ORDER BY dts.[tool_id], dts.[asset_type]
FOR JSON PATH;
`)
      ]);

      const scopeByTool = toArrayMap(scopeRows, (row) => row.toolId);
      const tools = toolRows.map((tool) => {
        const toolScopes = scopeByTool.get(tool.id) ?? [];
        const assetTypeScope: Record<AssetType, "required" | "na"> = createAssetTypeRecord((type) => type === "ip-node" ? "na" : "required");

        for (const scope of toolScopes) {
          assetTypeScope[scope.assetType] = scope.scopeSetting;
        }

        return {
          id: tool.id,
          name: tool.name,
          description: tool.description,
          el2Owner: tool.el2Owner,
          el2OperationsManager: tool.el2OperationsManager,
          assetTypeScope
        };
      });

      return normalizeDiscoveryToolsSettings({
        updatedAt: coerceIsoTimestamp(version.updatedAt),
        tools
      });
    }
  );
}

export async function saveDiscoveryToolsSettings(input: unknown): Promise<DiscoveryToolsSettings> {
  const existing = await loadDiscoveryToolsSettings();
  const normalized = normalizeDiscoveryToolsScopeUpdate(input, existing);
  const persisted: DiscoveryToolsSettings = {
    ...normalized,
    updatedAt: new Date().toISOString()
  };

  const toolValues = persisted.tools.map(
    (tool) =>
      `(@newVersionId, ${toSqlUnicodeLiteral(tool.id)}, ${toSqlUnicodeLiteral(tool.name)}, ${toSqlUnicodeLiteral(tool.description)}, ${toSqlUnicodeLiteral(tool.el2Owner)}, ${toSqlUnicodeLiteral(tool.el2OperationsManager)})`
  );

  const scopeValues: string[] = [];
  for (const tool of persisted.tools) {
    for (const assetType of ASSET_TYPES) {
      const scopeSetting = tool.assetTypeScope[assetType];
      scopeValues.push(
        `(@newVersionId, ${toSqlUnicodeLiteral(tool.id)}, ${toSqlUnicodeLiteral(assetType)}, ${toSqlUnicodeLiteral(scopeSetting)})`
      );
    }
  }

  await executeSqlText(`
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @newVersionId BIGINT;
INSERT INTO [${DATA_SCHEMA}].[discovery_tools_settings_version] ([updated_at])
VALUES (${toSqlUnicodeLiteral(persisted.updatedAt)});
SET @newVersionId = SCOPE_IDENTITY();

${
  toolValues.length
    ? `INSERT INTO [${DATA_SCHEMA}].[discovery_tool] (
  [settings_version_id],
  [tool_id],
  [name],
  [description],
  [el2_owner],
  [el2_operations_manager]
)
VALUES
${toolValues.join(",\n")};`
    : ""
}

${
  scopeValues.length
    ? `INSERT INTO [${DATA_SCHEMA}].[discovery_tool_asset_scope] (
  [settings_version_id],
  [tool_id],
  [asset_type],
  [scope_setting]
)
VALUES
${scopeValues.join(",\n")};`
    : ""
}

COMMIT TRANSACTION;
`);

  clearDiscoveryToolsSettingsCaches();
  return persisted;
}

export function clearDataLoaderCaches(): void {
  snapshotRowsCache.clear();
  datasetBySnapshotIdCache.clear();
  workspaceFilterOptionsCache.clear();
  endpointExplorerCache.clear();
  installedSoftwareExplorerCache.clear();
  securityVulnerabilityExplorerCache.clear();
  shadowItExplorerCache.clear();
  discoveryToolsSettingsVersionCache.clear();
  discoveryToolsSettingsByVersionCache.clear();
  clearSettingsDependentCaches();
}

export function __resetDataLoaderCachesForTest(): void {
  clearDataLoaderCaches();
  snapshotRowsCache.resetStats();
  datasetBySnapshotIdCache.resetStats();
  workspaceFilterOptionsCache.resetStats();
  endpointExplorerCache.resetStats();
  installedSoftwareExplorerCache.resetStats();
  securityVulnerabilityExplorerCache.resetStats();
  shadowItExplorerCache.resetStats();
  discoveryToolsSettingsVersionCache.resetStats();
  discoveryToolsSettingsByVersionCache.resetStats();
}
