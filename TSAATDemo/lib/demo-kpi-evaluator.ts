import type { KpiDefinition } from "@/lib/kpi-definitions";
import type {
  Asset,
  ComplianceStatus,
  Dataset,
  Finding,
  StoredKpiEvaluation
} from "@/lib/types";

const SQL_HASH_MODULUS = 0x1_0000_0000;
const HIGH_PRIORITY_THRESHOLD = 2;

type KpiMetric = Omit<StoredKpiEvaluation, "kpiId" | "displayOrder" | "calculationKey">;

interface EvaluationContext {
  asset: Asset;
  status: ComplianceStatus;
}

export interface DemoKpiEvaluationInput {
  dataset: Dataset;
  assetIds: Iterable<string>;
  systemIds: Iterable<string>;
  networkIds: Iterable<string>;
  findings: Iterable<Finding>;
  kpiDefinitions: KpiDefinition[];
}

export interface DemoKpiScopeInput {
  scopeKey: string;
  assetIds: Iterable<string>;
  systemIds: Iterable<string>;
  networkIds: Iterable<string>;
  findings: Iterable<Finding>;
}

export interface DemoKpiScopesInput {
  dataset: Dataset;
  scopes: DemoKpiScopeInput[];
  kpiDefinitions: KpiDefinition[];
}

