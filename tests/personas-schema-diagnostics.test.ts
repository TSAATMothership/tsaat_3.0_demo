import { expect, it, vi } from "vitest";
import { testDatabaseSchema } from "@/lib/database-settings";
import { executeSqlJsonWithConnection } from "@/lib/sql-server";
vi.mock("@/lib/sql-server", () => ({ executeSqlJsonWithConnection: vi.fn(), resolveAppDatabaseName: vi.fn(), resolveSqlServerName: vi.fn() }));
const connection = { server: "localhost", database: "TSAAT_Test", authMode: "trusted" as const, userId: "", password: "", sslEnabled: true, sslType: "strict" as const };
it("checks the Personas table and required columns using strict TLS", async () => {
  vi.mocked(executeSqlJsonWithConnection).mockResolvedValue({ missingTables: [], missingColumns: [], hasSnapshots: true });
  expect((await testDatabaseSchema(connection)).success).toBe(true);
  const [query, target] = vi.mocked(executeSqlJsonWithConnection).mock.calls.at(-1)!;
  expect(query).toContain("(N'persona_settings_version')");
  for (const column of ["settings_version_id", "settings_json", "created_at_utc"]) expect(query).toContain(`(N'persona_settings_version', N'${column}')`);
  expect(target).toMatchObject({ sslEnabled: true, sslType: "strict" });
});
it("reports a missing Personas migration as a schema failure", async () => {
  vi.mocked(executeSqlJsonWithConnection).mockResolvedValue({ missingTables: [{ tableName: "persona_settings_version" }], missingColumns: [], hasSnapshots: true });
  const result = await testDatabaseSchema(connection);
  expect(result.success).toBe(false);
  expect(result.diagnostics).toContain("Missing required tables: persona_settings_version");
});
