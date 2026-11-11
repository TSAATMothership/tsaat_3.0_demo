import { DATA_DATE_PARAM, normalizeDataDate } from "@/lib/data-date";

export const NETWORK_DISCOVERY_REPORT_CONTENT_TYPE = "application/pdf";

const NETWORK_DISCOVERY_REPORT_PATH = "/api/discovery-coverage/network-report";

export function buildNetworkDiscoveryReportHref({
  networkId,
  searchParams
}: {
  networkId: string;
  searchParams?: { toString(): string } | URLSearchParams | null;
}): string {
  const params = new URLSearchParams(searchParams?.toString());
  params.set("network", networkId);
  return `${NETWORK_DISCOVERY_REPORT_PATH}?${params.toString()}`;
}

export function networkDiscoveryReportDataDateFromSearchParams(searchParams: URLSearchParams): string | undefined {
  return normalizeDataDate(searchParams.get(DATA_DATE_PARAM)?.trim());
}

export function networkDiscoveryReportFilename(networkId: string, dataDate: string): string {
  const safeNetworkId = networkId.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "network";
  const safeDataDate = normalizeDataDate(dataDate) ?? dataDate.replace(/[^0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return `tsaat-network-discovery-report-${safeNetworkId}-${safeDataDate || "snapshot"}.pdf`;
}
