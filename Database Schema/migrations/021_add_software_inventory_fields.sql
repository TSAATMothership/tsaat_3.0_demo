-- Optional CMDB software evidence and OS patch identifiers. Existing rows are preserved.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH(N'tsaat.asset_installed_software', N'file_path') IS NULL
  ALTER TABLE [tsaat].[asset_installed_software] ADD [file_path] NVARCHAR(2048) NULL;
IF COL_LENGTH(N'tsaat.asset_installed_software', N'last_discovered_date') IS NULL
  ALTER TABLE [tsaat].[asset_installed_software] ADD [last_discovered_date] DATETIME2(3) NULL;
IF COL_LENGTH(N'tsaat.asset_installed_software', N'discovered_by') IS NULL
  ALTER TABLE [tsaat].[asset_installed_software] ADD [discovered_by] NVARCHAR(255) NULL;
IF COL_LENGTH(N'tsaat.asset_operating_system', N'patch_level') IS NULL
  ALTER TABLE [tsaat].[asset_operating_system] ADD [patch_level] NVARCHAR(255) NULL;
IF COL_LENGTH(N'tsaat.asset_network_os', N'patch_level') IS NULL
  ALTER TABLE [tsaat].[asset_network_os] ADD [patch_level] NVARCHAR(255) NULL;
COMMIT TRANSACTION;
