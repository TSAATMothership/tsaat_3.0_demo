import "server-only";

import { ASSET_TYPES as CANONICAL_ASSET_TYPES, createAssetTypeRecord } from "@/lib/asset-taxonomy";
import { normalizeDataDate, subtractCalendarMonthsDateKey, todayDateKey } from "@/lib/data-date";
import {
  defaultDiscoveryToolsSettings,
  DiscoveryToolsSettings,
  normalizeDiscoveryToolsScopeUpdate,
  normalizeDiscoveryToolsSettings
} from "@/lib/discovery-tools-settings";
import { KpiDefinition, normalizeKpiDefinitions } from "@/lib/kpi-definitions";
import {
  defaultMeasuresSettings,
  FindingPriorityDefinition,
  MeasuresSettings,
  normalizeMeasuresSettings,
  normalizePriorityDefinitions
} from "@/lib/measures-settings";
import {
  normalizeSeverityDefinitions,
  normalizeSpiDefinitions,
  renderSpiOutcomeReason,
  SeverityDefinition,
  severityDefinitionsCacheSignature,
  SpiCalculationDefinition,
  SpiCalculationEvidenceExpression,
  SpiCalculationSource,
  SpiDefinition,
  SpiFeatureBinding,
  SpiFindingClassificationRule,
  SpiReportDetailDefinition,
  SpiRuleDefinition,
  SpiRuleOutcomeTemplate,
  SpiRuleParameterDefinition,
  spiDefinitionsCacheSignature,
  SpiRuleParameterValue
} from "@/lib/spi-definitions";
import { clearAnalyticsCache } from "@/lib/analytics-cache";
import { clearAppDataCaches } from "@/lib/app-data-cache";
import { ServerMemoryCache } from "@/lib/server-cache";
import { Asset, AssetType, ComplianceStatus, Dataset, EnvironmentType, Finding, ReferenceVersions, SpiId, StoredSpiEvaluation } from "@/lib/types";
import { executeSqlJson, executeSqlText, toSqlUnicodeLiteral } from "@/lib/sql-server";

type SnapshotRow = {
  snapshotId: number;
  snapshotDate: string;
  generatedAt: string;
};

type SettingsVersionRow = {
  settingsVersionId: number;
  updatedAt: string;
};

