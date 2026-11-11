-- Optional CMDB inventory fields. Existing records remain unchanged.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH(N'tsaat.asset', N'mac_address') IS NULL
  ALTER TABLE [tsaat].[asset] ADD [mac_address] NVARCHAR(64) NULL;
IF COL_LENGTH(N'tsaat.asset', N'device_model') IS NULL
  ALTER TABLE [tsaat].[asset] ADD [device_model] NVARCHAR(255) NULL;
IF COL_LENGTH(N'tsaat.asset', N'last_discovered_date') IS NULL
  ALTER TABLE [tsaat].[asset] ADD [last_discovered_date] DATETIME2(3) NULL;
IF COL_LENGTH(N'tsaat.asset', N'discovered_by') IS NULL
  ALTER TABLE [tsaat].[asset] ADD [discovered_by] NVARCHAR(255) NULL;
COMMIT TRANSACTION;
