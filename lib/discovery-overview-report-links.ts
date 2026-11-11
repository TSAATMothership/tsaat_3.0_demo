import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { securityDomainFilter } from "@/lib/security-domain.mjs";
export function discoveryOverviewReportHref(scope: WorkspaceSearchParams, snapshotDate: string): string {
  const params = new URLSearchParams({ dataDate: snapshotDate });
  for (const key of ["network", "system"] as const) { const ids = scopeIds(scope[key]); if (ids.length) params.set(key, ids.join(",")); }
  const domain = securityDomainFilter(scope.securityDomain); if (domain) params.set("securityDomain", domain);
  return "/api/discovery-coverage/overview-report?" + params;
}
