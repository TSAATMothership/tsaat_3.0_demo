"use client";

import { buildLocationKey } from "@/lib/location-key";

export const ROUTE_LOADING_START_EVENT = "tsaat:route-loading:start";
export const ROUTE_LOADING_COMPLETE_EVENT = "tsaat:route-loading:complete";

export interface RouteLoadingStartDetail {
  href?: string;
  message?: string;
  targetLocationKey?: string;
  waitForRouteReady?: boolean;
  documentTransition?: boolean;
}

export function locationKeyForHref(href: string, baseHref?: string): string | null {
  try {
    const targetUrl = new URL(href, baseHref ?? window.location.href);
    return buildLocationKey(targetUrl.pathname, targetUrl.search);
  } catch {
    return null;
  }
}

export function startRouteLoading(detail: RouteLoadingStartDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  const targetLocationKey = detail.targetLocationKey ?? (detail.href ? locationKeyForHref(detail.href) : undefined);
  window.dispatchEvent(
    new CustomEvent<RouteLoadingStartDetail>(ROUTE_LOADING_START_EVENT, {
      detail: {
        ...detail,
        targetLocationKey: targetLocationKey ?? detail.targetLocationKey,
        waitForRouteReady: detail.waitForRouteReady ?? true
      }
    })
  );
}

export function completeRouteLoading(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(ROUTE_LOADING_COMPLETE_EVENT));
}
