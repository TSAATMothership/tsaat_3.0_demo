export type ExplorerColumn<T> = { key: string; label: string; value: (row: T) => string | number | null | undefined };
export type ExplorerTableFilters = { search: string; columns: Record<string, string[]> };
export type ExplorerTableRow<T> = { row: T; values: Record<string, string>; search: string };
export const emptyExplorerTableFilters = (): ExplorerTableFilters => ({ search: "", columns: {} });

export function prepareExplorerRows<T>(rows: T[], columns: ExplorerColumn<T>[], searchText?: (row: T) => string): ExplorerTableRow<T>[] {
  return rows.map((row) => {
    const values = Object.fromEntries(columns.map((column) => [column.key, String(column.value(row) ?? "Not recorded")]));
    return { row, values, search: [...Object.values(values), searchText?.(row) ?? ""].join(" ").toLocaleLowerCase() };
  });
}

/** Facets ignore their own selection while respecting search and every other column. */
export function queryExplorerRows<T>(rows: ExplorerTableRow<T>[], columns: ExplorerColumn<T>[], filters: ExplorerTableFilters) {
  const search = filters.search.trim().toLocaleLowerCase();
  const selections = Object.entries(filters.columns).filter(([key, values]) => values.length && columns.some((column) => column.key === key));
  const counts = Object.fromEntries(columns.map(({ key }) => [key, new Map<string, number>()]));
  const filtered: T[] = [];
  for (const entry of rows) {
    if (search && !entry.search.includes(search)) continue;
    const misses = selections.filter(([key, values]) => !values.includes(entry.values[key]));
    if (!misses.length) filtered.push(entry.row);
    if (misses.length > 1) continue;
    for (const { key } of columns) {
      if (misses.length && misses[0][0] !== key) continue;
      const value = entry.values[key];
      counts[key].set(value, (counts[key].get(value) ?? 0) + 1);
    }
  }
  return { filtered, facets: Object.fromEntries(columns.map(({ key }) => [key,
    Array.from(counts[key], ([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }))
  ])) };
}