type ManagedNetworkRow = {
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
  apmNumber: string | null;
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

type NetworkTargetStateAssetRow = {
  networkId: string;
  assetType: AssetType;
  assetName: string;
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
  securityDomain: "Secret" | "Protected" | "Unclassified";
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
  type: AssetType;
  networkId: string;
  securityDomain: "Secret" | "Protected" | "Unclassified";
  systemId: string | null;
  environmentType: EnvironmentType | null;
  eolStatus: "Supported" | "EOL" | "Unknown";
  warrantyStatus: "InWarranty" | "OutOfWarranty" | "Unknown";
};

type AssetOperatingSystemRow = {
  assetId: string;
  family: string;
  vendor: string;
  majorVersion: number | null;
  version: string;
  supportStatus: "Supported" | "OutOfSupport" | "Unknown";
  currentSupportedMajor: number | null;
  nMinus: number | null;
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
  supportStatus: "Supported" | "OutOfSupport" | "Unknown";
};

type AssetVulnerabilityRow = {
  assetId: string;
  id: string;
  cve: string;
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

type FindingRow = {
  id: string;
  spiId: number;
  priorityRank: number;
  severity: "High Risk" | "Critical Exposure" | "Major" | "Moderate" | "Data Gap";
  complianceStatus: "Compliant" | "Non-compliant" | "Unknown";
  networkId: string;
  systemId: string | null;
  environmentType: EnvironmentType | null;
  assetId: string;
  title: string;
  evidence: Record<string, string | number | boolean | null> | null;
  recommendedAction: string;
  status: "open" | "closed";
  timestamp: string;
  closedTimestamp: string | null;
};

type SnapshotPayload = {
  managedNetworks: ManagedNetworkRow[];
  managedNetworkHierarchy: ManagedNetworkHierarchyRow[];
  networkDeclaredSystems: NetworkDeclaredSystemRow[];
  networkDeclaredAssets: NetworkDeclaredAssetRow[];
  networkTargetStateAssets: NetworkTargetStateAssetRow[];
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
  findings: FindingRow[];
};

type MeasuresMatrixRow = {
  spiId: number;
  assetType: AssetType;
  severity: string;
};

type MeasuresPriorityMatrixRow = {
  spiId: number;
  priorityRank: number;
};

type KpiDefinitionRow = {
  id: string;
  displayOrder: number;
  name: string;
  description: string;
  successMeasure: string;
  calculationKey: string;
  reportAvailable: boolean | number;
};

type SpiDefinitionRow = {
  spiId: number;
  displayOrder: number;
  name: string;
  description: string;
  successMeasure: string;
  priorityOrder: number;
  defaultSeverity: string;
  recommendedAction: string;
  enabled: boolean | number;
  ruleKey: string;
  reportAvailable: boolean | number;
  trendReportAvailable: boolean | number;
  reportDetailKey: string;
};

type SpiApplicableAssetTypeRow = {
  spiId: number;
  assetType: AssetType;
};

type SpiRuleParameterRow = {
  spiId: number;
  parameterKey: string;
  parameterType: "string" | "number" | "boolean";
  parameterValue: string;
};

type SpiRuleDefinitionRow = SpiRuleDefinition;

type SpiCalculationSourceRow = SpiCalculationSource;

type SpiCalculationDefinitionRow = Omit<SpiCalculationDefinition, "source" | "evidenceExpressions">;

type SpiCalculationEvidenceExpressionRow = SpiCalculationEvidenceExpression;

type SpiRuleParameterDefinitionRow = Omit<SpiRuleParameterDefinition, "allowedValues"> & {
  allowedValuesJson: string | null;
};

type SpiRuleOutcomeTemplateRow = SpiRuleOutcomeTemplate;

type SpiReportDetailDefinitionRow = SpiReportDetailDefinition;

type SpiFindingClassificationRuleRow = SpiFindingClassificationRule;

type SpiFeatureBindingRow = SpiFeatureBinding;

type StoredSpiEvaluationRow = {
  assetId: string;
  spiId: number;
  outcomeKey: string;
  status: ComplianceStatus;
  evidence: Record<string, string | number | boolean | null> | null;
};

type SpiTaskingTeamRow = {
  spiId: number;
  displayOrder: number;
  team: string;
  supportQueue: string;
  contactEmail: string;
};

type SpiTaskingActionTemplateRow = {
  spiId: number;
  displayOrder: number;
  conditionKey: string;
  actionText: string;
};

type SpiTaskingConditionTemplateRow = {
  spiId: number;
  conditionKey: string;
  templateText: string;
};

type SeverityDefinitionRow = {
  severityKey: string;
  label: string;
  displayOrder: number;
  selectableInSettings: boolean | number;
  toneKey: string;
};

type FindingPriorityDefinitionRow = {
  priorityRank: number;
  label: string;
  displayOrder: number;
  selectableInSettings: boolean | number;
  description: string;
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
const REFERENCE_VERSIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const SETTINGS_VERSION_CACHE_TTL_MS = 60 * 1000;
const SETTINGS_BY_VERSION_CACHE_TTL_MS = 5 * 60 * 1000;
const KPI_DEFINITIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const SPI_DEFINITIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const SEVERITY_DEFINITIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const PRIORITY_DEFINITIONS_CACHE_TTL_MS = 5 * 60 * 1000;

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

const referenceVersionsCache = new ServerMemoryCache<ReferenceVersions>({
  namespace: "data:reference-versions",
  ttlMs: REFERENCE_VERSIONS_CACHE_TTL_MS,
  maxEntries: 1
});

const kpiDefinitionsCache = new ServerMemoryCache<KpiDefinition[]>({
  namespace: "data:kpi-definitions",
  ttlMs: KPI_DEFINITIONS_CACHE_TTL_MS,
  maxEntries: 1
});

const spiDefinitionsCache = new ServerMemoryCache<SpiDefinition[]>({
  namespace: "data:spi-definitions",
  ttlMs: SPI_DEFINITIONS_CACHE_TTL_MS,
  maxEntries: 1
});

const severityDefinitionsCache = new ServerMemoryCache<SeverityDefinition[]>({
  namespace: "data:severity-definitions",
  ttlMs: SEVERITY_DEFINITIONS_CACHE_TTL_MS,
  maxEntries: 1
});

const priorityDefinitionsCache = new ServerMemoryCache<FindingPriorityDefinition[]>({
  namespace: "data:priority-definitions",
  ttlMs: PRIORITY_DEFINITIONS_CACHE_TTL_MS,
  maxEntries: 1
});

const measuresSettingsVersionCache = new ServerMemoryCache<SettingsVersionRow | null>({
  namespace: "settings:measures-version",
  ttlMs: SETTINGS_VERSION_CACHE_TTL_MS,
  maxEntries: 1
});

const measuresSettingsByVersionCache = new ServerMemoryCache<MeasuresSettings>({
  namespace: "settings:measures",
  ttlMs: SETTINGS_BY_VERSION_CACHE_TTL_MS,
  maxEntries: 24
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

function normalizeSqlEvidence(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const evidence: Record<string, string | number | boolean | null> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (!/^[A-Za-z0-9_]+$/.test(key)) {
      continue;
    }
    if (
      rawValue === null ||
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean"
    ) {
      evidence[key] = rawValue;
    }
  }
  return evidence;
}

function normalizeStoredSpiEvaluations(
  rows: StoredSpiEvaluationRow[],
  spiDefinitions: SpiDefinition[]
): StoredSpiEvaluation[] {
  const definitionsById = new Map(spiDefinitions.map((definition) => [definition.spiId, definition]));
  const evaluations: StoredSpiEvaluation[] = [];

  for (const row of rows) {
    const definition = definitionsById.get(row.spiId);
    if (!definition || !["Compliant", "Non-compliant", "Unknown"].includes(row.status)) {
      continue;
    }

    const evaluation = {
      assetId: row.assetId,
      spiId: row.spiId,
      outcomeKey: row.outcomeKey,
      status: row.status,
      evidence: normalizeSqlEvidence(row.evidence),
      reasons: []
    } satisfies StoredSpiEvaluation;

    evaluations.push({
      ...evaluation,
      reasons: [renderSpiOutcomeReason(definition, evaluation)]
    });
  }

  return evaluations;
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

async function loadSnapshotPayload(snapshotId: number): Promise<SnapshotPayload> {
  const safeSnapshotId = ensureValidSnapshotId(snapshotId);

  const raw = await executeSqlJson<Partial<SnapshotPayload>>(`
DECLARE @snapshotId BIGINT = ${safeSnapshotId};
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
      n.[description] AS [description],
      n.[owner] AS [owner],
      n.[support_email] AS [supportEmail],
      n.[service_catalogue_url] AS [serviceCatalogueUrl],
      n.[diis_id] AS [diisId],
      n.[ato_number] AS [atoNumber],
      n.[apm_number] AS [apmNumber],
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
      ntsa.[network_id] AS [networkId],
      ntsa.[asset_type] AS [assetType],
      ntsa.[asset_name] AS [assetName]
    FROM [${DATA_SCHEMA}].[network_target_state_asset] ntsa
    WHERE ntsa.[snapshot_id] = @snapshotId
    ORDER BY ntsa.[network_id], ntsa.[asset_type], ntsa.[asset_name]
    FOR JSON PATH
  )) AS [networkTargetStateAssets],
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
      aos.[major_version] AS [majorVersion],
      aos.[version] AS [version],
      aos.[support_status] AS [supportStatus],
      aos.[current_supported_major] AS [currentSupportedMajor],
      aos.[n_minus] AS [nMinus]
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
      nos.[major_version] AS [majorVersion],
      nos.[version] AS [version],
      nos.[support_status] AS [supportStatus],
      nos.[current_supported_major] AS [currentSupportedMajor],
      nos.[n_minus] AS [nMinus]
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
  JSON_QUERY((
    SELECT
      sw.[asset_id] AS [assetId],
      sw.[software_ordinal] AS [ordinal],
      sw.[name] AS [name],
      sw.[version] AS [version],
      sw.[support_status] AS [supportStatus]
    FROM [${DATA_SCHEMA}].[asset_installed_software] sw
    WHERE sw.[snapshot_id] = @snapshotId
    ORDER BY sw.[asset_id], sw.[software_ordinal]
    FOR JSON PATH
  )) AS [assetInstalledSoftware],
  JSON_QUERY((
    SELECT
      v.[asset_id] AS [assetId],
      v.[vulnerability_id] AS [id],
      v.[cve] AS [cve],
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
  )) AS [assetVulnerabilities],
  JSON_QUERY((
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
  )) AS [ciDependencies],
  JSON_QUERY((
    SELECT
      f.[finding_id] AS [id],
      f.[spi_id] AS [spiId],
      f.[priority_rank] AS [priorityRank],
      f.[severity] AS [severity],
      f.[compliance_status] AS [complianceStatus],
      f.[network_id] AS [networkId],
      f.[system_id] AS [systemId],
      f.[environment_type] AS [environmentType],
      f.[asset_id] AS [assetId],
      f.[title] AS [title],
      JSON_QUERY(f.[evidence]) AS [evidence],
      f.[recommended_action] AS [recommendedAction],
      f.[workflow_status] AS [status],
      CONVERT(NVARCHAR(40), f.[observed_at], 127) AS [timestamp],
      CONVERT(NVARCHAR(40), f.[closed_at], 127) AS [closedTimestamp]
    FROM [${DATA_SCHEMA}].[finding] f
    WHERE f.[snapshot_id] = @snapshotId
    ORDER BY f.[priority_rank], f.[finding_id]
    FOR JSON PATH
  )) AS [findings]
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
`);

  return {
    managedNetworks: Array.isArray(raw.managedNetworks) ? raw.managedNetworks : [],
    managedNetworkHierarchy: Array.isArray(raw.managedNetworkHierarchy) ? raw.managedNetworkHierarchy : [],
    networkDeclaredSystems: Array.isArray(raw.networkDeclaredSystems) ? raw.networkDeclaredSystems : [],
    networkDeclaredAssets: Array.isArray(raw.networkDeclaredAssets) ? raw.networkDeclaredAssets : [],
    networkTargetStateAssets: Array.isArray(raw.networkTargetStateAssets) ? raw.networkTargetStateAssets : [],
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
    findings: Array.isArray(raw.findings) ? raw.findings : []
  };
}

async function loadSnapshotSpiEvaluations(
  snapshotId: number,
  spiDefinitions: SpiDefinition[]
): Promise<StoredSpiEvaluation[]> {
  const safeSnapshotId = ensureValidSnapshotId(snapshotId);
  const rows = await executeSqlJson<StoredSpiEvaluationRow[]>(`
DECLARE @SpiEvaluations TABLE (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [spi_id] INT NOT NULL,
  [display_order] INT NOT NULL,
  [compliance_status] NVARCHAR(20) NOT NULL,
  [outcome_key] NVARCHAR(100) NOT NULL,
  [evidence_json] NVARCHAR(MAX) NOT NULL
);

INSERT INTO @SpiEvaluations (
  [snapshot_id],
  [asset_id],
  [spi_id],
  [display_order],
  [compliance_status],
  [outcome_key],
  [evidence_json]
)
EXEC [${DATA_SCHEMA}].[usp_evaluate_spi_snapshot] @snapshot_id = ${safeSnapshotId};

SELECT
  evaluation.[asset_id] AS [assetId],
  evaluation.[spi_id] AS [spiId],
  evaluation.[outcome_key] AS [outcomeKey],
  evaluation.[compliance_status] AS [status],
  JSON_QUERY(evaluation.[evidence_json]) AS [evidence]
FROM @SpiEvaluations AS evaluation
ORDER BY evaluation.[asset_id], evaluation.[display_order], evaluation.[spi_id]
FOR JSON PATH;
`);

  return normalizeStoredSpiEvaluations(rows, spiDefinitions);
}

function buildDatasetFromSnapshotRow(
  snapshot: SnapshotRow,
  payload: SnapshotPayload,
  spiEvaluations: StoredSpiEvaluation[]
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

  const networkTargetStateAssets = new Map<string, Record<AssetType, string[]>>();
  for (const row of payload.networkTargetStateAssets) {
    const networkRecord =
      networkTargetStateAssets.get(row.networkId) ?? createAssetTypeRecord(() => []);
    networkRecord[row.assetType].push(row.assetName);
    networkTargetStateAssets.set(row.networkId, networkRecord);
  }

  const managedNetworks = payload.managedNetworks.map((network) => {
    const childRows = networkChildrenRows.get(network.id) ?? [];
    const childNetworkIds = sortedValues(childRows.map((row) => row.childNetworkId));
    const systemIds = sortedValues(networkSystemIds.get(network.id) ?? []);
    const assetIds = sortedValues(networkAssetIds.get(network.id) ?? []);
    const targetStateAssets = networkTargetStateAssets.get(network.id);

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
      ...(network.classification ? { classification: network.classification } : {}),
      ...(network.description ? { description: network.description } : {}),
      ...(network.owner ? { owner: network.owner } : {}),
      ...(network.supportEmail ? { supportEmail: network.supportEmail } : {}),
      ...(network.serviceCatalogueUrl ? { serviceCatalogueUrl: network.serviceCatalogueUrl } : {}),
      ...(network.diisId ? { diisId: network.diisId } : {}),
      ...(network.atoNumber ? { atoNumber: network.atoNumber } : {}),
      ...(network.apmNumber ? { apmNumber: network.apmNumber } : {}),
      ...(network.diisUrl ? { diisUrl: network.diisUrl } : {}),
      ...(network.grcUrl ? { grcUrl: network.grcUrl } : {}),
      discoveryStatus: network.discoveryStatus,
      ictSystemIds: systemIds,
      assetIds,
      ...(targetStateAssets ? { targetStateAssets } : {})
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
      securityDomain: system.securityDomain,
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
      vendor: row.vendor,
      majorVersion: row.majorVersion,
      version: row.version,
      supportStatus: row.supportStatus,
      currentSupportedMajor: row.currentSupportedMajor,
      nMinus: row.nMinus
    })
  );

  const networkOperatingSystemsByAssetId = toFirstValueMap(
    payload.assetNetworkOperatingSystems,
    (row) => row.assetId,
    (row) => ({
      family: row.family,
      vendor: row.vendor,
      majorVersion: row.majorVersion,
      version: row.version,
      supportStatus: row.supportStatus,
      currentSupportedMajor: row.currentSupportedMajor,
      nMinus: row.nMinus
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
        supportStatus: row.supportStatus
      }));

    const common = {
      id: assetRow.id,
      name: assetRow.name,
      hostname: assetRow.hostname,
      networkId: assetRow.networkId,
      securityDomain: assetRow.securityDomain,
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

  const findings: Finding[] = payload.findings
    .filter((row) => Number.isInteger(row.spiId) && row.spiId > 0)
    .map((row) => ({
      id: row.id,
      spiId: row.spiId as SpiId,
      priorityRank: row.priorityRank,
      severity: row.severity,
      status: row.status,
      complianceStatus: row.complianceStatus,
      timestamp: coerceIsoTimestamp(row.timestamp),
      ...(row.closedTimestamp ? { closedTimestamp: coerceIsoTimestamp(row.closedTimestamp) } : {}),
      scope: {
        networkId: row.networkId,
        systemId: row.systemId ?? null,
        environmentType: row.environmentType ?? null,
        assetId: row.assetId
      },
      title: row.title,
      evidence: row.evidence ?? {},
      recommendedAction: row.recommendedAction
    }));

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
    generatedAt: coerceIsoTimestamp(snapshot.generatedAt),
    snapshotDate: coerceDateKey(snapshot.snapshotDate),
    managedNetworks,
    ictSystems,
    assets,
    spiEvaluations,
    ciDependencies,
    findings
  };
}

async function loadDatasetBySnapshotId(snapshotId: number, snapshots?: SnapshotRow[]): Promise<Dataset> {
  const safeSnapshotId = ensureValidSnapshotId(snapshotId);
  const snapshotRows = snapshots ?? (await loadSnapshotRows());
  const snapshot = snapshotRows.find((row) => row.snapshotId === safeSnapshotId);
  if (!snapshot) {
    throw new Error(`Unable to find snapshot ${safeSnapshotId}.`);
  }

  const spiDefinitions = await loadSpiDefinitions();
  const spiSignature = spiDefinitionsCacheSignature(spiDefinitions);

  return datasetBySnapshotIdCache.getOrSet(`snapshot:${safeSnapshotId}:${snapshot.generatedAt}:${spiSignature}`, async () => {
    const [payload, spiEvaluations] = await Promise.all([
      loadSnapshotPayload(safeSnapshotId),
      loadSnapshotSpiEvaluations(safeSnapshotId, spiDefinitions)
    ]);
    return buildDatasetFromSnapshotRow(snapshot, payload, spiEvaluations);
  });
}

export async function loadCurrentDataset(): Promise<Dataset> {
  const snapshots = await loadSnapshotRows();
  const latest = latestSnapshot(snapshots);
  return loadDatasetBySnapshotId(latest.snapshotId, snapshots);
}

export async function loadSnapshots(): Promise<Dataset[]> {
  const snapshots = await loadSnapshotRows();
  return Promise.all(snapshots.map((snapshot) => loadDatasetBySnapshotId(snapshot.snapshotId, snapshots)));
}

export async function loadLatestSnapshots(limit = 12): Promise<Dataset[]> {
  const snapshots = await loadSnapshotRows();
  const latest = snapshots.slice(-Math.max(0, limit));
  return Promise.all(latest.map((snapshot) => loadDatasetBySnapshotId(snapshot.snapshotId, snapshots)));
}

export async function loadDatasetTimeline(): Promise<Dataset[]> {
  return loadSnapshots();
}

export async function loadDatasetForDate(requestedDate?: string): Promise<Dataset> {
  const snapshots = await loadSnapshotRows();
  const selected = selectSnapshotRowForDate(snapshots, requestedDate);
  return loadDatasetBySnapshotId(selected.snapshotId, snapshots);
}

export async function loadLatestSnapshotsForDate(requestedDate: string | undefined, limit = 12): Promise<Dataset[]> {
  const snapshots = await loadSnapshotRows();
  const target = targetDateKey(requestedDate);
  const selected = snapshots.filter((snapshot) => snapshot.snapshotDate <= target).slice(-Math.max(0, limit));
  return Promise.all(selected.map((snapshot) => loadDatasetBySnapshotId(snapshot.snapshotId, snapshots)));
}

export async function loadSnapshotsForDateWindow(
  requestedDate: string | undefined,
  monthsBack = 12
): Promise<Dataset[]> {
  const snapshots = await loadSnapshotRows();
  const endSnapshot = selectSnapshotRowForDate(snapshots, requestedDate);
  const startDate = subtractCalendarMonthsDateKey(endSnapshot.snapshotDate, monthsBack);
  const selected = snapshots.filter(
    (snapshot) => snapshot.snapshotDate >= startDate && snapshot.snapshotDate <= endSnapshot.snapshotDate
  );
  return Promise.all(selected.map((snapshot) => loadDatasetBySnapshotId(snapshot.snapshotId, snapshots)));
}

export async function loadReferenceVersions(): Promise<ReferenceVersions> {
  return referenceVersionsCache.getOrSet("latest", async () => {
    const row = await executeSqlJson<{ versionSetId: number } | null>(`
SELECT TOP (1)
  version_ref.[version_set_id] AS [versionSetId]
FROM (
  SELECT ds.[reference_version_set_id] AS [version_set_id], ds.[snapshot_date] AS [snapshot_date], CAST(0 AS INT) AS [ord]
  FROM [${DATA_SCHEMA}].[dataset_snapshot] ds
  WHERE ds.[reference_version_set_id] IS NOT NULL
  UNION ALL
  SELECT rv.[version_set_id], CAST(NULL AS DATE), CAST(1 AS INT)
  FROM [${DATA_SCHEMA}].[reference_version_set] rv
) version_ref
ORDER BY
  version_ref.[ord] ASC,
  version_ref.[snapshot_date] DESC,
  version_ref.[version_set_id] DESC
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
`);

    if (!row) {
      return {
        osCurrentMajor: {},
        softwareSupportMatrix: {}
      };
    }

    const versionSetId = row.versionSetId;
    const [osRows, softwareRows] = await Promise.all([
      executeSqlJson<Array<{ osKey: string; currentSupportedMajor: number }>>(
        `
SELECT
  osm.[os_key] AS [osKey],
  osm.[current_supported_major] AS [currentSupportedMajor]
FROM [${DATA_SCHEMA}].[reference_os_current_major] osm
WHERE osm.[version_set_id] = ${versionSetId}
ORDER BY osm.[os_key]
FOR JSON PATH;
`
      ),
      executeSqlJson<Array<{ softwareName: string; versionOrdinal: number; version: string }>>(
        `
SELECT
  ssv.[software_name] AS [softwareName],
  ssv.[version_ordinal] AS [versionOrdinal],
  ssv.[version] AS [version]
FROM [${DATA_SCHEMA}].[reference_software_supported_version] ssv
WHERE ssv.[version_set_id] = ${versionSetId}
ORDER BY ssv.[software_name], ssv.[version_ordinal]
FOR JSON PATH;
`
      )
    ]);

    const osCurrentMajor: Record<string, number> = {};
    for (const rowItem of osRows) {
      osCurrentMajor[rowItem.osKey] = rowItem.currentSupportedMajor;
    }

    const softwareSupportMatrix: Record<string, string[]> = {};
    for (const rowItem of softwareRows) {
      const existing = softwareSupportMatrix[rowItem.softwareName];
      if (existing) {
        existing.push(rowItem.version);
      } else {
        softwareSupportMatrix[rowItem.softwareName] = [rowItem.version];
      }
    }

    return {
      osCurrentMajor,
      softwareSupportMatrix
    };
  });
}

function ruleParameterValue(row: SpiRuleParameterRow): SpiRuleParameterValue {
  if (row.parameterType === "number") {
    const numericValue = Number(row.parameterValue);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }
  if (row.parameterType === "boolean") {
    return ["1", "true", "yes"].includes(row.parameterValue.trim().toLowerCase());
  }
  return row.parameterValue;
}

function groupBySpiId<T extends { spiId: number }>(rows: T[]): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const existing = grouped.get(row.spiId);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(row.spiId, [row]);
    }
  }
  return grouped;
}

function groupByRuleKey<T extends { ruleKey: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const existing = grouped.get(row.ruleKey);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(row.ruleKey, [row]);
    }
  }
  return grouped;
}

