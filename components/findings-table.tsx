"use client";

import { useMemo, useState } from "react";
import { Finding } from "@/lib/types";
import { SPI_DESCRIPTIONS } from "@/lib/constants";
import { workflowStatusAtAsOf } from "@/lib/finding-status";

function formatFindingTimestamp(timestamp: string): string {
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    return timestamp;
  }

  const [, year, month, day, hour, minute] = match;
  return `${day}:${month}:${year} ${hour}:${minute}`;
}

function readEvidenceStringValue(
  evidence: Record<string, string | number | boolean | null>,
  candidateKeys: string[]
): string | null {
  if (!candidateKeys.length) {
    return null;
  }

  const evidenceEntries = Object.entries(evidence).map(([key, value]) => [key.toLowerCase(), value] as const);
  for (const candidateKey of candidateKeys) {
    const matched = evidenceEntries.find(([key]) => key === candidateKey.toLowerCase());
    if (!matched) {
      continue;
    }
    const value = matched[1];
    if (value === null) {
      continue;
    }
    const text = String(value).trim();
    if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") {
      continue;
    }
    return text;
  }
  return null;
}

function formatAssetTypeLabel(value?: string | null): string {
  if (!value) {
    return "Unknown";
  }
  if (value === "network-device") {
    return "Network Device";
  }
  if (value === "workstation") {
    return "Workstation";
  }
  if (value === "server") {
    return "Server";
  }
  return value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

interface AssetDetailsRow {
  assetId: string;
  assetName: string;
  assetIpAddress: string;
  assetType: string;
  criticalExposureFindings: number;
  highRiskFindings: number;
  totalFindings: number;
  assetChangeAssignmentGroup: string;
  assetIncidentAssignmentGroup: string;
  owner: string;
}

export function FindingsTable({
  findings,
  findingsForDrillthrough,
  searchParams,
  selectedAsOf,
  selectedSpi,
  selectedStatus,
  selectedSearchTerm,
  spiOptions,
  pagination
}: {
  findings: Finding[];
  findingsForDrillthrough: Finding[];
  searchParams: Record<string, string | string[] | undefined>;
  selectedAsOf: string;
  selectedSpi?: number;
  selectedStatus?: string;
  selectedSearchTerm?: string;
  spiOptions: number[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
  };
}) {
  const [selectedFindingForAssets, setSelectedFindingForAssets] = useState<Finding | null>(null);
  const [isAssetDetailsPanelVisible, setIsAssetDetailsPanelVisible] = useState(false);
  const [isAssetDetailsPanelOpen, setIsAssetDetailsPanelOpen] = useState(false);

  const preservedParams = Object.entries(searchParams).flatMap(([key, value]) => {
    if (key === "spi" || key === "search" || key === "status" || key === "page") {
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

  const clearFiltersHref = (() => {
    const params = new URLSearchParams();
    for (const param of preservedParams) {
      params.set(param.key, param.value);
    }
    const query = params.toString();
    return query ? `/findings?${query}` : "/findings";
  })();

  const exportHref = (format: "json" | "csv") => {
    const params = new URLSearchParams();
    for (const param of preservedParams) {
      params.set(param.key, param.value);
    }
    if (selectedSpi) {
      params.set("spi", String(selectedSpi));
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

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (!value || key === "status") {
        continue;
      }
      params.set(key, Array.isArray(value) ? value[0] : value);
    }
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    const query = params.toString();
    return query ? `/findings?${query}` : "/findings";
  };

  const openAssetDetailsPanel = (finding: Finding) => {
    setSelectedFindingForAssets(finding);
    setIsAssetDetailsPanelVisible(true);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => setIsAssetDetailsPanelOpen(true));
    } else {
      setIsAssetDetailsPanelOpen(true);
    }
  };

  const closeAssetDetailsPanel = () => {
    setIsAssetDetailsPanelOpen(false);
    if (typeof window === "undefined") {
      setIsAssetDetailsPanelVisible(false);
      setSelectedFindingForAssets(null);
      return;
    }
    window.setTimeout(() => {
      setIsAssetDetailsPanelVisible(false);
      setSelectedFindingForAssets(null);
    }, 220);
  };

  const assetDetailsRows = useMemo<AssetDetailsRow[]>(() => {
    if (!selectedFindingForAssets) {
      return [];
    }

    const relatedFindings = findingsForDrillthrough.filter(
      (finding) => finding.spiId === selectedFindingForAssets.spiId && finding.title === selectedFindingForAssets.title
    );
    const scopedFindings = relatedFindings.length ? relatedFindings : [selectedFindingForAssets];
    const byAsset = new Map<string, AssetDetailsRow>();

    for (const finding of scopedFindings) {
      const assetId = finding.scope.assetId;
      const existing = byAsset.get(assetId);
      if (!existing) {
        const assetName =
          readEvidenceStringValue(finding.evidence, ["assetName", "asset_name", "hostname", "assetHostname"]) ?? assetId;
        const assetIpAddress =
          readEvidenceStringValue(finding.evidence, [
            "assetIpAddress",
            "assetIp",
            "ipAddress",
            "ip",
            "ipv4Address",
            "ipv4",
            "ip_address"
          ]) ?? "Not available";
        const assetType = formatAssetTypeLabel(
          readEvidenceStringValue(finding.evidence, ["assetType", "asset_type", "type"])
        );
        const assetChangeAssignmentGroup =
          readEvidenceStringValue(finding.evidence, [
            "assetChangeAssignmentGroup",
            "changeAssignmentGroup",
            "changeGroup",
            "change_assignment_group"
          ]) ?? "Not assigned";
        const assetIncidentAssignmentGroup =
          readEvidenceStringValue(finding.evidence, [
            "assetIncidentAssignmentGroup",
            "incidentAssignmentGroup",
            "incidentGroup",
            "incident_assignment_group"
          ]) ?? "Not assigned";
        const owner =
          readEvidenceStringValue(finding.evidence, ["assetOwner", "owner", "serviceOwner"]) ?? "Not assigned";

        byAsset.set(assetId, {
          assetId,
          assetName,
          assetIpAddress,
          assetType,
          criticalExposureFindings: 0,
          highRiskFindings: 0,
          totalFindings: 0,
          assetChangeAssignmentGroup,
          assetIncidentAssignmentGroup,
          owner
        });
      }

      const row = byAsset.get(assetId);
      if (!row) {
        continue;
      }

      row.totalFindings += 1;
      if (finding.severity === "Critical Exposure") {
        row.criticalExposureFindings += 1;
      }
      if (finding.severity === "High Risk") {
        row.highRiskFindings += 1;
      }
    }

    return Array.from(byAsset.values()).sort((a, b) => {
      if (b.totalFindings !== a.totalFindings) {
        return b.totalFindings - a.totalFindings;
      }
      return a.assetName.localeCompare(b.assetName);
    });
  }, [findingsForDrillthrough, selectedFindingForAssets]);

  const downloadAssetDetailsCsv = () => {
    if (!selectedFindingForAssets || !assetDetailsRows.length || typeof window === "undefined") {
      return;
    }

    const headers = [
      "Asset Name",
      "Asset IP address",
      "Asset Type",
      "Total Critical Exposure Findings",
      "Total High Risk Findings",
      "Total Findings",
      "Asset Change Assignment Group",
      "Asset Incident Assignment Group",
      "Owner"
    ];
    const rows = assetDetailsRows.map((row) => [
      row.assetName,
      row.assetIpAddress,
      row.assetType,
      row.criticalExposureFindings,
      row.highRiskFindings,
      row.totalFindings,
      row.assetChangeAssignmentGroup,
      row.assetIncidentAssignmentGroup,
      row.owner
    ]);
    const csv = [headers, ...rows].map((row) => row.map((value) => escapeCsvValue(value)).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeId = selectedFindingForAssets.id.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
    anchor.href = url;
    anchor.download = `asset-details-${safeId}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-400/15 px-4 py-3">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Findings Register</h3>
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
          className="flex flex-wrap items-end gap-3 xl:flex-nowrap"
        >
          {preservedParams.map((param) => (
            <input key={param.key} type="hidden" name={param.key} value={param.value} />
          ))}
          <div className="flex min-w-[300px] flex-col gap-1">
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
                  SPI {option} - {SPI_DESCRIPTIONS[option as keyof typeof SPI_DESCRIPTIONS]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[160px] flex-1 flex-col gap-1">
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
            className="shrink-0 rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100"
          >
            Apply
          </button>
          {selectedSpi || selectedSearchTerm ? (
            <a
              href={clearFiltersHref}
              data-filter-loading="true"
              data-filter-loading-message="Applying filters..."
              className="shrink-0 rounded-md border border-slate-500/40 px-3 py-2 text-xs font-semibold text-slate-200"
            >
              Clear
            </a>
          ) : null}
        </form>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
            <tr>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">SPI</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">Evidence</th>
              <th className="px-3 py-2">Recommended Action</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((finding) => {
              const asOfStatus = workflowStatusAtAsOf(finding, selectedAsOf) ?? "open";
              return (
                <tr key={finding.id} className="border-t border-sky-400/10 align-top">
                  <td className="px-3 py-3 text-slate-100">{finding.priorityRank}</td>
                  <td className="px-3 py-3 text-slate-100">{finding.spiId}</td>
                  <td className="px-3 py-3 text-slate-200">{finding.severity}</td>
                  <td className="px-3 py-3 text-slate-300/90">{formatFindingTimestamp(finding.timestamp)}</td>
                  <td className="px-3 py-3 text-slate-100">
                    <button
                      type="button"
                      onClick={() => openAssetDetailsPanel(finding)}
                      className="text-left text-sky-100 underline decoration-sky-300/45 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                    >
                      {finding.title}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-slate-300/90">
                    <p>Workflow: {asOfStatus}</p>
                    <p>Compliance: {finding.complianceStatus}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-300/90">
                    <p>Network: {finding.scope.networkId}</p>
                    <p>System: {finding.scope.systemId ?? "-"}</p>
                    <p>Env: {finding.scope.environmentType ?? "-"}</p>
                    <p>Asset: {finding.scope.assetId}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-300/90">
                    {Object.entries(finding.evidence)
                      .slice(0, 4)
                      .map(([key, value]) => (
                        <p key={key}>
                          {key}: {String(value)}
                        </p>
                      ))}
                  </td>
                  <td className="px-3 py-3 text-slate-300/90">{finding.recommendedAction}</td>
                </tr>
              );
            })}
            {findings.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-300/80">
                  No findings match the selected SPI, Priority, Severity, and text search filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {pagination && pagination.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-400/10 px-4 py-3 text-xs text-slate-300/85">
          <p>
            Showing {(pagination.currentPage - 1) * pagination.pageSize + 1}-
            {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems}
          </p>
          <div className="flex items-center gap-2">
            {pagination.currentPage > 1 ? (
              <a
                href={buildPageHref(pagination.currentPage - 1)}
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
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            {pagination.currentPage < pagination.totalPages ? (
              <a
                href={buildPageHref(pagination.currentPage + 1)}
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
              <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Asset Details</p>
              <h4 id="findings-register-asset-details-title" className="mt-2 pr-16 text-xl font-semibold text-slate-100">
                Asset Details
              </h4>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-300/80">Selected Finding: {selectedFindingForAssets.title}</p>
                  <p className="mt-1 text-xs text-slate-300/80">Linked Assets: {assetDetailsRows.length}</p>
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

              <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-xl border border-sky-400/15">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                    <tr>
                      <th className="px-3 py-2">Asset Name</th>
                      <th className="px-3 py-2">Asset IP address</th>
                      <th className="px-3 py-2">Asset Type</th>
                      <th className="px-3 py-2">Total Critical Exposure Findings</th>
                      <th className="px-3 py-2">Total High Risk Findings</th>
                      <th className="px-3 py-2">Total Findings</th>
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
                        <td className="px-3 py-2 text-red-100">{assetRow.criticalExposureFindings}</td>
                        <td className="px-3 py-2 text-orange-100">{assetRow.highRiskFindings}</td>
                        <td className="px-3 py-2 text-slate-200">{assetRow.totalFindings}</td>
                        <td className="px-3 py-2 text-slate-300/85">{assetRow.assetChangeAssignmentGroup}</td>
                        <td className="px-3 py-2 text-slate-300/85">{assetRow.assetIncidentAssignmentGroup}</td>
                        <td className="px-3 py-2 text-slate-300/85">{assetRow.owner}</td>
                      </tr>
                    ))}
                    {assetDetailsRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-6 text-center text-sm text-emerald-200/90">
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
  );
}
