"use client";

import { useMemo, useState } from "react";
import { FilterHeader, SummaryChart } from "@/components/inventory-explorer-controls";
import { CmdbDeviceName } from "@/components/cmdb-drill-through";
import {
  DISCOVERY_AGE_BUCKETS, ENDPOINT_COLUMNS, NOT_RECORDED, discoveryAge, emptyEndpointFilters,
  endpointFacetCounts, endpointValue, filterEndpointRows,
  type DiscoveryAge, type EndpointColumn, type EndpointFilters, type EndpointRecord
} from "@/lib/endpoint-explorer";

type Count = { value: string; count: number };
const number = (value: number) => value.toLocaleString("en-AU");
const toggle = <T extends string,>(values: T[], value: T): T[] => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

export function EndpointExplorer({ rows, snapshotDate, scope }: {
  rows: EndpointRecord[]; snapshotDate: string; scope: { network: string[]; system: string[]; dataDate: string };
}) {
  const [filters, setFilters] = useState<EndpointFilters>(emptyEndpointFilters);
  const [openColumn, setOpenColumn] = useState<EndpointColumn | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const filtered = useMemo(() => filterEndpointRows(rows, filters, snapshotDate), [rows, filters, snapshotDate]);
  const activeColumns = ENDPOINT_COLUMNS.filter(({ key }) => filters.columns[key]?.length);
  const isFiltered = Boolean(filters.search || activeColumns.length || filters.recency.length);
  const facets = useMemo(() => Object.fromEntries(ENDPOINT_COLUMNS.map(({ key }) => [key,
    endpointFacetCounts(filterEndpointRows(rows, filters, snapshotDate, key), key)
  ])) as Record<EndpointColumn, Count[]>, [rows, filters, snapshotDate]);
  const ages = useMemo(() => {
    const source = filterEndpointRows(rows, filters, snapshotDate, undefined, true);
    return DISCOVERY_AGE_BUCKETS.map((value) => ({ value, count: source.filter((row) => discoveryAge(row, snapshotDate) === value).length }))
      .filter((item) => item.count || filters.recency.includes(item.value));
  }, [rows, filters, snapshotDate]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * pageSize;
  const changeColumn = (column: EndpointColumn, values: string[]) => {
    setFilters((current) => ({ ...current, columns: { ...current.columns, [column]: values } })); setPage(1);
  };
  const exportRows = async () => {
    if (exporting) return;
    setExporting(true); setExportError("");
    try {
      const response = await fetch("/api/discovery-coverage/endpoints/export", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, filters }), cache: "no-store" });
      if (!response.ok) throw new Error("The Excel export could not be created. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `end-point-explorer-${snapshotDate}.xlsx`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setExportError(reason instanceof Error ? reason.message : "Unable to export records."); }
    finally { setExporting(false); }
  };
  return <div className="endpoint-explorer">
    <header className="endpoint-hero">
      <div><p className="endpoint-eyebrow">Discovery / CMDB inventory</p><h1>End Point Explorer</h1>
        <p className="endpoint-description">Find, filter and inspect the endpoints in your selected scope.</p></div>
      <div className="endpoint-total"><span>Total records in scope</span><strong>{number(rows.length)}</strong><small>Snapshot · {snapshotDate}</small></div>
    </header>
    <div className="endpoint-summary-caption"><span>Inventory at a glance</span><span>Click a chart bar to filter · Counts respect other filters</span></div>
    <div className="endpoint-charts">
      <SummaryChart title="CI type" subtitle="Composition of the endpoint estate" counts={facets.ciType} selected={filters.columns.ciType ?? []}
        onSelect={(value) => changeColumn("ciType", toggle(filters.columns.ciType ?? [], value))} tone="tone-cyan" />
      <SummaryChart title="Managed network" subtitle="Distribution across managed networks" counts={facets.managedNetwork} selected={filters.columns.managedNetwork ?? []}
        onSelect={(value) => changeColumn("managedNetwork", toggle(filters.columns.managedNetwork ?? [], value))} tone="tone-blue" />
      <SummaryChart title="Discovered by" subtitle="Discovery sources recorded in the CMDB" counts={facets.discoveredBy} selected={filters.columns.discoveredBy ?? []}
        onSelect={(value) => changeColumn("discoveredBy", toggle(filters.columns.discoveredBy ?? [], value))} tone="tone-violet" />
      <SummaryChart title="Last discovered" subtitle={`Age as of snapshot ${snapshotDate}`} counts={ages} selected={filters.recency}
        onSelect={(value) => { setFilters((current) => ({ ...current, recency: toggle(current.recency, value as DiscoveryAge) })); setPage(1); }} tone="tone-teal" />
    </div>
    <section className="endpoint-results" aria-label="Endpoint results">
      <div className="endpoint-toolbar">
        <div><h2>Endpoints <span>{number(filtered.length)}</span></h2><p role="status">{number(filtered.length)} matching records · {number(rows.length)} total in scope</p></div>
        <div className="endpoint-toolbar-actions"><input type="search" maxLength={500} aria-label="Search all endpoint fields" placeholder="Search all endpoint fields..." value={filters.search}
          onChange={(event) => { setFilters((current) => ({ ...current, search: event.target.value })); setPage(1); }} />
          <button type="button" className="endpoint-export" onClick={exportRows} disabled={exporting || !filtered.length}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5" /></svg>
            {exporting ? "Exporting..." : "Export Excel"}</button>
        </div>
      </div>
      {isFiltered && <div className="endpoint-active-filters" aria-label="Active endpoint filters">
        <span>Filtered by</span>{activeColumns.map(({ key, label }) => <button type="button" key={key} onClick={() => changeColumn(key, [])} aria-label={`Clear ${label} filter`}>
          {label}: {filters.columns[key]!.length === 1 ? filters.columns[key]![0] : `${filters.columns[key]!.length} selected`} <span aria-hidden="true">×</span></button>)}
        {filters.recency.length > 0 && <button type="button" onClick={() => { setFilters((current) => ({ ...current, recency: [] })); setPage(1); }}>Discovery age: {filters.recency.join(", ")} <span aria-hidden="true">×</span></button>}
        <button type="button" className="endpoint-clear-all" onClick={() => { setFilters(emptyEndpointFilters()); setPage(1); }}>Clear all filters</button>
      </div>}
      {exportError && <p role="alert" className="endpoint-export-error">{exportError}</p>}
      <hr className="endpoint-divider" />
      <div className="endpoint-table-scroll"><table className="endpoint-table"><thead><tr>{ENDPOINT_COLUMNS.map((column) => <th scope="col" key={column.key}>
        <FilterHeader column={column} selected={filters.columns[column.key] ?? []} options={facets[column.key]} open={openColumn === column.key}
          onOpen={(open) => setOpenColumn(open ? column.key : null)} onChange={(values) => changeColumn(column.key, values)} />
      </th>)}</tr></thead><tbody>{filtered.slice(start, start + pageSize).map((row) => <tr key={row.assetId}>
        {ENDPOINT_COLUMNS.map(({ key }) => <td key={key} className={`${key === "name" ? "endpoint-name" : ""} ${key === "ipAddress" || key === "macAddress" ? "endpoint-address" : ""} ${endpointValue(row, key) === NOT_RECORDED ? "endpoint-missing" : ""}`}>
          {key === "name" ? <><CmdbDeviceName assetId={row.assetId} name={row.name} /><small>{row.assetId}</small></>
            : key === "ciType" ? <span className="endpoint-type-badge">{row.ciType}</span> : endpointValue(row, key)}
        </td>)}
      </tr>)}{!filtered.length && <tr><td colSpan={ENDPOINT_COLUMNS.length}><div className="endpoint-empty"><strong>No endpoints found</strong><p>{rows.length ? "Clear or adjust your filters to see more records." : "No CMDB endpoints are available for this scope and date."}</p></div></td></tr>}</tbody></table></div>
      <footer className="endpoint-pagination"><span>{filtered.length ? `${number(start + 1)}–${number(Math.min(start + pageSize, filtered.length))}` : "0"} of {number(filtered.length)} records</span>
        <div><label>Rows per page <select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[25, 50, 100, 250].map((size) => <option key={size}>{size}</option>)}</select></label>
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} / {pages}</span>
          <button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
      </footer>
      <p className="endpoint-export-note">Excel exports include every matching record and an export timestamp in UTC. Missing CMDB values are shown as “Not recorded”.</p>
    </section>
  </div>;
}
