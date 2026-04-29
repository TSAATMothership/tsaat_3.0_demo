import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthenticatedSessionFromRequestMock = vi.hoisted(() => vi.fn());
const clearSessionCookieMock = vi.hoisted(() => vi.fn());
const changeAppUserPasswordMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-session", () => ({
  resolveAuthenticatedSessionFromRequest: resolveAuthenticatedSessionFromRequestMock,
  clearSessionCookie: clearSessionCookieMock
}));

vi.mock("@/lib/app-auth", () => ({
  changeAppUserPassword: changeAppUserPasswordMock
}));

import { PUT } from "@/app/api/settings/password/route";

describe("password settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    resolveAuthenticatedSessionFromRequestMock.mockResolvedValueOnce(null);

    const request = new Request("http://localhost/api/settings/password", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        currentPassword: "a",
        newPassword: "b",
        confirmPassword: "b"
      })
    });

    const response = await PUT(request as any);
    expect(response.status).toBe(401);
  });

  it("returns 400 when new password and confirm password differ", async () => {
    resolveAuthenticatedSessionFromRequestMock.mockResolvedValueOnce({
      username: "fileuser",
      sessionVersion: 1
    });

    const request = new Request("http://localhost/api/settings/password", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        currentPassword: "old-password",
        newPassword: "new-password",
        confirmPassword: "different"
      })
    });

    const response = await PUT(request as any);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("must match");
    expect(changeAppUserPasswordMock).not.toHaveBeenCalled();
  });

  it("clears session on successful password change", async () => {
    resolveAuthenticatedSessionFromRequestMock.mockResolvedValueOnce({
      username: "fileuser",
      sessionVersion: 1
    });
    changeAppUserPasswordMock.mockResolvedValueOnce({
      username: "fileuser",
      sessionVersion: 2
    });

    const request = new Request("http://localhost/api/settings/password", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        currentPassword: "old-password",
        newPassword: "new-password-123",
        confirmPassword: "new-password-123"
      })
    });

    const response = await PUT(request as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.requiresReauthentication).toBe(true);
    expect(clearSessionCookieMock).toHaveBeenCalledTimes(1);
  });
});
