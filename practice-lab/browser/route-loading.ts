import { BASE, navigate } from './navigation';
export function locationKeyForHref(href: string) {
  const hash = href.indexOf('#/');
  const url = new URL(hash >= 0 ? href.slice(hash + 1) : href, BASE);
  return url.pathname + url.search;
}
// Route readiness and errors are owned by the browser shell, not the Next server.
export function startRouteLoading() {}
export function completeRouteLoading() {}
export function cancelRouteNavigation(href: string) { navigate(href, true); }
