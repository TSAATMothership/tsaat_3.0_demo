"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { WORKSPACE_GROUPS, WORKSPACE_LINKS, activeWorkspaceItem, isWorkspaceItemVisible, workspaceHref, type WorkspaceItem } from "@/lib/workspace-navigation";
import { locationKeyForHref, startRouteLoading } from "@/lib/route-loading";
import { usePersona } from "@/components/persona-provider";
import { PERSONA_PAGES, personaShowsPage, personaShowsSection } from "@/lib/personas";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { activePersona, settings, error, loading } = usePersona();
  const showSection = (id: string) => !settings || personaShowsSection(settings, activePersona, id);
  const noSections = settings && activePersona && !PERSONA_PAGES.some(page => personaShowsPage(settings, activePersona, page.id));
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(() => WORKSPACE_GROUPS.map((group) => group.label));
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
          {loading && !settings && <p role="status" className="px-3 py-2 text-xs text-slate-400">Loading personas...</p>}
          {error && <p role="status" className="px-3 py-2 text-xs text-amber-200">{settings ? "Using previously loaded persona settings." : "Showing all sections; personas are unavailable."} Open Menu → Settings → Personas to retry.</p>}
          {noSections && <p role="status" className="px-3 py-4 text-sm text-slate-300">No sections are enabled for this persona. Open Menu → Settings → Personas to choose a persona or change its visible sections.</p>}
          {WORKSPACE_GROUPS.map((group, index) => {
            if (!showSection(group.id)) return null;
            const visibleItems = group.items.filter(item => (!settings || personaShowsPage(settings, activePersona, item.id)) && isWorkspaceItemVisible(item, params, active?.href));
            if (!visibleItems.length) return null;
            const open = expanded.includes(group.label);
            return <div className="workspace-nav-group" key={group.label}>
              <button type="button" className="workspace-group-toggle" aria-expanded={open} aria-controls={`workspace-group-${index}`}
                onClick={() => setExpanded((current) => open ? current.filter((label) => label !== group.label) : [...current, group.label])}>
                <span>{group.label}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={open ? "rotate-90" : ""}><path d="m9 5 7 7-7 7" /></svg>
              </button>
              <div id={`workspace-group-${index}`} className="workspace-group-items" hidden={!open}>
                {visibleItems.map(renderLink)}
              </div>
            </div>;
          })}
          {showSection("briefs-reports") && <div className="workspace-direct-links">{WORKSPACE_LINKS.map(renderLink)}</div>}
        </nav>
      </aside>
      <main id="workspace" className="workspace-content" aria-label="Workspace">
        {children}
      </main>
    </div>
  );
}
