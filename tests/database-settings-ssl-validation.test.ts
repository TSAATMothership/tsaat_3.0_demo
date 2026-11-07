import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeSqlJsonWithConnection } from "@/lib/sql-server";
import { testDatabaseSsl } from "@/lib/database-settings";
import type { EditableDatabaseConnectionInput } from "@/lib/db-config";

vi.mock("@/lib/sql-server", () => ({ executeSqlJsonWithConnection: vi.fn() }));
const execute = vi.mocked(executeSqlJsonWithConnection);
const settings: EditableDatabaseConnectionInput = {
  server: "tcp:localhost,14333", database: "TSAAT_Test", authMode: "trusted",
  userId: "", password: "", sslEnabled: true, sslType: "trust-server-certificate"
};

describe("SQL encryption diagnostics", () => {
  beforeEach(() => { execute.mockReset(); });

  it("skips the SSL query for a username/password connection with SSL disabled", async () => {
    const result = await testDatabaseSsl({ ...settings, authMode: "sql", userId: "tsaat_app", password: "test-secret", sslEnabled: false, sslType: "strict" });
    expect(result.success).toBe(true);
    expect(result.diagnostics).toContain("SSL is disabled");
    expect(execute).not.toHaveBeenCalled();
  });

  it("checks the current connection DMV and preserves the chosen TLS policy", async () => {
    execute.mockResolvedValue({ encryptOption: "TRUE", authScheme: "NTLM", protocolType: "TSQL" });
    expect((await testDatabaseSsl(settings)).success).toBe(true);
    const [query, connection] = execute.mock.calls[0];
    expect(query).toContain("FROM sys.dm_exec_connections");
    expect(query).toContain("WHERE session_id = @@SPID");
    expect(query).not.toContain("CONNECTIONPROPERTY('encrypt_option')");
    expect(connection).toMatchObject({ sslEnabled: true, sslType: "trust-server-certificate" });
  });

  it.each(["FALSE", "", undefined])("rejects unencrypted or unavailable evidence %s", async encryptOption => {
    execute.mockResolvedValue({ encryptOption });
    expect((await testDatabaseSsl(settings)).success).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("reports diagnostic permission failures without a weaker retry", async () => {
    execute.mockRejectedValue(new Error("VIEW SERVER PERFORMANCE STATE permission denied"));
    const result = await testDatabaseSsl({ ...settings, sslType: "strict" });
    expect(result.success).toBe(false);
    expect(result.diagnostics).toContain("permission denied");
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][1].sslType).toBe("strict");
  });
});
