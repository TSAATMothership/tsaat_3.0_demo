import { buildFindings } from "@/lib/findings";
import { deduplicateFindings } from "@/lib/findings-normalization";
import { evaluateDiscoveryCoverage } from "@/lib/discovery-coverage";
import { defaultDiscoveryToolsSettings, DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import {
  applyMeasuresPrioritySettings,
  applyMeasuresSeveritySettings,
  defaultMeasuresSettings,
  MeasuresSettings
} from "@/lib/measures-settings";
import { buildRollups, mergeStatusCounts } from "@/lib/rollup";
import { applyAssetFilters } from "@/lib/selectors";
import { evaluateAssetSpis, hasProductionCriticalVulnerability } from "@/lib/spi-rules";
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
  discoveryToolsSettings: DiscoveryToolsSettings
): AssetSpiEvaluation {
  const systemId = asset.systemContext?.systemId;
  const system = systemId ? systemsById.get(systemId) : undefined;
  const discoveryCoverage = evaluateDiscoveryCoverage(asset, discoveryToolsSettings);

  return {
    assetId: asset.id,
    assetType: asset.type,
    networkId: asset.networkId,
    systemId: systemId ?? null,
    environmentType: asset.systemContext?.environmentType ?? null,
    securityDomain: asset.securityDomain,
    systemCriticality: system?.criticality ?? null,
    discoveryCoverageCompliant: discoveryCoverage.coverageCompliance,
    evaluations: evaluateAssetSpis(asset)
  };
}

function statusPercent(statuses: ComplianceStatus[]): number {
  if (statuses.length === 0) {
    return 0;
  }
  const compliant = statuses.filter((status) => status === "Compliant").length;
  return Number(((compliant / statuses.length) * 100).toFixed(1));
}

export function buildAnalytics(
  dataset: Dataset,
  systems: ICTSystem[],
  filters: Filters = {},
  measuresSettings: MeasuresSettings = defaultMeasuresSettings(),
  discoveryToolsSettings: DiscoveryToolsSettings = defaultDiscoveryToolsSettings()
): AnalyticsResult {
  const filteredAssets = applyAssetFilters(dataset.assets, systems, filters);
  const systemsById = new Map(systems.map((system) => [system.id, system]));
  const evaluations = filteredAssets.map((asset) => toAssetEvaluation(asset, systemsById, discoveryToolsSettings));

  const allStatuses = evaluations.flatMap((assetEval) =>
    assetEval.evaluations.map((evaluation) => evaluation.status)
  );

  const productionCriticalExposureAssetIds = filteredAssets
    .filter((asset) => hasProductionCriticalVulnerability(asset))
    .map((asset) => asset.id);

  const filteredAssetIds = new Set(filteredAssets.map((asset) => asset.id));
  const sourceFindings: Finding[] = (() => {
    if (dataset.findings && dataset.findings.length > 0) {
      return dataset.findings;
    }

    const allEvaluations = dataset.assets.map((asset) => toAssetEvaluation(asset, systemsById, discoveryToolsSettings));
    const allProductionCriticalSet = new Set(
      dataset.assets.filter((asset) => hasProductionCriticalVulnerability(asset)).map((asset) => asset.id)
    );
    return buildFindings(dataset.assets, allEvaluations, allProductionCriticalSet, {
      anchorDate: dataset.snapshotDate
    });
  })();
  const findingsWithConfiguredSeverity = applyMeasuresSeveritySettings(sourceFindings, dataset.assets, measuresSettings);
  const findingsWithConfiguredSettings = applyMeasuresPrioritySettings(findingsWithConfiguredSeverity, measuresSettings);
  const scopedFindings = deduplicateFindings(
    findingsWithConfiguredSettings.filter((finding) => filteredAssetIds.has(finding.scope.assetId))
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
    productionCriticalExposureAssetIds
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
