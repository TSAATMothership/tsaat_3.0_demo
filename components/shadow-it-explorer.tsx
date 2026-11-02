"use client";

import { useMemo, useState } from "react";
import { CmdbDeviceName } from "@/components/cmdb-drill-through";
import { FilterHeader, SummaryChart } from "@/components/inventory-explorer-controls";
import { DISCOVERY_AGE_BUCKETS, NOT_RECORDED, discoveryAge, type DiscoveryAge } from "@/lib/endpoint-explorer";
import {
  SHADOW_COLUMNS, emptyShadowFilters, shadowFacetCounts, shadowValue, filterShadowRows,
  type ShadowItRecord, type ShadowColumn, type ShadowFilters
} from "@/lib/shadow-it-explorer";

type Count = { value: string; count: number };
const number = (value: number) => value.toLocaleString("en-AU");
const toggle = <T extends string,>(values: T[], value: T): T[] => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

export function ShadowItExplorer({ rows, snapshotDate, scope, initialFilters }: {
  rows: ShadowItRecord[]; snapshotDate: string; scope: { network: string[]; system: string[]; dataDate: string };
  initialFilters?: ShadowFilters;
}) {
  const [filters, setFilters] = useState<ShadowFilters>(() => initialFilters ?? emptyShadowFilters());
  const [openColumn, setOpenColumn] = useState<ShadowColumn | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const filtered = useMemo(() => filterShadowRows(rows, filters, snapshotDate), [rows, filters, snapshotDate]);
  const activeColumns = SHADOW_COLUMNS.filter(({ key }) => filters.columns[key]?.length);
  const isFiltered = Boolean(filters.search || activeColumns.length || filters.recency.length);
  const facets = useMemo(() => Object.fromEntries(SHADOW_COLUMNS.map(({ key }) => [key,
    shadowFacetCounts(filterShadowRows(rows, filters, snapshotDate, key), key)
  ])) as Record<ShadowColumn, Count[]>, [rows, filters, snapshotDate]);
  const ages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of filterShadowRows(rows, filters, snapshotDate, undefined, true)) {
      const age = discoveryAge(row, snapshotDate);
      counts.set(age, (counts.get(age) ?? 0) + 1);
    }
    return DISCOVERY_AGE_BUCKETS.map((value) => ({ value, count: counts.get(value) ?? 0 }))
      .filter((item) => item.count || filters.recency.includes(item.value));
  }, [rows, filters, snapshotDate]);
  const scanCount = useMemo(() => filtered.filter((row) => row.discoveryApproach === "IP Scan").length, [filtered]);
  const arpCount = filtered.length - scanCount;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * pageSize;
  const changeColumn = (column: ShadowColumn, values: string[]) => {
    setFilters((current) => ({ ...current, columns: { ...current.columns, [column]: values } })); setPage(1);
  };
  const exportRows = async () => {
    if (exporting) return;
    setExporting(true); setExportError("");
    try {
      const response = await fetch("/api/discovery-coverage/shadow-it/export", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, filters }), cache: "no-store" });
      if (!response.ok) throw new Error("The Excel export could not be created. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `shadow-it-explorer-${snapshotDate}.xlsx`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setExportError(reason instanceof Error ? reason.message : "Unable to export records."); }
    finally { setExporting(false); }
  };
  return <div className="endpoint-explorer shadow-explorer">
    <header className="endpoint-hero">
      <div><p className="endpoint-eyebrow">Discovery / Unclassified network endpoints</p><h1>Shadow IT Explorer</h1>
        <p className="endpoint-description">Investigate IP Nodes detected by scans and endpoint ARP tables.</p></div>
      <div className="endpoint-total"><span>Total IP Node records in scope</span><strong>{number(rows.length)}</strong><small>Snapshot · {snapshotDate}</small></div>
    </header>
    <div className="endpoint-summary-caption"><span>IP Nodes at a glance</span><span>Click a chart bar to filter · Counts respect other filters</span></div>
    <div className="endpoint-charts">
      <SummaryChart title="Discovery approach" subtitle="How each unknown address was observed" counts={facets.discoveryApproach} selected={filters.columns.discoveryApproach ?? []}
        onSelect={(value) => changeColumn("discoveryApproach", toggle(filters.columns.discoveryApproach ?? [], value))} tone="tone-amber" />
      <SummaryChart title="Discovered by" subtitle="Sources reporting IP Node observations" counts={facets.discoveredBy} selected={filters.columns.discoveredBy ?? []}
        onSelect={(value) => changeColumn("discoveredBy", toggle(filters.columns.discoveredBy ?? [], value))} tone="tone-violet" />
      <SummaryChart title="ARP table owner CI type" subtitle="IP Scan records have no owning endpoint" counts={facets.endpointCiType} selected={filters.columns.endpointCiType ?? []}
        onSelect={(value) => changeColumn("endpointCiType", toggle(filters.columns.endpointCiType ?? [], value))} tone="tone-blue" />
      <SummaryChart title="Last discovered" subtitle={`Age as of snapshot ${snapshotDate}`} counts={ages} selected={filters.recency}
        onSelect={(value) => { setFilters((current) => ({ ...current, recency: toggle(current.recency, value as DiscoveryAge) })); setPage(1); }} tone="tone-teal" />
    </div>
    <section className="endpoint-results" aria-label="Shadow IT results">
      <div className="endpoint-toolbar">
        <div><h2>IP Nodes <span>{number(filtered.length)}</span></h2><p role="status">{number(filtered.length)} matching records · {number(rows.length)} total in scope</p>
          <p>{number(scanCount)} IP Scan · {number(arpCount)} ARP Table</p></div>
        <div className="endpoint-toolbar-actions"><input type="search" maxLength={500} aria-label="Search all Shadow IT fields" placeholder="Search all Shadow IT fields..." value={filters.search}
          onChange={(event) => { setFilters((current) => ({ ...current, search: event.target.value })); setPage(1); }} />
          <button type="button" className="endpoint-export" onClick={exportRows} disabled={exporting || !filtered.length}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5" /></svg>
            {exporting ? "Exporting..." : "Export Excel"}</button>
        </div>
      </div>
      {isFiltered && <div className="endpoint-active-filters" aria-label="Active Shadow IT filters">
        <span>Filtered by</span>{activeColumns.map(({ key, label }) => <button type="button" key={key} onClick={() => changeColumn(key, [])} aria-label={`Clear ${label} filter`}>
          {label}: {filters.columns[key]!.length === 1 ? filters.columns[key]![0] : `${filters.columns[key]!.length} selected`} <span aria-hidden="true">×</span></button>)}
        {filters.recency.length > 0 && <button type="button" onClick={() => { setFilters((current) => ({ ...current, recency: [] })); setPage(1); }}>Discovery age: {filters.recency.join(", ")} <span aria-hidden="true">×</span></button>}
        <button type="button" className="endpoint-clear-all" onClick={() => { setFilters(emptyShadowFilters()); setPage(1); }}>Clear all filters</button>
      </div>}
      {exportError && <p role="alert" className="endpoint-export-error">{exportError}</p>}
      <hr className="endpoint-divider" />
      <div className="endpoint-table-scroll"><table className="endpoint-table shadow-table"><thead><tr>{SHADOW_COLUMNS.map((column) => <th scope="col" key={column.key}>
        <FilterHeader column={column} selected={filters.columns[column.key] ?? []} options={facets[column.key]} open={openColumn === column.key}
          onOpen={(open) => setOpenColumn(open ? column.key : null)} onChange={(values) => changeColumn(column.key, values)} />
      </th>)}</tr></thead><tbody>{filtered.slice(start, start + pageSize).map((row) => <tr key={row.assetId}>
        {SHADOW_COLUMNS.map(({ key }) => <td key={key} className={`${key === "endpointName" ? "endpoint-name" : ""} ${["ipAddress", "endpointIpAddress", "endpointMacAddress"].includes(key) ? "endpoint-address" : ""} ${shadowMissing(row, key) ? "endpoint-missing" : ""}`}>
          {key === "endpointName" && row.discoveryApproach === "ARP Table" && row.ownerAssetId ? <><CmdbDeviceName assetId={row.ownerAssetId} name={shadowValue(row, key)} /><small>{row.ownerAssetId}</small></>
            : key === "ipAddress" ? <strong className="shadow-ip">{shadowValue(row, key)}</strong>
            : <span title={shadowValue(row, key)}>{shadowValue(row, key)}</span>}
        </td>)}
      </tr>)}{!filtered.length && <tr><td colSpan={SHADOW_COLUMNS.length}><div className="endpoint-empty"><strong>No IP Nodes found</strong><p>{rows.length ? "Clear or adjust your filters to see more records." : "No unidentified IP Nodes are recorded for this scope and date."}</p></div></td></tr>}</tbody></table></div>
      <footer className="endpoint-pagination"><span>{filtered.length ? `${number(start + 1)}–${number(Math.min(start + pageSize, filtered.length))}` : "0"} of {number(filtered.length)} records</span>
        <div><label>Rows per page <select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[25, 50, 100, 250].map((size) => <option key={size}>{size}</option>)}</select></label>
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} / {pages}</span>
          <button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
      </footer>
      <p className="endpoint-export-note">Endpoint columns describe the owner of the ARP table. IP Scan records show N/A. Excel exports include all matching IP Nodes and an export timestamp in UTC.</p>
    </section>
  </div>;
}

function shadowMissing(row: ShadowItRecord, column: ShadowColumn) { return shadowValue(row, column) === NOT_RECORDED; }
