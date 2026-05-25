import { buildKpiRows } from "@/lib/measures";
import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { KpiDefinition } from "@/lib/kpi-definitions";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";
import { filterRealNetworks } from "@/lib/network-scope";
import { SPI_DESCRIPTIONS, SPI_IDS, SPI_NAMES, SPI_SUCCESS_MEASURES } from "@/lib/spi-metadata";
import {
  AnalyticsResult,
  Asset,
  AssetSpiEvaluation,
  CveVulnerabilityDetail,
  ComplianceStatus,
  Dataset,
  Filters,
  Finding,
  FindingSeverity,
  ICTSystem,
  ManagedNetwork,
  RollupCounts,
  SecurityDomain,
  SpiId
} from "@/lib/types";

export type PerformanceScopeType = "network" | "system";

export interface PerformanceStatusCounts {
  compliant: number;
  nonCompliant: number;
  unknown: number;
  total: number;
  scorePercent: number;
}

export interface PerformanceDiscoveryCounts {
  compliant: number;
  nonCompliant: number;
  other: number;
  total: number;
  scorePercent: number;
}

export interface PerformanceDomainEntityRow extends PerformanceStatusCounts {
  id: string;
  securityDomain: SecurityDomain;
  entityId: string;
  entityName: string;
}

export interface PerformanceKpiScore {
  id: string;
  name: string;
  score: string;
  scorePercent: number;
  compliantCount: number;
  applicableCount: number;
  nonCompliantCount: number;
  unknownCount: number;
  highPriorityCount: number;
}

export interface PerformanceKpiMatrixRow {
  id: string;
  securityDomain: SecurityDomain;
  entityId: string;
  entityName: string;
  kpis: PerformanceKpiScore[];
}

export interface PerformanceKpiColumn {
  id: string;
  name: string;
}

export interface PerformanceAffectedCiRow {
  assetId: string;
  assetName: string;
  assetIpAddress: string;
  assetType: string;
  assetChangeAssignmentGroup: string;
  assetIncidentAssignmentGroup: string;
  owner: string;
  totalCveVulnerabilities: number;
  cveVulnerabilities: CveVulnerabilityDetail[];
}

export interface PerformanceEntityDetails {
  scopeType: PerformanceScopeType;
  id: string;
  name: string;
  description: string;
  owner: string;
  supportEmail: string;
  serviceCatalogueUrl: string;
  atoNumber: string;
  diisUrl: string;
  grcUrl: string;
  classification?: string;
  missionCapabilities?: string;
  businessServices?: string;
  diisId?: string;
  apmNumber?: string;
  apmUrl?: string;
}

export interface PerformanceSpiScore extends PerformanceStatusCounts {
  spiId: SpiId;
  id: string;
  label: string;
  name: string;
  description: string;
  successMeasure: string;
  affectedCis: PerformanceAffectedCiRow[];
}

export interface PerformanceSpiMatrixRow {
  id: string;
  securityDomain: SecurityDomain;
  entityId: string;
  entityName: string;
  entityDetails: PerformanceEntityDetails;
  spis: PerformanceSpiScore[];
}

export interface PerformanceFindingDetail {
  id: string;
  title: string;
  severity: FindingSeverity;
  priorityRank: number;
  spiId: SpiId;
  spiLabel: string;
  entityId: string;
  entityName: string;
  securityDomain: SecurityDomain;
  assetId: string;
  assetName: string;
  openedDate: string;
  ageDays: number;
}

export interface PerformanceFindingAgeThresholdRow {
  id: string;
  label: string;
  thresholdDays: number;
  criticalExposureCount: number;
  highRiskCount: number;
  majorCount: number;
  moderateCount: number;
  dataGapCount: number;
  total: number;
  findings: PerformanceFindingDetail[];
}

export interface PerformanceFindingSpiRow {
  id: string;
  spiId: number;
  spiLabel: string;
  criticalExposureCount: number;
  highRiskCount: number;
  majorCount: number;
  moderateCount: number;
  dataGapCount: number;
  total: number;
  findings: PerformanceFindingDetail[];
}

