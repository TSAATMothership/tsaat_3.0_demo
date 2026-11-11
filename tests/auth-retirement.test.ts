import React, { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { legacyLoginDestination } from "@/lib/auth-redirect";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as session } from "@/app/api/auth/session/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { PUT as password } from "@/app/api/settings/password/route";
import LoginPage from "@/app/login/page";
import SettingsPage from "@/app/settings/page";
import { SettingsRoutePopup } from "@/components/settings-route-popup";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }) }));
beforeEach(() => { vi.stubGlobal("React", React); vi.clearAllMocks(); });
afterEach(() => vi.unstubAllGlobals());

describe("Retired login compatibility", () => {
  it.each([undefined, "", "https://example.org", "//example.org", "/\\example.org", "/%5cexample.org", "/%2fexample.org", "/%252fexample.org",
    "/login", "/login?next=/login", "/%6cogin/", "/%", "/\n/example.org", "/%0d%0aLocation:example.org", "/foo/../login"])("rejects unsafe or looping destination %s", value => {
    expect(legacyLoginDestination(value)).toBe("/");
  });
  it("retains safe scope, domain, snapshot and view parameters from old bookmarks", () => {
    const target = "/cyber-cop?copView=impact&network=net-1&securityDomain=SECRET&dataDate=2026-11-04#selection";
    expect(legacyLoginDestination(target)).toBe(target);
    expect(legacyLoginDestination([target, "//example.org"])).toBe(target);
    expect(() => LoginPage({ searchParams: { next: target } })).toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(target);
  });
  it("opens the workspace for a plain login bookmark", () => {
    expect(() => LoginPage({ searchParams: {} })).toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/");
  });
  it("retires credential and password endpoints without creating sessions", async () => {
    for (const response of [await login(), await password()]) {
      expect(response.status).toBe(410);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.has("set-cookie")).toBe(false);
      expect(await response.json()).toHaveProperty("error");
    }
  });
  it("reports that authentication is not required without inventing an authenticated identity", async () => {
    const response = await session();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(await response.json()).toEqual({ authenticationRequired: false, authenticated: false });
  });
  it("lets old logout clients clear the obsolete cookie", async () => {
    const response = await logout();
    expect(response.headers.get("set-cookie")).toContain("tsaat_session=;");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).toContain("Path=/");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each(["password-settings", "database-settings", "invalid", undefined])("falls back to Personas for retired or missing tab %s", async settingsTab => {
    const page = await SettingsPage({ searchParams: { settingsTab, network: "net-1", dataDate: "2026-11-04" } });
    const popup = (page.props.children as ReactElement[]).find(child => child.type === SettingsRoutePopup)!;
    expect(popup.props.initialTab).toBe("personas");
  });
});