export async function loadSeverityDefinitions(): Promise<SeverityDefinition[]> {
  return severityDefinitionsCache.getOrSet("latest", async () => {
    const rows = await executeSqlJson<SeverityDefinitionRow[]>(`
SELECT
  fsd.[severity_key] AS [severityKey],
  fsd.[label] AS [label],
  fsd.[display_order] AS [displayOrder],
  fsd.[selectable_in_settings] AS [selectableInSettings],
  fsd.[tone_key] AS [toneKey]
FROM [${DATA_SCHEMA}].[finding_severity_definition] fsd
ORDER BY fsd.[display_order], fsd.[severity_key]
FOR JSON PATH;
`);

    return normalizeSeverityDefinitions(rows);
  });
}

export async function loadFindingPriorityDefinitions(): Promise<FindingPriorityDefinition[]> {
  return priorityDefinitionsCache.getOrSet("latest", async () => {
    const rows = await executeSqlJson<FindingPriorityDefinitionRow[]>(`
SELECT
  fpd.[priority_rank] AS [priorityRank],
  fpd.[label] AS [label],
  fpd.[display_order] AS [displayOrder],
  fpd.[selectable_in_settings] AS [selectableInSettings],
  fpd.[description] AS [description]
FROM [${DATA_SCHEMA}].[finding_priority_definition] fpd
ORDER BY fpd.[display_order], fpd.[priority_rank]
FOR JSON PATH;
`);

    return normalizePriorityDefinitions(rows);
  });
}

