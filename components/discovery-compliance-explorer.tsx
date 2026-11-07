"use client";

import { useMemo, useState } from "react";
import { FilterHeader, SummaryChart } from "@/components/inventory-explorer-controls";
import { CmdbDeviceName } from "@/components/cmdb-drill-through";
import { NOT_RECORDED } from "@/lib/endpoint-explorer";
import {
  DISCOVERY_COMPLIANCE_COLUMNS, discoveryComplianceFacets, discoveryComplianceValue, discoveryComplianceSummary,
  emptyDiscoveryComplianceFilters, filterDiscoveryComplianceRows,
  type DiscoveryComplianceColumn, type DiscoveryComplianceFilters, type DiscoveryComplianceRecord
} from "@/lib/discovery-compliance-explorer";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

const number = (value: number) => value.toLocaleString("en-AU");
const charts = [
  { column: "compliant", title: "Discovery compliance", subtitle: "CIs by required tool coverage", tone: "tone-cyan" },
  { column: "missingTools", title: "Missing discovery tools", subtitle: "CIs per missing tool · Counts can overlap", tone: "tone-blue" },
  { column: "discoveredBy", title: "Discovered by", subtitle: "Recorded discovery sources", tone: "tone-violet" },
  { column: "lastDiscoveredDate", title: "Last discovered", subtitle: "Recorded discovery dates (UTC)", tone: "tone-teal" }
] as const;

