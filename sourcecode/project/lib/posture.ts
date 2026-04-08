import { RollupResult, ComplianceStatus } from "@/lib/types";

export function deriveOverallStatus(rollups: RollupResult[]): ComplianceStatus {
  if (!rollups.length) {
    return "Unknown";
  }
  if (rollups.some((rollup) => rollup.status === "Non-compliant")) {
    return "Non-compliant";
  }
  if (rollups.some((rollup) => rollup.status === "Unknown")) {
    return "Unknown";
  }
  return "Compliant";
}

export function findSpiStatus(rollups: RollupResult[], spiId: number): ComplianceStatus {
  return rollups.find((rollup) => rollup.spiId === spiId)?.status ?? "Unknown";
}