export interface PerformanceDiscoveryGapAsset {
  assetId: string;
  assetName: string;
  assetType: string;
  entityId: string;
  entityName: string;
  securityDomain: SecurityDomain;
  gapType: "Non-compliant" | "Other";
}

export interface PerformanceDiscoveryGapRow extends PerformanceDiscoveryCounts {
  id: string;
  securityDomain: SecurityDomain;
  entityId: string;
  entityName: string;
  gapAssets: PerformanceDiscoveryGapAsset[];
}

export interface PerformanceModellingGapRow {
  id: string;
  entityId: string;
  entityName: string;
  securityDomain?: SecurityDomain;
  owner: string;
  status: "Not Modelled";
}

export interface PerformanceThroughputPoint {
  weekLabel: string;
  openedCount: number;
  closedCount: number;
  netChange: number;
}

export interface PerformanceReportSummary {
  complianceScorePercent: number;
  discoveryScorePercent: number;
  totalEntities: number;
  totalAssets: number;
  totalFindings: number;
  openFindings: number;
  notModelledCount: number;
  openedInWindow: number;
  closedInWindow: number;
}

export interface PerformanceReportModel {
  scopeType: PerformanceScopeType;
  scopeLabel: string;
  entityLabelSingular: string;
  entityLabelPlural: string;
  snapshotDate: string;
  asOfDate: string;
  filters: Filters;
  summary: PerformanceReportSummary;
  complianceStatusMix: PerformanceStatusCounts;
  discoveryStatusMix: PerformanceDiscoveryCounts;
  kpiColumns: PerformanceKpiColumn[];
  domainEntityRows: PerformanceDomainEntityRow[];
  kpiMatrixRows: PerformanceKpiMatrixRow[];
  spiMatrixRows: PerformanceSpiMatrixRow[];
  findingAgeThresholdRows: PerformanceFindingAgeThresholdRow[];
  findingSpiRows: PerformanceFindingSpiRow[];
  discoveryGapRows: PerformanceDiscoveryGapRow[];
  modellingGapRows: PerformanceModellingGapRow[];
  throughputRows: PerformanceThroughputPoint[];
}

interface BuildPerformanceReportModelParams {
  scopeType: PerformanceScopeType;
  dataset: Dataset;
  analytics: AnalyticsResult;
  filters: Filters;
  networks: ManagedNetwork[];
  systems: ICTSystem[];
  kpiDefinitions: KpiDefinition[];
  asOfDate?: string;
}

