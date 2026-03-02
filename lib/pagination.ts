export interface PageState {
  page: number;
  pageSize: number;
}

export function parsePageState(
  searchParams: Record<string, string | string[] | undefined>,
  pageKey = "page",
  pageSizeKey = "pageSize",
  defaults: { page: number; pageSize: number; maxPageSize: number } = { page: 1, pageSize: 50, maxPageSize: 200 }
): PageState {
  const first = (value: string | string[] | undefined): string | undefined => {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  const rawPage = Number(first(searchParams[pageKey]));
  const rawPageSize = Number(first(searchParams[pageSizeKey]));

  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : defaults.page;
  const pageSize =
    Number.isInteger(rawPageSize) && rawPageSize >= 1
      ? Math.min(rawPageSize, defaults.maxPageSize)
      : defaults.pageSize;

  return { page, pageSize };
}

export function paginate<T>(items: T[], page: number, pageSize: number): {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
} {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    totalItems,
    totalPages,
    currentPage,
    pageSize
  };
}