function normalizedIdSet(values: Iterable<string>): Set<string> {
  return new Set(
    Array.from(values)
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

/**
 * TypeScript equivalent of [tsaat].[fn_kpi_stable_hash].
 *
 * SQL Server receives NVARCHAR(4000), ignores trailing U+0020 spaces in LEN,
 * and applies modulo 2^32 after every UTF-16 code-unit update.
 */
export function demoKpiStableHash(value: string | null | undefined): number {
  const sqlValue = (value ?? "").slice(0, 4000).replace(/ +$/u, "");
  let hash = 0;

  for (let index = 0; index < sqlValue.length; index += 1) {
    hash = (Math.imul(hash, 31) + sqlValue.charCodeAt(index)) >>> 0;
  }

  return hash % SQL_HASH_MODULUS;
}

function sqlPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  // SQL uses ROUND((numerator * 100.0) / denominator, 1). All KPI counts are
  // non-negative, so quotient/remainder arithmetic exactly matches SQL's
  // half-away-from-zero behavior without floating-point tie drift.
  const scaledNumerator = numerator * 1000;
  const wholeTenths = Math.floor(scaledNumerator / denominator);
  const remainder = scaledNumerator % denominator;
  const roundedTenths = wholeTenths + (remainder * 2 >= denominator ? 1 : 0);
  return roundedTenths / 10;
}

function percentageScore(percent: number, compliant: number, total: number): string {
  return `${percent.toFixed(1)}% (${compliant}/${total})`;
}

function percentageMetric(input: {
  compliant: number;
  total: number;
  nonCompliant?: number;
  unknown?: number;
  highPriority?: number;
}): KpiMetric {
  const scorePercent = sqlPercent(input.compliant, input.total);
  return {
    score: percentageScore(scorePercent, input.compliant, input.total),
    scorePercent,
    compliantCount: input.compliant,
    applicableCount: input.total,
    nonCompliantCount: input.nonCompliant ?? input.total - input.compliant,
    unknownCount: input.unknown ?? 0,
    highPriorityCount: input.highPriority ?? 0
  };
}

function countStatuses(rows: EvaluationContext[]): {
  compliant: number;
  nonCompliant: number;
  unknown: number;
} {
  let compliant = 0;
  let nonCompliant = 0;
  let unknown = 0;

  for (const row of rows) {
    if (row.status === "Compliant") {
      compliant += 1;
    } else if (row.status === "Non-compliant") {
      nonCompliant += 1;
    } else if (row.status === "Unknown") {
      unknown += 1;
    }
  }

  return { compliant, nonCompliant, unknown };
}

function complianceMetric(rows: EvaluationContext[], highPriority: number): KpiMetric {
  const counts = countStatuses(rows);
  return percentageMetric({
    compliant: counts.compliant,
    total: rows.length,
    nonCompliant: counts.nonCompliant,
    unknown: counts.unknown,
    highPriority
  });
}

function isHighPriority(finding: Finding): boolean {
  return finding.priorityRank <= HIGH_PRIORITY_THRESHOLD;
}

function definitionUsesEnabledCalculation(definition: KpiDefinition): boolean {
  // SQL joins to an enabled kpi_calculation_definition. JSON fixtures may omit
  // the nested row after normalization, in which case the definition's own
  // enabled flag is the authoritative demo representation.
  return definition.enabled && definition.calculationDefinition?.enabled !== false;
}

export function evaluateDemoKpis({
  dataset,
  assetIds,
  systemIds,
  networkIds,
  findings,
  kpiDefinitions
}: DemoKpiEvaluationInput): StoredKpiEvaluation[] {
  const selectedAssetIds = normalizedIdSet(assetIds);
  const selectedSystemIds = normalizedIdSet(systemIds);
  const selectedNetworkIds = normalizedIdSet(networkIds);
  const systemsById = new Map(dataset.ictSystems.map((system) => [system.id, system]));
  const scopedAssets = dataset.assets.filter((asset) => selectedAssetIds.has(asset.id));
  const scopedAssetsById = new Map(scopedAssets.map((asset) => [asset.id, asset]));
  const scopedFindings = Array.from(findings).filter((finding) => scopedAssetsById.has(finding.scope.assetId));

  const evaluationRows: EvaluationContext[] = [];
  for (const evaluation of dataset.spiEvaluations) {
    const asset = scopedAssetsById.get(evaluation.assetId);
    if (asset) {
      evaluationRows.push({ asset, status: evaluation.status });
    }
  }

  const overallUnknown = evaluationRows.filter((row) => row.status === "Unknown").length;
  const highPriorityFindings = scopedFindings.filter(isHighPriority);
  const protectedRows = evaluationRows.filter((row) => row.asset.securityDomain === "Protected");
  const secretRows = evaluationRows.filter((row) => row.asset.securityDomain === "Secret");
  const criticalSystemRows = evaluationRows.filter((row) => {
    const systemId = row.asset.systemContext?.systemId;
    return systemId ? systemsById.get(systemId)?.criticality === "Critical" : false;
  });

  const metrics = new Map<string, KpiMetric>();
  metrics.set("overall-spi-compliance", complianceMetric(evaluationRows, highPriorityFindings.length));
  metrics.set(
    "protected-domain-compliance",
    complianceMetric(
      protectedRows,
      highPriorityFindings.filter(
        (finding) => scopedAssetsById.get(finding.scope.assetId)?.securityDomain === "Protected"
      ).length
    )
  );
  metrics.set(
    "secret-domain-compliance",
    complianceMetric(
      secretRows,
      highPriorityFindings.filter(
        (finding) => scopedAssetsById.get(finding.scope.assetId)?.securityDomain === "Secret"
      ).length
    )
  );
  metrics.set(
    "critical-ict-system-compliance",
    complianceMetric(
      criticalSystemRows,
      highPriorityFindings.filter((finding) => {
        const systemId = scopedAssetsById.get(finding.scope.assetId)?.systemContext?.systemId;
        return systemId ? systemsById.get(systemId)?.criticality === "Critical" : false;
      }).length
    )
  );

  const findingTotal = scopedFindings.length;
  const criticalExposure = scopedFindings.filter((finding) => finding.severity === "Critical Exposure").length;
  const nonCriticalExposure = Math.max(0, findingTotal - criticalExposure);
  metrics.set("critical-exposure-in-production", {
    score: String(criticalExposure),
    scorePercent: sqlPercent(nonCriticalExposure, findingTotal),
    compliantCount: nonCriticalExposure,
    applicableCount: findingTotal,
    nonCompliantCount: criticalExposure,
    unknownCount: overallUnknown,
    highPriorityCount: criticalExposure
  });

  const discoveryRows = (dataset.discoveryCoverageEvaluations ?? []).filter((row) =>
    scopedAssetsById.has(row.assetId)
  );
  const discoveryCompliant = discoveryRows.filter((row) => row.coverageCompliance).length;
  const discoveryNonCompliantAssetIds = new Set(
    discoveryRows.filter((row) => !row.coverageCompliance).map((row) => row.assetId)
  );
  metrics.set(
    "discovery-coverage-compliance",
    percentageMetric({
      compliant: discoveryCompliant,
      total: discoveryRows.length,
      highPriority: highPriorityFindings.filter((finding) =>
        discoveryNonCompliantAssetIds.has(finding.scope.assetId)
      ).length
    })
  );

  const scopedAssetSystemIds = new Set(
    scopedAssets
      .map((asset) => asset.systemContext?.systemId)
      .filter((systemId): systemId is string => Boolean(systemId))
  );
  const atoComplianceBySystem = new Map<string, boolean>();
  const diisRegistrationComplianceBySystem = new Map<string, boolean>();
  for (const systemId of scopedAssetSystemIds) {
    atoComplianceBySystem.set(systemId, demoKpiStableHash(`${systemId}:ato`) % 5 !== 0);
    diisRegistrationComplianceBySystem.set(systemId, demoKpiStableHash(`${systemId}:diis`) % 4 !== 1);
  }

  const atoCompliant = Array.from(atoComplianceBySystem.values()).filter(Boolean).length;
  metrics.set(
    "active-ato-coverage",
    percentageMetric({
      compliant: atoCompliant,
      total: atoComplianceBySystem.size,
      highPriority: highPriorityFindings.filter((finding) => {
        const systemId = scopedAssetsById.get(finding.scope.assetId)?.systemContext?.systemId;
        return systemId ? atoComplianceBySystem.get(systemId) === false : false;
      }).length
    })
  );

  const diisRegistrationCompliant = Array.from(diisRegistrationComplianceBySystem.values()).filter(Boolean).length;
  metrics.set(
    "diis-registration-coverage",
    percentageMetric({
      compliant: diisRegistrationCompliant,
      total: diisRegistrationComplianceBySystem.size,
      highPriority: highPriorityFindings.filter((finding) => {
        const systemId = scopedAssetsById.get(finding.scope.assetId)?.systemContext?.systemId;
        return systemId ? diisRegistrationComplianceBySystem.get(systemId) === false : false;
      }).length
    })
  );

  const scopedSystems = dataset.ictSystems.filter((system) => selectedSystemIds.has(system.id));
  const diisSystems = scopedSystems.filter((system) => system.diisDefined);
  const modelledDiisSystems = diisSystems.filter((system) => system.modellingStatus).length;
  metrics.set(
    "diis-modelled-coverage",
    percentageMetric({
      compliant: modelledDiisSystems,
      total: diisSystems.length,
      highPriority: diisSystems.length - modelledDiisSystems
    })
  );

  const scopedNetworks = dataset.managedNetworks.filter((network) => selectedNetworkIds.has(network.id));
  const discoveryEnabledNetworks = scopedNetworks.filter(
    (network) => network.discoveryStatus === "Discovery Enabled"
  ).length;
  metrics.set(
    "network-discovery-enablement",
    percentageMetric({
      compliant: discoveryEnabledNetworks,
      total: scopedNetworks.length,
      highPriority: scopedNetworks.length - discoveryEnabledNetworks
    })
  );

  return kpiDefinitions
    .filter(definitionUsesEnabledCalculation)
    .map((definition) => ({ definition, metric: metrics.get(definition.calculationKey) }))
    .filter(
      (entry): entry is { definition: KpiDefinition; metric: KpiMetric } => Boolean(entry.metric)
    )
    .sort(
      (left, right) =>
        left.definition.displayOrder - right.definition.displayOrder ||
        left.definition.id.localeCompare(right.definition.id)
    )
    .map(({ definition, metric }) => ({
      kpiId: definition.id,
      displayOrder: definition.displayOrder,
      calculationKey: definition.calculationKey,
      ...metric
    }));
}

export function evaluateDemoKpiScopes({
  dataset,
  scopes,
  kpiDefinitions
}: DemoKpiScopesInput): Map<string, StoredKpiEvaluation[]> {
  const result = new Map<string, StoredKpiEvaluation[]>();

  for (const scope of scopes) {
    const scopeKey = scope.scopeKey.trim();
    const scopedAssetIds = normalizedIdSet(scope.assetIds);
    if (!scopeKey || scopedAssetIds.size === 0) {
      continue;
    }
    if (result.has(scopeKey)) {
      throw new Error(`Duplicate KPI scope key '${scopeKey}'.`);
    }

    result.set(
      scopeKey,
      evaluateDemoKpis({
        dataset,
        assetIds: scopedAssetIds,
        systemIds: scope.systemIds,
        networkIds: scope.networkIds,
        findings: scope.findings,
        kpiDefinitions
      })
    );
  }

  return result;
}
