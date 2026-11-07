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

function workspaceViewPathname(pathname: string): string {
  return pathname === "/networks" || pathname.startsWith("/networks/") ? "/network-risk-profile"
    : pathname === "/systems" || pathname.startsWith("/systems/") ? "/ict-system-risk-profile"
    : pathname === "/governance/overview" ? "/governance/trends" : pathname;
}

/** Apply a pending selection to the current sidebar view, preserving its local tab and date. */
export function workspaceScopeUpdateHref(pathname: string, params: URLSearchParams): string {
  pathname = workspaceViewPathname(pathname);
  if (pathname === "/network-risk-profile" || pathname === "/ict-system-risk-profile") {
    if (scopeIds(params.getAll("network")).length) pathname = "/network-risk-profile";
    else if (scopeIds(params.getAll("system")).length) pathname = "/ict-system-risk-profile";
  }
  return pathname + (params.size ? `?${params}` : "");
}

/** Retired posture pages return to the risk profile with the applied header scope and date. */
export function postureReplacementHref(pathname: "/networks" | "/systems", searchParams: WorkspaceSearchParams): string {
  const params = new URLSearchParams();
  for (const key of ["network", "system", "securityDomain", "dataDate"]) {
    const value = searchParams[key];
    if (value) params.set(key, Array.isArray(value) ? value.join(",") : value);
  }
  return workspaceScopeUpdateHref(pathname, params);
}

export interface WorkspaceItem { id: string; label: string; href: string; scope?: "network" | "system"; sidebar?: boolean }
export interface WorkspaceGroup { id: string; label: string; items: WorkspaceItem[] }

export const WORKSPACE_GROUPS: WorkspaceGroup[] = [
  { id: "governance", label: "Governance", items: [
    { id: "governance-trends", label: "Trends", href: "/governance/trends" },
    { id: "governance-insights", label: "Cyber Terrain Insights", href: "/governance/insights" },
    { id: "governance-software-insights", label: "Installed Software Insights", href: "/governance/installed-software-insights" }
  ] },
  { id: "cyber-security", label: "Cyber Security", items: [
    { id: "network-risk-profile", label: "Network Risk Profile", href: "/network-risk-profile", scope: "network" },
    { id: "ict-system-risk-profile", label: "ICT System Risk Profile", href: "/ict-system-risk-profile", scope: "system" },
    { id: "service-impact", label: "Service Impact Analyser", href: "/cyber-cop?copView=impact" },
    { id: "ict-system-impact", label: "ICT System Impact Analyser", href: "/cyber-cop?copView=ict-system-impact-analyser", scope: "system" },
    { id: "ict-system-dependencies", label: "ICT System Dependencies", href: "/cyber-cop?copView=ict-system-dependencies", scope: "system" }
  ] },
  { id: "discovery", label: "Discovery", items: [
    { id: "discovery-overview", label: "Overview", href: "/discovery-coverage?discoveryView=overview" },
    { id: "discovery-tools", label: "Discovery Tool Coverage", href: "/discovery-coverage" },
    { id: "discovery-compliance", label: "Discovery Compliance Explorer", href: "/discovery-coverage?discoveryView=compliance" },
    { id: "discovery-endpoints", label: "End Point Explorer", href: "/discovery-coverage?discoveryView=endpoints" },
    { id: "discovery-software-insights", label: "Installed Software Dashboard", href: "/discovery-coverage?discoveryView=installed-software-insights", sidebar: false },
    { id: "discovery-software", label: "Installed Software Explorer", href: "/discovery-coverage?discoveryView=installed-software" },
    { id: "discovery-vulnerabilities", label: "Security Vulnerability Explorer", href: "/discovery-coverage?discoveryView=security-vulnerabilities" },
    { id: "discovery-patches", label: "Patch Management Explorer", href: "/discovery-coverage?discoveryView=patch-management" },
    { id: "discovery-life-cycle", label: "Life Cycle Management", href: "/discovery-coverage?discoveryView=life-cycle-management" },
    { id: "discovery-shadow-it", label: "Shadow IT Explorer", href: "/discovery-coverage?discoveryView=shadow-it" },
    { id: "discovery-topology", label: "Topology Explorer", href: "/discovery-coverage?discoveryView=topology" }
  ] },
  { id: "observed-measures", label: "Observed Measures", items: [
    { id: "measures-trends", label: "Measures Trends", href: "/measures/trends" },
    { id: "measures-summary", label: "Measures Summary", href: "/measures" },
    { id: "measures-kpi", label: "Key Performance Indicators (KPIs)", href: "/measures?measuresTab=measures-kpi" },
    { id: "measures-spi", label: "Security Posture Indicators (SPIs)", href: "/measures?measuresTab=measures-spi" }
  ] },
  { id: "findings", label: "Findings", items: [
    { id: "findings-register", label: "Findings Register", href: "/findings" }
  ] }
];
export const WORKSPACE_LINKS: WorkspaceItem[] = [
  { id: "briefs-reports", label: "Briefs & Reports", href: "/report" }
];

