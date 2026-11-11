import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { initializeJsonStore } from "../scripts/setup-json-store.mjs";
import { executeSqlJsonWithConnection, executeSqlTextWithConnection, toSqlUnicodeLiteral } from "@/lib/sql-server";
import * as sql from "@/lib/sql-persona-settings";
import * as json from "@/lib/json-store/persona-settings";
import { defaultPersonaSettings, parsePersonaSettings, PersonaConflictError } from "@/lib/personas";
const target = vi.hoisted(() => ({
  server: process.env.TSAAT_PERSONA_PARITY_SERVER?.trim() ?? "",
  database: process.env.TSAAT_PERSONA_PARITY_DATABASE?.trim() ?? "",
  trustedConnection: true, sslEnabled: true,
  sslType: process.env.TSAAT_PERSONA_PARITY_TRUST_CERTIFICATE === "true" ? "trust-server-certificate" as const : "strict" as const
}));
vi.mock("@/lib/sql-server", async original => {
  const actual = await original<typeof import("@/lib/sql-server")>();
  return { ...actual, executeSqlJson: (query: string) => actual.executeSqlJsonWithConnection(query, target) };
});
describe.runIf(Boolean(target.server && target.database)).sequential("disposable SQL/JSON persona parity", () => {
  let directory: string, previous: string | undefined;
  const replaceSql = async (settings: unknown) => executeSqlTextWithConnection(`SET XACT_ABORT ON; BEGIN TRANSACTION; DELETE FROM tsaat.persona_settings_version; INSERT tsaat.persona_settings_version(settings_json) VALUES (${toSqlUnicodeLiteral(JSON.stringify(settings))}); COMMIT;`, target);
  beforeAll(async () => {
    if (!/^TSAAT_PersonaParity_[A-Za-z0-9_]+$/.test(target.database)) throw new Error("Select an explicitly disposable TSAAT_PersonaParity_* database with the application schema.");
    directory = mkdtempSync(path.join(os.tmpdir(), "tsaat-persona-parity-"));
    previous = process.env.TSAAT_JSON_DATA_DIR; process.env.TSAAT_JSON_DATA_DIR = directory;
    await initializeJsonStore({ target: directory });
  });
  afterAll(async () => {
    if (!directory) return;
    await replaceSql(defaultPersonaSettings());
    if (previous === undefined) delete process.env.TSAAT_JSON_DATA_DIR; else process.env.TSAAT_JSON_DATA_DIR = previous;
    if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("tsaat-persona-parity-")) throw new Error("Unsafe test directory.");
    rmSync(directory, { recursive: true, force: true });
  });
  it("fresh setup persists identical shared defaults in SQL and JSON", async () => {
    const persisted = await executeSqlJsonWithConnection<{ settings: string; rows: number }>("SELECT TOP (1) settings_json AS settings, (SELECT COUNT(*) FROM tsaat.persona_settings_version) AS rows FROM tsaat.persona_settings_version ORDER BY settings_version_id DESC FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;", target);
    expect(persisted.rows).toBe(1);
    expect(JSON.parse(persisted.settings)).toEqual(defaultPersonaSettings());
    expect(await sql.loadPersonaSettings()).toEqual(await json.loadPersonaSettings());
  });
  it("round-trips custom IDs, Unicode names, order and permissions; rejects stale and concurrent saves", async () => {
    for (const provider of [sql, json]) {
      const draft = await provider.loadPersonaSettings();
      draft.personas = [{ id: "custom-review", label: "Reviewer's café $(literal)", sections: ["findings"], pages: ["findings-register"], popups: ["cmdb-details"] }, ...draft.personas.slice(0, 2).reverse()];
      const saved = await provider.savePersonaSettings(draft);
      expect(saved.personas).toEqual(draft.personas); expect(await provider.loadPersonaSettings()).toEqual(saved);
      await expect(provider.savePersonaSettings(draft)).rejects.toBeInstanceOf(PersonaConflictError);
      const first = structuredClone(saved), second = structuredClone(saved);
      first.personas[0].label = "First concurrent writer"; second.personas[0].label = "Second concurrent writer";
      const results = await Promise.allSettled([provider.savePersonaSettings(first), provider.savePersonaSettings(second)]);
      expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find(result => result.status === "rejected");
      expect(rejected?.status === "rejected" && rejected.reason instanceof PersonaConflictError).toBe(true);
      const current = await provider.loadPersonaSettings(); current.personas = [];
      await provider.savePersonaSettings(current); expect((await provider.loadPersonaSettings()).personas).toEqual([]);
    }
  }, 120000);
  it.each([1, 2])("preserves version %i revisions on read and upgrades only on save", async schemaVersion => {
    const defaults = defaultPersonaSettings();
    const legacy = { ...defaults, schemaVersion, personas: defaults.personas.slice(0, 4).map(({ label: _label, ...persona }) => ({ ...persona, sections: [], pages: [], popups: [] })) };
    await replaceSql(legacy); writeFileSync(path.join(directory, "settings/personas.json"), JSON.stringify(legacy));
    const before = readFileSync(path.join(directory, "settings/personas.json"), "utf8");
    const expected = parsePersonaSettings(legacy);
    expect(await sql.loadPersonaSettings()).toEqual(expected); expect(await json.loadPersonaSettings()).toEqual(expected);
    expect(readFileSync(path.join(directory, "settings/personas.json"), "utf8")).toBe(before);
    const sqlBefore = await executeSqlJsonWithConnection<{ settings: string }>("SELECT TOP (1) settings_json AS settings FROM tsaat.persona_settings_version ORDER BY settings_version_id DESC FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;", target);
    expect(JSON.parse(sqlBefore.settings)).toEqual(legacy);
    const a = await sql.savePersonaSettings(expected), b = await json.savePersonaSettings(expected);
    expect(a.personas).toEqual(b.personas); expect(a.schemaVersion).toBe(3); expect(b.schemaVersion).toBe(3);
    const history = await executeSqlJsonWithConnection<{ rows: number }>("SELECT COUNT(*) AS rows FROM tsaat.persona_settings_version FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;", target);
    expect(history.rows).toBe(2);
  }, 120000);
});
