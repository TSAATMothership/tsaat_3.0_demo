import "server-only";

import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { clearAnalyticsCache } from "@/lib/analytics-cache";
import { clearAppDataCaches } from "@/lib/app-data-cache";
import { normalizeDataDate, subtractCalendarMonthsDateKey, todayDateKey } from "@/lib/data-date";
import {
  defaultDiscoveryToolsSettings,
  type DiscoveryToolsSettings,
  normalizeDiscoveryToolsScopeUpdate,
  normalizeDiscoveryToolsSettings
} from "@/lib/discovery-tools-settings";
import { evaluateDemoKpis, evaluateDemoKpiScopes } from "@/lib/demo-kpi-evaluator";
import {
  type FindingDisplayConfiguration,
  normalizeFindingDisplayConfiguration
} from "@/lib/findings-config";
import {
  type KpiDefinition,
  kpiDefinitionsCacheSignature,
  normalizeKpiDefinitions
} from "@/lib/kpi-definitions";
import {
  applyMeasuresPrioritySettings,
  applyMeasuresSeveritySettings,
  defaultMeasuresSettings,
  type FindingPriorityDefinition,
  type MeasuresSettings,
  normalizeMeasuresSettings,
  normalizePriorityDefinitions
} from "@/lib/measures-settings";
import {
  normalizeSeverityDefinitions,
  normalizeSpiDefinitions,
  type SeverityDefinition,
  type SpiDefinition
} from "@/lib/spi-definitions";
import type {
  Asset,
  Dataset,
  Finding,
  ICTSystem,
  ManagedNetwork,
  ReferenceVersions,
  StoredDiscoveryCoverageEvaluation,
  StoredKpiEvaluation
} from "@/lib/types";

type SnapshotRow = {
  snapshotId: number;
  snapshotDate: string;
  generatedAt: string;
  fileName: string;
};

export type DatasetLoadProfile = "summary" | "risk-summary" | "full";

type DatasetLoadOptions = {
  profile?: DatasetLoadProfile;
};

type DemoRuntimeConfig = {
  referenceVersions?: unknown;
  severityDefinitions?: unknown;
  priorityDefinitions?: unknown;
  findingDisplayConfiguration?: unknown;
  spiDefinitions?: unknown;
  kpiDefinitions?: unknown;
  measuresSettings?: unknown;
  discoveryToolsSettings?: unknown;
};

const SNAPSHOT_FILE_PATTERN = /^week-(\d+)\.json$/i;
const SNAPSHOT_HEADER_BYTES = 4096;

let runtimeConfigPromise: Promise<DemoRuntimeConfig> | null = null;
let snapshotRowsPromise: Promise<SnapshotRow[]> | null = null;
let measuresSettingsOverride: MeasuresSettings | null = null;
let discoveryToolsSettingsOverride: DiscoveryToolsSettings | null = null;

const rawSnapshotCache = new Map<number, Promise<Dataset>>();
const materializedDatasetCache = new Map<string, Promise<Dataset>>();
const effectiveFindingsCache = new Map<string, Promise<Finding[]>>();
const kpiEvaluationCache = new Map<string, Promise<StoredKpiEvaluation[]>>();
const scopedKpiEvaluationCache = new Map<string, Promise<Map<string, StoredKpiEvaluation[]>>>();

function resolveDataDirectory(): string {
  const candidates = [
    path.join(process.cwd(), "data"),
    path.join(process.cwd(), "TSAATDemo", "data")
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "runtime-config.json"))) {
      return candidate;
    }
  }

  throw new Error("Unable to locate TSAATDemo/data/runtime-config.json.");
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Unable to parse demo data file '${filePath}': ${message}`);
  }
}

async function loadRuntimeConfig(): Promise<DemoRuntimeConfig> {
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = readJsonFile<DemoRuntimeConfig>(
      path.join(resolveDataDirectory(), "runtime-config.json")
    ).catch((error) => {
      runtimeConfigPromise = null;
      throw error;
    });
  }
  return runtimeConfigPromise;
}

function extractHeaderValue(source: string, key: string): string | undefined {
  return source.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`))?.[1];
}

