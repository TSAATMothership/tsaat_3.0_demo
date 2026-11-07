import "server-only";
import { executeSqlJson, executeSqlText, toSqlUnicodeLiteral } from "@/lib/sql-server";
import { defaultPersonaSettings, parsePersonaSettings, type PersonaSettings } from "@/lib/personas";

// No evaluation cache depends on navigation preferences. Read the latest committed revision.
export async function loadPersonaSettings(): Promise<PersonaSettings> {
  const row = await executeSqlJson<{ settings: string } | null>(`
SELECT COALESCE((SELECT TOP (1) [settings_json] AS [settings]
FROM [tsaat].[persona_settings_version]
ORDER BY [settings_version_id] DESC
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), N'null');`);
  return row ? parsePersonaSettings(JSON.parse(row.settings)) : defaultPersonaSettings();
}

export async function savePersonaSettings(input: unknown): Promise<PersonaSettings> {
  const settings = { ...parsePersonaSettings(input, { requireAllPersonas: true }), updatedAt: new Date().toISOString() };
  await executeSqlText(`
SET XACT_ABORT ON;
INSERT INTO [tsaat].[persona_settings_version] ([settings_json])
VALUES (${toSqlUnicodeLiteral(JSON.stringify(settings))});`);
  return settings;
}
