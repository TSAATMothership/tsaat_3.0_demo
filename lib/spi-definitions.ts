import { ASSET_TYPES } from "@/lib/asset-taxonomy";
import { AssetType, ComplianceStatus, FindingSeverity, SpiId } from "@/lib/types";

export const SUPPORTED_SPI_RULE_HANDLER_KEYS = [
  "os-support",
  "os-n-minus",
  "server-critical-vulnerability",
  "production-server-critical-unsupported-os",
  "production-server-critical-unsupported-software",
  "production-workstation-critical-unsupported-software",
  "network-device-critical-vulnerability",
  "network-device-support",
  "network-device-patch-currency",
  "asset-lifecycle-currency"
] as const;

export const SUPPORTED_SPI_REPORT_DETAIL_HANDLER_KEYS = ["standard-asset-annex"] as const;
export const SPI_RULE_PARAMETER_TYPES = ["string", "number", "boolean"] as const;
export const SPI_TASKING_ACTION_CONDITION_KEYS = ["always", "when_unknown", "when_fully_compliant"] as const;
export const SPI_TASKING_CONDITION_KEYS = ["non_compliant", "unknown", "compliant"] as const;
export const SPI_FINDING_CLASSIFICATION_CONDITION_KEYS = [
  "always",
  "when_unknown",
  "when_non_compliant",
  "when_production_critical_asset",
  "when_not_production_critical_asset"
] as const;

const COMPLIANCE_STATUSES = ["Compliant", "Non-compliant", "Unknown"] as const;

export type SpiRuleKey = string;
export type SpiReportDetailKey = string;
export type SpiRuleParameterType = (typeof SPI_RULE_PARAMETER_TYPES)[number];
export type SpiTaskingActionConditionKey = (typeof SPI_TASKING_ACTION_CONDITION_KEYS)[number];
export type SpiTaskingConditionKey = (typeof SPI_TASKING_CONDITION_KEYS)[number];
export type SpiFindingClassificationConditionKey = (typeof SPI_FINDING_CLASSIFICATION_CONDITION_KEYS)[number];

export type SpiRuleParameterValue = string | number | boolean;
export type SpiRuleParameters = Record<string, SpiRuleParameterValue>;

export interface SpiRuleDefinition {
  ruleKey: SpiRuleKey;
  handlerKey: string;
  displayOrder: number;
  name: string;
  description: string;
  enabled: boolean;
}

export interface SpiRuleParameterDefinition {
  ruleKey: SpiRuleKey;
  parameterKey: string;
  parameterType: SpiRuleParameterType;
  required: boolean;
  defaultValue: string | null;
  allowedValues: string[];
  displayOrder: number;
  description: string;
}

export interface SpiRuleOutcomeTemplate {
  ruleKey: SpiRuleKey;
  outcomeKey: string;
  complianceStatus: ComplianceStatus;
  reasonTemplate: string;
  evidenceTemplate: string | null;
}

export interface SpiReportDetailDefinition {
  reportDetailKey: SpiReportDetailKey;
  handlerKey: string;
  displayOrder: number;
  name: string;
  description: string;
  enabled: boolean;
}

export interface SpiFindingClassificationRule {
  classificationRuleId: string;
  displayOrder: number;
  enabled: boolean;
  spiId: SpiId | null;
  complianceStatus: ComplianceStatus | null;
  conditionKey: SpiFindingClassificationConditionKey;
  severityKey: FindingSeverity | null;
  priorityRank: number | null;
  description: string;
}

export interface SpiTaskingTeam {
  displayOrder: number;
  team: string;
  supportQueue: string;
  contactEmail: string;
}

export interface SpiTaskingActionTemplate {
  displayOrder: number;
  conditionKey: SpiTaskingActionConditionKey;
  actionText: string;
}

export interface SpiTaskingConditionTemplate {
  conditionKey: SpiTaskingConditionKey;
  templateText: string;
}