async function readSnapshotHeader(fileName: string): Promise<SnapshotRow> {
  const filePath = path.join(resolveDataDirectory(), "snapshots", fileName);
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = new Uint8Array(new ArrayBuffer(SNAPSHOT_HEADER_BYTES));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const header = new TextDecoder().decode(buffer.subarray(0, bytesRead));
    const snapshotIdMatch = header.match(/"snapshotId"\s*:\s*(\d+)/);
    const snapshotDate = extractHeaderValue(header, "snapshotDate");
    const generatedAt = extractHeaderValue(header, "generatedAt");

    if (!snapshotIdMatch || !snapshotDate || !generatedAt) {
      throw new Error(`Demo snapshot '${fileName}' is missing required header fields.`);
    }

    return {
      snapshotId: Number(snapshotIdMatch[1]),
      snapshotDate,
      generatedAt,
      fileName
    };
  } finally {
    await handle.close();
  }
}

async function loadSnapshotRows(): Promise<SnapshotRow[]> {
  if (!snapshotRowsPromise) {
    snapshotRowsPromise = (async () => {
      const snapshotsDirectory = path.join(resolveDataDirectory(), "snapshots");
      const fileNames = (await fs.readdir(snapshotsDirectory))
        .filter((fileName) => SNAPSHOT_FILE_PATTERN.test(fileName))
        .sort((left, right) => left.localeCompare(right));
      const rows = await Promise.all(fileNames.map(readSnapshotHeader));
      rows.sort(
        (left, right) =>
          left.snapshotDate.localeCompare(right.snapshotDate) || left.snapshotId - right.snapshotId
      );

      if (!rows.length) {
        throw new Error("No TSAAT demo snapshots are available.");
      }
      if (new Set(rows.map((row) => row.snapshotId)).size !== rows.length) {
        throw new Error("TSAAT demo snapshot identifiers must be unique.");
      }
      return rows;
    })().catch((error) => {
      snapshotRowsPromise = null;
      throw error;
    });
  }
  return snapshotRowsPromise;
}

function normalizeDatasetLoadProfile(profile: DatasetLoadProfile | undefined): DatasetLoadProfile {
  return profile === "summary" || profile === "risk-summary" ? profile : "full";
}

function targetDateKey(requestedDate: string | undefined): string {
  return normalizeDataDate(requestedDate) ?? todayDateKey();
}

function selectSnapshotRowForDate(rows: SnapshotRow[], requestedDate: string | undefined): SnapshotRow {
  const target = targetDateKey(requestedDate);
  const matching = rows.filter((row) => row.snapshotDate <= target);
  return matching[matching.length - 1] ?? rows[0];
}

function latestSnapshot(rows: SnapshotRow[]): SnapshotRow {
  const latest = rows[rows.length - 1];
  if (!latest) {
    throw new Error("No TSAAT demo snapshots are available.");
  }
  return latest;
}

function assertDataset(value: Dataset, expectedSnapshotId: number): Dataset {
  if (
    !value ||
    value.snapshotId !== expectedSnapshotId ||
    !Array.isArray(value.managedNetworks) ||
    !Array.isArray(value.ictSystems) ||
    !Array.isArray(value.assets) ||
    !Array.isArray(value.spiEvaluations)
  ) {
    throw new Error(`Demo snapshot ${expectedSnapshotId} has an invalid dataset shape.`);
  }
  return value;
}