const severityOrder: FindingSeverity[] = ["Critical Exposure", "High Risk", "Major", "Moderate", "Data Gap"];
const ageThresholds = [30, 60, 90];

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseUtcDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatUtcDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function toFindingDateKey(timestamp?: string | null): string | null {
  if (!timestamp) {
    return null;
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return toUtcDateKey(parsed);
}

function differenceInWholeUtcDays(fromDate: Date, toDate: Date): number {
  const deltaMs = toDate.getTime() - fromDate.getTime();
  return Math.max(0, Math.floor(deltaMs / 86_400_000));
}

function signedDifferenceInWholeUtcDays(fromDate: Date, toDate: Date): number {
  const deltaMs = toDate.getTime() - fromDate.getTime();
  return Math.floor(deltaMs / 86_400_000);
}

function formatReportDate(dateKey: string): string {
  return parseUtcDateKey(dateKey).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function scorePercent(numerator: number, denominator: number): number {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;
}

function statusCounts(statuses: ComplianceStatus[]): PerformanceStatusCounts {
  const compliant = statuses.filter((status) => status === "Compliant").length;
  const nonCompliant = statuses.filter((status) => status === "Non-compliant").length;
  const unknown = statuses.filter((status) => status === "Unknown").length;
  const total = statuses.length;

  return {
    compliant,
    nonCompliant,
    unknown,
    total,
    scorePercent: scorePercent(compliant, total)
  };
}

function discoveryScore(counts: Omit<PerformanceDiscoveryCounts, "total" | "scorePercent">): PerformanceDiscoveryCounts {
  const total = counts.compliant + counts.nonCompliant + counts.other;
  return {
    ...counts,
    total,
    scorePercent: scorePercent(counts.compliant, total)
  };
}

function rollupCountsForEvaluations(evaluations: AssetSpiEvaluation[]): RollupCounts {
  const counts = statusCounts(evaluations.flatMap((evaluation) => evaluation.evaluations.map((item) => item.status)));
  return {
    compliant: counts.compliant,
    nonCompliant: counts.nonCompliant,
    unknown: counts.unknown,
    impactedAssets: new Set(evaluations.map((evaluation) => evaluation.assetId)).size
  };
}

function analyticsSubset(
  base: AnalyticsResult,
  evaluations: AssetSpiEvaluation[],
  findings: Finding[]
): AnalyticsResult {
  const counts = rollupCountsForEvaluations(evaluations);
  const total = counts.compliant + counts.nonCompliant + counts.unknown;

  return {
    ...base,
    evaluations,
    findings,
    networkRollups: [],
    systemRollups: [],
    environmentRollups: [],
    overallCompliancePercent: scorePercent(counts.compliant, total),
    statusTotals: counts,
    productionCriticalExposureAssetIds: findings
      .filter((finding) => finding.severity === "Critical Exposure")
      .map((finding) => finding.scope.assetId)
  };
}

function throughputWeekIndex(startDate: Date, dateKey: string, weeks: number): number {
  const date = parseUtcDateKey(dateKey);
  const diffDays = signedDifferenceInWholeUtcDays(startDate, date);
  if (diffDays < 0 || diffDays >= weeks * 7) {
    return -1;
  }
  return Math.floor(diffDays / 7);
}

export function buildPerformanceThroughput(findings: Finding[], endDateKey: string, weeks = 13): PerformanceThroughputPoint[] {
  const endDate = parseUtcDateKey(endDateKey);
  const startDate = addUtcDays(endDate, -(weeks * 7 - 1));
  const rows = Array.from({ length: weeks }, (_, index) => {
    const weekEndDate = addUtcDays(startDate, index * 7 + 6);
    return {
      weekLabel: formatUtcDay(weekEndDate),
      openedCount: 0,
      closedCount: 0,
      netChange: 0
    };
  });

  for (const finding of findings) {
    const openedDateKey = toFindingDateKey(finding.timestamp);
    if (openedDateKey) {
      const openedIndex = throughputWeekIndex(startDate, openedDateKey, weeks);
      if (openedIndex >= 0) {
        rows[openedIndex].openedCount += 1;
      }
    }

    const closedDateKey = toFindingDateKey(finding.closedTimestamp);
    if (closedDateKey) {
      const closedIndex = throughputWeekIndex(startDate, closedDateKey, weeks);
      if (closedIndex >= 0) {
        rows[closedIndex].closedCount += 1;
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    netChange: row.openedCount - row.closedCount
  }));
}

function severityCounts(findings: PerformanceFindingDetail[]) {
  const counts = {
    criticalExposureCount: 0,
    highRiskCount: 0,
    majorCount: 0,
    moderateCount: 0,
    dataGapCount: 0
  };

  for (const finding of findings) {
    if (finding.severity === "Critical Exposure") {
      counts.criticalExposureCount += 1;
    } else if (finding.severity === "High Risk") {
      counts.highRiskCount += 1;
    } else if (finding.severity === "Major") {
      counts.majorCount += 1;
    } else if (finding.severity === "Moderate") {
      counts.moderateCount += 1;
    } else {
      counts.dataGapCount += 1;
    }
  }

  return counts;
}

function sortByDomainAndEntity<T extends { securityDomain: SecurityDomain; entityName: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const domainOrder = a.securityDomain.localeCompare(b.securityDomain);
    return domainOrder !== 0 ? domainOrder : a.entityName.localeCompare(b.entityName);
  });
}

function groupKey(securityDomain: SecurityDomain, entityId: string): string {
  return `${securityDomain}::${entityId}`;
}

function scopeEntityId(scopeType: PerformanceScopeType, evaluation: AssetSpiEvaluation): string | null {
  return scopeType === "network" ? evaluation.networkId : evaluation.systemId;
}

function findingEntityId(scopeType: PerformanceScopeType, finding: Finding): string | null {
  return scopeType === "network" ? finding.scope.networkId : finding.scope.systemId;
}

