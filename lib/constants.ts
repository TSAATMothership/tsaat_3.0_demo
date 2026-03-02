import { SpiId } from "@/lib/types";

export const SPI_DESCRIPTIONS: Record<SpiId, string> = {
  1: "Operating systems must not be out of vendor support.",
  2: "Operating systems must be N-2 or better.",
  3: "Servers must not have Critical vulnerabilities.",
  4: "High Risk: Production servers must not have Critical vulns with out-of-support OS.",
  5: "High Risk: Production servers must not have Critical vulns with out-of-support installed software.",
  6: "High Risk: Production-supporting workstations must not have Critical vulns with out-of-support installed software.",
  7: "Network devices must not have Critical vulnerabilities.",
  8: "Network devices must not have unsupported OS/firmware.",
  9: "Network devices must be on latest patches.",
  10: "No physical device should be EOL or out of warranty."
};

export const PRIORITY_ORDER: Record<SpiId, number> = {
  4: 1,
  5: 1,
  6: 1,
  3: 2,
  7: 2,
  1: 3,
  8: 3,
  2: 4,
  9: 6,
  10: 7
};

export const APP_NAME = "TSAAT - Threat Surface Area Assessment Tool";