async function loadRawSnapshot(snapshotId: number): Promise<Dataset> {
  if (!Number.isInteger(snapshotId) || snapshotId < 1) {
    throw new Error(`Invalid snapshot identifier '${snapshotId}'.`);
  }

  const existing = rawSnapshotCache.get(snapshotId);
  if (existing) {
    return existing;
  }

  const pending = (async () => {
    const rows = await loadSnapshotRows();
    const row = rows.find((candidate) => candidate.snapshotId === snapshotId);
    if (!row) {
      throw new Error(`Unable to find snapshot ${snapshotId}.`);
    }

    const isLatest = row.snapshotId === latestSnapshot(rows).snapshotId;
    const currentPath = path.join(resolveDataDirectory(), "current.json");
    const snapshotPath = path.join(resolveDataDirectory(), "snapshots", row.fileName);
    const filePath = isLatest && existsSync(currentPath) ? currentPath : snapshotPath;
    return assertDataset(await readJsonFile<Dataset>(filePath), snapshotId);
  })().catch((error) => {
    rawSnapshotCache.delete(snapshotId);
    throw error;
  });

  rawSnapshotCache.set(snapshotId, pending);
  return pending;
}

function cloneAssetForProfile(asset: Asset, profile: DatasetLoadProfile): Asset {
  const includeRiskPayload = profile !== "summary";
  const vulnerabilities = includeRiskPayload ? asset.vulnerabilities : [];

  if (asset.type === "server" || asset.type === "workstation") {
    return {
      ...asset,
      vulnerabilities,
      installedSoftware: profile === "full" ? asset.installedSoftware : []
    };
  }

  return { ...asset, vulnerabilities };
}

function resetFindingDisplayValues(findings: Finding[]): Finding[] {
  return findings.map((finding) => ({
    ...finding,
    priorityRank: finding.rawPriorityRank ?? finding.priorityRank,
    severity: finding.rawSeverity ?? finding.severity
  }));
}

function applyFindingSettings(
  findings: Finding[],
  assets: Asset[],
  settings: MeasuresSettings
): Finding[] {
  const severityMapped = applyMeasuresSeveritySettings(
    resetFindingDisplayValues(findings),
    assets,
    settings
  );
  return applyMeasuresPrioritySettings(severityMapped, settings).sort(
    (left, right) =>
      left.priorityRank - right.priorityRank ||
      left.severity.localeCompare(right.severity) ||
      left.id.localeCompare(right.id)
  );
}

function applyDiscoverySettings(
  evaluations: StoredDiscoveryCoverageEvaluation[] | undefined,
  assets: Asset[],
  settings: DiscoveryToolsSettings
): StoredDiscoveryCoverageEvaluation[] {
  const assetTypeById = new Map(assets.map((asset) => [asset.id, asset.type]));
  const toolById = new Map(settings.tools.map((tool) => [tool.id, tool]));

  return (evaluations ?? []).map((evaluation) => {
    const assetType = assetTypeById.get(evaluation.assetId);
    const toolValues: StoredDiscoveryCoverageEvaluation["toolValues"] = {};
    const missingToolIds: string[] = [];
    const missingToolNames: string[] = [];

    for (const [toolId, capturedValue] of Object.entries(evaluation.toolValues)) {
      const tool = toolById.get(toolId);
      const isNotApplicable = Boolean(assetType && tool?.assetTypeScope[assetType] === "na");
      const value = isNotApplicable ? null : capturedValue;
      toolValues[toolId] = value;
      if (value === 0) {
        missingToolIds.push(toolId);
        missingToolNames.push(tool?.name ?? toolId);
      }
    }

    return {
      assetId: evaluation.assetId,
      toolValues,
      missingToolIds,
      missingToolNames,
      coverageCompliance: missingToolIds.length === 0
    };
  });
}

