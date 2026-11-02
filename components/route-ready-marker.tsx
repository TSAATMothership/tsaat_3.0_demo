import { buildLocationKeyFromParamsRecord, encodeLocationKeyForAttribute } from "@/lib/location-key";

type SearchParamValue = string | string[] | undefined;

export function RouteReadyMarker({
  pathname,
  searchParams
}: {
  pathname: string;
  searchParams: Record<string, SearchParamValue>;
}) {
  const routeReadyLocationKey = buildLocationKeyFromParamsRecord(pathname, searchParams);
  return <span hidden data-route-ready-key={encodeLocationKeyForAttribute(routeReadyLocationKey)} />;
}