export interface SpiDefinition {
  spiId: SpiId;
  displayOrder: number;
  name: string;
  description: string;
  successMeasure: string;
  priorityOrder: number;
  defaultSeverity: FindingSeverity;
  recommendedAction: string;
  enabled: boolean;
  ruleKey: SpiRuleKey;
  ruleParameters: SpiRuleParameters;
  ruleDefinition: SpiRuleDefinition;
  parameterDefinitions: SpiRuleParameterDefinition[];
  outcomeTemplates: SpiRuleOutcomeTemplate[];
  classificationRules: SpiFindingClassificationRule[];
  reportAvailable: boolean;
  trendReportAvailable: boolean;
  reportDetailKey: SpiReportDetailKey;
  reportDetailDefinition: SpiReportDetailDefinition;
  applicableAssetTypes: AssetType[];
  taskingTeams: SpiTaskingTeam[];
  taskingActions: SpiTaskingActionTemplate[];
  taskingConditions: Record<SpiTaskingConditionKey, string>;
}

export interface SeverityDefinition {
  severityKey: FindingSeverity;
  label: string;
  displayOrder: number;
  selectableInSettings: boolean;
  toneKey: string;
}

const ASSET_TYPE_VALUES: AssetType[] = [...ASSET_TYPES];

export function isSupportedSpiRuleHandlerKey(value: unknown): boolean {
  return typeof value === "string" && SUPPORTED_SPI_RULE_HANDLER_KEYS.includes(value as never);
}

export function isSupportedSpiReportDetailHandlerKey(value: unknown): boolean {
  return typeof value === "string" && SUPPORTED_SPI_REPORT_DETAIL_HANDLER_KEYS.includes(value as never);
}

function isRuleParameterType(value: unknown): value is SpiRuleParameterType {
  return typeof value === "string" && SPI_RULE_PARAMETER_TYPES.includes(value as SpiRuleParameterType);
}

function isTaskingActionConditionKey(value: unknown): value is SpiTaskingActionConditionKey {
  return (
    typeof value === "string" &&
    SPI_TASKING_ACTION_CONDITION_KEYS.includes(value as SpiTaskingActionConditionKey)
  );
}

function isTaskingConditionKey(value: unknown): value is SpiTaskingConditionKey {
  return typeof value === "string" && SPI_TASKING_CONDITION_KEYS.includes(value as SpiTaskingConditionKey);
}

function isClassificationConditionKey(value: unknown): value is SpiFindingClassificationConditionKey {
  return (
    typeof value === "string" &&
    SPI_FINDING_CLASSIFICATION_CONDITION_KEYS.includes(value as SpiFindingClassificationConditionKey)
  );
}

function isComplianceStatus(value: unknown): value is ComplianceStatus {
  return typeof value === "string" && COMPLIANCE_STATUSES.includes(value as ComplianceStatus);
}

function isAssetType(value: unknown): value is AssetType {
  return typeof value === "string" && ASSET_TYPE_VALUES.includes(value as AssetType);
}

