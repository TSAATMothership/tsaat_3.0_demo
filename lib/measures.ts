import { KpiCalculationKey, KpiDefinition } from "@/lib/kpi-definitions";
import { SpiDefinition } from "@/lib/spi-definitions";
import { AnalyticsResult, SpiId, StoredKpiEvaluation } from "@/lib/types";

export interface KpiRow {
  id: string;
  displayOrder: number;
  name: string;
  description: string;
  successMeasure: string;
  calculationKey: KpiCalculationKey;
  reportAvailable: boolean;
  reportDetailKey?: string;
  reportDetailHandlerKey?: string;
  score: string;
  scorePercent: number;
  compliantCount: number;
  applicableCount: number;
  nonCompliantCount: number;
  unknownCount: number;
  highPriorityCount: number;
}

export interface SpiRow {
  spiId: SpiId;
  displayOrder: number;
  name: string;
  description: string;
  successMeasure: string;
  reportAvailable: boolean;
  trendReportAvailable: boolean;
  reportDetailKey: string;
  scorePercent: number;
  compliant: number;
  nonCompliant: number;
  unknown: number;
  total: number;
}

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(1));
}

export function buildKpiRows(
  kpiDefinitions: KpiDefinition[],
  kpiEvaluations: StoredKpiEvaluation[]
): KpiRow[] {
  const evaluationById = new Map(kpiEvaluations.map((evaluation) => [evaluation.kpiId, evaluation]));
  const rows: KpiRow[] = [];

  for (const definition of kpiDefinitions) {
    const evaluation = evaluationById.get(definition.id);
    if (!evaluation) {
      continue;
    }
    rows.push({
      id: definition.id,
      displayOrder: definition.displayOrder,
      name: definition.name,
      description: definition.description,
      successMeasure: definition.successMeasure,
      calculationKey: definition.calculationKey,
      reportAvailable: definition.reportAvailable,
      reportDetailKey: definition.reportDetailDefinition?.reportDetailKey,
      reportDetailHandlerKey: definition.reportDetailDefinition?.handlerKey,
      score: evaluation.score,
      scorePercent: evaluation.scorePercent,
      compliantCount: evaluation.compliantCount,
      applicableCount: evaluation.applicableCount,
      nonCompliantCount: evaluation.nonCompliantCount,
      unknownCount: evaluation.unknownCount,
      highPriorityCount: evaluation.highPriorityCount
    });
  }

  return rows;
}

export function buildSpiRows(analytics: AnalyticsResult, spiDefinitions: SpiDefinition[]): SpiRow[] {
  return spiDefinitions.map((definition) => {
    const spiId = definition.spiId;
    const statuses = analytics.evaluations.flatMap((assetEvaluation) =>
      assetEvaluation.evaluations.filter((evaluation) => evaluation.spiId === spiId).map((evaluation) => evaluation.status)
    );

    const compliant = statuses.filter((status) => status === "Compliant").length;
    const nonCompliant = statuses.filter((status) => status === "Non-compliant").length;
    const unknown = statuses.filter((status) => status === "Unknown").length;
    const total = statuses.length;

    return {
      spiId,
      displayOrder: definition.displayOrder,
      name: definition.name,
      description: definition.description,
      successMeasure: definition.successMeasure,
      reportAvailable: definition.reportAvailable,
      trendReportAvailable: definition.trendReportAvailable,
      reportDetailKey: definition.reportDetailKey,
      scorePercent: toPercent(compliant, total),
      compliant,
      nonCompliant,
      unknown,
      total
    };
  });
}
