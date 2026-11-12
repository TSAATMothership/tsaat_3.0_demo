"use client";

import { buildLocationKey } from "@/lib/location-key";
import { activeWorkspaceItem, hasWorkspaceScope } from "@/lib/workspace-navigation";

export const ROUTE_LOADING_START_EVENT = "tsaat:route-loading:start";
export const ROUTE_LOADING_COMPLETE_EVENT = "tsaat:route-loading:complete";

export interface RouteLoadingStartDetail {
  href?: string;
  message?: string;
  targetLocationKey?: string;
  waitForRouteReady?: boolean;
  documentTransition?: boolean;
  cancelHref?: string;
}

export function locationKeyForHref(href: string, baseHref?: string): string | null {
  try {
    const targetUrl = new URL(href, baseHref ?? window.location.href);
    return buildLocationKey(targetUrl.pathname, targetUrl.search);
  } catch {
    return null;
  }
}

/** Known workspace pages without an applied scope do not request inventory. */
export function shouldShowRouteLoading(href?: string, baseHref?: string): boolean {
  if (!href) return true;
  try {
    const base = baseHref ?? (typeof window === "undefined" ? "http://localhost/" : window.location.href);
    const target = new URL(href, base);
    if (target.origin !== new URL(base).origin) return true;
    if (target.pathname === "/") return false;
    if (!activeWorkspaceItem(target.pathname, target.searchParams)) return true;
    return hasWorkspaceScope({ network: target.searchParams.getAll("network"), system: target.searchParams.getAll("system") });
  } catch {
    return true;
  }
}

export function startRouteLoading(detail: RouteLoadingStartDetail): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!shouldShowRouteLoading(detail.href ?? detail.targetLocationKey)) return;

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

export function cancelRouteNavigation(returnHref: string): void {
  const target = new URL(returnHref, window.location.href);
  if (target.origin !== window.location.origin) return;
  // App Router has no public abort API. A document replacement abandons the
  // pending navigation, so a late server response cannot open the cancelled view.
  window.stop();
  window.location.replace(target.pathname + target.search + target.hash);
}