function assetDisplayName(asset: Asset | undefined, fallbackId: string): string {
  return asset?.hostname || asset?.name || fallbackId;
}

function readRecordStringValue(
  source: Record<string, unknown> | undefined,
  candidateKeys: string[]
): string | null {
  if (!source) {
    return null;
  }

  const entries = Object.entries(source).map(([key, value]) => [key.toLowerCase(), value] as const);
  for (const candidateKey of candidateKeys) {
    const matched = entries.find(([key]) => key === candidateKey.toLowerCase());
    if (!matched || matched[1] === null || typeof matched[1] === "undefined") {
      continue;
    }
    const text = String(matched[1]).trim();
    if (text && text.toLowerCase() !== "null" && text.toLowerCase() !== "undefined") {
      return text;
    }
  }
  return null;
}

function resolveAssetIpAddress(asset: Asset | undefined): string {
  return (
    readRecordStringValue(asset as unknown as Record<string, unknown> | undefined, [
      "assetIpAddress",
      "ipAddress",
      "assetIp",
      "ip",
      "ipv4Address",
      "ipv4",
      "primaryIp",
      "ip_address"
    ]) ?? "Not available"
  );
}

function assetCveDetails(asset: Asset | undefined): CveVulnerabilityDetail[] {
  return (asset?.vulnerabilities ?? []).map((vulnerability) => ({
    cve: vulnerability.cve,
    description: vulnerability.description,
    remediationGuidance: vulnerability.remediationGuidance,
    criticality: vulnerability.criticality,
    exploitability: vulnerability.exploitability,
    capturedAt: vulnerability.capturedAt
  }));
}

function affectedCiOwner(asset: Asset | undefined, fallbackOwner: string): string {
  return (
    readRecordStringValue(asset as unknown as Record<string, unknown> | undefined, [
      "assetOwner",
      "owner",
      "serviceOwner"
    ]) ?? fallbackOwner
  );
}

function buildAffectedCiRows(
  evaluations: AssetSpiEvaluation[],
  spiId: SpiId,
  assetById: Map<string, Asset>,
  fallbackOwner: string
): PerformanceAffectedCiRow[] {
  return evaluations
    .filter((evaluation) =>
      evaluation.evaluations.some((item) => item.spiId === spiId && item.status === "Non-compliant")
    )
    .map((evaluation) => {
      const asset = assetById.get(evaluation.assetId);
      const cveVulnerabilities = assetCveDetails(asset);
      const assetRecord = asset as unknown as Record<string, unknown> | undefined;

      return {
        assetId: evaluation.assetId,
        assetName: assetDisplayName(asset, evaluation.assetId),
        assetIpAddress: resolveAssetIpAddress(asset),
        assetType: formatAssetTypeLabel(asset?.type ?? evaluation.assetType),
        assetChangeAssignmentGroup:
          readRecordStringValue(assetRecord, [
            "assetChangeAssignmentGroup",
            "changeAssignmentGroup",
            "changeGroup",
            "change_assignment_group"
          ]) ?? "Not assigned",
        assetIncidentAssignmentGroup:
          readRecordStringValue(assetRecord, [
            "assetIncidentAssignmentGroup",
            "incidentAssignmentGroup",
            "incidentGroup",
            "incident_assignment_group"
          ]) ?? "Not assigned",
        owner: affectedCiOwner(asset, fallbackOwner),
        totalCveVulnerabilities: cveVulnerabilities.length,
        cveVulnerabilities
      };
    })
    .sort((a, b) => {
      if (b.totalCveVulnerabilities !== a.totalCveVulnerabilities) {
        return b.totalCveVulnerabilities - a.totalCveVulnerabilities;
      }
      return a.assetName.localeCompare(b.assetName);
    });
}

function fallbackSystemDescription(system: ICTSystem): string {
  if (system.description?.trim()) {
    return system.description.trim();
  }

  const missionSummary =
    system.missionCapabilities.map((capability) => capability.name).join(", ") || "assigned mission capabilities";
  const serviceSummary =
    system.businessServices.map((service) => service.name).join(", ") || "assigned business services";

  return `${system.name} is a ${system.criticality.toLowerCase()} ICT system in the ${system.securityDomain} domain supporting ${missionSummary} and ${serviceSummary}.`;
}

