-- Add CMDB mappings for existing business-service and mission-capability model CIs.
-- Does not alter endpoint inventory, association records, snapshots or calculations.
-- Back up the selected database; apply with sqlcmd -b. Re-running preserves custom/empty mappings.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'tsaat.cmdb_asset_type_attribute', N'U') IS NULL
  THROW 51032, 'Apply CMDB migration 025 to the selected TSAAT database first.', 1;

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
  WHERE [major_id] = OBJECT_ID(N'tsaat.cmdb_asset_type_attribute') AND [minor_id] = 0 AND [name] = N'TSAAT_Model_CI_Mappings_v1')
BEGIN
  ALTER TABLE [tsaat].[cmdb_attribute_definition] DROP CONSTRAINT [CK_cmdb_attribute_definition_key];
  ALTER TABLE [tsaat].[cmdb_attribute_definition] WITH CHECK ADD CONSTRAINT [CK_cmdb_attribute_definition_key] CHECK ([attribute_key] IN (
    N'assetId', N'assetName', N'assetHostname', N'assetType', N'assetIpAddress', N'networkName', N'systemName', N'environmentType', N'securityDomain',
    N'lifecycleEolStatus', N'lifecycleWarrantyStatus', N'operatingSystemSummary', N'networkOsSummary', N'patchStateSummary', N'installedSoftwareCount',
    N'vulnerabilityCount', N'criticalVulnerabilityCount', N'cmdbRecordUrl',
    N'ciId', N'ciName', N'ciType', N'criticality', N'relatedSystems', N'relatedNetworks', N'relatedSecurityDomains'
  ));
  ALTER TABLE [tsaat].[cmdb_asset_type_attribute] DROP CONSTRAINT [CK_cmdb_asset_type_attribute_type];
  ALTER TABLE [tsaat].[cmdb_asset_type_attribute] WITH CHECK ADD CONSTRAINT [CK_cmdb_asset_type_attribute_type] CHECK ([asset_type] IN (
    N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other', N'ip-node', N'business-service', N'mission-capability'
  ));
  DECLARE @defaults TABLE ([attribute_key] NVARCHAR(64), [label] NVARCHAR(100), [display_order] INT);
  INSERT INTO @defaults VALUES
    (N'ciId', N'CI ID', 10), (N'ciName', N'CI Name', 20), (N'ciType', N'CI Type', 30),
    (N'criticality', N'Recorded criticality', 40), (N'relatedSystems', N'Related ICT systems and criticality', 50),
    (N'relatedNetworks', N'Related managed networks', 60), (N'relatedSecurityDomains', N'Related system security domains', 70);
  INSERT INTO [tsaat].[cmdb_attribute_definition] ([attribute_key], [label])
  SELECT d.[attribute_key], d.[label] FROM @defaults d
  WHERE NOT EXISTS (SELECT 1 FROM [tsaat].[cmdb_attribute_definition] old WHERE old.[attribute_key] = d.[attribute_key]);
  -- Preserve any already-configured set; the version marker also preserves deleted/empty sets on rerun.
  INSERT INTO [tsaat].[cmdb_asset_type_attribute] ([asset_type], [attribute_key], [display_order], [is_enabled])
  SELECT t.[asset_type], d.[attribute_key], d.[display_order], 1
  FROM (VALUES (N'business-service'), (N'mission-capability')) t([asset_type]) CROSS JOIN @defaults d
  WHERE NOT EXISTS (SELECT 1 FROM [tsaat].[cmdb_asset_type_attribute] old WHERE old.[asset_type] = t.[asset_type]);
  EXEC sys.sp_addextendedproperty @name=N'TSAAT_Model_CI_Mappings_v1', @value=1,
    @level0type=N'SCHEMA', @level0name=N'tsaat', @level1type=N'TABLE', @level1name=N'cmdb_asset_type_attribute';
END;
COMMIT TRANSACTION;
GO
