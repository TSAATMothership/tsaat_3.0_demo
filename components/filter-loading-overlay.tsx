"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { buildLocationKey, encodeLocationKeyForAttribute, normalizeQuery } from "@/lib/location-key";

const DEFAULT_MESSAGE = "Applying filters...";
const STALE_OVERLAY_TIMEOUT_MS = 30000;
const ROUTE_READY_POLL_MS = 16;

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

function shouldWaitForRouteReadyMarker(pathname: string): boolean {
  return /^\/networks\/[^/]+$/.test(pathname) || /^\/systems\/[^/]+$/.test(pathname);
}

export function FilterLoadingOverlay() {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const currentLocationKey = buildLocationKey(pathname, (searchParams?.toString() ?? ""));
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startLocationKeyRef = useRef<string | null>(null);
  const targetLocationKeyRef = useRef<string | null>(null);
  const waitForReadyMarkerRef = useRef(false);

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
    if (readyCheckTimeoutRef.current) {
      clearTimeout(readyCheckTimeoutRef.current);
      readyCheckTimeoutRef.current = null;
    }
  }, []);

  const closeOverlay = useCallback(() => {
    clearTimers();
    setIsLoading(false);
    setProgress(0);
    setMessage(DEFAULT_MESSAGE);
    startLocationKeyRef.current = null;
    targetLocationKeyRef.current = null;
    waitForReadyMarkerRef.current = false;
  }, [clearTimers]);

  type StartOverlayOptions = {
    message?: string;
    targetLocationKey?: string;
    waitForReadyMarker?: boolean;
  };

  const startOverlay = useCallback(
    (options: StartOverlayOptions = {}) => {
      clearTimers();
      setIsLoading(true);
      setProgress(0);
      setMessage(options.message || DEFAULT_MESSAGE);
      startLocationKeyRef.current = currentLocationKey;
      targetLocationKeyRef.current = options.targetLocationKey ?? null;
      waitForReadyMarkerRef.current = options.waitForReadyMarker ?? false;

      intervalRef.current = setInterval(() => {
        setProgress((current) => Math.min(96, nextProgressValue(current)));
      }, 85);

      // Guard against stale overlays when navigation does not occur.
      failsafeTimeoutRef.current = setTimeout(() => {
        const liveLocationKey = buildLocationKey(window.location.pathname, window.location.search);
        if (startLocationKeyRef.current && startLocationKeyRef.current === liveLocationKey) {
          closeOverlay();
        }
      }, STALE_OVERLAY_TIMEOUT_MS);
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

    const targetLocationKey = targetLocationKeyRef.current;
    const reachedTarget = targetLocationKey
      ? currentLocationKey === targetLocationKey
      : startLocationKeyRef.current !== currentLocationKey;

    if (!reachedTarget) {
      return;
    }

    const finalizeOverlay = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setProgress(100);
      closeTimeoutRef.current = setTimeout(() => {
        closeOverlay();
      }, 140);
    };

    if (!waitForReadyMarkerRef.current || !targetLocationKey) {
      finalizeOverlay();
      return;
    }

    const routeReadySelector = `[data-route-ready-key="${encodeLocationKeyForAttribute(targetLocationKey)}"]`;
    if (document.querySelector(routeReadySelector)) {
      finalizeOverlay();
      return;
    }

    setProgress((current) => Math.max(current, 97));
    let cancelled = false;
    const waitForRouteReadyMarker = () => {
      if (cancelled) {
        return;
      }
      if (document.querySelector(routeReadySelector)) {
        finalizeOverlay();
        return;
      }
      readyCheckTimeoutRef.current = setTimeout(waitForRouteReadyMarker, ROUTE_READY_POLL_MS);
    };

    waitForRouteReadyMarker();
    return () => {
      cancelled = true;
      if (readyCheckTimeoutRef.current) {
        clearTimeout(readyCheckTimeoutRef.current);
        readyCheckTimeoutRef.current = null;
      }
    };
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

      const currentQuery = normalizeQuery((searchParams?.toString() ?? ""));
      const nextQuery = normalizeQuery(targetUrl.search);
      if (targetUrl.pathname === pathname && currentQuery === nextQuery && targetUrl.hash === window.location.hash) {
        return;
      }

      const targetLocationKey = buildLocationKey(targetUrl.pathname, targetUrl.search);
      startOverlay({
        message: anchor.dataset.filterLoadingMessage || DEFAULT_MESSAGE,
        targetLocationKey,
        waitForReadyMarker: shouldWaitForRouteReadyMarker(targetUrl.pathname)
      });
    };

    const onFilterFormSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || event.defaultPrevented) {
        return;
      }
      if (form.dataset.filterLoading !== "true") {
        return;
      }
      startOverlay({
        message: form.dataset.filterLoadingMessage || DEFAULT_MESSAGE
      });
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
