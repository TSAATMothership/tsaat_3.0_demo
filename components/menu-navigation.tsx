"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MouseEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

export function MenuNavigation({ items }: { items: MenuItem[] }) {
  const pathname = usePathname();

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const closeDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (!isMounted || !isLoading) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isLoading, isMounted]);

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
    if (!isLoading || !pendingHref) {
      return;
    }

    if (pathname !== pendingHref) {
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
      setProgress(0);
      closeDelayRef.current = null;
    }, 120);
  }, [isLoading, pathname, pendingHref]);

  const onMenuClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (isLoading) {
      event.preventDefault();
      return;
    }

    if (href === pathname) {
      event.preventDefault();
      return;
    }

    setIsLoading(true);
    setPendingHref(href);
    setProgress(8);
  };

  return (
    <>
      <nav className="flex flex-wrap items-center gap-2">
        {items.map((item) => {
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
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={(event) => onMenuClick(event, item.href)}
              className={`group flex items-center gap-2 rounded-md border px-3 py-2 text-xs uppercase tracking-[0.13em] transition ${linkClass}`}
            >
              <span>{item.label}</span>
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

      {isMounted && isLoading
        ? createPortal(
            <div className="fixed inset-0 z-[9999] cursor-wait bg-slate-950/90">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(23,48,77,0.9)_0%,rgba(2,6,23,0.9)_68%)]" />
              <div className="absolute left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-sky-300/40 bg-slate-900 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.7)]">
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
