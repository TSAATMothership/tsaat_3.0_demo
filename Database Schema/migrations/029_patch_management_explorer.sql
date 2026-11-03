-- Forward-only additive migration. No inventory, settings, rules or observations are replaced.
-- Run using sqlcmd -b against an explicitly selected, backed-up TSAAT database.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'tsaat.asset', N'U') IS NULL
  THROW 51029, 'Select an existing TSAAT database with the asset table.', 1;
IF OBJECT_ID(N'tsaat.server_patch_observation', N'U') IS NULL
BEGIN
CREATE TABLE [tsaat].[server_patch_observation] (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [assessment_date] DATETIME2(3) NULL,
  [assessment_valid_until] DATE NULL,
  [last_patched_date] DATETIME2(3) NULL,
  [last_restarted_date] DATETIME2(3) NULL,
  [verified_date] DATETIME2(3) NULL,
  [installed_patch_level] NVARCHAR(255) NULL,
  [target_patch_level] NVARCHAR(255) NULL,
  [missing_updates] INT NULL,
  [missing_critical_updates] INT NULL,
  [restart_required] BIT NULL,
  [deployment_status] NVARCHAR(20) NULL,
  [due_date] DATE NULL,
  [planned_date] DATE NULL,
  [owner] NVARCHAR(255) NULL,
  [maintenance_window] NVARCHAR(255) NULL,
  [change_reference] NVARCHAR(500) NULL,
  [exception_reason] NVARCHAR(2000) NULL,
  [exception_expires_date] DATE NULL,
  [source] NVARCHAR(255) NULL,
  CONSTRAINT [PK_server_patch_observation] PRIMARY KEY ([snapshot_id], [asset_id]),
  CONSTRAINT [FK_server_patch_observation_asset] FOREIGN KEY ([snapshot_id], [asset_id])
    REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
  CONSTRAINT [CK_server_patch_missing] CHECK ([missing_updates] IS NULL OR [missing_updates] >= 0),
  CONSTRAINT [CK_server_patch_critical] CHECK ([missing_critical_updates] IS NULL OR
    ([missing_critical_updates] >= 0 AND ([missing_updates] IS NULL OR [missing_critical_updates] <= [missing_updates]))),
  CONSTRAINT [CK_server_patch_deployment] CHECK ([deployment_status] IS NULL OR [deployment_status] IN
    (N'Succeeded', N'Failed', N'In progress', N'Scheduled', N'Unknown'))
);
END;
COMMIT TRANSACTION;
GO

