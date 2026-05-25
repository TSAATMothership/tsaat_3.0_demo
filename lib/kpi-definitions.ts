export const KPI_CALCULATION_KEYS = [
  "overall-spi-compliance",
  "protected-domain-compliance",
  "secret-domain-compliance",
  "critical-ict-system-compliance",
  "critical-exposure-in-production",
  "discovery-coverage-compliance",
  "active-ato-coverage",
  "diis-registration-coverage",
  "diis-modelled-coverage",
  "network-discovery-enablement"
] as const;

export type KpiCalculationKey = (typeof KPI_CALCULATION_KEYS)[number];

export interface KpiDefinition {
  id: string;
  displayOrder: number;
  name: string;
  description: string;
  successMeasure: string;
  calculationKey: KpiCalculationKey;
  reportAvailable: boolean;
}

function isKpiCalculationKey(value: unknown): value is KpiCalculationKey {
  return typeof value === "string" && KPI_CALCULATION_KEYS.includes(value as KpiCalculationKey);
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
    definitions.push({
      id: normalizedId,
      displayOrder,
      name,
      description,
      successMeasure,
      calculationKey,
      reportAvailable: coerceBoolean(row.reportAvailable)
    });
  }

  return definitions.sort((left, right) => {
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
      definition.reportAvailable
    ])
  );
}
