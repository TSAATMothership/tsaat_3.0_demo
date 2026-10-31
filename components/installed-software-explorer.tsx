"use client";

import { useMemo, useState } from "react";
import { CmdbDeviceName } from "@/components/cmdb-drill-through";
import { FilterHeader, SummaryChart } from "@/components/inventory-explorer-controls";
import { DISCOVERY_AGE_BUCKETS, NOT_RECORDED, discoveryAge, type DiscoveryAge } from "@/lib/endpoint-explorer";
import {
  SOFTWARE_COLUMNS, emptySoftwareFilters, softwareFacetCounts, softwareValue, filterSoftwareRows,
  type InstalledSoftwareRecord, type SoftwareColumn, type SoftwareFilters
} from "@/lib/installed-software-explorer";

type Count = { value: string; count: number };
const number = (value: number) => value.toLocaleString("en-AU");
const toggle = <T extends string,>(values: T[], value: T): T[] => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

export function InstalledSoftwareExplorer({ rows, snapshotDate, scope }: {
  rows: InstalledSoftwareRecord[]; snapshotDate: string; scope: { network: string[]; system: string[]; dataDate: string };
}) {
  const [filters, setFilters] = useState<SoftwareFilters>(emptySoftwareFilters);
  const [openColumn, setOpenColumn] = useState<SoftwareColumn | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const filtered = useMemo(() => filterSoftwareRows(rows, filters, snapshotDate), [rows, filters, snapshotDate]);
  const activeColumns = SOFTWARE_COLUMNS.filter(({ key }) => filters.columns[key]?.length);
  const isFiltered = Boolean(filters.search || activeColumns.length || filters.recency.length);
  const facets = useMemo(() => Object.fromEntries(SOFTWARE_COLUMNS.map(({ key }) => [key,
    softwareFacetCounts(filterSoftwareRows(rows, filters, snapshotDate, key), key)
  ])) as Record<SoftwareColumn, Count[]>, [rows, filters, snapshotDate]);
  const ages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of filterSoftwareRows(rows, filters, snapshotDate, undefined, true)) {
      const age = discoveryAge(row, snapshotDate);
      counts.set(age, (counts.get(age) ?? 0) + 1);
    }
    return DISCOVERY_AGE_BUCKETS.map((value) => ({ value, count: counts.get(value) ?? 0 }))
      .filter((item) => item.count || filters.recency.includes(item.value));
  }, [rows, filters, snapshotDate]);
  const endpointCount = useMemo(() => new Set(filtered.map((row) => row.assetId)).size, [filtered]);
  const productCount = useMemo(() => new Set(filtered.map((row) => softwareValue(row, "softwareName"))).size, [filtered]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * pageSize;
  const changeColumn = (column: SoftwareColumn, values: string[]) => {
    setFilters((current) => ({ ...current, columns: { ...current.columns, [column]: values } })); setPage(1);
  };
  const exportRows = async () => {
    if (exporting) return;
    setExporting(true); setExportError("");
    try {
      const response = await fetch("/api/discovery-coverage/installed-software/export", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, filters }), cache: "no-store" });
      if (!response.ok) throw new Error("The Excel export could not be created. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `installed-software-explorer-${snapshotDate}.xlsx`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setExportError(reason instanceof Error ? reason.message : "Unable to export records."); }
    finally { setExporting(false); }
  };
  return <div className="endpoint-explorer software-explorer">
    <header className="endpoint-hero">
      <div><p className="endpoint-eyebrow">Discovery / CMDB software inventory</p><h1>Installed Software Explorer</h1>
        <p className="endpoint-description">Explore software installations and the endpoints that host them.</p></div>
      <div className="endpoint-total"><span>Total installation records in scope</span><strong>{number(rows.length)}</strong><small>Snapshot · {snapshotDate}</small></div>
    </header>
    <div className="endpoint-summary-caption"><span>Software across your endpoints</span><span>Click a chart bar to filter · Counts represent installations</span></div>
    <div className="endpoint-charts">
      <SummaryChart title="Software products" subtitle="Installations by software name" counts={facets.softwareName} selected={filters.columns.softwareName ?? []}
        onSelect={(value) => changeColumn("softwareName", toggle(filters.columns.softwareName ?? [], value))} tone="tone-cyan" />
      <SummaryChart title="Endpoint operating systems" subtitle="Installations by endpoint OS" counts={facets.osName} selected={filters.columns.osName ?? []}
        onSelect={(value) => changeColumn("osName", toggle(filters.columns.osName ?? [], value))} tone="tone-blue" />
      <SummaryChart title="Discovered by" subtitle="Software discovery sources in the CMDB" counts={facets.discoveredBy} selected={filters.columns.discoveredBy ?? []}
        onSelect={(value) => changeColumn("discoveredBy", toggle(filters.columns.discoveredBy ?? [], value))} tone="tone-violet" />
      <SummaryChart title="Last discovered" subtitle={`Age as of snapshot ${snapshotDate}`} counts={ages} selected={filters.recency}
        onSelect={(value) => { setFilters((current) => ({ ...current, recency: toggle(current.recency, value as DiscoveryAge) })); setPage(1); }} tone="tone-teal" />
    </div>
    <section className="endpoint-results" aria-label="Installed software results">
      <div className="endpoint-toolbar">
        <div><h2>Installed software <span>{number(filtered.length)}</span></h2><p role="status">{number(filtered.length)} matching records · {number(rows.length)} total in scope</p>
          <p>{number(productCount)} software products across {number(endpointCount)} endpoints</p></div>
        <div className="endpoint-toolbar-actions"><input type="search" maxLength={500} aria-label="Search all software fields" placeholder="Search all software fields..." value={filters.search}
          onChange={(event) => { setFilters((current) => ({ ...current, search: event.target.value })); setPage(1); }} />
          <button type="button" className="endpoint-export" onClick={exportRows} disabled={exporting || !filtered.length}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5" /></svg>
            {exporting ? "Exporting..." : "Export Excel"}</button>
        </div>
      </div>
      {isFiltered && <div className="endpoint-active-filters" aria-label="Active software filters">
        <span>Filtered by</span>{activeColumns.map(({ key, label }) => <button type="button" key={key} onClick={() => changeColumn(key, [])} aria-label={`Clear ${label} filter`}>
          {label}: {filters.columns[key]!.length === 1 ? filters.columns[key]![0] : `${filters.columns[key]!.length} selected`} <span aria-hidden="true">×</span></button>)}
        {filters.recency.length > 0 && <button type="button" onClick={() => { setFilters((current) => ({ ...current, recency: [] })); setPage(1); }}>Discovery age: {filters.recency.join(", ")} <span aria-hidden="true">×</span></button>}
        <button type="button" className="endpoint-clear-all" onClick={() => { setFilters(emptySoftwareFilters()); setPage(1); }}>Clear all filters</button>
      </div>}
      {exportError && <p role="alert" className="endpoint-export-error">{exportError}</p>}
      <hr className="endpoint-divider" />
      <div className="endpoint-table-scroll"><table className="endpoint-table software-table"><thead><tr>{SOFTWARE_COLUMNS.map((column) => <th scope="col" key={column.key}>
        <FilterHeader column={column} selected={filters.columns[column.key] ?? []} options={facets[column.key]} open={openColumn === column.key}
          onOpen={(open) => setOpenColumn(open ? column.key : null)} onChange={(values) => changeColumn(column.key, values)} />
      </th>)}</tr></thead><tbody>{filtered.slice(start, start + pageSize).map((row) => <tr key={JSON.stringify([row.assetId, row.softwareOrdinal])}>
        {SOFTWARE_COLUMNS.map(({ key }) => <td key={key} className={`${key === "deviceName" ? "endpoint-name" : ""} ${key === "filePath" ? "software-file-path" : ""} ${endpointMissing(row, key) ? "endpoint-missing" : ""}`}>
          {key === "deviceName" ? <><CmdbDeviceName assetId={row.assetId} name={row.deviceName} /><small>{row.assetId}</small></>
            : key === "softwareName" ? <strong className="software-product-name">{softwareValue(row, key)}</strong>
            : <span title={softwareValue(row, key)}>{softwareValue(row, key)}</span>}
        </td>)}
      </tr>)}{!filtered.length && <tr><td colSpan={SOFTWARE_COLUMNS.length}><div className="endpoint-empty"><strong>No installed software found</strong><p>{rows.length ? "Clear or adjust your filters to see more records." : "No software installations are recorded for this scope and date."}</p></div></td></tr>}</tbody></table></div>
      <footer className="endpoint-pagination"><span>{filtered.length ? `${number(start + 1)}–${number(Math.min(start + pageSize, filtered.length))}` : "0"} of {number(filtered.length)} records</span>
        <div><label>Rows per page <select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[25, 50, 100, 250].map((size) => <option key={size}>{size}</option>)}</select></label>
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} / {pages}</span>
          <button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
      </footer>
      <p className="endpoint-export-note">One record per software installation. Excel exports include all matching records and an export timestamp in UTC. Missing CMDB values are shown as “Not recorded”.</p>
    </section>
  </div>;
}

function endpointMissing(row: InstalledSoftwareRecord, column: SoftwareColumn) { return softwareValue(row, column) === NOT_RECORDED; }
