import { Finding, FindingWorkflowStatus } from "@/lib/types";

export type FindingBucketType = "severity" | "priority" | "workflow" | "custom";
export type FindingBucketConditionKey =
  | "always"
  | "severity_equals"
  | "severity_not_in"
  | "priority_equals"
  | "priority_between"
  | "workflow_equals";

export interface FindingSourcePolicy {
  policyKey: string;
  displayOrder: number;
  name: string;
  description: string;
  usePersistedFindings: boolean;
  generateWhenEmpty: boolean;
  enabled: boolean;
}

export interface FindingGenerationPolicy {
  policyKey: string;
  historyStartDate: string;
  historyWindowYears: number;
  baselineBacklogCount: number;
  minOpenCount: number;
  maxOpenCount: number;
  addProbabilityPercent: number;
  addRateMinPercent: number;
  addRateMaxPercent: number;
  closeRateMinPercent: number;
  closeRateMaxPercent: number;
  closeBackfillMinCount: number;
  closeBackfillMaxCount: number;
  timezoneOffsetMinutes: number;
}

export interface FindingWorkflowStatusDefinition {
  statusKey: FindingWorkflowStatus;
  label: string;
  displayOrder: number;
  toneKey: string;
  terminalStatus: boolean;
}

export interface FindingBucketDefinition {
  bucketKey: string;
  bucketType: FindingBucketType;
  label: string;
  displayOrder: number;
  toneKey: string;
  conditionKey: FindingBucketConditionKey;
  severityKey: string | null;
  priorityMin: number | null;
  priorityMax: number | null;
  workflowStatus: FindingWorkflowStatus | null;
  enabled: boolean;
  description: string;
}

export interface FindingEvidenceFieldDefinition {
  fieldKey: string;
  displayOrder: number;
  label: string;
  purposeKey: string;
  candidateKeys: string[];
  fallbackValue: string | null;
  enabled: boolean;
}

export interface FindingRegisterColumnDefinition {
  columnKey: string;
  label: string;
  displayOrder: number;
  valueKey: string;
  enabled: boolean;
}

export interface FindingDisplayConfiguration {
  sourcePolicies: FindingSourcePolicy[];
  generationPolicies: FindingGenerationPolicy[];
  workflowStatuses: FindingWorkflowStatusDefinition[];
  buckets: FindingBucketDefinition[];
  evidenceFields: FindingEvidenceFieldDefinition[];
  registerColumns: FindingRegisterColumnDefinition[];
}

function toBoolean(value: boolean | number | null | undefined): boolean {
  return value === true || value === 1;
}

function nonEmptyText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function positiveInteger(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : null;
}

function workflowStatus(value: unknown): FindingWorkflowStatus | null {
  return value === "open" || value === "closed" ? value : null;
}

function bucketType(value: unknown): FindingBucketType | null {
  return value === "severity" || value === "priority" || value === "workflow" || value === "custom" ? value : null;
}

function conditionKey(value: unknown): FindingBucketConditionKey | null {
  return value === "always" ||
    value === "severity_equals" ||
    value === "severity_not_in" ||
    value === "priority_equals" ||
    value === "priority_between" ||
    value === "workflow_equals"
    ? value
    : null;
}

