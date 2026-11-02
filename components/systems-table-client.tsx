"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RiskFindingsDrillThrough,
  type NetworkDetailRiskFindingRow,
  type RiskFindingsDrillThroughSelection
} from "@/components/network-detail-risk-charts";
import { DATA_DATE_PARAM, normalizeDataDate, withDataDate } from "@/lib/data-date";
import {
  dispatchSystemsBlastRadiusSelection,
  SYSTEMS_BLAST_RADIUS_SELECTION_EVENT,
  SystemsBlastRadiusSelectionDetail
} from "@/lib/systems-blast-radius-selection";
import type { HighRiskCveDetail } from "@/lib/types";

const PANEL_TWEEN_MS = 260;
type FindingBucket = "critical" | "high" | "other";

export interface SystemTableRow {
  id: string;
  name: string;
  missionCapabilities: string;
  businessServices: string;
  assetCount: number;
  criticalFindings: number;
  highFindings: number;
  otherFindings: number;
  complianceScore: number;
  discoveryComplianceScore: number;
  description: string;
  owner: string;
  supportEmail: string;
  serviceCatalogueUrl: string;
  atoNumber: string;
  diisId: string;
  diisUrl: string;
  grcUrl: string;
  apmNumber: string;
  apmUrl: string;
}

function isExternalLink(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

function ScoreBullet({ value }: { value: number }) {
  const percent = clampPercent(value);

  return (
    <div className="min-w-[7.5rem]">
      <p className="text-right text-slate-100">{percent.toFixed(1)}%</p>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full border border-sky-300/20 bg-slate-900/90">
        <div className="flex h-full w-full">
          <div className="h-full bg-emerald-400/90" style={{ width: `${percent}%` }} />
          <div className="h-full bg-rose-500/85" style={{ width: `${100 - percent}%` }} />
        </div>
      </div>
    </div>
  );
}

function findingMatchesBucket(finding: NetworkDetailRiskFindingRow, bucket: FindingBucket): boolean {
  if (bucket === "critical") {
    return finding.severity === "Critical Exposure";
  }
  if (bucket === "high") {
    return finding.severity === "High Risk";
  }
  return finding.severity !== "Critical Exposure" && finding.severity !== "High Risk";
}

function findingBucketLabel(bucket: FindingBucket): string {
  if (bucket === "critical") {
    return "Findings (Critical)";
  }
  if (bucket === "high") {
    return "Findings (High)";
  }
  return "Findings (Other)";
}

function FindingCountCell({
  count,
  bucket,
  row,
  onOpen
}: {
  count: number;
  bucket: FindingBucket;
  row: SystemTableRow;
  onOpen: (row: SystemTableRow, bucket: FindingBucket) => void;
}) {
  const textClass =
    bucket === "critical" ? "text-rose-100" : bucket === "high" ? "text-amber-100" : "text-slate-200";

  if (count <= 0) {
    return <span className="text-slate-500">0</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(row, bucket)}
      className={`${textClass} underline decoration-sky-300/45 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-200`}
      aria-label={`Open Risk Detail for ${row.name} ${findingBucketLabel(bucket)}`}
    >
      {count}
    </button>
  );
}