function nonEmptyText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function coerceBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function coerceJsonObject(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function coerceJsonArray(value: unknown): unknown[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeRuleDefinition(value: unknown): SpiRuleDefinition | null {
  const row = coerceJsonObject(value);
  const ruleKey = nonEmptyText(row.ruleKey);
  const handlerKey = nonEmptyText(row.handlerKey);
  const displayOrder = Number(row.displayOrder);
  const name = nonEmptyText(row.name);
  const description = nonEmptyText(row.description);
  if (
    !ruleKey ||
    !handlerKey ||
    !Number.isInteger(displayOrder) ||
    displayOrder < 1 ||
    !name ||
    !description
  ) {
    return null;
  }
  return {
    ruleKey,
    handlerKey,
    displayOrder,
    name,
    description,
    enabled: coerceBoolean(row.enabled, true)
  };
}

function normalizeParameterDefinitions(value: unknown, ruleKey: string): SpiRuleParameterDefinition[] {
  const seen = new Set<string>();
  return coerceJsonArray(value)
    .map((rawRow) => {
      const row = coerceJsonObject(rawRow);
      const parameterRuleKey = nonEmptyText(row.ruleKey) ?? ruleKey;
      const parameterKey = nonEmptyText(row.parameterKey);
      const parameterType = row.parameterType;
      const displayOrder = Number(row.displayOrder);
      const description = nonEmptyText(row.description) ?? "";
      if (
        parameterRuleKey !== ruleKey ||
        !parameterKey ||
        !isRuleParameterType(parameterType) ||
        !Number.isInteger(displayOrder) ||
        displayOrder < 1 ||
        seen.has(parameterKey)
      ) {
        return null;
      }
      seen.add(parameterKey);
      const rawDefault = row.defaultValue ?? null;
      return {
        ruleKey,
        parameterKey,
        parameterType,
        required: coerceBoolean(row.required, false),
        defaultValue: rawDefault === null || rawDefault === undefined ? null : String(rawDefault),
        allowedValues: coerceJsonArray(row.allowedValues ?? row.allowedValuesJson)
          .map((item) => String(item).trim())
          .filter(Boolean),
        displayOrder,
        description
      };
    })
    .filter((row): row is SpiRuleParameterDefinition => Boolean(row))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.parameterKey.localeCompare(right.parameterKey));
}

function coerceParameterValue(value: unknown, type: SpiRuleParameterType): SpiRuleParameterValue | null {
  if (type === "string") {
    return nonEmptyText(value);
  }
  if (type === "number") {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes"].includes(normalized)) {
        return true;
      }
      if (["0", "false", "no"].includes(normalized)) {
        return false;
      }
    }
  }
  return null;
}

function normalizeRuleParameters(
  value: unknown,
  parameterDefinitions: SpiRuleParameterDefinition[]
): { parameters: SpiRuleParameters; valid: boolean } {
  const input = coerceJsonObject(value);
  const parameters: SpiRuleParameters = {};

  for (const definition of parameterDefinitions) {
    const rawValue = input[definition.parameterKey] ?? definition.defaultValue;
    const normalizedValue = coerceParameterValue(rawValue, definition.parameterType);
    if (normalizedValue === null) {
      if (definition.required) {
        return { parameters: {}, valid: false };
      }
      continue;
    }
    if (
      definition.allowedValues.length > 0 &&
      !definition.allowedValues.includes(String(normalizedValue))
    ) {
      if (definition.required) {
        return { parameters: {}, valid: false };
      }
      continue;
    }
    parameters[definition.parameterKey] = normalizedValue;
  }

  return { parameters, valid: true };
}

function normalizeOutcomeTemplates(value: unknown, ruleKey: string): SpiRuleOutcomeTemplate[] {
  return coerceJsonArray(value)
    .map((rawRow) => {
      const row = coerceJsonObject(rawRow);
      const templateRuleKey = nonEmptyText(row.ruleKey) ?? ruleKey;
      const outcomeKey = nonEmptyText(row.outcomeKey);
      const complianceStatus = row.complianceStatus;
      const reasonTemplate = nonEmptyText(row.reasonTemplate);
      if (templateRuleKey !== ruleKey || !outcomeKey || !isComplianceStatus(complianceStatus) || !reasonTemplate) {
        return null;
      }
      return {
        ruleKey,
        outcomeKey,
        complianceStatus,
        reasonTemplate,
        evidenceTemplate: nonEmptyText(row.evidenceTemplate)
      };
    })
    .filter((row): row is SpiRuleOutcomeTemplate => Boolean(row))
    .sort((left, right) => {
      const outcomeCompare = left.outcomeKey.localeCompare(right.outcomeKey);
      return outcomeCompare !== 0 ? outcomeCompare : left.complianceStatus.localeCompare(right.complianceStatus);
    });
}