export function DiscoveryComplianceExplorer({ rows, snapshotDate, scope, initialFilters }: {
  rows: DiscoveryComplianceRecord[]; snapshotDate: string; scope: WorkspaceSearchParams;
  initialFilters?: DiscoveryComplianceFilters;
}) {
  const [filters, setFilters] = useState<DiscoveryComplianceFilters>(() => initialFilters ?? emptyDiscoveryComplianceFilters());
  const [openColumn, setOpenColumn] = useState<DiscoveryComplianceColumn | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const filtered = useMemo(() => filterDiscoveryComplianceRows(rows, filters), [rows, filters]);
  const facets = useMemo(() => discoveryComplianceFacets(rows, filters), [rows, filters]);
  const summary = useMemo(() => discoveryComplianceSummary(rows, filters), [rows, filters]);
  const activeColumns = DISCOVERY_COMPLIANCE_COLUMNS.filter(({ key }) => filters.columns[key]?.length);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * pageSize;
  const changeColumn = (key: DiscoveryComplianceColumn, values: string[]) => {
    setFilters((current) => ({ ...current, columns: { ...current.columns, [key]: values } })); setPage(1);
  };
  const exportRows = async () => {
    if (exporting) return;
    setExporting(true); setExportError("");
    try {
      const response = await fetch("/api/discovery-coverage/compliance/export", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ scope: { ...scope, dataDate: snapshotDate }, filters })
      });
      if (!response.ok) throw new Error("The Excel export could not be created. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `discovery-compliance-explorer-${snapshotDate}.xlsx`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setExportError(reason instanceof Error ? reason.message : "Unable to export records."); }
    finally { setExporting(false); }
  };

  return <div className="endpoint-explorer discovery-compliance-page">
    <header className="endpoint-hero">
      <div><p className="endpoint-eyebrow">Discovery / CI discovery compliance</p><h1>Discovery Compliance Explorer</h1>
        <p className="endpoint-description">Explore CI discovery evidence and investigate missing tool coverage.</p></div>
      <div className="endpoint-total"><span>Total CI records in scope</span><strong>{number(rows.length)}</strong><small>Snapshot · {snapshotDate}</small></div>
    </header>
    <div className="endpoint-summary-caption"><span>Discovery across your CIs</span><span>Click a chart bar to filter · Counts respect other filters</span></div>
    <div className="endpoint-charts">{charts.map(chart => <SummaryChart key={chart.column} title={chart.title} subtitle={chart.subtitle} tone={chart.tone}
      counts={[...facets[chart.column]].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))} selected={filters.columns[chart.column] ?? []}
      onSelect={value => {
        const selected = filters.columns[chart.column] ?? [];
        changeColumn(chart.column, selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]);
        setOpenColumn(null);
      }} />)}</div>
    <section id="discovery-compliance-results" className="endpoint-results discovery-compliance-results" aria-label="Discovery compliance results">
    <div className="endpoint-toolbar">
      <div><h2>Discovery compliance <span>{number(filtered.length)}</span></h2>
        <p role="status">{number(filtered.length)} matching records · {number(rows.length)} total in scope</p>
        <p>{summary.coveragePercent}% of required tool checks covered across matching CIs</p></div>
      <div className="endpoint-toolbar-actions">
        <input type="search" maxLength={500} aria-label="Search all discovery compliance fields" placeholder="Search all compliance fields..." value={filters.search}
          onChange={(event) => { setFilters((current) => ({ ...current, search: event.target.value })); setPage(1); }} />
        <button type="button" className="endpoint-export" onClick={exportRows} disabled={exporting || !filtered.length}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5" /></svg>
          {exporting ? "Exporting..." : "Export Excel"}
        </button>
      </div>
    </div>
    {(filters.search || activeColumns.length > 0) && <div className="endpoint-active-filters" aria-label="Active discovery compliance filters">
      <span>Filtered by</span>
      {filters.search && <button type="button" onClick={() => { setFilters((current) => ({ ...current, search: "" })); setPage(1); }} aria-label="Clear search filter">Search: {filters.search} <span aria-hidden="true">×</span></button>}
      {activeColumns.map(({ key, label }) => <button type="button" key={key} onClick={() => changeColumn(key, [])} aria-label={`Clear ${label} filter`}>
        {label}: {filters.columns[key]!.length === 1 ? filters.columns[key]![0] : `${filters.columns[key]!.length} selected`} <span aria-hidden="true">×</span>
      </button>)}
      <button type="button" className="endpoint-clear-all" onClick={() => { setFilters(emptyDiscoveryComplianceFilters()); setPage(1); }}>Clear all filters</button>
    </div>}
    {exportError && <p role="alert" className="endpoint-export-error">{exportError}</p>}
    <hr className="endpoint-divider" />
    <div className="endpoint-table-scroll"><table className="endpoint-table discovery-compliance-table">
      <thead><tr>{DISCOVERY_COMPLIANCE_COLUMNS.map((column) => <th scope="col" key={column.key}>
        <FilterHeader column={column} selected={filters.columns[column.key] ?? []} options={facets[column.key]} open={openColumn === column.key}
          onOpen={(open) => setOpenColumn(open ? column.key : null)} onChange={(values) => changeColumn(column.key, values)} />
      </th>)}</tr></thead>
      <tbody>{filtered.slice(start, start + pageSize).map((row) => <tr key={row.assetId}>
        {DISCOVERY_COMPLIANCE_COLUMNS.map(({ key }) => <td key={key} className={`${key === "hostname" ? "endpoint-name" : ""} ${key === "ipAddress" ? "endpoint-address" : ""} ${discoveryComplianceValue(row, key) === NOT_RECORDED ? "endpoint-missing" : ""}`}>
          {key === "hostname" ? <><CmdbDeviceName assetId={row.assetId} name={row.hostname} /><small>{row.assetId}</small></>
            : key === "assetType" ? <span className="endpoint-type-badge">{discoveryComplianceValue(row, key)}</span>
            : key === "compliant" ? <span className={`coverage-status ${row.compliant ? "is-covered" : "has-gaps"}`}>{discoveryComplianceValue(row, key)}</span>
            : discoveryComplianceValue(row, key)}
        </td>)}
      </tr>)}{!filtered.length && <tr><td colSpan={DISCOVERY_COMPLIANCE_COLUMNS.length}><div className="endpoint-empty">
        <strong>No matching CIs</strong><p>{rows.length ? "Clear or adjust your filters to see more records." : "No CIs are available for this scope and date."}</p>
      </div></td></tr>}</tbody>
    </table></div>
    <footer className="endpoint-pagination"><span>{filtered.length ? `${number(start + 1)}–${number(Math.min(start + pageSize, filtered.length))}` : "0"} of {number(filtered.length)} records</span>
      <div><label>Rows per page <select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[25, 50, 100, 250].map((size) => <option key={size}>{size}</option>)}</select></label>
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} / {pages}</span>
        <button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
    </footer>
    <p className="endpoint-export-note">Excel exports include every matching record across all pages, with the active scope, search and column filters applied, and an export timestamp in UTC.</p>
    </section>
  </div>;
}
