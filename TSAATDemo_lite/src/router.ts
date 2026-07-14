import { useMemo, useSyncExternalStore } from "react";

export interface LogicalLocation {
  pathname: string;
  search: string;
  searchParams: URLSearchParams;
  anchor: string;
  href: string;
}

type NavigationOptions = { scroll?: boolean };
type Listener = () => void;

const listeners = new Set<Listener>();
let revision = 0;
let cachedRevision = -1;
let cachedLocation: LogicalLocation | null = null;

function emitLocationChange(): void {
  revision += 1;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function routeTextFromHash(): string {
  const raw = window.location.hash.slice(1);
  return raw.startsWith("/") ? raw : "/";
}

function parseLogicalLocation(): LogicalLocation {
  const href = routeTextFromHash();
  const parsed = new URL(href, "https://tsaat-demo-lite.local");
  return {
    pathname: parsed.pathname || "/",
    search: parsed.search,
    searchParams: new URLSearchParams(parsed.search),
    anchor: parsed.hash ? decodeURIComponent(parsed.hash.slice(1)) : "",
    href: `${parsed.pathname || "/"}${parsed.search}${parsed.hash}`
  };
}

export function getLogicalLocation(): LogicalLocation {
  if (cachedLocation && cachedRevision === revision) {
    return cachedLocation;
  }
  cachedLocation = parseLogicalLocation();
  cachedRevision = revision;
  return cachedLocation;
}

function normalizeLogicalHref(rawHref: string): string {
  const href = String(rawHref || "/").trim();
  const current = getLogicalLocation();
  if (href.startsWith("#/")) {
    return href.slice(1);
  }
  if (href.startsWith("#")) {
    return `${current.pathname}${current.search}${href}`;
  }
  if (href.startsWith("?")) {
    return `${current.pathname}${href}`;
  }
  try {
    const parsed = new URL(href, `https://tsaat-demo-lite.local${current.pathname}${current.search}`);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/cyber-cop";
  }
}

export function navigate(rawHref: string, replace = false, options: NavigationOptions = {}): void {
  const logicalHref = normalizeLogicalHref(rawHref);
  const previous = getLogicalLocation();
  if (logicalHref === previous.href) {
    emitLocationChange();
    return;
  }

  const baseHref = window.location.href.split("#", 1)[0];
  if (replace) {
    // Chromium gives each file:// document an opaque origin. Calling
    // history.replaceState with the document's full file URL therefore fails
    // its same-origin check in some embedded/local-file contexts, even when
    // only the fragment is changing. Passing just the fragment preserves
    // replace semantics and keeps route notifications synchronous without
    // asking the History API to re-authorise the local file URL.
    if (window.location.protocol === "file:") {
      try {
        window.history.replaceState(null, "", `#${logicalHref}`);
        emitLocationChange();
      } catch {
        window.location.hash = logicalHref;
      }
    } else {
      try {
        window.history.replaceState(null, "", `${baseHref}#${logicalHref}`);
        emitLocationChange();
      } catch {
        window.location.hash = logicalHref;
      }
    }
  } else {
    window.location.hash = logicalHref;
  }

  if (options.scroll !== false && !new URL(logicalHref, "https://tsaat-demo-lite.local").hash) {
    window.scrollTo({ top: 0, left: 0 });
  }
}

export function refreshRoute(): void {
  emitLocationChange();
}

export function ensureInitialRoute(authenticated: boolean): void {
  if (!window.location.hash.startsWith("#/")) {
    navigate(authenticated ? "/cyber-cop" : "/login", true);
  }
}

export function useLogicalLocation(): LogicalLocation {
  return useSyncExternalStore(subscribe, getLogicalLocation, getLogicalLocation);
}

export function usePathname(): string {
  return useLogicalLocation().pathname;
}

export function useSearchParams(): URLSearchParams {
  const { search } = useLogicalLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useRouter() {
  return useMemo(
    () => ({
      push: (href: string, options?: NavigationOptions) => navigate(href, false, options),
      replace: (href: string, options?: NavigationOptions) => navigate(href, true, options),
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      refresh: refreshRoute,
      prefetch: async () => undefined
    }),
    []
  );
}

export class RedirectSignal extends Error {
  constructor(readonly href: string) {
    super(`Redirect to ${href}`);
    this.name = "RedirectSignal";
  }
}

export class NotFoundSignal extends Error {
  constructor() {
    super("Route not found");
    this.name = "NotFoundSignal";
  }
}

export function redirect(href: string): never {
  throw new RedirectSignal(href);
}

export function notFound(): never {
  throw new NotFoundSignal();
}

window.addEventListener("hashchange", emitLocationChange);
window.addEventListener("popstate", emitLocationChange);
