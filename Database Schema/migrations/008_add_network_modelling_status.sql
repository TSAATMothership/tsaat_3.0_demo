SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH(N'tsaat.managed_network', N'modelling_status') IS NULL
BEGIN
  ALTER TABLE [tsaat].[managed_network]
  ADD [modelling_status] BIT NOT NULL
    CONSTRAINT [DF_managed_network_modelling_status] DEFAULT (0) WITH VALUES;
END;
GO

UPDATE [tsaat].[managed_network]
SET [modelling_status] =
  CASE
    WHEN [discovery_status] = N'Discovery Non Enabled' THEN 0
    ELSE 1
  END
WHERE [modelling_status] <>
  CASE
    WHEN [discovery_status] = N'Discovery Non Enabled' THEN 0
    ELSE 1
  END;
GO
