import { afterEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());
vi.mock("child_process", async importOriginal => {
  const original = await importOriginal<typeof import("child_process")>();
  const { promisify } = await import("util");
  const execFile = Object.assign(vi.fn(), { [promisify.custom]: async (file: string, args: string[], options: unknown) => {
    const result = await execute(file, args, options);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(args[args.indexOf("-o") + 1], result.stdout, "utf8");
    return result;
  } });
  return { ...original, execFile };
});

vi.mock("@/lib/db-config", () => ({ loadDatabaseConnectionSettingsFromFile: vi.fn().mockResolvedValue(null) }));
import { executeSqlText, executeSqlTextWithConnection } from "@/lib/sql-server";

describe("SQL credential transport", () => {
  afterEach(() => { execute.mockReset(); vi.unstubAllEnvs(); });
  it("reads Unicode query output from the explicit UTF-8 output file", async () => {
    execute.mockResolvedValue({ stdout: "café - 日本語", stderr: "" });
    expect(await executeSqlTextWithConnection("SELECT N'café';", { server: "localhost", database: "master", trustedConnection: true, sslEnabled: false })).toBe("café - 日本語");
    const args = execute.mock.calls[0][1];
    expect(args[args.indexOf("-f") + 1]).toBe("65001"); expect(args).toContain("-o"); expect(args).toContain("-x");
    const { access } = await import("node:fs/promises");
    await expect(access(args[args.indexOf("-o") + 1])).rejects.toThrow();
  });

  it("retains SQL errors from the output file and cleans up failed queries", async () => {
    execute.mockImplementation(async (_file: string, args: string[]) => {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(args[args.indexOf("-o") + 1], "SQL fixture failure: invalid column", "utf8");
      throw new Error("sqlcmd exited 1");
    });
    await expect(executeSqlTextWithConnection("SELECT invalid;", { server: "localhost", database: "master", trustedConnection: true, sslEnabled: false })).rejects.toThrow("SQL fixture failure: invalid column");
    const { access } = await import("node:fs/promises");
    const args = execute.mock.calls[0][1];
    await expect(access(args[args.indexOf("-o") + 1])).rejects.toThrow();
  });

  it("uses SQLCMDPASSWORD only in the child environment with SSL disabled", async () => {
    vi.stubEnv("SQLCMDPASSWORD", "parent-secret");
    execute.mockResolvedValue({ stdout: "ok", stderr: "" });
    expect(await executeSqlTextWithConnection("SELECT 1;", {
      server: "tcp:test-host,1433", database: "TSAATDB", userId: "tsaat_app", password: "app-secret",
      trustedConnection: false, sslEnabled: false, sslType: "strict"
    })).toBe("ok");
    const [, args, options] = execute.mock.calls[0];
    expect(args).toContain("-U");
    expect(args).toContain("tsaat_app");
    expect(args).not.toContain("-P");
    expect(args).not.toContain("app-secret");
    expect(args).not.toContain("-N");
    expect(args).not.toContain("-C");
    expect(options.env.SQLCMDPASSWORD).toBe("app-secret");
    expect(process.env.SQLCMDPASSWORD).toBe("parent-secret");
  });

  it("does not pass inherited SQL passwords to a Windows connection", async () => {
    vi.stubEnv("SQLCMDPASSWORD", "parent-secret");
    execute.mockResolvedValue({ stdout: "ok", stderr: "" });
    await executeSqlTextWithConnection("SELECT 1;", { server: "localhost", database: "master", trustedConnection: true, sslEnabled: false });
    expect(execute.mock.calls[0][1]).toContain("-E");
    expect(execute.mock.calls[0][2].env.SQLCMDPASSWORD).toBeUndefined();
  });

  it("does not retry a failed explicit SQL login as Windows authentication", async () => {
    execute.mockRejectedValue(new Error("Login failed for user tsaat_app"));
    await expect(executeSqlTextWithConnection("SELECT 1;", {
      server: "localhost", database: "TSAATDB", userId: "tsaat_app", password: "app-secret", sslEnabled: false
    })).rejects.toThrow("Login failed");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("does not fall back to the runtime Windows account unless explicitly enabled", async () => {
    vi.stubEnv("TSAAT_SQL_SERVER", "tcp:test-host,1433");
    vi.stubEnv("TSAAT_APP_DATABASE", "TSAATDB");
    vi.stubEnv("TSAAT_SQL_USER", "tsaat_app");
    vi.stubEnv("TSAAT_SQL_PASSWORD", "app-secret");
    vi.stubEnv("TSAAT_SQL_TRUSTED_FALLBACK", "");
    vi.stubEnv("SQL_TRUSTED_FALLBACK", "");
    execute.mockRejectedValue(new Error("Login failed for user tsaat_app"));
    await expect(executeSqlText("SELECT 1;")).rejects.toThrow("Login failed");
    expect(execute).toHaveBeenCalledTimes(1);
    vi.stubEnv("TSAAT_SQL_TRUSTED_FALLBACK", "true");
    execute.mockReset().mockRejectedValueOnce(new Error("Login failed for user tsaat_app")).mockResolvedValueOnce({ stdout: "ok", stderr: "" });
    expect(await executeSqlText("SELECT 1;")).toBe("ok");
    expect(execute.mock.calls[1][1]).toContain("-E");
  });
});
