"use client";

import { useMemo, useState } from "react";
import { ASSET_TYPES, ASSET_TYPE_LABELS } from "@/lib/asset-taxonomy";
import { FilterHeader } from "@/components/inventory-explorer-controls";
import { CoverageByToolRadar } from "@/components/coverage-by-tool-radar";
import {
  COVERAGE_TOOL_COLUMNS, coverageToolStatus, coverageToolValue, coverageToolsCsv, filterCoverageTools, sortCoverageTools,
  type CoverageToolColumn, type CoverageToolFilters, type CoverageToolSort, type CoverageToolStat
} from "@/lib/coverage-tool-explorer";

const number = (value: number) => value.toLocaleString("en-AU");

export function CoverageToolExplorer({ tools, onOpenTool }: {
  tools: CoverageToolStat[]; onOpenTool: (id: string, label: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CoverageToolFilters>({});
  const [openColumn, setOpenColumn] = useState<CoverageToolColumn | null>(null);
  const [sort, setSort] = useState<CoverageToolSort>("gaps");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const filtered = useMemo(() => sortCoverageTools(filterCoverageTools(tools, search, filters), sort), [tools, search, filters, sort]);
  const facets = useMemo(() => Object.fromEntries(COVERAGE_TOOL_COLUMNS.map(({ key }) => {
    const counts = new Map<string, number>();
    for (const tool of filterCoverageTools(tools, search, filters, key)) {
      const value = coverageToolValue(tool, key);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [key, [...counts].map(([value, count]) => ({ value, count }))];
  })) as Record<CoverageToolColumn, { value: string; count: number }[]>, [tools, search, filters]);
  const activeColumns = COVERAGE_TOOL_COLUMNS.filter(({ key }) => filters[key]?.length);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * pageSize;
  const changeFilter = (key: CoverageToolColumn, values: string[]) => {
    setFilters((current) => ({ ...current, [key]: values })); setPage(1);
  };
  const exportRows = () => {
    const url = URL.createObjectURL(new Blob(["\uFEFF", coverageToolsCsv(filtered)], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url; link.download = "discovery-tool-coverage.csv";
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="coverage-tool-layout"><section className="endpoint-results coverage-tool-results" aria-label="Discovery tool coverage results">
    <div className="endpoint-toolbar">
      <div><h2>Coverage by tool <span>{number(filtered.length)}</span></h2>
        <p role="status">{number(filtered.length)} matching tools · {number(tools.length)} configured in scope</p></div>
      <div className="endpoint-toolbar-actions">
        <input type="search" maxLength={500} aria-label="Search discovery tools" placeholder="Search tools, status or coverage..." value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <button type="button" className="endpoint-export" disabled={!filtered.length} onClick={exportRows}>Export CSV</button>
      </div>
    </div>
    <div className="coverage-table-options">
      <p>Select a tool or its missing count to inspect coverage gaps.</p>
      <div><label>Sort by <select value={sort} onChange={(event) => { setSort(event.target.value as CoverageToolSort); setPage(1); }}>
        <option value="gaps">Most coverage gaps</option><option value="coverage">Lowest coverage</option><option value="name">Tool name</option>
      </select></label></div>
    </div>
    {(search || activeColumns.length > 0) && <div className="endpoint-active-filters" aria-label="Active coverage filters">
      <span>Filtered by</span>{search && <button type="button" onClick={() => { setSearch(""); setPage(1); }}>Search: {search} ×</button>}
      {activeColumns.map(({ key, label }) => <button type="button" key={key} aria-label={`Clear ${label} filter`} onClick={() => changeFilter(key, [])}>
        {label}: {filters[key]!.length === 1 ? filters[key]![0] : `${filters[key]!.length} selected`} ×</button>)}
      <button type="button" className="endpoint-clear-all" onClick={() => { setFilters({}); setSearch(""); setPage(1); }}>Clear all filters</button>
    </div>}
    <div className="endpoint-table-scroll"><table className="endpoint-table coverage-tools-table">
      <thead><tr>{COVERAGE_TOOL_COLUMNS.map((column) => <th scope="col" key={column.key}>
        <FilterHeader column={column} selected={filters[column.key] ?? []} options={facets[column.key]} open={openColumn === column.key}
          onOpen={(open) => setOpenColumn(open ? column.key : null)} onChange={(values) => changeFilter(column.key, values)} />
      </th>)}</tr></thead>
      <tbody>{filtered.slice(start, start + pageSize).map((tool) => <tr key={tool.id}>
        <td className="endpoint-name"><button type="button" className="coverage-tool-link" onClick={() => onOpenTool(tool.id, tool.label)}>{tool.label}</button><small>{tool.id}</small></td>
        <td><span className={`coverage-status ${!tool.applicable ? "is-neutral" : tool.missing ? "has-gaps" : "is-covered"}`}>{coverageToolStatus(tool)}</span></td>
        <td className="coverage-number">
          {number(tool.applicable)}
          {tool.applicableByCiType && <details className="coverage-ci-breakdown">
            <summary aria-label={`CI type totals used for ${tool.label}`}>By CI type</summary>
            <dl>{ASSET_TYPES.filter((type) => tool.applicableByCiType![type] > 0).map((type) => <div key={type}>
              <dt>{ASSET_TYPE_LABELS[type]}</dt><dd>{number(tool.applicableByCiType![type])}</dd>
            </div>)}</dl>
          </details>}
        </td>
        <td className="coverage-number text-emerald-200">{number(tool.covered)}</td>
        <td className="coverage-number"><button type="button" className={tool.missing ? "coverage-gap-link" : "coverage-tool-link"}
          aria-label={`View ${number(tool.missing)} coverage gaps for ${tool.label}`} onClick={() => onOpenTool(tool.id, tool.label)}>{number(tool.missing)} <span aria-hidden="true">↗</span></button></td>
        <td><div className="coverage-percent"><span>{coverageToolValue(tool, "coveragePercent")}</span>
          {tool.applicable > 0 && <progress aria-label={`${tool.label} coverage`} value={tool.coveragePercent} max={100} />}</div></td>
      </tr>)}{!filtered.length && <tr><td colSpan={COVERAGE_TOOL_COLUMNS.length}><div className="endpoint-empty"><strong>{tools.length ? "No matching tools" : "No applicable discovery tools"}</strong>
        <p>{tools.length ? "Clear or adjust your filters to see more tools." : "No tools map to the CI types in the current filtered data. Adjust the scope or Discovery Tools Settings."}</p></div></td></tr>}</tbody>
    </table></div>
    <footer className="endpoint-pagination"><span>{filtered.length ? `${number(start + 1)}–${number(Math.min(start + pageSize, filtered.length))}` : "0"} of {number(filtered.length)} tools</span>
      <div><label>Rows per page <select aria-label="Tools per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select></label>
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} / {pages}</span>
        <button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
    </footer>
    <p className="endpoint-export-note">CSV includes all matching tools and their CI-type totals. Coverage is covered CIs divided by CIs mapped to each tool in Discovery Tools Settings.</p>
  </section>
    <aside className="coverage-explorer-radar" aria-label="Tool coverage percentages radar chart">
      <CoverageByToolRadar data={filtered.map((tool) => ({ label: tool.label, coveragePercent: tool.coveragePercent }))}
        chartHeightClassName="coverage-radar-plot" />
      <p>Chart follows the table filters. Tools with no mapped CIs in the filtered data are hidden.</p>
    </aside>
  </div>;
}
