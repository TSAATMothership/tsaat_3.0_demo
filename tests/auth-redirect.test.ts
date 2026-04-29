import { describe, expect, it } from "vitest";
import { buildCurrentPath, buildLoginRedirectPath, isSafeLoginNextPath } from "@/lib/auth-redirect";

describe("auth redirect helpers", () => {
  it("builds current paths with query strings", () => {
    expect(buildCurrentPath("/networks", "dataDate=2026-04-29")).toBe("/networks?dataDate=2026-04-29");
    expect(buildCurrentPath("/systems", "")).toBe("/systems");
  });

  it("rejects unsafe login next paths", () => {
    expect(isSafeLoginNextPath("/networks")).toBe(true);
    expect(isSafeLoginNextPath("//example.com")).toBe(false);
    expect(isSafeLoginNextPath("/login")).toBe(false);
    expect(isSafeLoginNextPath("/login?next=/networks")).toBe(false);
  });

  it("builds login redirects with safe fallback", () => {
    expect(buildLoginRedirectPath("/networks?dataDate=2026-04-29")).toBe(
      "/login?next=%2Fnetworks%3FdataDate%3D2026-04-29"
    );
    expect(buildLoginRedirectPath("//example.com")).toBe("/login?next=%2Fcyber-cop");
  });
});
