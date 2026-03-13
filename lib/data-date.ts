const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DATA_DATE_PARAM = "dataDate";

type SearchParamValue = string | string[] | undefined;

export function firstSearchParam(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function isDateOnly(value: string | undefined | null): value is string {
  return Boolean(value && DATE_ONLY_PATTERN.test(value));
}

export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeDataDate(value: string | undefined | null): string | undefined {
  if (!isDateOnly(value)) {
    return undefined;
  }
  return value;
}

export function extractDataDateParam(
  searchParams: Record<string, SearchParamValue>
): string | undefined {
  return normalizeDataDate(firstSearchParam(searchParams[DATA_DATE_PARAM]));
}

export function extractHrefPathname(href: string): string {
  try {
    return new URL(href, "http://localhost").pathname;
  } catch {
    return href.split("?")[0]?.split("#")[0] ?? href;
  }
}

export function isDataDateScopedPath(pathname: string): boolean {
  return (
    pathname === "/cyber-cop" ||
    pathname === "/discovery-coverage" ||
    pathname === "/report" ||
    pathname === "/networks" ||
    pathname.startsWith("/networks/") ||
    pathname === "/systems" ||
    pathname.startsWith("/systems/")
  );
}

export function withDataDate(href: string, dataDate: string | undefined): string {
  if (!dataDate) {
    return href;
  }

  const url = new URL(href, "http://localhost");
  url.searchParams.set(DATA_DATE_PARAM, dataDate);
  const search = url.searchParams.toString();
  return search ? `${url.pathname}?${search}` : url.pathname;
}
