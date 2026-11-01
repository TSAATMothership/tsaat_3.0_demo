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
  return pathname.startsWith("/networks/") ? "/networks"
    : pathname.startsWith("/systems/") ? "/systems" : pathname;
}

/** Apply a pending selection to the current sidebar view, preserving its local tab and date. */
export function workspaceScopeUpdateHref(pathname: string, params: URLSearchParams): string {
  return workspaceViewPathname(pathname) + (params.size ? `?${params}` : "");
}

export interface WorkspaceItem { label: string; href: string; scope?: "network" | "system" }
export interface WorkspaceGroup { label: string; items: WorkspaceItem[] }

export const WORKSPACE_GROUPS: WorkspaceGroup[] = [
  { label: "Cyber Security", items: [
    { label: "Cyber COP", href: "/cyber-cop" },
    { label: "Service Impact Analyser", href: "/cyber-cop?copView=impact" },
    { label: "Networks – SPI Heatmap", href: "/cyber-cop?copView=networks-spi-heatmap", scope: "network" },
    { label: "ICT Systems – SPI Heatmap", href: "/cyber-cop?copView=systems-spi-heatmap", scope: "system" },
    { label: "Network Impact Analyser", href: "/cyber-cop?copView=network-impact-analyser", scope: "network" },
    { label: "ICT System Impact Analyser", href: "/cyber-cop?copView=ict-system-impact-analyser", scope: "system" },
    { label: "Networks Posture", href: "/networks", scope: "network" },
    { label: "ICT Systems Posture", href: "/systems", scope: "system" }
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

export const COP_VIEWS = ["overview", "impact", "networks-spi-heatmap", "systems-spi-heatmap", "network-impact-analyser", "ict-system-impact-analyser"] as const;
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
    // Keep links to the former replacement view on the consolidated coverage page.
    const canonicalView = key === "discoveryView" && selectedView === "tools-2" ? "tools" : selectedView;
    return canonicalView === (target.searchParams.get(key) || defaults[key]);
  });
}

export function isWorkspaceItemVisible(item: WorkspaceItem, params: URLSearchParams, activeHref?: string): boolean {
  // Applying another scope must not hide or deselect the view the user is updating.
  if (item.href === activeHref) return true;
  if (scopeIds(params.getAll("network")).length) return item.scope !== "system";
  if (scopeIds(params.getAll("system")).length) return item.scope !== "network";
  return true;
}
