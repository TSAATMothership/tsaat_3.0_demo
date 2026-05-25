import { KpiCalculationKey, KpiDefinition } from "@/lib/kpi-definitions";
import { SpiDefinition } from "@/lib/spi-definitions";
import { AnalyticsResult, ComplianceStatus, ICTSystem, ManagedNetwork, SpiId } from "@/lib/types";

export interface KpiRow {
  id: string;
  displayOrder: number;
  name: string;
  description: string;
  successMeasure: string;
  calculationKey: KpiCalculationKey;
  reportAvailable: boolean;
  score: string;
  scorePercent: number;
  compliantCount: number;
  applicableCount: number;
  nonCompliantCount: number;
  unknownCount: number;
  highPriorityCount: number;
}

export interface SpiRow {
  spiId: SpiId;
  displayOrder: number;
  name: string;
  description: string;
  successMeasure: string;
  reportAvailable: boolean;
  trendReportAvailable: boolean;
  reportDetailKey: string;
  scorePercent: number;
  compliant: number;
  nonCompliant: number;
  unknown: number;
  total: number;
}

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function stableHash(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function systemHasActiveAto(systemId: string): boolean {
  return stableHash(`${systemId}:ato`) % 5 !== 0;
}

function systemIsRegisteredWithinDiis(systemId: string): boolean {
  return stableHash(`${systemId}:diis`) % 4 !== 1;
}

interface StatusSummary {
  compliant: number;
  nonCompliant: number;
  unknown: number;
  total: number;
  scorePercent: number;
}

type KpiCalculationResult = Omit<
  KpiRow,
  "id" | "displayOrder" | "name" | "description" | "successMeasure" | "calculationKey" | "reportAvailable"
>;

function summarizeStatuses(statuses: ComplianceStatus[]): StatusSummary {
  const compliant = statuses.filter((status) => status === "Compliant").length;
  const nonCompliant = statuses.filter((status) => status === "Non-compliant").length;
  const unknown = statuses.filter((status) => status === "Unknown").length;
  const total = statuses.length;

  return {
    compliant,
    nonCompliant,
    unknown,
    total,
    scorePercent: toPercent(compliant, total)
  };
}

function statusesForEvaluations(evaluations: AnalyticsResult["evaluations"]): ComplianceStatus[] {
  return evaluations.flatMap((assetEvaluation) => assetEvaluation.evaluations.map((evaluation) => evaluation.status));
}

export function buildKpiRows(
  analytics: AnalyticsResult,
  scopedSystems: ICTSystem[],
  scopedNetworks: ManagedNetwork[],
  kpiDefinitions: KpiDefinition[]
): KpiRow[] {
  const overallSummary = summarizeStatuses(statusesForEvaluations(analytics.evaluations));
  const dpeSummary = summarizeStatuses(
    statusesForEvaluations(analytics.evaluations.filter((assetEvaluation) => assetEvaluation.securityDomain === "Protected"))
  );
  const dseSummary = summarizeStatuses(
    statusesForEvaluations(analytics.evaluations.filter((assetEvaluation) => assetEvaluation.securityDomain === "Secret"))
  );
  const criticalIctSystemSummary = summarizeStatuses(
    statusesForEvaluations(
      analytics.evaluations.filter((assetEvaluation) => assetEvaluation.systemCriticality === "Critical")
    )
  );

  const totalFindings = analytics.findings.length;
  const criticalExposureFindings = analytics.findings.filter(
    (finding) => finding.severity === "Critical Exposure"
  ).length;
  const immediateAction = analytics.findings.filter((finding) => finding.priorityRank <= 2).length;
  const criticalExposureCompliant = Math.max(totalFindings - criticalExposureFindings, 0);
  const criticalExposureScore = toPercent(criticalExposureCompliant, totalFindings);

  const discoveryTotalAssets = analytics.evaluations.length;
  const discoveryCompliantAssets = analytics.evaluations.filter(
    (assetEvaluation) => assetEvaluation.discoveryCoverageCompliant
  ).length;
  const discoveryNonCompliantAssets = Math.max(discoveryTotalAssets - discoveryCompliantAssets, 0);
  const discoveryComplianceScore = toPercent(discoveryCompliantAssets, discoveryTotalAssets);

  const securityDomainByAssetId = new Map(
    analytics.evaluations.map((assetEvaluation) => [assetEvaluation.assetId, assetEvaluation.securityDomain] as const)
  );
  const systemCriticalityByAssetId = new Map(
    analytics.evaluations.map((assetEvaluation) => [assetEvaluation.assetId, assetEvaluation.systemCriticality] as const)
  );
  const discoveryCoverageByAssetId = new Map(
    analytics.evaluations.map(
      (assetEvaluation) => [assetEvaluation.assetId, assetEvaluation.discoveryCoverageCompliant] as const
    )
  );

  const dpeImmediateAction = analytics.findings.filter(
    (finding) =>
      finding.priorityRank <= 2 && securityDomainByAssetId.get(finding.scope.assetId) === "Protected"
  ).length;
  const dseImmediateAction = analytics.findings.filter(
    (finding) => finding.priorityRank <= 2 && securityDomainByAssetId.get(finding.scope.assetId) === "Secret"
  ).length;
  const criticalIctSystemImmediateAction = analytics.findings.filter(
    (finding) =>
      finding.priorityRank <= 2 && systemCriticalityByAssetId.get(finding.scope.assetId) === "Critical"
  ).length;
  const discoveryCoverageImmediateAction = analytics.findings.filter(
    (finding) =>
      finding.priorityRank <= 2 && discoveryCoverageByAssetId.get(finding.scope.assetId) === false
  ).length;
  const systemIds = Array.from(
    new Set(
      analytics.evaluations
        .map((assetEvaluation) => assetEvaluation.systemId)
        .filter((systemId): systemId is string => Boolean(systemId))
    )
  );
  const systemIdByAssetId = new Map(
    analytics.evaluations.map((assetEvaluation) => [assetEvaluation.assetId, assetEvaluation.systemId] as const)
  );
  const systemAtoStatusById = new Map(systemIds.map((systemId) => [systemId, systemHasActiveAto(systemId)] as const));
  const systemDiisStatusById = new Map(
    systemIds.map((systemId) => [systemId, systemIsRegisteredWithinDiis(systemId)] as const)
  );
  const atoApplicableSystems = systemIds.length;
  const atoCompliantSystems = systemIds.filter((systemId) => systemAtoStatusById.get(systemId) === true).length;
  const atoNonCompliantSystems = Math.max(atoApplicableSystems - atoCompliantSystems, 0);
  const atoComplianceScore = toPercent(atoCompliantSystems, atoApplicableSystems);
  const diisApplicableSystems = systemIds.length;
  const diisCompliantSystems = systemIds.filter((systemId) => systemDiisStatusById.get(systemId) === true).length;
  const diisNonCompliantSystems = Math.max(diisApplicableSystems - diisCompliantSystems, 0);
  const diisComplianceScore = toPercent(diisCompliantSystems, diisApplicableSystems);
  const atoImmediateAction = analytics.findings.filter((finding) => {
    if (finding.priorityRank > 2) {
      return false;
    }
    const systemId = systemIdByAssetId.get(finding.scope.assetId);
    if (!systemId) {
      return false;
    }
    return systemAtoStatusById.get(systemId) === false;
  }).length;
  const diisImmediateAction = analytics.findings.filter((finding) => {
    if (finding.priorityRank > 2) {
      return false;
    }
    const systemId = systemIdByAssetId.get(finding.scope.assetId);
    if (!systemId) {
      return false;
    }
    return systemDiisStatusById.get(systemId) === false;
  }).length;

  const diisSystems = scopedSystems.filter((system) => system.diisDefined);
  const diisDefinedCount = diisSystems.length;
  const modelledSystemsCount = diisSystems.filter((system) => system.modellingStatus).length;
  const unmodelledSystemsCount = Math.max(diisDefinedCount - modelledSystemsCount, 0);
  const modelledCoverageScore = toPercent(modelledSystemsCount, diisDefinedCount);
  const networksDefinedCount = scopedNetworks.length;
  const discoveryEnabledNetworksCount = scopedNetworks.filter(
    (network) => network.discoveryStatus === "Discovery Enabled"
  ).length;
  const discoveryNonEnabledNetworksCount = Math.max(
    networksDefinedCount - discoveryEnabledNetworksCount,
    0
  );
  const networkDiscoveryEnabledScore = toPercent(discoveryEnabledNetworksCount, networksDefinedCount);

  const calculations: Record<KpiCalculationKey, KpiCalculationResult> = {
    "overall-spi-compliance": {
      score: `${overallSummary.scorePercent}% (${overallSummary.compliant}/${overallSummary.total})`,
      scorePercent: overallSummary.scorePercent,
      compliantCount: overallSummary.compliant,
      applicableCount: overallSummary.total,
      nonCompliantCount: overallSummary.nonCompliant,
      unknownCount: overallSummary.unknown,
      highPriorityCount: immediateAction
    },
    "protected-domain-compliance": {
      score: `${dpeSummary.scorePercent}% (${dpeSummary.compliant}/${dpeSummary.total})`,
      scorePercent: dpeSummary.scorePercent,
      compliantCount: dpeSummary.compliant,
      applicableCount: dpeSummary.total,
      nonCompliantCount: dpeSummary.nonCompliant,
      unknownCount: dpeSummary.unknown,
      highPriorityCount: dpeImmediateAction
    },
    "secret-domain-compliance": {
      score: `${dseSummary.scorePercent}% (${dseSummary.compliant}/${dseSummary.total})`,
      scorePercent: dseSummary.scorePercent,
      compliantCount: dseSummary.compliant,
      applicableCount: dseSummary.total,
      nonCompliantCount: dseSummary.nonCompliant,
      unknownCount: dseSummary.unknown,
      highPriorityCount: dseImmediateAction
    },
    "critical-ict-system-compliance": {
      score: `${criticalIctSystemSummary.scorePercent}% (${criticalIctSystemSummary.compliant}/${criticalIctSystemSummary.total})`,
      scorePercent: criticalIctSystemSummary.scorePercent,
      compliantCount: criticalIctSystemSummary.compliant,
      applicableCount: criticalIctSystemSummary.total,
      nonCompliantCount: criticalIctSystemSummary.nonCompliant,
      unknownCount: criticalIctSystemSummary.unknown,
      highPriorityCount: criticalIctSystemImmediateAction
    },
    "critical-exposure-in-production": {
      score: String(criticalExposureFindings),
      scorePercent: criticalExposureScore,
      compliantCount: criticalExposureCompliant,
      applicableCount: totalFindings,
      nonCompliantCount: criticalExposureFindings,
      unknownCount: overallSummary.unknown,
      highPriorityCount: criticalExposureFindings
    },
    "discovery-coverage-compliance": {
      score: `${discoveryComplianceScore}% (${discoveryCompliantAssets}/${discoveryTotalAssets})`,
      scorePercent: discoveryComplianceScore,
      compliantCount: discoveryCompliantAssets,
      applicableCount: discoveryTotalAssets,
      nonCompliantCount: discoveryNonCompliantAssets,
      unknownCount: 0,
      highPriorityCount: discoveryCoverageImmediateAction
    },
    "active-ato-coverage": {
      score: `${atoComplianceScore}% (${atoCompliantSystems}/${atoApplicableSystems})`,
      scorePercent: atoComplianceScore,
      compliantCount: atoCompliantSystems,
      applicableCount: atoApplicableSystems,
      nonCompliantCount: atoNonCompliantSystems,
      unknownCount: 0,
      highPriorityCount: atoImmediateAction
    },
    "diis-registration-coverage": {
      score: `${diisComplianceScore}% (${diisCompliantSystems}/${diisApplicableSystems})`,
      scorePercent: diisComplianceScore,
      compliantCount: diisCompliantSystems,
      applicableCount: diisApplicableSystems,
      nonCompliantCount: diisNonCompliantSystems,
      unknownCount: 0,
      highPriorityCount: diisImmediateAction
    },
    "diis-modelled-coverage": {
      score: `${modelledCoverageScore}% (${modelledSystemsCount}/${diisDefinedCount})`,
      scorePercent: modelledCoverageScore,
      compliantCount: modelledSystemsCount,
      applicableCount: diisDefinedCount,
      nonCompliantCount: unmodelledSystemsCount,
      unknownCount: 0,
      highPriorityCount: unmodelledSystemsCount
    },
    "network-discovery-enablement": {
      score: `${networkDiscoveryEnabledScore}% (${discoveryEnabledNetworksCount}/${networksDefinedCount})`,
      scorePercent: networkDiscoveryEnabledScore,
      compliantCount: discoveryEnabledNetworksCount,
      applicableCount: networksDefinedCount,
      nonCompliantCount: discoveryNonEnabledNetworksCount,
      unknownCount: 0,
      highPriorityCount: discoveryNonEnabledNetworksCount
    }
  };

  return kpiDefinitions.map((definition) => ({
    id: definition.id,
    displayOrder: definition.displayOrder,
    name: definition.name,
    description: definition.description,
    successMeasure: definition.successMeasure,
    calculationKey: definition.calculationKey,
    reportAvailable: definition.reportAvailable,
    ...calculations[definition.calculationKey]
  }));
}

export function buildSpiRows(analytics: AnalyticsResult, spiDefinitions: SpiDefinition[]): SpiRow[] {
  return spiDefinitions.map((definition) => {
    const spiId = definition.spiId;
    const statuses = analytics.evaluations.flatMap((assetEvaluation) =>
      assetEvaluation.evaluations.filter((evaluation) => evaluation.spiId === spiId).map((evaluation) => evaluation.status)
    );

    const compliant = statuses.filter((status) => status === "Compliant").length;
    const nonCompliant = statuses.filter((status) => status === "Non-compliant").length;
    const unknown = statuses.filter((status) => status === "Unknown").length;
    const total = statuses.length;

    return {
      spiId,
      displayOrder: definition.displayOrder,
      name: definition.name,
      description: definition.description,
      successMeasure: definition.successMeasure,
      reportAvailable: definition.reportAvailable,
      trendReportAvailable: definition.trendReportAvailable,
      reportDetailKey: definition.reportDetailKey,
      scorePercent: toPercent(compliant, total),
      compliant,
      nonCompliant,
      unknown,
      total
    };
  });
}
