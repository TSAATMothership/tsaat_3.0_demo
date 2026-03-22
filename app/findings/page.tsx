import { FilterBar } from "@/components/filter-bar";
import { FindingsHistoryDrillthrough } from "@/components/findings-history-drillthrough";
import { FindingsStatusTabs } from "@/components/findings-status-tabs";
import { FindingsTimelineFilter } from "@/components/findings-timeline-filter";
import { FindingsTable } from "@/components/findings-table";
import { FindingsViewTabId, FindingsViewTabs } from "@/components/findings-view-tabs";
import { getCoreAppData } from "@/lib/app-data";
import { SPI_DESCRIPTIONS } from "@/lib/constants";
import { workflowStatusAtAsOf } from "@/lib/finding-status";
import { Finding } from "@/lib/types";

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
  const { analytics, dataset, filterOptions, filters } = await getCoreAppData(searchParams);
  const today = isDateOnly(dataset.snapshotDate) ? dataset.snapshotDate : new Date().toISOString().slice(0, 10);
  const historyStartDate = new Date(`${today}T00:00:00.000Z`);
  historyStartDate.setUTCFullYear(historyStartDate.getUTCFullYear() - 2);
  const historyStart = historyStartDate.toISOString().slice(0, 10);
  const requestedAsOf = firstParam(searchParams.asOf)?.trim();
  const selectedAsOf = isDateOnly(requestedAsOf) ? clampDateOnly(requestedAsOf, historyStart, today) : today;
  const requestedTab = firstParam(searchParams.findingsTab)?.trim().toLowerCase();
  const selectedStatus: "open" | "closed" = requestedTab === "closed" ? "closed" : "open";
  const requestedViewTab = firstParam(searchParams.findingsViewTab)?.trim().toLowerCase();
  const activeViewTab: FindingsViewTabId = requestedViewTab === "register" ? "register" : "overview";

  const requestedSpi = Number(firstParam(searchParams.spi));
  const selectedSpi = Number.isInteger(requestedSpi) && requestedSpi >= 1 && requestedSpi <= 10 ? requestedSpi : undefined;
  const requestedPriority = Number(firstParam(searchParams.priority));
  const selectedPriority =
    Number.isInteger(requestedPriority) && requestedPriority >= 1 && requestedPriority !== 90
      ? requestedPriority
      : undefined;
  const requestedPage = Number(firstParam(searchParams.page));
  const selectedPage = Number.isInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1;
  const selectedSeverity = firstParam(searchParams.severity)?.trim() || undefined;
  const selectedSearchTerm = firstParam(searchParams.search)?.trim() ?? "";
  const normalizedSearchTerm = selectedSearchTerm.toLowerCase();
  const spiCatalog = Object.keys(SPI_DESCRIPTIONS)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))
    .sort((a, b) => a - b);

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

  const timelineStatusByFindingId = new Map<string, "open" | "closed">();

  const matchesActiveFindingFilters = (finding: Finding) => {
    if (!matchesBaseFindingFilters(finding)) {
      return false;
    }
    const timelineStatus = timelineStatusByFindingId.get(finding.id);
    if (!timelineStatus) {
      return false;
    }
    if (selectedStatus && timelineStatus !== selectedStatus) {
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
  const spiHistoryPoints: Array<Record<string, string | number>> = [];
  let spiCursor = historyStart;
  while (spiCursor <= today) {
    const row: Record<string, string | number> = { date: spiCursor };
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

  const timelineFindings = analytics.findings.filter((finding) => {
    const timelineStatus = workflowStatusAtAsOf(finding, selectedAsOf);
    if (!timelineStatus) {
      return false;
    }
    timelineStatusByFindingId.set(finding.id, timelineStatus);
    return true;
  });
  const severityOptions = Array.from(new Set(timelineFindings.map((finding) => finding.severity)));

  const findings = timelineFindings.filter(matchesActiveFindingFilters);

  const spiOptions = Array.from(new Set(timelineFindings.map((finding) => finding.spiId))).sort((a, b) => a - b);
  const priorityOptions = Array.from(
    new Set(timelineFindings.map((finding) => finding.priorityRank).filter((priorityRank) => priorityRank !== 90))
  ).sort((a, b) => a - b);
  const findingsFilterExtraSelects = [
    ...(activeViewTab === "overview"
      ? [
          {
            key: "spi",
            label: "Security Posture Indicators",
            value: selectedSpi ? String(selectedSpi) : undefined,
            options: spiOptions.map((spi) => ({
              id: String(spi),
              label: `SPI ${spi} - ${SPI_DESCRIPTIONS[spi as keyof typeof SPI_DESCRIPTIONS]}`
            }))
          }
        ]
      : []),
    {
      key: "priority",
      label: "Priority",
      value: selectedPriority ? String(selectedPriority) : undefined,
      options: priorityOptions.map((priority) => ({ id: String(priority), label: `P${priority}` }))
    },
    {
      key: "severity",
      label: "Severity",
      value: selectedSeverity,
      options: severityOptions.map((severity) => ({ id: severity, label: severity }))
    }
  ];

  const highRisk = findings.filter((finding) => finding.severity === "High Risk").length;
  const totalFindings = findings.length;
  const openTabPageSize = 10;
  const shouldPaginateFindings = true;
  const findingsTotalPages = shouldPaginateFindings ? Math.max(1, Math.ceil(totalFindings / openTabPageSize)) : 1;
  const findingsCurrentPage = shouldPaginateFindings ? Math.min(selectedPage, findingsTotalPages) : 1;
  const paginatedFindings = shouldPaginateFindings
    ? findings.slice((findingsCurrentPage - 1) * openTabPageSize, findingsCurrentPage * openTabPageSize)
    : findings;
  const criticalExposure = findings.filter((finding) => finding.severity === "Critical Exposure").length;
  const p1P2Findings = findings.filter((finding) => finding.priorityRank <= 2).length;
  const assetTypeSummaries = [
    { id: "server", label: "Server" },
    { id: "workstation", label: "Workstation" },
    { id: "network-device", label: "Network Device" }
  ].map((assetType) => {
    const typeFindings = findings.filter((finding) => String(finding.evidence.assetType ?? "") === assetType.id);
    return {
      ...assetType,
      totalFindings: typeFindings.length,
      highRisk: typeFindings.filter((finding) => finding.severity === "High Risk").length,
      criticalExposure: typeFindings.filter((finding) => finding.severity === "Critical Exposure").length,
      p1P2Findings: typeFindings.filter((finding) => finding.priorityRank <= 2).length
    };
  });
  const openFindingsForSpiSummary = timelineFindings.filter(
    (finding) => matchesBaseFindingFilters(finding) && timelineStatusByFindingId.get(finding.id) === "open"
  );
  const openFindingsBySpiSummary = spiCatalog.map((spiId) => {
    const spiFindings = openFindingsForSpiSummary.filter((finding) => finding.spiId === spiId);
    const criticalExposureCount = spiFindings.filter((finding) => finding.severity === "Critical Exposure").length;
    const highRiskCount = spiFindings.filter((finding) => finding.severity === "High Risk").length;
    const otherCount = Math.max(spiFindings.length - criticalExposureCount - highRiskCount, 0);

    return {
      spiId,
      description: SPI_DESCRIPTIONS[spiId as keyof typeof SPI_DESCRIPTIONS],
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

  return (
    <div className="relative left-1/2 -my-5 flex h-[calc(100vh-11rem)] w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden md:-my-8 md:h-[calc(100vh-12rem)] md:w-[min(2100px,calc(100vw-3rem))]">
      <section className="panel shrink-0 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Findings Register</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">Findings and Evidence</h1>
        <p className="mt-1 text-sm text-slate-300/80">
          Prioritized register with SPI alignment, scope, and remediation guidance across the current filtered context.
        </p>
      </section>

      <FindingsViewTabs activeTab={activeViewTab} />

      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          className={`grid h-full min-h-0 gap-2 ${
            activeViewTab === "overview"
              ? "grid-rows-[auto_auto_auto_auto_minmax(0,1fr)]"
              : "grid-rows-[auto_auto_auto_minmax(0,1fr)]"
          }`}
        >
          <FindingsStatusTabs activeTab={selectedStatus} />

          {activeViewTab === "overview" ? (
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
            />
          ) : null}

          <FindingsTimelineFilter selectedAsOf={selectedAsOf} minDate={historyStart} maxDate={today} />

          <FilterBar
            options={filterOptions}
            filters={filters}
            extraSelectFields={findingsFilterExtraSelects}
            enableLoadingOverlay
          />

          {activeViewTab === "overview" ? (
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
              <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="panel p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-200">Total Findings</p>
                  <p className="mt-1 text-3xl font-semibold">{totalFindings}</p>
                </div>
                <div className="panel p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-red-300">Critical Exposure</p>
                  <p className="mt-1 text-3xl font-semibold">{criticalExposure}</p>
                </div>
                <div className="panel p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-orange-200">High Risk</p>
                  <p className="mt-1 text-3xl font-semibold">{highRisk}</p>
                </div>
                <div className="panel p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-sky-200">P1-P2 Findings</p>
                  <p className="mt-1 text-3xl font-semibold">{p1P2Findings}</p>
                </div>
              </section>

              <div className="min-h-0 overflow-auto pr-1">
                <section className="grid gap-2 xl:grid-cols-2">
                  <article className="panel p-4">
                    <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Assets by Asset Type</h2>
                    <p className="mt-1 text-xs text-slate-300/80">
                      Findings breakdown by asset type in the current filtered scope.
                    </p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-900/60 text-left text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
                          <tr>
                            <th className="px-3 py-2">Asset Type</th>
                            <th className="px-3 py-2">Total Findings</th>
                            <th className="px-3 py-2">Critical Exposure</th>
                            <th className="px-3 py-2">High Risk</th>
                            <th className="px-3 py-2">P1-P2 Findings</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assetTypeSummaries.map((summary) => (
                            <tr key={summary.id} className="border-t border-sky-400/10">
                              <td className="px-3 py-2 text-slate-100">{summary.label}</td>
                              <td className="px-3 py-2 text-slate-200">{summary.totalFindings}</td>
                              <td className="px-3 py-2 text-orange-100">{summary.criticalExposure}</td>
                              <td className="px-3 py-2 text-red-100">{summary.highRisk}</td>
                              <td className="px-3 py-2 text-amber-100">{summary.p1P2Findings}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="panel p-4">
                    <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">
                      Security Posture Indicator Summary
                    </h2>
                    <p className="mt-1 text-xs text-slate-300/80">
                      Total open findings by SPI at the selected findings timeline date.
                    </p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-900/60 text-left text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
                          <tr>
                            <th className="px-3 py-2">SPI</th>
                            <th className="px-3 py-2">Description</th>
                            <th className="px-3 py-2">Open Findings Mix</th>
                          </tr>
                        </thead>
                        <tbody>
                          {openFindingsBySpiSummary.map((row) => (
                            <tr key={row.spiId} className="border-t border-sky-400/10">
                              <td className="px-3 py-2 text-slate-100">SPI {row.spiId}</td>
                              <td className="px-3 py-2 text-slate-200">{row.description}</td>
                              <td className="px-3 py-2">
                                <div className="w-[260px] max-w-full">
                                  <div className="overflow-hidden rounded-full border border-sky-300/20 bg-slate-950/60">
                                    <div className="flex h-2.5 w-full">
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
                                  <p className="mt-1 text-[11px] text-slate-300/80">
                                    Total {row.totalOpenFindings} | CE {row.criticalExposureCount} | HR {row.highRiskCount}
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
                findings={paginatedFindings}
                findingsForDrillthrough={findings}
                searchParams={searchParams}
                selectedAsOf={selectedAsOf}
                selectedSpi={selectedSpi}
                selectedStatus={selectedStatus}
                selectedSearchTerm={selectedSearchTerm}
                spiOptions={spiOptions}
                pagination={
                  shouldPaginateFindings
                    ? {
                        currentPage: findingsCurrentPage,
                        totalPages: findingsTotalPages,
                        pageSize: openTabPageSize,
                        totalItems: totalFindings
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
