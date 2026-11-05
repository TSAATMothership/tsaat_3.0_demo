-- Additive navigation preferences only. Apply with sqlcmd -b and normal strict TLS.
-- Back up the explicitly selected TSAAT database first. Never replay base schema/seed loaders.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'tsaat.asset', N'U') IS NULL
  THROW 51031, 'Select an existing TSAAT database with the asset table.', 1;
IF OBJECT_ID(N'tsaat.persona_settings_version', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[persona_settings_version] (
    [settings_version_id] BIGINT IDENTITY(1,1) NOT NULL,
    [settings_json] NVARCHAR(MAX) NOT NULL,
    [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_persona_settings_created] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_persona_settings_version] PRIMARY KEY ([settings_version_id]),
    CONSTRAINT [CK_persona_settings_json] CHECK (ISJSON([settings_json]) = 1)
  );
END;
COMMIT TRANSACTION;
GO
