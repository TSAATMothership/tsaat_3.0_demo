export type ExplorerNumberRange = { min?: number; max?: number };
export type ExplorerSortDirection = "asc" | "desc";
export type ExplorerTableSort = { key: string; direction: ExplorerSortDirection };
export type ExplorerColumn<T> = {
  key: string; label: string; value: (row: T) => string | number | null | undefined;
  range?: { value: (row: T) => number | null | undefined; unit: string; min?: number; step?: number; sortable?: boolean };
};
export type ExplorerTableFilters = { search: string; columns: Record<string, string[]>; ranges?: Record<string, ExplorerNumberRange> };
export type ExplorerTableRow<T> = { row: T; values: Record<string, string>; rangeValues: Record<string, number | null | undefined>; search: string };
export const hasExplorerNumberRange = (range?: ExplorerNumberRange) => range?.min !== undefined || range?.max !== undefined;
export const emptyExplorerTableFilters = (): ExplorerTableFilters => ({ search: "", columns: {} });

export function prepareExplorerRows<T>(rows: T[], columns: ExplorerColumn<T>[], searchText?: (row: T) => string): ExplorerTableRow<T>[] {
  return rows.map((row) => {
    const values = Object.fromEntries(columns.map((column) => [column.key, String(column.value(row) ?? "Not recorded")]));
    const rangeValues = Object.fromEntries(columns.filter(column => column.range).map(column => [column.key, column.range!.value(row)]));
    return { row, values, rangeValues, search: [...Object.values(values), searchText?.(row) ?? ""].join(" ").toLocaleLowerCase() };
  });
}

/** Facets ignore their own selection while respecting search and every other column. */
export function queryExplorerRows<T>(rows: ExplorerTableRow<T>[], columns: ExplorerColumn<T>[], filters: ExplorerTableFilters, sort?: ExplorerTableSort) {
  const search = filters.search.trim().toLocaleLowerCase();
  const selections = Object.entries(filters.columns).filter(([key, values]) => values.length && columns.some((column) => column.key === key));
  const ranges = Object.entries(filters.ranges ?? {}).filter(([key, range]) => hasExplorerNumberRange(range) && columns.some(column => column.key === key && column.range));
  const counts = Object.fromEntries(columns.map(({ key }) => [key, new Map<string, number>()]));
  const matching: ExplorerTableRow<T>[] = [];
  for (const entry of rows) {
    if (search && !entry.search.includes(search)) continue;
    const misses = new Set(selections.filter(([key, values]) => !values.includes(entry.values[key])).map(([key]) => key));
    for (const [key, range] of ranges) {
      const value = entry.rangeValues[key];
      if (value == null || !Number.isFinite(value) || (range.min !== undefined && value < range.min) || (range.max !== undefined && value > range.max)) misses.add(key);
    }
    if (!misses.size) matching.push(entry);
    if (misses.size > 1) continue;
    for (const { key } of columns) {
      if (misses.size && !misses.has(key)) continue;
      const value = entry.values[key];
      counts[key].set(value, (counts[key].get(value) ?? 0) + 1);
    }
  }
  if (sort && columns.some(column => column.key === sort.key && column.range?.sortable)) {
    matching.sort((a, b) => {
      const left = a.rangeValues[sort.key];
      const right = b.rangeValues[sort.key];
      // Missing durations stay last in either direction; equal values retain their input order.
      if (left == null || !Number.isFinite(left)) return right == null || !Number.isFinite(right) ? 0 : 1;
      if (right == null || !Number.isFinite(right)) return -1;
      return (left - right) * (sort.direction === "desc" ? -1 : 1);
    });
  }
  return { filtered: matching.map(entry => entry.row), facets: Object.fromEntries(columns.map(({ key }) => [key,
    Array.from(counts[key], ([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }))
  ])) };
}
