"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildConfiguredEvidencePreview,
  FindingDisplayConfiguration,
  findingBucketsOfType,
  findingMatchesBucket,
  readConfiguredEvidenceValue,
  toneBadgeClass
} from "@/lib/findings-config";
import { SpiDefinition } from "@/lib/spi-definitions";
import { CveVulnerabilityDetail, Finding, VulnerabilitySeverity } from "@/lib/types";

const PANEL_TWEEN_MS = 260;
const CVE_CRITICALITY_FILTERS: VulnerabilitySeverity[] = ["Critical", "High", "Medium", "Low"];

type AssetCveEntry = CveVulnerabilityDetail;

interface AssetDetailsRow {
  assetId: string;
  assetName: string;
  assetIpAddress: string;
  assetType: string;
  assetChangeAssignmentGroup: string;
  assetIncidentAssignmentGroup: string;
  owner: string;
  totalCveVulnerabilities: number;
  cveVulnerabilities: AssetCveEntry[];
}

function formatFindingTimestamp(timestamp: string): string {
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    return timestamp;
  }

  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${year} ${hour}:${minute} UTC`;
}

function formatCapturedTimestamp(timestamp: string): string {
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    return timestamp;
  }

  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${year} ${hour}:${minute} UTC`;
}

function formatAssetTypeLabel(value?: string | null): string {
  if (!value) {
    return "Unknown";
  }
  if (value === "network-device") {
    return "Network Device";
  }
  if (value === "storage-device") {
    return "Storage Device";
  }
  if (value === "printer-device") {
    return "Printer Device";
  }
  return value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function cveCriticalityClass(criticality: VulnerabilitySeverity): string {
  if (criticality === "Critical") {
    return "text-red-100";
  }
  if (criticality === "High") {
    return "text-orange-100";
  }
  if (criticality === "Medium") {
    return "text-sky-100";
  }
  return "text-emerald-100";
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (!/[",\r\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function buildAssetDetailsRow(
  finding: Finding,
  assetCvesByAssetId: Record<string, AssetCveEntry[]>,
  findingDisplayConfiguration: FindingDisplayConfiguration
): AssetDetailsRow {
  const assetId = finding.scope.assetId;
  const cveVulnerabilities = assetCvesByAssetId[assetId] ?? [];

  return {
    assetId,
    assetName: readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "asset_name", assetId) ?? assetId,
    assetIpAddress:
      readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "asset_ip_address", "Not available") ??
      "Not available",
    assetType: formatAssetTypeLabel(readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "asset_type")),
    assetChangeAssignmentGroup:
      readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "change_assignment_group", "Not assigned") ??
      "Not assigned",
    assetIncidentAssignmentGroup:
      readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "incident_assignment_group", "Not assigned") ??
      "Not assigned",
    owner: readConfiguredEvidenceValue(finding.evidence, findingDisplayConfiguration, "owner", "Not assigned") ?? "Not assigned",
    totalCveVulnerabilities: cveVulnerabilities.length,
    cveVulnerabilities
  };
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
  searchParams,
  selectedAsOf,
  selectedSpi,
  selectedPriority,
  selectedSeverity,
  selectedStatus,
  selectedSearchTerm,
  spiOptions,
  priorityOptions,
  severityOptions,
  spiDefinitions,
  findingDisplayConfiguration,
  assetCvesByAssetId = {}
}: {
  findings: Finding[];
  searchParams: Record<string, string | string[] | undefined>;
  selectedAsOf: string;
  selectedSpi?: number;
  selectedPriority?: number;
  selectedSeverity?: string;
  selectedStatus?: "open" | "closed";
  selectedSearchTerm?: string;
  spiOptions: number[];
  priorityOptions: number[];
  severityOptions: string[];
  spiDefinitions: SpiDefinition[];
  findingDisplayConfiguration: FindingDisplayConfiguration;
  assetCvesByAssetId?: Record<string, AssetCveEntry[]>;
}) {
  void selectedAsOf;
  const [selectedFindingForAssets, setSelectedFindingForAssets] = useState<Finding | null>(null);
  const [isAssetDetailsPanelVisible, setIsAssetDetailsPanelVisible] = useState(false);
  const [isAssetDetailsPanelOpen, setIsAssetDetailsPanelOpen] = useState(false);
  const [selectedAssetForCveDetails, setSelectedAssetForCveDetails] = useState<AssetDetailsRow | null>(null);
  const [isCveDetailsModalVisible, setIsCveDetailsModalVisible] = useState(false);
  const [isCveDetailsModalOpen, setIsCveDetailsModalOpen] = useState(false);
  const [cveSearchTerm, setCveSearchTerm] = useState("");
  const [cveCriticalityFilter, setCveCriticalityFilter] = useState<"all" | VulnerabilitySeverity>("all");
  const [isMounted, setIsMounted] = useState(false);
  const assetDetailsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cveDetailsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spiDefinitionById = useMemo(
    () => new Map(spiDefinitions.map((definition) => [definition.spiId, definition])),
    [spiDefinitions]
  );
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
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
      cveDetailsCloseTimerRef.current = null;
    }
    setIsAssetDetailsPanelOpen(false);
    setIsAssetDetailsPanelVisible(false);
    setSelectedFindingForAssets(null);
    setSelectedAssetForCveDetails(null);
    setIsCveDetailsModalOpen(false);
    setIsCveDetailsModalVisible(false);
    setCveSearchTerm("");
    setCveCriticalityFilter("all");
  }, []);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      if (assetDetailsCloseTimerRef.current) {
        clearTimeout(assetDetailsCloseTimerRef.current);
      }
      if (cveDetailsCloseTimerRef.current) {
        clearTimeout(cveDetailsCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    window.addEventListener("tsaat:findings-register-dismiss-overlays", dismissOverlaysImmediately);
    return () => {
      window.removeEventListener("tsaat:findings-register-dismiss-overlays", dismissOverlaysImmediately);
    };
  }, [dismissOverlaysImmediately]);

  const preservedParams = useMemo(
    () =>
      Object.entries(searchParams).flatMap(([key, value]) => {
        if (["spi", "priority", "severity", "search", "page", "format", "status"].includes(key)) {
          return [];
        }
        if (!value) {
          return [];
        }
        const values = Array.isArray(value) ? value : [value];
        return values.filter(Boolean).map((item) => ({ key, value: item }));
      }),
    [searchParams]
  );

  const registerParams = useMemo(() => {
    const params = new URLSearchParams();
    for (const param of preservedParams) {
      params.append(param.key, param.value);
    }
    params.set("findingsViewTab", "register");
    return params;
  }, [preservedParams]);

  const clearFiltersHref = (() => {
    const query = registerParams.toString();
    return query ? `/findings?${query}` : "/findings";
  })();

  const exportHref = (format: "json" | "csv") => {
    const params = new URLSearchParams(registerParams);
    if (selectedSpi) {
      params.set("spi", String(selectedSpi));
    }
    if (selectedPriority) {
      params.set("priority", String(selectedPriority));
    }
    if (selectedSeverity) {
      params.set("severity", selectedSeverity);
    }
    if (selectedStatus) {
      params.set("status", selectedStatus);
    }
    if (selectedSearchTerm) {
      params.set("search", selectedSearchTerm);
    }
    params.set("format", format);
    return `/api/findings/export?${params.toString()}`;
  };

  const assetDetailsRows = useMemo<AssetDetailsRow[]>(() => {
    if (!selectedFindingForAssets) {
      return [];
    }
    return [buildAssetDetailsRow(selectedFindingForAssets, assetCvesByAssetId, findingDisplayConfiguration)];
  }, [assetCvesByAssetId, findingDisplayConfiguration, selectedFindingForAssets]);

  const selectedAssetCves = useMemo(() => {
    if (!selectedAssetForCveDetails) {
      return [];
    }
    return selectedAssetForCveDetails.cveVulnerabilities;
  }, [selectedAssetForCveDetails]);

  const filteredAssetCves = useMemo(() => {
    const normalizedSearch = cveSearchTerm.trim().toLowerCase();
    return selectedAssetCves.filter((entry) => {
      if (cveCriticalityFilter !== "all" && entry.criticality !== cveCriticalityFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const searchText = [
        entry.cve,
        entry.description,
        entry.remediationGuidance,
        entry.criticality,
        entry.exploitability,
        entry.capturedAt
      ]
        .join(" ")
        .toLowerCase();
      return searchText.includes(normalizedSearch);
    });
  }, [cveCriticalityFilter, cveSearchTerm, selectedAssetCves]);

  const openAssetDetailsPanel = (finding: Finding) => {
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
      assetDetailsCloseTimerRef.current = null;
    }
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
      cveDetailsCloseTimerRef.current = null;
    }
    setSelectedFindingForAssets(finding);
    setSelectedAssetForCveDetails(null);
    setIsCveDetailsModalVisible(false);
    setIsCveDetailsModalOpen(false);
    setCveSearchTerm("");
    setCveCriticalityFilter("all");
    setIsAssetDetailsPanelVisible(true);
    requestAnimationFrame(() => {
      setIsAssetDetailsPanelOpen(true);
    });
  };

  const closeAssetDetailsPanel = () => {
    setIsAssetDetailsPanelOpen(false);
    setIsCveDetailsModalOpen(false);
    setIsCveDetailsModalVisible(false);
    setSelectedAssetForCveDetails(null);
    setCveSearchTerm("");
    setCveCriticalityFilter("all");
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
      cveDetailsCloseTimerRef.current = null;
    }
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
    }
    assetDetailsCloseTimerRef.current = setTimeout(() => {
      setIsAssetDetailsPanelVisible(false);
      setSelectedFindingForAssets(null);
      assetDetailsCloseTimerRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  const openCveDetailsModal = (assetRow: AssetDetailsRow) => {
    if (!assetRow.totalCveVulnerabilities) {
      return;
    }
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
      cveDetailsCloseTimerRef.current = null;
    }
    setSelectedAssetForCveDetails(assetRow);
    setCveSearchTerm("");
    setCveCriticalityFilter("all");
    setIsCveDetailsModalVisible(true);
    requestAnimationFrame(() => {
      setIsCveDetailsModalOpen(true);
    });
  };

  const closeCveDetailsModal = () => {
    setIsCveDetailsModalOpen(false);
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
    }
    cveDetailsCloseTimerRef.current = setTimeout(() => {
      setIsCveDetailsModalVisible(false);
      setSelectedAssetForCveDetails(null);
      setCveSearchTerm("");
      setCveCriticalityFilter("all");
      cveDetailsCloseTimerRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  const downloadAssetDetailsCsv = () => {
    if (!selectedFindingForAssets || !assetDetailsRows.length || typeof window === "undefined") {
      return;
    }

    const headers = [
      "Asset Name",
      "Asset IP address",
      "Asset Type",
      "CVE Vulnerabilities",
      "Asset Change Assignment Group",
      "Asset Incident Assignment Group",
      "Owner"
    ];
    const rows = assetDetailsRows.map((row) => [
      row.assetName,
      row.assetIpAddress,
      row.assetType,
      row.totalCveVulnerabilities,
      row.assetChangeAssignmentGroup,
      row.assetIncidentAssignmentGroup,
      row.owner
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

  const downloadCvesCsv = () => {
    if (!selectedAssetForCveDetails || !filteredAssetCves.length || typeof window === "undefined") {
      return;
    }

    const headers = ["Asset Name", "Asset ID", "CVE", "Description", "Remediation Guidance", "Criticality", "Timestamp"];
    const rows = filteredAssetCves.map((entry) => [
      selectedAssetForCveDetails.assetName,
      selectedAssetForCveDetails.assetId,
      entry.cve,
      entry.description,
      entry.remediationGuidance,
      entry.criticality,
      formatCapturedTimestamp(entry.capturedAt)
    ]);
    const csv = [headers, ...rows].map((row) => row.map((value) => csvCell(value)).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cve-vulnerabilities-${safeSlug(selectedAssetForCveDetails.assetName, "asset-cves")}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const cveDetailsModal =
    isMounted && isCveDetailsModalVisible && selectedAssetForCveDetails
      ? createPortal(
          <div
            className={`fixed inset-0 z-[10010] ${
              isCveDetailsModalOpen ? "pointer-events-auto" : "pointer-events-none"
            }`}
          >
            <div
              className={`absolute inset-0 bg-slate-950/88 backdrop-blur-[1px] transition-opacity duration-200 ${
                isCveDetailsModalOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={closeCveDetailsModal}
            />
            <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
              <section
                className={`relative flex h-[min(88vh,760px)] w-[min(1380px,95vw)] flex-col rounded-2xl border border-sky-300/35 bg-slate-950 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)] transition-all duration-[260ms] ease-out ${
                  isCveDetailsModalOpen ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"
                }`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="findings-register-cve-details-title"
              >
                <button
                  type="button"
                  onClick={closeCveDetailsModal}
                  className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
                >
                  Close
                </button>

                <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">CVE Details</p>
                <h6 id="findings-register-cve-details-title" className="mt-2 pr-16 text-xl font-semibold text-slate-100">
                  CVE Vulnerabilities
                </h6>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-300/80">Asset: {selectedAssetForCveDetails.assetName}</p>
                    <p className="mt-1 text-xs text-slate-300/80">
                      CVEs in scope: {filteredAssetCves.length} of {selectedAssetCves.length}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadCvesCsv}
                    disabled={!filteredAssetCves.length}
                    className="rounded-md border border-sky-300/35 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-500/35 disabled:text-slate-400"
                  >
                    Export CSV
                  </button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
                  <div>
                    <label
                      htmlFor="findings-register-cve-search"
                      className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75"
                    >
                      Text Search
                    </label>
                    <input
                      id="findings-register-cve-search"
                      type="search"
                      value={cveSearchTerm}
                      onChange={(event) => setCveSearchTerm(event.target.value)}
                      placeholder="Search CVE, description, remediation, criticality, timestamp..."
                      className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="findings-register-cve-criticality"
                      className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75"
                    >
                      CVE Criticality
                    </label>
                    <select
                      id="findings-register-cve-criticality"
                      value={cveCriticalityFilter}
                      onChange={(event) => setCveCriticalityFilter(event.target.value as "all" | VulnerabilitySeverity)}
                      className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="all">All</option>
                      {CVE_CRITICALITY_FILTERS.map((criticality) => (
                        <option key={criticality} value={criticality}>
                          {criticality}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 min-h-0 flex-1 overflow-x-auto overflow-y-scroll rounded-xl border border-sky-400/15">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                      <tr>
                        <th className="px-3 py-2">CVE Code</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2">Remediation Guidance</th>
                        <th className="px-3 py-2">Criticality</th>
                        <th className="px-3 py-2">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssetCves.map((entry, index) => (
                        <tr
                          key={`${selectedAssetForCveDetails.assetId}-${entry.cve}-${entry.capturedAt}-${index}`}
                          className="border-t border-sky-400/10 align-top"
                        >
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-sky-100">{entry.cve}</td>
                          <td className="px-3 py-2 text-slate-300/85">{entry.description}</td>
                          <td className="px-3 py-2 text-slate-300/85">{entry.remediationGuidance}</td>
                          <td className={`whitespace-nowrap px-3 py-2 ${cveCriticalityClass(entry.criticality)}`}>
                            {entry.criticality}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">
                            {formatCapturedTimestamp(entry.capturedAt)}
                          </td>
                        </tr>
                      ))}
                      {filteredAssetCves.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-sm text-emerald-200/90">
                            {selectedAssetCves.length === 0
                              ? "No CVE vulnerabilities for this asset."
                              : "No CVE records match the active filters."}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="panel relative flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sky-400/15 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Findings Register</h3>
            <p className="mt-1 text-xs text-slate-300/75">
              Compliance detail-style worklist for {findings.length.toLocaleString("en-US")} findings in scope.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              className="rounded-md border border-sky-400/40 px-3 py-1 text-xs text-sky-100"
              href={exportHref("json")}
            >
              Export JSON
            </a>
            <a
              className="rounded-md border border-sky-400/40 px-3 py-1 text-xs text-sky-100"
              href={exportHref("csv")}
            >
              Export CSV
            </a>
          </div>
        </div>

        <div className="border-b border-sky-400/10 px-4 py-3">
          <form
            action="/findings"
            method="get"
            data-filter-loading="true"
            data-filter-loading-message="Applying filters..."
            className="grid gap-3 lg:grid-cols-[minmax(15rem,1.25fr)_minmax(9rem,0.55fr)_minmax(11rem,0.7fr)_minmax(16rem,1.5fr)_auto_auto]"
          >
            {Array.from(registerParams.entries()).map(([key, value], index) => (
              <input key={`${key}-${value}-${index}`} type="hidden" name={key} value={value} />
            ))}
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="findings-spi" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
                SPI
              </label>
              <select
                id="findings-spi"
                name="spi"
                defaultValue={selectedSpi ? String(selectedSpi) : ""}
                className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All SPI</option>
                {spiOptions.map((option) => (
                  <option key={option} value={option}>
                    SPI {option} - {spiDefinitionById.get(option)?.description ?? "Unmapped SPI"}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="findings-priority" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
                Priority
              </label>
              <select
                id="findings-priority"
                name="priority"
                defaultValue={selectedPriority ? String(selectedPriority) : ""}
                className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All</option>
                {priorityOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    P{priority}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="findings-severity" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
                Findings Severity
              </label>
              <select
                id="findings-severity"
                name="severity"
                defaultValue={selectedSeverity ?? ""}
                className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All</option>
                {severityOptions.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="findings-search" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
                Text Search
              </label>
              <input
                id="findings-search"
                name="search"
                type="search"
                defaultValue={selectedSearchTerm ?? ""}
                placeholder="Search title, scope, evidence, action..."
                className="rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
              />
            </div>

            <button
              type="submit"
              className="self-end rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100"
            >
              Apply
            </button>
            {selectedSpi || selectedPriority || selectedSeverity || selectedSearchTerm ? (
              <a
                href={clearFiltersHref}
                data-filter-loading="true"
                data-filter-loading-message="Applying filters..."
                className="self-end rounded-md border border-slate-500/40 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                Clear
              </a>
            ) : null}
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="w-[12rem] min-w-[12rem] px-3 py-2">Measure</th>
                <th className="w-[11rem] min-w-[11rem] px-3 py-2">Severity</th>
                <th className="w-[12.5rem] min-w-[12.5rem] whitespace-nowrap px-3 py-2">Timestamp</th>
                <th className="px-3 py-2">Title</th>
                <th className="w-[6.5rem] min-w-[6.5rem] px-3 py-2">Status</th>
                <th className="px-3 py-2">Evidence</th>
                <th className="px-3 py-2">Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((finding) => {
                const asOfStatus = finding.status;
                const severityBucket = severityBuckets.find((bucket) => findingMatchesBucket(finding, bucket));
                const workflowTone = workflowToneByStatus.get(asOfStatus) ?? (asOfStatus === "open" ? "warning" : "success");
                return (
                  <tr key={finding.id} className="border-t border-sky-400/10 align-top">
                    <td className="w-[12rem] min-w-[12rem] px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-slate-100">SPI {finding.spiId}</span>
                        <span className="text-xs text-slate-300/80">P{finding.priorityRank}</span>
                      </div>
                    </td>
                    <td className="w-[11rem] min-w-[11rem] px-3 py-2">
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
                    <td className="w-[12.5rem] min-w-[12.5rem] whitespace-nowrap px-3 py-2 text-slate-200">
                      {formatFindingTimestamp(finding.timestamp)}
                    </td>
                    <td className="px-3 py-2 text-slate-100">
                      <button
                        type="button"
                        onClick={() => openAssetDetailsPanel(finding)}
                        className="text-left text-sky-100 underline decoration-sky-300/45 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                      >
                        {finding.title}
                      </button>
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
                    <td className="px-3 py-2 text-xs text-slate-300/85">{finding.recommendedAction}</td>
                  </tr>
                );
              })}
              {findings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-300/80">
                    No findings match the selected SPI, Priority, Findings Severity, and text search filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {isAssetDetailsPanelVisible && selectedFindingForAssets ? (
          <div className="absolute inset-0 z-[4]">
            <div
              className={`absolute inset-0 bg-slate-950/92 backdrop-blur-[1px] transition-opacity duration-200 ${
                isAssetDetailsPanelOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={closeAssetDetailsPanel}
            />
            <aside
              className={`absolute right-0 top-0 h-full w-full border-l border-sky-300/35 bg-slate-950 p-4 shadow-[-22px_0_42px_rgba(0,0,0,0.55)] transition-all duration-[260ms] ease-out ${
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
                  <button
                    type="button"
                    onClick={downloadAssetDetailsCsv}
                    disabled={!assetDetailsRows.length}
                    className="rounded-md border border-sky-300/35 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-500/35 disabled:text-slate-400"
                  >
                    Export to CSV
                  </button>
                </div>

                <div className="mt-3 min-h-0 flex-1 overflow-x-auto overflow-y-scroll rounded-xl border border-sky-400/15">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                      <tr>
                        <th className="px-3 py-2">Asset Name</th>
                        <th className="px-3 py-2">Asset IP address</th>
                        <th className="px-3 py-2">Asset Type</th>
                        <th className="px-3 py-2">CVE Vulnerabilities</th>
                        <th className="px-3 py-2">Asset Change Assignment Group</th>
                        <th className="px-3 py-2">Asset Incident Assignment Group</th>
                        <th className="px-3 py-2">Owner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetDetailsRows.map((assetRow) => (
                        <tr key={assetRow.assetId} className="border-t border-sky-400/10 align-top">
                          <td className="px-3 py-2 text-slate-100">{assetRow.assetName}</td>
                          <td className="px-3 py-2 text-slate-300/85">{assetRow.assetIpAddress}</td>
                          <td className="px-3 py-2 text-slate-300/85">{assetRow.assetType}</td>
                          <td className="px-3 py-2">
                            {assetRow.totalCveVulnerabilities > 0 ? (
                              <button
                                type="button"
                                onClick={() => openCveDetailsModal(assetRow)}
                                className="text-left text-sky-100 underline decoration-sky-300/45 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                              >
                                {assetRow.totalCveVulnerabilities}
                              </button>
                            ) : (
                              <span className="text-slate-400/90">0</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-300/85">{assetRow.assetChangeAssignmentGroup}</td>
                          <td className="px-3 py-2 text-slate-300/85">{assetRow.assetIncidentAssignmentGroup}</td>
                          <td className="px-3 py-2 text-slate-300/85">{assetRow.owner}</td>
                        </tr>
                      ))}
                      {assetDetailsRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-sm text-emerald-200/90">
                            No linked assets found for this finding.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
      {cveDetailsModal}
    </>
  );
}
