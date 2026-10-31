-- IP Nodes are observed addresses with no identified endpoint type.
SET XACT_ABORT ON;
IF COL_LENGTH(N'tsaat.asset', N'discovery_approach') IS NULL
  ALTER TABLE tsaat.asset ADD discovery_approach NVARCHAR(20) NULL;
IF COL_LENGTH(N'tsaat.asset', N'arp_owner_asset_id') IS NULL
  ALTER TABLE tsaat.asset ADD arp_owner_asset_id NVARCHAR(255) NULL;
GO
BEGIN TRANSACTION;
DECLARE @table SYSNAME, @constraint SYSNAME, @sql NVARCHAR(MAX);
DECLARE types_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT table_name, constraint_name FROM (VALUES
  (N'asset', N'CK_asset_type'),
  (N'spi_applicable_asset_type', N'CK_spi_applicable_asset_type_asset_type'),
  (N'network_target_state_asset', N'CK_network_target_state_asset_asset_type'),
  (N'discovery_tool_asset_scope', N'CK_discovery_tool_asset_scope_asset_type'),
  (N'measures_severity_matrix', N'CK_measures_severity_matrix_asset_type')
) v(table_name, constraint_name);
OPEN types_cursor;
FETCH NEXT FROM types_cursor INTO @table, @constraint;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'tsaat.' + @table) AND name = @constraint)
  BEGIN
    SET @sql = N'ALTER TABLE tsaat.' + QUOTENAME(@table) + N' DROP CONSTRAINT ' + QUOTENAME(@constraint);
    EXEC sp_executesql @sql;
  END;
  SET @sql = N'ALTER TABLE tsaat.' + QUOTENAME(@table) + N' WITH CHECK ADD CONSTRAINT ' + QUOTENAME(@constraint)
    + N' CHECK (asset_type IN (N''server'', N''workstation'', N''network-device'', N''storage-device'', N''printer-device'', N''other'', N''ip-node''));';
  EXEC sp_executesql @sql;
  FETCH NEXT FROM types_cursor INTO @table, @constraint;
END;
CLOSE types_cursor;
DEALLOCATE types_cursor;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_asset_arp_owner')
  ALTER TABLE tsaat.asset WITH CHECK ADD CONSTRAINT FK_asset_arp_owner
    FOREIGN KEY (snapshot_id, network_id, arp_owner_asset_id) REFERENCES tsaat.asset(snapshot_id, network_id, asset_id);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_asset_ip_node_discovery')
  ALTER TABLE tsaat.asset WITH CHECK ADD CONSTRAINT CK_asset_ip_node_discovery CHECK (
    (asset_type = N'ip-node' AND discovery_approach IS NOT NULL AND ip_address IS NOT NULL AND LTRIM(RTRIM(ip_address)) <> N'' AND
      ((discovery_approach = N'IP Scan' AND arp_owner_asset_id IS NULL) OR
       (discovery_approach = N'ARP Table' AND arp_owner_asset_id IS NOT NULL AND arp_owner_asset_id <> asset_id)))
    OR (asset_type <> N'ip-node' AND discovery_approach IS NULL AND arp_owner_asset_id IS NULL)
  );

-- Unidentified nodes have no assumed tool coverage requirements; settings may be configured later.
INSERT INTO tsaat.discovery_tool_asset_scope (settings_version_id, tool_id, asset_type, scope_setting)
SELECT t.settings_version_id, t.tool_id, N'ip-node', N'na' FROM tsaat.discovery_tool t
WHERE NOT EXISTS (SELECT 1 FROM tsaat.discovery_tool_asset_scope s WHERE s.settings_version_id = t.settings_version_id AND s.tool_id = t.tool_id AND s.asset_type = N'ip-node');
COMMIT TRANSACTION;
GO
CREATE OR ALTER TRIGGER tsaat.tr_asset_arp_owner_identified ON tsaat.asset AFTER INSERT, UPDATE AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1 FROM tsaat.asset node JOIN tsaat.asset owner ON owner.snapshot_id = node.snapshot_id AND owner.asset_id = node.arp_owner_asset_id
    WHERE node.asset_type = N'ip-node' AND owner.asset_type = N'ip-node'
      AND EXISTS (SELECT 1 FROM inserted i WHERE i.snapshot_id = node.snapshot_id AND i.asset_id IN (node.asset_id, owner.asset_id))
  ) THROW 51003, 'An ARP table must belong to an identified endpoint, not another IP Node.', 1;
END;
GO
