"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  PerformanceAffectedCiRow,
  PerformanceEntityDetails,
  PerformanceReportModel,
  PerformanceSpiMatrixRow,
  PerformanceSpiScore
} from "@/lib/performance-report-model";
import { type CveVulnerabilityDetail, type SpiId } from "@/lib/types";

interface SpiDrillPanelState {
  row: PerformanceSpiMatrixRow;
  spi: PerformanceSpiScore;
}

const PANEL_TWEEN_MS = 260;

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function scoreCellClass(score: number, total: number): string {
  if (!total) {
    return "border-slate-500/25 bg-slate-800/35 text-slate-300";
  }
  if (score >= 95) {
    return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
  }
  if (score >= 80) {
    return "border-amber-300/20 bg-amber-500/10 text-amber-100";
  }
  return "border-red-300/20 bg-red-500/10 text-red-100";
}

function filterRows(rows: PerformanceSpiMatrixRow[], searchValue: string): PerformanceSpiMatrixRow[] {
  const normalizedSearch = searchValue.trim().toLowerCase();
  if (!normalizedSearch) {
    return rows;
  }

  return rows.filter((row) =>
    `${row.securityDomain} ${row.entityName}`.toLowerCase().includes(normalizedSearch)
  );
}

function visibleScores(row: PerformanceSpiMatrixRow, selectedSpiId?: SpiId): PerformanceSpiScore[] {
  if (!selectedSpiId) {
    return row.spis;
  }
  return row.spis.filter((score) => score.spiId === selectedSpiId);
}

