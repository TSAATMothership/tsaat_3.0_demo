import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  loadDatabaseConnectionSettingsFromFile,
  resolveDbConfigFilePath,
  saveDatabaseConnectionSettingsToFile
} from "@/lib/db-config";

const ORIGINAL_SCOPE_ENV = process.env.TSAAT_DB_CONFIG_DPAPI_SCOPE;
const ORIGINAL_LEGACY_ENV = process.env.TSAAT_DB_CONFIG_ALLOW_LEGACY_PLAINTEXT;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("db-config encryption", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tsaat-db-config-test-"));
    await fs.mkdir(path.join(tempDir, "scripts"), { recursive: true });
    await fs.copyFile(
      path.join(REPO_ROOT, "scripts", "invoke-dpapi.ps1"),
      path.join(tempDir, "scripts", "invoke-dpapi.ps1")
    );
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    delete process.env.TSAAT_DB_CONFIG_DPAPI_SCOPE;
    delete process.env.TSAAT_DB_CONFIG_ALLOW_LEGACY_PLAINTEXT;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (ORIGINAL_SCOPE_ENV === undefined) {
      delete process.env.TSAAT_DB_CONFIG_DPAPI_SCOPE;
    } else {
      process.env.TSAAT_DB_CONFIG_DPAPI_SCOPE = ORIGINAL_SCOPE_ENV;
    }

    if (ORIGINAL_LEGACY_ENV === undefined) {
      delete process.env.TSAAT_DB_CONFIG_ALLOW_LEGACY_PLAINTEXT;
    } else {
      process.env.TSAAT_DB_CONFIG_ALLOW_LEGACY_PLAINTEXT = ORIGINAL_LEGACY_ENV;
    }

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("writes encrypted envelope and reads it back", async () => {
    await saveDatabaseConnectionSettingsToFile({
      server: "localhost\\SQLEXPRESS",
      database: "TSAAT",
      authMode: "sql",
      userId: "tsaat_user",
      password: "super-secret",
      sslEnabled: true,
      sslType: "trust-server-certificate"
    });

    const raw = await fs.readFile(resolveDbConfigFilePath(), "utf-8");
    expect(raw).toContain('"format": "tsaat-db-config"');
    expect(raw).toContain('"algorithm": "dpapi"');
    expect(raw).not.toContain("Server=");
    expect(raw).not.toContain("super-secret");

    const loaded = await loadDatabaseConnectionSettingsFromFile();
    expect(loaded).not.toBeNull();
    expect(loaded?.server).toBe("localhost\\SQLEXPRESS");
    expect(loaded?.database).toBe("TSAAT");
    expect(loaded?.authMode).toBe("sql");
    expect(loaded?.userId).toBe("tsaat_user");
    expect(loaded?.password).toBe("super-secret");
    expect(loaded?.sslEnabled).toBe(true);
    expect(loaded?.sslType).toBe("trust-server-certificate");
    expect(loaded?.keyProvider).toBe("dpapi-current-user");
  });

  it("supports LocalMachine DPAPI when explicitly configured", async () => {
    process.env.TSAAT_DB_CONFIG_DPAPI_SCOPE = "local-machine";

    await saveDatabaseConnectionSettingsToFile({
      server: "localhost",
      database: "TSAAT",
      authMode: "trusted",
      userId: "",
      password: "",
      sslEnabled: false,
      sslType: "strict"
    });

    const raw = await fs.readFile(resolveDbConfigFilePath(), "utf-8");
    expect(raw).toContain('"keyProvider": "dpapi-local-machine"');

    const loaded = await loadDatabaseConnectionSettingsFromFile();
    expect(loaded?.keyProvider).toBe("dpapi-local-machine");
    expect(loaded?.authMode).toBe("trusted");
  });

  it("migrates legacy plaintext DB_config to encrypted envelope", async () => {
    const legacyPlaintext =
      "Server=localhost\\SQLEXPRESS;Database=TSAAT;Trusted_Connection=False;User Id=legacy_user;Password=legacy_pw;Encrypt=True;TrustServerCertificate=False;\n";
    await fs.writeFile(resolveDbConfigFilePath(), legacyPlaintext, "utf-8");

    const loaded = await loadDatabaseConnectionSettingsFromFile();
    expect(loaded).not.toBeNull();
    expect(loaded?.authMode).toBe("sql");
    expect(loaded?.userId).toBe("legacy_user");

    const migratedRaw = await fs.readFile(resolveDbConfigFilePath(), "utf-8");
    expect(migratedRaw).toContain('"format": "tsaat-db-config"');
    expect(migratedRaw).not.toContain("Trusted_Connection=False");

    const legacyBackupPath = path.join(tempDir, "DB_config.legacy.backup");
    const backupRaw = await fs.readFile(legacyBackupPath, "utf-8");
    expect(backupRaw).toContain("Trusted_Connection=False");
  });

  it("can read legacy plaintext without migration when explicit legacy support flag is enabled", async () => {
    process.env.TSAAT_DB_CONFIG_ALLOW_LEGACY_PLAINTEXT = "true";

    const legacyPlaintext =
      "Server=localhost\\SQLEXPRESS;Database=TSAAT;Trusted_Connection=True;Encrypt=False;TrustServerCertificate=False;\n";
    await fs.writeFile(resolveDbConfigFilePath(), legacyPlaintext, "utf-8");

    const loaded = await loadDatabaseConnectionSettingsFromFile();
    expect(loaded).not.toBeNull();
    expect(loaded?.authMode).toBe("trusted");

    const raw = await fs.readFile(resolveDbConfigFilePath(), "utf-8");
    expect(raw).toContain("Trusted_Connection=True");
  });
});
