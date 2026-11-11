type SearchParamValue = string | string[] | undefined;

export function normalizeQuery(query: string): string {
  const params = new URLSearchParams(query);
  return Array.from(params.entries())
    .sort(([aKey, aValue], [bKey, bValue]) => {
      if (aKey === bKey) {
        return aValue.localeCompare(bValue);
      }
      return aKey.localeCompare(bKey);
    })
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export function buildLocationKey(pathname: string, query: string): string {
  return `${pathname}?${normalizeQuery(query)}`;
}

export function buildLocationKeyFromParamsRecord(
  pathname: string,
  params: Record<string, SearchParamValue>
): string {
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "undefined") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        queryParams.append(key, item);
      }
      continue;
    }
    queryParams.append(key, value);
  }
  return buildLocationKey(pathname, queryParams.toString());
}

export function encodeLocationKeyForAttribute(locationKey: string): string {
  return encodeURIComponent(locationKey);
}