function normalizeReportDetailDefinition(value: unknown): SpiReportDetailDefinition | null {
  const row = coerceJsonObject(value);
  const reportDetailKey = nonEmptyText(row.reportDetailKey);
  const handlerKey = nonEmptyText(row.handlerKey);
  const displayOrder = Number(row.displayOrder);
  const name = nonEmptyText(row.name);
  const description = nonEmptyText(row.description);
  if (
    !reportDetailKey ||
    !handlerKey ||
    !Number.isInteger(displayOrder) ||
    displayOrder < 1 ||
    !name ||
    !description
  ) {
    return null;
  }
  return {
    reportDetailKey,
    handlerKey,
    displayOrder,
    name,
    description,
    enabled: coerceBoolean(row.enabled, true)
  };
}

function normalizeClassificationRules(value: unknown): SpiFindingClassificationRule[] {
  const seen = new Set<string>();
  return coerceJsonArray(value)
    .map((rawRow) => {
      const row = coerceJsonObject(rawRow);
      const classificationRuleId = nonEmptyText(row.classificationRuleId);
      const displayOrder = Number(row.displayOrder);
      const rawSpiId = row.spiId;
      const spiId = rawSpiId === null || rawSpiId === undefined ? null : Number(rawSpiId);
      const rawComplianceStatus = row.complianceStatus;
      const complianceStatus =
        rawComplianceStatus === null || rawComplianceStatus === undefined || rawComplianceStatus === ""
          ? null
          : rawComplianceStatus;
      const conditionKey = row.conditionKey;
      const severityKey = nonEmptyText(row.severityKey);
      const rawPriorityRank = row.priorityRank;
      const priorityRank = rawPriorityRank === null || rawPriorityRank === undefined ? null : Number(rawPriorityRank);
      const description = nonEmptyText(row.description);

      if (
        !classificationRuleId ||
        !Number.isInteger(displayOrder) ||
        displayOrder < 1 ||
        (spiId !== null && (!Number.isInteger(spiId) || spiId < 1)) ||
        (complianceStatus !== null && !isComplianceStatus(complianceStatus)) ||
        !isClassificationConditionKey(conditionKey) ||
        (priorityRank !== null && (!Number.isInteger(priorityRank) || priorityRank < 1)) ||
        !description ||
        seen.has(classificationRuleId)
      ) {
        return null;
      }
      seen.add(classificationRuleId);
      return {
        classificationRuleId,
        displayOrder,
        enabled: coerceBoolean(row.enabled, true),
        spiId,
        complianceStatus,
        conditionKey,
        severityKey,
        priorityRank,
        description
      };
    })
    .filter((row): row is SpiFindingClassificationRule => Boolean(row))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.classificationRuleId.localeCompare(right.classificationRuleId));
}

function normalizeTaskingTeams(value: unknown): SpiTaskingTeam[] {
  const seen = new Set<string>();
  return coerceJsonArray(value)
    .map((rawRow) => {
      const row = coerceJsonObject(rawRow);
      const team = nonEmptyText(row.team);
      const supportQueue = nonEmptyText(row.supportQueue);
      const contactEmail = nonEmptyText(row.contactEmail);
      const displayOrder = Number(row.displayOrder);
      if (!team || !supportQueue || !contactEmail || !Number.isInteger(displayOrder) || displayOrder < 1) {
        return null;
      }
      const key = team.toLowerCase();
      if (seen.has(key)) {
        return null;
      }
      seen.add(key);
      return { displayOrder, team, supportQueue, contactEmail };
    })
    .filter((row): row is SpiTaskingTeam => Boolean(row))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.team.localeCompare(right.team));
}

function normalizeTaskingActions(value: unknown): SpiTaskingActionTemplate[] {
  return coerceJsonArray(value)
    .map((rawRow) => {
      const row = coerceJsonObject(rawRow);
      const displayOrder = Number(row.displayOrder);
      const conditionKey = row.conditionKey;
      const actionText = nonEmptyText(row.actionText);
      if (
        !Number.isInteger(displayOrder) ||
        displayOrder < 1 ||
        !isTaskingActionConditionKey(conditionKey) ||
        !actionText
      ) {
        return null;
      }
      return { displayOrder, conditionKey, actionText };
    })
    .filter((row): row is SpiTaskingActionTemplate => Boolean(row))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.actionText.localeCompare(right.actionText));
}

