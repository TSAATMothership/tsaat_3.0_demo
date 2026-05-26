import { FilterBar } from "@/components/filter-bar";
import { FindingsHistoryDrillthrough } from "@/components/findings-history-drillthrough";
import { FindingsStatusTabs } from "@/components/findings-status-tabs";
import { FindingsTimelineFilter } from "@/components/findings-timeline-filter";
import { FindingsTable } from "@/components/findings-table";
import { FindingsViewTabId, FindingsViewTabs } from "@/components/findings-view-tabs";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { getCoreAppData } from "@/lib/app-data";
import { ASSET_TYPES, assetTypeLabel } from "@/lib/asset-taxonomy";
import { buildCveVulnerabilityIndexByAssetId } from "@/lib/cve";
import { loadSnapshotEffectiveFindings } from "@/lib/data-loader";
import {
  findingBucketsOfType,
  findingMatchesBucket,
  toneTextClass
} from "@/lib/findings-config";
import { Finding } from "@/lib/types";

interface SpiHistoryPoint {
  date: string;
  [key: `spi${number}`]: number | string;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isDateOnly(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

function findingMatchesSearch(
  finding: Finding,
  normalizedSearchTerm: string
) {
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

function addUtcDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clampDateOnly(value: string, min: string, max: string): string {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export default async function FindingsPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const requestedViewTab = firstParam(searchParams.findingsViewTab)?.trim().toLowerCase();
  const activeViewTab: FindingsViewTabId = requestedViewTab === "register" ? "register" : "overview";
  const effectiveSearchParams =
    activeViewTab === "overview"
      ? {
          ...searchParams,
          criticality: undefined
        }
      : searchParams;
  const { analytics, dataset, filterOptions, filters, spiDefinitions, severityDefinitions, findingDisplayConfiguration } =
    await getCoreAppData(effectiveSearchParams, { profile: "risk-summary" });
  const today = isDateOnly(dataset.snapshotDate) ? dataset.snapshotDate : new Date().toISOString().slice(0, 10);
  const historyStartDate = new Date(`${today}T00:00:00.000Z`);
  historyStartDate.setUTCFullYear(historyStartDate.getUTCFullYear() - 2);
  const historyStart = historyStartDate.toISOString().slice(0, 10);
  const requestedAsOf = firstParam(searchParams.asOf)?.trim();
  const selectedAsOf = isDateOnly(requestedAsOf) ? clampDateOnly(requestedAsOf, historyStart, today) : today;
  const requestedTab = firstParam(searchParams.findingsTab)?.trim().toLowerCase();
  const selectedStatus: "open" | "closed" = requestedTab === "closed" ? "closed" : "open";
  const requestedSpi = Number(firstParam(searchParams.spi));
  const selectedSpi = spiDefinitions.some((definition) => definition.spiId === requestedSpi) ? requestedSpi : undefined;
  const requestedPriority = Number(firstParam(searchParams.priority));
  const selectedPriority =
    Number.isInteger(requestedPriority) && requestedPriority >= 1 && requestedPriority !== 90
      ? requestedPriority
      : undefined;
  const selectedSeverity = firstParam(searchParams.severity)?.trim() || undefined;
  const selectedSearchTerm = firstParam(searchParams.search)?.trim() ?? "";
  const normalizedSearchTerm = selectedSearchTerm.toLowerCase();
  const spiCatalog = spiDefinitions.map((definition) => definition.spiId);
  const spiDefinitionById = new Map(spiDefinitions.map((definition) => [definition.spiId, definition]));

  const matchesBaseFindingFilters = (finding: Finding) => {
    if (selectedSpi && finding.spiId !== selectedSpi) {
      return false;
    }
    if (selectedPriority && finding.priorityRank !== selectedPriority) {
      return false;
    }
    if (selectedSeverity && finding.severity !== selectedSeverity) {
      return false;
    }
    if (!findingMatchesSearch(finding, normalizedSearchTerm)) {
      return false;
    }
    return true;
  };

  const matchesActiveFindingFilters = (finding: Finding) => {
    if (!matchesBaseFindingFilters(finding)) {
      return false;
    }
    if (selectedStatus && finding.status !== selectedStatus) {
      return false;
    }
    return true;
  };

  const historyFindings = analytics.findings.filter(matchesBaseFindingFilters);
  const openedByDate = new Map<string, number>();
  const closedByDate = new Map<string, number>();
  let openingBalance = 0;

  for (const finding of historyFindings) {
    const openedDate = finding.timestamp.slice(0, 10);
    const closedDate = finding.closedTimestamp?.slice(0, 10);

    if (selectedStatus === "open") {
      if (openedDate < historyStart) {
        if (!closedDate || closedDate >= historyStart) {
          openingBalance += 1;
        }
      } else if (openedDate <= today) {
        openedByDate.set(openedDate, (openedByDate.get(openedDate) ?? 0) + 1);
      }

      if (closedDate && closedDate >= historyStart && closedDate <= today) {
        closedByDate.set(closedDate, (closedByDate.get(closedDate) ?? 0) + 1);
      }
      continue;
    }

    if (closedDate && closedDate < historyStart && openedDate <= historyStart) {
      openingBalance += 1;
    }
    if (closedDate && closedDate >= historyStart && closedDate <= today) {
      closedByDate.set(closedDate, (closedByDate.get(closedDate) ?? 0) + 1);
    }
  }

  const findingsHistoryPoints: Array<{ date: string; openFindings: number }> = [];
  let cursor = historyStart;
  let runningOpenFindings = openingBalance;
  while (cursor <= today) {
    if (selectedStatus === "open") {
      runningOpenFindings += openedByDate.get(cursor) ?? 0;
      runningOpenFindings -= closedByDate.get(cursor) ?? 0;
    } else {
      runningOpenFindings += closedByDate.get(cursor) ?? 0;
    }
    findingsHistoryPoints.push({
      date: cursor,
      openFindings: Math.max(0, runningOpenFindings)
    });
    cursor = addUtcDays(cursor, 1);
  }

  const spiHistoryState = new Map(
    spiCatalog.map((spiId) => [
      spiId,
      {
        openedByDate: new Map<string, number>(),
        closedByDate: new Map<string, number>(),
        openingBalance: 0
      }
    ])
  );

  for (const finding of historyFindings) {
    const state = spiHistoryState.get(finding.spiId);
    if (!state) {
      continue;
    }
    const openedDate = finding.timestamp.slice(0, 10);
    const closedDate = finding.closedTimestamp?.slice(0, 10);

    if (selectedStatus === "open") {
      if (openedDate < historyStart) {
        if (!closedDate || closedDate >= historyStart) {
          state.openingBalance += 1;
        }
      } else if (openedDate <= today) {
        state.openedByDate.set(openedDate, (state.openedByDate.get(openedDate) ?? 0) + 1);
      }
      if (closedDate && closedDate >= historyStart && closedDate <= today) {
        state.closedByDate.set(closedDate, (state.closedByDate.get(closedDate) ?? 0) + 1);
      }
      continue;
    }

    if (closedDate && closedDate < historyStart && openedDate <= historyStart) {
      state.openingBalance += 1;
    }
    if (closedDate && closedDate >= historyStart && closedDate <= today) {
      state.closedByDate.set(closedDate, (state.closedByDate.get(closedDate) ?? 0) + 1);
    }
  }

  const spiRunningById = new Map(
    spiCatalog.map((spiId) => [spiId, spiHistoryState.get(spiId)?.openingBalance ?? 0])
  );
  const spiHistoryPoints: SpiHistoryPoint[] = [];
  let spiCursor = historyStart;
  while (spiCursor <= today) {
    const row: SpiHistoryPoint = { date: spiCursor };
    for (const spiId of spiCatalog) {
      const state = spiHistoryState.get(spiId);
      if (!state) {
        continue;
      }
      let running = spiRunningById.get(spiId) ?? 0;
      if (selectedStatus === "open") {
        running += state.openedByDate.get(spiCursor) ?? 0;
        running -= state.closedByDate.get(spiCursor) ?? 0;
      } else {
        running += state.closedByDate.get(spiCursor) ?? 0;
      }
      running = Math.max(0, running);
      spiRunningById.set(spiId, running);
      row[`spi${spiId}`] = running;
    }
    spiHistoryPoints.push(row);
    spiCursor = addUtcDays(spiCursor, 1);
  }

  const filteredAssetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
  const timelineFindings = (dataset.snapshotId
    ? await loadSnapshotEffectiveFindings(dataset.snapshotId, selectedAsOf)
    : analytics.findings
  ).filter((finding) => filteredAssetIds.has(finding.scope.assetId));
  const severityOptions = severityDefinitions.map((definition) => definition.severityKey);

  const findings = timelineFindings.filter(matchesActiveFindingFilters);

  const spiOptions = Array.from(new Set(timelineFindings.map((finding) => finding.spiId))).sort((a, b) => a - b);
  const priorityOptions = Array.from(
    new Set(timelineFindings.map((finding) => finding.priorityRank).filter((priorityRank) => priorityRank !== 90))
  ).sort((a, b) => a - b);
  const priorityFilterSelect = {
    key: "priority",
    label: "Priority",
    value: selectedPriority ? String(selectedPriority) : undefined,
    options: priorityOptions.map((priority) => ({ id: String(priority), label: `P${priority}` }))
  };
  const findingsFilterExtraSelects =
    activeViewTab === "overview"
      ? [
          {
            key: "spi",
            label: "Security Posture Indicators",
            value: selectedSpi ? String(selectedSpi) : undefined,
            options: spiOptions.map((spi) => ({
              id: String(spi),
              label: `SPI ${spi} - ${spiDefinitionById.get(spi)?.description ?? "Unmapped SPI"}`
            }))
          },
          priorityFilterSelect,
          {
            key: "severity",
            label: "Severity",
            value: selectedSeverity,
            options: severityOptions.map((severity) => ({ id: severity, label: severity }))
          }
        ]
      : [priorityFilterSelect];

  const totalFindings = findings.length;
  const featuredSeverityBuckets = findingBucketsOfType(findingDisplayConfiguration, "severity").filter(
    (bucket) => bucket.conditionKey === "severity_not_in" || bucket.displayOrder <= 2
  );
  const primarySeverityBucket = featuredSeverityBuckets.find((bucket) => bucket.conditionKey === "severity_equals");
  const secondarySeverityBucket = featuredSeverityBuckets.filter((bucket) => bucket.conditionKey === "severity_equals")[1];
  const otherSeverityBucket = featuredSeverityBuckets.find((bucket) => bucket.conditionKey === "severity_not_in");
  const bucketCount = (rows: Finding[], bucket = otherSeverityBucket) =>
    bucket ? rows.filter((finding) => findingMatchesBucket(finding, bucket)).length : 0;
  const assetTypeSummaries = ASSET_TYPES.map((assetType) => {
    const typeFindings = findings.filter((finding) => String(finding.evidence.assetType ?? "") === assetType);
    const criticalExposureCount = primarySeverityBucket ? bucketCount(typeFindings, primarySeverityBucket) : 0;
    const highRiskCount = secondarySeverityBucket ? bucketCount(typeFindings, secondarySeverityBucket) : 0;
    const otherRiskCount = otherSeverityBucket
      ? bucketCount(typeFindings, otherSeverityBucket)
      : Math.max(typeFindings.length - criticalExposureCount - highRiskCount, 0);
    return {
      id: assetType,
      label: assetTypeLabel(assetType),
      totalFindings: typeFindings.length,
      highRisk: highRiskCount,
      criticalExposure: criticalExposureCount,
      otherRisk: otherRiskCount
    };
  });
  const openFindingsForSpiSummary = timelineFindings.filter(
    (finding) => matchesBaseFindingFilters(finding) && finding.status === "open"
  );
  const openFindingsBySpiSummary = spiCatalog.map((spiId) => {
    const spiFindings = openFindingsForSpiSummary.filter((finding) => finding.spiId === spiId);
    const criticalExposureCount = primarySeverityBucket ? bucketCount(spiFindings, primarySeverityBucket) : 0;
    const highRiskCount = secondarySeverityBucket ? bucketCount(spiFindings, secondarySeverityBucket) : 0;
    const otherCount = otherSeverityBucket
      ? bucketCount(spiFindings, otherSeverityBucket)
      : Math.max(spiFindings.length - criticalExposureCount - highRiskCount, 0);

    return {
      spiId,
      description: spiDefinitionById.get(spiId)?.description ?? `SPI ${spiId}`,
      totalOpenFindings: spiFindings.length,
      criticalExposureCount,
      highRiskCount,
      otherCount
    };
  });
  const maxOpenFindingsAcrossSpi = openFindingsBySpiSummary.reduce(
    (maxValue, row) => Math.max(maxValue, row.totalOpenFindings),
    0
  );
  const overviewMetricCards = [
    { label: "Total Findings", value: totalFindings, labelClass: "text-slate-200", valueClass: "text-slate-100" },
    ...featuredSeverityBuckets.map((bucket) => ({
      label: bucket.label,
      value: bucketCount(findings, bucket),
      labelClass: toneTextClass(bucket.toneKey),
      valueClass: toneTextClass(bucket.toneKey)
    }))
  ];
  const cvesByAssetId = buildCveVulnerabilityIndexByAssetId(dataset.assets);

  return (
    <div className="relative left-1/2 -my-5 flex h-[calc(100vh-11rem)] w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden md:-my-8 md:h-[calc(100vh-12rem)] md:w-[min(2100px,calc(100vw-3rem))]">
      <RouteReadyMarker pathname="/findings" searchParams={searchParams} />
      <section className="panel shrink-0 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Findings Register</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">Findings and Evidence</h1>
        <p className="mt-1 text-sm text-slate-300/80">
          Prioritized register with SPI alignment, scope, and remediation guidance across the current filtered context.
        </p>
      </section>

      <FindingsViewTabs activeTab={activeViewTab} />

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2">
          <FindingsStatusTabs activeTab={selectedStatus}>
            <FindingsTimelineFilter
              selectedAsOf={selectedAsOf}
              minDate={historyStart}
              maxDate={today}
              variant="embedded"
            />
          </FindingsStatusTabs>

          <FilterBar
            options={filterOptions}
            filters={filters}
            hiddenFields={activeViewTab === "overview" ? ["systemCriticality"] : []}
            extraSelectFields={findingsFilterExtraSelects}
            enableLoadingOverlay
            className="panel no-print flex max-h-[8.5rem] flex-wrap gap-2 overflow-y-auto p-3"
          />

          {activeViewTab === "overview" ? (
            <div className="min-h-0 overflow-auto pr-1 xl:overflow-hidden">
              <div className="grid min-h-[46rem] gap-2 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
                <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
                  <section className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
                    {overviewMetricCards.map((metric) => (
                      <div key={metric.label} className="panel p-3">
                        <p className={`text-[11px] uppercase tracking-[0.14em] ${metric.labelClass}`}>{metric.label}</p>
                        <p className={`mt-1 text-2xl font-semibold leading-none ${metric.valueClass}`}>
                          {metric.value.toLocaleString("en-US")}
                        </p>
                      </div>
                    ))}
                  </section>

                  <FindingsHistoryDrillthrough
                    points={findingsHistoryPoints}
                    status={selectedStatus}
                    spiCatalog={spiCatalog}
                    spiHistoryPoints={spiHistoryPoints}
                    selectedAsOf={selectedAsOf}
                    minDate={historyStart}
                    maxDate={today}
                    filterOptions={filterOptions}
                    filters={filters}
                    extraSelectFields={findingsFilterExtraSelects}
                    variant="compact"
                  />
                </section>

                <section className="grid min-h-0 grid-rows-[minmax(0,0.82fr)_minmax(0,1.18fr)] gap-2">
                  <article className="panel flex min-h-0 flex-col p-3">
                    <div className="shrink-0">
                      <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Assets by Asset Type</h2>
                      <p className="mt-0.5 text-xs text-slate-300/80">
                        Findings breakdown by asset type in the current filtered scope.
                      </p>
                    </div>
                    <div className="mt-2 min-h-0 overflow-auto">
                      <table className="min-w-full text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-900 text-left text-[10px] uppercase tracking-[0.12em] text-slate-300/80">
                          <tr>
                            <th className="px-2 py-1.5">Asset Type</th>
                            <th className="px-2 py-1.5 text-right">Total</th>
                            <th className="px-2 py-1.5 text-right">{primarySeverityBucket?.label ?? "Primary"}</th>
                            <th className="px-2 py-1.5 text-right">{secondarySeverityBucket?.label ?? "Secondary"}</th>
                            <th className="px-2 py-1.5 text-right">{otherSeverityBucket?.label ?? "Other"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assetTypeSummaries.map((summary) => (
                            <tr key={summary.id} className="border-t border-sky-400/10">
                              <td className="px-2 py-1.5 text-slate-100">{summary.label}</td>
                              <td className="px-2 py-1.5 text-right text-slate-200">{summary.totalFindings}</td>
                              <td className="px-2 py-1.5 text-right text-orange-100">{summary.criticalExposure}</td>
                              <td className="px-2 py-1.5 text-right text-red-100">{summary.highRisk}</td>
                              <td className="px-2 py-1.5 text-right text-sky-100">{summary.otherRisk}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="panel flex min-h-0 flex-col p-3">
                    <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">
                          Security Posture Indicator Summary
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-300/80">
                          Total open findings by SPI at the selected findings timeline date.
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.08em] text-slate-300/80">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm bg-red-500/85" />
                          {primarySeverityBucket?.label ?? "Primary"}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm bg-orange-500/85" />
                          {secondarySeverityBucket?.label ?? "Secondary"}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm bg-sky-500/85" />
                          {otherSeverityBucket?.label ?? "Other"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 min-h-0 overflow-auto">
                      <table className="min-w-full text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-900 text-left text-[10px] uppercase tracking-[0.12em] text-slate-300/80">
                          <tr>
                            <th className="px-2 py-1.5">SPI</th>
                            <th className="px-2 py-1.5">Description</th>
                            <th className="px-2 py-1.5">Open Findings Mix</th>
                          </tr>
                        </thead>
                        <tbody>
                          {openFindingsBySpiSummary.map((row) => (
                            <tr key={row.spiId} className="border-t border-sky-400/10">
                              <td className="whitespace-nowrap px-2 py-1.5 text-slate-100">SPI {row.spiId}</td>
                              <td className="px-2 py-1.5 text-slate-200">{row.description}</td>
                              <td className="px-2 py-1.5">
                                <div className="w-[210px] max-w-full">
                                  <div className="overflow-hidden rounded-full border border-sky-300/20 bg-slate-950/60">
                                    <div className="flex h-2 w-full">
                                      <div
                                        className="bg-red-500/85"
                                        style={{
                                          width: `${
                                            maxOpenFindingsAcrossSpi
                                              ? (row.criticalExposureCount / maxOpenFindingsAcrossSpi) * 100
                                              : 0
                                          }%`
                                        }}
                                      />
                                      <div
                                        className="bg-orange-500/85"
                                        style={{
                                          width: `${
                                            maxOpenFindingsAcrossSpi
                                              ? (row.highRiskCount / maxOpenFindingsAcrossSpi) * 100
                                              : 0
                                          }%`
                                        }}
                                      />
                                      <div
                                        className="bg-sky-500/85"
                                        style={{
                                          width: `${
                                            maxOpenFindingsAcrossSpi ? (row.otherCount / maxOpenFindingsAcrossSpi) * 100 : 0
                                          }%`
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <p className="mt-1 text-[10px] text-slate-300/80">
                                    Total {row.totalOpenFindings} | {primarySeverityBucket?.label ?? "Primary"}{" "}
                                    {row.criticalExposureCount} | {secondarySeverityBucket?.label ?? "Secondary"}{" "}
                                    {row.highRiskCount}
                                    {" | "}Other {row.otherCount}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                </section>
              </div>
            </div>
          ) : (
            <div className="min-h-0">
              <FindingsTable
                findings={findings}
                searchParams={searchParams}
                selectedAsOf={selectedAsOf}
                selectedSpi={selectedSpi}
                selectedPriority={selectedPriority}
                selectedSeverity={selectedSeverity}
                selectedStatus={selectedStatus}
                selectedSearchTerm={selectedSearchTerm}
                spiOptions={spiOptions}
                priorityOptions={priorityOptions}
                severityOptions={severityOptions}
                spiDefinitions={spiDefinitions}
                findingDisplayConfiguration={findingDisplayConfiguration}
                assetCvesByAssetId={cvesByAssetId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
