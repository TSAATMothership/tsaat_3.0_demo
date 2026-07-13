export type KpiCalculationKey = string;

export interface KpiTaskingTeam {
  displayOrder: number;
  team: string;
  supportQueue: string;
  contactEmail: string;
}

export interface KpiTaskingActionTemplate {
  displayOrder: number;
  conditionKey: "always" | "when_unknown" | "when_fully_compliant";
  actionText: string;
}

export interface KpiTaskingConditionTemplates {
  non_compliant?: string;
  unknown?: string;
  compliant?: string;
}

export interface KpiReportDetailDefinition {
  reportDetailKey: string;
  handlerKey: string;
  displayOrder: number;
  name: string;
  description: string;
  enabled: boolean;
}

export interface KpiCalculationDefinition {
  calculationKey: string;
  sourceKey: string;
  displayOrder: number;
  name: string;
  description: string;
  enabled: boolean;
}

export interface KpiDefinition {
  id: string;
  displayOrder: number;
  name: string;
  description: string;
  successMeasure: string;
  calculationKey: KpiCalculationKey;
  reportAvailable: boolean;
  enabled: boolean;
  calculationDefinition?: KpiCalculationDefinition;
  reportDetailDefinition?: KpiReportDetailDefinition;
  taskingTeams: KpiTaskingTeam[];
  taskingActions: KpiTaskingActionTemplate[];
  taskingConditions: KpiTaskingConditionTemplates;
}

function isKpiCalculationKey(value: unknown): value is KpiCalculationKey {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return ["1", "true", "yes"].includes(value.trim().toLowerCase());
  }
  return false;
}

export function normalizeKpiDefinitions(input: unknown): KpiDefinition[] {
  const rows = (() => {
    if (Array.isArray(input)) {
      return input;
    }
    if (input && typeof input === "object" && Array.isArray((input as { kpis?: unknown }).kpis)) {
      return (input as { kpis: unknown[] }).kpis;
    }
    return [];
  })();

  const definitions: KpiDefinition[] = [];
  const seenIds = new Set<string>();
  const seenDisplayOrders = new Set<number>();

  for (const rawRow of rows) {
    if (!rawRow || typeof rawRow !== "object") {
      continue;
    }

    const row = rawRow as Record<string, unknown>;
    const id = nonEmptyText(row.id ?? row.kpiId);
    const displayOrder = Number(row.displayOrder);
    const name = nonEmptyText(row.name);
    const description = nonEmptyText(row.description);
    const successMeasure = nonEmptyText(row.successMeasure);
    const calculationKey = row.calculationKey;

    if (
      !id ||
      !Number.isInteger(displayOrder) ||
      displayOrder < 1 ||
      !name ||
      !description ||
      !successMeasure ||
      !isKpiCalculationKey(calculationKey)
    ) {
      continue;
    }

    const normalizedId = id.toUpperCase();
    if (seenIds.has(normalizedId) || seenDisplayOrders.has(displayOrder)) {
      continue;
    }

    seenIds.add(normalizedId);
    seenDisplayOrders.add(displayOrder);
    const taskingConditions: KpiTaskingConditionTemplates = {};
    const rawConditions = Array.isArray(row.taskingConditions) ? row.taskingConditions : [];
    for (const condition of rawConditions) {
      if (!condition || typeof condition !== "object") {
        continue;
      }
      const conditionRow = condition as Record<string, unknown>;
      const conditionKey = nonEmptyText(conditionRow.conditionKey);
      const templateText = nonEmptyText(conditionRow.templateText);
      if (
        templateText &&
        (conditionKey === "non_compliant" || conditionKey === "unknown" || conditionKey === "compliant")
      ) {
        taskingConditions[conditionKey] = templateText;
      }
    }

    const taskingTeams = (Array.isArray(row.taskingTeams) ? row.taskingTeams : [])
      .map((team): KpiTaskingTeam | null => {
        if (!team || typeof team !== "object") {
          return null;
        }
        const teamRow = team as Record<string, unknown>;
        const teamName = nonEmptyText(teamRow.team);
        const supportQueue = nonEmptyText(teamRow.supportQueue);
        const contactEmail = nonEmptyText(teamRow.contactEmail);
        const teamDisplayOrder = Number(teamRow.displayOrder);
        if (!teamName || !supportQueue || !contactEmail || !Number.isInteger(teamDisplayOrder) || teamDisplayOrder < 1) {
          return null;
        }
        return { displayOrder: teamDisplayOrder, team: teamName, supportQueue, contactEmail };
      })
      .filter((team): team is KpiTaskingTeam => Boolean(team))
      .sort((left, right) => left.displayOrder - right.displayOrder || left.team.localeCompare(right.team));

    const taskingActions = (Array.isArray(row.taskingActions) ? row.taskingActions : [])
      .map((action): KpiTaskingActionTemplate | null => {
        if (!action || typeof action !== "object") {
          return null;
        }
        const actionRow = action as Record<string, unknown>;
        const conditionKey = nonEmptyText(actionRow.conditionKey);
        const actionText = nonEmptyText(actionRow.actionText);
        const actionDisplayOrder = Number(actionRow.displayOrder);
        if (
          !actionText ||
          !Number.isInteger(actionDisplayOrder) ||
          actionDisplayOrder < 1 ||
          (conditionKey !== "always" && conditionKey !== "when_unknown" && conditionKey !== "when_fully_compliant")
        ) {
          return null;
        }
        return { displayOrder: actionDisplayOrder, conditionKey, actionText };
      })
      .filter((action): action is KpiTaskingActionTemplate => Boolean(action))
      .sort((left, right) => left.displayOrder - right.displayOrder || left.actionText.localeCompare(right.actionText));

    const calculationDefinition = row.calculationDefinition as KpiCalculationDefinition | undefined;
    const reportDetailDefinition = row.reportDetailDefinition as KpiReportDetailDefinition | undefined;

    if (calculationDefinition && calculationDefinition.enabled === false) {
      continue;
    }
    if (row.reportDetailDefinition && !reportDetailDefinition?.enabled) {
      continue;
    }

    definitions.push({
      id: normalizedId,
      displayOrder,
      name,
      description,
      successMeasure,
      calculationKey,
      reportAvailable: coerceBoolean(row.reportAvailable),
      enabled: coerceBoolean(row.enabled ?? true),
      calculationDefinition,
      reportDetailDefinition,
      taskingTeams,
      taskingActions,
      taskingConditions
    });
  }

  return definitions.filter((definition) => definition.enabled).sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }
    return left.id.localeCompare(right.id);
  });
}

export function kpiDefinitionsCacheSignature(kpiDefinitions: KpiDefinition[]): string {
  return JSON.stringify(
    kpiDefinitions.map((definition) => [
      definition.id,
      definition.displayOrder,
      definition.name,
      definition.description,
      definition.successMeasure,
      definition.calculationKey,
      definition.reportAvailable,
      definition.enabled,
      definition.reportDetailDefinition?.reportDetailKey ?? "",
      definition.reportDetailDefinition?.handlerKey ?? "",
      (definition.taskingTeams ?? []).map((team) => [team.displayOrder, team.team, team.supportQueue, team.contactEmail]),
      (definition.taskingActions ?? []).map((action) => [action.displayOrder, action.conditionKey, action.actionText]),
      definition.taskingConditions?.non_compliant ?? "",
      definition.taskingConditions?.unknown ?? "",
      definition.taskingConditions?.compliant ?? ""
    ])
  );
}
