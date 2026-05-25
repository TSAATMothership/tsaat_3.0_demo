import { Asset, SpiEvaluation } from "@/lib/types";
import { SpiDefinition } from "@/lib/spi-definitions";

function sqlDrivenSpiError(): Error {
  return new Error("SPI calculations are SQL-driven. Load snapshot SPI evaluations from SQL Server instead.");
}

export function evaluateAssetSpis(_asset: Asset, _spiDefinitions: SpiDefinition[]): SpiEvaluation[] {
  throw sqlDrivenSpiError();
}

export function hasProductionCriticalVulnerability(_asset: Asset): boolean {
  throw sqlDrivenSpiError();
}
