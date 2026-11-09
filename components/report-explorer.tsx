"use client";

import { useMemo, useState } from "react";
import { FilterHeader } from "@/components/inventory-explorer-controls";
import { emptyExplorerTableFilters, prepareExplorerRows, queryExplorerRows } from "@/lib/explorer-table";
import { REPORT_CATEGORIES, REPORT_COLUMNS, type CatalogueReport } from "@/lib/report-catalogue";
import { DocumentDownloadButton } from "@/components/document-download-button";

const number = (value: number) => value.toLocaleString("en-AU");

export function ReportExplorer({ rows, snapshotDate, initialSearch = "" }: {
  rows: CatalogueReport[]; snapshotDate: string; initialSearch?: string;
}) {
  const [filters, setFilters] = useState(() => ({ ...emptyExplorerTableFilters(), search: initialSearch.slice(0, 500) }));
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState("recommended");
  const prepared = useMemo(() => prepareExplorerRows(rows, REPORT_COLUMNS, () => "PDF"), [rows]);
  const { filtered, facets } = useMemo(() => queryExplorerRows(prepared, REPORT_COLUMNS, filters), [prepared, filters]);
  const ordered = useMemo(() => sort === "name" ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : filtered, [filtered, sort]);
  const activeColumns = REPORT_COLUMNS.filter(({ key }) => filters.columns[key]?.length);
  const selectedCategory = filters.columns.category ?? [];
  const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * pageSize;
  const changeColumn = (key: string, values: string[]) => {
    setFilters(current => ({ ...current, columns: { ...current.columns, [key]: values } })); setPage(1);
  };
  const clearFilters = () => { setFilters(emptyExplorerTableFilters()); setPage(1); setOpenColumn(null); };

  return <div className="workspace-page reports-page">
    <header className="endpoint-hero">
      <div><p className="endpoint-eyebrow">Reporting / Catalogue</p><h1>Briefs &amp; Reports</h1>
        <p className="endpoint-description">Find a report for your audience and generate a PDF for the selected scope.</p></div>
      <div className="endpoint-total"><span>Reports available</span><strong>{number(rows.length)}</strong><small>Snapshot · {snapshotDate}</small></div>
    </header>
    <section className="report-categories" aria-label="Report categories">
      {[{ label: "All reports", description: "Browse the complete catalogue", tone: "teal", value: "" },
        ...REPORT_CATEGORIES.map(category => ({ ...category, value: category.label }))].map(category => {
        const selected = category.value ? selectedCategory.length === 1 && selectedCategory[0] === category.value : !selectedCategory.length;
        const count = category.value ? rows.filter(row => row.category === category.value).length : rows.length;
        return <button key={category.label} type="button" className={`report-category tone-${category.tone}`} aria-pressed={selected}
          onClick={() => { changeColumn("category", category.value && !selected ? [category.value] : []); setOpenColumn(null); }}>
          <div><span>{category.label}</span><small>{category.description}</small></div><strong>{number(count)}</strong>
        </button>;
      })}
    </section>
    <section className="endpoint-results report-results" aria-label="Report catalogue">
      <header className="endpoint-toolbar">
        <div><h2>Report catalogue <span>{number(ordered.length)}</span></h2><p role="status">{number(ordered.length)} matching reports · {number(rows.length)} available</p></div>
        <div className="endpoint-toolbar-actions">
          <input type="search" maxLength={500} aria-label="Search reports" placeholder="Search reports, descriptions, audiences..." value={filters.search}
            onChange={event => { setFilters(current => ({ ...current, search: event.target.value })); setPage(1); }} />
          <select aria-label="Sort reports" className="report-sort" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}>
            <option value="recommended">Catalogue order</option><option value="name">Report name A–Z</option>
          </select>
        </div>
      </header>
      {(filters.search || activeColumns.length > 0) && <div className="endpoint-active-filters" aria-label="Active report filters"><span>Filtered by</span>
        {filters.search && <button type="button" aria-label="Clear report search" onClick={() => { setFilters(current => ({ ...current, search: "" })); setPage(1); }}>Search: {filters.search} <span aria-hidden="true">×</span></button>}
        {activeColumns.map(({ key, label }) => <button type="button" key={key} aria-label={`Clear ${label} filter`} onClick={() => changeColumn(key, [])}>
          {label}: {filters.columns[key].length === 1 ? filters.columns[key][0] : `${filters.columns[key].length} selected`} <span aria-hidden="true">×</span>
        </button>)}
        <button type="button" className="endpoint-clear-all" onClick={clearFilters}>Clear all filters</button>
      </div>}
      <hr className="endpoint-divider" />
      <div className="endpoint-table-scroll"><table className="endpoint-table report-table">
        <caption className="sr-only">Available PDF reports for the selected scope and snapshot</caption>
        <thead><tr>{REPORT_COLUMNS.map(column => <th scope="col" key={column.key}>
          <FilterHeader column={column} selected={filters.columns[column.key] ?? []} options={facets[column.key]} open={openColumn === column.key}
            onOpen={open => setOpenColumn(open ? column.key : null)} onChange={values => changeColumn(column.key, values)} />
        </th>)}<th scope="col" className="report-action-heading">Action</th></tr></thead>
        <tbody>{ordered.slice(start, start + pageSize).map(row => <tr key={row.id}>
          <td className="report-name"><strong>{row.name}</strong><span className="report-format">PDF document</span></td>
          <td><span className={`report-category-badge tone-${REPORT_CATEGORIES.find(category => category.label === row.category)?.tone}`}>{row.category}</span></td>
          <td className="report-description">{row.description}</td><td className="report-audience">{row.audience}</td>
          <td><DocumentDownloadButton className="report-generate" href={row.href} ariaLabel={`Generate ${row.name} PDF report`}>
            Generate report <span aria-hidden="true">↗</span></DocumentDownloadButton></td>
        </tr>)}{!ordered.length && <tr><td colSpan={5}><div className="endpoint-empty"><strong>No reports found</strong>
          <p>Clear or adjust the catalogue filters to find a report.</p><button type="button" onClick={clearFilters}>Clear all filters</button>
        </div></td></tr>}</tbody>
      </table></div>
      <footer className="endpoint-pagination"><span>{ordered.length ? `${number(start + 1)}–${number(Math.min(start + pageSize, ordered.length))}` : "0"} of {number(ordered.length)} reports</span>
        <div><label>Rows per page <select aria-label="Reports rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>
          {[5, 10, 25, 50].map(size => <option key={size}>{size}</option>)}</select></label>
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} / {pages}</span>
          <button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
      </footer>
      <p className="endpoint-export-note">PDFs are generated in your browser and downloaded using the selected scope and snapshot. Catalogue filters help you find a report; they do not change its findings.</p>
    </section>
  </div>;
}
