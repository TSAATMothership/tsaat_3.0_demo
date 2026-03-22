import { SpiId } from "@/lib/types";
import { SPI_ACTIONS } from "@/lib/spi-metadata";

export function recommendedAction(spiId: SpiId): string {
  return SPI_ACTIONS[spiId];
}
