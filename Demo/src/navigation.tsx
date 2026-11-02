import React, { forwardRef, useSyncExternalStore } from "react";
let revision = 0;
const listeners = new Set<() => void>();
function changed() { revision++; listeners.forEach(listener => listener()); }
if (typeof window !== "undefined") window.addEventListener("hashchange", changed);
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useLocationVersion() { return useSyncExternalStore(subscribe, () => revision, () => 0); }
export function currentUrl() { return new URL(window.location.hash.slice(1) || "/measures", "https://demo.local"); }
export function demoHref(href: string) {
  if (!href.startsWith("/")) return href;
  return window.location.href.split("#")[0] + "#" + href;
}
export const router = {
  push(href: string, _options?: { scroll?: boolean }) { window.location.hash = href.startsWith("#") ? href : "#" + href; },
  replace(href: string, _options?: { scroll?: boolean }) { window.history.replaceState(null, "", demoHref(href)); changed(); },
  refresh() { changed(); },
  back() { window.history.back(); },
  forward() { window.history.forward(); },
  prefetch() { return Promise.resolve(); }
};
export function useRouter() { return router; }
export function usePathname() { useLocationVersion(); return currentUrl().pathname; }
export function useSearchParams() { useLocationVersion(); return currentUrl().searchParams; }
export function redirect(href: string): never { router.replace(href); throw new Error("Navigation redirected"); }
export function notFound(): never { throw new Error("This page is not available in the demo."); }
type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string; query?: Record<string, string> }; prefetch?: boolean; scroll?: boolean; replace?: boolean;
};
const Link = forwardRef<HTMLAnchorElement, LinkProps>(function DemoLink({ href, prefetch: _prefetch, scroll: _scroll, replace: _replace, ...props }, ref) {
  const path = typeof href === "string" ? href : (href.pathname ?? "") + "?" + new URLSearchParams(href.query).toString();
  return <a {...props} ref={ref} href={demoHref(path)} />;
});
export default Link;
