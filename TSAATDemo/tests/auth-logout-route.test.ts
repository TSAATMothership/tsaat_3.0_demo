import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/logout/route";

describe("auth logout route", () => {
  it("clears session cookie and disables caching", async () => {
    const response = await POST();
    const payload = await response.json();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.authenticated).toBe(false);
    expect(setCookie).toContain("tsaat_session=");
    expect(setCookie).toContain("Max-Age=0");
  });
});
