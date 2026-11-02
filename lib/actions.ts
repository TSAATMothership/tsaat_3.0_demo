import { SpiId } from "@/lib/types";
import { spiDefinitionById, SpiDefinition } from "@/lib/spi-definitions";

export function recommendedAction(spiId: SpiId, spiDefinitions: SpiDefinition[]): string {
  return spiDefinitionById(spiDefinitions).get(spiId)?.recommendedAction ?? "Review the affected control and assign remediation ownership.";
}
