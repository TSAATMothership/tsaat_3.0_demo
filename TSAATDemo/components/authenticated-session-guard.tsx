"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { buildCurrentPath, buildLoginRedirectPath } from "@/lib/auth-redirect";
import { isLogoutStorageEvent } from "@/lib/auth-client-events";

export function AuthenticatedSessionGuard() {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString() ?? "";
  const isRedirectingRef = useRef(false);

  useEffect(() => {
    if (pathname === "/login") {
      return;
    }

    const currentPath = buildCurrentPath(pathname, queryString);

    const redirectToLogin = () => {
      if (isRedirectingRef.current) {
        return;
      }
      isRedirectingRef.current = true;
      window.location.replace(buildLoginRedirectPath(currentPath));
    };

    const validateSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-store"
          }
        });
        if (!response.ok) {
          redirectToLogin();
          return;
        }

        const payload = (await response.json()) as { authenticated?: unknown };
        if (payload.authenticated !== true) {
          redirectToLogin();
        }
      } catch {
        redirectToLogin();
      }
    };

    const onFocus = () => {
      void validateSession();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void validateSession();
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (isLogoutStorageEvent(event)) {
        redirectToLogin();
      }
    };

    void validateSession();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname, queryString]);

  return null;
}
