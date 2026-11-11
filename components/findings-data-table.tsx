"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FilterHeader, SummaryChart } from "@/components/inventory-explorer-controls";
import { emptyExplorerTableFilters, hasExplorerNumberRange, prepareExplorerRows, queryExplorerRows, type ExplorerColumn, type ExplorerNumberRange, type ExplorerTableFilters, type ExplorerTableSort } from "@/lib/explorer-table";

const number = (value: number) => value.toLocaleString("en-AU");
const rangeLabel = ({ min, max }: ExplorerNumberRange, unit: string) =>
  `${min !== undefined && max !== undefined ? `${number(min)}\u2013${number(max)}` : min !== undefined ? `At least ${number(min)}` : `Up to ${number(max!)}`} ${unit}`;

/** Shared explorer controls; callers retain their cells, drill-through actions and page filters. */
export function FindingsDataTable<T>({ title, rows, columns, renderRow, searchText, searchable = true, columnFilters = true, actions, onFilteredRowsChange, onFiltersChange, initialFilters, summaryCharts, summaryTitle = "Inventory at a glance", emptyMessage = "No records are available in the selected scope.", className = "", paginate = true, defaultPageSize = 50, pageSizeOptions = [25, 50, 100, 250] }: {
  title: string; rows: T[]; columns: ExplorerColumn<T>[]; renderRow: (row: T, index: number) => ReactNode;
  searchText?: (row: T) => string; searchable?: boolean; columnFilters?: boolean; actions?: (matchingRows: T[]) => ReactNode;
  onFilteredRowsChange?: (matchingRows: T[]) => void;
  onFiltersChange?: (filters: ExplorerTableFilters) => void;
  initialFilters?: ExplorerTableFilters;
  summaryCharts?: { key: string; title: string; subtitle: string; tone: string }[];
  summaryTitle?: string;
  emptyMessage?: ReactNode; className?: string; paginate?: boolean; defaultPageSize?: number; pageSizeOptions?: number[];
}) {
  const [filters, setFilters] = useState(() => initialFilters ?? emptyExplorerTableFilters());
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const [sort, setSort] = useState<ExplorerTableSort>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  useEffect(() => { setPage(1); }, [rows]);
  const prepared = useMemo(() => prepareExplorerRows(rows, columns, searchText), [rows, columns, searchText]);
  const { filtered, facets } = useMemo(() => queryExplorerRows(prepared, columns, filters, sort), [prepared, columns, filters, sort]);
  useEffect(() => { onFilteredRowsChange?.(filtered); }, [filtered, onFilteredRowsChange]);
  useEffect(() => { onFiltersChange?.(filters); }, [filters, onFiltersChange]);
  const activeColumns = columns.filter(({ key }) => filters.columns[key]?.length);
  const activeRanges = columns.filter(({ key, range }) => range && hasExplorerNumberRange(filters.ranges?.[key]));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = paginate ? (currentPage - 1) * pageSize : 0;
  const visibleRows = paginate ? filtered.slice(start, start + pageSize) : filtered;
  const changeColumn = (key: string, values: string[]) => {
    setFilters((current) => ({ ...current, columns: { ...current.columns, [key]: values } })); setPage(1);
  };
  const changeRange = (key: string, range: ExplorerNumberRange) => {
    setFilters(current => ({ ...current, ranges: { ...current.ranges, [key]: range } })); setPage(1);
  };
  return <>
    {summaryCharts && <>
      {summaryTitle && <div className="endpoint-summary-caption"><span>{summaryTitle}</span><span>Click a chart bar to filter · Counts respect other filters</span></div>}
      <div className="endpoint-charts">{summaryCharts.map(chart => <SummaryChart key={chart.key} title={chart.title} subtitle={chart.subtitle} tone={chart.tone}
        counts={facets[chart.key] ?? []} selected={filters.columns[chart.key] ?? []} onSelect={value => {
          const selected = filters.columns[chart.key] ?? [];
          changeColumn(chart.key, selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]);
        }} />)}</div>
    </>}
    <section className={`endpoint-results findings-data-table ${className}`} aria-label={`${title} results`}>
    <header className="endpoint-toolbar">
      <div><h2>{title} <span>{number(filtered.length)}</span></h2><p role="status">{number(filtered.length)} matching records / {number(rows.length)} in current scope</p></div>
      <div className="endpoint-toolbar-actions">
        {searchable && <input type="search" aria-label={`Search ${title.toLowerCase()} table`} placeholder="Search table..." maxLength={500} value={filters.search}
          onChange={(event) => { setFilters((current) => ({ ...current, search: event.target.value })); setPage(1); }} />}
        {actions?.(filtered)}
      </div>
    </header>
    {(filters.search || activeColumns.length > 0 || activeRanges.length > 0) && <div className="endpoint-active-filters" aria-label={`Active ${title.toLowerCase()} table filters`}>
      <span>Table filters</span>
      {filters.search && <button type="button" onClick={() => { setFilters((current) => ({ ...current, search: "" })); setPage(1); }}>Search: {filters.search} <span aria-hidden="true">×</span></button>}
      {activeColumns.map(({ key, label }) => <button type="button" key={key} onClick={() => changeColumn(key, [])} aria-label={`Clear ${label} table filter`}>
        {label}: {filters.columns[key].length === 1 ? filters.columns[key][0] : `${filters.columns[key].length} selected`} <span aria-hidden="true">×</span>
      </button>)}
      {activeRanges.map(column => <button type="button" key={`${column.key}-range`} onClick={() => changeRange(column.key, {})} aria-label={`Clear ${column.label} range filter`}>
        {column.label}: {rangeLabel(filters.ranges![column.key], column.range!.unit)} <span aria-hidden="true">&times;</span>
      </button>)}
      <button type="button" className="endpoint-clear-all" onClick={() => { setFilters(emptyExplorerTableFilters()); setPage(1); }}>Clear table filters</button>
    </div>}
    <div className="endpoint-table-scroll"><table className="endpoint-table findings-explorer-table">
      <thead><tr>{columns.map((column) => <th scope="col" key={column.key} aria-sort={sort?.key === column.key ? sort.direction === "asc" ? "ascending" : "descending" : column.range?.sortable ? "none" : undefined}>
        {columnFilters ? <FilterHeader column={column} selected={filters.columns[column.key] ?? []} options={facets[column.key]} open={openColumn === column.key}
          range={column.range ? { ...column.range, selected: filters.ranges?.[column.key], onChange: (range) => changeRange(column.key, range) } : undefined}
          sort={column.range?.sortable ? { direction: sort?.key === column.key ? sort.direction : undefined, onChange: (direction) => { setSort(direction ? { key: column.key, direction } : undefined); setPage(1); } } : undefined}
          onOpen={(open) => setOpenColumn(open ? column.key : null)} onChange={(values) => changeColumn(column.key, values)} layer={13000} />
          : <span className="endpoint-column-label">{column.label}</span>}
      </th>)}</tr></thead>
      <tbody>{visibleRows.map((row, index) => renderRow(row, start + index))}
        {!filtered.length && <tr><td colSpan={columns.length}><div className="endpoint-empty"><strong>No matching records</strong><p>{rows.length ? "Clear or adjust the table filters to see more records." : emptyMessage}</p></div></td></tr>}
      </tbody>
    </table></div>
    {paginate && <footer className="endpoint-pagination"><span>{filtered.length ? `${number(start + 1)}–${number(Math.min(start + pageSize, filtered.length))}` : "0"} of {number(filtered.length)} records</span>
      <div><label>Rows per page <select aria-label={`${title} rows per page`} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{pageSizeOptions.map((size) => <option key={size}>{size}</option>)}</select></label>
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} / {pages}</span>
        <button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
    </footer>}
    </section>
  </>;
}
