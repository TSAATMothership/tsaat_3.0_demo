import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { middleware } from "@/middleware";

function sessionResponse(payload: object, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

describe("auth middleware", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects unauthenticated page requests to login with next path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse({ authenticated: false }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await middleware(new NextRequest("http://localhost/networks?dataDate=2026-04-29"));
    const location = response.headers.get("location") ?? "";

    expect(response.status).toBe(307);
    expect(decodeURIComponent(location)).toBe("http://localhost/login?next=/networks?dataDate=2026-04-29");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 401 for unauthenticated protected API requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sessionResponse({ authenticated: false })));

    const response = await middleware(new NextRequest("http://localhost/api/findings/export?format=json"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Authentication required.");
  });

  it("redirects authenticated login requests to safe next path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sessionResponse({ authenticated: true, username: "fileuser" }))
    );

    const request = new NextRequest("http://localhost/login?next=/systems", {
      headers: {
        cookie: "tsaat_session=signed-token"
      }
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/systems");
  });

  it("falls back when authenticated login next path is unsafe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sessionResponse({ authenticated: true, username: "fileuser" }))
    );

    const request = new NextRequest("http://localhost/login?next=//example.com", {
      headers: {
        cookie: "tsaat_session=signed-token"
      }
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/cyber-cop");
  });
});
