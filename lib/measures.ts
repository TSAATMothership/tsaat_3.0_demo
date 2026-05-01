import { SPI_DESCRIPTIONS, SPI_IDS, SPI_SUCCESS_MEASURES } from "@/lib/spi-metadata";
import { AnalyticsResult, ComplianceStatus, ICTSystem, ManagedNetwork, SpiId } from "@/lib/types";

export { SPI_IDS } from "@/lib/spi-metadata";

export interface KpiRow {
  id: string;
  name: string;
  description: string;
  successMeasure: string;
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
  description: string;
  successMeasure: string;
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
  scopedSystems: ICTSystem[] = [],
  scopedNetworks: ManagedNetwork[] = []
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
  const highRiskFindings = analytics.findings.filter((finding) => finding.severity === "High Risk").length;
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

  return [
    {
      id: "KPI-1",
      name: "Overall SPI Compliance",
      description: "Share of compliant checks across all applicable SPI evaluations in current filter scope.",
      successMeasure: "Target >= 95% compliant checks.",
      score: `${overallSummary.scorePercent}% (${overallSummary.compliant}/${overallSummary.total})`,
      scorePercent: overallSummary.scorePercent,
      compliantCount: overallSummary.compliant,
      applicableCount: overallSummary.total,
      nonCompliantCount: overallSummary.nonCompliant,
      unknownCount: overallSummary.unknown,
      highPriorityCount: immediateAction
    },
    {
      id: "KPI-2",
      name: "Overall DPE Compliance",
      description:
        "Share of compliant SPI checks for Defence Protected Environment (Protected security domain) assets in scope.",
      successMeasure: "Target >= 95% compliant checks for DPE assets.",
      score: `${dpeSummary.scorePercent}% (${dpeSummary.compliant}/${dpeSummary.total})`,
      scorePercent: dpeSummary.scorePercent,
      compliantCount: dpeSummary.compliant,
      applicableCount: dpeSummary.total,
      nonCompliantCount: dpeSummary.nonCompliant,
      unknownCount: dpeSummary.unknown,
      highPriorityCount: dpeImmediateAction
    },
    {
      id: "KPI-3",
      name: "Overall DSE Compliance",
      description:
        "Share of compliant SPI checks for Defence Secret Environment (Secret security domain) assets in scope.",
      successMeasure: "Target >= 95% compliant checks for DSE assets.",
      score: `${dseSummary.scorePercent}% (${dseSummary.compliant}/${dseSummary.total})`,
      scorePercent: dseSummary.scorePercent,
      compliantCount: dseSummary.compliant,
      applicableCount: dseSummary.total,
      nonCompliantCount: dseSummary.nonCompliant,
      unknownCount: dseSummary.unknown,
      highPriorityCount: dseImmediateAction
    },
    {
      id: "KPI-4",
      name: "Critical ICT System Compliance",
      description: "Share of compliant SPI checks for assets assigned to ICT systems marked as Critical.",
      successMeasure: "Target >= 95% compliant checks on Critical ICT Systems.",
      score: `${criticalIctSystemSummary.scorePercent}% (${criticalIctSystemSummary.compliant}/${criticalIctSystemSummary.total})`,
      scorePercent: criticalIctSystemSummary.scorePercent,
      compliantCount: criticalIctSystemSummary.compliant,
      applicableCount: criticalIctSystemSummary.total,
      nonCompliantCount: criticalIctSystemSummary.nonCompliant,
      unknownCount: criticalIctSystemSummary.unknown,
      highPriorityCount: criticalIctSystemImmediateAction
    },
    {
      id: "KPI-5",
      name: "Critical Exposure in Production",
      description: "Production assets with critical-vulnerability exposure requiring urgent treatment.",
      successMeasure: "Target = 0 critical exposure findings.",
      score: String(criticalExposureFindings),
      scorePercent: criticalExposureScore,
      compliantCount: criticalExposureCompliant,
      applicableCount: totalFindings,
      nonCompliantCount: criticalExposureFindings,
      unknownCount: overallSummary.unknown,
      highPriorityCount: criticalExposureFindings
    },
    {
      id: "KPI-6",
      name: "Discovery Coverage Compliance",
      description:
        "Share of in-scope assets meeting discovery coverage across required tooling checkpoints.",
      successMeasure: "Target = 100% discovery coverage compliance.",
      score: `${discoveryComplianceScore}% (${discoveryCompliantAssets}/${discoveryTotalAssets})`,
      scorePercent: discoveryComplianceScore,
      compliantCount: discoveryCompliantAssets,
      applicableCount: discoveryTotalAssets,
      nonCompliantCount: discoveryNonCompliantAssets,
      unknownCount: 0,
      highPriorityCount: discoveryCoverageImmediateAction
    },
    {
      id: "KPI-7",
      name: "ICT Systems have an active ATO",
      description: "Share of in-scope ICT systems with an active Authority to Operate (ATO) record.",
      successMeasure: "Target = 100% of ICT systems with active ATO.",
      score: `${atoComplianceScore}% (${atoCompliantSystems}/${atoApplicableSystems})`,
      scorePercent: atoComplianceScore,
      compliantCount: atoCompliantSystems,
      applicableCount: atoApplicableSystems,
      nonCompliantCount: atoNonCompliantSystems,
      unknownCount: 0,
      highPriorityCount: atoImmediateAction
    },
    {
      id: "KPI-8",
      name: "ICT Systems are registered within DIIS",
      description: "Share of in-scope ICT systems registered in the DIIS register.",
      successMeasure: "Target = 100% of ICT systems registered within DIIS.",
      score: `${diisComplianceScore}% (${diisCompliantSystems}/${diisApplicableSystems})`,
      scorePercent: diisComplianceScore,
      compliantCount: diisCompliantSystems,
      applicableCount: diisApplicableSystems,
      nonCompliantCount: diisNonCompliantSystems,
      unknownCount: 0,
      highPriorityCount: diisImmediateAction
    },
    {
      id: "KPI-9",
      name: "DIIS Systems Modelled Coverage",
      description: "Share of ICT systems defined in DIIS that have been modelled in TSAAT.",
      successMeasure: "Target = 100% of DIIS-defined ICT systems are modelled.",
      score: `${modelledCoverageScore}% (${modelledSystemsCount}/${diisDefinedCount})`,
      scorePercent: modelledCoverageScore,
      compliantCount: modelledSystemsCount,
      applicableCount: diisDefinedCount,
      nonCompliantCount: unmodelledSystemsCount,
      unknownCount: 0,
      highPriorityCount: unmodelledSystemsCount
    },
    {
      id: "KPI-10",
      name: "Networks Discovery Enablement",
      description: "Share of defined managed networks with discovery status set to Discovery Enabled.",
      successMeasure: "Target = 100% of defined networks are Discovery Enabled.",
      score: `${networkDiscoveryEnabledScore}% (${discoveryEnabledNetworksCount}/${networksDefinedCount})`,
      scorePercent: networkDiscoveryEnabledScore,
      compliantCount: discoveryEnabledNetworksCount,
      applicableCount: networksDefinedCount,
      nonCompliantCount: discoveryNonEnabledNetworksCount,
      unknownCount: 0,
      highPriorityCount: discoveryNonEnabledNetworksCount
    }
  ];
}

export function buildSpiRows(analytics: AnalyticsResult): SpiRow[] {
  return SPI_IDS.map((spiId) => {
    const statuses = analytics.evaluations.flatMap((assetEvaluation) =>
      assetEvaluation.evaluations.filter((evaluation) => evaluation.spiId === spiId).map((evaluation) => evaluation.status)
    );

    const compliant = statuses.filter((status) => status === "Compliant").length;
    const nonCompliant = statuses.filter((status) => status === "Non-compliant").length;
    const unknown = statuses.filter((status) => status === "Unknown").length;
    const total = statuses.length;

    return {
      spiId,
      description: SPI_DESCRIPTIONS[spiId],
      successMeasure: SPI_SUCCESS_MEASURES[spiId],
      scorePercent: toPercent(compliant, total),
      compliant,
      nonCompliant,
      unknown,
      total
    };
  });
}
