import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const decrypt = vi.fn();
  const execFile = Object.assign(vi.fn(), { [Symbol.for("nodejs.util.promisify.custom")]: decrypt });
  return { decrypt, execFile, readFile: vi.fn() };
});
vi.mock("child_process", () => ({ execFile: mocks.execFile }));
vi.mock("fs", () => ({ existsSync: () => true, promises: { readFile: mocks.readFile } }));

function envelope(ciphertext = "first") {
  return JSON.stringify({ format: "tsaat-db-config", version: 1, keyProvider: "dpapi-current-user", algorithm: "dpapi",
    ciphertextBase64: Buffer.from(ciphertext).toString("base64"), updatedAtUtc: "2026-10-31T00:00:00.000Z" });
}

function decrypted(password = "test-password") {
  return { stdout: Buffer.from(JSON.stringify({ server: "localhost", database: "TSAAT", authMode: "sql",
    userId: "test-user", password, sslEnabled: true, sslType: "strict" })).toString("base64"), stderr: "" };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.readFile.mockReset().mockResolvedValue(envelope());
  mocks.decrypt.mockReset().mockResolvedValue(decrypted());
});
afterEach(() => vi.restoreAllMocks());

describe("encrypted database configuration cache", () => {
  it("decrypts concurrent and repeated reads once while isolating returned settings", async () => {
    const { loadDatabaseConnectionSettingsFromFile: load } = await import("@/lib/db-config");
    const results = await Promise.all(Array.from({ length: 20 }, () => load()));
    expect(mocks.decrypt).toHaveBeenCalledTimes(1);
    expect(results.every((settings) => settings?.password === "test-password")).toBe(true);
    results[0]!.password = "changed-by-caller";
    expect((await load())?.password).toBe("test-password");
    expect(mocks.decrypt).toHaveBeenCalledTimes(1);
    expect(mocks.readFile).toHaveBeenCalledTimes(21);
  });

  it("immediately reloads externally replaced contents and forgets deleted files", async () => {
    const { loadDatabaseConnectionSettingsFromFile: load } = await import("@/lib/db-config");
    expect((await load())?.password).toBe("test-password");
    mocks.readFile.mockResolvedValue(envelope("replacement"));
    mocks.decrypt.mockResolvedValue(decrypted("replacement-password"));
    expect((await load())?.password).toBe("replacement-password");
    expect(mocks.decrypt).toHaveBeenCalledTimes(2);
    mocks.readFile.mockRejectedValueOnce(Object.assign(new Error("Missing file"), { code: "ENOENT" }));
    expect(await load()).toBeNull();
    expect((await load())?.password).toBe("replacement-password");
    expect(mocks.decrypt).toHaveBeenCalledTimes(3);
  });

  it("retries a failed decryption rather than keeping a rejected promise", async () => {
    const { loadDatabaseConnectionSettingsFromFile: load } = await import("@/lib/db-config");
    mocks.decrypt.mockRejectedValueOnce(new Error("DPAPI unavailable"));
    await expect(load()).rejects.toThrow("Failed to decrypt database config");
    expect((await load())?.password).toBe("test-password");
    expect(mocks.decrypt).toHaveBeenCalledTimes(2);
  });

  it("does not reuse settings across different configuration paths", async () => {
    const { loadDatabaseConnectionSettingsFromFile: load } = await import("@/lib/db-config");
    const originalCwd = process.cwd();
    await load();
    vi.spyOn(process, "cwd").mockReturnValue(`${originalCwd}/another-app`);
    await load();
    expect(mocks.decrypt).toHaveBeenCalledTimes(2);
  });
});