async function materializeDataset(
  snapshotId: number,
  options: DatasetLoadOptions = {}
): Promise<Dataset> {
  const profile = normalizeDatasetLoadProfile(options.profile);
  const [measuresSettings, discoveryToolsSettings] = await Promise.all([
    loadMeasuresSettings(),
    loadDiscoveryToolsSettings()
  ]);
  const cacheKey = [
    snapshotId,
    profile,
    measuresSettings.updatedAt,
    discoveryToolsSettings.updatedAt
  ].join("::");
  const existing = materializedDatasetCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const pending = (async () => {
    const raw = await loadRawSnapshot(snapshotId);
    const assets = raw.assets.map((asset) => cloneAssetForProfile(asset, profile));
    const findings = applyFindingSettings(raw.findings ?? [], raw.assets, measuresSettings);
    const discoveryCoverageEvaluations = applyDiscoverySettings(
      raw.discoveryCoverageEvaluations,
      raw.assets,
      discoveryToolsSettings
    );

    return {
      ...raw,
      cacheSignature: [
        raw.cacheSignature ?? `snapshot:${snapshotId}`,
        `profile:${profile}`,
        `measures:${measuresSettings.updatedAt}`,
        `discovery:${discoveryToolsSettings.updatedAt}`
      ].join("|"),
      assets,
      discoveryCoverageEvaluations,
      ciDependencies: profile === "full" ? raw.ciDependencies ?? [] : [],
      findings
    };
  })().catch((error) => {
    materializedDatasetCache.delete(cacheKey);
    throw error;
  });

  materializedDatasetCache.set(cacheKey, pending);
  return pending;
}

export async function loadSnapshotEffectiveFindings(
  snapshotId: number,
  asOfDate?: string | null
): Promise<Finding[]> {
  const normalizedAsOfDate = asOfDate ? normalizeDataDate(asOfDate) : undefined;
  const measuresSettings = await loadMeasuresSettings();
  const cacheKey = `${snapshotId}::${normalizedAsOfDate ?? "current"}::${measuresSettings.updatedAt}`;
  const existing = effectiveFindingsCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const pending = (async () => {
    const raw = await loadRawSnapshot(snapshotId);
    const findings = applyFindingSettings(raw.findings ?? [], raw.assets, measuresSettings);
    if (!normalizedAsOfDate) {
      return findings;
    }

    return findings
      .filter((finding) => finding.timestamp.slice(0, 10) <= normalizedAsOfDate)
      .map((finding) => {
        const status: Finding["status"] =
          finding.closedTimestamp && finding.closedTimestamp.slice(0, 10) <= normalizedAsOfDate
            ? "closed"
            : "open";
        return { ...finding, status };
      });
  })().catch((error) => {
    effectiveFindingsCache.delete(cacheKey);
    throw error;
  });

  effectiveFindingsCache.set(cacheKey, pending);
  return pending;
}

export async function loadCurrentDataset(options: DatasetLoadOptions = {}): Promise<Dataset> {
  const rows = await loadSnapshotRows();
  return materializeDataset(latestSnapshot(rows).snapshotId, options);
}

export async function loadSnapshots(options: DatasetLoadOptions = {}): Promise<Dataset[]> {
  const rows = await loadSnapshotRows();
  return Promise.all(rows.map((row) => materializeDataset(row.snapshotId, options)));
}

export async function loadLatestSnapshots(
  limit = 12,
  options: DatasetLoadOptions = {}
): Promise<Dataset[]> {
  const rows = await loadSnapshotRows();
  return Promise.all(
    rows.slice(-Math.max(0, Math.trunc(limit))).map((row) => materializeDataset(row.snapshotId, options))
  );
}

export async function loadDatasetTimeline(options: DatasetLoadOptions = {}): Promise<Dataset[]> {
  return loadSnapshots(options);
}

export async function loadDatasetForDate(
  requestedDate?: string,
  options: DatasetLoadOptions = {}
): Promise<Dataset> {
  const rows = await loadSnapshotRows();
  return materializeDataset(selectSnapshotRowForDate(rows, requestedDate).snapshotId, options);
}

export async function loadLatestSnapshotsForDate(
  requestedDate: string | undefined,
  limit = 12,
  options: DatasetLoadOptions = {}
): Promise<Dataset[]> {
  const rows = await loadSnapshotRows();
  const target = targetDateKey(requestedDate);
  const selected = rows
    .filter((row) => row.snapshotDate <= target)
    .slice(-Math.max(0, Math.trunc(limit)));
  return Promise.all(selected.map((row) => materializeDataset(row.snapshotId, options)));
}

