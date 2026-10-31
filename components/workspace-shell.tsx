"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { WORKSPACE_GROUPS, WORKSPACE_LINKS, activeWorkspaceItem, isWorkspaceItemVisible, workspaceHref, type WorkspaceItem } from "@/lib/workspace-navigation";
import { locationKeyForHref, startRouteLoading } from "@/lib/route-loading";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const params = new URLSearchParams(useSearchParams()?.toString());
  const active = activeWorkspaceItem(pathname, params);
  const renderLink = (item: WorkspaceItem) => (
    <Link key={item.href} href={workspaceHref(item.href, params)} prefetch={false}
      aria-current={active?.href === item.href ? "page" : undefined}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const href = workspaceHref(item.href, params);
        const sourceHref = window.location.pathname + window.location.search + window.location.hash;
        if (locationKeyForHref(href) === locationKeyForHref(sourceHref)) return;
        startRouteLoading({ href, message: `Opening ${item.label}...`, cancelHref: sourceHref });
        router.push(href, { scroll: false });
      }}
      className="workspace-nav-link">
      <span>{item.label}</span>
    </Link>
  );

  return (
    <div className={`workspace-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="workspace-sidebar no-print" aria-label="Workspace navigation">
        <div className="workspace-sidebar-heading">
          <span className="sidebar-caption">Workspace</span>
          <button type="button" className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed} aria-controls="workspace-navigation" aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
            title={collapsed ? "Show sidebar" : "Hide sidebar"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
              className={collapsed ? "rotate-180" : ""}><path d="m14 6-6 6 6 6" /></svg>
          </button>
        </div>
        <nav id="workspace-navigation" className="workspace-navigation" aria-label="Views" hidden={collapsed}>
          {WORKSPACE_GROUPS.map((group, index) => {
            const open = expanded.includes(group.label);
            return <div className="workspace-nav-group" key={group.label}>
              <button type="button" className="workspace-group-toggle" aria-expanded={open} aria-controls={`workspace-group-${index}`}
                onClick={() => setExpanded((current) => open ? current.filter((label) => label !== group.label) : [...current, group.label])}>
                <span>{group.label}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={open ? "rotate-90" : ""}><path d="m9 5 7 7-7 7" /></svg>
              </button>
              <div id={`workspace-group-${index}`} className="workspace-group-items" hidden={!open}>
                {group.items.filter((item) => isWorkspaceItemVisible(item, params, active?.href)).map(renderLink)}
              </div>
            </div>;
          })}
          <div className="workspace-direct-links">{WORKSPACE_LINKS.map(renderLink)}</div>
        </nav>
      </aside>
      <main id="workspace" className="workspace-content" aria-label="Workspace">
        {children}
      </main>
    </div>
  );
}
