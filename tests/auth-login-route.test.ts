import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateAppUserMock = vi.hoisted(() => vi.fn());
const createSessionTokenForUserMock = vi.hoisted(() => vi.fn());
const writeSessionCookieMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/app-auth", () => ({
  authenticateAppUser: authenticateAppUserMock
}));

vi.mock("@/lib/auth-session", () => ({
  createSessionTokenForUser: createSessionTokenForUserMock,
  writeSessionCookie: writeSessionCookieMock
}));

import { POST } from "@/app/api/auth/login/route";

describe("auth login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when username or password is missing", async () => {
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ username: "fileuser", password: "" })
    });

    const response = await POST(request as any);
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 401 when credentials are invalid", async () => {
    authenticateAppUserMock.mockResolvedValueOnce(null);

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ username: "fileuser", password: "wrong-password" })
    });

    const response = await POST(request as any);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.error).toBe("Invalid username or password.");
  });

  it("sets session cookie on successful login", async () => {
    authenticateAppUserMock.mockResolvedValueOnce({
      username: "fileuser",
      sessionVersion: 1
    });
    createSessionTokenForUserMock.mockResolvedValueOnce("signed-token");

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ username: "fileuser", password: "file-password" })
    });

    const response = await POST(request as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.authenticated).toBe(true);
    expect(payload.username).toBe("fileuser");
    expect(writeSessionCookieMock).toHaveBeenCalledTimes(1);
    expect(writeSessionCookieMock.mock.calls[0]?.[1]).toBe("signed-token");
  });
});
