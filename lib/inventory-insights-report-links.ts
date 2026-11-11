import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { securityDomainFilter } from "@/lib/security-domain.mjs";

export const INVENTORY_INSIGHT_REPORTS = {
  endpoints: { title: "End Point Insights", slug: "end-point-insights" },
  vulnerabilities: { title: "Security Vulnerability Insights", slug: "security-vulnerability-insights" }
} as const;
export type InventoryInsightReport = keyof typeof INVENTORY_INSIGHT_REPORTS;

export function inventoryInsightsReportHref(kind: InventoryInsightReport, scope: WorkspaceSearchParams, snapshotDate: string) {
  const params = new URLSearchParams({ dataDate: snapshotDate });
  for (const key of ["network", "system"] as const) { const ids = scopeIds(scope[key]); if (ids.length) params.set(key, ids.join(",")); }
  const domain = securityDomainFilter(scope.securityDomain); if (domain) params.set("securityDomain", domain);
  return `/api/governance/${INVENTORY_INSIGHT_REPORTS[kind].slug}/report?${params}`;
}
