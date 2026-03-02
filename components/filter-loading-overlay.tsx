"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";

const DEFAULT_MESSAGE = "Applying filters...";

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

export function FilterLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLocationKey = `${pathname}?${normalizeQuery(searchParams.toString())}`;
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startLocationKeyRef = useRef<string | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (failsafeTimeoutRef.current) {
      clearTimeout(failsafeTimeoutRef.current);
      failsafeTimeoutRef.current = null;
    }
  }, []);

  const closeOverlay = useCallback(() => {
    clearTimers();
    setIsLoading(false);
    setProgress(0);
    setMessage(DEFAULT_MESSAGE);
    startLocationKeyRef.current = null;
  }, [clearTimers]);

  const startOverlay = useCallback(
    (nextMessage?: string) => {
      clearTimers();
      setIsLoading(true);
      setProgress(0);
      setMessage(nextMessage || DEFAULT_MESSAGE);
      startLocationKeyRef.current = currentLocationKey;

      intervalRef.current = setInterval(() => {
        setProgress((current) => Math.min(96, nextProgressValue(current)));
      }, 85);

      // Guard against stale overlays when navigation does not occur.
      failsafeTimeoutRef.current = setTimeout(() => {
        closeOverlay();
      }, 5000);
    },
    [clearTimers, closeOverlay, currentLocationKey]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

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
    if (!isLoading || !startLocationKeyRef.current) {
      return;
    }
    if (startLocationKeyRef.current === currentLocationKey) {
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(100);
    closeTimeoutRef.current = setTimeout(() => {
      closeOverlay();
    }, 140);
  }, [closeOverlay, currentLocationKey, isLoading]);

  useEffect(() => {
    const onFilterLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[data-filter-loading="true"]') as HTMLAnchorElement | null;
      if (!anchor || event.defaultPrevented) {
        return;
      }
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (anchor.target && anchor.target !== "_self") {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      let targetUrl: URL;
      try {
        targetUrl = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (targetUrl.origin !== window.location.origin) {
        return;
      }

      const currentQuery = normalizeQuery(searchParams.toString());
      const nextQuery = normalizeQuery(targetUrl.search);
      if (targetUrl.pathname === pathname && currentQuery === nextQuery && targetUrl.hash === window.location.hash) {
        return;
      }

      startOverlay(anchor.dataset.filterLoadingMessage || DEFAULT_MESSAGE);
    };

    const onFilterFormSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || event.defaultPrevented) {
        return;
      }
      if (form.dataset.filterLoading !== "true") {
        return;
      }
      startOverlay(form.dataset.filterLoadingMessage || DEFAULT_MESSAGE);
    };

    document.addEventListener("click", onFilterLinkClick, true);
    document.addEventListener("submit", onFilterFormSubmit, true);

    return () => {
      document.removeEventListener("click", onFilterLinkClick, true);
      document.removeEventListener("submit", onFilterFormSubmit, true);
    };
  }, [pathname, searchParams, startOverlay]);

  if (!isMounted || !isLoading) {
    return null;
  }

  return createPortal(
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
          <span>{message}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
