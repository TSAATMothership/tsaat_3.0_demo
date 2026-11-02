"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { WorkspaceFilters } from "@/components/workspace-filters";
import { broadcastLogoutEvent } from "@/lib/auth-client-events";
import { normalizeDataDate, todayDateKey } from "@/lib/data-date";
import { startRouteLoading } from "@/lib/route-loading";
import { SettingsPopup } from "@/components/settings-popup";

export function MenuNavigation({ authenticatedUsername }: { authenticatedUsername?: string }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const menuSummaryRef = useRef<HTMLElement>(null);
  const [pending, startTransition] = useTransition();
  const selectedDataDate = normalizeDataDate(searchParams?.get("dataDate")) ?? todayDateKey();
  const onLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" }); }
    finally { broadcastLogoutEvent(); window.location.replace("/login"); }
  };
  return <div className="workspace-header-controls">
    <p className="workspace-signed-in"><span className="workspace-field-label">Signed in</span><span>{authenticatedUsername}</span></p>
    <WorkspaceFilters dataDate={selectedDataDate} />
    <label className="workspace-date"><span className="workspace-field-label">Date</span>
      <input type="date" aria-label="Data date" value={selectedDataDate} disabled={pending} onChange={(event) => {
        if (!normalizeDataDate(event.target.value)) return;
        const params = new URLSearchParams(searchParams?.toString());
        params.set("dataDate", event.target.value);
        const href = `${pathname}?${params}`;
        startRouteLoading({ href, message: "Loading selected date…" });
        startTransition(() => router.replace(href, { scroll: false }));
      }} />
    </label>
    <details className="workspace-header-menu">
      <summary ref={menuSummaryRef}>Menu</summary>
      <nav aria-label="Main menu"><button type="button" aria-haspopup="dialog" onClick={(event) => {
        event.currentTarget.closest("details")?.removeAttribute("open");
        setIsSettingsOpen(true);
      }}>Settings</button></nav>
    </details>
    <button type="button" onClick={onLogout} disabled={isLoggingOut} className="workspace-logout">{isLoggingOut ? "Signing out…" : "Logout"}</button>
    {isSettingsOpen && <SettingsPopup onClose={() => {
      setIsSettingsOpen(false);
      window.requestAnimationFrame(() => menuSummaryRef.current?.focus());
    }} />}
  </div>;
}
