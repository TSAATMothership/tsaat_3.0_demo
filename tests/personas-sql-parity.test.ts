import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { executeSqlJsonWithConnection, toSqlUnicodeLiteral } from "@/lib/sql-server";
import { defaultPersonaSettings, parsePersonaSettings } from "@/lib/personas";

const server = process.env.TSAAT_PERSONA_PARITY_SERVER?.trim(), database = process.env.TSAAT_PERSONA_PARITY_DATABASE?.trim();
describe.runIf(Boolean(server && database))("disposable SQL persona migration parity", () => {
  it("preserves the original catalogue and round-trips Business Reporting with the same migration", async () => {
    if (!database?.startsWith("TSAAT_PersonaParity_")) throw new Error("Explicitly select an empty disposable TSAAT_PersonaParity_* database.");
    const migration = readFileSync("Database Schema/migrations/031_persona_navigation_settings.sql", "utf8");
    const saved = defaultPersonaSettings(); saved.personas[0].sections = [];
    saved.personas[1].sections = ["discovery", "findings"];
    saved.personas[1].pages = ["discovery-overview", "findings-register"];
    saved.personas[1].popups = ["cmdb-details"];
    const legacy = { ...saved, personas: saved.personas.filter(persona => persona.id !== "business-reporting") };
    saved.personas[4] = { id: "business-reporting", sections: ["briefs-reports"], pages: ["briefs-reports"], popups: [] };
    const result = await executeSqlJsonWithConnection<{ legacy: string; settings: string }>(
      "SET XACT_ABORT ON; BEGIN TRANSACTION;\n" +
      "IF SCHEMA_ID(N'tsaat') IS NOT NULL THROW 51031, 'Use an empty disposable parity database.', 1;\n" +
      "EXEC(N'CREATE SCHEMA tsaat'); CREATE TABLE tsaat.asset(id INT);\nGO\n" + migration + "\nGO\n" +
      "INSERT tsaat.persona_settings_version(settings_json) VALUES(" + toSqlUnicodeLiteral(JSON.stringify(legacy)) + "), (" + toSqlUnicodeLiteral(JSON.stringify(saved)) + ");\nGO\n" + migration + "\nGO\n" +
      "SELECT (SELECT TOP (1) settings_json FROM tsaat.persona_settings_version ORDER BY settings_version_id ASC) AS legacy, " +
      "(SELECT TOP (1) settings_json FROM tsaat.persona_settings_version ORDER BY settings_version_id DESC) AS settings " +
      "FOR JSON PATH, WITHOUT_ARRAY_WRAPPER; ROLLBACK TRANSACTION;",
      { server: server!, database, trustedConnection: true, sslEnabled: true, sslType: "strict" });
    expect(parsePersonaSettings(JSON.parse(result.settings))).toEqual(saved);
    expect(JSON.parse(result.legacy)).toEqual(legacy);
    expect(parsePersonaSettings(JSON.parse(result.legacy)).personas[4]).toEqual(defaultPersonaSettings().personas[4]);
  }, 120000);
});