export async function loadSnapshotsForDateWindow(
  requestedDate: string | undefined,
  monthsBack = 12,
  options: DatasetLoadOptions = {}
): Promise<Dataset[]> {
  const rows = await loadSnapshotRows();
  const endSnapshot = selectSnapshotRowForDate(rows, requestedDate);
  const startDate = subtractCalendarMonthsDateKey(endSnapshot.snapshotDate, monthsBack);
  const selected = rows.filter(
    (row) => row.snapshotDate >= startDate && row.snapshotDate <= endSnapshot.snapshotDate
  );
  return Promise.all(selected.map((row) => materializeDataset(row.snapshotId, options)));
}

export async function loadReferenceVersions(): Promise<ReferenceVersions> {
  const config = await loadRuntimeConfig();
  const value = config.referenceVersions as Partial<ReferenceVersions> | undefined;
  const osCurrentMajor = value?.osCurrentMajor;
  const softwareSupportMatrix = value?.softwareSupportMatrix;
  if (!osCurrentMajor || !softwareSupportMatrix) {
    throw new Error("Demo runtime configuration is missing reference versions.");
  }
  return {
    osCurrentMajor: { ...osCurrentMajor },
    softwareSupportMatrix: Object.fromEntries(
      Object.entries(softwareSupportMatrix).map(([name, versions]) => [name, [...versions]])
    )
  };
}

export async function loadSeverityDefinitions(): Promise<SeverityDefinition[]> {
  return normalizeSeverityDefinitions((await loadRuntimeConfig()).severityDefinitions);
}

export async function loadFindingPriorityDefinitions(): Promise<FindingPriorityDefinition[]> {
  return normalizePriorityDefinitions((await loadRuntimeConfig()).priorityDefinitions);
}

export async function loadFindingDisplayConfiguration(): Promise<FindingDisplayConfiguration> {
  const input = (await loadRuntimeConfig()).findingDisplayConfiguration;
  return normalizeFindingDisplayConfiguration(
    input && typeof input === "object" ? input : {}
  );
}

export async function loadSpiDefinitions(): Promise<SpiDefinition[]> {
  const source = (await loadRuntimeConfig()).spiDefinitions;
  const adapted = Array.isArray(source)
    ? source.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return item;
        }
        const row = item as Record<string, unknown>;
        const conditions = row.taskingConditions;
        return {
          ...row,
          taskingConditions:
            conditions && typeof conditions === "object" && !Array.isArray(conditions)
              ? Object.entries(conditions).map(([conditionKey, templateText]) => ({
                  conditionKey,
                  templateText
                }))
              : conditions
        };
      })
    : source;
  return normalizeSpiDefinitions(adapted);
}

export async function loadKpiDefinitions(): Promise<KpiDefinition[]> {
  const source = (await loadRuntimeConfig()).kpiDefinitions;
  const adapted = Array.isArray(source)
    ? source.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return item;
        }
        const row = item as Record<string, unknown>;
        const conditions = row.taskingConditions;
        return {
          ...row,
          taskingConditions:
            conditions && typeof conditions === "object" && !Array.isArray(conditions)
              ? Object.entries(conditions).map(([conditionKey, templateText]) => ({
                  conditionKey,
                  templateText
                }))
              : conditions
        };
      })
    : source;
  return normalizeKpiDefinitions(adapted);
}

function sortedUnique(values: Iterable<string>): string[] {
  return Array.from(
    new Set(
      Array.from(values)
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => value.trim())
    )
  ).sort((left, right) => left.localeCompare(right));
}

function findingKpiSignature(findings: Finding[]): string {
  return JSON.stringify(
    findings
      .map((finding) => [finding.scope.assetId, finding.severity, finding.priorityRank])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0])))
  );
}