function fallbackSystemOwner(system: ICTSystem): string {
  return system.owner?.trim() || `${system.name} Operations Team`;
}

function fallbackSystemDiisId(system: ICTSystem): string {
  return system.diisId?.trim() || `DIIS-${system.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`;
}

function fallbackSystemSupportEmail(system: ICTSystem): string {
  return system.supportEmail?.trim() || `ict-support+${system.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}@tsaat.local`;
}

function fallbackSystemServiceCatalogueUrl(system: ICTSystem): string {
  return system.serviceCatalogueUrl?.trim() || `/systems/${system.id}`;
}

function fallbackSystemAtoNumber(system: ICTSystem): string {
  return system.atoNumber?.trim() || `ATO-${system.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`;
}

function fallbackSystemDiisUrl(system: ICTSystem): string {
  return system.diisUrl?.trim() || `https://diis.defence.gov.au/systems/${encodeURIComponent(system.id)}`;
}

function fallbackSystemGrcUrl(system: ICTSystem, atoNumber: string): string {
  return system.grcUrl?.trim() || `https://grc.defence.gov.au/ato/${encodeURIComponent(atoNumber)}`;
}

function fallbackSystemApmNumber(system: ICTSystem): string {
  return system.apmNumber?.trim() || `APM-${system.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`;
}

function fallbackSystemApmUrl(system: ICTSystem, apmNumber: string): string {
  return `https://apm.defence.gov.au/applications/${encodeURIComponent(apmNumber)}`;
}

function networkEntityDetails(network: ManagedNetwork): PerformanceEntityDetails {
  const detailFields = resolveNetworkDetailFields(network);
  return {
    scopeType: "network",
    id: network.id,
    name: network.name,
    classification: network.classification ?? "-",
    description: detailFields.description,
    owner: detailFields.owner,
    supportEmail: detailFields.supportEmail,
    serviceCatalogueUrl: detailFields.serviceCatalogueUrl,
    atoNumber: detailFields.atoNumber,
    diisUrl: detailFields.diisUrl,
    grcUrl: detailFields.grcUrl
  };
}

function systemEntityDetails(system: ICTSystem): PerformanceEntityDetails {
  const atoNumber = fallbackSystemAtoNumber(system);
  const apmNumber = fallbackSystemApmNumber(system);
  return {
    scopeType: "system",
    id: system.id,
    name: system.name,
    description: fallbackSystemDescription(system),
    missionCapabilities: system.missionCapabilities.map((capability) => capability.name).join(", ") || "-",
    businessServices: system.businessServices.map((service) => service.name).join(", ") || "-",
    owner: fallbackSystemOwner(system),
    supportEmail: fallbackSystemSupportEmail(system),
    serviceCatalogueUrl: fallbackSystemServiceCatalogueUrl(system),
    atoNumber,
    diisId: fallbackSystemDiisId(system),
    diisUrl: fallbackSystemDiisUrl(system),
    grcUrl: fallbackSystemGrcUrl(system, atoNumber),
    apmNumber,
    apmUrl: fallbackSystemApmUrl(system, apmNumber)
  };
}

