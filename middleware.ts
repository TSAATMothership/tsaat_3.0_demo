import { NextRequest, NextResponse } from "next/server";

interface SessionState {
  authenticated: boolean;
  username?: string;
}

const PUBLIC_PAGE_PATHS = new Set<string>(["/login"]);
const PUBLIC_API_PATHS = new Set<string>(["/api/auth/login", "/api/auth/logout", "/api/auth/session"]);

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PAGE_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname);
}

function isSafeRelativePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

function nextWithRequestHeaders(request: NextRequest, authUsername?: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tsaat-pathname", request.nextUrl.pathname);
  if (authUsername) {
    requestHeaders.set("x-tsaat-auth-user", authUsername);
  } else {
    requestHeaders.delete("x-tsaat-auth-user");
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

function unauthenticatedResponse(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  if (isApiPath(pathname)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const redirectUrl = request.nextUrl.clone();
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  redirectUrl.pathname = "/login";
  redirectUrl.search = "";
  redirectUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(redirectUrl);
}

async function resolveSessionState(request: NextRequest): Promise<SessionState> {
  const sessionUrl = request.nextUrl.clone();
  sessionUrl.pathname = "/api/auth/session";
  sessionUrl.search = "";

  const response = await fetch(sessionUrl, {
    method: "GET",
    headers: {
      cookie: request.headers.get("cookie") ?? ""
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return { authenticated: false };
  }

  const payload = (await response.json()) as { authenticated?: unknown; username?: unknown };
  if (payload.authenticated === true && typeof payload.username === "string" && payload.username.trim()) {
    return {
      authenticated: true,
      username: payload.username.trim()
    };
  }

  return { authenticated: false };
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/api/auth/session") {
    return nextWithRequestHeaders(request);
  }

  if (isPublicPath(pathname)) {
    if (pathname !== "/login") {
      return nextWithRequestHeaders(request);
    }

    const hasCookie = Boolean(request.cookies.get("tsaat_session")?.value);
    if (!hasCookie) {
      return nextWithRequestHeaders(request);
    }

    const session = await resolveSessionState(request);
    if (!session.authenticated || !session.username) {
      return nextWithRequestHeaders(request);
    }

    const requestedNext = request.nextUrl.searchParams.get("next");
    const redirectTarget = requestedNext && isSafeRelativePath(requestedNext) && requestedNext !== "/login"
      ? requestedNext
      : "/cyber-cop";
    return NextResponse.redirect(new URL(redirectTarget, request.url));
  }

  const session = await resolveSessionState(request);
  if (!session.authenticated || !session.username) {
    return unauthenticatedResponse(request);
  }

  return nextWithRequestHeaders(request, session.username);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|map)$).*)"]
};
