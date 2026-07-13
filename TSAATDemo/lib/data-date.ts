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

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function toDateKey(year: number, monthIndex: number, day: number): string {
  return [
    String(year).padStart(4, "0"),
    String(monthIndex + 1).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");
}

export function subtractCalendarMonthsDateKey(dateKey: string, monthsBack: number): string {
  const normalizedDate = normalizeDataDate(dateKey);
  if (!normalizedDate) {
    return dateKey;
  }

  const [yearPart, monthPart, dayPart] = normalizedDate.split("-");
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;
  const day = Number(dayPart);
  const safeMonthsBack = Math.max(0, Math.trunc(monthsBack));
  const totalMonthIndex = year * 12 + monthIndex - safeMonthsBack;
  const targetYear = Math.floor(totalMonthIndex / 12);
  const targetMonthIndex = totalMonthIndex - targetYear * 12;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonthIndex));

  return toDateKey(targetYear, targetMonthIndex, targetDay);
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
    pathname === "/measures" ||
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
