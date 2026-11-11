-- CMDB field catalogue and independently configurable attribute sets by asset type.
-- Values remain in the existing snapshot-aware asset and related tables.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @InitializeCmdbMappings BIT = CASE
  WHEN OBJECT_ID(N'tsaat.cmdb_asset_type_attribute', N'U') IS NULL THEN 1 ELSE 0 END;

IF OBJECT_ID(N'tsaat.cmdb_attribute_definition', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[cmdb_attribute_definition] (
    [attribute_key] NVARCHAR(64) NOT NULL,
    [label] NVARCHAR(100) NOT NULL,
    CONSTRAINT [PK_cmdb_attribute_definition] PRIMARY KEY ([attribute_key]),
    CONSTRAINT [CK_cmdb_attribute_definition_key] CHECK ([attribute_key] IN (
      N'assetId', N'assetName', N'assetHostname', N'assetType', N'assetIpAddress',
      N'networkName', N'systemName', N'environmentType', N'securityDomain',
      N'lifecycleEolStatus', N'lifecycleWarrantyStatus', N'operatingSystemSummary',
      N'networkOsSummary', N'patchStateSummary', N'installedSoftwareCount',
      N'vulnerabilityCount', N'criticalVulnerabilityCount', N'cmdbRecordUrl'
    )),
    CONSTRAINT [CK_cmdb_attribute_definition_label] CHECK (LEN(LTRIM(RTRIM([label]))) > 0)
  );
END;

IF OBJECT_ID(N'tsaat.cmdb_asset_type_attribute', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[cmdb_asset_type_attribute] (
    [asset_type] NVARCHAR(20) NOT NULL,
    [attribute_key] NVARCHAR(64) NOT NULL,
    [display_order] INT NOT NULL,
    [is_enabled] BIT NOT NULL CONSTRAINT [DF_cmdb_asset_type_attribute_enabled] DEFAULT (1),
    CONSTRAINT [PK_cmdb_asset_type_attribute] PRIMARY KEY ([asset_type], [attribute_key]),
    CONSTRAINT [FK_cmdb_asset_type_attribute_definition] FOREIGN KEY ([attribute_key])
      REFERENCES [tsaat].[cmdb_attribute_definition] ([attribute_key]),
    CONSTRAINT [CK_cmdb_asset_type_attribute_type] CHECK ([asset_type] IN (
      N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other', N'ip-node'
    )),
    CONSTRAINT [CK_cmdb_asset_type_attribute_order] CHECK ([display_order] >= 0)
  );
END;

DECLARE @CmdbDefaults TABLE ([attribute_key] NVARCHAR(64), [label] NVARCHAR(100), [display_order] INT);
INSERT INTO @CmdbDefaults ([attribute_key], [label], [display_order]) VALUES
  (N'assetId', N'Asset ID', 10),
  (N'assetName', N'Name', 20),
  (N'assetHostname', N'Hostname', 30),
  (N'assetType', N'Asset Type', 40),
  (N'assetIpAddress', N'IP Address', 50),
  (N'networkName', N'Network', 60),
  (N'systemName', N'ICT System', 70),
  (N'environmentType', N'Environment', 80),
  (N'securityDomain', N'Security Domain', 90),
  (N'lifecycleEolStatus', N'Lifecycle EOL', 100),
  (N'lifecycleWarrantyStatus', N'Warranty', 110),
  (N'operatingSystemSummary', N'Operating System', 120),
  (N'networkOsSummary', N'Network OS', 130),
  (N'patchStateSummary', N'Patch Status', 140),
  (N'installedSoftwareCount', N'Installed Software', 150),
  (N'vulnerabilityCount', N'Vulnerabilities', 160),
  (N'criticalVulnerabilityCount', N'Critical Vulnerabilities', 170),
  (N'cmdbRecordUrl', N'CMDB Record', 180);

INSERT INTO [tsaat].[cmdb_attribute_definition] ([attribute_key], [label])
SELECT d.[attribute_key], d.[label] FROM @CmdbDefaults AS d
WHERE NOT EXISTS (SELECT 1 FROM [tsaat].[cmdb_attribute_definition] AS existing
  WHERE existing.[attribute_key] = d.[attribute_key]);

-- Seed only on installation: re-running this migration must preserve later mappings,
-- including disabled or deleted attributes and deliberately empty attribute sets.
IF @InitializeCmdbMappings = 1
BEGIN
  INSERT INTO [tsaat].[cmdb_asset_type_attribute] ([asset_type], [attribute_key], [display_order], [is_enabled])
  SELECT t.[asset_type], d.[attribute_key], d.[display_order], 1
  FROM (VALUES (N'server'), (N'workstation'), (N'network-device'), (N'storage-device'),
    (N'printer-device'), (N'other'), (N'ip-node')) AS t([asset_type])
  CROSS JOIN @CmdbDefaults AS d;
END;

COMMIT TRANSACTION;
GO
