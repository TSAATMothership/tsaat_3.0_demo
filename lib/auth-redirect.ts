export function isSafeLoginNextPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && value !== "/login" && !value.startsWith("/login?");
}

export function buildCurrentPath(pathname: string, queryString: string): string {
  const safePathname = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/";
  const trimmedQuery = queryString.trim().replace(/^\?/, "");
  return trimmedQuery ? `${safePathname}?${trimmedQuery}` : safePathname;
}

export function buildLoginRedirectPath(currentPath: string): string {
  const nextPath = isSafeLoginNextPath(currentPath) ? currentPath : "/";
  return `/login?next=${encodeURIComponent(nextPath)}`;
}