export async function loadSpiDefinitions(): Promise<SpiDefinition[]> {
  return spiDefinitionsCache.getOrSet("latest", async () => {
    const [
      definitionRows,
      applicabilityRows,
      parameterRows,
      teamRows,
      actionRows,
      conditionRows,
      ruleDefinitionRows,
      calculationSourceRows,
      calculationDefinitionRows,
      calculationEvidenceRows,
      parameterDefinitionRows,
      outcomeTemplateRows,
      reportDetailRows,
      classificationRuleRows,
      featureBindingRows
    ] = await Promise.all([
      executeSqlJson<SpiDefinitionRow[]>(`
SELECT
  sd.[spi_id] AS [spiId],
  sd.[display_order] AS [displayOrder],
  sd.[name] AS [name],
  sd.[description] AS [description],
  sd.[success_measure] AS [successMeasure],
  sd.[priority_order] AS [priorityOrder],
  sd.[default_severity] AS [defaultSeverity],
  sd.[recommended_action] AS [recommendedAction],
  sd.[enabled] AS [enabled],
  sd.[rule_key] AS [ruleKey],
  sd.[report_available] AS [reportAvailable],
  sd.[trend_report_available] AS [trendReportAvailable],
  sd.[report_detail_key] AS [reportDetailKey]
FROM [${DATA_SCHEMA}].[spi_definition] sd
ORDER BY sd.[display_order], sd.[spi_id]
FOR JSON PATH;
`),
      executeSqlJson<SpiApplicableAssetTypeRow[]>(`
SELECT
  saat.[spi_id] AS [spiId],
  saat.[asset_type] AS [assetType]
FROM [${DATA_SCHEMA}].[spi_applicable_asset_type] saat
ORDER BY saat.[spi_id], saat.[asset_type]
FOR JSON PATH;
`),
      executeSqlJson<SpiRuleParameterRow[]>(`
SELECT
  srp.[spi_id] AS [spiId],
  srp.[parameter_key] AS [parameterKey],
  srp.[parameter_type] AS [parameterType],
  srp.[parameter_value] AS [parameterValue]
FROM [${DATA_SCHEMA}].[spi_rule_parameter] srp
ORDER BY srp.[spi_id], srp.[parameter_key]
FOR JSON PATH;
`),
      executeSqlJson<SpiTaskingTeamRow[]>(`
SELECT
  stt.[spi_id] AS [spiId],
  stt.[display_order] AS [displayOrder],
  stt.[team] AS [team],
  stt.[support_queue] AS [supportQueue],
  stt.[contact_email] AS [contactEmail]
FROM [${DATA_SCHEMA}].[spi_tasking_team] stt
ORDER BY stt.[spi_id], stt.[display_order], stt.[team]
FOR JSON PATH;
`),
      executeSqlJson<SpiTaskingActionTemplateRow[]>(`
SELECT
  stat.[spi_id] AS [spiId],
  stat.[display_order] AS [displayOrder],
  stat.[condition_key] AS [conditionKey],
  stat.[action_text] AS [actionText]
FROM [${DATA_SCHEMA}].[spi_tasking_action_template] stat
ORDER BY stat.[spi_id], stat.[display_order]
FOR JSON PATH;
`),
      executeSqlJson<SpiTaskingConditionTemplateRow[]>(`
SELECT
  stct.[spi_id] AS [spiId],
  stct.[condition_key] AS [conditionKey],
  stct.[template_text] AS [templateText]
FROM [${DATA_SCHEMA}].[spi_tasking_condition_template] stct
ORDER BY stct.[spi_id], stct.[condition_key]
FOR JSON PATH;
`),
      executeSqlJson<SpiRuleDefinitionRow[]>(`
SELECT
  srd.[rule_key] AS [ruleKey],
  srd.[handler_key] AS [handlerKey],
  srd.[display_order] AS [displayOrder],
  srd.[name] AS [name],
  srd.[description] AS [description],
  srd.[enabled] AS [enabled]
FROM [${DATA_SCHEMA}].[spi_rule_definition] srd
ORDER BY srd.[display_order], srd.[rule_key]
FOR JSON PATH;
`),
      executeSqlJson<SpiCalculationSourceRow[]>(`
SELECT
  scs.[source_key] AS [sourceKey],
  scs.[source_object_name] AS [sourceObjectName],
  scs.[display_order] AS [displayOrder],
  scs.[name] AS [name],
  scs.[description] AS [description],
  scs.[enabled] AS [enabled]
FROM [${DATA_SCHEMA}].[spi_calculation_source] scs
ORDER BY scs.[display_order], scs.[source_key]
FOR JSON PATH;
`),
      executeSqlJson<SpiCalculationDefinitionRow[]>(`
SELECT
  scd.[rule_key] AS [ruleKey],
  scd.[source_key] AS [sourceKey],
  scd.[display_order] AS [displayOrder],
  scd.[status_expression_sql] AS [statusExpressionSql],
  scd.[outcome_expression_sql] AS [outcomeExpressionSql],
  scd.[enabled] AS [enabled]
FROM [${DATA_SCHEMA}].[spi_calculation_definition] scd
ORDER BY scd.[display_order], scd.[rule_key]
FOR JSON PATH;
`),
      executeSqlJson<SpiCalculationEvidenceExpressionRow[]>(`
SELECT
  scee.[rule_key] AS [ruleKey],
  scee.[evidence_key] AS [evidenceKey],
  scee.[display_order] AS [displayOrder],
  scee.[value_type] AS [valueType],
  scee.[value_expression_sql] AS [valueExpressionSql],
  scee.[omit_when_null] AS [omitWhenNull]
FROM [${DATA_SCHEMA}].[spi_calculation_evidence_expression] scee
ORDER BY scee.[rule_key], scee.[display_order], scee.[evidence_key]
FOR JSON PATH;
`),
      executeSqlJson<SpiRuleParameterDefinitionRow[]>(`
SELECT
  srpd.[rule_key] AS [ruleKey],
  srpd.[parameter_key] AS [parameterKey],
  srpd.[parameter_type] AS [parameterType],
  srpd.[required] AS [required],
  srpd.[default_value] AS [defaultValue],
  srpd.[allowed_values_json] AS [allowedValuesJson],
  srpd.[display_order] AS [displayOrder],
  srpd.[description] AS [description]
FROM [${DATA_SCHEMA}].[spi_rule_parameter_definition] srpd
ORDER BY srpd.[rule_key], srpd.[display_order], srpd.[parameter_key]
FOR JSON PATH;
`),
      executeSqlJson<SpiRuleOutcomeTemplateRow[]>(`
SELECT
  srot.[rule_key] AS [ruleKey],
  srot.[outcome_key] AS [outcomeKey],
  srot.[compliance_status] AS [complianceStatus],
  srot.[reason_template] AS [reasonTemplate],
  srot.[evidence_template] AS [evidenceTemplate]
FROM [${DATA_SCHEMA}].[spi_rule_outcome_template] srot
ORDER BY srot.[rule_key], srot.[outcome_key], srot.[compliance_status]
FOR JSON PATH;
`),
      executeSqlJson<SpiReportDetailDefinitionRow[]>(`
SELECT
  srdd.[report_detail_key] AS [reportDetailKey],
  srdd.[handler_key] AS [handlerKey],
  srdd.[display_order] AS [displayOrder],
  srdd.[name] AS [name],
  srdd.[description] AS [description],
  srdd.[enabled] AS [enabled]
FROM [${DATA_SCHEMA}].[spi_report_detail_definition] srdd
ORDER BY srdd.[display_order], srdd.[report_detail_key]
FOR JSON PATH;
`),
      executeSqlJson<SpiFindingClassificationRuleRow[]>(`
SELECT
  sfcr.[classification_rule_id] AS [classificationRuleId],
  sfcr.[display_order] AS [displayOrder],
  sfcr.[enabled] AS [enabled],
  sfcr.[spi_id] AS [spiId],
  sfcr.[compliance_status] AS [complianceStatus],
  sfcr.[condition_key] AS [conditionKey],
  sfcr.[severity_key] AS [severityKey],
  sfcr.[priority_rank] AS [priorityRank],
  sfcr.[description] AS [description]
FROM [${DATA_SCHEMA}].[spi_finding_classification_rule] sfcr
ORDER BY sfcr.[display_order], sfcr.[classification_rule_id]
FOR JSON PATH;
`),
      executeSqlJson<SpiFeatureBindingRow[]>(`
SELECT
  sfb.[feature_key] AS [featureKey],
  sfb.[spi_id] AS [spiId],
  sfb.[display_order] AS [displayOrder],
  sfb.[compliance_status] AS [complianceStatus],
  sfb.[outcome_key] AS [outcomeKey],
  sfb.[enabled] AS [enabled],
  sfb.[description] AS [description]
FROM [${DATA_SCHEMA}].[spi_feature_binding] sfb
ORDER BY sfb.[spi_id], sfb.[display_order], sfb.[feature_key]
FOR JSON PATH;
`)
    ]);

    const applicabilityBySpi = groupBySpiId(applicabilityRows);
    const parametersBySpi = groupBySpiId(parameterRows);
    const teamsBySpi = groupBySpiId(teamRows);
    const actionsBySpi = groupBySpiId(actionRows);
    const conditionsBySpi = groupBySpiId(conditionRows);
    const featureBindingsBySpi = groupBySpiId(featureBindingRows);
    const ruleDefinitionByKey = new Map(ruleDefinitionRows.map((row) => [row.ruleKey, row]));
    const calculationSourceByKey = new Map(calculationSourceRows.map((row) => [row.sourceKey, row]));
    const calculationEvidenceByRule = groupByRuleKey(calculationEvidenceRows);
    const calculationDefinitionByRule = new Map(
      calculationDefinitionRows.map((row) => [
        row.ruleKey,
        {
          ...row,
          source: calculationSourceByKey.get(row.sourceKey),
          evidenceExpressions: calculationEvidenceByRule.get(row.ruleKey) ?? []
        }
      ])
    );
    const parameterDefinitionsByRule = groupByRuleKey(parameterDefinitionRows);
    const outcomeTemplatesByRule = groupByRuleKey(outcomeTemplateRows);
    const reportDetailByKey = new Map(reportDetailRows.map((row) => [row.reportDetailKey, row]));

    return normalizeSpiDefinitions(
      definitionRows.map((row) => ({
        ...row,
        ruleDefinition: ruleDefinitionByKey.get(row.ruleKey),
        calculationDefinition: calculationDefinitionByRule.get(row.ruleKey),
        parameterDefinitions: parameterDefinitionsByRule.get(row.ruleKey) ?? [],
        outcomeTemplates: outcomeTemplatesByRule.get(row.ruleKey) ?? [],
        classificationRules: classificationRuleRows,
        featureBindings: featureBindingsBySpi.get(row.spiId) ?? [],
        reportDetailDefinition: reportDetailByKey.get(row.reportDetailKey),
        applicableAssetTypes: (applicabilityBySpi.get(row.spiId) ?? []).map((item) => item.assetType),
        ruleParameters: Object.fromEntries(
          (parametersBySpi.get(row.spiId) ?? []).map((item) => [item.parameterKey, ruleParameterValue(item)])
        ),
        taskingTeams: teamsBySpi.get(row.spiId) ?? [],
        taskingActions: actionsBySpi.get(row.spiId) ?? [],
        taskingConditions: conditionsBySpi.get(row.spiId) ?? []
      }))
    );
  });
}

