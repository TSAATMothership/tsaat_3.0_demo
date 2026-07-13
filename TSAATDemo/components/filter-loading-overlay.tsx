"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { buildLocationKey, encodeLocationKeyForAttribute, normalizeQuery } from "@/lib/location-key";
import { DEFAULT_LOADING_INITIAL_PROGRESS, DEFAULT_LOADING_MESSAGE, LoadingOverlay, nextLoadingProgressValue } from "@/components/loading-overlay";
import {
  ROUTE_LOADING_COMPLETE_EVENT,
  ROUTE_LOADING_START_EVENT,
  type RouteLoadingStartDetail
} from "@/lib/route-loading";

const STALE_OVERLAY_TIMEOUT_MS = 30000;
const ROUTE_READY_POLL_MS = 16;

function hasRouteReadyMarker(locationKey: string): boolean {
  const routeReadySelector = `[data-route-ready-key="${encodeLocationKeyForAttribute(locationKey)}"]`;
  return Boolean(document.querySelector(routeReadySelector));
}

function targetLocationKeyForForm(form: HTMLFormElement): string | null {
  const method = (form.method || "get").toLowerCase();
  if (method !== "get") {
    return null;
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(form.getAttribute("action") || window.location.href, window.location.href);
  } catch {
    return null;
  }

  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value === "string") {
      params.append(key, value);
    }
  }
  targetUrl.search = params.toString();
  return buildLocationKey(targetUrl.pathname, targetUrl.search);
}

export function FilterLoadingOverlay() {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const currentLocationKey = buildLocationKey(pathname, (searchParams?.toString() ?? ""));
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(DEFAULT_LOADING_MESSAGE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startLocationKeyRef = useRef<string | null>(null);
  const targetLocationKeyRef = useRef<string | null>(null);
  const waitForReadyMarkerRef = useRef(true);
  const documentTransitionRef = useRef(false);

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
    setMessage(DEFAULT_LOADING_MESSAGE);
    startLocationKeyRef.current = null;
    targetLocationKeyRef.current = null;
    waitForReadyMarkerRef.current = true;
    documentTransitionRef.current = false;
  }, [clearTimers]);

  type StartOverlayOptions = {
    message?: string;
    targetLocationKey?: string;
    waitForReadyMarker?: boolean;
    documentTransition?: boolean;
  };

  const startOverlay = useCallback(
    (options: StartOverlayOptions = {}) => {
      clearTimers();
      setIsLoading(true);
      setProgress(DEFAULT_LOADING_INITIAL_PROGRESS);
      setMessage(options.message || DEFAULT_LOADING_MESSAGE);
      startLocationKeyRef.current = currentLocationKey;
      targetLocationKeyRef.current = options.targetLocationKey ?? null;
      waitForReadyMarkerRef.current = options.waitForReadyMarker ?? true;
      documentTransitionRef.current = options.documentTransition ?? false;

      intervalRef.current = setInterval(() => {
        setProgress((current) => Math.min(96, nextLoadingProgressValue(current)));
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
    const onRouteLoadingStart = (event: Event) => {
      const detail = (event as CustomEvent<RouteLoadingStartDetail>).detail ?? {};
      startOverlay({
        message: detail.message,
        targetLocationKey: detail.targetLocationKey,
        waitForReadyMarker: detail.waitForRouteReady,
        documentTransition: detail.documentTransition
      });
    };

    const onRouteLoadingComplete = () => {
      if (!isLoading) {
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
    };

    window.addEventListener(ROUTE_LOADING_START_EVENT, onRouteLoadingStart);
    window.addEventListener(ROUTE_LOADING_COMPLETE_EVENT, onRouteLoadingComplete);

    return () => {
      window.removeEventListener(ROUTE_LOADING_START_EVENT, onRouteLoadingStart);
      window.removeEventListener(ROUTE_LOADING_COMPLETE_EVENT, onRouteLoadingComplete);
    };
  }, [closeOverlay, isLoading, startOverlay]);

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

    if (documentTransitionRef.current) {
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

    if (!waitForReadyMarkerRef.current) {
      finalizeOverlay();
      return;
    }

    const readyLocationKey = targetLocationKey ?? currentLocationKey;
    if (hasRouteReadyMarker(readyLocationKey)) {
      finalizeOverlay();
      return;
    }

    setProgress((current) => Math.max(current, 97));
    let cancelled = false;
    const waitForRouteReadyMarker = () => {
      if (cancelled) {
        return;
      }
      if (hasRouteReadyMarker(readyLocationKey)) {
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
      if (targetUrl.pathname === pathname && currentQuery === nextQuery) {
        return;
      }

      const targetLocationKey = buildLocationKey(targetUrl.pathname, targetUrl.search);
      startOverlay({
        message: anchor.dataset.filterLoadingMessage || DEFAULT_LOADING_MESSAGE,
        targetLocationKey,
        waitForReadyMarker: true
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
        message: form.dataset.filterLoadingMessage || DEFAULT_LOADING_MESSAGE,
        targetLocationKey: targetLocationKeyForForm(form) ?? undefined,
        waitForReadyMarker: true
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
    <LoadingOverlay progress={progress} message={message} />,
    document.body
  );
}
