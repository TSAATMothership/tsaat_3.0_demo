import "server-only";
import { executeSqlJson, toSqlUnicodeLiteral } from "@/lib/sql-server";
import { defaultPersonaSettings, parsePersonaSettings, PersonaConflictError, type PersonaSettings } from "@/lib/personas";

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
  const settings = parsePersonaSettings(input, { forWrite: true });
  const result = await executeSqlJson<{ conflict?: boolean; settings?: string }>(`
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @current NVARCHAR(MAX), @revision NVARCHAR(50), @now DATETIME2(3) = SYSUTCDATETIME();
  SELECT TOP (1) @current = [settings_json]
  FROM [tsaat].[persona_settings_version] WITH (UPDLOCK, HOLDLOCK)
  ORDER BY [settings_version_id] DESC;
  SET @revision = COALESCE(JSON_VALUE(@current, '$.updatedAt'), N'1970-01-01T00:00:00.000Z');
  IF @revision <> ${toSqlUnicodeLiteral(settings.updatedAt)}
  BEGIN
    SELECT CAST(1 AS BIT) AS conflict FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  END
  ELSE
  BEGIN
    IF @now <= TRY_CONVERT(DATETIME2(3), @revision, 127)
      SET @now = DATEADD(MILLISECOND, 1, CONVERT(DATETIME2(3), @revision, 127));
    DECLARE @saved NVARCHAR(MAX) = JSON_MODIFY(${toSqlUnicodeLiteral(JSON.stringify(settings))}, '$.updatedAt', CONVERT(VARCHAR(23), @now, 126) + 'Z');
    INSERT INTO [tsaat].[persona_settings_version] ([settings_json]) VALUES (@saved);
    SELECT @saved AS settings FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;`);
  if (result.conflict) throw new PersonaConflictError();
  if (!result.settings) throw new Error("SQL did not return saved personas.");
  return parsePersonaSettings(JSON.parse(result.settings));
}
