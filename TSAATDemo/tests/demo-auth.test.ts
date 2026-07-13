import { describe, expect, it } from "vitest";
import { authenticateAppUser, loadActiveUserSession } from "@/lib/app-auth";

describe("TSAATDemo authentication", () => {
  it("accepts the immutable demo credentials", async () => {
    await expect(authenticateAppUser("demo", "demo123")).resolves.toEqual({
      username: "demo",
      sessionVersion: 1
    });
  });

  it("normalizes the demo username consistently with TSAAT login behavior", async () => {
    await expect(authenticateAppUser("  DEMO  ", "demo123")).resolves.toEqual({
      username: "demo",
      sessionVersion: 1
    });
    await expect(loadActiveUserSession("DEMO")).resolves.toEqual({
      username: "demo",
      sessionVersion: 1
    });
  });

  it("rejects every non-demo credential combination", async () => {
    await expect(authenticateAppUser("demo", "wrong-password")).resolves.toBeNull();
    await expect(authenticateAppUser("other-user", "demo123")).resolves.toBeNull();
    await expect(loadActiveUserSession("other-user")).resolves.toBeNull();
  });
});
