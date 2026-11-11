SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Forward-only, rerunnable migration. Preserve network classification separately.
IF COL_LENGTH(N'tsaat.managed_network', N'security_domain') IS NULL
  ALTER TABLE [tsaat].[managed_network] ADD [security_domain] NVARCHAR(20) NULL;

IF OBJECT_ID(N'tsaat.CK_managed_network_security_domain', N'C') IS NOT NULL
  ALTER TABLE [tsaat].[managed_network] DROP CONSTRAINT [CK_managed_network_security_domain];
IF OBJECT_ID(N'tsaat.CK_ict_system_security_domain', N'C') IS NOT NULL
  ALTER TABLE [tsaat].[ict_system] DROP CONSTRAINT [CK_ict_system_security_domain];
IF OBJECT_ID(N'tsaat.CK_asset_security_domain', N'C') IS NOT NULL
  ALTER TABLE [tsaat].[asset] DROP CONSTRAINT [CK_asset_security_domain];

-- Dynamic SQL permits the newly added column to be used in this same batch.
EXEC sys.sp_executesql N'
UPDATE [tsaat].[managed_network]
SET [security_domain] = CASE UPPER(LTRIM(RTRIM(COALESCE([security_domain], CASE WHEN UPPER(LTRIM(RTRIM([classification]))) = N''RESTRICTED'' THEN N''SECRET'' ELSE [classification] END))))
  WHEN N''PROTECTED'' THEN N''PROTECTED'' WHEN N''SECRET'' THEN N''SECRET'' ELSE N''UNKNOWN'' END;
ALTER TABLE [tsaat].[managed_network] ALTER COLUMN [security_domain] NVARCHAR(20) NOT NULL;
ALTER TABLE [tsaat].[managed_network] WITH CHECK ADD CONSTRAINT [CK_managed_network_security_domain]
  CHECK ([security_domain] COLLATE Latin1_General_100_BIN2 IN (N''PROTECTED'', N''SECRET'', N''UNKNOWN''));';

UPDATE [tsaat].[ict_system] SET [security_domain] = CASE UPPER(LTRIM(RTRIM([security_domain])))
  WHEN N'PROTECTED' THEN N'PROTECTED' WHEN N'SECRET' THEN N'SECRET' ELSE N'UNKNOWN' END;
UPDATE [tsaat].[asset] SET [security_domain] = CASE UPPER(LTRIM(RTRIM([security_domain])))
  WHEN N'PROTECTED' THEN N'PROTECTED' WHEN N'SECRET' THEN N'SECRET' ELSE N'UNKNOWN' END;

ALTER TABLE [tsaat].[ict_system] WITH CHECK ADD CONSTRAINT [CK_ict_system_security_domain]
  CHECK ([security_domain] COLLATE Latin1_General_100_BIN2 IN (N'PROTECTED', N'SECRET', N'UNKNOWN'));
ALTER TABLE [tsaat].[asset] WITH CHECK ADD CONSTRAINT [CK_asset_security_domain]
  CHECK ([security_domain] COLLATE Latin1_General_100_BIN2 IN (N'PROTECTED', N'SECRET', N'UNKNOWN'));

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints d JOIN sys.columns c ON c.object_id=d.parent_object_id AND c.column_id=d.parent_column_id WHERE d.parent_object_id=OBJECT_ID(N'tsaat.managed_network') AND c.name=N'security_domain')
  EXEC sys.sp_executesql N'ALTER TABLE [tsaat].[managed_network] ADD CONSTRAINT [DF_managed_network_security_domain] DEFAULT (N''UNKNOWN'') FOR [security_domain];';
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints d JOIN sys.columns c ON c.object_id=d.parent_object_id AND c.column_id=d.parent_column_id WHERE d.parent_object_id=OBJECT_ID(N'tsaat.ict_system') AND c.name=N'security_domain')
  ALTER TABLE [tsaat].[ict_system] ADD CONSTRAINT [DF_ict_system_security_domain] DEFAULT (N'UNKNOWN') FOR [security_domain];
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints d JOIN sys.columns c ON c.object_id=d.parent_object_id AND c.column_id=d.parent_column_id WHERE d.parent_object_id=OBJECT_ID(N'tsaat.asset') AND c.name=N'security_domain')
  ALTER TABLE [tsaat].[asset] ADD CONSTRAINT [DF_asset_security_domain] DEFAULT (N'UNKNOWN') FOR [security_domain];

COMMIT TRANSACTION;