function normalizeTaskingConditions(value: unknown): Record<SpiTaskingConditionKey, string> {
  const defaults: Record<SpiTaskingConditionKey, string> = {
    non_compliant:
      "Detected {nonCompliant} non-compliant evaluation(s) for SPI-{spiId}. Current measured compliance is {scorePercent}% across {total} applicable evaluation(s).",
    unknown:
      "SPI-{spiId} has no non-compliant evaluations in scope, but {unknown} unknown evaluation(s) require data-quality remediation.",
    compliant: "SPI-{spiId} is fully compliant in current scope ({scorePercent}% across {total} evaluations)."
  };

  for (const rawRow of coerceJsonArray(value)) {
    const row = coerceJsonObject(rawRow);
    const conditionKey = row.conditionKey;
    const templateText = nonEmptyText(row.templateText);
    if (isTaskingConditionKey(conditionKey) && templateText) {
      defaults[conditionKey] = templateText;
    }
  }

  return defaults;
}

export function normalizeSpiDefinitions(input: unknown): SpiDefinition[] {
  const rows = (() => {
    if (Array.isArray(input)) {
      return input;
    }
    if (input && typeof input === "object" && Array.isArray((input as { spis?: unknown }).spis)) {
      return (input as { spis: unknown[] }).spis;
    }
    return [];
  })();

  const definitions: SpiDefinition[] = [];
  const seenIds = new Set<number>();
  const seenDisplayOrders = new Set<number>();

  for (const rawRow of rows) {
    const row = coerceJsonObject(rawRow);
    const spiId = Number(row.spiId);
    const displayOrder = Number(row.displayOrder ?? row.spiId);
    const name = nonEmptyText(row.name);
    const description = nonEmptyText(row.description);
    const successMeasure = nonEmptyText(row.successMeasure);
    const priorityOrder = Number(row.priorityOrder);
    const defaultSeverity = nonEmptyText(row.defaultSeverity);
    const recommendedAction = nonEmptyText(row.recommendedAction);
    const ruleKey = nonEmptyText(row.ruleKey);
    const reportDetailKey = nonEmptyText(row.reportDetailKey);
    const ruleDefinition = normalizeRuleDefinition(row.ruleDefinition);
    const reportDetailDefinition = normalizeReportDetailDefinition(row.reportDetailDefinition);
    const applicableAssetTypes = coerceJsonArray(row.applicableAssetTypes).filter(isAssetType);

    if (
      !Number.isInteger(spiId) ||
      spiId < 1 ||
      !Number.isInteger(displayOrder) ||
      displayOrder < 1 ||
      !name ||
      !description ||
      !successMeasure ||
      !Number.isInteger(priorityOrder) ||
      priorityOrder < 1 ||
      !defaultSeverity ||
      !recommendedAction ||
      !ruleKey ||
      !reportDetailKey ||
      !ruleDefinition ||
      !ruleDefinition.enabled ||
      ruleDefinition.ruleKey !== ruleKey ||
      !isSupportedSpiRuleHandlerKey(ruleDefinition.handlerKey) ||
      !reportDetailDefinition ||
      !reportDetailDefinition.enabled ||
      reportDetailDefinition.reportDetailKey !== reportDetailKey ||
      !isSupportedSpiReportDetailHandlerKey(reportDetailDefinition.handlerKey) ||
      !applicableAssetTypes.length ||
      seenIds.has(spiId) ||
      seenDisplayOrders.has(displayOrder) ||
      !coerceBoolean(row.enabled, true)
    ) {
      continue;
    }

    const parameterDefinitions = normalizeParameterDefinitions(row.parameterDefinitions, ruleKey);
    const normalizedParameters = normalizeRuleParameters(row.ruleParameters, parameterDefinitions);
    const outcomeTemplates = normalizeOutcomeTemplates(row.outcomeTemplates, ruleKey);
    if (!normalizedParameters.valid || !outcomeTemplates.length) {
      continue;
    }

    seenIds.add(spiId);
    seenDisplayOrders.add(displayOrder);
    definitions.push({
      spiId,
      displayOrder,
      name,
      description,
      successMeasure,
      priorityOrder,
      defaultSeverity,
      recommendedAction,
      enabled: true,
      ruleKey,
      ruleParameters: normalizedParameters.parameters,
      ruleDefinition,
      parameterDefinitions,
      outcomeTemplates,
      classificationRules: normalizeClassificationRules(row.classificationRules).filter(
        (rule) => rule.spiId === null || rule.spiId === spiId
      ),
      reportAvailable: coerceBoolean(row.reportAvailable, true),
      trendReportAvailable: coerceBoolean(row.trendReportAvailable, true),
      reportDetailKey,
      reportDetailDefinition,
      applicableAssetTypes,
      taskingTeams: normalizeTaskingTeams(row.taskingTeams),
      taskingActions: normalizeTaskingActions(row.taskingActions),
      taskingConditions: normalizeTaskingConditions(row.taskingConditions)
    });
  }

  return definitions.sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }
    return left.spiId - right.spiId;
  });
}

