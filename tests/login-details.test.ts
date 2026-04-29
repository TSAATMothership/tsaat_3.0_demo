import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  authenticateLoginDetailsUser,
  changeLoginDetailsPassword,
  loadLoginDetailsFromFile,
  resolveLoginDetailsFilePath,
  saveInitialLoginDetails
} from "@/lib/login-details";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("login details", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tsaat-logindetails-test-"));
    await fs.mkdir(path.join(tempDir, "scripts"), { recursive: true });
    await fs.copyFile(
      path.join(REPO_ROOT, "scripts", "invoke-dpapi.ps1"),
      path.join(tempDir, "scripts", "invoke-dpapi.ps1")
    );
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("writes encrypted credentials and authenticates from logindetails", async () => {
    await saveInitialLoginDetails("AdminUser", "initial-password");

    const raw = await fs.readFile(resolveLoginDetailsFilePath(), "utf-8");
    expect(raw).toContain('"format": "tsaat-logindetails"');
    expect(raw).toContain('"algorithm": "dpapi"');
    expect(raw).not.toContain("AdminUser");
    expect(raw).not.toContain("adminuser");
    expect(raw).not.toContain("initial-password");

    const stored = await loadLoginDetailsFromFile();
    expect(stored?.username).toBe("adminuser");
    expect(stored?.sessionVersion).toBe(1);

    const authenticated = await authenticateLoginDetailsUser("adminuser", "initial-password");
    expect(authenticated).toEqual({
      username: "adminuser",
      sessionVersion: 1
    });

    await expect(authenticateLoginDetailsUser("adminuser", "wrong-password")).resolves.toBeNull();
  });

  it("changes password and increments session version", async () => {
    await saveInitialLoginDetails("adminuser", "initial-password");

    const changed = await changeLoginDetailsPassword("adminuser", "initial-password", "next-password");
    expect(changed).toEqual({
      username: "adminuser",
      sessionVersion: 2
    });

    await expect(authenticateLoginDetailsUser("adminuser", "initial-password")).resolves.toBeNull();
    await expect(authenticateLoginDetailsUser("adminuser", "next-password")).resolves.toEqual({
      username: "adminuser",
      sessionVersion: 2
    });
  });

  it("rejects empty username and password values", async () => {
    await expect(saveInitialLoginDetails("", "valid-password")).rejects.toThrow("Username is required");
    await expect(saveInitialLoginDetails("adminuser", "")).rejects.toThrow("New password must be at least");
  });
});