export async function loadKpiDefinitions(): Promise<KpiDefinition[]> {
  return kpiDefinitionsCache.getOrSet("latest", async () => {
    const rows = await executeSqlJson<KpiDefinitionRow[]>(`
SELECT
  kpi.[kpi_id] AS [id],
  kpi.[display_order] AS [displayOrder],
  kpi.[name] AS [name],
  kpi.[description] AS [description],
  kpi.[success_measure] AS [successMeasure],
  kpi.[calculation_key] AS [calculationKey],
  kpi.[report_available] AS [reportAvailable]
FROM [${DATA_SCHEMA}].[kpi_definition] kpi
ORDER BY kpi.[display_order], kpi.[kpi_id]
FOR JSON PATH;
`);

    return normalizeKpiDefinitions(rows);
  });
}

function clearSettingsDependentCaches(): void {
  clearAnalyticsCache();
  clearAppDataCaches();
}

function clearMeasuresSettingsCaches(): void {
  measuresSettingsVersionCache.clear();
  measuresSettingsByVersionCache.clear();
  clearSettingsDependentCaches();
}

function clearDiscoveryToolsSettingsCaches(): void {
  discoveryToolsSettingsVersionCache.clear();
  discoveryToolsSettingsByVersionCache.clear();
  clearSettingsDependentCaches();
}

