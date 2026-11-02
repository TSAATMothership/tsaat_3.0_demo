export type WorkspaceSearchParams = Record<string, string | string[] | undefined>;

/** Scope IDs use comma-separated values; repeated query parameters are accepted too. */
export function scopeIds(value: string | string[] | null | undefined): string[] {
  return [...new Set((Array.isArray(value) ? value : [value ?? ""])
    .flatMap((part) => part.split(",")).map((id) => id.trim()).filter(Boolean))].sort();
}

export function hasWorkspaceScope(params: WorkspaceSearchParams): boolean {
  return scopeIds(params.network).length > 0 || scopeIds(params.system).length > 0;
}

export function updateWorkspaceScope(params: URLSearchParams, kind: "network" | "system", ids: string[]): URLSearchParams {
  const next = new URLSearchParams(params);
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
  return ["network", "system"].every((kind) =>
    JSON.stringify(scopeIds(left.getAll(kind))) === JSON.stringify(scopeIds(right.getAll(kind))));
}

function workspaceViewPathname(pathname: string): string {
  return pathname === "/networks" || pathname.startsWith("/networks/") ? "/network-risk-profile"
    : pathname === "/systems" || pathname.startsWith("/systems/") ? "/ict-system-risk-profile" : pathname;
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
  for (const key of ["network", "system", "dataDate"]) {
    const value = searchParams[key];
    if (value) params.set(key, Array.isArray(value) ? value.join(",") : value);
  }
  return workspaceScopeUpdateHref(pathname, params);
}

export interface WorkspaceItem { label: string; href: string; scope?: "network" | "system" }
export interface WorkspaceGroup { label: string; items: WorkspaceItem[] }

export const WORKSPACE_GROUPS: WorkspaceGroup[] = [
  { label: "Cyber Security", items: [
    { label: "Network Risk Profile", href: "/network-risk-profile", scope: "network" },
    { label: "ICT System Risk Profile", href: "/ict-system-risk-profile", scope: "system" },
    { label: "Service Impact Analyser", href: "/cyber-cop?copView=impact" },
    { label: "Network Impact Analyser", href: "/cyber-cop?copView=network-impact-analyser", scope: "network" },
    { label: "ICT System Impact Analyser", href: "/cyber-cop?copView=ict-system-impact-analyser", scope: "system" }
  ] },
  { label: "Discovery", items: [
    { label: "Overview", href: "/discovery-coverage?discoveryView=overview" },
    { label: "Discovery Tool Coverage", href: "/discovery-coverage" },
    { label: "Discovery Compliance Explorer", href: "/discovery-coverage?discoveryView=compliance" },
    { label: "End Point Explorer", href: "/discovery-coverage?discoveryView=endpoints" },
    { label: "Installed Software Explorer", href: "/discovery-coverage?discoveryView=installed-software" },
    { label: "Shadow IT Explorer", href: "/discovery-coverage?discoveryView=shadow-it" }
  ] },
  { label: "Observed Measures", items: [
    { label: "Measures Summary", href: "/measures" },
    { label: "Key Performance Indicators (KPIs)", href: "/measures?measuresTab=measures-kpi" },
    { label: "Security Posture Indicators (SPIs)", href: "/measures?measuresTab=measures-spi" }
  ] },
  { label: "Findings", items: [
    { label: "Findings Register", href: "/findings" }
  ] }
];
export const WORKSPACE_LINKS: WorkspaceItem[] = [
  { label: "Briefs & Reports", href: "/report" }
];

export const COP_VIEWS = ["overview", "impact", "network-impact-analyser", "ict-system-impact-analyser"] as const;
export type CopView = typeof COP_VIEWS[number];
export function resolveCopView(value: string | string[] | undefined): CopView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return COP_VIEWS.includes(candidate as CopView) ? candidate as CopView : "overview";
}

export function workspaceHref(href: string, current: URLSearchParams): string {
  const target = new URL(href, "http://localhost");
  for (const key of ["network", "system", "dataDate"]) {
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
  // Risk profiles follow the applied header scope, including when the other profile was active.
  if (item.href === "/network-risk-profile" || item.href === "/ict-system-risk-profile") {
    if (scopeIds(params.getAll("network")).length) return item.scope === "network";
    if (scopeIds(params.getAll("system")).length) return item.scope === "system";
  }
  // Applying another scope must not hide or deselect the view the user is updating.
  if (item.href === activeHref) return true;
  if (scopeIds(params.getAll("network")).length) return item.scope !== "system";
  if (scopeIds(params.getAll("system")).length) return item.scope !== "network";
  return true;
}
