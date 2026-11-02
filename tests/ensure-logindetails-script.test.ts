import { createHash } from "crypto";
import { spawnSync } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENSURE_SCRIPT = path.join(REPO_ROOT, "scripts", "ensure-logindetails.ps1");

function withCleanTsaatLoginEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
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
  });

  afterEach(async () => {
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
    expect(`${result.stdout}\n${result.stderr}`).toContain("logindetails is missing");
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/TSAAT_LOGIN_USERNAME\s+and\s+TSAAT_LOGIN_PASSWORD/);
  });
});