export function buildPerformanceReportModel({
  scopeType,
  dataset,
  analytics,
  filters,
  networks,
  systems,
  kpiDefinitions,
  asOfDate = dataset.snapshotDate
}: BuildPerformanceReportModelParams): PerformanceReportModel {
  const entityLabelSingular = scopeType === "network" ? "Network" : "ICT System";
  const entityLabelPlural = scopeType === "network" ? "Networks" : "ICT Systems";
  const scopeLabel = scopeType === "network" ? "Network" : "ICT System";
  const scopedNetworks = filterRealNetworks(networks);
  const scopedSystems = systems;
  const entityRows =
    scopeType === "network"
      ? scopedNetworks.map((network) => ({
          id: network.id,
          name: network.name,
          owner: network.owner?.trim() || "Not assigned",
          modellingStatus: network.modellingStatus,
          securityDomain: undefined as SecurityDomain | undefined
        }))
      : scopedSystems.map((system) => ({
          id: system.id,
          name: system.name,
          owner: system.owner?.trim() || "Not assigned",
          modellingStatus: system.modellingStatus,
          securityDomain: system.securityDomain
        }));
  const entityById = new Map(entityRows.map((entity) => [entity.id, entity]));
  const entityDetailsById = new Map<string, PerformanceEntityDetails>(
    scopeType === "network"
      ? scopedNetworks.map((network) => [network.id, networkEntityDetails(network)])
      : scopedSystems.map((system) => [system.id, systemEntityDetails(system)])
  );
  const entityIds = new Set(entityRows.map((entity) => entity.id));
  const assetById = new Map(dataset.assets.map((asset) => [asset.id, asset]));

  const scopedEvaluations = analytics.evaluations.filter((evaluation) => {
    const entityId = scopeEntityId(scopeType, evaluation);
    return Boolean(entityId) && entityIds.has(entityId as string);
  });
  const scopedAssetIds = new Set(scopedEvaluations.map((evaluation) => evaluation.assetId));
  const scopedFindings = analytics.findings.filter((finding) => {
    const entityId = findingEntityId(scopeType, finding);
    return Boolean(entityId) && entityIds.has(entityId as string) && scopedAssetIds.has(finding.scope.assetId);
  });

  const groupedEvaluations = new Map<string, AssetSpiEvaluation[]>();
  for (const evaluation of scopedEvaluations) {
    const entityId = scopeEntityId(scopeType, evaluation);
    if (!entityId) {
      continue;
    }
    const key = groupKey(evaluation.securityDomain, entityId);
    groupedEvaluations.set(key, [...(groupedEvaluations.get(key) ?? []), evaluation]);
  }

  const domainEntityRows = sortByDomainAndEntity(
    Array.from(groupedEvaluations.entries()).map(([key, evaluations]) => {
      const [securityDomain, entityId] = key.split("::") as [SecurityDomain, string];
      const entity = entityById.get(entityId);
      const counts = statusCounts(evaluations.flatMap((evaluation) => evaluation.evaluations.map((item) => item.status)));
      return {
        id: key,
        securityDomain,
        entityId,
        entityName: entity?.name ?? entityId,
        ...counts
      };
    })
  );

  const kpiMatrixRows = domainEntityRows.map((row) => {
    const evaluations = groupedEvaluations.get(row.id) ?? [];
    const rowAssetIds = new Set(evaluations.map((evaluation) => evaluation.assetId));
    const findings = scopedFindings.filter((finding) => rowAssetIds.has(finding.scope.assetId));
    const rowAnalytics = analyticsSubset(analytics, evaluations, findings);
    const rowSystems =
      scopeType === "system"
        ? scopedSystems.filter((system) => system.id === row.entityId)
        : scopedSystems.filter((system) => system.networkId === row.entityId);
    const rowNetworks =
      scopeType === "network"
        ? scopedNetworks.filter((network) => network.id === row.entityId)
        : scopedNetworks.filter((network) => rowSystems.some((system) => system.networkId === network.id));

    return {
      id: row.id,
      securityDomain: row.securityDomain,
      entityId: row.entityId,
      entityName: row.entityName,
      kpis: buildKpiRows(rowAnalytics, rowSystems, rowNetworks, kpiDefinitions).map((kpi) => ({
        id: kpi.id,
        name: kpi.name,
        score: kpi.score,
        scorePercent: kpi.scorePercent,
        compliantCount: kpi.compliantCount,
        applicableCount: kpi.applicableCount,
        nonCompliantCount: kpi.nonCompliantCount,
        unknownCount: kpi.unknownCount,
        highPriorityCount: kpi.highPriorityCount
      }))
    };
  });

  const spiMatrixRows = domainEntityRows.map((row) => {
    const evaluations = groupedEvaluations.get(row.id) ?? [];

    return {
      id: row.id,
      securityDomain: row.securityDomain,
      entityId: row.entityId,
      entityName: row.entityName,
      entityDetails:
        entityDetailsById.get(row.entityId) ??
        ({
          scopeType,
          id: row.entityId,
          name: row.entityName,
          description: "No entity details available.",
          owner: "Not assigned",
          supportEmail: "Not assigned",
          serviceCatalogueUrl: scopeType === "network" ? `/networks/${row.entityId}` : `/systems/${row.entityId}`,
          atoNumber: "-",
          diisUrl: "#",
          grcUrl: "#"
        } satisfies PerformanceEntityDetails),
      spis: SPI_IDS.map((spiId) => {
        const counts = statusCounts(
          evaluations.flatMap((evaluation) =>
            evaluation.evaluations
              .filter((item) => item.spiId === spiId)
              .map((item) => item.status)
          )
        );

        return {
          spiId,
          id: `SPI-${spiId}`,
          label: `SPI ${spiId}`,
          name: SPI_NAMES[spiId],
          description: SPI_DESCRIPTIONS[spiId],
          successMeasure: SPI_SUCCESS_MEASURES[spiId],
          affectedCis: buildAffectedCiRows(
            evaluations,
            spiId,
            assetById,
            entityDetailsById.get(row.entityId)?.owner ?? "Not assigned"
          ),
          ...counts
        };
      })
    };
  });

  const discoveryGapRows = sortByDomainAndEntity(
    Array.from(groupedEvaluations.entries()).map(([key, evaluations]) => {
      const [securityDomain, entityId] = key.split("::") as [SecurityDomain, string];
      const entity = entityById.get(entityId);
      const counts = { compliant: 0, nonCompliant: 0, other: 0 };
      const gapAssets: PerformanceDiscoveryGapAsset[] = [];

      for (const evaluation of evaluations) {
        const asset = assetById.get(evaluation.assetId);
        const isOther =
          asset?.lifecycle.eolStatus === "Unknown" || asset?.lifecycle.warrantyStatus === "Unknown";

        if (isOther) {
          counts.other += 1;
          gapAssets.push({
            assetId: evaluation.assetId,
            assetName: assetDisplayName(asset, evaluation.assetId),
            assetType: asset?.type ?? evaluation.assetType,
            entityId,
            entityName: entity?.name ?? entityId,
            securityDomain,
            gapType: "Other"
          });
        } else if (evaluation.discoveryCoverageCompliant) {
          counts.compliant += 1;
        } else {
          counts.nonCompliant += 1;
          gapAssets.push({
            assetId: evaluation.assetId,
            assetName: assetDisplayName(asset, evaluation.assetId),
            assetType: asset?.type ?? evaluation.assetType,
            entityId,
            entityName: entity?.name ?? entityId,
            securityDomain,
            gapType: "Non-compliant"
          });
        }
      }

      return {
        id: key,
        securityDomain,
        entityId,
        entityName: entity?.name ?? entityId,
        ...discoveryScore(counts),
        gapAssets
      };
    })
  );

  const securityDomainByAssetId = new Map(
    scopedEvaluations.map((evaluation) => [evaluation.assetId, evaluation.securityDomain] as const)
  );
  const openFindings = scopedFindings.filter((finding) => finding.status === "open");
  const today = parseUtcDateKey(asOfDate);
  const findingDetails = openFindings
    .map((finding) => {
      const entityId = findingEntityId(scopeType, finding);
      const openedDateKey = toFindingDateKey(finding.timestamp);
      const securityDomain = securityDomainByAssetId.get(finding.scope.assetId);
      if (!entityId || !openedDateKey || !securityDomain) {
        return null;
      }
      const asset = assetById.get(finding.scope.assetId);
      return {
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        priorityRank: finding.priorityRank,
        spiId: finding.spiId,
        spiLabel: `SPI ${finding.spiId}`,
        entityId,
        entityName: entityById.get(entityId)?.name ?? entityId,
        securityDomain,
        assetId: finding.scope.assetId,
        assetName: assetDisplayName(asset, finding.scope.assetId),
        openedDate: formatReportDate(openedDateKey),
        ageDays: differenceInWholeUtcDays(parseUtcDateKey(openedDateKey), today)
      };
    })
    .filter((finding): finding is PerformanceFindingDetail => Boolean(finding));

  const findingAgeThresholdRows = ageThresholds.map((thresholdDays) => {
    const findings = findingDetails
      .filter((finding) => finding.ageDays > thresholdDays)
      .sort((a, b) => b.ageDays - a.ageDays || a.id.localeCompare(b.id));
    return {
      id: `age-${thresholdDays}`,
      label: `>${thresholdDays}d`,
      thresholdDays,
      ...severityCounts(findings),
      total: findings.length,
      findings
    };
  });

  const findingSpiRows = SPI_IDS.map((spiId) => {
    const findings = findingDetails
      .filter((finding) => finding.spiId === spiId)
      .sort((a, b) => b.ageDays - a.ageDays || a.id.localeCompare(b.id));
    return {
      id: `spi-${spiId}`,
      spiId,
      spiLabel: `SPI ${spiId}`,
      ...severityCounts(findings),
      total: findings.length,
      findings
    };
  }).filter((row) => row.total > 0);

  const modellingGapRows = entityRows
    .filter((entity) => !entity.modellingStatus)
    .map((entity) => ({
      id: `model-${entity.id}`,
      entityId: entity.id,
      entityName: entity.name,
      securityDomain: entity.securityDomain,
      owner: entity.owner,
      status: "Not Modelled" as const
    }))
    .sort((a, b) => a.entityName.localeCompare(b.entityName));

  const throughputRows = buildPerformanceThroughput(scopedFindings, asOfDate, 13);
  const complianceStatusMix = statusCounts(
    scopedEvaluations.flatMap((evaluation) => evaluation.evaluations.map((item) => item.status))
  );
  const discoveryStatusMix = discoveryScore(
    scopedEvaluations.reduce(
      (accumulator, evaluation) => {
        const asset = assetById.get(evaluation.assetId);
        const isOther =
          asset?.lifecycle.eolStatus === "Unknown" || asset?.lifecycle.warrantyStatus === "Unknown";
        if (isOther) {
          accumulator.other += 1;
        } else if (evaluation.discoveryCoverageCompliant) {
          accumulator.compliant += 1;
        } else {
          accumulator.nonCompliant += 1;
        }
        return accumulator;
      },
      { compliant: 0, nonCompliant: 0, other: 0 }
    )
  );

  return {
    scopeType,
    scopeLabel,
    entityLabelSingular,
    entityLabelPlural,
    snapshotDate: dataset.snapshotDate,
    asOfDate,
    filters,
    summary: {
      complianceScorePercent: complianceStatusMix.scorePercent,
      discoveryScorePercent: discoveryStatusMix.scorePercent,
      totalEntities: entityRows.length,
      totalAssets: scopedAssetIds.size,
      totalFindings: scopedFindings.length,
      openFindings: openFindings.length,
      notModelledCount: modellingGapRows.length,
      openedInWindow: throughputRows.reduce((total, row) => total + row.openedCount, 0),
      closedInWindow: throughputRows.reduce((total, row) => total + row.closedCount, 0)
    },
    complianceStatusMix,
    discoveryStatusMix,
    kpiColumns: kpiDefinitions.map((definition) => ({
      id: definition.id,
      name: definition.name
    })),
    domainEntityRows,
    kpiMatrixRows,
    spiMatrixRows,
    findingAgeThresholdRows,
    findingSpiRows,
    discoveryGapRows,
    modellingGapRows,
    throughputRows
  };
}

export function buildNetworkPerformanceReportModel(
  params: Omit<BuildPerformanceReportModelParams, "scopeType">
): PerformanceReportModel {
  return buildPerformanceReportModel({ ...params, scopeType: "network" });
}

export function buildSystemPerformanceReportModel(
  params: Omit<BuildPerformanceReportModelParams, "scopeType">
): PerformanceReportModel {
  return buildPerformanceReportModel({ ...params, scopeType: "system" });
}

export function performanceSeverityTotal(row: {
  criticalExposureCount: number;
  highRiskCount: number;
  majorCount: number;
  moderateCount: number;
  dataGapCount: number;
}): number {
  return severityOrder.reduce((total, severity) => {
    if (severity === "Critical Exposure") {
      return total + row.criticalExposureCount;
    }
    if (severity === "High Risk") {
      return total + row.highRiskCount;
    }
    if (severity === "Major") {
      return total + row.majorCount;
    }
    if (severity === "Moderate") {
      return total + row.moderateCount;
    }
    return total + row.dataGapCount;
  }, 0);
}
