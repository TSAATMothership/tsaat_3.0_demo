import Link from "next/link";
import { notFound } from "next/navigation";
import { MiniTrendSparkline } from "@/components/mini-trend-sparkline";
import { PostureBadge } from "@/components/posture-badge";
import { ServerStreamHint } from "@/components/server-stream-hint";
import { loadCurrentDataset, loadLatestSnapshots, loadMeasuresSettings } from "@/lib/data-loader";
import { MeasuresSettings } from "@/lib/measures-settings";
import { buildAnalytics } from "@/lib/analytics";
import { SPI_DESCRIPTIONS } from "@/lib/constants";
import { paginate, parsePageState } from "@/lib/pagination";
import { Asset, ComplianceStatus, Dataset, Finding } from "@/lib/types";
import { Suspense } from "react";

type KpiFilterKey =
  | "nonCompliantAssets"
  | "nonCompliantServers"
  | "nonCompliantOs"
  | "nonCompliantEnvironments"
  | "p12Findings"
  | "highRiskP12Findings"
  | "outOfWarrantyAssets"
  | "nonCompliantDiscoveryCoverage";

const KPI_FILTER_LABELS: Record<KpiFilterKey, string> = {
  nonCompliantAssets: "Total Non-compliant Assets",
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

interface NetworkKpiSnapshotMetrics {
  nonCompliantAssets: number;
  nonCompliantServers: number;
  nonCompliantOs: number;
  nonCompliantEnvironments: number;
  p12Findings: number;
  highRiskP12Findings: number;
  outOfWarrantyAssets: number;
  nonCompliantDiscoveryCoverage: number;
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

function discoveryCoverageForAsset(asset: Asset) {
  const ucmdb = asset.systemContext?.systemId ? 1 : 0;
  const tanium = asset.type === "server" || asset.type === "workstation" ? 1 : 0;
  const tenable = asset.vulnerabilities.some((vulnerability) =>
    ["Nessus", "Qualys", "OpenVAS"].includes(vulnerability.source)
  )
    ? 1
    : 0;
  const snow = asset.lifecycle.warrantyStatus !== "Unknown" ? 1 : 0;
  const seviceNow = asset.lifecycle.eolStatus !== "Unknown" ? 1 : 0;
  const coverageCompliance = ucmdb === 1 && tanium === 1 && tenable === 1 && snow === 1 && seviceNow === 1;

  return {
    ucmdb,
    tanium,
    tenable,
    snow,
    seviceNow,
    coverageCompliance
  };
}

function buildNetworkKpiSnapshotMetrics(
  snapshot: Dataset,
  networkId: string,
  measuresSettings: MeasuresSettings
): NetworkKpiSnapshotMetrics {
  const analytics = buildAnalytics(snapshot, snapshot.ictSystems, { managedNetwork: networkId }, measuresSettings);
  const assets = snapshot.assets.filter((asset) => asset.networkId === networkId);
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const p12Findings = analytics.findings.filter((finding) => finding.priorityRank <= 2);

  const nonCompliantAssets = assets.filter((asset) => {
    const evaluation = evaluationByAssetId.get(asset.id);
    if (!evaluation) {
      return false;
    }
    return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
  }).length;

  const nonCompliantServers = assets.filter((asset) => {
    if (asset.type !== "server") {
      return false;
    }
    const evaluation = evaluationByAssetId.get(asset.id);
    if (!evaluation) {
      return false;
    }
    return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
  }).length;

  const nonCompliantOs = assets.filter((asset) => {
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

  const nonCompliantEnvironments = (["Production", "Development", "UAT", "Test"] as const).filter(
    (environmentType) => {
      const statuses = analytics.evaluations
        .filter((evaluation) => evaluation.environmentType === environmentType)
        .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
      return overallStatusFromStatuses(statuses) === "Non-compliant";
    }
  ).length;

  const highRiskP12Findings = p12Findings.filter((finding) => finding.severity === "High Risk").length;
  const outOfWarrantyAssets = assets.filter((asset) => asset.lifecycle.warrantyStatus === "OutOfWarranty").length;
  const nonCompliantDiscoveryCoverage = assets.filter(
    (asset) => !discoveryCoverageForAsset(asset).coverageCompliance
  ).length;

  return {
    nonCompliantAssets,
    nonCompliantServers,
    nonCompliantOs,
    nonCompliantEnvironments,
    p12Findings: p12Findings.length,
    highRiskP12Findings,
    outOfWarrantyAssets,
    nonCompliantDiscoveryCoverage
  };
}

export default async function NetworkDetailPage({
  params,
  searchParams
}: {
  params: { networkId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const requestParams = searchParams ?? {};
  const [dataset, snapshots, measuresSettings] = await Promise.all([
    loadCurrentDataset(),
    loadLatestSnapshots(12),
    loadMeasuresSettings()
  ]);
  const network = dataset.managedNetworks.find((item) => item.id === params.networkId);

  if (!network) {
    notFound();
  }

  const analytics = buildAnalytics(dataset, dataset.ictSystems, { managedNetwork: network.id }, measuresSettings);
  const assets = dataset.assets.filter((asset) => asset.networkId === network.id);
  const findings = analytics.findings;
  const p12Findings = findings.filter((finding) => finding.priorityRank <= 2);
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
  const evaluationByAssetId = new Map(analytics.evaluations.map((evaluation) => [evaluation.assetId, evaluation]));
  const p12AssetIds = new Set(p12Findings.map((finding) => finding.scope.assetId));
  const highRiskP12AssetIds = new Set(
    p12Findings.filter((finding) => finding.severity === "High Risk").map((finding) => finding.scope.assetId)
  );
  const nonCompliantEnvironmentTypes = new Set(
    (["Production", "Development", "UAT", "Test"] as const).filter((environmentType) => {
      const statuses = analytics.evaluations
        .filter((evaluation) => evaluation.environmentType === environmentType)
        .flatMap((evaluation) => evaluation.evaluations.map((evaluationItem) => evaluationItem.status));
      return overallStatusFromStatuses(statuses) === "Non-compliant";
    })
  );

  const matchesSelectedKpiFilter = (asset: (typeof assets)[number]): boolean => {
    if (!selectedKpiFilter) {
      return true;
    }
    if (selectedKpiFilter === "nonCompliantAssets") {
      const evaluation = evaluationByAssetId.get(asset.id);
      if (!evaluation) {
        return false;
      }
      return evaluation.evaluations.some((evaluationItem) => evaluationItem.status === "Non-compliant");
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
      return p12AssetIds.has(asset.id);
    }
    if (selectedKpiFilter === "highRiskP12Findings") {
      return highRiskP12AssetIds.has(asset.id);
    }
    if (selectedKpiFilter === "outOfWarrantyAssets") {
      return asset.lifecycle.warrantyStatus === "OutOfWarranty";
    }
    if (selectedKpiFilter === "nonCompliantDiscoveryCoverage") {
      return !discoveryCoverageForAsset(asset).coverageCompliance;
    }
    return true;
  };

  const filteredAssets = selectedKpiFilter ? assets.filter((asset) => matchesSelectedKpiFilter(asset)) : assets;
  const filteredAssetIds = new Set(filteredAssets.map((asset) => asset.id));
  const coveragePageState = parsePageState(requestParams, "page", "pageSize");
  const inventoryPageState = parsePageState(requestParams, "inventoryPage", "inventoryPageSize");
  const filteredFindings = findings.filter((finding) => filteredAssetIds.has(finding.scope.assetId));
  const filteredP12Findings = filteredFindings.filter((finding) => finding.priorityRank <= 2);
  const p12SpiOptions = Array.from(new Set(filteredP12Findings.map((finding) => finding.spiId))).sort((a, b) => a - b);
  const p12PriorityOptions = Array.from(new Set(filteredP12Findings.map((finding) => finding.priorityRank))).sort(
    (a, b) => a - b
  );
  const p12SeverityOptions = Array.from(new Set(filteredP12Findings.map((finding) => finding.severity)));
  const p12SectionFindings = filteredP12Findings.filter((finding) => {
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
    return query ? `/networks/${network.id}?${query}#p12-findings` : `/networks/${network.id}#p12-findings`;
  })();
  const p12CountByAsset = filteredP12Findings.reduce((map, finding) => {
    map.set(finding.scope.assetId, (map.get(finding.scope.assetId) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  const statuses = analytics.evaluations
    .filter((evaluation) => filteredAssetIds.has(evaluation.assetId))
    .flatMap((evaluation) => evaluation.evaluations.map((item) => item.status));
  const networkComplianceScore = complianceScore(statuses);
  const selectedPosture = overallStatusFromStatuses(statuses);

  const metricsBySnapshotDate = new Map<string, NetworkKpiSnapshotMetrics>();
  const snapshotMetrics = (snapshot: Dataset) => {
    const cached = metricsBySnapshotDate.get(snapshot.snapshotDate);
    if (cached) {
      return cached;
    }
    const computed = buildNetworkKpiSnapshotMetrics(snapshot, network.id, measuresSettings);
    metricsBySnapshotDate.set(snapshot.snapshotDate, computed);
    return computed;
  };

  const currentKpis = snapshotMetrics(dataset);
  const nonCompliantAssetCount = currentKpis.nonCompliantAssets;
  const nonCompliantOsCount = currentKpis.nonCompliantOs;
  const p12FindingsCount = currentKpis.p12Findings;
  const highRiskP12Count = currentKpis.highRiskP12Findings;
  const outOfWarrantyAssetCount = currentKpis.outOfWarrantyAssets;
  const nonCompliantDiscoveryCoverageCount = currentKpis.nonCompliantDiscoveryCoverage;

  const snapshotByDate = new Map<string, Dataset>();
  for (const snapshot of snapshots) {
    snapshotByDate.set(snapshot.snapshotDate, snapshot);
  }
  snapshotByDate.set(dataset.snapshotDate, dataset);

  const last12Snapshots = Array.from(snapshotByDate.values())
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
    .slice(-12);

  const kpiTrendSeries = last12Snapshots.map((snapshot, index) => {
    const metrics = snapshotMetrics(snapshot);
    return {
      weekLabel: `W${String(last12Snapshots.length - index).padStart(2, "0")}`,
      ...metrics
    };
  });

  const trendPointsFor = (key: keyof NetworkKpiSnapshotMetrics) =>
    kpiTrendSeries.map((point) => ({
      label: point.weekLabel,
      value: point[key]
    }));

  const nonCompliantAssetsTrend = trendPointsFor("nonCompliantAssets");
  const nonCompliantOsTrend = trendPointsFor("nonCompliantOs");
  const p12FindingsTrend = trendPointsFor("p12Findings");
  const highRiskP12Trend = trendPointsFor("highRiskP12Findings");
  const outOfWarrantyTrend = trendPointsFor("outOfWarrantyAssets");
  const nonCompliantDiscoveryCoverageTrend = trendPointsFor("nonCompliantDiscoveryCoverage");

  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];

  const latestAssetMap = new Map(latest.assets.map((asset) => [asset.id, asset]));
  const previousAssetMap = new Map(previous.assets.map((asset) => [asset.id, asset]));

  const changedAssets = filteredAssets.filter((asset) => {
    const before = previousAssetMap.get(asset.id);
    const after = latestAssetMap.get(asset.id);
    if (!before || !after) {
      return true;
    }
    const beforeCritical = before.vulnerabilities.filter((v) => v.severity === "Critical").length;
    const afterCritical = after.vulnerabilities.filter((v) => v.severity === "Critical").length;
    return beforeCritical !== afterCritical;
  });
  const discoveryCoverageRows = filteredAssets
    .map((asset) => {
      const coverage = discoveryCoverageForAsset(asset);
      return {
        assetId: asset.id,
        hostname: asset.hostname,
        assetType: asset.type,
        environment: asset.systemContext?.environmentType ?? "-",
        ucmdb: coverage.ucmdb,
        tanium: coverage.tanium,
        tenable: coverage.tenable,
        seviceNow: coverage.seviceNow,
        coverageCompliance: coverage.coverageCompliance
      };
    })
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
  const coverageRowsPage = paginate(discoveryCoverageRows, coveragePageState.page, coveragePageState.pageSize);
  const inventoryRowsPage = paginate(filteredAssets, inventoryPageState.page, inventoryPageState.pageSize);

  const scopedPageHref = (updates: Record<string, string | undefined>, hash?: string) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(requestParams)) {
      if (!value) {
        continue;
      }
      query.set(key, Array.isArray(value) ? value[0] : value);
    }
    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        query.delete(key);
      } else {
        query.set(key, value);
      }
    }
    const params = query.toString();
    const href = params ? `/networks/${network.id}?${params}` : `/networks/${network.id}`;
    return hash ? `${href}#${hash}` : href;
  };

  const kpiFilterHref = (kpiFilter?: KpiFilterKey) => {
    const query = new URLSearchParams();
    if (kpiFilter) {
      query.set("kpiFilter", kpiFilter);
    }
    const params = query.toString();
    return params ? `/networks/${network.id}?${params}` : `/networks/${network.id}`;
  };

  const remediationReportHref = (() => {
    const query = new URLSearchParams();
    if (selectedKpiFilter) {
      query.set("kpiFilter", selectedKpiFilter);
    }
    const params = query.toString();
    return params
      ? `/api/networks/${network.id}/remediation-report?${params}`
      : `/api/networks/${network.id}/remediation-report`;
  })();

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/networks" className="text-xs text-sky-200 underline">
              Back to Networks
            </Link>
            <h1 className="mt-2 text-3xl font-semibold text-slate-100">{network.name}</h1>
            <div className="mt-3 flex flex-wrap gap-3">
              <PostureBadge status={selectedPosture} />
              <span className="rounded-full border border-sky-400/25 px-3 py-1 text-xs text-slate-200">
                Classification: {network.classification}
              </span>
              <span className="rounded-full border border-sky-400/25 px-3 py-1 text-xs text-slate-200">
                Assets: {filteredAssets.length}
              </span>
            </div>
          </div>

          <div className="panel-alt min-w-[210px] self-stretch border-sky-300/25 p-4 lg:self-auto">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Compliance Score</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-200">{networkComplianceScore}%</p>
            <p className="mt-1 text-xs text-slate-300/80">
              {selectedKpiFilter ? "Network scope with KPI filter" : "Network scope"}
            </p>
            {selectedKpiFilter ? (
              <p className="mt-2 text-[11px] text-sky-200/90">{KPI_FILTER_LABELS[selectedKpiFilter]}</p>
            ) : (
              <p className="mt-2 text-[11px] text-sky-200/90">Aligned to current drill-through context</p>
            )}
          </div>
        </div>
      </section>

      <section className="panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Remediation Report</h2>
            <p className="mt-1 text-sm text-slate-300/85">
              Generate a remediation report for this network using the current drill-through scope.
            </p>
            <p className="mt-1 text-xs text-slate-300/75">
              Includes network summary, scoped compliance score, findings register entries, and recommended
              remediation actions.
            </p>
          </div>
          <a
            href={remediationReportHref}
            className="inline-flex items-center justify-center rounded-md border border-amber-300/45 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/25"
          >
            Generate Remediation Report
          </a>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">KPI Snapshot</h2>
        <p className="mt-1 text-xs text-slate-300/80">
          Calculated for network scope. Select a tile to filter the whole page. Charts show the last 12
          weeks.
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
            href={selectedKpiFilter === "nonCompliantAssets" ? kpiFilterHref() : kpiFilterHref("nonCompliantAssets")}
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-red-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "nonCompliantAssets" ? "ring-2 ring-red-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Total Non-compliant Assets</p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{nonCompliantAssetCount}</p>
            <MiniTrendSparkline points={nonCompliantAssetsTrend} stroke="#ef4444" />
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
            href={selectedKpiFilter === "p12Findings" ? kpiFilterHref() : kpiFilterHref("p12Findings")}
            scroll={false}
            data-filter-loading="true"
            data-filter-loading-message="Applying KPI filter..."
            className={`panel-alt border-red-400/25 p-3 transition hover:bg-slate-900/70 ${
              selectedKpiFilter === "p12Findings" ? "ring-2 ring-red-300/65" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Total P1-P2 Findings</p>
            <p className="mt-1 text-2xl font-semibold text-red-100">{p12FindingsCount}</p>
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
            href={selectedKpiFilter === "outOfWarrantyAssets" ? kpiFilterHref() : kpiFilterHref("outOfWarrantyAssets")}
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
          Asset Discovery Coverage (Network Scope)
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
                <th className="px-3 py-2">SeviceNow</th>
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
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-300/80">
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
                  href={scopedPageHref({ page: String(coverageRowsPage.currentPage - 1) }, "asset-discovery-coverage")}
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
                  href={scopedPageHref({ page: String(coverageRowsPage.currentPage + 1) }, "asset-discovery-coverage")}
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
        <h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
          Asset Inventory
        </h2>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">System</th>
                <th className="px-3 py-2">Env</th>
                <th className="px-3 py-2">Critical Vulns</th>
                <th className="px-3 py-2">P1-2 Findings</th>
              </tr>
            </thead>
            <tbody>
              {inventoryRowsPage.items.map((asset) => (
                <tr key={asset.id} className="border-t border-sky-400/10">
                  <td className="px-3 py-2 text-slate-100">{asset.hostname}</td>
                  <td className="px-3 py-2 text-slate-300">{asset.type}</td>
                  <td className="px-3 py-2 text-slate-300">{asset.systemContext?.systemId ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-300">{asset.systemContext?.environmentType ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-200">
                    {asset.vulnerabilities.filter((v) => v.severity === "Critical").length}
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
              {inventoryRowsPage.totalItems === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-300/80">
                    No assets in this scope.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {inventoryRowsPage.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-400/10 px-4 py-3 text-xs text-slate-300/85">
            <p>
              Showing {(inventoryRowsPage.currentPage - 1) * inventoryRowsPage.pageSize + 1}-
              {Math.min(inventoryRowsPage.currentPage * inventoryRowsPage.pageSize, inventoryRowsPage.totalItems)} of{" "}
              {inventoryRowsPage.totalItems}
            </p>
            <div className="flex items-center gap-2">
              {inventoryRowsPage.currentPage > 1 ? (
                <a
                  href={scopedPageHref(
                    { inventoryPage: String(inventoryRowsPage.currentPage - 1) },
                    "asset-inventory"
                  )}
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
                Page {inventoryRowsPage.currentPage} of {inventoryRowsPage.totalPages}
              </span>
              {inventoryRowsPage.currentPage < inventoryRowsPage.totalPages ? (
                <a
                  href={scopedPageHref(
                    { inventoryPage: String(inventoryRowsPage.currentPage + 1) },
                    "asset-inventory"
                  )}
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

      <section id="p12-findings" className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-400/15 px-4 py-3">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">P1-2 Findings (All Environments)</h2>
        </div>
        <div className="border-b border-sky-400/10 px-4 py-3">
          <form
            action={`/networks/${network.id}#p12-findings`}
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
                    SPI {option} - {SPI_DESCRIPTIONS[option as keyof typeof SPI_DESCRIPTIONS]}
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
        <div className="max-h-[420px] overflow-auto p-4">
          <ul className="space-y-2 text-sm">
            {p12SectionFindings.slice(0, 80).map((finding) => (
              <li key={finding.id} className="panel-alt p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">
                  P{finding.priorityRank} | SPI {finding.spiId} | {finding.severity}
                </p>
                <p className="mt-1 text-slate-100">{finding.title}</p>
                <p className="mt-1 text-xs text-slate-300/75">{finding.scope.assetId}</p>
              </li>
            ))}
            {p12SectionFindings.length === 0 ? (
              <li className="panel-alt p-3 text-sm text-emerald-200/90">
                No P1-2 findings match the selected SPI, Priority, Severity, and text search filters.
              </li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
