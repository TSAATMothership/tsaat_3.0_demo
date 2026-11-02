import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { spawnSync } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENSURE_SCRIPT = path.join(REPO_ROOT, "scripts", "ensure-db-config.ps1");
const EMIT_SCRIPT = path.join(REPO_ROOT, "scripts", "emit-db-config-env.ps1");

function withCleanTsaatEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("TSAAT_SQL_") || key.startsWith("TSAAT_DB_CONFIG_") || key === "TSAAT_APP_DATABASE") {
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

async function writeUndecryptableDbConfig(filePath: string) {
  const envelope = {
    format: "tsaat-db-config",
    version: 1,
    keyProvider: "dpapi-current-user",
    algorithm: "dpapi",
    ciphertextBase64: Buffer.from("not-a-dpapi-payload").toString("base64"),
    updatedAtUtc: "2026-04-29T00:00:00.000Z"
  };
  await fs.writeFile(filePath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
}

describe("ensure-db-config.ps1", () => {
  let tempDir: string;
  let dbConfigPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tsaat-ensure-db-config-"));
    dbConfigPath = path.join(tempDir, "DB_config");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("creates encrypted DB_config from environment values without plaintext password", async () => {
    const env = withCleanTsaatEnv({
      TSAAT_DB_CONFIG_ASSUME_YES: "true",
      TSAAT_SQL_SERVER: "localhost\\SQLEXPRESS",
      TSAAT_APP_DATABASE: "TSAAT",
      TSAAT_SQL_USER: "tsaat_sql_user",
      TSAAT_SQL_PASSWORD: "super-secret",
      TSAAT_SQL_ENCRYPT: "true",
      TSAAT_SQL_TRUST_SERVER_CERTIFICATE: "true"
    });

    const createResult = runPowerShell(
      ENSURE_SCRIPT,
      ["-RepoRoot", REPO_ROOT, "-DbConfigPath", dbConfigPath],
      env
    );
    expect(createResult.status).toBe(0);

    const raw = await fs.readFile(dbConfigPath, "utf8");
    const envelope = JSON.parse(raw.replace(/^\uFEFF/, ""));
    expect(envelope.format).toBe("tsaat-db-config");
    expect(envelope.algorithm).toBe("dpapi");
    expect(raw).not.toContain("super-secret");
    expect(raw).not.toContain("tsaat_sql_user");

    const emitResult = runPowerShell(EMIT_SCRIPT, ["-RepoRoot", REPO_ROOT, "-DbConfigPath", dbConfigPath], env);
    expect(emitResult.status).toBe(0);
    expect(emitResult.stdout).toContain('set "DB_CONF_SERVER=localhost\\SQLEXPRESS"');
    expect(emitResult.stdout).toContain('set "DB_CONF_AUTH_MODE=sql"');
    expect(emitResult.stdout).toContain('set "DB_CONF_USER_ID=tsaat_sql_user"');
    expect(emitResult.stdout).toContain('set "DB_CONF_PASSWORD=super-secret"');
    expect(emitResult.stdout).toContain('set "DB_CONF_TRUST_SERVER_CERTIFICATE=true"');
  });

  it("accepts an existing valid DB_config noninteractively without rewriting it", async () => {
    const env = withCleanTsaatEnv({
      TSAAT_DB_CONFIG_ASSUME_YES: "true",
      TSAAT_SQL_SERVER: "localhost\\SQLEXPRESS",
      TSAAT_APP_DATABASE: "TSAAT",
      TSAAT_SQL_TRUSTED_CONNECTION: "true"
    });
    const createResult = runPowerShell(
      ENSURE_SCRIPT,
      ["-RepoRoot", REPO_ROOT, "-DbConfigPath", dbConfigPath],
      env
    );
    expect(createResult.status).toBe(0);

    const before = await fs.readFile(dbConfigPath, "utf8");
    const beforeHash = sha256(before);
    const secondResult = runPowerShell(
      ENSURE_SCRIPT,
      ["-RepoRoot", REPO_ROOT, "-DbConfigPath", dbConfigPath],
      withCleanTsaatEnv({
        TSAAT_DB_CONFIG_ASSUME_YES: "true",
        TSAAT_SQL_SERVER: "changed-server",
        TSAAT_APP_DATABASE: "ChangedDb",
        TSAAT_SQL_USER: "changed",
        TSAAT_SQL_PASSWORD: "changed-secret"
      })
    );
    expect(secondResult.status).toBe(0);

    const after = await fs.readFile(dbConfigPath, "utf8");
    expect(sha256(after)).toBe(beforeHash);
  });

  it("recreates an undecryptable DB_config noninteractively when complete environment values are provided", async () => {
    await writeUndecryptableDbConfig(dbConfigPath);
    const before = await fs.readFile(dbConfigPath, "utf8");
    expect(before).toContain(Buffer.from("not-a-dpapi-payload").toString("base64"));

    const env = withCleanTsaatEnv({
      TSAAT_DB_CONFIG_ASSUME_YES: "true",
      TSAAT_SQL_SERVER: "localhost\\SQLEXPRESS",
      TSAAT_APP_DATABASE: "TSAAT",
      TSAAT_SQL_USER: "replacement_user",
      TSAAT_SQL_PASSWORD: "replacement-secret"
    });

    const result = runPowerShell(
      ENSURE_SCRIPT,
      ["-RepoRoot", REPO_ROOT, "-DbConfigPath", dbConfigPath],
      env
    );

    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Recreated encrypted DB_config file");

    const raw = await fs.readFile(dbConfigPath, "utf8");
    expect(raw).not.toContain("replacement_user");
    expect(raw).not.toContain("replacement-secret");
    expect(sha256(raw)).not.toBe(sha256(before));

    const emitResult = runPowerShell(EMIT_SCRIPT, ["-RepoRoot", REPO_ROOT, "-DbConfigPath", dbConfigPath], env);
    expect(emitResult.status).toBe(0);
    expect(emitResult.stdout).toContain('set "DB_CONF_AUTH_MODE=sql"');
    expect(emitResult.stdout).toContain('set "DB_CONF_USER_ID=replacement_user"');
    expect(emitResult.stdout).toContain('set "DB_CONF_PASSWORD=replacement-secret"');
  });

  it("fails clearly for an undecryptable DB_config when unattended recreation values are incomplete", async () => {
    await writeUndecryptableDbConfig(dbConfigPath);

    const result = runPowerShell(
      ENSURE_SCRIPT,
      ["-RepoRoot", REPO_ROOT, "-DbConfigPath", dbConfigPath],
      withCleanTsaatEnv({ TSAAT_DB_CONFIG_ASSUME_YES: "true" })
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Existing DB_config cannot be decrypted or validated");
    expect(`${result.stdout}\n${result.stderr}`).toContain("Unattended recreation requires");
  });

  it("fails clearly when DB_config is missing and noninteractive environment values are incomplete", () => {
    const result = runPowerShell(
      ENSURE_SCRIPT,
      ["-RepoRoot", REPO_ROOT, "-DbConfigPath", dbConfigPath],
      withCleanTsaatEnv({ TSAAT_DB_CONFIG_ASSUME_YES: "true" })
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("DB_config is missing");
  });
});
