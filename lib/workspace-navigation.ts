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
    { label: "Discovery Compliance", href: "/discovery-coverage?discoveryView=compliance" },
    { label: "Discovery Tool Coverage", href: "/discovery-coverage" },
    { label: "End Point Explorer", href: "/discovery-coverage?discoveryView=endpoints" }
  ] },
  { label: "Observed Measures", items: [
    { label: "Measures Summary", href: "/measures" },
    { label: "Key Performance Indicators (KPIs)", href: "/measures?measuresTab=measures-kpi" },
    { label: "Security Posture Indicators (SPIs)", href: "/measures?measuresTab=measures-spi" },
    { label: "SPI Risk Matrix", href: "/measures?measuresTab=spi-settings" }
  ] }
];
export const WORKSPACE_LINKS: WorkspaceItem[] = [
  { label: "Findings Register", href: "/findings" },
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
  const items = [...WORKSPACE_GROUPS.flatMap((group) => group.items), ...WORKSPACE_LINKS];
  return items.find((item) => {
    const target = new URL(item.href, "http://localhost");
    if (target.pathname !== pathname) return false;
    const key = pathname === "/cyber-cop" ? "copView" : pathname === "/discovery-coverage" ? "discoveryView"
      : pathname === "/measures" ? "measuresTab" : null;
    if (!key) return true;
    const defaults = { copView: "overview", discoveryView: "tools", measuresTab: "summary" };
    return (params.get(key) || defaults[key]) === (target.searchParams.get(key) || defaults[key]);
  });
}

export function isWorkspaceItemVisible(item: WorkspaceItem, params: URLSearchParams): boolean {
  if (scopeIds(params.getAll("network")).length) return item.scope !== "system";
  if (scopeIds(params.getAll("system")).length) return item.scope !== "network";
  return true;
}

/** Leave a view that no longer belongs to the selected header scope. */
export function workspaceLocationForScope(pathname: string, params: URLSearchParams): string {
  const path = pathname.startsWith("/networks/") ? "/networks"
    : pathname.startsWith("/systems/") ? "/systems" : pathname;
  const item = activeWorkspaceItem(path, params);
  if ((item && !isWorkspaceItemVisible(item, params)) ||
      (path === "/" && hasWorkspaceScope(Object.fromEntries(params)))) {
    return workspaceHref("/cyber-cop", params);
  }
  return `${path}${params.size ? `?${params}` : ""}`;
}
