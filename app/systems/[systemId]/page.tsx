import Link from "next/link";
import { notFound } from "next/navigation";
import { MiniTrendSparkline } from "@/components/mini-trend-sparkline";
import { PostureBadge } from "@/components/posture-badge";
import { ServerStreamHint } from "@/components/server-stream-hint";
import { buildAnalytics } from "@/lib/analytics";
import {
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadLatestSnapshotsForDate,
  loadMeasuresSettings
} from "@/lib/data-loader";
import { DiscoveryCoverageValue, evaluateDiscoveryCoverage } from "@/lib/discovery-coverage";
import { extractDataDateParam, withDataDate } from "@/lib/data-date";
import { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { MeasuresSettings } from "@/lib/measures-settings";
import { paginate, parsePageState } from "@/lib/pagination";
import { Asset, ComplianceStatus, Dataset, EnvironmentType, Finding } from "@/lib/types";
import { Suspense } from "react";

type KpiFilterKey =
  | "nonCompliantServers"
  | "nonCompliantOs"
  | "nonCompliantEnvironments"
  | "p12Findings"
  | "highRiskP12Findings"
  | "outOfWarrantyAssets"
  | "nonCompliantDiscoveryCoverage";

const KPI_FILTER_LABELS: Record<KpiFilterKey, string> = {
  nonCompliantServers: "Total Non-compliant Servers",
  nonCompliantOs: "Total Non-compliant OS",
  nonCompliantEnvironments: "Total Non-compliant Environments",
  p12Findings: "Total P1-P2 Findings",
  highRiskP12Findings: "Total P1-P2 High Risk Findings",
  outOfWarrantyAssets: "Total Physical Assets Out of Warranty",
  nonCompliantDiscoveryCoverage: "Assets non-compliant with discovery coverage"
};

function isKpiFilterKey(value: string | undefined): value is KpiFilterKey {
  if (!value) {
    return false;
  }
  return value in KPI_FILTER_LABELS;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function findingMatchesSearch(finding: Finding, normalizedSearchTerm: string) {
  if (!normalizedSearchTerm) {
    return true;
  }

  const evidenceText = Object.entries(finding.evidence)
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(" ");

  const text = [
    finding.id,
    `SPI ${finding.spiId}`,
    `P${finding.priorityRank}`,
    finding.severity,
    finding.status,
    finding.complianceStatus,
    finding.timestamp,
    finding.title,
    finding.recommendedAction,
    finding.scope.networkId,
    finding.scope.systemId ?? "",
    finding.scope.environmentType ?? "",
    finding.scope.assetId,
    evidenceText
  ]
    .join(" ")
    .toLowerCase();

  return text.includes(normalizedSearchTerm);
}

function complianceScore(statuses: ComplianceStatus[]): number {
  if (!statuses.length) {
    return 0;
  }
  const compliant = statuses.filter((status) => status === "Compliant").length;
  return Number(((compliant / statuses.length) * 100).toFixed(1));
}

function overallStatusFromStatuses(statuses: ComplianceStatus[]): ComplianceStatus {
  if (!statuses.length) {
    return "Unknown";
  }
  if (statuses.some((status) => status === "Non-compliant")) {
    return "Non-compliant";
  }
  if (statuses.some((status) => status === "Unknown")) {
    return "Unknown";
  }
  return "Compliant";
}

function patchLevelLabel(nMinus: number | null): string {
  if (nMinus === null) {
    return "Unknown";
  }
  if (nMinus <= 0) {
    return "N";
  }
  if (nMinus === 1) {
    return "N-1";
  }
  if (nMinus === 2) {
    return "N-2";
  }
  return `N-${nMinus}`;
}

function n2PlusStatusLabel(nMinus: number | null): string {
  if (nMinus === null) {
    return "Unknown";
  }
  return nMinus <= 2 ? "Within N-2+" : "Outside N-2+";
}

function coverageFlag(value: DiscoveryCoverageValue | undefined): number {
  return value === 0 ? 0 : 1;
}

function discoveryCoverageForAsset(asset: Asset, discoveryToolsSettings: DiscoveryToolsSettings) {
  const coverage = evaluateDiscoveryCoverage(asset, discoveryToolsSettings);
  const ucmdb = coverageFlag(coverage.toolValues.ucmdb);
  const tanium = coverageFlag(coverage.toolValues.tanium);
  const tenable = coverageFlag(coverage.toolValues.tenable);
  const snow = coverageFlag(coverage.toolValues.snow);
  const seviceNow = coverageFlag(coverage.toolValues.servicenow ?? coverage.toolValues["service-now"]);
  const dsocSiem = coverageFlag(coverage.toolValues["dsoc-siem"] ?? coverage.toolValues.siem);
  const elastic = coverageFlag(coverage.toolValues.elastic);

  return {
    ucmdb,
    tanium,
    tenable,
    snow,
    seviceNow,
    dsocSiem,
    elastic,
    coverageCompliance: coverage.coverageCompliance
  };
}

interface SystemKpiSnapshotMetrics {
  nonCompliantServers: number;
  nonCompliantOs: number;
  nonCompliantEnvironments: number;
  p12Findings: number;
  highRiskP12Findings: number;
  outOfWarrantyAssets: number;
  nonCompliantDiscoveryCoverage: number;
}

function buildSystemKpiSnapshotMetrics(
  snapshot: Dataset,
  systemId: string,
  selectedEnvironment: EnvironmentType | undefined,
  serverSearchTerm: string,
  measuresSettings: MeasuresSettings,
  discoveryToolsSettings: DiscoveryToolsSettings
): SystemKpiSnapshotMetrics {
  const system = snapshot.ictSystems.find((item) => item.id === systemId);
  if (!system) {
    return {
      nonCompliantServers: 0,
      nonCompliantOs: 0,
      nonCompliantEnvironments: 0,
      p12Findings: 0,
      highRiskP12Findings: 0,
      outOfWarrantyAssets: 0,
      nonCompliantDiscoveryCoverage: 0
    };
  }

  const analytics = buildAnalytics(
    snapshot,
    snapshot.ictSystems,
    { ictSystem: systemId },
    measuresSettings,
    discoveryToolsSettings
  );
  const assets = snapshot.assets.filter((asset) => asset.systemContext?.systemId === systemId);
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const p12Findings = analytics.findings.filter((finding) => finding.priorityRank <= 2);

  const normalizedServerSearchTerm = serverSearchTerm.trim().toLowerCase();
  const searchMatchedAssets = normalizedServerSearchTerm
    ? assets.filter((asset) => {
        if (asset.type !== "server") {
          return false;
        }
        return (
          asset.hostname.toLowerCase().includes(normalizedServerSearchTerm) ||
          asset.id.toLowerCase().includes(normalizedServerSearchTerm)
        );
      })
    : assets;

  const envInSnapshot =
    selectedEnvironment && system.environments.some((environment) => environment.type === selectedEnvironment)
      ? selectedEnvironment
      : undefined;

  const searchMatchedAssetIds = new Set(searchMatchedAssets.map((asset) => asset.id));
  const assetsInCountScope = envInSnapshot
    ? searchMatchedAssets.filter((asset) => asset.systemContext?.environmentType === envInSnapshot)
    : searchMatchedAssets;
  const assetsInCountScopeIds = new Set(assetsInCountScope.map((asset) => asset.id));

  const findingsInCountScope = p12Findings.filter((finding) => {
    if (!assetsInCountScopeIds.has(finding.scope.assetId)) {
      return false;
    }
    if (envInSnapshot && finding.scope.environmentType !== envInSnapshot) {
      return false;
    }
    return true;
  });

  const nonCompliantServers = assetsInCountScope.filter((asset) => {
    if (asset.type !== "server") {
      return false;
    }
    const evaluation = evaluationByAssetId.get(asset.id);
    if (!evaluation) {
      return false;
    }
    return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
  }).length;

  const nonCompliantOs = assetsInCountScope.filter((asset) => {
    if (asset.type !== "server" && asset.type !== "workstation") {
      return false;
    }
    const evaluation = evaluationByAssetId.get(asset.id);
    if (!evaluation) {
      return false;
    }
    return evaluation.evaluations.some(
      (evaluationItem) =>
        (evaluationItem.spiId === 1 || evaluationItem.spiId === 2) && evaluationItem.status === "Non-compliant"
    );
  }).length;

  const nonCompliantEnvironments = (envInSnapshot ? [envInSnapshot] : system.environments.map((env) => env.type))
    .filter((environmentType) => {
      const statuses = analytics.evaluations
        .filter(
          (evaluation) => evaluation.environmentType === environmentType && searchMatchedAssetIds.has(evaluation.assetId)
        )
        .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
      return overallStatusFromStatuses(statuses) === "Non-compliant";
    })
    .length;

  const highRiskP12Findings = findingsInCountScope.filter((finding) => finding.severity === "High Risk").length;
  const outOfWarrantyAssets = assetsInCountScope.filter(
    (asset) => asset.lifecycle.warrantyStatus === "OutOfWarranty"
  ).length;
  const nonCompliantDiscoveryCoverage = assetsInCountScope.filter(
    (asset) => !discoveryCoverageForAsset(asset, discoveryToolsSettings).coverageCompliance
  ).length;

  return {
    nonCompliantServers,
    nonCompliantOs,
    nonCompliantEnvironments,
    p12Findings: findingsInCountScope.length,
    highRiskP12Findings,
    outOfWarrantyAssets,
    nonCompliantDiscoveryCoverage
  };
}

function environmentCardsForScope(
  environments: Array<{ type: EnvironmentType }>,
  evaluations: Array<{
    assetId: string;
    environmentType: EnvironmentType | null;
    evaluations: Array<{ status: ComplianceStatus }>;
  }>,
  p12Findings: Finding[],
  scopedAssetIds: Set<string>,
  assetNameById: Map<string, string>
) {
  return environments.map((environment) => {
    const environmentEvaluations = evaluations.filter(
      (evaluation) => evaluation.environmentType === environment.type && scopedAssetIds.has(evaluation.assetId)
    );
    const statuses = environmentEvaluations.flatMap((evaluation) =>
      evaluation.evaluations.map((evaluationItem) => evaluationItem.status)
    );
    const environmentFindings = p12Findings.filter(
      (finding) => finding.scope.environmentType === environment.type && scopedAssetIds.has(finding.scope.assetId)
    );
    const affectedAssets = summarizeAffectedAssets(environmentFindings, assetNameById);

    return {
      type: environment.type,
      posture: overallStatusFromStatuses(statuses),
      complianceScore: complianceScore(statuses),
      assetCount: environmentEvaluations.length,
      findingCount: environmentFindings.length,
      affectedAssets
    };
  });
}

function summarizeAffectedAssets(
  findings: Finding[],
  assetNameById: Map<string, string>
): Array<{ assetId: string; hostname: string; p1: number; p2: number }> {
  const counts = findings.reduce((map, finding) => {
    const current = map.get(finding.scope.assetId) ?? { p1: 0, p2: 0 };
    if (finding.priorityRank === 1) {
      current.p1 += 1;
    }
    if (finding.priorityRank === 2) {
      current.p2 += 1;
    }
    map.set(finding.scope.assetId, current);
    return map;
  }, new Map<string, { p1: number; p2: number }>());

  return Array.from(counts.entries())
    .map(([assetId, count]) => ({
      assetId,
      hostname: assetNameById.get(assetId) ?? assetId,
      p1: count.p1,
      p2: count.p2
    }))
    .sort((a, b) => {
      const totalDiff = b.p1 + b.p2 - (a.p1 + a.p2);
      if (totalDiff !== 0) {
        return totalDiff;
      }
      return a.hostname.localeCompare(b.hostname);
    });
}

export default async function SystemDetailPage({
  params,
  searchParams
}: {
  params: { systemId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const requestParams = searchParams ?? {};
  const requestedDataDate = extractDataDateParam(requestParams);
  const [dataset, snapshots, measuresSettings, discoveryToolsSettings] = await Promise.all([
    loadDatasetForDate(requestedDataDate),
    loadLatestSnapshotsForDate(requestedDataDate, 12),
    loadMeasuresSettings(),
    loadDiscoveryToolsSettings()
  ]);
  const system = dataset.ictSystems.find((item) => item.id === params.systemId);

  if (!system) {
    notFound();
  }

  const analytics = buildAnalytics(
    dataset,
    dataset.ictSystems,
    { ictSystem: system.id },
    measuresSettings,
    discoveryToolsSettings
  );

  const assets = dataset.assets.filter((asset) => asset.systemContext?.systemId === system.id);
  const assetNameById = new Map(assets.map((asset) => [asset.id, asset.hostname]));
  const findings = analytics.findings;
  const p12Findings = findings.filter((finding) => finding.priorityRank <= 2);

  const requestedEnvironment = firstParam(requestParams.environment);
  const selectedEnvironment = system.environments.some((environment) => environment.type === requestedEnvironment)
    ? (requestedEnvironment as EnvironmentType)
    : undefined;
  const requestedKpiFilter = firstParam(requestParams.kpiFilter);
  const selectedKpiFilter = isKpiFilterKey(requestedKpiFilter) ? requestedKpiFilter : undefined;
  const requestedP12Spi = Number(firstParam(requestParams.p12Spi));
  const selectedP12Spi =
    Number.isInteger(requestedP12Spi) && requestedP12Spi >= 1 && requestedP12Spi <= 10 ? requestedP12Spi : undefined;
  const requestedP12Priority = Number(firstParam(requestParams.p12Priority));
  const selectedP12Priority =
    Number.isInteger(requestedP12Priority) && requestedP12Priority >= 1 ? requestedP12Priority : undefined;
  const selectedP12Severity = firstParam(requestParams.p12Severity)?.trim() || undefined;
  const selectedP12SearchTerm = firstParam(requestParams.p12Search)?.trim() ?? "";
  const normalizedP12SearchTerm = selectedP12SearchTerm.toLowerCase();

  const serverSearchTerm = firstParam(requestParams.serverSearch)?.trim() ?? "";
  const normalizedServerSearchTerm = serverSearchTerm.toLowerCase();
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));

  const searchMatchedAssets = normalizedServerSearchTerm
    ? assets.filter((asset) => {
        if (asset.type !== "server") {
          return false;
        }
        return (
          asset.hostname.toLowerCase().includes(normalizedServerSearchTerm) ||
          asset.id.toLowerCase().includes(normalizedServerSearchTerm)
        );
      })
    : assets;

  const searchMatchedAssetIds = new Set(searchMatchedAssets.map((asset) => asset.id));
  const searchMatchedFindings = p12Findings.filter((finding) => searchMatchedAssetIds.has(finding.scope.assetId));
  const searchMatchedP12AssetIds = new Set(searchMatchedFindings.map((finding) => finding.scope.assetId));
  const searchMatchedHighRiskP12AssetIds = new Set(
    searchMatchedFindings
      .filter((finding) => finding.severity === "High Risk")
      .map((finding) => finding.scope.assetId)
  );

  const environmentCardsBeforeKpi = environmentCardsForScope(
    system.environments,
    analytics.evaluations,
    p12Findings,
    searchMatchedAssetIds,
    assetNameById
  );
  const nonCompliantEnvironmentTypes = new Set(
    environmentCardsBeforeKpi
      .filter((environment) => environment.posture === "Non-compliant")
      .map((environment) => environment.type)
  );

  const matchesSelectedKpiFilter = (asset: (typeof assets)[number]): boolean => {
    if (!selectedKpiFilter) {
      return true;
    }
    if (selectedKpiFilter === "nonCompliantServers") {
      if (asset.type !== "server") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      if (!evaluation) {
        return false;
      }
      return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
    }
    if (selectedKpiFilter === "nonCompliantOs") {
      if (asset.type !== "server" && asset.type !== "workstation") {
        return false;
      }
      const evaluation = evaluationByAssetId.get(asset.id);
      if (!evaluation) {
        return false;
      }
      return evaluation.evaluations.some(
        (evaluationItem) =>
          (evaluationItem.spiId === 1 || evaluationItem.spiId === 2) && evaluationItem.status === "Non-compliant"
      );
    }
    if (selectedKpiFilter === "nonCompliantEnvironments") {
      const environmentType = asset.systemContext?.environmentType;
      return environmentType ? nonCompliantEnvironmentTypes.has(environmentType) : false;
    }
    if (selectedKpiFilter === "p12Findings") {
      return searchMatchedP12AssetIds.has(asset.id);
    }
    if (selectedKpiFilter === "highRiskP12Findings") {
      return searchMatchedHighRiskP12AssetIds.has(asset.id);
    }
    if (selectedKpiFilter === "outOfWarrantyAssets") {
      return asset.lifecycle.warrantyStatus === "OutOfWarranty";
    }
    if (selectedKpiFilter === "nonCompliantDiscoveryCoverage") {
      return !discoveryCoverageForAsset(asset, discoveryToolsSettings).coverageCompliance;
    }
    return true;
  };

  const kpiMatchedAssets = selectedKpiFilter
    ? searchMatchedAssets.filter((asset) => matchesSelectedKpiFilter(asset))
    : searchMatchedAssets;
  const kpiMatchedAssetIds = new Set(kpiMatchedAssets.map((asset) => asset.id));

  const environmentCards = environmentCardsForScope(
    system.environments,
    analytics.evaluations,
    p12Findings,
    kpiMatchedAssetIds,
    assetNameById
  );

  const selectedLabel = selectedEnvironment ?? "All Environments";
  const environmentCardsCountScope = selectedEnvironment
    ? environmentCardsBeforeKpi.filter((environment) => environment.type === selectedEnvironment)
    : environmentCardsBeforeKpi;

  const assetsInCountScope = selectedEnvironment
    ? searchMatchedAssets.filter((asset) => asset.systemContext?.environmentType === selectedEnvironment)
    : searchMatchedAssets;
  const assetsInCountScopeIds = new Set(assetsInCountScope.map((asset) => asset.id));
  const findingsInCountScope = p12Findings.filter((finding) => {
    if (!assetsInCountScopeIds.has(finding.scope.assetId)) {
      return false;
    }
    if (selectedEnvironment && finding.scope.environmentType !== selectedEnvironment) {
      return false;
    }
    return true;
  });

  const nonCompliantServerCount = assetsInCountScope.filter((asset) => {
    if (asset.type !== "server") {
      return false;
    }
    const evaluation = evaluationByAssetId.get(asset.id);
    if (!evaluation) {
      return false;
    }
    return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
  }).length;

  const nonCompliantOsCount = assetsInCountScope.filter((asset) => {
    if (asset.type !== "server" && asset.type !== "workstation") {
      return false;
    }
    const evaluation = evaluationByAssetId.get(asset.id);
    if (!evaluation) {
      return false;
    }
    return evaluation.evaluations.some(
      (evaluationItem) =>
        (evaluationItem.spiId === 1 || evaluationItem.spiId === 2) && evaluationItem.status === "Non-compliant"
    );
  }).length;

  const nonCompliantEnvironmentCount = environmentCardsCountScope.filter(
    (environment) => environment.posture === "Non-compliant"
  ).length;

  const highRiskP12Count = findingsInCountScope.filter((finding) => finding.severity === "High Risk").length;

  const outOfWarrantyAssetCount = assetsInCountScope.filter(
    (asset) => asset.lifecycle.warrantyStatus === "OutOfWarranty"
  ).length;
  const nonCompliantDiscoveryCoverageCount = assetsInCountScope.filter(
    (asset) => !discoveryCoverageForAsset(asset, discoveryToolsSettings).coverageCompliance
  ).length;

  const filteredAssets = selectedEnvironment
    ? kpiMatchedAssets.filter((asset) => asset.systemContext?.environmentType === selectedEnvironment)
    : kpiMatchedAssets;
  const assetPageState = parsePageState(requestParams, "page", "pageSize");
  const coveragePageState = parsePageState(requestParams, "coveragePage", "coveragePageSize");
  const findingsPageState = parsePageState(requestParams, "findingsPage", "findingsPageSize");

  const filteredAssetIds = new Set(filteredAssets.map((asset) => asset.id));

  const filteredFindings = p12Findings.filter((finding) => {
    if (!filteredAssetIds.has(finding.scope.assetId)) {
      return false;
    }
    if (selectedEnvironment && finding.scope.environmentType !== selectedEnvironment) {
      return false;
    }
    return true;
  });
  const p12SpiOptions = Array.from(new Set(filteredFindings.map((finding) => finding.spiId))).sort((a, b) => a - b);
  const p12PriorityOptions = Array.from(new Set(filteredFindings.map((finding) => finding.priorityRank))).sort(
    (a, b) => a - b
  );
  const p12SeverityOptions = Array.from(new Set(filteredFindings.map((finding) => finding.severity)));
  const p12SectionFindings = filteredFindings.filter((finding) => {
    if (selectedP12Spi && finding.spiId !== selectedP12Spi) {
      return false;
    }
    if (selectedP12Priority && finding.priorityRank !== selectedP12Priority) {
      return false;
    }
    if (selectedP12Severity && finding.severity !== selectedP12Severity) {
      return false;
    }
    if (!findingMatchesSearch(finding, normalizedP12SearchTerm)) {
      return false;
    }
    return true;
  });
  const preservedP12Params = Object.entries(requestParams).flatMap(([key, value]) => {
    if (key === "p12Spi" || key === "p12Priority" || key === "p12Severity" || key === "p12Search") {
      return [];
    }
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value.length ? [{ key, value: value[0] }] : [];
    }
    return [{ key, value }];
  });
  const clearP12FiltersHref = (() => {
    const params = new URLSearchParams();
    for (const param of preservedP12Params) {
      params.set(param.key, param.value);
    }
    const query = params.toString();
    return query ? `/systems/${system.id}?${query}#p12-findings` : `/systems/${system.id}#p12-findings`;
  })();

  const discoveryCoverageRows = filteredAssets
    .map((asset) => {
      const coverage = discoveryCoverageForAsset(asset, discoveryToolsSettings);

      return {
        assetId: asset.id,
        hostname: asset.hostname,
        assetType: asset.type,
        environment: asset.systemContext?.environmentType ?? "-",
        ucmdb: coverage.ucmdb,
        tanium: coverage.tanium,
        tenable: coverage.tenable,
        snow: coverage.snow,
        seviceNow: coverage.seviceNow,
        dsocSiem: coverage.dsocSiem,
        elastic: coverage.elastic,
        coverageCompliance: coverage.coverageCompliance
      };
    })
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const p12ByAsset = filteredFindings.reduce((map, finding) => {
    const current = map.get(finding.scope.assetId) ?? { p1: 0, p2: 0 };
    if (finding.priorityRank === 1) {
      current.p1 += 1;
    } else if (finding.priorityRank === 2) {
      current.p2 += 1;
    }
    map.set(finding.scope.assetId, current);
    return map;
  }, new Map<string, { p1: number; p2: number }>());

  const p12CountByAsset = new Map<string, number>();
  for (const [assetId, count] of p12ByAsset.entries()) {
    p12CountByAsset.set(assetId, count.p1 + count.p2);
  }

  const osAssetRows = filteredAssets
    .filter((asset) => asset.type === "server" || asset.type === "workstation")
    .map((asset) => {
      const os = asset.operatingSystem;
      const nMinus = os?.nMinus ?? null;
      const p12 = p12ByAsset.get(asset.id) ?? { p1: 0, p2: 0 };
      const p12Status =
        p12.p1 > 0 ? `P1 (${p12.p1})` : p12.p2 > 0 ? `P2 (${p12.p2})` : "No P1-P2";

      return {
        assetId: asset.id,
        hostname: asset.hostname,
        assetType: asset.type,
        environment: asset.systemContext?.environmentType ?? "-",
        osName: os ? `${os.vendor} ${os.family}` : "Unknown",
        version: os?.version ?? "Unknown",
        patchLevel: patchLevelLabel(nMinus),
        n2Status: n2PlusStatusLabel(nMinus),
        supportStatus: os?.supportStatus ?? "Unknown",
        p1: p12.p1,
        p2: p12.p2,
        p12Status
      };
    })
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const osSummaryMap = new Map<
    string,
    {
      osName: string;
      version: string;
      patchLevel: string;
      n2Status: string;
      supportStatus: string;
      assetCount: number;
      p1: number;
      p2: number;
    }
  >();

  for (const row of osAssetRows) {
    const key = [row.osName, row.version, row.patchLevel, row.n2Status, row.supportStatus].join("::");
    const current = osSummaryMap.get(key) ?? {
      osName: row.osName,
      version: row.version,
      patchLevel: row.patchLevel,
      n2Status: row.n2Status,
      supportStatus: row.supportStatus,
      assetCount: 0,
      p1: 0,
      p2: 0
    };
    current.assetCount += 1;
    current.p1 += row.p1;
    current.p2 += row.p2;
    osSummaryMap.set(key, current);
  }

  const osTotals = Array.from(osSummaryMap.values()).sort((a, b) => {
    if (a.assetCount !== b.assetCount) {
      return b.assetCount - a.assetCount;
    }
    const osComparison = a.osName.localeCompare(b.osName);
    if (osComparison !== 0) {
      return osComparison;
    }
    return a.version.localeCompare(b.version);
  });
  const coverageRowsPage = paginate(discoveryCoverageRows, coveragePageState.page, coveragePageState.pageSize);
  const assetRowsPage = paginate(filteredAssets, assetPageState.page, assetPageState.pageSize);
  const findingsRowsPage = paginate(p12SectionFindings, findingsPageState.page, findingsPageState.pageSize);

  const selectedStatuses = analytics.evaluations
    .filter((evaluation) => filteredAssetIds.has(evaluation.assetId))
    .filter((evaluation) => !selectedEnvironment || evaluation.environmentType === selectedEnvironment)
    .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
  const selectedComplianceScore = complianceScore(selectedStatuses);
  const selectedPosture = overallStatusFromStatuses(selectedStatuses);

  const scopeHref = (scope: {
    environment?: EnvironmentType;
    serverSearch?: string;
    kpiFilter?: KpiFilterKey;
  }) => {
    const params = new URLSearchParams();
    if (requestedDataDate) {
      params.set("dataDate", requestedDataDate);
    }
    if (scope.environment) {
      params.set("environment", scope.environment);
    }
    if (scope.serverSearch) {
      params.set("serverSearch", scope.serverSearch);
    }
    if (scope.kpiFilter) {
      params.set("kpiFilter", scope.kpiFilter);
    }
    const query = params.toString();
    return query ? `/systems/${system.id}?${query}` : `/systems/${system.id}`;
  };
  const scopedPageHref = (updates: Record<string, string | undefined>, hash?: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(requestParams)) {
      if (!value) {
        continue;
      }
      params.set(key, Array.isArray(value) ? value[0] : value);
    }
    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    const href = query ? `/systems/${system.id}?${query}` : `/systems/${system.id}`;
    return hash ? `${href}#${hash}` : href;
  };

  const environmentHref = (environment?: EnvironmentType) => {
    return scopeHref({
      environment,
      serverSearch: serverSearchTerm || undefined,
      kpiFilter: selectedKpiFilter
    });
  };
  const kpiFilterHref = (kpiFilter?: KpiFilterKey) =>
    scopeHref({
      environment: selectedEnvironment,
      serverSearch: serverSearchTerm || undefined,
      kpiFilter
    });
  const remediationReportHref = (() => {
    const query = new URLSearchParams();
    if (requestedDataDate) {
      query.set("dataDate", requestedDataDate);
    }
    if (selectedEnvironment) {
      query.set("environment", selectedEnvironment);
    }
    if (serverSearchTerm) {
      query.set("serverSearch", serverSearchTerm);
    }
    if (selectedKpiFilter) {
      query.set("kpiFilter", selectedKpiFilter);
    }
    const params = query.toString();
    return params
      ? `/api/systems/${system.id}/remediation-report?${params}`
      : `/api/systems/${system.id}/remediation-report`;
  })();
  const coverageGapsReportHref = (() => {
    const query = new URLSearchParams();
    if (requestedDataDate) {
      query.set("dataDate", requestedDataDate);
    }
    if (selectedEnvironment) {
      query.set("environment", selectedEnvironment);
    }
    if (serverSearchTerm) {
      query.set("serverSearch", serverSearchTerm);
    }
    if (selectedKpiFilter) {
      query.set("kpiFilter", selectedKpiFilter);
    }
    const params = query.toString();
    return params
      ? `/api/systems/${system.id}/coverage-gaps-report?${params}`
      : `/api/systems/${system.id}/coverage-gaps-report`;
  })();

  const snapshotByDate = new Map<string, Dataset>();
  for (const snapshot of snapshots) {
    snapshotByDate.set(snapshot.snapshotDate, snapshot);
  }
  snapshotByDate.set(dataset.snapshotDate, dataset);

  const last12Snapshots = Array.from(snapshotByDate.values())
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
    .slice(-12);

  const kpiTrendSeries = last12Snapshots.map((snapshot, index) => {
    const metrics = buildSystemKpiSnapshotMetrics(
      snapshot,
      system.id,
      selectedEnvironment,
      serverSearchTerm,
      measuresSettings,
      discoveryToolsSettings
    );
    return {
      weekLabel: `W${String(last12Snapshots.length - index).padStart(2, "0")}`,
      ...metrics
    };
  });

  const trendPointsFor = (key: keyof SystemKpiSnapshotMetrics) =>
    kpiTrendSeries.map((point) => ({
      label: point.weekLabel,
      value: point[key]
    }));

  const nonCompliantServersTrend = trendPointsFor("nonCompliantServers");
  const nonCompliantOsTrend = trendPointsFor("nonCompliantOs");
  const nonCompliantEnvironmentsTrend = trendPointsFor("nonCompliantEnvironments");
  const p12FindingsTrend = trendPointsFor("p12Findings");
  const highRiskP12Trend = trendPointsFor("highRiskP12Findings");
  const outOfWarrantyTrend = trendPointsFor("outOfWarrantyAssets");
  const nonCompliantDiscoveryCoverageTrend = trendPointsFor("nonCompliantDiscoveryCoverage");

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href={withDataDate("/systems", requestedDataDate)} className="text-xs text-sky-200 underline">
              Back to ICT Systems
            </Link>
            <h1 className="mt-2 text-3xl font-semibold text-slate-100">{system.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <PostureBadge status={selectedPosture} />
              <span className="rounded-full border border-sky-400/25 px-3 py-1 text-xs text-slate-200">
                Network: {system.networkId}
              </span>
              <span className="rounded-full border border-sky-400/25 px-3 py-1 text-xs text-slate-200">
                Assets in scope: {filteredAssets.length} ({selectedLabel})
              </span>
              {serverSearchTerm ? (
                <span className="rounded-full border border-sky-300/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-100">
                  Server search: {serverSearchTerm}
                </span>
              ) : null}
              {selectedKpiFilter ? (
                <span className="rounded-full border border-amber-300/45 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                  KPI filter: {KPI_FILTER_LABELS[selectedKpiFilter]}
                </span>
              ) : null}
              <span className="rounded-full border border-red-400/35 bg-red-500/10 px-3 py-1 text-xs text-red-100">
                P1-2 findings in scope: {filteredFindings.length}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-300/85">
              Drill-through redesigned for environment-level compliance and P1-2 risk visibility.
            </p>
          </div>

          <Link
            href="#environment-filter"
            className="panel-alt min-w-[210px] self-stretch border-sky-300/25 p-4 lg:self-auto"
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Compliance Score</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-200">{selectedComplianceScore}%</p>
            <p className="mt-1 text-xs text-slate-300/80">{selectedLabel}</p>
            <p className="mt-2 text-[11px] text-sky-200/90">Linked to Environment, Search, and KPI Filters</p>
          </Link>
        </div>
      </section>

      <section id="kpi-filter" className="panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Remediation Report</h2>
            <p className="mt-1 text-sm text-slate-300/85">
              Generate a remediation report for this ICT System using the current environment, server search, and KPI
              filters.
            </p>
            <p className="mt-1 text-xs text-slate-300/75">
              Includes system summary, scoped compliance score, applied filters, findings register entries, and
              recommended remediation actions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={remediationReportHref}
              className="inline-flex items-center justify-center rounded-md border border-amber-300/45 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/25"
            >
              Generate Remediation Report
            </a>
            <a
              href={coverageGapsReportHref}
              className="inline-flex items-center justify-center rounded-md border border-sky-300/45 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/25"
            >
              Export coverage gaps
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Mission Capabilities</h2>
          <ul className="mt-2 space-y-2 text-sm text-slate-200">
            {system.missionCapabilities.map((capability) => (
              <li key={capability.id} className="panel-alt p-2">
                {capability.name} ({capability.criticality})
              </li>
            ))}
          </ul>
        </div>

        <div className="panel p-4">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Business Services</h2>
          <ul className="mt-2 space-y-2 text-sm text-slate-200">
            {system.businessServices.map((service) => (
              <li key={service.id} className="panel-alt p-2">
                {service.name} ({service.criticality})
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">KPI Snapshot</h2>
        <p className="mt-1 text-xs text-slate-300/80">
          Calculated for {selectedLabel} scope. Select a tile to filter the whole page. Charts show the last 12 weeks.
        </p>
        {selectedKpiFilter ? (
          <p className="mt-2 text-xs text-amber-100/90">
            Active KPI filter: {KPI_FILTER_LABELS[selectedKpiFilter]}{" "}
            <Link
              href={kpiFilterHref()}
              scroll={false}
              data-filter-loading="true"
              data-filter-loading-message="Applying KPI filter..."
              className="underline text-sky-200"
            >
              Clear KPI filter
            </Link>
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Link
            href={
              selectedKpiFilter === "nonCompliantServers"
                ? kpiFilterHref()
                : kpiFilterHref("nonCompliantServers")
            }
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-red-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "nonCompliantServers" ? "ring-2 ring-red-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Total Non-compliant Servers</p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{nonCompliantServerCount}</p>
            <MiniTrendSparkline points={nonCompliantServersTrend} stroke="#fb7185" />
          </Link>
          <Link
            href={selectedKpiFilter === "nonCompliantOs" ? kpiFilterHref() : kpiFilterHref("nonCompliantOs")}
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-amber-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "nonCompliantOs" ? "ring-2 ring-amber-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Total Non-compliant OS</p>
            <p className="mt-1 text-2xl font-semibold text-amber-100">{nonCompliantOsCount}</p>
            <MiniTrendSparkline points={nonCompliantOsTrend} stroke="#f59e0b" />
          </Link>
          <Link
            href={
              selectedKpiFilter === "nonCompliantEnvironments"
                ? kpiFilterHref()
                : kpiFilterHref("nonCompliantEnvironments")
            }
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-red-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "nonCompliantEnvironments" ? "ring-2 ring-red-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Total Non-compliant Environments
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{nonCompliantEnvironmentCount}</p>
            <MiniTrendSparkline points={nonCompliantEnvironmentsTrend} stroke="#ef4444" />
          </Link>
          <Link
            href={selectedKpiFilter === "p12Findings" ? kpiFilterHref() : kpiFilterHref("p12Findings")}
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-red-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "p12Findings" ? "ring-2 ring-red-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Total P1-P2 Findings</p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{findingsInCountScope.length}</p>
            <MiniTrendSparkline points={p12FindingsTrend} stroke="#f97316" />
          </Link>
          <Link
            href={
              selectedKpiFilter === "highRiskP12Findings"
                ? kpiFilterHref()
                : kpiFilterHref("highRiskP12Findings")
            }
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-red-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "highRiskP12Findings" ? "ring-2 ring-red-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Total P1-P2 High Risk Findings
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{highRiskP12Count}</p>
            <MiniTrendSparkline points={highRiskP12Trend} stroke="#ef4444" />
          </Link>
          <Link
            href={
              selectedKpiFilter === "outOfWarrantyAssets"
                ? kpiFilterHref()
                : kpiFilterHref("outOfWarrantyAssets")
            }
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-amber-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "outOfWarrantyAssets" ? "ring-2 ring-amber-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Total Physical Assets Out of Warranty
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-100">{outOfWarrantyAssetCount}</p>
            <MiniTrendSparkline points={outOfWarrantyTrend} stroke="#f59e0b" />
          </Link>
          <Link
            href={
              selectedKpiFilter === "nonCompliantDiscoveryCoverage"
                ? kpiFilterHref()
                : kpiFilterHref("nonCompliantDiscoveryCoverage")
            }
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-red-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "nonCompliantDiscoveryCoverage" ? "ring-2 ring-red-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Assets non-compliant with discovery coverage
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{nonCompliantDiscoveryCoverageCount}</p>
            <MiniTrendSparkline points={nonCompliantDiscoveryCoverageTrend} stroke="#dc2626" />
          </Link>
        </div>
      </section>

      <section id="environment-filter" className="panel p-4">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Environment Filter</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={environmentHref()}
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying environment filter..."
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              !selectedEnvironment
                ? "border-sky-300/55 bg-sky-500/20 text-sky-100"
                : "border-sky-400/25 text-slate-300 hover:bg-slate-900/60"
            }`}
          >
            All Environments
          </Link>
          {environmentCards.map((environment) => (
            <Link
              key={environment.type}
              href={environmentHref(environment.type)}
              scroll={false}
              data-filter-loading="true"
              data-filter-loading-message="Applying environment filter..."
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                selectedEnvironment === environment.type
                  ? "border-sky-300/55 bg-sky-500/20 text-sky-100"
                  : "border-sky-400/25 text-slate-300 hover:bg-slate-900/60"
              }`}
            >
              {environment.type}
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-300/75">
          Asset, KPI, OS posture, and findings panels below follow this selection, server search, and KPI tile filter.
        </p>
      </section>

      <Suspense
        fallback={
          <section className="panel p-4">
            <p className="text-sm text-slate-300/80">Loading discovery coverage table...</p>
          </section>
        }
      >
        <ServerStreamHint />
        <section id="asset-discovery-coverage" className="panel overflow-hidden">
        <h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
          Environment Compliance and P1-2 Exposure
        </h2>
        <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-4">
          {environmentCards.map((environment) => {
            const isSelected = selectedEnvironment === environment.type;
            return (
              <div
                key={environment.type}
                className={`panel-alt p-3 ${
                  isSelected ? "ring-2 ring-sky-200/60" : ""
                } ${
                  environment.type === "Production" ? "ring-1 ring-red-300/50" : "ring-1 ring-sky-300/25"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-100">{environment.type}</p>
                  <PostureBadge status={environment.posture} />
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-300/75">Compliance Score</p>
                <p className="mt-1 text-2xl font-semibold text-slate-100">{environment.complianceScore}%</p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-900/80">
                  <div
                    className="h-1.5 rounded-full bg-emerald-400/80"
                    style={{ width: `${Math.max(0, Math.min(environment.complianceScore, 100))}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300/85">
                  <p>Assets: {environment.assetCount}</p>
                  <p>P1-2 Findings: {environment.findingCount}</p>
                  <p className="col-span-2">Affected Assets: {environment.affectedAssets.length}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
          Asset Discovery Coverage ({selectedLabel})
        </h2>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Environment</th>
                <th className="px-3 py-2">UCMDB</th>
                <th className="px-3 py-2">Tanium</th>
                <th className="px-3 py-2">Tenable</th>
                <th className="px-3 py-2">SNOW</th>
                <th className="px-3 py-2">ServiceNow</th>
                <th className="px-3 py-2">DSOC SIEM</th>
                <th className="px-3 py-2">Elastic</th>
                <th className="px-3 py-2">Coverage Compliance</th>
              </tr>
            </thead>
            <tbody>
              {coverageRowsPage.items.map((row) => (
                <tr key={row.assetId} className="border-t border-sky-400/10">
                  <td className="px-3 py-2 text-slate-100">{row.hostname}</td>
                  <td className="px-3 py-2 text-slate-300">{row.assetType}</td>
                  <td className="px-3 py-2 text-slate-300">{row.environment}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        row.ucmdb === 1
                          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                          : "border-red-400/45 bg-red-500/15 text-red-100"
                      }`}
                    >
                      {row.ucmdb}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        row.tanium === 1
                          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                          : "border-red-400/45 bg-red-500/15 text-red-100"
                      }`}
                    >
                      {row.tanium}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        row.tenable === 1
                          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                          : "border-red-400/45 bg-red-500/15 text-red-100"
                      }`}
                    >
                      {row.tenable}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        row.snow === 1
                          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                          : "border-red-400/45 bg-red-500/15 text-red-100"
                      }`}
                    >
                      {row.snow}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        row.seviceNow === 1
                          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                          : "border-red-400/45 bg-red-500/15 text-red-100"
                      }`}
                    >
                      {row.seviceNow}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        row.dsocSiem === 1
                          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                          : "border-red-400/45 bg-red-500/15 text-red-100"
                      }`}
                    >
                      {row.dsocSiem}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        row.elastic === 1
                          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                          : "border-red-400/45 bg-red-500/15 text-red-100"
                      }`}
                    >
                      {row.elastic}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        row.coverageCompliance
                          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                          : "border-red-400/45 bg-red-500/15 text-red-100"
                      }`}
                    >
                      {row.coverageCompliance ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              ))}
              {coverageRowsPage.totalItems === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-sm text-slate-300/80">
                    No assets in this scope.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {coverageRowsPage.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-400/10 px-4 py-3 text-xs text-slate-300/85">
            <p>
              Showing {(coverageRowsPage.currentPage - 1) * coverageRowsPage.pageSize + 1}-
              {Math.min(coverageRowsPage.currentPage * coverageRowsPage.pageSize, coverageRowsPage.totalItems)} of{" "}
              {coverageRowsPage.totalItems}
            </p>
            <div className="flex items-center gap-2">
              {coverageRowsPage.currentPage > 1 ? (
                <a
                  href={scopedPageHref(
                    { coveragePage: String(coverageRowsPage.currentPage - 1) },
                    "asset-discovery-coverage"
                  )}
                  data-filter-loading="true"
                  data-filter-loading-message="Loading discovery coverage page..."
                  className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 hover:bg-slate-800/70"
                >
                  Previous
                </a>
              ) : (
                <span className="rounded-md border border-slate-700/70 px-3 py-1 text-slate-500">Previous</span>
              )}
              <span>
                Page {coverageRowsPage.currentPage} of {coverageRowsPage.totalPages}
              </span>
              {coverageRowsPage.currentPage < coverageRowsPage.totalPages ? (
                <a
                  href={scopedPageHref(
                    { coveragePage: String(coverageRowsPage.currentPage + 1) },
                    "asset-discovery-coverage"
                  )}
                  data-filter-loading="true"
                  data-filter-loading-message="Loading discovery coverage page..."
                  className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 hover:bg-slate-800/70"
                >
                  Next
                </a>
              ) : (
                <span className="rounded-md border border-slate-700/70 px-3 py-1 text-slate-500">Next</span>
              )}
            </div>
          </div>
        ) : null}
        </section>
      </Suspense>

      <Suspense
        fallback={
          <section className="panel p-4">
            <p className="text-sm text-slate-300/80">Loading asset inventory...</p>
          </section>
        }
      >
        <ServerStreamHint />
        <section id="asset-inventory" className="panel overflow-hidden">
        <div className="border-b border-sky-400/15 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Asset Inventory ({selectedLabel})</h2>
              <p className="mt-1 text-xs text-slate-300/75">
                Search by server hostname or asset ID. This search filters the whole page.
              </p>
            </div>
            <form
              action={`/systems/${system.id}#asset-inventory`}
              method="get"
              data-filter-loading="true"
              data-filter-loading-message="Applying filters..."
              className="flex w-full max-w-xl flex-wrap gap-2"
            >
              {selectedEnvironment ? <input type="hidden" name="environment" value={selectedEnvironment} /> : null}
              {selectedKpiFilter ? <input type="hidden" name="kpiFilter" value={selectedKpiFilter} /> : null}
              <input
                type="search"
                name="serverSearch"
                defaultValue={serverSearchTerm}
                placeholder="Search server hostname or asset ID"
                className="min-w-[240px] flex-1 rounded-md border border-sky-400/30 bg-slate-950/80 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-400/70 focus:border-sky-300/70"
              />
              <button
                type="submit"
                className="rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-500/25"
              >
                Search
              </button>
              {serverSearchTerm ? (
                <Link
                  href={scopeHref({ environment: selectedEnvironment, kpiFilter: selectedKpiFilter })}
                  scroll={false}
                  data-filter-loading="true"
                  data-filter-loading-message="Applying filters..."
                  className="rounded-md border border-slate-500/40 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-900/70"
                >
                  Clear
                </Link>
              ) : null}
            </form>
          </div>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Environment</th>
                <th className="px-3 py-2">Critical Vulns</th>
                <th className="px-3 py-2">P1-2 Findings</th>
              </tr>
            </thead>
            <tbody>
              {assetRowsPage.items.map((asset) => (
                <tr key={asset.id} className="border-t border-sky-400/10">
                  <td className="px-3 py-2 text-slate-100">{asset.hostname}</td>
                  <td className="px-3 py-2 text-slate-300">{asset.type}</td>
                  <td className="px-3 py-2 text-slate-300">{asset.systemContext?.environmentType ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-200">
                    {asset.vulnerabilities.filter((vulnerability) => vulnerability.severity === "Critical").length}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        (p12CountByAsset.get(asset.id) ?? 0) > 0
                          ? "border-red-400/45 bg-red-500/15 text-red-100"
                          : "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                      }`}
                    >
                      {p12CountByAsset.get(asset.id) ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
              {assetRowsPage.totalItems === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-300/80">
                    {serverSearchTerm
                      ? "No servers match this search in the selected scope."
                      : "No assets in this environment."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {assetRowsPage.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-400/10 px-4 py-3 text-xs text-slate-300/85">
            <p>
              Showing {(assetRowsPage.currentPage - 1) * assetRowsPage.pageSize + 1}-
              {Math.min(assetRowsPage.currentPage * assetRowsPage.pageSize, assetRowsPage.totalItems)} of{" "}
              {assetRowsPage.totalItems}
            </p>
            <div className="flex items-center gap-2">
              {assetRowsPage.currentPage > 1 ? (
                <a
                  href={scopedPageHref({ page: String(assetRowsPage.currentPage - 1) }, "asset-inventory")}
                  data-filter-loading="true"
                  data-filter-loading-message="Loading inventory page..."
                  className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 hover:bg-slate-800/70"
                >
                  Previous
                </a>
              ) : (
                <span className="rounded-md border border-slate-700/70 px-3 py-1 text-slate-500">Previous</span>
              )}
              <span>
                Page {assetRowsPage.currentPage} of {assetRowsPage.totalPages}
              </span>
              {assetRowsPage.currentPage < assetRowsPage.totalPages ? (
                <a
                  href={scopedPageHref({ page: String(assetRowsPage.currentPage + 1) }, "asset-inventory")}
                  data-filter-loading="true"
                  data-filter-loading-message="Loading inventory page..."
                  className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 hover:bg-slate-800/70"
                >
                  Next
                </a>
              ) : (
                <span className="rounded-md border border-slate-700/70 px-3 py-1 text-slate-500">Next</span>
              )}
            </div>
          </div>
        ) : null}
        </section>
      </Suspense>

      <section className="panel overflow-hidden">
        <h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
          OS Posture Summary ({selectedLabel})
        </h2>
        <p className="px-4 py-2 text-xs text-slate-300/80">
          Scope includes servers and workstations in the selected environment. Totals summarize each installed OS
          profile and detail rows show each asset.
        </p>

        <div className="border-t border-sky-400/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">OS Totals</p>
          <div className="mt-2 max-h-[240px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                <tr>
                  <th className="px-3 py-2">OS</th>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">Patch Level</th>
                  <th className="px-3 py-2">N-2+ Status</th>
                  <th className="px-3 py-2">Vendor Support</th>
                  <th className="px-3 py-2">Assets</th>
                  <th className="px-3 py-2">P1-P2 Findings</th>
                </tr>
              </thead>
              <tbody>
                {osTotals.map((row, index) => (
                  <tr key={`${row.osName}-${row.version}-${index}`} className="border-t border-sky-400/10">
                    <td className="px-3 py-2 text-slate-100">{row.osName}</td>
                    <td className="px-3 py-2 text-slate-300">{row.version}</td>
                    <td className="px-3 py-2 text-slate-300">{row.patchLevel}</td>
                    <td className="px-3 py-2 text-slate-300">{row.n2Status}</td>
                    <td className="px-3 py-2 text-slate-300">{row.supportStatus}</td>
                    <td className="px-3 py-2 text-slate-100">{row.assetCount}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          row.p1 > 0 || row.p2 > 0
                            ? "border-red-400/45 bg-red-500/15 text-red-100"
                            : "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                        }`}
                      >
                        {row.p1 > 0 || row.p2 > 0 ? `P1: ${row.p1} | P2: ${row.p2}` : "Compliant"}
                      </span>
                    </td>
                  </tr>
                ))}
                {osTotals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-300/80">
                      No server/workstation OS data in this environment scope.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-sky-400/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Server/Workstation OS Detail</p>
          <div className="mt-2 max-h-[420px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                <tr>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Environment</th>
                  <th className="px-3 py-2">OS</th>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">Patch Level</th>
                  <th className="px-3 py-2">N-2+ Status</th>
                  <th className="px-3 py-2">Vendor Support</th>
                  <th className="px-3 py-2">P1-P2 Status</th>
                </tr>
              </thead>
              <tbody>
                {osAssetRows.map((row) => (
                  <tr key={row.assetId} className="border-t border-sky-400/10">
                    <td className="px-3 py-2 text-slate-100">
                      <p>{row.hostname}</p>
                      <p className="text-xs text-slate-400">{row.assetType}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{row.environment}</td>
                    <td className="px-3 py-2 text-slate-200">{row.osName}</td>
                    <td className="px-3 py-2 text-slate-300">{row.version}</td>
                    <td className="px-3 py-2 text-slate-300">{row.patchLevel}</td>
                    <td className="px-3 py-2 text-slate-300">{row.n2Status}</td>
                    <td className="px-3 py-2 text-slate-300">{row.supportStatus}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          row.p1 > 0 || row.p2 > 0
                            ? "border-red-400/45 bg-red-500/15 text-red-100"
                            : "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                        }`}
                      >
                        {row.p1 > 0 || row.p2 > 0 ? row.p12Status : "Compliant"}
                      </span>
                    </td>
                  </tr>
                ))}
                {osAssetRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-300/80">
                      No servers or workstations in this environment scope.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Suspense
        fallback={
          <section className="panel p-4">
            <p className="text-sm text-slate-300/80">Loading findings...</p>
          </section>
        }
      >
        <ServerStreamHint />
        <section id="p12-findings" className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-400/15 px-4 py-3">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">P1-2 Findings ({selectedLabel})</h2>
        </div>
        <div className="border-b border-sky-400/10 px-4 py-3">
          <form
            action={`/systems/${system.id}#p12-findings`}
            method="get"
            data-filter-loading="true"
            data-filter-loading-message="Applying findings filters..."
            className="flex flex-wrap items-end gap-3 xl:flex-nowrap"
          >
            {preservedP12Params.map((param) => (
              <input key={param.key} type="hidden" name={param.key} value={param.value} />
            ))}
            <div className="flex min-w-[300px] flex-col gap-1">
              <label htmlFor="p12-findings-spi" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
                SPI
              </label>
              <select
                id="p12-findings-spi"
                name="p12Spi"
                defaultValue={selectedP12Spi ? String(selectedP12Spi) : ""}
                className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All SPI</option>
                {p12SpiOptions.map((option) => (
                  <option key={option} value={option}>
                    SPI {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[120px] flex-col gap-1">
              <label
                htmlFor="p12-findings-priority"
                className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70"
              >
                Priority
              </label>
              <select
                id="p12-findings-priority"
                name="p12Priority"
                defaultValue={selectedP12Priority ? String(selectedP12Priority) : ""}
                className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All Priorities</option>
                {p12PriorityOptions.map((option) => (
                  <option key={option} value={option}>
                    P{option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[160px] flex-col gap-1">
              <label
                htmlFor="p12-findings-severity"
                className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70"
              >
                Severity
              </label>
              <select
                id="p12-findings-severity"
                name="p12Severity"
                defaultValue={selectedP12Severity ?? ""}
                className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All Severities</option>
                {p12SeverityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[160px] flex-1 flex-col gap-1">
              <label htmlFor="p12-findings-search" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
                Text Search
              </label>
              <input
                id="p12-findings-search"
                name="p12Search"
                type="search"
                defaultValue={selectedP12SearchTerm}
                placeholder="Search title, scope, evidence, action..."
                className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100"
            >
              Apply
            </button>
            {selectedP12Spi || selectedP12Priority || selectedP12Severity || selectedP12SearchTerm ? (
              <Link
                href={clearP12FiltersHref}
                scroll={false}
                data-filter-loading="true"
                data-filter-loading-message="Applying findings filters..."
                className="shrink-0 rounded-md border border-slate-500/40 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </div>
        <ul className="max-h-[420px] space-y-2 overflow-auto p-4 text-sm">
          {findingsRowsPage.items.map((finding) => (
            <li key={finding.id} className="panel-alt p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">
                P{finding.priorityRank} | SPI {finding.spiId} | {finding.severity}
              </p>
              <p className="mt-1 text-slate-100">{finding.title}</p>
              <p className="mt-1 text-xs text-slate-300/80">
                {(assetNameById.get(finding.scope.assetId) ?? finding.scope.assetId)} | {finding.scope.environmentType}
              </p>
            </li>
          ))}
          {findingsRowsPage.totalItems === 0 ? (
            <li className="panel-alt p-3 text-sm text-emerald-200/90">
              No P1-2 findings match the selected SPI, Priority, Severity, and text search filters.
            </li>
          ) : null}
        </ul>
        {findingsRowsPage.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-400/10 px-4 py-3 text-xs text-slate-300/85">
            <p>
              Showing {(findingsRowsPage.currentPage - 1) * findingsRowsPage.pageSize + 1}-
              {Math.min(findingsRowsPage.currentPage * findingsRowsPage.pageSize, findingsRowsPage.totalItems)} of{" "}
              {findingsRowsPage.totalItems}
            </p>
            <div className="flex items-center gap-2">
              {findingsRowsPage.currentPage > 1 ? (
                <a
                  href={scopedPageHref(
                    { findingsPage: String(findingsRowsPage.currentPage - 1) },
                    "p12-findings"
                  )}
                  data-filter-loading="true"
                  data-filter-loading-message="Loading findings page..."
                  className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 hover:bg-slate-800/70"
                >
                  Previous
                </a>
              ) : (
                <span className="rounded-md border border-slate-700/70 px-3 py-1 text-slate-500">Previous</span>
              )}
              <span>
                Page {findingsRowsPage.currentPage} of {findingsRowsPage.totalPages}
              </span>
              {findingsRowsPage.currentPage < findingsRowsPage.totalPages ? (
                <a
                  href={scopedPageHref(
                    { findingsPage: String(findingsRowsPage.currentPage + 1) },
                    "p12-findings"
                  )}
                  data-filter-loading="true"
                  data-filter-loading-message="Loading findings page..."
                  className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 hover:bg-slate-800/70"
                >
                  Next
                </a>
              ) : (
                <span className="rounded-md border border-slate-700/70 px-3 py-1 text-slate-500">Next</span>
              )}
            </div>
          </div>
        ) : null}
        </section>
      </Suspense>

    </div>
  );
}
