import { DATA_DATE_PARAM, normalizeDataDate } from "@/lib/data-date";
import { Filters } from "@/lib/types";

export type TaskingReportKind = "kpi" | "kpi-trend" | "spi" | "spi-trend" | "spi-all";

export const TASKING_REPORT_CONTENT_TYPE = "application/pdf";
export const KPI_ATO_REPORT_NAME = "KPI-1 ICT Systems without ATO Report";
export const KPI_DIIS_REPORT_NAME = "KPI-2 ICT Systems without DIIS Registration Report";

export function nonCompliantTaskingReportHref(href: string): string {
  const url = new URL(href, "http://localhost");
  url.searchParams.set("results", "non-compliant");
  return `${url.pathname}${url.search}${url.hash}`;
}

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

function taskingReportDate(generatedAt: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Sydney", day: "2-digit", month: "2-digit", year: "numeric"
  }).format(generatedAt).replaceAll("/", "-");
}

export function taskingReportFilename(kind: TaskingReportKind, id: string, generatedAt = new Date(), indicatorName?: string, nonCompliantOnly = false): string {
  const variant = nonCompliantOnly ? " - Non-Compliance Only" : "";
  if (kind === "kpi" && (id === "KPI-1" || id === "KPI-2")) {
    const reportName = id === "KPI-1" ? KPI_ATO_REPORT_NAME : KPI_DIIS_REPORT_NAME;
    return `${reportName}${variant} ${taskingReportDate(generatedAt)}.pdf`;
  }
  const safeId = `${kind}-${id.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
  if (kind === "spi-all") {
    return `All SPI Report ${taskingReportDate(generatedAt)}.pdf`;
  }
  if (kind === "kpi-trend" || kind === "spi" || kind === "spi-trend") {
    const safeName = indicatorName?.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
    if (!safeName) throw new Error("An indicator name is required for this report filename.");
    const label = kind === "kpi-trend" ? id : `SPI-${id.replace(/^SPI-/i, "")}`;
    return `${label} - ${safeName}${kind === "spi" ? " Report" : ""}${variant} ${taskingReportDate(generatedAt)}.pdf`;
  }
  return `tsaat-tasking-report-${safeId}.pdf`;
}
