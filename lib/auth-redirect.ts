/** Retired login bookmarks may forward only to local, non-login destinations. */
export function legacyLoginDestination(value: string | string[] | undefined): string {
  const requested = Array.isArray(value) ? value[0] : value;
  if (!requested || !requested.startsWith('/') || requested.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(requested)) return '/';
  try {
    const base = new URL('http://tsaat.local');
    const url = new URL(requested, base);
    if (url.origin !== base.origin) return '/';
    let pathname = url.pathname;
    for (let count = 0; count < 4; count++) {
      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) break;
      pathname = decoded;
    }
    if (pathname.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(pathname) || /%(?:25|2f|5c)/i.test(pathname)
      || /^\/login(?:\/|$)/i.test(pathname)) return '/';
    return url.pathname + url.search + url.hash;
  } catch { return '/'; }
}