async function loadLatestMeasuresSettingsVersion(): Promise<SettingsVersionRow | null> {
  return measuresSettingsVersionCache.getOrSet("latest", () =>
    executeSqlJson<SettingsVersionRow | null>(`
SELECT TOP (1)
  msv.[settings_version_id] AS [settingsVersionId],
  CONVERT(NVARCHAR(40), msv.[updated_at], 127) AS [updatedAt]
FROM [${DATA_SCHEMA}].[measures_settings_version] msv
ORDER BY msv.[updated_at] DESC, msv.[settings_version_id] DESC
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
`)
  );
}

export async function loadMeasuresSettings(
  providedSpiDefinitions?: SpiDefinition[],
  providedSeverityDefinitions?: SeverityDefinition[],
  providedPriorityDefinitions?: FindingPriorityDefinition[]
): Promise<MeasuresSettings> {
  const [version, spiDefinitions, severityDefinitions, priorityDefinitions] = await Promise.all([
    loadLatestMeasuresSettingsVersion(),
    providedSpiDefinitions ? Promise.resolve(providedSpiDefinitions) : loadSpiDefinitions(),
    providedSeverityDefinitions ? Promise.resolve(providedSeverityDefinitions) : loadSeverityDefinitions(),
    providedPriorityDefinitions ? Promise.resolve(providedPriorityDefinitions) : loadFindingPriorityDefinitions()
  ]);

  if (!version) {
    return defaultMeasuresSettings(spiDefinitions, severityDefinitions, priorityDefinitions);
  }

  return measuresSettingsByVersionCache.getOrSet(
    [
      `version:${version.settingsVersionId}:${version.updatedAt}`,
      spiDefinitionsCacheSignature(spiDefinitions),
      severityDefinitionsCacheSignature(severityDefinitions),
      JSON.stringify(priorityDefinitions.map((definition) => [
        definition.priorityRank,
        definition.label,
        definition.displayOrder,
        definition.selectableInSettings
      ]))
    ].join("::"),
    async () => {
      const [severityRows, priorityRows] = await Promise.all([
        executeSqlJson<MeasuresMatrixRow[]>(`
SELECT
  msm.[spi_id] AS [spiId],
  msm.[asset_type] AS [assetType],
  msm.[severity] AS [severity]
FROM [${DATA_SCHEMA}].[measures_severity_matrix] msm
WHERE msm.[settings_version_id] = ${version.settingsVersionId}
ORDER BY msm.[spi_id], msm.[asset_type]
FOR JSON PATH;
`),
        executeSqlJson<MeasuresPriorityMatrixRow[]>(`
SELECT
  mpm.[spi_id] AS [spiId],
  mpm.[priority_rank] AS [priorityRank]
FROM [${DATA_SCHEMA}].[measures_priority_matrix] mpm
WHERE mpm.[settings_version_id] = ${version.settingsVersionId}
ORDER BY mpm.[spi_id]
FOR JSON PATH;
`)
      ]);

      const severityMatrix: Record<string, MeasuresMatrixRow["severity"]> = {};
      for (const row of severityRows) {
        severityMatrix[`${row.spiId}:${row.assetType}`] = row.severity;
      }

      const priorityMatrix: Record<string, number> = {};
      for (const row of priorityRows) {
        priorityMatrix[String(row.spiId)] = row.priorityRank;
      }

      return normalizeMeasuresSettings({
        updatedAt: coerceIsoTimestamp(version.updatedAt),
        severityMatrix,
        priorityMatrix
      }, spiDefinitions, severityDefinitions, priorityDefinitions);
    }
  );
}