export function normalizeSeverityDefinitions(input: unknown): SeverityDefinition[] {
  const rows = (() => {
    if (Array.isArray(input)) {
      return input;
    }
    if (input && typeof input === "object" && Array.isArray((input as { severities?: unknown }).severities)) {
      return (input as { severities: unknown[] }).severities;
    }
    return [];
  })();

  const definitions: SeverityDefinition[] = [];
  const seenKeys = new Set<string>();
  const seenDisplayOrders = new Set<number>();

  for (const rawRow of rows) {
    const row = coerceJsonObject(rawRow);
    const severityKey = nonEmptyText(row.severityKey ?? row.key);
    const label = nonEmptyText(row.label ?? severityKey);
    const displayOrder = Number(row.displayOrder);
    const toneKey = nonEmptyText(row.toneKey) ?? "neutral";
    if (
      !severityKey ||
      !label ||
      !Number.isInteger(displayOrder) ||
      displayOrder < 1 ||
      seenKeys.has(severityKey) ||
      seenDisplayOrders.has(displayOrder)
    ) {
      continue;
    }
    seenKeys.add(severityKey);
    seenDisplayOrders.add(displayOrder);
    definitions.push({
      severityKey,
      label,
      displayOrder,
      selectableInSettings: coerceBoolean(row.selectableInSettings, true),
      toneKey
    });
  }

  return definitions.sort((left, right) => left.displayOrder - right.displayOrder || left.label.localeCompare(right.label));
}

export function spiDefinitionsCacheSignature(spiDefinitions: SpiDefinition[]): string {
  return JSON.stringify(
    spiDefinitions.map((definition) => [
      definition.spiId,
      definition.displayOrder,
      definition.name,
      definition.description,
      definition.successMeasure,
      definition.priorityOrder,
      definition.defaultSeverity,
      definition.ruleKey,
      definition.ruleParameters,
      definition.ruleDefinition,
      definition.parameterDefinitions,
      definition.outcomeTemplates,
      definition.classificationRules,
      definition.reportAvailable,
      definition.trendReportAvailable,
      definition.reportDetailKey,
      definition.reportDetailDefinition,
      definition.applicableAssetTypes,
      definition.taskingTeams,
      definition.taskingActions,
      definition.taskingConditions
    ])
  );
}

export function severityDefinitionsCacheSignature(severityDefinitions: SeverityDefinition[]): string {
  return JSON.stringify(
    severityDefinitions.map((definition) => [
      definition.severityKey,
      definition.label,
      definition.displayOrder,
      definition.selectableInSettings,
      definition.toneKey
    ])
  );
}

export function spiDefinitionById(spiDefinitions: SpiDefinition[]): Map<SpiId, SpiDefinition> {
  return new Map(spiDefinitions.map((definition) => [definition.spiId, definition]));
}

export function isSpiApplicableToAssetType(definition: SpiDefinition, assetType: AssetType): boolean {
  return definition.applicableAssetTypes.includes(assetType);
}
