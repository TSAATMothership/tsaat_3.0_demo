"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DATA_DATE_PARAM,
  extractHrefPathname,
  isDataDateScopedPath,
  normalizeDataDate,
  todayDateKey,
  withDataDate
} from "@/lib/data-date";

interface MenuItem {
  href: string;
  label: string;
}

function isMenuItemActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function nextProgressValue(current: number): number {
  if (current >= 92) {
    return current + 1;
  }
  if (current >= 78) {
    return current + 2;
  }
  if (current >= 55) {
    return current + 3;
  }
  return current + 5;
}

function normalizeQuery(query: string): string {
  const params = new URLSearchParams(query);
  return Array.from(params.entries())
    .sort(([aKey, aValue], [bKey, bValue]) => {
      if (aKey === bKey) {
        return aValue.localeCompare(bValue);
      }
      return aKey.localeCompare(bKey);
    })
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

const operationsMenuItems: MenuItem[] = [
  { href: "/discovery-coverage", label: "Discovery" },
  { href: "/measures", label: "Measures" },
  { href: "/findings", label: "Findings Register" },
  { href: "/report", label: "Briefs & Reports" },
  { href: "/settings", label: "Settings" }
];

export function MenuNavigation({ items }: { items: MenuItem[] }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pendingPathname, setPendingPathname] = useState<string | null>(null);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isOperationsMenuOpen, setIsOperationsMenuOpen] = useState(false);
  const [cachedDataDate, setCachedDataDate] = useState<string>(todayDateKey());

  const closeDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const showDataDatePicker = isDataDateScopedPath(pathname);
  const queryDataDate = normalizeDataDate(searchParams?.get(DATA_DATE_PARAM));
  const selectedDataDate = useMemo(() => {
    if (queryDataDate) {
      return queryDataDate;
    }
    return showDataDatePicker ? todayDateKey() : cachedDataDate;
  }, [cachedDataDate, queryDataDate, showDataDatePicker]);

  useEffect(() => {
    if (queryDataDate) {
      setCachedDataDate(queryDataDate);
    }
  }, [queryDataDate]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (closeDelayRef.current) {
        clearTimeout(closeDelayRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOperationsMenuOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOperationsMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOperationsMenuOpen]);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    progressIntervalRef.current = setInterval(() => {
      setProgress((current) => Math.min(96, nextProgressValue(current)));
    }, 85);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading || !pendingPathname) {
      return;
    }

    if (pathname !== pendingPathname) {
      return;
    }

    if (pendingQuery !== null && normalizeQuery((searchParams?.toString() ?? "")) !== pendingQuery) {
      return;
    }

    setProgress(100);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    closeDelayRef.current = setTimeout(() => {
      setIsLoading(false);
      setPendingHref(null);
      setPendingPathname(null);
      setPendingQuery(null);
      setProgress(0);
      closeDelayRef.current = null;
    }, 120);
  }, [isLoading, pathname, pendingPathname, pendingQuery, searchParams]);

  const onMenuClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const targetPathname = extractHrefPathname(href);
    const targetQuery = normalizeQuery(new URL(href, "http://localhost").searchParams.toString());

    if (isLoading) {
      event.preventDefault();
      return;
    }

    if (targetPathname === pathname) {
      event.preventDefault();
      return;
    }

    setIsOperationsMenuOpen(false);
    setIsLoading(true);
    setPendingHref(href);
    setPendingPathname(targetPathname);
    setPendingQuery(targetQuery);
    setProgress(8);
  };

  const onDataDateChange = (nextDataDate: string) => {
    if (isLoading) {
      return;
    }

    const nextParams = new URLSearchParams((searchParams?.toString() ?? ""));
    const normalizedDataDate = normalizeDataDate(nextDataDate);

    if (normalizedDataDate) {
      nextParams.set(DATA_DATE_PARAM, normalizedDataDate);
      setCachedDataDate(normalizedDataDate);
    } else {
      nextParams.delete(DATA_DATE_PARAM);
    }

    const query = nextParams.toString();
    const normalizedNextQuery = normalizeQuery(query);
    const normalizedCurrentQuery = normalizeQuery((searchParams?.toString() ?? ""));
    if (normalizedNextQuery === normalizedCurrentQuery) {
      return;
    }

    setIsOperationsMenuOpen(false);
    setIsLoading(true);
    setPendingHref(query ? `${pathname}?${query}` : pathname);
    setPendingPathname(pathname);
    setPendingQuery(normalizedNextQuery);
    setProgress(8);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const onOpenDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) {
      return;
    }

    const inputWithPicker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof inputWithPicker.showPicker === "function") {
      inputWithPicker.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  const onToggleOperationsMenu = () => {
    if (isLoading) {
      return;
    }
    setIsOperationsMenuOpen((current) => !current);
  };

  const onOperationsMenuLinkClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    setIsOperationsMenuOpen(false);
    onMenuClick(event, href);
  };

  return (
    <>
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <nav className="flex min-w-0 max-w-full flex-nowrap items-center justify-end gap-1.5">
          {items.map((item) => {
            const href = isDataDateScopedPath(item.href)
              ? withDataDate(item.href, selectedDataDate)
              : item.href;
            const isActive = isMenuItemActive(pathname, item.href);
            const isCyberCop = item.href === "/cyber-cop";
            const linkClass = isActive
              ? isCyberCop
                ? "menu-cyber-cop-neo menu-cyber-cop-neo-active border-rose-400/80 bg-rose-500/12 text-rose-50"
                : "menu-active-link border-cyan-300/70 bg-cyan-500/10 text-cyan-50"
              : isCyberCop
                ? "menu-cyber-cop-neo border-rose-400/35 bg-rose-950/30 text-rose-100 hover:border-rose-300/60 hover:bg-rose-900/40"
                : "border-sky-400/20 bg-slate-900/40 text-slate-100 hover:border-sky-300/50 hover:bg-slate-800/70";

            return (
              <Link
                key={item.href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                onClick={(event) => onMenuClick(event, href)}
                className={`group flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[11px] uppercase tracking-[0.1em] transition ${linkClass}`}
              >
                <span className="whitespace-nowrap">{item.label}</span>
                {isActive ? (
                  <span
                    aria-hidden
                    className={`menu-active-dot ${isCyberCop ? "menu-active-dot-red" : ""}`}
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 justify-self-end flex items-center gap-2">
          {showDataDatePicker ? (
            <label className="flex items-center gap-2 rounded-md border border-sky-300/30 bg-slate-950/60 px-3 py-2 text-[11px] uppercase tracking-[0.13em] text-slate-200">
              <span className="text-slate-300/85">Date</span>
              <span className="relative">
                <input
                  ref={dateInputRef}
                  type="date"
                  value={selectedDataDate}
                  onChange={(event) => onDataDateChange(event.target.value)}
                  className="date-picker-calendar-white appearance-none rounded border border-sky-300/35 bg-slate-900 px-2 py-1 pr-8 text-xs normal-case tracking-normal text-slate-100 outline-none transition focus:border-sky-200/70"
                  aria-label="Data date"
                />
                <button
                  type="button"
                  onClick={onOpenDatePicker}
                  aria-label="Open calendar"
                  className="absolute inset-y-0 right-1 flex items-center justify-center px-1 text-slate-100"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
              </span>
            </label>
          ) : null}

          <button
            type="button"
            onClick={onToggleOperationsMenu}
            aria-expanded={isOperationsMenuOpen}
            aria-label="Open menu"
            className="group flex h-[38px] items-center gap-2 rounded-md border border-sky-300/35 bg-slate-950/70 px-3 text-[11px] uppercase tracking-[0.12em] text-slate-100 transition hover:border-sky-200/70 hover:bg-slate-900/90"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-sky-100" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
            <span>Menu</span>
          </button>
        </div>
      </div>

      {isMounted
        ? createPortal(
            <div
              className={`fixed inset-0 z-[9000] transition-opacity duration-300 ${
                isOperationsMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <button
                type="button"
                onClick={() => setIsOperationsMenuOpen(false)}
                aria-label="Close operations menu"
                className="absolute inset-0 bg-slate-950/55"
              />

              <aside
                className={`absolute right-0 top-0 h-full w-[min(380px,92vw)] border-l border-sky-300/35 bg-slate-950/95 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.65)] backdrop-blur-md transition-transform duration-300 ease-out ${
                  isOperationsMenuOpen ? "translate-x-0" : "translate-x-full"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Menu Options</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOperationsMenuOpen(false)}
                    className="rounded border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/70"
                  >
                    Close
                  </button>
                </div>

                <nav className="mt-5 flex flex-col gap-2">
                  {operationsMenuItems.map((item) => {
                    const href = isDataDateScopedPath(item.href) ? withDataDate(item.href, selectedDataDate) : item.href;
                    const isActive = isMenuItemActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={href}
                        aria-current={isActive ? "page" : undefined}
                        onClick={(event) => onOperationsMenuLinkClick(event, href)}
                        className={`flex items-center justify-between rounded-md border px-3 py-3 text-sm tracking-[0.02em] transition ${
                          isActive
                            ? "border-cyan-300/70 bg-cyan-500/15 text-cyan-50"
                            : "border-sky-400/30 bg-slate-900/65 text-slate-100 hover:border-sky-300/60 hover:bg-slate-800/75"
                        }`}
                      >
                        <span>{item.label}</span>
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    );
                  })}
                </nav>

                {showDataDatePicker ? (
                  <p className="mt-5 text-xs text-slate-300/80">
                    Date-scoped pages in this menu will use the selected data date.
                  </p>
                ) : null}
              </aside>
            </div>,
            document.body
          )
        : null}

      {isMounted && isLoading
        ? createPortal(
            <div className="fixed inset-0 z-[9999] cursor-wait bg-slate-950/60">
              <div className="absolute left-1/2 top-1/2 w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-sky-300/35 bg-slate-900 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.7)]">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-200">Loading</p>
                  <p className="mt-1 text-2xl font-semibold text-sky-100">{progress}%</p>
                </div>
                <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-sky-300 transition-[width] duration-75 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-5 flex items-center justify-center gap-3 text-xs text-slate-200">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-cyan-100" />
                  <span>Opening {pendingHref ?? "selected page"}...</span>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
