import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { saveDatabaseConnectionSettingsToFile } from "@/lib/db-config";
import {
  loadDatabaseSettingsDefaults,
  normalizeDatabaseSettingsPayloadForProcessing,
  STORED_DB_PASSWORD_PLACEHOLDER
} from "@/lib/database-settings";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("database settings password handling", () => {
  let tempDir: string;
  const originalServer = process.env.TSAAT_SQL_SERVER;
  const originalDatabase = process.env.TSAAT_APP_DATABASE;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tsaat-settings-password-test-"));
    await fs.mkdir(path.join(tempDir, "scripts"), { recursive: true });
    await fs.copyFile(
      path.join(REPO_ROOT, "scripts", "invoke-dpapi.ps1"),
      path.join(tempDir, "scripts", "invoke-dpapi.ps1")
    );
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    process.env.TSAAT_SQL_SERVER = "localhost\\SQLEXPRESS";
    process.env.TSAAT_APP_DATABASE = "TSAAT";
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (originalServer === undefined) {
      delete process.env.TSAAT_SQL_SERVER;
    } else {
      process.env.TSAAT_SQL_SERVER = originalServer;
    }

    if (originalDatabase === undefined) {
      delete process.env.TSAAT_APP_DATABASE;
    } else {
      process.env.TSAAT_APP_DATABASE = originalDatabase;
    }

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("does not return stored SQL password in defaults", async () => {
    await saveDatabaseConnectionSettingsToFile({
      server: "localhost\\SQLEXPRESS",
      database: "TSAAT",
      authMode: "sql",
      userId: "tsaat_user",
      password: "secret-value",
      sslEnabled: false,
      sslType: "strict"
    });

    const defaults = await loadDatabaseSettingsDefaults();
    expect(defaults.authMode).toBe("sql");
    expect(defaults.hasStoredPassword).toBe(true);
    expect(defaults.password).toBe(STORED_DB_PASSWORD_PLACEHOLDER);
  });

  it("resolves stored password placeholder for processing", async () => {
    await saveDatabaseConnectionSettingsToFile({
      server: "localhost\\SQLEXPRESS",
      database: "TSAAT",
      authMode: "sql",
      userId: "tsaat_user",
      password: "secret-value",
      sslEnabled: true,
      sslType: "trust-server-certificate"
    });

    const processed = await normalizeDatabaseSettingsPayloadForProcessing({
      server: "localhost\\SQLEXPRESS",
      database: "TSAAT",
      authMode: "sql",
      userId: "tsaat_user",
      password: STORED_DB_PASSWORD_PLACEHOLDER,
      sslEnabled: true,
      sslType: "trust-server-certificate"
    });

    expect(processed.password).toBe("secret-value");
  });
});
