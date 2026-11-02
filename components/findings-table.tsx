"use client";

import { FindingsDataTable } from "@/components/findings-data-table";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CmdbDeviceName } from "@/components/cmdb-drill-through";
import {
  buildConfiguredEvidencePreview,
  FindingDisplayConfiguration,
  findingBucketsOfType,
  findingMatchesBucket,
  toneBadgeClass
} from "@/lib/findings-config";
import { hasExplorerNumberRange, type ExplorerNumberRange, type ExplorerTableFilters } from "@/lib/explorer-table";
import { buildAssetDetailsRow, type AssetDeviceDetails, type AssetDetailsRow } from "@/lib/findings-assets";
import type { FindingsExportContext } from "@/lib/findings-export";
import { findingDurationDays } from "@/lib/findings-duration";
import type { Finding } from "@/lib/types";

const PANEL_TWEEN_MS = 260;

function formatFindingTimestamp(timestamp: string): string {
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    return timestamp;
  }

  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${year} ${hour}:${minute} UTC`;
}

function formatFindingDuration(finding: Finding, asOfDate: string): string {
  const days = findingDurationDays(finding, asOfDate);
  return days === null ? "\u2014" : `${days} ${days === 1 ? "day" : "days"}`;
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (!/[",\r\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function safeSlug(value: string, fallback: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || fallback
  );
}

export function FindingsTable({
  findings,
  selectedAsOf,
  exportContext,
  selectedSpi,
  selectedPriority,
  selectedSeverity,
  selectedDurationRange,
  findingDisplayConfiguration,
  assetDetailsByAssetId = {}
}: {
  findings: Finding[];
  selectedAsOf: string;
  exportContext: FindingsExportContext;
  selectedSpi?: number;
  selectedPriority?: number;
  selectedSeverity?: string;
  selectedDurationRange?: ExplorerNumberRange;
  findingDisplayConfiguration: FindingDisplayConfiguration;
  assetDetailsByAssetId?: Record<string, AssetDeviceDetails>;
}) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [selectedFindingForAssets, setSelectedFindingForAssets] = useState<Finding | null>(null);
  const [isAssetDetailsPanelVisible, setIsAssetDetailsPanelVisible] = useState(false);
  const [isAssetDetailsPanelOpen, setIsAssetDetailsPanelOpen] = useState(false);
  const assetDetailsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialTableFilters = useMemo<ExplorerTableFilters>(() => {
    const columns: ExplorerTableFilters["columns"] = {};
    if (selectedSpi) {
      const measures = [...new Set(findings.filter((finding) => finding.spiId === selectedSpi)
        .map((finding) => `SPI ${finding.spiId}-${finding.title}`))];
      columns.measure = measures.length ? measures : [`SPI ${selectedSpi}`];
    }
    if (selectedPriority) columns.priority = [`P${selectedPriority}`];
    if (selectedSeverity) columns.severity = [selectedSeverity];
    const ranges: NonNullable<ExplorerTableFilters["ranges"]> = {};
    if (selectedDurationRange && hasExplorerNumberRange(selectedDurationRange)) ranges.duration = selectedDurationRange;
    return { search: "", columns, ranges };
  }, [findings, selectedSpi, selectedPriority, selectedSeverity, selectedDurationRange]);
  const severityBuckets = useMemo(
    () => findingBucketsOfType(findingDisplayConfiguration, "severity"),
    [findingDisplayConfiguration]
  );
  const workflowToneByStatus = useMemo(
    () => new Map(findingDisplayConfiguration.workflowStatuses.map((status) => [status.statusKey, status.toneKey] as const)),
    [findingDisplayConfiguration]
  );

  const dismissOverlaysImmediately = useCallback(() => {
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
      assetDetailsCloseTimerRef.current = null;
    }
    setIsAssetDetailsPanelOpen(false);
    setIsAssetDetailsPanelVisible(false);
    setSelectedFindingForAssets(null);
  }, []);

  useEffect(() => {
    return () => {
      if (assetDetailsCloseTimerRef.current) {
        clearTimeout(assetDetailsCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    window.addEventListener("tsaat:findings-register-dismiss-overlays", dismissOverlaysImmediately);
    return () => {
      window.removeEventListener("tsaat:findings-register-dismiss-overlays", dismissOverlaysImmediately);
    };
  }, [dismissOverlaysImmediately]);

  const downloadFindingsWorkbook = async (matchingRows: Finding[]) => {
    if (exporting || !matchingRows.length) return;
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch("/api/findings/export", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ ...exportContext, findingIds: matchingRows.map((finding) => finding.id) })
      });
      if (!response.ok) {
        throw new Error(response.status === 409
          ? "Findings have changed. Refresh the register and try again."
          : "The Excel export could not be created. Please try again.");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `dct-findings-${selectedAsOf}.xlsx`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Unable to export findings.");
    } finally {
      setExporting(false);
    }
  };

  const assetDetailsRows = useMemo<AssetDetailsRow[]>(() => {
    if (!selectedFindingForAssets) {
      return [];
    }
    return [buildAssetDetailsRow(selectedFindingForAssets, assetDetailsByAssetId, findingDisplayConfiguration)];
  }, [assetDetailsByAssetId, findingDisplayConfiguration, selectedFindingForAssets]);

  const openAssetDetailsPanel = (finding: Finding) => {
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
      assetDetailsCloseTimerRef.current = null;
    }
    setSelectedFindingForAssets(finding);
    setIsAssetDetailsPanelVisible(true);
    requestAnimationFrame(() => {
      setIsAssetDetailsPanelOpen(true);
    });
  };

  const closeAssetDetailsPanel = () => {
    setIsAssetDetailsPanelOpen(false);
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
    }
    assetDetailsCloseTimerRef.current = setTimeout(() => {
      setIsAssetDetailsPanelVisible(false);
      setSelectedFindingForAssets(null);
      assetDetailsCloseTimerRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  const downloadAssetDetailsCsv = (matchingRows: typeof assetDetailsRows) => {
    if (!selectedFindingForAssets || !matchingRows.length || typeof window === "undefined") {
      return;
    }

    const headers = [
      "Device Name",
      "Device IP",
      "Device Model",
      "Last Discovered Date",
      "Discovered By",
      "Asset Type"
    ];
    const rows = matchingRows.map((row) => [
      row.deviceName,
      row.deviceIp,
      row.deviceModel,
      row.lastDiscoveredDate,
      row.discoveredBy,
      row.assetType
    ]);
    const csv = [headers, ...rows].map((row) => row.map((value) => csvCell(value)).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `asset-details-${safeSlug(selectedFindingForAssets.title, "asset-details")}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
      <div className="findings-register">
        {exportError && <p role="alert" className="endpoint-export-error">{exportError}</p>}
        <div className="findings-table-host"><FindingsDataTable title="Findings Register" rows={findings} searchable={true} searchText={(finding) => [finding.id, ...Object.values(finding.scope), ...Object.values(finding.evidence)].join(" ")}