export function SystemsTableClient({
  rows,
  riskFindings,
  assetHighRiskCvesByAssetId = {},
  asOfDate,
  scrollable = false
}: {
  rows: SystemTableRow[];
  riskFindings: NetworkDetailRiskFindingRow[];
  assetHighRiskCvesByAssetId?: Record<string, HighRiskCveDetail[]>;
  asOfDate?: string;
  scrollable?: boolean;
}) {
  const searchParams = useSearchParams();
  const [selectedRow, setSelectedRow] = useState<SystemTableRow | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [tableSearchText, setTableSearchText] = useState("");
  const [isTableSearchFocused, setIsTableSearchFocused] = useState(false);
  const [selectedSearchRowId, setSelectedSearchRowId] = useState<string>("__all__");
  const [chartSelectedRowId, setChartSelectedRowId] = useState<string | null>(null);
  const [riskDrillThrough, setRiskDrillThrough] = useState<{
    selection: RiskFindingsDrillThroughSelection;
    allFindings: NetworkDetailRiskFindingRow[];
  } | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableSearchBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableSearchInputRef = useRef<HTMLInputElement | null>(null);
  const scopedDataDate = normalizeDataDate(searchParams?.get(DATA_DATE_PARAM));
  const chartFilteredRows = useMemo(() => {
    if (!chartSelectedRowId) {
      return rows;
    }
    return rows.filter((row) => row.id === chartSelectedRowId);
  }, [rows, chartSelectedRowId]);
  const tableSearchOptions = useMemo(() => {
    return [...chartFilteredRows].sort((left, right) => left.name.localeCompare(right.name));
  }, [chartFilteredRows]);
  const filteredTableSearchOptions = useMemo(() => {
    const normalizedSearch = tableSearchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return tableSearchOptions;
    }
    return tableSearchOptions.filter((row) => row.name.toLowerCase().includes(normalizedSearch));
  }, [tableSearchOptions, tableSearchText]);
  const visibleRows = useMemo(() => {
    if (selectedSearchRowId === "__all__") {
      return chartFilteredRows;
    }
    return chartFilteredRows.filter((row) => row.id === selectedSearchRowId);
  }, [chartFilteredRows, selectedSearchRowId]);
  const selectedChartRow = useMemo(
    () => (chartSelectedRowId ? rows.find((row) => row.id === chartSelectedRowId) ?? null : null),
    [rows, chartSelectedRowId]
  );
  const openRiskFindingsBySystemId = useMemo(() => {
    const findingsBySystemId = new Map<string, NetworkDetailRiskFindingRow[]>();
    for (const finding of riskFindings) {
      if (finding.workflowStatus !== "open" || !finding.systemId) {
        continue;
      }
      const current = findingsBySystemId.get(finding.systemId) ?? [];
      current.push(finding);
      findingsBySystemId.set(finding.systemId, current);
    }
    return findingsBySystemId;
  }, [riskFindings]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (tableSearchBlurTimerRef.current) {
        clearTimeout(tableSearchBlurTimerRef.current);
        tableSearchBlurTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (selectedSearchRowId === "__all__") {
      return;
    }
    if (!rows.some((row) => row.id === selectedSearchRowId)) {
      setSelectedSearchRowId("__all__");
      setTableSearchText("");
    }
  }, [rows, selectedSearchRowId]);

  useEffect(() => {
    if (!chartSelectedRowId) {
      return;
    }
    if (!rows.some((row) => row.id === chartSelectedRowId)) {
      setChartSelectedRowId(null);
    }
  }, [rows, chartSelectedRowId]);

  useEffect(() => {
    const onBlastRadiusSelectionChange = (event: Event) => {
      const { detail } = event as CustomEvent<SystemsBlastRadiusSelectionDetail>;
      setChartSelectedRowId(detail?.systemId ?? null);
    };

    window.addEventListener(SYSTEMS_BLAST_RADIUS_SELECTION_EVENT, onBlastRadiusSelectionChange as EventListener);
    return () => {
      window.removeEventListener(SYSTEMS_BLAST_RADIUS_SELECTION_EVENT, onBlastRadiusSelectionChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!selectedRow) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPanelOpen(false);
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
        }
        closeTimerRef.current = setTimeout(() => {
          setSelectedRow(null);
          closeTimerRef.current = null;
        }, PANEL_TWEEN_MS);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedRow]);

  const openPanel = (row: SystemTableRow) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setSelectedRow(row);
    requestAnimationFrame(() => {
      setIsPanelOpen(true);
    });
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setSelectedRow(null);
      closeTimerRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  const selectTableSearchResult = (row: SystemTableRow) => {
    setSelectedSearchRowId(row.id);
    setTableSearchText(row.name);
    setIsTableSearchFocused(false);
  };

  const clearTableSearchSelection = () => {
    setSelectedSearchRowId("__all__");
    setTableSearchText("");
    setIsTableSearchFocused(false);
  };

  const clearChartSelection = () => {
    setChartSelectedRowId(null);
    dispatchSystemsBlastRadiusSelection({ systemId: null });
  };

  const openRiskDetail = (row: SystemTableRow, bucket: FindingBucket) => {
    const systemFindings = openRiskFindingsBySystemId.get(row.id) ?? [];
    const selectedFindings = systemFindings.filter((finding) => findingMatchesBucket(finding, bucket));

    if (!selectedFindings.length) {
      return;
    }

    const bucketLabel = findingBucketLabel(bucket);
    setRiskDrillThrough({
      selection: {
        id: `systems-rollup-${row.id}-${bucket}`,
        label: `${row.name} - ${bucketLabel}`,
        findings: selectedFindings,
        totalCount: selectedFindings.length,
        emptyMessage: `No open ${bucketLabel.toLowerCase()} findings were found for ${row.name}.`,
        exportSlug: `systems-rollup-${row.id}-${bucket}`
      },
      allFindings: systemFindings
    });
  };

  return (
    <>
      <div className="panel h-full min-h-0 overflow-hidden">
        <div className="border-b border-sky-400/15 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="systems-rollup-table-search"
              className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80"
            >
              ICT System Search
            </label>
            <div className="relative w-[440px] max-w-full">
              <div className="flex items-center gap-2">
                <input
                  ref={tableSearchInputRef}
                  id="systems-rollup-table-search"
                  type="search"
                  value={tableSearchText}
                  onChange={(event) => setTableSearchText(event.target.value)}
                  onFocus={() => setIsTableSearchFocused(true)}
                  onBlur={() => {
                    tableSearchBlurTimerRef.current = setTimeout(() => {
                      setIsTableSearchFocused(false);
                      setTableSearchText((current) => current.trim());
                      tableSearchBlurTimerRef.current = null;
                    }, 120);
                  }}
                  placeholder="Search ICT systems"
                  className="min-w-0 flex-1 rounded-md border border-sky-400/35 bg-slate-900/85 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-400/90"
                />
                {selectedSearchRowId !== "__all__" ? (
                  <button
                    type="button"
                    onClick={clearTableSearchSelection}
                    className="rounded-md border border-slate-500/45 bg-slate-900/70 px-2.5 py-1.5 text-xs font-semibold text-slate-200"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {tableSearchText.trim() && isTableSearchFocused ? (
                <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-40 max-h-56 overflow-auto rounded-md border border-sky-400/35 bg-slate-950/95 p-1 shadow-[0_10px_26px_rgba(0,0,0,0.5)]">
                  {filteredTableSearchOptions.length ? (
                    <ul className="space-y-1">
                      {filteredTableSearchOptions.map((row) => (
                        <li key={`systems-search-${row.id}`}>
                          <button
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              if (tableSearchBlurTimerRef.current) {
                                clearTimeout(tableSearchBlurTimerRef.current);
                                tableSearchBlurTimerRef.current = null;
                              }
                              selectTableSearchResult(row);
                              tableSearchInputRef.current?.blur();
                            }}
                            className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${
                              selectedSearchRowId === row.id
                                ? "border-violet-300/75 bg-violet-500/15 text-violet-100"
                                : "border-sky-400/20 bg-slate-900/70 text-slate-100 hover:border-sky-300/45 hover:bg-slate-800/85"
                            }`}
                          >
                            {row.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-300">
                      No matching ICT systems
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            {selectedChartRow ? (
              <div className="ml-auto flex items-center gap-2 rounded-md border border-amber-300/35 bg-amber-500/10 px-2 py-1 text-xs text-amber-100">
                <span>Blast radius filter: {selectedChartRow.name}</span>
                <button
                  type="button"
                  onClick={clearChartSelection}
                  className="rounded border border-amber-300/45 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] hover:border-amber-200/70 hover:text-amber-50"
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className={scrollable ? "h-[calc(100%-3.5rem)] min-h-0 overflow-auto" : ""}>
          <table className="min-w-full text-sm">
            <thead
              className={`bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80 ${
                scrollable ? "sticky top-0 z-[1] bg-slate-900/95" : ""
              }`}
            >
              <tr>
                <th className="px-2.5 py-1.5">ICT System</th>
                <th className="px-2.5 py-1.5">Assets</th>
                <th className="px-2.5 py-1.5">Findings (Critical)</th>
                <th className="px-2.5 py-1.5">Findings (High)</th>
                <th className="px-2.5 py-1.5">Findings (Other)</th>
                <th className="min-w-[10rem] whitespace-nowrap px-2.5 py-1.5">Compliance Score</th>
                <th className="min-w-[13rem] whitespace-nowrap px-2.5 py-1.5">Discovery Compliance Score</th>
                <th className="px-2.5 py-1.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id} className="border-t border-sky-400/10 align-top">
                  <td className="px-2.5 py-2 text-slate-100">
                    <button
                      type="button"
                      onClick={() => openPanel(row)}
                      className="text-left text-sky-100 underline decoration-sky-300/40 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="px-2.5 py-2 text-slate-300">{row.assetCount}</td>
                  <td className="px-2.5 py-2 font-semibold">
                    <FindingCountCell count={row.criticalFindings} bucket="critical" row={row} onOpen={openRiskDetail} />
                  </td>
                  <td className="px-2.5 py-2 font-semibold">
                    <FindingCountCell count={row.highFindings} bucket="high" row={row} onOpen={openRiskDetail} />
                  </td>
                  <td className="px-2.5 py-2">
                    <FindingCountCell count={row.otherFindings} bucket="other" row={row} onOpen={openRiskDetail} />
                  </td>
                  <td className="w-[150px] px-2.5 py-2">
                    <ScoreBullet value={row.complianceScore} />
                  </td>
                  <td className="w-[190px] px-2.5 py-2">
                    <ScoreBullet value={row.discoveryComplianceScore} />
                  </td>
                  <td className="px-2.5 py-2">
                    <Link
                      href={withDataDate(`/systems/${row.id}`, scopedDataDate)}
                      data-filter-loading="true"
                      data-filter-loading-message="Loading system page..."
                      className="text-sky-200 underline"
                    >
                      Drill Down
                    </Link>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr className="border-t border-sky-400/10 align-top">
                  <td colSpan={8} className="px-2.5 py-6 text-center text-sm text-slate-400">
                    No ICT systems match this search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRow ? (
        <div className="fixed inset-0 z-[130]">
          <div
            className={`absolute inset-0 bg-slate-950/92 backdrop-blur-[1px] transition-opacity duration-200 ${
              isPanelOpen ? "opacity-100" : "opacity-0"
            }`}
          />

          <aside
            className={`absolute right-0 top-0 h-full w-[min(560px,94vw)] border-l border-sky-300/35 bg-slate-950 p-5 shadow-[-22px_0_42px_rgba(0,0,0,0.55)] transition-all duration-[260ms] ease-out ${
              isPanelOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="system-slideout-title"
          >
            <button
              type="button"
              onClick={closePanel}
              className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
            >
              Close
            </button>

            <div className="pt-2">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">ICT System Details</p>
              <h3 id="system-slideout-title" className="mt-2 pr-16 text-2xl font-semibold text-slate-100">
                {selectedRow.name}
              </h3>
            </div>

            <dl className="mt-5 space-y-4">
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Description</dt>
                <dd className="mt-1 text-sm text-slate-100">{selectedRow.description}</dd>
              </div>
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Dependent mission capabilites</dt>
                <dd className="mt-1 text-sm text-slate-100">{selectedRow.missionCapabilities}</dd>
              </div>
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Dependent business services</dt>
                <dd className="mt-1 text-sm text-slate-100">{selectedRow.businessServices}</dd>
              </div>
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Owner</dt>
                <dd className="mt-1 text-sm text-slate-100">{selectedRow.owner}</dd>
              </div>
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Support Mailbox</dt>
                <dd className="mt-1 text-sm text-sky-100">
                  <a
                    className="underline decoration-sky-300/60 underline-offset-2"
                    href={`mailto:${selectedRow.supportEmail}`}
                  >
                    {selectedRow.supportEmail}
                  </a>
                </dd>
              </div>
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Service Catalogue Item</dt>
                <dd className="mt-1 text-sm text-sky-100">
                  <Link
                    href={selectedRow.serviceCatalogueUrl}
                    className="underline decoration-sky-300/60 underline-offset-2"
                    target={isExternalLink(selectedRow.serviceCatalogueUrl) ? "_blank" : undefined}
                    rel={isExternalLink(selectedRow.serviceCatalogueUrl) ? "noreferrer" : undefined}
                  >
                    Open Service Catalogue Item
                  </Link>
                </dd>
              </div>
              <div className="security-accreditation-pulse rounded-xl border border-yellow-300/90 bg-sky-400/16 p-3 shadow-[0_0_14px_rgba(253,224,71,0.32)]">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-sky-100/95">Security Accreditation</dt>
                <dd className="mt-2">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-sky-100/85">
                      <tr>
                        <th className="px-2 py-1.5">Authority to Operate (ATO)</th>
                        <th className="px-2 py-1.5">Links</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-sky-300/35 text-slate-100">
                        <td className="px-2 py-2 font-semibold text-sky-50">{selectedRow.atoNumber}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-3 text-sky-100">
                            <Link
                              href={selectedRow.diisUrl}
                              className="underline decoration-sky-300/70 underline-offset-2"
                              target={isExternalLink(selectedRow.diisUrl) ? "_blank" : undefined}
                              rel={isExternalLink(selectedRow.diisUrl) ? "noreferrer" : undefined}
                            >
                              View in DIIS
                            </Link>
                            <Link
                              href={selectedRow.grcUrl}
                              className="underline decoration-sky-300/70 underline-offset-2"
                              target={isExternalLink(selectedRow.grcUrl) ? "_blank" : undefined}
                              rel={isExternalLink(selectedRow.grcUrl) ? "noreferrer" : undefined}
                            >
                              View in Cyber GRC Portal
                            </Link>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </dd>
              </div>
              <div className="security-accreditation-pulse rounded-xl border border-lime-300/90 bg-sky-400/16 p-3 shadow-[0_0_14px_rgba(190,242,100,0.34)]">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-sky-100/95">Application Portfolio Management</dt>
                <dd className="mt-2">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-sky-100/85">
                      <tr>
                        <th className="px-2 py-1.5">APM Number</th>
                        <th className="px-2 py-1.5">Links</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-sky-300/35 text-slate-100">
                        <td className="px-2 py-2 font-semibold text-sky-50">{selectedRow.apmNumber}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-3 text-sky-100">
                            <Link
                              href={selectedRow.apmUrl}
                              className="underline decoration-sky-300/70 underline-offset-2"
                              target={isExternalLink(selectedRow.apmUrl) ? "_blank" : undefined}
                              rel={isExternalLink(selectedRow.apmUrl) ? "noreferrer" : undefined}
                            >
                              View in APM
                            </Link>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </dd>
              </div>
              <div className="security-accreditation-pulse rounded-xl border border-fuchsia-300/90 bg-sky-400/16 p-3 shadow-[0_0_14px_rgba(232,121,249,0.34)]">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-sky-100/95">Defence ICT Inventory System</dt>
                <dd className="mt-2">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-sky-100/85">
                      <tr>
                        <th className="px-2 py-1.5">DIIS ID</th>
                        <th className="px-2 py-1.5">Links</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-sky-300/35 text-slate-100">
                        <td className="px-2 py-2 font-semibold text-sky-50">{selectedRow.diisId}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-3 text-sky-100">
                            <Link
                              href={selectedRow.diisUrl}
                              className="underline decoration-sky-300/70 underline-offset-2"
                              target={isExternalLink(selectedRow.diisUrl) ? "_blank" : undefined}
                              rel={isExternalLink(selectedRow.diisUrl) ? "noreferrer" : undefined}
                            >
                              View in DIIS
                            </Link>
                            <Link
                              href={selectedRow.grcUrl}
                              className="underline decoration-sky-300/70 underline-offset-2"
                              target={isExternalLink(selectedRow.grcUrl) ? "_blank" : undefined}
                              rel={isExternalLink(selectedRow.grcUrl) ? "noreferrer" : undefined}
                            >
                              View in Cyber GRC Portal
                            </Link>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      ) : null}

      {riskDrillThrough ? (
        <RiskFindingsDrillThrough
          selection={riskDrillThrough.selection}
          allFindings={riskDrillThrough.allFindings}
          assetHighRiskCvesByAssetId={assetHighRiskCvesByAssetId}
          asOfDate={asOfDate}
          onClose={() => setRiskDrillThrough(null)}
        />
      ) : null}
    </>
  );
}