function parseCandidateKeys(value: unknown): string[] {
  const parsed = typeof value === "string" ? safeJsonParse(value) : value;
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => nonEmptyText(item))
    .filter((item): item is string => Boolean(item))
    .filter((item, index, values) => values.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function normalizeFindingDisplayConfiguration(input: {
  sourcePolicies?: unknown[];
  generationPolicies?: unknown[];
  workflowStatuses?: unknown[];
  buckets?: unknown[];
  evidenceFields?: unknown[];
  registerColumns?: unknown[];
}): FindingDisplayConfiguration {
  const sourcePolicies = (Array.isArray(input.sourcePolicies) ? input.sourcePolicies : [])
    .map((item) => {
      const row = item as Partial<FindingSourcePolicy>;
      const policyKey = nonEmptyText(row.policyKey);
      const displayOrder = positiveInteger(row.displayOrder);
      const name = nonEmptyText(row.name);
      const description = nonEmptyText(row.description);
      if (!policyKey || !displayOrder || !name || !description) {
        return null;
      }
      return {
        policyKey,
        displayOrder,
        name,
        description,
        usePersistedFindings: toBoolean(row.usePersistedFindings),
        generateWhenEmpty: toBoolean(row.generateWhenEmpty),
        enabled: toBoolean(row.enabled)
      } satisfies FindingSourcePolicy;
    })
    .filter((item): item is FindingSourcePolicy => Boolean(item))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.policyKey.localeCompare(right.policyKey));

  const generationPolicies = (Array.isArray(input.generationPolicies) ? input.generationPolicies : [])
    .map((item) => {
      const row = item as Partial<FindingGenerationPolicy>;
      const policyKey = nonEmptyText(row.policyKey);
      const historyStartDate = nonEmptyText(row.historyStartDate);
      const historyWindowYears = positiveInteger(row.historyWindowYears);
      const baselineBacklogCount = nonNegativeInteger(row.baselineBacklogCount);
      const minOpenCount = nonNegativeInteger(row.minOpenCount);
      const maxOpenCount = nonNegativeInteger(row.maxOpenCount);
      if (
        !policyKey ||
        !historyStartDate ||
        !historyWindowYears ||
        baselineBacklogCount === null ||
        minOpenCount === null ||
        maxOpenCount === null
      ) {
        return null;
      }
      return {
        policyKey,
        historyStartDate,
        historyWindowYears,
        baselineBacklogCount,
        minOpenCount,
        maxOpenCount,
        addProbabilityPercent: Number(row.addProbabilityPercent ?? 0),
        addRateMinPercent: Number(row.addRateMinPercent ?? 0),
        addRateMaxPercent: Number(row.addRateMaxPercent ?? 0),
        closeRateMinPercent: Number(row.closeRateMinPercent ?? 0),
        closeRateMaxPercent: Number(row.closeRateMaxPercent ?? 0),
        closeBackfillMinCount: Number(row.closeBackfillMinCount ?? 0),
        closeBackfillMaxCount: Number(row.closeBackfillMaxCount ?? 0),
        timezoneOffsetMinutes: Number(row.timezoneOffsetMinutes ?? 0)
      } satisfies FindingGenerationPolicy;
    })
    .filter((item): item is FindingGenerationPolicy => Boolean(item));

  const workflowStatuses = (Array.isArray(input.workflowStatuses) ? input.workflowStatuses : [])
    .map((item) => {
      const row = item as Partial<FindingWorkflowStatusDefinition>;
      const statusKey = workflowStatus(row.statusKey);
      const label = nonEmptyText(row.label);
      const displayOrder = positiveInteger(row.displayOrder);
      const toneKey = nonEmptyText(row.toneKey);
      if (!statusKey || !label || !displayOrder || !toneKey) {
        return null;
      }
      return {
        statusKey,
        label,
        displayOrder,
        toneKey,
        terminalStatus: toBoolean(row.terminalStatus)
      } satisfies FindingWorkflowStatusDefinition;
    })
    .filter((item): item is FindingWorkflowStatusDefinition => Boolean(item))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.statusKey.localeCompare(right.statusKey));

  const buckets = (Array.isArray(input.buckets) ? input.buckets : [])
    .map((item) => {
      const row = item as Partial<FindingBucketDefinition>;
      const rowBucketType = bucketType(row.bucketType);
      const rowConditionKey = conditionKey(row.conditionKey);
      const bucketKey = nonEmptyText(row.bucketKey);
      const label = nonEmptyText(row.label);
      const displayOrder = positiveInteger(row.displayOrder);
      const toneKey = nonEmptyText(row.toneKey);
      const description = nonEmptyText(row.description);
      if (!bucketKey || !rowBucketType || !label || !displayOrder || !toneKey || !rowConditionKey || !description) {
        return null;
      }
      return {
        bucketKey,
        bucketType: rowBucketType,
        label,
        displayOrder,
        toneKey,
        conditionKey: rowConditionKey,
        severityKey: nonEmptyText(row.severityKey) ?? null,
        priorityMin: row.priorityMin == null ? null : Number(row.priorityMin),
        priorityMax: row.priorityMax == null ? null : Number(row.priorityMax),
        workflowStatus: row.workflowStatus == null ? null : workflowStatus(row.workflowStatus),
        enabled: toBoolean(row.enabled),
        description
      } satisfies FindingBucketDefinition;
    })
    .filter((item): item is FindingBucketDefinition => Boolean(item))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.bucketKey.localeCompare(right.bucketKey));

  const evidenceFields = (Array.isArray(input.evidenceFields) ? input.evidenceFields : [])
    .map((item) => {
      const row = item as Partial<FindingEvidenceFieldDefinition> & { candidateKeysJson?: unknown };
      const fieldKey = nonEmptyText(row.fieldKey);
      const displayOrder = positiveInteger(row.displayOrder);
      const label = nonEmptyText(row.label);
      const purposeKey = nonEmptyText(row.purposeKey);
      if (!fieldKey || !displayOrder || !label || !purposeKey) {
        return null;
      }
      return {
        fieldKey,
        displayOrder,
        label,
        purposeKey,
        candidateKeys: parseCandidateKeys(row.candidateKeys ?? row.candidateKeysJson),
        fallbackValue: nonEmptyText(row.fallbackValue) ?? null,
        enabled: toBoolean(row.enabled)
      } satisfies FindingEvidenceFieldDefinition;
    })
    .filter((item): item is FindingEvidenceFieldDefinition => Boolean(item))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.fieldKey.localeCompare(right.fieldKey));

  const registerColumns = (Array.isArray(input.registerColumns) ? input.registerColumns : [])
    .map((item) => {
      const row = item as Partial<FindingRegisterColumnDefinition>;
      const columnKey = nonEmptyText(row.columnKey);
      const label = nonEmptyText(row.label);
      const displayOrder = positiveInteger(row.displayOrder);
      const valueKey = nonEmptyText(row.valueKey);
      if (!columnKey || !label || !displayOrder || !valueKey) {
        return null;
      }
      return {
        columnKey,
        label,
        displayOrder,
        valueKey,
        enabled: toBoolean(row.enabled)
      } satisfies FindingRegisterColumnDefinition;
    })
    .filter((item): item is FindingRegisterColumnDefinition => Boolean(item))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.columnKey.localeCompare(right.columnKey));

  return {
    sourcePolicies,
    generationPolicies,
    workflowStatuses,
    buckets,
    evidenceFields,
    registerColumns
  };
}

