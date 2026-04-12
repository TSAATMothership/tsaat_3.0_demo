SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'[tsaat].[ci_dependency]', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[ci_dependency] (
    [snapshot_id] BIGINT NOT NULL,
    [dependency_id] NVARCHAR(255) NOT NULL,
    [source_asset_id] NVARCHAR(255) NOT NULL,
    [target_asset_id] NVARCHAR(255) NOT NULL,
    [dependency_type] NVARCHAR(30) NOT NULL,
    [flow_protocol] NVARCHAR(20) NULL,
    [source_port] INT NULL,
    [target_port] INT NULL,
    [observation_method] NVARCHAR(255) NULL,
    [observed_at] DATETIMEOFFSET(7) NULL,
    [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_ci_dependency_created_at_utc] DEFAULT (SYSUTCDATETIME()),
    [created_by] SYSNAME NOT NULL CONSTRAINT [DF_ci_dependency_created_by] DEFAULT (SUSER_SNAME()),
    [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_ci_dependency_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
    [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_ci_dependency_updated_by] DEFAULT (SUSER_SNAME()),
    [row_version] ROWVERSION NOT NULL,
    CONSTRAINT [PK_ci_dependency] PRIMARY KEY CLUSTERED ([snapshot_id], [dependency_id]),
    CONSTRAINT [FK_ci_dependency_snapshot]
      FOREIGN KEY ([snapshot_id]) REFERENCES [tsaat].[dataset_snapshot]([snapshot_id]),
    CONSTRAINT [FK_ci_dependency_source_asset]
      FOREIGN KEY ([snapshot_id], [source_asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
    CONSTRAINT [FK_ci_dependency_target_asset]
      FOREIGN KEY ([snapshot_id], [target_asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
    CONSTRAINT [CK_ci_dependency_not_self] CHECK ([source_asset_id] <> [target_asset_id]),
    CONSTRAINT [CK_ci_dependency_type]
      CHECK ([dependency_type] IN (N'Logical Dependency', N'Flow Dependency')),
    CONSTRAINT [CK_ci_dependency_source_port]
      CHECK ([source_port] IS NULL OR ([source_port] BETWEEN 1 AND 65535)),
    CONSTRAINT [CK_ci_dependency_target_port]
      CHECK ([target_port] IS NULL OR ([target_port] BETWEEN 1 AND 65535))
  );
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE [name] = N'IX_ci_dependency_source'
    AND [object_id] = OBJECT_ID(N'[tsaat].[ci_dependency]')
)
BEGIN
  CREATE INDEX [IX_ci_dependency_source] ON [tsaat].[ci_dependency] ([snapshot_id], [source_asset_id]);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE [name] = N'IX_ci_dependency_target'
    AND [object_id] = OBJECT_ID(N'[tsaat].[ci_dependency]')
)
BEGIN
  CREATE INDEX [IX_ci_dependency_target] ON [tsaat].[ci_dependency] ([snapshot_id], [target_asset_id]);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE [name] = N'IX_ci_dependency_type'
    AND [object_id] = OBJECT_ID(N'[tsaat].[ci_dependency]')
)
BEGIN
  CREATE INDEX [IX_ci_dependency_type] ON [tsaat].[ci_dependency] ([snapshot_id], [dependency_type]);
END;
GO
