import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthenticatedSessionFromRequestMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-session", () => ({
  resolveAuthenticatedSessionFromRequest: resolveAuthenticatedSessionFromRequestMock
}));

import { GET } from "@/app/api/auth/session/route";

describe("auth session route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthenticated state with no-store caching", async () => {
    resolveAuthenticatedSessionFromRequestMock.mockResolvedValueOnce(null);

    const response = await GET(new Request("http://localhost/api/auth/session") as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.authenticated).toBe(false);
  });

  it("returns authenticated state with no-store caching", async () => {
    resolveAuthenticatedSessionFromRequestMock.mockResolvedValueOnce({
      username: "fileuser",
      sessionVersion: 1
    });

    const response = await GET(new Request("http://localhost/api/auth/session") as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload).toEqual({
      authenticated: true,
      username: "fileuser"
    });
  });
});