function isExternalLink(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (!/[",\r\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
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

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  if (typeof window === "undefined") {
    return;
  }

  const csvContent = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatCapturedTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return `${parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  })} UTC`;
}

function cveCriticalityClass(criticality: string): string {
  if (criticality === "Critical") {
    return "text-red-100";
  }
  if (criticality === "High") {
    return "text-orange-100";
  }
  if (criticality === "Medium") {
    return "text-amber-100";
  }
  return "text-slate-200";
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="panel-alt p-3">
      <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">{label}</dt>
      <dd className="mt-1 text-sm text-slate-100">{children}</dd>
    </div>
  );
}

function EntityDetailsPanel({
  details,
  onClose
}: {
  details: PerformanceEntityDetails | null;
  onClose: () => void;
}) {
  if (!details) {
    return null;
  }

  const titleId = "measures-spi-entity-details-title";

  return (
    <div className="fixed inset-0 z-[165]">
      <div className="absolute inset-0 bg-slate-950/88 backdrop-blur-[1px]" onClick={onClose} />
      <aside
        className="absolute right-0 top-0 h-full w-[min(560px,94vw)] overflow-auto border-l border-sky-300/35 bg-slate-950 p-5 shadow-[-22px_0_42px_rgba(0,0,0,0.55)] transition-all duration-[260ms] ease-out"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ transitionDuration: `${PANEL_TWEEN_MS}ms` }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
        >
          Close
        </button>

        <div className="pt-2">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">
            {details.scopeType === "network" ? "Network Details" : "ICT System Details"}
          </p>
          <h3 id={titleId} className="mt-2 pr-16 text-2xl font-semibold text-slate-100">
            {details.name}
          </h3>
        </div>

        <dl className="mt-5 space-y-4">
          <DetailField label="Description">{details.description}</DetailField>
          {details.scopeType === "system" ? (
            <>
              <DetailField label="Dependent mission capabilites">{details.missionCapabilities ?? "-"}</DetailField>
              <DetailField label="Dependent business services">{details.businessServices ?? "-"}</DetailField>
            </>
          ) : null}
          <DetailField label="Owner">{details.owner}</DetailField>
          <DetailField label="Support Mailbox">
            <a className="underline decoration-sky-300/60 underline-offset-2" href={`mailto:${details.supportEmail}`}>
              {details.supportEmail}
            </a>
          </DetailField>
          <DetailField label="Service Catalogue Item">
            <Link
              href={details.serviceCatalogueUrl}
              className="underline decoration-sky-300/60 underline-offset-2"
              target={isExternalLink(details.serviceCatalogueUrl) ? "_blank" : undefined}
              rel={isExternalLink(details.serviceCatalogueUrl) ? "noreferrer" : undefined}
            >
              Open Service Catalogue Item
            </Link>
          </DetailField>
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
                    <td className="px-2 py-2 font-semibold text-sky-50">{details.atoNumber}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-3 text-sky-100">
                        <Link
                          href={details.diisUrl}
                          className="underline decoration-sky-300/70 underline-offset-2"
                          target={isExternalLink(details.diisUrl) ? "_blank" : undefined}
                          rel={isExternalLink(details.diisUrl) ? "noreferrer" : undefined}
                        >
                          View in DIIS
                        </Link>
                        <Link
                          href={details.grcUrl}
                          className="underline decoration-sky-300/70 underline-offset-2"
                          target={isExternalLink(details.grcUrl) ? "_blank" : undefined}
                          rel={isExternalLink(details.grcUrl) ? "noreferrer" : undefined}
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
          {details.scopeType === "system" ? (
            <>
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
                        <td className="px-2 py-2 font-semibold text-sky-50">{details.apmNumber}</td>
                        <td className="px-2 py-2">
                          <Link
                            href={details.apmUrl ?? "#"}
                            className="text-sky-100 underline decoration-sky-300/70 underline-offset-2"
                            target={details.apmUrl && isExternalLink(details.apmUrl) ? "_blank" : undefined}
                            rel={details.apmUrl && isExternalLink(details.apmUrl) ? "noreferrer" : undefined}
                          >
                            View in APM
                          </Link>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </dd>
              </div>
              <div className="security-accreditation-pulse rounded-xl border border-cyan-300/90 bg-sky-400/16 p-3 shadow-[0_0_14px_rgba(103,232,249,0.32)]">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-sky-100/95">Defence ICT Inventory System</dt>
                <dd className="mt-2">
                  <table className="min-w-full text-sm">
                    <tbody>
                      <tr className="border-t border-sky-300/35 text-slate-100">
                        <td className="px-2 py-2 font-semibold text-sky-50">{details.diisId}</td>
                        <td className="px-2 py-2">
                          <Link
                            href={details.diisUrl}
                            className="text-sky-100 underline decoration-sky-300/70 underline-offset-2"
                            target={isExternalLink(details.diisUrl) ? "_blank" : undefined}
                            rel={isExternalLink(details.diisUrl) ? "noreferrer" : undefined}
                          >
                            View in DIIS
                          </Link>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </aside>
    </div>
  );
}

function SpiDrillPanel({
  panel,
  onClose,
  onOpenAffectedCis
}: {
  panel: SpiDrillPanelState | null;
  onClose: () => void;
  onOpenAffectedCis: (panel: SpiDrillPanelState) => void;
}) {
  if (!panel) {
    return null;
  }

  const { row, spi } = panel;

  return (
    <div className="fixed inset-0 z-[150]">
      <div className="absolute inset-0 bg-slate-950/88 backdrop-blur-[1px]" onClick={onClose} />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-[54rem] flex-col border-l border-sky-300/30 bg-slate-950 p-4 shadow-[-22px_0_42px_rgba(0,0,0,0.55)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="measures-spi-heatmap-drill-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
        >
          Close
        </button>
        <div className="panel shrink-0 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">SPI Heatmap Drill-Through</p>
          <h3 id="measures-spi-heatmap-drill-title" className="mt-1 pr-16 text-2xl font-semibold text-slate-100">
            {spi.label}: {spi.name}
          </h3>
          <p className="mt-1 text-sm text-slate-300/80">
            {row.securityDomain} / {row.entityName}
          </p>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-sky-300/15 bg-slate-950/55">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2 text-left">Score</th>
                <th className="px-3 py-2 text-left">Compliant</th>
                <th className="px-3 py-2 text-left">Non-compliant</th>
                <th className="px-3 py-2 text-left">Unknown</th>
                <th className="px-3 py-2 text-left">Success Measure</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-sky-300/10">
                <td className="px-3 py-2 text-slate-200">{formatPercent(spi.scorePercent)}</td>
                <td className="px-3 py-2 text-emerald-100">{spi.compliant}</td>
                <td className="px-3 py-2">
                  {spi.nonCompliant > 0 ? (
                    <button
                      type="button"
                      onClick={() => onOpenAffectedCis(panel)}
                      className="text-left text-sky-100 underline decoration-sky-300/45 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                    >
                      {spi.nonCompliant}
                    </button>
                  ) : (
                    <span className="text-slate-300">0</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-200">{spi.unknown}</td>
                <td className="px-3 py-2 text-slate-200">{spi.successMeasure}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}

function AffectedCisPanel({
  panel,
  selectedAssetForCves,
  onClose,
  onOpenCves
}: {
  panel: SpiDrillPanelState | null;
  selectedAssetForCves: PerformanceAffectedCiRow | null;
  onClose: () => void;
  onOpenCves: (row: PerformanceAffectedCiRow | null) => void;
}) {
  if (!panel) {
    return null;
  }

  const rows = panel.spi.affectedCis;
  const title = `${panel.spi.label}: ${panel.spi.name}`;

  const onExport = () => {
    downloadCsv(
      `affected-cis-${safeSlug(`${panel.row.entityName}-${panel.spi.label}`, "affected-cis")}.csv`,
      [
        "Asset Name",
        "Asset IP address",
        "Asset Type",
        "CVE Vulnerabilities",
        "Asset Change Assignment Group",
        "Asset Incident Assignment Group",
        "Owner"
      ],
      rows.map((row) => [
        row.assetName,
        row.assetIpAddress,
        row.assetType,
        row.totalCveVulnerabilities,
        row.assetChangeAssignmentGroup,
        row.assetIncidentAssignmentGroup,
        row.owner
      ])
    );
  };

  return (
    <div className="fixed inset-0 z-[170]">
      <div className="absolute inset-0 bg-slate-950/92 backdrop-blur-[1px]" onClick={onClose} />
      <aside
        className="absolute right-0 top-0 flex h-full w-full flex-col border-l border-sky-300/35 bg-slate-950 p-4 shadow-[-22px_0_42px_rgba(0,0,0,0.55)] transition-all duration-[260ms] ease-out"
        role="dialog"
        aria-modal="true"
        aria-labelledby="measures-spi-affected-cis-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
        >
          Close
        </button>
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Affected CIs</p>
          <h5 id="measures-spi-affected-cis-title" className="mt-2 pr-16 text-xl font-semibold text-slate-100">
            Affected CIs
          </h5>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-slate-300/80">Selected SPI: {title}</p>
              <p className="mt-1 text-xs text-slate-300/80">
                Scope: {panel.row.securityDomain} / {panel.row.entityName}
              </p>
              <p className="mt-1 text-xs text-slate-300/80">Affected CIs: {rows.length}</p>
            </div>
            <button
              type="button"
              onClick={onExport}
              disabled={!rows.length}
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
                {rows.map((assetRow) => (
                  <tr key={assetRow.assetId} className="border-t border-sky-400/10 align-top">
                    <td className="px-3 py-2 text-slate-100">{assetRow.assetName}</td>
                    <td className="px-3 py-2 text-slate-300/85">{assetRow.assetIpAddress}</td>
                    <td className="px-3 py-2 text-slate-300/85">{assetRow.assetType}</td>
                    <td className="px-3 py-2">
                      {assetRow.totalCveVulnerabilities > 0 ? (
                        <button
                          type="button"
                          onClick={() => onOpenCves(assetRow)}
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
                {!rows.length ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-emerald-200/90">
                      No affected CIs for this selected SPI and entity scope.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </aside>
      <CveDetailsModal assetRow={selectedAssetForCves} onClose={() => onOpenCves(null)} />
    </div>
  );
}

function CveDetailsModal({
  assetRow,
  onClose
}: {
  assetRow: PerformanceAffectedCiRow | null;
  onClose: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  if (!assetRow) {
    return null;
  }

  const cves = assetRow.cveVulnerabilities;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredCves = cves.filter((entry) => {
    if (!normalizedSearch) {
      return true;
    }
    return [
      entry.cve,
      entry.description,
      entry.remediationGuidance,
      entry.criticality,
      entry.exploitability,
      entry.capturedAt
    ].join(" ").toLowerCase().includes(normalizedSearch);
  });

  const onExport = () => {
    downloadCsv(
      `cve-vulnerabilities-${safeSlug(assetRow.assetName, "asset-cves")}.csv`,
      ["Asset Name", "Asset ID", "CVE", "Description", "Remediation Guidance", "Criticality", "Timestamp"],
      filteredCves.map((entry) => [
        assetRow.assetName,
        assetRow.assetId,
        entry.cve,
        entry.description,
        entry.remediationGuidance,
        entry.criticality,
        formatCapturedTimestamp(entry.capturedAt)
      ])
    );
  };

  return (
    <div className="fixed inset-0 z-[180]">
      <div className="absolute inset-0 bg-slate-950/88 backdrop-blur-[1px]" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <section
          className="relative flex h-[min(88vh,760px)] w-[min(1380px,95vw)] flex-col rounded-2xl border border-sky-300/35 bg-slate-950 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)] transition-all duration-[260ms] ease-out"
          role="dialog"
          aria-modal="true"
          aria-labelledby="measures-spi-cve-details-title"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
          >
            Close
          </button>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">CVE Details</p>
          <h6 id="measures-spi-cve-details-title" className="mt-2 pr-16 text-xl font-semibold text-slate-100">
            CVE Vulnerabilities
          </h6>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-slate-300/80">Asset: {assetRow.assetName}</p>
              <p className="mt-1 text-xs text-slate-300/80">
                CVEs in scope: {filteredCves.length} of {cves.length}
              </p>
            </div>
            <button
              type="button"
              onClick={onExport}
              disabled={!filteredCves.length}
              className="rounded-md border border-sky-300/35 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-500/35 disabled:text-slate-400"
            >
              Export CSV
            </button>
          </div>
          <div className="mt-3">
            <label htmlFor="measures-spi-cve-search" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
              Text Search
            </label>
            <input
              id="measures-spi-cve-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search CVE, description, remediation, criticality, timestamp..."
              className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
            />
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
                {filteredCves.map((entry: CveVulnerabilityDetail, index) => (
                  <tr key={`${assetRow.assetId}-${entry.cve}-${entry.capturedAt}-${index}`} className="border-t border-sky-400/10 align-top">
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
                {!filteredCves.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-emerald-200/90">
                      {cves.length === 0 ? "No CVE vulnerabilities for this asset." : "No CVE records match the active filters."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export function MeasuresSpiHeatmap({
  model,
  selectedSpiId,
  searchValue
}: {
  model: PerformanceReportModel;
  selectedSpiId?: SpiId;
  searchValue: string;
}) {
  const [drillPanel, setDrillPanel] = useState<SpiDrillPanelState | null>(null);
  const [affectedCisPanel, setAffectedCisPanel] = useState<SpiDrillPanelState | null>(null);
  const [selectedAssetForCves, setSelectedAssetForCves] = useState<PerformanceAffectedCiRow | null>(null);
  const [selectedEntityDetails, setSelectedEntityDetails] = useState<PerformanceEntityDetails | null>(null);
  const rows = useMemo(() => filterRows(model.spiMatrixRows, searchValue), [model.spiMatrixRows, searchValue]);
  const visibleSpiCount = selectedSpiId ? 1 : 10;
  const gridTemplateColumns = `minmax(5.25rem,0.65fr) minmax(11rem,1.8fr) repeat(${visibleSpiCount}, minmax(0,0.3fr))`;
  const headerScores = visibleScores(
    model.spiMatrixRows[0] ?? {
      id: "empty",
      securityDomain: "Secret",
      entityId: "empty",
      entityName: "Empty",
      entityDetails: {
        scopeType: model.scopeType,
        id: "empty",
        name: "Empty",
        description: "No entity details available.",
        owner: "Not assigned",
        supportEmail: "Not assigned",
        serviceCatalogueUrl: "#",
        atoNumber: "-",
        diisUrl: "#",
        grcUrl: "#"
      },
      spis: []
    },
    selectedSpiId
  );

  return (
    <section className="panel flex h-full min-h-0 flex-col p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">
            {model.entityLabelPlural} - SPI Heatmap
          </h3>
          <p className="mt-1 text-xs text-slate-300/80">
            SPI scores by Security Domain x {model.entityLabelSingular}.
          </p>
        </div>
        <p className="text-xs text-slate-300/80">
          {rows.length} rows | {selectedSpiId ? `SPI ${selectedSpiId}` : "All SPIs"}
        </p>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-sky-300/15 bg-slate-950/45">
        <div
          className="sticky top-0 z-[1] grid items-center gap-1 bg-slate-900/95 px-2 py-2 text-xs uppercase tracking-[0.12em] text-slate-300/80"
          style={{ gridTemplateColumns }}
        >
          <div className="min-w-0 truncate px-1">Domain</div>
          <div className="min-w-0 truncate px-1">{model.entityLabelSingular}</div>
          {headerScores.map((spi) => (
            <div
              key={spi.id}
              title={`${spi.label}: ${spi.name} - ${spi.description}`}
              className="min-w-0 px-1 text-center"
            >
              S{spi.spiId}
            </div>
          ))}
        </div>

        {rows.length ? (
          <div className="divide-y divide-sky-300/10">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid min-w-0 items-center gap-1 px-2 py-2"
                style={{ gridTemplateColumns }}
              >
                <div className="min-w-0 truncate px-1 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-300">
                  {row.securityDomain}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntityDetails(row.entityDetails)}
                  className="min-w-0 truncate px-1 py-1 text-left text-xs font-semibold text-sky-100 underline decoration-sky-300/40 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                >
                  {row.entityName}
                </button>
                {visibleScores(row, selectedSpiId).map((spi) => (
                  <button
                    key={`${row.id}-${spi.id}`}
                    type="button"
                    title={`${spi.label}: ${spi.name} - ${spi.description}`}
                    className={`min-w-0 rounded border px-1 py-1 text-center text-xs font-semibold leading-tight transition hover:border-sky-200/55 ${scoreCellClass(spi.scorePercent, spi.total)}`}
                    onClick={() => setDrillPanel({ row, spi })}
                  >
                    {spi.total ? Math.round(spi.scorePercent) : "-"}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-6 text-sm text-slate-300/80">
            No domain/entity rows match the current SPI heatmap filters.
          </div>
        )}
      </div>

      <SpiDrillPanel
        panel={drillPanel}
        onClose={() => setDrillPanel(null)}
        onOpenAffectedCis={(panel) => {
          setSelectedAssetForCves(null);
          setAffectedCisPanel(panel);
        }}
      />
      <AffectedCisPanel
        panel={affectedCisPanel}
        selectedAssetForCves={selectedAssetForCves}
        onClose={() => {
          setAffectedCisPanel(null);
          setSelectedAssetForCves(null);
        }}
        onOpenCves={(row) => setSelectedAssetForCves(row)}
      />
      <EntityDetailsPanel details={selectedEntityDetails} onClose={() => setSelectedEntityDetails(null)} />
    </section>
  );
}
