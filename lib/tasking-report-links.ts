import { DATA_DATE_PARAM, normalizeDataDate } from "@/lib/data-date";
import { Filters } from "@/lib/types";

export type TaskingReportKind = "kpi" | "spi" | "spi-trend" | "spi-all";

export const TASKING_REPORT_CONTENT_TYPE = "application/pdf";

export function buildTaskingReportHref({
  kind,
  id,
  filters,
  dataDate
}: {
  kind: TaskingReportKind;
  id: string;
  filters: Filters;
  dataDate?: string;
}): string {
  const params = new URLSearchParams();
  params.set("kind", kind);
  params.set("id", id);

  if (dataDate) {
    params.set(DATA_DATE_PARAM, dataDate);
  }
  if (filters.managedNetwork) {
    params.set("network", filters.managedNetwork);
  }
  if (filters.ictSystem) {
    params.set("system", filters.ictSystem);
  }
  if (filters.systemCriticality) {
    params.set("criticality", filters.systemCriticality);
  }
  if (filters.securityDomain) {
    params.set("securityDomain", filters.securityDomain);
  }
  if (filters.environment) {
    params.set("environment", filters.environment);
  }
  if (filters.assetType) {
    params.set("assetType", filters.assetType);
  }
  if (filters.severity) {
    params.set("severity", filters.severity);
  }
  if (filters.missionCapability) {
    params.set("mission", filters.missionCapability);
  }
  if (filters.businessService) {
    params.set("service", filters.businessService);
  }

  return `/api/tasking-report?${params.toString()}`;
}

export function taskingReportDataDateFromSearchParams(searchParams: URLSearchParams): string | undefined {
  return normalizeDataDate(searchParams.get(DATA_DATE_PARAM)?.trim());
}

export function taskingReportFilename(kind: TaskingReportKind, id: string): string {
  const safeId = `${kind}-${id.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
  if (kind === "spi") {
    return `tsaat-spi-report-${safeId}.pdf`;
  }
  if (kind === "spi-trend") {
    return `tsaat-spi-trend-report-${safeId}.pdf`;
  }
  if (kind === "spi-all") {
    return "tsaat-spi-report-all.pdf";
  }
  return `tsaat-tasking-report-${safeId}.pdf`;
}