export async function loadSnapshotKpiEvaluationsForScope({
  snapshotId,
  assetIds,
  systemIds,
  networkIds,
  findings,
  kpiDefinitions
}: {
  snapshotId: number;
  assetIds: Iterable<string>;
  systemIds: Iterable<string>;
  networkIds: Iterable<string>;
  findings: Finding[];
  kpiDefinitions?: KpiDefinition[];
}): Promise<StoredKpiEvaluation[]> {
  const [dataset, definitions] = await Promise.all([
    materializeDataset(snapshotId, { profile: "full" }),
    kpiDefinitions ? Promise.resolve(kpiDefinitions) : loadKpiDefinitions()
  ]);
  const normalizedAssetIds = sortedUnique(assetIds);
  const normalizedSystemIds = sortedUnique(systemIds);
  const normalizedNetworkIds = sortedUnique(networkIds);
  const cacheKey = JSON.stringify([
    dataset.cacheSignature,
    normalizedAssetIds,
    normalizedSystemIds,
    normalizedNetworkIds,
    findingKpiSignature(findings),
    kpiDefinitionsCacheSignature(definitions)
  ]);
  const existing = kpiEvaluationCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const pending = Promise.resolve(
    evaluateDemoKpis({
      dataset,
      assetIds: normalizedAssetIds,
      systemIds: normalizedSystemIds,
      networkIds: normalizedNetworkIds,
      findings,
      kpiDefinitions: definitions
    })
  ).catch((error) => {
    kpiEvaluationCache.delete(cacheKey);
    throw error;
  });
  kpiEvaluationCache.set(cacheKey, pending);
  return pending;
}

export type KpiEvaluationScopeInput = {
  scopeKey: string;
  assetIds: Iterable<string>;
  systemIds: Iterable<string>;
  networkIds: Iterable<string>;
  findings: Finding[];
};

export async function loadSnapshotKpiEvaluationsForScopes({
  snapshotId,
  scopes,
  kpiDefinitions
}: {
  snapshotId: number;
  scopes: KpiEvaluationScopeInput[];
  kpiDefinitions?: KpiDefinition[];
}): Promise<Map<string, StoredKpiEvaluation[]>> {
  const [dataset, definitions] = await Promise.all([
    materializeDataset(snapshotId, { profile: "full" }),
    kpiDefinitions ? Promise.resolve(kpiDefinitions) : loadKpiDefinitions()
  ]);
  const normalizedScopes = scopes
    .map((scope) => ({
      scopeKey: scope.scopeKey.trim(),
      assetIds: sortedUnique(scope.assetIds),
      systemIds: sortedUnique(scope.systemIds),
      networkIds: sortedUnique(scope.networkIds),
      findings: scope.findings
    }))
    .filter((scope) => scope.scopeKey && scope.assetIds.length > 0);

  if (!normalizedScopes.length) {
    return new Map();
  }

  const cacheKey = JSON.stringify([
    dataset.cacheSignature,
    normalizedScopes.map((scope) => [
      scope.scopeKey,
      scope.assetIds,
      scope.systemIds,
      scope.networkIds,
      findingKpiSignature(scope.findings)
    ]),
    kpiDefinitionsCacheSignature(definitions)
  ]);
  const existing = scopedKpiEvaluationCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const pending = Promise.resolve(
    evaluateDemoKpiScopes({ dataset, scopes: normalizedScopes, kpiDefinitions: definitions })
  ).catch((error) => {
    scopedKpiEvaluationCache.delete(cacheKey);
    throw error;
  });
  scopedKpiEvaluationCache.set(cacheKey, pending);
  return pending;
}

