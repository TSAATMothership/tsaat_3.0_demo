import { deduplicateFindings } from "@/lib/findings-normalization";
import { discoveryCoverageByAssetId, discoveryCoverageForAssetId } from "@/lib/discovery-coverage";
import { defaultDiscoveryToolsSettings, DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { MeasuresSettings } from "@/lib/measures-settings";
import { SpiDefinition, spiEvaluationMatchesFeature } from "@/lib/spi-definitions";
import { buildRollups, mergeStatusCounts } from "@/lib/rollup";
import { applyAssetFilters } from "@/lib/selectors";
import {
  AnalyticsResult,
  Asset,
  AssetSpiEvaluation,
  ComplianceStatus,
  Dataset,
  Finding,
  Filters,
  ICTSystem
} from "@/lib/types";

function toAssetEvaluation(
  asset: Asset,
  systemsById: Map<string, ICTSystem>,
  discoveryToolsSettings: DiscoveryToolsSettings,
  discoveryCoverageByAsset: ReturnType<typeof discoveryCoverageByAssetId>,
  evaluationsByAssetId: Map<string, AssetSpiEvaluation["evaluations"]>
): AssetSpiEvaluation {
  void discoveryToolsSettings;
  const systemId = asset.systemContext?.systemId;
  const system = systemId ? systemsById.get(systemId) : undefined;
  const discoveryCoverage = discoveryCoverageForAssetId(asset.id, discoveryCoverageByAsset);

  return {
    assetId: asset.id,
    assetType: asset.type,
    networkId: asset.networkId,
    systemId: systemId ?? null,
    environmentType: asset.systemContext?.environmentType ?? null,
    securityDomain: asset.securityDomain,
    systemCriticality: system?.criticality ?? null,
    discoveryCoverageCompliant: discoveryCoverage.coverageCompliance,
    evaluations: evaluationsByAssetId.get(asset.id) ?? []
  };
}

function statusPercent(statuses: ComplianceStatus[]): number {
  if (statuses.length === 0) {
    return 0;
  }
  const compliant = statuses.filter((status) => status === "Compliant").length;
  return Number(((compliant / statuses.length) * 100).toFixed(1));
}

function spiEvaluationsByAssetId(dataset: Dataset): Map<string, AssetSpiEvaluation["evaluations"]> {
  const byAssetId = new Map<string, AssetSpiEvaluation["evaluations"]>();
  for (const evaluation of dataset.spiEvaluations) {
    const existing = byAssetId.get(evaluation.assetId) ?? [];
    existing.push({
      spiId: evaluation.spiId,
      outcomeKey: evaluation.outcomeKey,
      status: evaluation.status,
      evidence: evaluation.evidence,
      reasons: evaluation.reasons
    });
    byAssetId.set(evaluation.assetId, existing);
  }

  return byAssetId;
}

function productionCriticalExposureAssetIds(
  evaluations: AssetSpiEvaluation[],
  spiDefinitions: SpiDefinition[]
): string[] {
  return evaluations
    .filter(
      (assetEvaluation) =>
        assetEvaluation.environmentType === "Production" &&
        assetEvaluation.evaluations.some((evaluation) =>
          spiEvaluationMatchesFeature(evaluation, "production-critical-exposure", spiDefinitions)
        )
    )
    .map((assetEvaluation) => assetEvaluation.assetId);
}

export function buildAnalytics(
  dataset: Dataset,
  systems: ICTSystem[],
  filters: Filters,
  spiDefinitions: SpiDefinition[],
  measuresSettings: MeasuresSettings,
  discoveryToolsSettings: DiscoveryToolsSettings = defaultDiscoveryToolsSettings()
): AnalyticsResult {
  void measuresSettings;
  const filteredAssets = applyAssetFilters(dataset.assets, systems, filters);
  const systemsById = new Map(systems.map((system) => [system.id, system]));
  const storedEvaluationsByAssetId = spiEvaluationsByAssetId(dataset);
  const storedDiscoveryCoverageByAssetId = discoveryCoverageByAssetId(dataset.discoveryCoverageEvaluations);
  const evaluations = filteredAssets.map((asset) =>
    toAssetEvaluation(asset, systemsById, discoveryToolsSettings, storedDiscoveryCoverageByAssetId, storedEvaluationsByAssetId)
  );

  const allStatuses = evaluations.flatMap((assetEval) =>
    assetEval.evaluations.map((evaluation) => evaluation.status)
  );

  const productionCriticalAssetIds = productionCriticalExposureAssetIds(evaluations, spiDefinitions);

  const filteredAssetIds = new Set(filteredAssets.map((asset) => asset.id));
  const sourceFindings: Finding[] = dataset.findings ?? [];
  const scopedFindings = deduplicateFindings(
    sourceFindings.filter((finding) => filteredAssetIds.has(finding.scope.assetId))
  );
  const findings = filters.severity
    ? scopedFindings.filter((finding) => finding.severity === filters.severity)
    : scopedFindings;
  const { networkRollups, systemRollups, environmentRollups } = buildRollups(evaluations);

  return {
    evaluations,
    findings,
    networkRollups,
    systemRollups,
    environmentRollups,
    overallCompliancePercent: statusPercent(allStatuses),
    statusTotals: mergeStatusCounts(allStatuses),
    productionCriticalExposureAssetIds: productionCriticalAssetIds
  };
}

export function topFindings(result: AnalyticsResult, count = 10) {
  return result.findings.slice(0, count);
}

export function countBySeverity(result: AnalyticsResult) {
  return result.findings.reduce<Record<string, number>>((accumulator, finding) => {
    accumulator[finding.severity] = (accumulator[finding.severity] ?? 0) + 1;
    return accumulator;
  }, {});
}