export const COP_VIEWS = ["overview", "impact", "ict-system-impact-analyser", "ict-system-dependencies"] as const;
export type CopView = typeof COP_VIEWS[number];
export function resolveCopView(value: string | string[] | undefined): CopView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return COP_VIEWS.includes(candidate as CopView) ? candidate as CopView : "overview";
}

export function workspaceHref(href: string, current: URLSearchParams): string {
  const target = new URL(href, "http://localhost");
  for (const key of ["network", "system", "securityDomain", "dataDate"]) {
    const value = current.getAll(key).join(",");
    if (value) target.searchParams.set(key, value);
  }
  return target.pathname + (target.search ? target.search : "");
}

export function activeWorkspaceItem(pathname: string, params: URLSearchParams): WorkspaceItem | undefined {
  pathname = workspaceViewPathname(pathname);
  const items = [...WORKSPACE_GROUPS.flatMap((group) => group.items), ...WORKSPACE_LINKS];
  return items.find((item) => {
    const target = new URL(item.href, "http://localhost");
    if (target.pathname !== pathname) return false;
    const key = pathname === "/cyber-cop" ? "copView" : pathname === "/discovery-coverage" ? "discoveryView"
      : pathname === "/measures" ? "measuresTab" : null;
    if (!key) return true;
    const defaults = { copView: "overview", discoveryView: "tools", measuresTab: "summary" };
    const selectedView = params.get(key) || defaults[key];
    // Keep retired view links aligned with the page fallback and sidebar selection.
    const canonicalView = key === "copView" ? resolveCopView(selectedView)
      : key === "discoveryView" && selectedView === "tools-2" ? "tools" : selectedView;
    return canonicalView === (target.searchParams.get(key) || defaults[key]);
  });
}

export function isWorkspaceItemVisible(item: WorkspaceItem, params: URLSearchParams, activeHref?: string): boolean {
  // Retain bookmark identity and persona preferences without restoring a removed sidebar link.
  if (item.sidebar === false) return false;
  // ICT System Impact Analyser stays hidden under managed-network scope, even when active.
  if (item.href === "/cyber-cop?copView=ict-system-impact-analyser" && scopeIds(params.getAll("network")).length) return false;
  // Risk profiles follow the applied header scope, including when the other profile was active.
  if (item.href === "/network-risk-profile" || item.href === "/ict-system-risk-profile") {
    if (scopeIds(params.getAll("network")).length) return item.scope === "network";
    if (scopeIds(params.getAll("system")).length) return item.scope === "system";
  }
  // Other views retain their active item when the user updates its scope.
  if (item.href === activeHref) return true;
  if (scopeIds(params.getAll("network")).length) return item.scope !== "system";
  if (scopeIds(params.getAll("system")).length) return item.scope !== "network";
  return true;
}