key={JSON.stringify(initialTableFilters)} initialFilters={initialTableFilters}
columns={[{ key: "measure", label: "SPI", value: (finding) => `SPI ${finding.spiId}-${finding.title}` },
{ key: "priority", label: "Priority", value: (finding) => `P${finding.priorityRank}` },
{ key: "severity", label: "Severity", value: (finding) => finding.severity },
{ key: "timestamp", label: "Timestamp", value: (finding) => formatFindingTimestamp(finding.timestamp) },
{ key: "duration", label: "Duration", value: (finding) => formatFindingDuration(finding, selectedAsOf),
  range: { value: (finding) => findingDurationDays(finding, selectedAsOf), unit: "days", min: 0, step: 1, sortable: true } },
{ key: "status", label: "Status", value: (finding) => finding.status === "open" ? "Open" : "Closed" },
{ key: "evidence", label: "Evidence", value: (finding) => buildConfiguredEvidencePreview(finding, findingDisplayConfiguration) }]}
actions={(matching) => <button type="button" className="endpoint-export" disabled={exporting || !matching.length} onClick={() => downloadFindingsWorkbook(matching)} title="Export findings and affected CIs to separate Excel sheets">{exporting ? "Exporting..." : "Export Excel"}</button>}
emptyMessage="No findings are available for the selected scope, status, and date."
renderRow={(finding) => {
                const asOfStatus = finding.status;
                const severityBucket = severityBuckets.find((bucket) => findingMatchesBucket(finding, bucket));
                const workflowTone = workflowToneByStatus.get(asOfStatus) ?? (asOfStatus === "open" ? "warning" : "success");
                return (
                  <tr key={finding.id} className="border-t border-sky-400/10 align-top">
                    <td className="px-3 py-2 text-slate-100">
                      <button
                        type="button"
                        onClick={() => openAssetDetailsPanel(finding)}
                        className="text-left text-sky-100 underline decoration-sky-300/45 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                      >
                        {`SPI ${finding.spiId}-${finding.title}`}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-200">
                      P{finding.priorityRank}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${toneBadgeClass(
                            severityBucket?.toneKey ?? "info"
                          )}`}
                        >
                          {finding.severity}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-200">
                      {formatFindingTimestamp(finding.timestamp)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-200" title={`Days open as of ${selectedAsOf}`}>
                      {formatFindingDuration(finding, selectedAsOf)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] ${toneBadgeClass(
                          workflowTone
                        )}`}
                      >
                        {asOfStatus === "open" ? "Open" : "Closed"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300/85">
                      {buildConfiguredEvidencePreview(finding, findingDisplayConfiguration)}
                    </td>
                  </tr>
                );
              }} /></div>

        {isAssetDetailsPanelVisible && selectedFindingForAssets ? (
          <div className="absolute inset-0 z-[4]">
            <div
              className={`absolute inset-0 bg-slate-950/92 backdrop-blur-[1px] transition-opacity duration-200 ${
                isAssetDetailsPanelOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={closeAssetDetailsPanel}
            />
            <aside
              className={`findings-drillthrough absolute right-0 top-0 h-full w-full border-l border-sky-300/35 bg-slate-950 p-4 shadow-[-22px_0_42px_rgba(0,0,0,0.55)] transition-all duration-[260ms] ease-out ${
                isAssetDetailsPanelOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
              }`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="findings-register-asset-details-title"
            >
              <button
                type="button"
                onClick={closeAssetDetailsPanel}
                className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
              >
                Close
              </button>

              <div className="flex h-full min-h-0 flex-col">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Affected CIs</p>
                <h4 id="findings-register-asset-details-title" className="mt-2 pr-16 text-xl font-semibold text-slate-100">
                  Affected CIs
                </h4>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-300/80">Selected Finding: {selectedFindingForAssets.title}</p>
                    <p className="mt-1 text-xs text-slate-300/80">Affected CIs: {assetDetailsRows.length}</p>
                  </div>

                </div>

                <div className="findings-table-host mt-3"><FindingsDataTable title="Affected CIs" rows={assetDetailsRows} searchable={true}
columns={[{ key: "device-name", label: "Device Name", value: (assetRow) => assetRow.deviceName },
{ key: "device-ip", label: "Device IP", value: (assetRow) => assetRow.deviceIp },
{ key: "device-model", label: "Device Model", value: (assetRow) => assetRow.deviceModel },
{ key: "last-discovered-date", label: "Last Discovered Date", value: (assetRow) => assetRow.lastDiscoveredDate },
{ key: "discovered-by", label: "Discovered By", value: (assetRow) => assetRow.discoveredBy },
{ key: "asset-type", label: "Asset Type", value: (assetRow) => assetRow.assetType }]}
actions={(matching) => <button type="button" className="endpoint-export" disabled={!matching.length} onClick={() => downloadAssetDetailsCsv(matching)}>Export CSV</button>}
emptyMessage={<>No linked assets found for this finding.
                          </>}
renderRow={(assetRow) => (
                        <tr key={assetRow.assetId} className="border-t border-sky-400/10 align-top">
                          <td className="px-3 py-2 text-slate-100">
                            <CmdbDeviceName assetId={assetRow.assetId} name={assetRow.deviceName} />
                          </td>
                          <td className="px-3 py-2 text-slate-300/85">{assetRow.deviceIp}</td>
                          <td className="px-3 py-2 text-slate-300/85">{assetRow.deviceModel}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">{assetRow.lastDiscoveredDate}</td>
                          <td className="px-3 py-2 text-slate-300/85">{assetRow.discoveredBy}</td>
                          <td className="px-3 py-2 text-slate-300/85">{assetRow.assetType}</td>
                        </tr>
                      )} /></div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
  );
}
