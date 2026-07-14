import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { navigate } from "../router";

type UrlObject = {
  pathname?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  hash?: string;
};

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | UrlObject;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
  shallow?: boolean;
  legacyBehavior?: boolean;
};

function hrefText(href: string | UrlObject): string {
  if (typeof href === "string") {
    return href;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(href.query ?? {})) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  const hash = href.hash ? (href.hash.startsWith("#") ? href.hash : `#${href.hash}`) : "";
  return `${href.pathname ?? "/"}${query ? `?${query}` : ""}${hash}`;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, replace = false, scroll = true, prefetch: _prefetch, shallow: _shallow, legacyBehavior: _legacy, onClick, ...props },
  ref
) {
  const logicalHref = hrefText(href);
  const renderedHref = logicalHref.startsWith("/") && !logicalHref.startsWith("/api/") ? `#${logicalHref}` : logicalHref;
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (props.target && props.target !== "_self") {
      return;
    }
    event.preventDefault();
    if (logicalHref.startsWith("/api/")) {
      void globalThis.__TSAAT_DOWNLOAD_API__(logicalHref);
      return;
    }
    navigate(logicalHref, replace, { scroll });
  };

  // Keep the native anchor destination inside the standalone document too.
  // This makes modifier-click, open-in-new-tab, and browser fallback behaviour
  // file:// safe even when React's normal click handler is bypassed.
  return <a {...props} ref={ref} href={renderedHref} onClick={handleClick} />;
});

export default Link;
