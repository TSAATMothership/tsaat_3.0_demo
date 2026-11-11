SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'tsaat.network_target_state_asset', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[network_target_state_asset] (
    [snapshot_id] BIGINT NOT NULL,
    [network_id] NVARCHAR(255) NOT NULL,
    [asset_type] NVARCHAR(20) NOT NULL,
    [asset_name] NVARCHAR(255) NOT NULL,
    CONSTRAINT [PK_network_target_state_asset] PRIMARY KEY CLUSTERED ([snapshot_id], [network_id], [asset_type], [asset_name]),
    CONSTRAINT [FK_network_target_state_asset_network]
      FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
    CONSTRAINT [CK_network_target_state_asset_asset_type]
      CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other'))
  );
END;
GO
