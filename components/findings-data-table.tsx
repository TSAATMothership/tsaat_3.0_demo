"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FilterHeader } from "@/components/inventory-explorer-controls";
import { emptyExplorerTableFilters, prepareExplorerRows, queryExplorerRows, type ExplorerColumn } from "@/lib/explorer-table";

const number = (value: number) => value.toLocaleString("en-AU");

/** Shared explorer controls; callers retain their cells, drill-through actions and page filters. */
export function FindingsDataTable<T>({ title, rows, columns, renderRow, searchText, searchable = true, actions, emptyMessage = "No records are available in the selected scope.", className = "" }: {
  title: string; rows: T[]; columns: ExplorerColumn<T>[]; renderRow: (row: T, index: number) => ReactNode;
  searchText?: (row: T) => string; searchable?: boolean; actions?: (matchingRows: T[]) => ReactNode;
  emptyMessage?: ReactNode; className?: string;
}) {
  const [filters, setFilters] = useState(emptyExplorerTableFilters);
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  useEffect(() => { setPage(1); }, [rows]);
  const prepared = useMemo(() => prepareExplorerRows(rows, columns, searchText), [rows, columns, searchText]);
  const { filtered, facets } = useMemo(() => queryExplorerRows(prepared, columns, filters), [prepared, columns, filters]);
  const activeColumns = columns.filter(({ key }) => filters.columns[key]?.length);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * pageSize;
  const changeColumn = (key: string, values: string[]) => {
    setFilters((current) => ({ ...current, columns: { ...current.columns, [key]: values } })); setPage(1);
  };
  return <section className={`endpoint-results findings-data-table ${className}`} aria-label={`${title} results`}>
    <header className="endpoint-toolbar">
      <div><h2>{title} <span>{number(filtered.length)}</span></h2><p role="status">{number(filtered.length)} matching records / {number(rows.length)} in current scope</p></div>
      <div className="endpoint-toolbar-actions">
        {searchable && <input type="search" aria-label={`Search ${title.toLowerCase()} table`} placeholder="Search table..." maxLength={500} value={filters.search}
          onChange={(event) => { setFilters((current) => ({ ...current, search: event.target.value })); setPage(1); }} />}
        {actions?.(filtered)}
      </div>
    </header>
    {(filters.search || activeColumns.length > 0) && <div className="endpoint-active-filters" aria-label={`Active ${title.toLowerCase()} table filters`}>
      <span>Table filters</span>
      {filters.search && <button type="button" onClick={() => { setFilters((current) => ({ ...current, search: "" })); setPage(1); }}>Search: {filters.search} <span aria-hidden="true">×</span></button>}
      {activeColumns.map(({ key, label }) => <button type="button" key={key} onClick={() => changeColumn(key, [])} aria-label={`Clear ${label} table filter`}>
        {label}: {filters.columns[key].length === 1 ? filters.columns[key][0] : `${filters.columns[key].length} selected`} <span aria-hidden="true">×</span>
      </button>)}
      <button type="button" className="endpoint-clear-all" onClick={() => { setFilters(emptyExplorerTableFilters()); setPage(1); }}>Clear table filters</button>
    </div>}
    <div className="endpoint-table-scroll"><table className="endpoint-table findings-explorer-table">
      <thead><tr>{columns.map((column) => <th scope="col" key={column.key}>
        <FilterHeader column={column} selected={filters.columns[column.key] ?? []} options={facets[column.key]} open={openColumn === column.key}
          onOpen={(open) => setOpenColumn(open ? column.key : null)} onChange={(values) => changeColumn(column.key, values)} layer={13000} />
      </th>)}</tr></thead>
      <tbody>{filtered.slice(start, start + pageSize).map((row, index) => renderRow(row, start + index))}
        {!filtered.length && <tr><td colSpan={columns.length}><div className="endpoint-empty"><strong>No matching records</strong><p>{rows.length ? "Clear or adjust the table filters to see more records." : emptyMessage}</p></div></td></tr>}
      </tbody>
    </table></div>
    <footer className="endpoint-pagination"><span>{filtered.length ? `${number(start + 1)}–${number(Math.min(start + pageSize, filtered.length))}` : "0"} of {number(filtered.length)} records</span>
      <div><label>Rows per page <select aria-label={`${title} rows per page`} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[25, 50, 100, 250].map((size) => <option key={size}>{size}</option>)}</select></label>
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} / {pages}</span>
        <button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
    </footer>
  </section>;
}
