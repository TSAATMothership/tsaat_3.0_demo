SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH(N'tsaat.managed_network', N'adf_platform') IS NULL
BEGIN
  ALTER TABLE [tsaat].[managed_network]
  ADD [adf_platform] BIT NOT NULL
    CONSTRAINT [DF_managed_network_adf_platform] DEFAULT (0) WITH VALUES;
END;
GO

IF COL_LENGTH(N'tsaat.managed_network', N'enterprise_platform') IS NULL
BEGIN
  ALTER TABLE [tsaat].[managed_network]
  ADD [enterprise_platform] BIT NOT NULL
    CONSTRAINT [DF_managed_network_enterprise_platform] DEFAULT (0) WITH VALUES;
END;
GO

IF COL_LENGTH(N'tsaat.ict_system', N'adf_platform') IS NULL
BEGIN
  ALTER TABLE [tsaat].[ict_system]
  ADD [adf_platform] BIT NOT NULL
    CONSTRAINT [DF_ict_system_adf_platform] DEFAULT (0) WITH VALUES;
END;
GO

IF COL_LENGTH(N'tsaat.ict_system', N'enterprise_platform') IS NULL
BEGIN
  ALTER TABLE [tsaat].[ict_system]
  ADD [enterprise_platform] BIT NOT NULL
    CONSTRAINT [DF_ict_system_enterprise_platform] DEFAULT (0) WITH VALUES;
END;
GO
