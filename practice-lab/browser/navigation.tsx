import { createContext, useContext, forwardRef } from 'react';
export const BASE = 'https://tsaat.practice.invalid';
export const NavigationContext = createContext('/');
export function currentRoute() { return location.hash.startsWith('#/') ? location.hash.slice(1) : '/'; }
export function navigate(href: string, replace = false) {
  const url = new URL(href.replace(/^#/, ''), BASE);
  if (url.origin !== BASE) throw Error('Practice navigation must stay in this window.');
  const hash = '#' + url.pathname + url.search;
  if (replace || location.hash !== hash) {
    // A Blob document has an opaque origin on file://. History navigation keeps
    // the loaded app alive without trying to load the Blob as a new document.
    if (replace) history.replaceState(null, '', hash); else history.pushState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}
export function usePathname() { return new URL(useContext(NavigationContext), BASE).pathname; }
export function useSearchParams() { return new URL(useContext(NavigationContext), BASE).searchParams; }
const router = { push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true), refresh: () => window.dispatchEvent(new HashChangeEvent('hashchange')), back: () => history.back(), forward: () => history.forward(), prefetch: () => {} };
export function useRouter() { return router; }
export function redirect(href: string) { navigate(href, true); }
export const Link = forwardRef<HTMLAnchorElement, any>(function Link({ href, prefetch, replace, scroll, onClick, ...props }, ref) {
  const target = typeof href === 'string' ? href : href.pathname;
  return <a {...props} ref={ref} href={target.startsWith('/') ? '#' + target : target} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && target.startsWith('/') && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); navigate(target, replace);
    }
  }} />;
});
export default Link;