export async function saveMeasuresSettings(input: unknown): Promise<MeasuresSettings> {
  const [spiDefinitions, severityDefinitions, priorityDefinitions] = await Promise.all([
    loadSpiDefinitions(),
    loadSeverityDefinitions(),
    loadFindingPriorityDefinitions()
  ]);
  const normalized = normalizeMeasuresSettings(input, spiDefinitions, severityDefinitions, priorityDefinitions);
  const persisted: MeasuresSettings = {
    ...normalized,
    updatedAt: new Date().toISOString()
  };

  const severityValueTuples: string[] = [];
  for (const definition of spiDefinitions) {
    for (const assetType of ASSET_TYPES) {
      const key = `${definition.spiId}:${assetType}`;
      const severity = persisted.severityMatrix[key];
      if (severity) {
        severityValueTuples.push(`(@newVersionId, ${definition.spiId}, ${toSqlUnicodeLiteral(assetType)}, ${toSqlUnicodeLiteral(severity)})`);
      }
    }
  }

  const priorityValueTuples: string[] = [];
  for (const definition of spiDefinitions) {
    const priorityRank = persisted.priorityMatrix[String(definition.spiId)];
    if (priorityRank) {
      priorityValueTuples.push(`(@newVersionId, ${definition.spiId}, ${priorityRank})`);
    }
  }

  if (!severityValueTuples.length) {
    throw new Error("No measures severity mappings were produced after normalization.");
  }
  if (!priorityValueTuples.length) {
    throw new Error("No measures priority mappings were produced after normalization.");
  }

  await executeSqlText(`
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @newVersionId BIGINT;
INSERT INTO [${DATA_SCHEMA}].[measures_settings_version] ([updated_at])
VALUES (${toSqlUnicodeLiteral(persisted.updatedAt)});
SET @newVersionId = SCOPE_IDENTITY();

INSERT INTO [${DATA_SCHEMA}].[measures_severity_matrix] (
  [settings_version_id],
  [spi_id],
  [asset_type],
  [severity]
)
VALUES
${severityValueTuples.join(",\n")};

INSERT INTO [${DATA_SCHEMA}].[measures_priority_matrix] (
  [settings_version_id],
  [spi_id],
  [priority_rank]
)
VALUES
${priorityValueTuples.join(",\n")};

COMMIT TRANSACTION;
`);

  clearMeasuresSettingsCaches();
  return persisted;
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
        const assetTypeScope: Record<AssetType, "required" | "na"> = createAssetTypeRecord(() => "required");

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
  referenceVersionsCache.clear();
  kpiDefinitionsCache.clear();
  spiDefinitionsCache.clear();
  severityDefinitionsCache.clear();
  priorityDefinitionsCache.clear();
  measuresSettingsVersionCache.clear();
  measuresSettingsByVersionCache.clear();
  discoveryToolsSettingsVersionCache.clear();
  discoveryToolsSettingsByVersionCache.clear();
  clearSettingsDependentCaches();
}

export function __resetDataLoaderCachesForTest(): void {
  clearDataLoaderCaches();
  snapshotRowsCache.resetStats();
  datasetBySnapshotIdCache.resetStats();
  referenceVersionsCache.resetStats();
  kpiDefinitionsCache.resetStats();
  spiDefinitionsCache.resetStats();
  severityDefinitionsCache.resetStats();
  priorityDefinitionsCache.resetStats();
  measuresSettingsVersionCache.resetStats();
  measuresSettingsByVersionCache.resetStats();
  discoveryToolsSettingsVersionCache.resetStats();
  discoveryToolsSettingsByVersionCache.resetStats();
}
