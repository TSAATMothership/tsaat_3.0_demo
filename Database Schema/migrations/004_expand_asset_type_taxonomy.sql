SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'tsaat.asset', N'U') IS NOT NULL
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE [name] = N'CK_asset_type'
      AND [parent_object_id] = OBJECT_ID(N'tsaat.asset', N'U')
  )
  BEGIN
    ALTER TABLE [tsaat].[asset] DROP CONSTRAINT [CK_asset_type];
  END;

  ALTER TABLE [tsaat].[asset]
  ADD CONSTRAINT [CK_asset_type]
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other'));
END;
GO

IF OBJECT_ID(N'tsaat.spi_applicable_asset_type', N'U') IS NOT NULL
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE [name] = N'CK_spi_applicable_asset_type_asset_type'
      AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_applicable_asset_type', N'U')
  )
  BEGIN
    ALTER TABLE [tsaat].[spi_applicable_asset_type] DROP CONSTRAINT [CK_spi_applicable_asset_type_asset_type];
  END;

  ALTER TABLE [tsaat].[spi_applicable_asset_type]
  ADD CONSTRAINT [CK_spi_applicable_asset_type_asset_type]
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other'));
END;
GO

IF OBJECT_ID(N'tsaat.discovery_tool_asset_scope', N'U') IS NOT NULL
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE [name] = N'CK_discovery_tool_asset_scope_asset_type'
      AND [parent_object_id] = OBJECT_ID(N'tsaat.discovery_tool_asset_scope', N'U')
  )
  BEGIN
    ALTER TABLE [tsaat].[discovery_tool_asset_scope] DROP CONSTRAINT [CK_discovery_tool_asset_scope_asset_type];
  END;

  ALTER TABLE [tsaat].[discovery_tool_asset_scope]
  ADD CONSTRAINT [CK_discovery_tool_asset_scope_asset_type]
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other'));
END;
GO

IF OBJECT_ID(N'tsaat.measures_severity_matrix', N'U') IS NOT NULL
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE [name] = N'CK_measures_severity_matrix_asset_type'
      AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_severity_matrix', N'U')
  )
  BEGIN
    ALTER TABLE [tsaat].[measures_severity_matrix] DROP CONSTRAINT [CK_measures_severity_matrix_asset_type];
  END;

  ALTER TABLE [tsaat].[measures_severity_matrix]
  ADD CONSTRAINT [CK_measures_severity_matrix_asset_type]
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other'));
END;
GO