export async function loadSnapshotKpiEvaluationsForAnalyticsScope({
  dataset,
  analytics,
  systems,
  networks,
  kpiDefinitions
}: {
  dataset: Dataset;
  analytics: { evaluations: Array<{ assetId: string }>; findings: Finding[] };
  systems: ICTSystem[];
  networks: ManagedNetwork[];
  kpiDefinitions?: KpiDefinition[];
}): Promise<StoredKpiEvaluation[]> {
  if (!dataset.snapshotId) {
    throw new Error("Demo KPI evaluation requires a dataset snapshot id.");
  }
  return loadSnapshotKpiEvaluationsForScope({
    snapshotId: dataset.snapshotId,
    assetIds: analytics.evaluations.map((evaluation) => evaluation.assetId),
    systemIds: systems.map((system) => system.id),
    networkIds: networks.map((network) => network.id),
    findings: analytics.findings,
    kpiDefinitions
  });
}

export async function loadMeasuresSettings(
  providedSpiDefinitions?: SpiDefinition[],
  providedSeverityDefinitions?: SeverityDefinition[],
  providedPriorityDefinitions?: FindingPriorityDefinition[]
): Promise<MeasuresSettings> {
  const [config, spiDefinitions, severityDefinitions, priorityDefinitions] = await Promise.all([
    loadRuntimeConfig(),
    providedSpiDefinitions ? Promise.resolve(providedSpiDefinitions) : loadSpiDefinitions(),
    providedSeverityDefinitions ? Promise.resolve(providedSeverityDefinitions) : loadSeverityDefinitions(),
    providedPriorityDefinitions
      ? Promise.resolve(providedPriorityDefinitions)
      : loadFindingPriorityDefinitions()
  ]);
  const source = measuresSettingsOverride ?? config.measuresSettings;
  return source
    ? normalizeMeasuresSettings(source, spiDefinitions, severityDefinitions, priorityDefinitions)
    : defaultMeasuresSettings(spiDefinitions, severityDefinitions, priorityDefinitions);
}

export async function saveMeasuresSettings(input: unknown): Promise<MeasuresSettings> {
  const [spiDefinitions, severityDefinitions, priorityDefinitions] = await Promise.all([
    loadSpiDefinitions(),
    loadSeverityDefinitions(),
    loadFindingPriorityDefinitions()
  ]);
  const normalized = normalizeMeasuresSettings(
    input,
    spiDefinitions,
    severityDefinitions,
    priorityDefinitions
  );
  measuresSettingsOverride = { ...normalized, updatedAt: new Date().toISOString() };
  clearSettingsDependentCaches();
  return measuresSettingsOverride;
}

export async function loadDiscoveryToolsSettings(): Promise<DiscoveryToolsSettings> {
  if (discoveryToolsSettingsOverride) {
    return normalizeDiscoveryToolsSettings(discoveryToolsSettingsOverride);
  }
  const source = (await loadRuntimeConfig()).discoveryToolsSettings;
  return source ? normalizeDiscoveryToolsSettings(source) : defaultDiscoveryToolsSettings();
}

export async function saveDiscoveryToolsSettings(input: unknown): Promise<DiscoveryToolsSettings> {
  const existing = await loadDiscoveryToolsSettings();
  const normalized = normalizeDiscoveryToolsScopeUpdate(input, existing);
  discoveryToolsSettingsOverride = { ...normalized, updatedAt: new Date().toISOString() };
  clearSettingsDependentCaches();
  return discoveryToolsSettingsOverride;
}

function clearSettingsDependentCaches(): void {
  materializedDatasetCache.clear();
  effectiveFindingsCache.clear();
  kpiEvaluationCache.clear();
  scopedKpiEvaluationCache.clear();
  clearAnalyticsCache();
  clearAppDataCaches();
}

export function clearDataLoaderCaches(): void {
  runtimeConfigPromise = null;
  snapshotRowsPromise = null;
  rawSnapshotCache.clear();
  clearSettingsDependentCaches();
}

export function __resetDataLoaderCachesForTest(): void {
  measuresSettingsOverride = null;
  discoveryToolsSettingsOverride = null;
  clearDataLoaderCaches();
}