export function findingDisplayConfigurationCacheSignature(configuration: FindingDisplayConfiguration): string {
  return JSON.stringify(configuration);
}

export function findingBucketsOfType(
  configuration: FindingDisplayConfiguration,
  bucketType: FindingBucketType
): FindingBucketDefinition[] {
  return configuration.buckets.filter((bucket) => bucket.enabled && bucket.bucketType === bucketType);
}

export function findingBucketByKey(
  configuration: FindingDisplayConfiguration,
  bucketKey: string
): FindingBucketDefinition | undefined {
  return configuration.buckets.find((bucket) => bucket.enabled && bucket.bucketKey === bucketKey);
}

export function findingMatchesBucket(
  finding: Finding,
  bucket: FindingBucketDefinition,
  statusOverride?: FindingWorkflowStatus
): boolean {
  switch (bucket.conditionKey) {
    case "always":
      return true;
    case "severity_equals":
      return Boolean(bucket.severityKey) && finding.severity === bucket.severityKey;
    case "severity_not_in": {
      const excluded = new Set((bucket.severityKey ?? "").split("|").map((item) => item.trim()).filter(Boolean));
      return !excluded.has(finding.severity);
    }
    case "priority_equals":
      return bucket.priorityMin !== null && finding.priorityRank === bucket.priorityMin;
    case "priority_between":
      return (
        bucket.priorityMin !== null &&
        bucket.priorityMax !== null &&
        finding.priorityRank >= bucket.priorityMin &&
        finding.priorityRank <= bucket.priorityMax
      );
    case "workflow_equals":
      return Boolean(bucket.workflowStatus) && (statusOverride ?? finding.status) === bucket.workflowStatus;
  }
}

export function readEvidenceStringValue(
  evidence: Record<string, string | number | boolean | null>,
  candidateKeys: string[]
): string | null {
  const entries = Object.entries(evidence).map(([key, value]) => [key.toLowerCase(), value] as const);
  for (const candidateKey of candidateKeys) {
    const matched = entries.find(([key]) => key === candidateKey.toLowerCase());
    if (!matched) {
      continue;
    }
    const value = matched[1];
    if (value === null) {
      continue;
    }
    const text = String(value).trim();
    if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") {
      continue;
    }
    return text;
  }
  return null;
}

export function findingEvidenceFieldByPurpose(
  configuration: FindingDisplayConfiguration,
  purposeKey: string
): FindingEvidenceFieldDefinition | undefined {
  return configuration.evidenceFields.find((field) => field.enabled && field.purposeKey === purposeKey);
}

export function readConfiguredEvidenceValue(
  evidence: Record<string, string | number | boolean | null>,
  configuration: FindingDisplayConfiguration,
  purposeKey: string,
  fallbackValue?: string | null
): string | null {
  const field = findingEvidenceFieldByPurpose(configuration, purposeKey);
  const configuredValue = field ? readEvidenceStringValue(evidence, field.candidateKeys) : null;
  return configuredValue ?? fallbackValue ?? field?.fallbackValue ?? null;
}

export function buildConfiguredEvidencePreview(
  finding: Finding,
  configuration: FindingDisplayConfiguration
): string {
  const previewField = findingEvidenceFieldByPurpose(configuration, "evidence_preview");
  const configuredValue = previewField?.candidateKeys.length
    ? readEvidenceStringValue(finding.evidence, previewField.candidateKeys)
    : null;
  if (configuredValue) {
    return configuredValue;
  }

  const preview = Object.entries(finding.evidence)
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${value === null ? "null" : String(value)}`)
    .join(" | ");
  return preview || previewField?.fallbackValue || "No evidence captured";
}

export function toneBadgeClass(toneKey: string): string {
  switch (toneKey) {
    case "critical":
      return "border-red-400/35 bg-red-500/10 text-red-100";
    case "warning":
      return "border-orange-400/35 bg-orange-500/10 text-orange-100";
    case "major":
      return "border-amber-300/35 bg-amber-500/10 text-amber-100";
    case "success":
      return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
    case "neutral":
      return "border-slate-400/25 bg-slate-500/10 text-slate-100";
    default:
      return "border-sky-300/25 bg-sky-500/10 text-sky-100";
  }
}

export function toneTextClass(toneKey: string): string {
  switch (toneKey) {
    case "critical":
      return "text-red-100";
    case "warning":
      return "text-orange-100";
    case "major":
      return "text-amber-100";
    case "success":
      return "text-emerald-100";
    case "neutral":
      return "text-slate-100";
    default:
      return "text-sky-100";
  }
}
