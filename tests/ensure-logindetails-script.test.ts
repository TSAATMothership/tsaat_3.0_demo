import { createHash } from "crypto";
import { spawnSync } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authenticateLoginDetailsUser, loadLoginDetailsFromFile } from "@/lib/login-details";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENSURE_SCRIPT = path.join(REPO_ROOT, "scripts", "ensure-logindetails.ps1");

function withCleanTsaatLoginEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("TSAAT_LOGIN_")) {
      delete env[key];
    }
  }
  return { ...env, ...overrides };
}

function runPowerShell(scriptPath: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8",
    input: ""
  });
}

async function runSetupLogin(loginDetailsPath: string, env: NodeJS.ProcessEnv) {
  const manifest = JSON.parse(await fs.readFile(path.join(REPO_ROOT, "package.json"), "utf8"));
  // Exercise the actual npm script entry point, including its configuration switch.
  const [command, ...args] = manifest.scripts["setup:login"].split(" ");
  return spawnSync(command, [...args, "-RepoRoot", REPO_ROOT, "-LoginDetailsPath", loginDetailsPath], {
    cwd: REPO_ROOT, env, encoding: "utf8", input: ""
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function writeUndecryptableLoginDetails(filePath: string) {
  const envelope = {
    format: "tsaat-logindetails",
    version: 1,
    keyProvider: "dpapi-current-user",
    algorithm: "dpapi",
    ciphertextBase64: Buffer.from("not-a-dpapi-payload").toString("base64"),
    updatedAtUtc: "2026-04-29T00:00:00.000Z"
  };
  await fs.writeFile(filePath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
}

describe("ensure-logindetails.ps1", () => {
  let tempDir: string;
  let loginDetailsPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tsaat-ensure-logindetails-"));
    loginDetailsPath = path.join(tempDir, "logindetails");
    await fs.mkdir(path.join(tempDir, "scripts"));
    await fs.copyFile(path.join(REPO_ROOT, "scripts/invoke-dpapi.ps1"), path.join(tempDir, "scripts/invoke-dpapi.ps1"));
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("creates encrypted logindetails from environment values without plaintext credentials", async () => {
    const env = withCleanTsaatLoginEnv({
      TSAAT_LOGIN_USERNAME: "AdminUser",
      TSAAT_LOGIN_PASSWORD: "initial-password"
    });

    const result = runPowerShell(
      ENSURE_SCRIPT,
      ["-RepoRoot", REPO_ROOT, "-LoginDetailsPath", loginDetailsPath],
      env
    );
    expect(result.status).toBe(0);

    const raw = await fs.readFile(loginDetailsPath, "utf8");
    const envelope = JSON.parse(raw.replace(/^\uFEFF/, ""));
    expect(envelope.format).toBe("tsaat-logindetails");
    expect(envelope.algorithm).toBe("dpapi");
    expect(raw).not.toContain("AdminUser");
    expect(raw).not.toContain("adminuser");
    expect(raw).not.toContain("initial-password");
  });

  it("accepts an existing valid logindetails noninteractively without rewriting it", async () => {
    const env = withCleanTsaatLoginEnv({
      TSAAT_LOGIN_USERNAME: "adminuser",
      TSAAT_LOGIN_PASSWORD: "initial-password"
    });
    const createResult = runPowerShell(
      ENSURE_SCRIPT,
      ["-RepoRoot", REPO_ROOT, "-LoginDetailsPath", loginDetailsPath],
      env
    );
    expect(createResult.status).toBe(0);

    const before = await fs.readFile(loginDetailsPath, "utf8");
    const secondResult = runPowerShell(
      ENSURE_SCRIPT,
      ["-RepoRoot", REPO_ROOT, "-LoginDetailsPath", loginDetailsPath],
      withCleanTsaatLoginEnv()
    );
    expect(secondResult.status).toBe(0);

    const after = await fs.readFile(loginDetailsPath, "utf8");
    expect(sha256(after)).toBe(sha256(before));
  });

  it("setup:login creates credentials that the application can use", async () => {
    const result = await runSetupLogin(loginDetailsPath, withCleanTsaatLoginEnv({
      TSAAT_LOGIN_USERNAME: " FirstUser ", TSAAT_LOGIN_PASSWORD: "first-password"
    }));
    expect(result.status, result.stderr).toBe(0);
    await expect(authenticateLoginDetailsUser("FirstUser", "first-password")).resolves.toEqual({
      username: "firstuser", sessionVersion: 1
    });
  });

  it.each(["sql", "json"])("setup:login updates credentials and invalidates old sessions for %s", async provider => {
    vi.stubEnv("TSAAT_DATA_PROVIDER", provider);
    const created = runPowerShell(ENSURE_SCRIPT, ["-RepoRoot", REPO_ROOT, "-LoginDetailsPath", loginDetailsPath],
      withCleanTsaatLoginEnv({ TSAAT_LOGIN_USERNAME: "AdminUser", TSAAT_LOGIN_PASSWORD: "initial-password" }));
    expect(created.status, created.stderr).toBe(0);
    const initial = await loadLoginDetailsFromFile();

    const updated = await runSetupLogin(loginDetailsPath, withCleanTsaatLoginEnv({
      TSAAT_LOGIN_USERNAME: "AdminUser", TSAAT_LOGIN_PASSWORD: "replacement-password"
    }));
    expect(updated.status, updated.stderr).toBe(0);
    expect(updated.stdout).toContain("Updated encrypted logindetails file");
    await expect(authenticateLoginDetailsUser("adminuser", "initial-password")).resolves.toBeNull();
    await expect(authenticateLoginDetailsUser("adminuser", "replacement-password")).resolves.toEqual({
      username: "adminuser", sessionVersion: 2
    });
    const stored = await loadLoginDetailsFromFile();
    expect(stored?.createdAtUtc).toBe(initial?.createdAtUtc);
    expect(stored?.passwordChangedAtUtc).not.toBe(initial?.passwordChangedAtUtc);
    expect(stored?.passwordSalt).not.toEqual(initial?.passwordSalt);

    const renamed = await runSetupLogin(loginDetailsPath, withCleanTsaatLoginEnv({
      TSAAT_LOGIN_USERNAME: " ReplacementUser ", TSAAT_LOGIN_PASSWORD: "renamed-password"
    }));
    expect(renamed.status, renamed.stderr).toBe(0);
    await expect(authenticateLoginDetailsUser("adminuser", "replacement-password")).resolves.toBeNull();
    await expect(authenticateLoginDetailsUser("ReplacementUser", "renamed-password")).resolves.toEqual({
      username: "replacementuser", sessionVersion: 3
    });
    const raw = await fs.readFile(loginDetailsPath, "utf8");
    for (const secret of ["replacementuser", "replacement-password", "renamed-password"]) {
      expect(raw).not.toContain(secret);
      expect(updated.stdout + updated.stderr + renamed.stdout + renamed.stderr).not.toContain(secret);
    }
  });

  it.each([
    {},
    { TSAAT_LOGIN_USERNAME: "newuser" },
    { TSAAT_LOGIN_USERNAME: "newuser", TSAAT_LOGIN_PASSWORD: "short" }
  ])("setup:login preserves existing credentials when input is missing or invalid: %j", async credentials => {
    const created = runPowerShell(ENSURE_SCRIPT, ["-RepoRoot", REPO_ROOT, "-LoginDetailsPath", loginDetailsPath],
      withCleanTsaatLoginEnv({ TSAAT_LOGIN_USERNAME: "adminuser", TSAAT_LOGIN_PASSWORD: "initial-password" }));
    expect(created.status, created.stderr).toBe(0);
    const before = await fs.readFile(loginDetailsPath, "utf8");
    const result = await runSetupLogin(loginDetailsPath, withCleanTsaatLoginEnv(credentials));
    expect(result.status).not.toBe(0);
    expect(await fs.readFile(loginDetailsPath, "utf8")).toBe(before);
    await expect(authenticateLoginDetailsUser("adminuser", "initial-password")).resolves.toEqual({
      username: "adminuser", sessionVersion: 1
    });
  });

  it("recreates an undecryptable logindetails noninteractively when credentials are provided", async () => {
    await writeUndecryptableLoginDetails(loginDetailsPath);
    const before = await fs.readFile(loginDetailsPath, "utf8");

    const env = withCleanTsaatLoginEnv({
      TSAAT_LOGIN_USERNAME: "ReplacementUser",
      TSAAT_LOGIN_PASSWORD: "replacement-password"
    });

    const result = runPowerShell(
      ENSURE_SCRIPT,
      ["-RepoRoot", REPO_ROOT, "-LoginDetailsPath", loginDetailsPath],
      env
    );

    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Recreated encrypted logindetails file");

    const raw = await fs.readFile(loginDetailsPath, "utf8");
    expect(sha256(raw)).not.toBe(sha256(before));
    expect(raw).not.toContain("ReplacementUser");
    expect(raw).not.toContain("replacementuser");
    expect(raw).not.toContain("replacement-password");

    const validateResult = runPowerShell(
      ENSURE_SCRIPT,
      ["-RepoRoot", REPO_ROOT, "-LoginDetailsPath", loginDetailsPath],
      withCleanTsaatLoginEnv()
    );
    expect(validateResult.status).toBe(0);
    expect(validateResult.stdout).toContain("Validated encrypted logindetails file");
  });

  it("fails clearly for an undecryptable logindetails when unattended credentials are incomplete", async () => {
    await writeUndecryptableLoginDetails(loginDetailsPath);

    const result = runPowerShell(
      ENSURE_SCRIPT,
      ["-RepoRoot", REPO_ROOT, "-LoginDetailsPath", loginDetailsPath],
      withCleanTsaatLoginEnv()
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Existing logindetails cannot be decrypted or validated");
    expect(`${result.stdout}\n${result.stderr}`).toMatch(
      /Unattended recreation requires both\s+TSAAT_LOGIN_USERNAME\s+and\s+TSAAT_LOGIN_PASSWORD/
    );
  });

  it("fails clearly when logindetails is missing and noninteractive credentials are incomplete", () => {
    const result = runPowerShell(
      ENSURE_SCRIPT,
      ["-RepoRoot", REPO_ROOT, "-LoginDetailsPath", loginDetailsPath],
      withCleanTsaatLoginEnv()
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Interactive username input is unavailable");
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/TSAAT_LOGIN_USERNAME\s+and\s+TSAAT_LOGIN_PASSWORD/);
  });
});
