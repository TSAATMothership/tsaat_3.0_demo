import { securityDomainFilter } from "@/lib/security-domain.mjs";
export type WorkspaceSearchParams = Record<string, string | string[] | undefined>;

/** Scope IDs use comma-separated values; repeated query parameters are accepted too. */
export function scopeIds(value: string | string[] | null | undefined): string[] {
  return [...new Set((Array.isArray(value) ? value : [value ?? ""])
    .flatMap((part) => part.split(",")).map((id) => id.trim()).filter(Boolean))].sort();
}

export function hasWorkspaceScope(params: WorkspaceSearchParams): boolean {
  return scopeIds(params.network).length > 0 || scopeIds(params.system).length > 0;
}

export function updateWorkspaceScope(params: URLSearchParams, kind: "network" | "system" | "securityDomain", ids: string[]): URLSearchParams {
  const next = new URLSearchParams(params);
  if (kind === "securityDomain") {
    const domain = securityDomainFilter(ids);
    if (domain) next.set(kind, domain); else next.delete(kind);
    for (const key of ["page", "assetId", "systemPage", "networkPage", "discoveryFilters", "impactAssetId"]) next.delete(key);
    return next;
  }
  next.delete(kind);
  const selected = scopeIds(ids);
  if (selected.length) {
    next.delete(kind === "network" ? "system" : "network");
    next.set(kind, selected.join(","));
  }
  // Pagination and entity drill-downs must not carry into a different scope.
  for (const key of ["page", "assetId", "systemPage", "networkPage"]) next.delete(key);
  return next;
}

export function sameWorkspaceScope(left: URLSearchParams, right: URLSearchParams): boolean {
  return securityDomainFilter(left.has("securityDomain") ? left.getAll("securityDomain") : undefined) === securityDomainFilter(right.has("securityDomain") ? right.getAll("securityDomain") : undefined) && ["network", "system"].every((kind) =>
    JSON.stringify(scopeIds(left.getAll(kind))) === JSON.stringify(scopeIds(right.getAll(kind))));
}

/** Apply a pending selection to the current sidebar view, preserving its local tab and date. */
export function workspaceScopeUpdateHref(pathname: string, params: URLSearchParams): string {
  return pathname + (params.size ? "?" + params : "");
}

export interface WorkspaceItem { id: string; label: string; href: string; sidebar?: boolean }
export interface WorkspaceGroup { id: string; label: string; items: WorkspaceItem[] }

export const WORKSPACE_GROUPS: WorkspaceGroup[] = [
  { id: "governance", label: "Governance", items: [
    { id: "governance-software-insights", label: "Installed Software Insights", href: "/governance/installed-software-insights" },
    { id: "governance-endpoint-insights", label: "End Point Insights", href: "/governance/end-point-insights" },
    { id: "governance-vulnerability-insights", label: "Security Vulnerability Insights", href: "/governance/security-vulnerability-insights" }
  ] },
  { id: "discovery", label: "Discovery", items: [
    { id: "discovery-endpoints", label: "End Point Explorer", href: "/discovery-coverage?discoveryView=endpoints" },
    { id: "discovery-software", label: "Installed Software Explorer", href: "/discovery-coverage?discoveryView=installed-software" },
    { id: "discovery-vulnerabilities", label: "Security Vulnerability Explorer", href: "/discovery-coverage?discoveryView=security-vulnerabilities" },
    { id: "discovery-shadow-it", label: "Shadow IT Explorer", href: "/discovery-coverage?discoveryView=shadow-it" },
    { id: "discovery-topology", label: "Topology Explorer", href: "/discovery-coverage?discoveryView=topology" }
  ] },
];
export const WORKSPACE_LINKS: WorkspaceItem[] = [
];

export function workspaceHref(href: string, current: URLSearchParams): string {
  const target = new URL(href, "http://localhost");
  for (const key of ["network", "system", "securityDomain", "dataDate"]) {
    const value = current.getAll(key).join(",");
    if (value) target.searchParams.set(key, value);
  }
  return target.pathname + (target.search ? target.search : "");
}

export function activeWorkspaceItem(pathname: string, params: URLSearchParams): WorkspaceItem | undefined {
  const items = [...WORKSPACE_GROUPS.flatMap(group => group.items), ...WORKSPACE_LINKS];
  return items.find(item => {
    const target = new URL(item.href, "http://localhost");
    return target.pathname === pathname && (pathname !== "/discovery-coverage" || target.searchParams.get("discoveryView") === (params.get("discoveryView") || "endpoints"));
  });
}
export function isWorkspaceItemVisible(item: WorkspaceItem, _params: URLSearchParams, _activeHref?: string): boolean {
  return item.sidebar !== false;
}
