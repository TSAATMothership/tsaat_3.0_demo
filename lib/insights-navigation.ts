import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { securityDomainFilter } from "@/lib/security-domain.mjs";
export function insightsHref(scope: WorkspaceSearchParams, pathname: string, view?: { key: string; value: string }) {
  const params = new URLSearchParams();
  for (const key of ["network", "system"] as const) {
    const ids = scopeIds(scope[key]); if (ids.length) params.set(key, ids.join(","));
  }
  const domain = securityDomainFilter(scope.securityDomain); if (domain) params.set("securityDomain", domain);
  const date = Array.isArray(scope.dataDate) ? scope.dataDate[0] : scope.dataDate;
  if (date) params.set("dataDate", date);
  if (view) params.set(view.key, view.value);
  return pathname + (params.size ? `?${params}` : "");
}

