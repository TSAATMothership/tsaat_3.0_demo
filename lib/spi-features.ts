import { SpiDefinition, spiEvaluationMatchesFeature } from "@/lib/spi-definitions";
import { SpiEvaluation } from "@/lib/types";

export const SPI_FEATURE_OS_NON_COMPLIANT = "os-non-compliant";
export const SPI_FEATURE_OUT_OF_SUPPORT_OS_REPORT = "out-of-support-os-report";

export function evaluationMatchesSpiFeature(
  evaluation: Pick<SpiEvaluation, "spiId" | "status" | "outcomeKey">,
  featureKey: string,
  spiDefinitions: SpiDefinition[]
): boolean {
  return spiEvaluationMatchesFeature(evaluation, featureKey, spiDefinitions);
}

export function findEvaluationForSpiFeature(
  evaluations: SpiEvaluation[],
  featureKey: string,
  spiDefinitions: SpiDefinition[]
): SpiEvaluation | undefined {
  return evaluations.find((evaluation) => evaluationMatchesSpiFeature(evaluation, featureKey, spiDefinitions));
}
