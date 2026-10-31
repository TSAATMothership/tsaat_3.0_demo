"use client";

import { Fragment, useMemo, useState } from "react";
import { FilterHeader } from "@/components/inventory-explorer-controls";
import { MEASURE_COLUMNS, MEASURE_RESULTS, emptyMeasureFilters, filterMeasureRows, measureFacets, measureResults, measureValues, type MeasureColumn, type MeasureFilters, type MeasureRecord } from "@/lib/measures-explorer";

const number = (value: number) => value.toLocaleString("en-AU");
export function MeasuresExplorer({ rows, mode, initialFilters, allSpiReportHref }: {
  rows: MeasureRecord[]; mode: "kpi" | "spi"; initialFilters?: MeasureFilters; allSpiReportHref?: string;
}) {
  const [filters, setFilters] = useState<MeasureFilters>(() => initialFilters ?? emptyMeasureFilters());
  const [openColumn, setOpenColumn] = useState<MeasureColumn | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState("definition");
  const label = mode.toUpperCase();
  const filtered = useMemo(() => {
    const result = filterMeasureRows(rows, filters);
    if (sort === "non-compliant") result.sort((a, b) => b.nonCompliant - a.nonCompliant || b.unknown - a.unknown);
    if (sort === "unknown") result.sort((a, b) => b.unknown - a.unknown || b.nonCompliant - a.nonCompliant);
    if (sort === "score") result.sort((a, b) => Number(!a.total) - Number(!b.total) || a.scorePercent - b.scorePercent);
    return result;
  }, [rows, filters, sort]);
  const facets = useMemo(() => Object.fromEntries(MEASURE_COLUMNS.map(({ key }) => [key, measureFacets(rows, filters, key)])) as Record<MeasureColumn, Array<{ value: string; count: number }>>, [rows, filters]);
  const summaryRows = useMemo(() => filterMeasureRows(rows, filters, "result"), [rows, filters]);
  const activeColumns = MEASURE_COLUMNS.filter(({ key }) => filters.columns[key]?.length);
  const selectedResult = !filters.columns.result?.length ? "all" : filters.columns.result.length === 1 ? filters.columns.result[0] : null;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * pageSize;
  const changeColumn = (column: MeasureColumn, values: string[]) => {
    setFilters((current) => ({ ...current, columns: { ...current.columns, [column]: values } })); setPage(1);
  };
  return <div className="measures-explorer">
    <section className="measures-result-tiles" aria-label={`${label} result filters`}>
      {[{ value: "all", title: "Indicators", count: summaryRows.length }, ...MEASURE_RESULTS.map((value) => ({ value, title: value, count: summaryRows.filter((row) => measureResults(row).includes(value)).length }))].map((tile) => <button key={tile.value} type="button" aria-pressed={selectedResult === tile.value} onClick={() => { changeColumn("result", tile.value === "all" || selectedResult === tile.value ? [] : [tile.value]); setOpenColumn(null); }}><span>{tile.title}</span><strong>{number(tile.count)}</strong></button>)}
    </section>
    <section className="endpoint-results measures-results" aria-label={`${label} results`}>
      <div className="endpoint-toolbar">
        <div><h2>{label} indicators <span>{number(filtered.length)}</span></h2><p role="status">{number(filtered.length)} matching indicators · {number(rows.length)} in scope</p></div>
        <div className="endpoint-toolbar-actions"><input type="search" maxLength={500} aria-label={`Search all ${label} fields`} placeholder="Search name, description, success measure..." value={filters.search} onChange={(event) => { setFilters((current) => ({ ...current, search: event.target.value })); setPage(1); }} />
          <select className="measures-sort" aria-label="Sort indicators" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="definition">Definition order</option><option value="score">Lowest compliance</option><option value="non-compliant">Most non-compliant</option><option value="unknown">Most unknown</option></select>
          {allSpiReportHref && <a className="endpoint-export" href={allSpiReportHref} target="_blank" rel="noreferrer" title="Report for all reportable SPIs in the page scope, regardless of table filters">All-SPI report</a>}
        </div>
      </div>
      {(filters.search || activeColumns.length > 0) && <div className="endpoint-active-filters" aria-label={`Active ${label} filters`}><span>Filtered by</span>
        {filters.search && <button type="button" onClick={() => { setFilters((current) => ({ ...current, search: "" })); setPage(1); }} aria-label="Clear search filter">Search: {filters.search} ×</button>}
        {activeColumns.map(({ key, label: columnLabel }) => <button type="button" key={key} aria-label={`Clear ${columnLabel} filter`} onClick={() => changeColumn(key, [])}>{columnLabel}: {filters.columns[key]!.length === 1 ? filters.columns[key]![0] : `${filters.columns[key]!.length} selected`} ×</button>)}
        <button type="button" className="endpoint-clear-all" onClick={() => { setFilters(emptyMeasureFilters()); setPage(1); }}>Clear all filters</button>
      </div>}
      <hr className="endpoint-divider" />
      <div className="endpoint-table-scroll"><table className="endpoint-table measures-table"><caption className="sr-only">{label} performance and compliance in the selected scope</caption><thead><tr>{MEASURE_COLUMNS.map((column) => <th scope="col" key={column.key}><FilterHeader column={column} selected={filters.columns[column.key] ?? []} options={facets[column.key]} open={openColumn === column.key} onOpen={(open) => setOpenColumn(open ? column.key : null)} onChange={(values) => changeColumn(column.key, values)} /></th>)}</tr></thead>
        <tbody>{filtered.slice(start, start + pageSize).map((row) => <Fragment key={row.id}>
          <tr><td className="measures-id">{row.id}</td><td className="measures-name"><button type="button" aria-expanded={expanded.includes(row.id)} aria-controls={`measure-detail-${row.id}`} aria-label={`Details for ${row.id}: ${row.name}`} onClick={() => setExpanded((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])}><span aria-hidden="true">{expanded.includes(row.id) ? "▾" : "▸"}</span>{row.name}</button></td>
            <td><div className="measure-result-badges">{measureResults(row).map((result) => <span key={result} className={`measure-result ${result === "Non-compliant" ? "is-gap" : result === "Unknown" ? "is-unknown" : result === "Fully compliant" ? "is-good" : "is-empty"}`}>{result}</span>)}</div></td>
            <td className="measures-score"><strong>{measureValues(row, "score")[0]}</strong>{row.total > 0 && <progress max={100} value={row.scorePercent} aria-label={`${row.id} compliance`} />}</td>
            <td className="measures-numeric">{number(row.total)}</td><td className="measures-numeric measure-good">{number(row.compliant)}</td><td className="measures-numeric measure-gap">{number(row.nonCompliant)}</td><td className="measures-numeric measure-unknown">{number(row.unknown)}</td>
            <td><div className="measures-report-links">{row.reportHref && <a href={row.reportHref} target="_blank" rel="noreferrer" aria-label={`Generate ${row.id} report`}>Current report ↗</a>}{row.trendHref && <a href={row.trendHref} target="_blank" rel="noreferrer" aria-label={`Generate ${row.id} trend report`}>Trend report ↗</a>}{!row.reportHref && !row.trendHref && <span className="endpoint-missing">Unavailable</span>}</div></td>
          </tr>
          {expanded.includes(row.id) && <tr className="measures-detail-row" id={`measure-detail-${row.id}`}><td colSpan={MEASURE_COLUMNS.length}>
            <div className="measures-definition"><div><h3>Description</h3><p>{row.description}</p></div><div><h3>Success measure</h3><p>{row.successMeasure}</p></div></div>
            {row.assetTypeBreakdown.length > 0 && <div className="measures-ci-breakdown"><h3>CI type breakdown</h3><table><caption className="sr-only">Non-compliant and unknown CIs by type for {row.id}</caption><thead><tr><th scope="col">CI type</th>{row.assetTypeBreakdown.map((group) => <th scope="col" key={group.id}>{group.label}</th>)}</tr></thead><tbody><tr><th scope="row">Non-compliant</th>{row.assetTypeBreakdown.map((group) => <td key={group.id}>{number(group.nonCompliant)}</td>)}</tr><tr><th scope="row">Unknown</th>{row.assetTypeBreakdown.map((group) => <td key={group.id}>{number(group.unknown)}</td>)}</tr></tbody></table></div>}
            {row.highPriorityCount !== undefined && <p className="measures-detail-note">High-priority count for this KPI: {number(row.highPriorityCount)}</p>}
          </td></tr>}
        </Fragment>)}{!filtered.length && <tr><td colSpan={MEASURE_COLUMNS.length}><div className="endpoint-empty"><strong>No {label} indicators found</strong><p>{rows.length ? "Clear or adjust the filters to see more indicators." : "No evaluated indicator definitions are available for this scope and snapshot."}</p></div></td></tr>}</tbody>
      </table></div>
      <footer className="endpoint-pagination"><span>{filtered.length ? `${number(start + 1)}–${number(Math.min(start + pageSize, filtered.length))}` : "0"} of {number(filtered.length)} indicators</span><div><label>Rows per page <select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select></label><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} / {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></footer>
      <p className="endpoint-export-note">Expand a measure for its definition{mode === "spi" ? " and CI type breakdown" : ""}. An indicator can have both non-compliant and unknown results. Reports retain the page scope and snapshot{mode === "spi" ? "; the All-SPI report includes all reportable SPIs" : ""}.</p>
    </section>
  </div>;
}
