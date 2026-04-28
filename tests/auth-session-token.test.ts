import { describe, expect, it } from "vitest";
import {
  buildSessionPayload,
  createSignedSessionToken,
  verifySignedSessionToken
} from "@/lib/auth-session-token";

describe("auth session token", () => {
  it("creates and verifies a valid signed token", async () => {
    const secret = "this-is-a-long-test-secret-value-1234567890";
    const payload = buildSessionPayload({
      username: "tsaatuser",
      sessionVersion: 3,
      nowEpochSeconds: 1_710_000_000,
      lifetimeSeconds: 3600
    });

    const token = await createSignedSessionToken(payload, secret);
    const verified = await verifySignedSessionToken(token, secret, 1_710_000_100);

    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe("tsaatuser");
    expect(verified?.sv).toBe(3);
  });

  it("rejects tampered tokens", async () => {
    const secret = "this-is-a-long-test-secret-value-1234567890";
    const payload = buildSessionPayload({
      username: "tsaatuser",
      sessionVersion: 1,
      nowEpochSeconds: 1_710_000_000,
      lifetimeSeconds: 3600
    });

    const token = await createSignedSessionToken(payload, secret);
    const [payloadPart] = token.split(".");
    const tampered = `${payloadPart}.invalid-signature`;

    const verified = await verifySignedSessionToken(tampered, secret, 1_710_000_100);
    expect(verified).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const secret = "this-is-a-long-test-secret-value-1234567890";
    const payload = buildSessionPayload({
      username: "tsaatuser",
      sessionVersion: 1,
      nowEpochSeconds: 1_710_000_000,
      lifetimeSeconds: 60
    });

    const token = await createSignedSessionToken(payload, secret);
    const verified = await verifySignedSessionToken(token, secret, 1_710_000_061);
    expect(verified).toBeNull();
  });
});
