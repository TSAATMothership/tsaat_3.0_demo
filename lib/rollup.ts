import { AssetSpiEvaluation, ComplianceStatus, RollupCounts, RollupResult, SpiId } from "@/lib/types";

function aggregateStatus(statuses: ComplianceStatus[]): ComplianceStatus {
  if (statuses.includes("Non-compliant")) {
    return "Non-compliant";
  }
  if (statuses.includes("Unknown")) {
    return "Unknown";
  }
  return "Compliant";
}

function countStatuses(statuses: ComplianceStatus[]): RollupCounts {
  return {
    compliant: statuses.filter((status) => status === "Compliant").length,
    nonCompliant: statuses.filter((status) => status === "Non-compliant").length,
    unknown: statuses.filter((status) => status === "Unknown").length,
    impactedAssets: statuses.filter((status) => status === "Non-compliant").length
  };
}

function rollupForScope(
  scopeType: "network" | "system" | "environment",
  scopeId: string,
  evaluations: AssetSpiEvaluation[]
): RollupResult[] {
  const bySpi = new Map<SpiId, ComplianceStatus[]>();

  for (const assetEval of evaluations) {
    for (const evaluation of assetEval.evaluations) {
      const statuses = bySpi.get(evaluation.spiId) ?? [];
      statuses.push(evaluation.status);
      bySpi.set(evaluation.spiId, statuses);
    }
  }

  return Array.from(bySpi.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([spiId, statuses]) => ({
      scopeType,
      scopeId,
      spiId,
      status: aggregateStatus(statuses),
      counts: countStatuses(statuses)
    }));
}

export function buildRollups(evaluations: AssetSpiEvaluation[]): {
  networkRollups: RollupResult[];
  systemRollups: RollupResult[];
  environmentRollups: RollupResult[];
} {
  const byNetwork = new Map<string, AssetSpiEvaluation[]>();
  const bySystem = new Map<string, AssetSpiEvaluation[]>();
  const byEnvironment = new Map<string, AssetSpiEvaluation[]>();

  for (const evaluation of evaluations) {
    const networkGroup = byNetwork.get(evaluation.networkId) ?? [];
    networkGroup.push(evaluation);
    byNetwork.set(evaluation.networkId, networkGroup);

    if (evaluation.systemId) {
      const systemGroup = bySystem.get(evaluation.systemId) ?? [];
      systemGroup.push(evaluation);
      bySystem.set(evaluation.systemId, systemGroup);
    }

    if (evaluation.systemId && evaluation.environmentType) {
      const envKey = `${evaluation.systemId}::${evaluation.environmentType}`;
      const envGroup = byEnvironment.get(envKey) ?? [];
      envGroup.push(evaluation);
      byEnvironment.set(envKey, envGroup);
    }
  }

  const networkRollups = Array.from(byNetwork.entries()).flatMap(([networkId, items]) =>
    rollupForScope("network", networkId, items)
  );

  const systemRollups = Array.from(bySystem.entries()).flatMap(([systemId, items]) =>
    rollupForScope("system", systemId, items)
  );

  const environmentRollups = Array.from(byEnvironment.entries()).flatMap(([envKey, items]) =>
    rollupForScope("environment", envKey, items)
  );

  return {
    networkRollups,
    systemRollups,
    environmentRollups
  };
}

export function mergeStatusCounts(statuses: ComplianceStatus[]): RollupCounts {
  return countStatuses(statuses);
}
