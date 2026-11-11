/* TSAAT inventory storage v2. Fresh, guarded setup only; use migration 033 for upgrades.
   Snapshot identity, CMDB, inventory, discovery rules and topology relationships are retained. */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'tsaat')
BEGIN
  DECLARE @dropRoutineSql NVARCHAR(MAX) = N'';
  SELECT
    @dropRoutineSql = @dropRoutineSql +
    N'DROP ' +
    CASE
      WHEN o.[type] = N'V' THEN N'VIEW '
      WHEN o.[type] = N'P' THEN N'PROCEDURE '
      ELSE N'FUNCTION '
    END +
    QUOTENAME(s.name) + N'.' + QUOTENAME(o.name) + N';' + CHAR(13) + CHAR(10)
  FROM sys.objects o
  INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
  WHERE s.name = N'tsaat'
    AND o.[type] IN (N'V', N'P', N'FN', N'IF', N'TF');

  IF LEN(@dropRoutineSql) > 0
  BEGIN
    EXEC sp_executesql @dropRoutineSql;
  END

  DECLARE @dropFkSql NVARCHAR(MAX) = N'';
  SELECT
    @dropFkSql = @dropFkSql +
    N'ALTER TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) +
    N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';' + CHAR(13) + CHAR(10)
  FROM sys.foreign_keys fk
  INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'tsaat';

  IF LEN(@dropFkSql) > 0
  BEGIN
    EXEC sp_executesql @dropFkSql;
  END

  DECLARE @dropTableSql NVARCHAR(MAX) = N'';
  SELECT
    @dropTableSql = @dropTableSql +
    N'DROP TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N';' + CHAR(13) + CHAR(10)
  FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'tsaat';

  IF LEN(@dropTableSql) > 0
  BEGIN
    EXEC sp_executesql @dropTableSql;
  END
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'tsaat')
BEGIN
  EXEC(N'CREATE SCHEMA [tsaat]');
END
GO

CREATE TABLE [tsaat].[dataset_snapshot] (
  [snapshot_id] BIGINT IDENTITY(1,1) NOT NULL,
  [snapshot_date] DATE NOT NULL,
  [generated_at] DATETIMEOFFSET(7) NOT NULL,
  [source_label] NVARCHAR(100) NULL,
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_dataset_snapshot_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_dataset_snapshot_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_dataset_snapshot_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_dataset_snapshot_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
  CONSTRAINT [PK_dataset_snapshot] PRIMARY KEY CLUSTERED ([snapshot_id]),
  CONSTRAINT [UQ_dataset_snapshot_snapshot_date] UNIQUE ([snapshot_date])
);
GO

CREATE TABLE [tsaat].[managed_network] (
  [snapshot_id] BIGINT NOT NULL,
  [network_id] NVARCHAR(255) NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [criticality] NVARCHAR(20) NOT NULL,
  [adf_platform] BIT NOT NULL,
  [enterprise_platform] BIT NOT NULL,
  [modelling_status] BIT NOT NULL,
  [classification] NVARCHAR(255) NULL,
  [security_domain] NVARCHAR(20) NOT NULL CONSTRAINT [DF_managed_network_security_domain] DEFAULT (N'UNKNOWN'),
  [description] NVARCHAR(2000) NULL,
  [owner] NVARCHAR(255) NULL,
  [support_email] NVARCHAR(320) NULL,
  [service_catalogue_url] NVARCHAR(1024) NULL,
  [diis_id] NVARCHAR(100) NULL,
  [ato_number] NVARCHAR(100) NULL,
  [diis_url] NVARCHAR(1024) NULL,
  [grc_url] NVARCHAR(1024) NULL,
  [discovery_status] NVARCHAR(40) NOT NULL,
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_managed_network_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_managed_network_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_managed_network_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_managed_network_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
  CONSTRAINT [PK_managed_network] PRIMARY KEY CLUSTERED ([snapshot_id], [network_id]),
  CONSTRAINT [FK_managed_network_snapshot]
    FOREIGN KEY ([snapshot_id]) REFERENCES [tsaat].[dataset_snapshot]([snapshot_id]),
  CONSTRAINT [CK_managed_network_security_domain]
    CHECK ([security_domain] COLLATE Latin1_General_100_BIN2 IN (N'PROTECTED', N'SECRET', N'UNKNOWN')),
  CONSTRAINT [CK_managed_network_criticality]
    CHECK ([criticality] IN (N'Critical', N'Non-Critical')),
  CONSTRAINT [CK_managed_network_discovery_status]
    CHECK ([discovery_status] IN (N'Discovery Enabled', N'Discovery Non Enabled'))
);
GO

CREATE TABLE [tsaat].[managed_network_hierarchy] (
  [snapshot_id] BIGINT NOT NULL,
  [parent_network_id] NVARCHAR(255) NOT NULL,
  [child_network_id] NVARCHAR(255) NOT NULL,
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_managed_network_hierarchy_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_managed_network_hierarchy_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_managed_network_hierarchy_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_managed_network_hierarchy_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
  CONSTRAINT [PK_managed_network_hierarchy] PRIMARY KEY CLUSTERED ([snapshot_id], [parent_network_id], [child_network_id]),
  CONSTRAINT [FK_managed_network_hierarchy_parent]
    FOREIGN KEY ([snapshot_id], [parent_network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
  CONSTRAINT [FK_managed_network_hierarchy_child]
    FOREIGN KEY ([snapshot_id], [child_network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
  CONSTRAINT [CK_managed_network_hierarchy_not_self] CHECK ([parent_network_id] <> [child_network_id])
);
GO

CREATE TABLE [tsaat].[ict_system] (
  [snapshot_id] BIGINT NOT NULL,
  [system_id] NVARCHAR(255) NOT NULL,
  [network_id] NVARCHAR(255) NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [adf_platform] BIT NOT NULL,
  [enterprise_platform] BIT NOT NULL,
  [description] NVARCHAR(2000) NULL,
  [diis_id] NVARCHAR(100) NULL,
  [owner] NVARCHAR(255) NULL,
  [support_email] NVARCHAR(320) NULL,
  [service_catalogue_url] NVARCHAR(1024) NULL,
  [ato_number] NVARCHAR(100) NULL,
  [apm_number] NVARCHAR(100) NULL,
  [diis_url] NVARCHAR(1024) NULL,
  [grc_url] NVARCHAR(1024) NULL,
  [modelling_status] BIT NOT NULL,
  [diis_defined] BIT NOT NULL,
  [criticality] NVARCHAR(20) NOT NULL,
  [security_domain] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ict_system_security_domain] DEFAULT (N'UNKNOWN'),
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_ict_system_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_ict_system_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_ict_system_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_ict_system_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
  CONSTRAINT [PK_ict_system] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id]),
  CONSTRAINT [UQ_ict_system_snapshot_system_network] UNIQUE ([snapshot_id], [system_id], [network_id]),
  CONSTRAINT [FK_ict_system_snapshot]
    FOREIGN KEY ([snapshot_id]) REFERENCES [tsaat].[dataset_snapshot]([snapshot_id]),
  CONSTRAINT [FK_ict_system_network]
    FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
  CONSTRAINT [CK_ict_system_criticality]
    CHECK ([criticality] IN (N'Critical', N'Non-Critical')),
  CONSTRAINT [CK_ict_system_security_domain]
    CHECK ([security_domain] COLLATE Latin1_General_100_BIN2 IN (N'PROTECTED', N'SECRET', N'UNKNOWN'))
);
GO

CREATE TABLE [tsaat].[ict_system_hierarchy] (
  [snapshot_id] BIGINT NOT NULL,
  [parent_system_id] NVARCHAR(255) NOT NULL,
  [child_system_id] NVARCHAR(255) NOT NULL,
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_ict_system_hierarchy_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_ict_system_hierarchy_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_ict_system_hierarchy_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_ict_system_hierarchy_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
  CONSTRAINT [PK_ict_system_hierarchy] PRIMARY KEY CLUSTERED ([snapshot_id], [parent_system_id], [child_system_id]),
  CONSTRAINT [FK_ict_system_hierarchy_parent]
    FOREIGN KEY ([snapshot_id], [parent_system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
  CONSTRAINT [FK_ict_system_hierarchy_child]
    FOREIGN KEY ([snapshot_id], [child_system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
  CONSTRAINT [CK_ict_system_hierarchy_not_self] CHECK ([parent_system_id] <> [child_system_id])
);
GO

CREATE TABLE [tsaat].[network_declared_system] (
  [snapshot_id] BIGINT NOT NULL,
  [network_id] NVARCHAR(255) NOT NULL,
  [system_id] NVARCHAR(255) NOT NULL,
  CONSTRAINT [PK_network_declared_system] PRIMARY KEY CLUSTERED ([snapshot_id], [network_id], [system_id]),
  CONSTRAINT [FK_network_declared_system_network]
    FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
  CONSTRAINT [FK_network_declared_system_system]
    FOREIGN KEY ([snapshot_id], [system_id], [network_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id], [network_id])
);
GO

CREATE TABLE [tsaat].[system_mission_capability] (
  [snapshot_id] BIGINT NOT NULL,
  [system_id] NVARCHAR(255) NOT NULL,
  [mission_capability_id] NVARCHAR(255) NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [criticality] NVARCHAR(20) NOT NULL,
  CONSTRAINT [PK_system_mission_capability] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id], [mission_capability_id]),
  CONSTRAINT [FK_system_mission_capability_system]
    FOREIGN KEY ([snapshot_id], [system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
  CONSTRAINT [CK_system_mission_capability_criticality]
    CHECK ([criticality] IN (N'Critical', N'Non-Critical'))
);
GO

CREATE TABLE [tsaat].[system_business_service] (
  [snapshot_id] BIGINT NOT NULL,
  [system_id] NVARCHAR(255) NOT NULL,
  [business_service_id] NVARCHAR(255) NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [criticality] NVARCHAR(20) NOT NULL,
  CONSTRAINT [PK_system_business_service] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id], [business_service_id]),
  CONSTRAINT [FK_system_business_service_system]
    FOREIGN KEY ([snapshot_id], [system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
  CONSTRAINT [CK_system_business_service_criticality]
    CHECK ([criticality] IN (N'Critical', N'Non-Critical'))
);
GO

CREATE TABLE [tsaat].[system_environment] (
  [snapshot_id] BIGINT NOT NULL,
  [system_id] NVARCHAR(255) NOT NULL,
  [environment_id] NVARCHAR(255) NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [environment_type] NVARCHAR(20) NOT NULL,
  CONSTRAINT [PK_system_environment] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id], [environment_id]),
  CONSTRAINT [UQ_system_environment_type] UNIQUE ([snapshot_id], [system_id], [environment_type]),
  CONSTRAINT [UQ_system_environment_full] UNIQUE ([snapshot_id], [system_id], [environment_id], [environment_type]),
  CONSTRAINT [FK_system_environment_system]
    FOREIGN KEY ([snapshot_id], [system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
  CONSTRAINT [CK_system_environment_type]
    CHECK ([environment_type] IN (N'Production', N'Development', N'UAT', N'Test'))
);
GO

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
      N'vulnerabilityCount', N'criticalVulnerabilityCount', N'cmdbRecordUrl',
      N'ciId', N'ciName', N'ciType', N'criticality', N'relatedSystems', N'relatedNetworks', N'relatedSecurityDomains'
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
      N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other', N'ip-node', N'business-service', N'mission-capability'
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
  (N'cmdbRecordUrl', N'CMDB Record', 180),
  (N'ciId', N'CI ID', 10),
  (N'ciName', N'CI Name', 20),
  (N'ciType', N'CI Type', 30),
  (N'criticality', N'Recorded criticality', 40),
  (N'relatedSystems', N'Related ICT systems and criticality', 50),
  (N'relatedNetworks', N'Related managed networks', 60),
  (N'relatedSecurityDomains', N'Related system security domains', 70);

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
  CROSS JOIN @CmdbDefaults AS d WHERE d.[attribute_key] NOT IN (N'ciId', N'ciName', N'ciType', N'criticality', N'relatedSystems', N'relatedNetworks', N'relatedSecurityDomains');
  INSERT INTO [tsaat].[cmdb_asset_type_attribute] ([asset_type], [attribute_key], [display_order], [is_enabled])
  SELECT t.[asset_type], d.[attribute_key], d.[display_order], 1
  FROM (VALUES (N'business-service'), (N'mission-capability')) AS t([asset_type])
  CROSS JOIN @CmdbDefaults AS d WHERE d.[attribute_key] IN (N'ciId', N'ciName', N'ciType', N'criticality', N'relatedSystems', N'relatedNetworks', N'relatedSecurityDomains');
  EXEC sys.sp_addextendedproperty @name=N'TSAAT_Model_CI_Mappings_v1', @value=1,
    @level0type=N'SCHEMA', @level0name=N'tsaat', @level1type=N'TABLE', @level1name=N'cmdb_asset_type_attribute';
END;

COMMIT TRANSACTION;
GO

CREATE TABLE [tsaat].[asset] (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [hostname] NVARCHAR(255) NOT NULL,
  [ip_address] NVARCHAR(64) NULL,
  [mac_address] NVARCHAR(64) NULL,
  [device_model] NVARCHAR(255) NULL,
  [last_discovered_date] DATETIME2(3) NULL,
  [discovered_by] NVARCHAR(255) NULL,
  [discovery_approach] NVARCHAR(20) NULL,
  [arp_owner_asset_id] NVARCHAR(255) NULL,
  [cmdb_record_url] NVARCHAR(1024) NULL,
  [asset_type] NVARCHAR(20) NOT NULL,
  [network_id] NVARCHAR(255) NOT NULL,
  [security_domain] NVARCHAR(20) NOT NULL CONSTRAINT [DF_asset_security_domain] DEFAULT (N'UNKNOWN'),
  [system_id] NVARCHAR(255) NULL,
  [environment_type] NVARCHAR(20) NULL,
  [lifecycle_eol_status] NVARCHAR(20) NOT NULL,
  [lifecycle_warranty_status] NVARCHAR(20) NOT NULL,
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_asset_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_asset_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_asset_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_asset_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
  CONSTRAINT [PK_asset] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id]),
  CONSTRAINT [UQ_asset_snapshot_network_asset] UNIQUE ([snapshot_id], [network_id], [asset_id]),
  CONSTRAINT [UQ_asset_snapshot_system_asset] UNIQUE ([snapshot_id], [system_id], [asset_id]),
  CONSTRAINT [UQ_asset_snapshot_system_env_asset] UNIQUE ([snapshot_id], [system_id], [environment_type], [asset_id]),
  CONSTRAINT [FK_asset_arp_owner] FOREIGN KEY ([snapshot_id], [network_id], [arp_owner_asset_id])
    REFERENCES [tsaat].[asset]([snapshot_id], [network_id], [asset_id]),
  CONSTRAINT [CK_asset_ip_node_discovery] CHECK (
    ([asset_type] = N'ip-node' AND [discovery_approach] IS NOT NULL AND [ip_address] IS NOT NULL AND LTRIM(RTRIM([ip_address])) <> N'' AND
      (([discovery_approach] = N'IP Scan' AND [arp_owner_asset_id] IS NULL) OR
       ([discovery_approach] = N'ARP Table' AND [arp_owner_asset_id] IS NOT NULL AND [arp_owner_asset_id] <> [asset_id])))
    OR ([asset_type] <> N'ip-node' AND [discovery_approach] IS NULL AND [arp_owner_asset_id] IS NULL)
  ),
  CONSTRAINT [FK_asset_snapshot]
    FOREIGN KEY ([snapshot_id]) REFERENCES [tsaat].[dataset_snapshot]([snapshot_id]),
  CONSTRAINT [FK_asset_network]
    FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
  CONSTRAINT [FK_asset_system]
    FOREIGN KEY ([snapshot_id], [system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
  CONSTRAINT [FK_asset_system_network]
    FOREIGN KEY ([snapshot_id], [system_id], [network_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id], [network_id]),
  CONSTRAINT [FK_asset_system_environment]
    FOREIGN KEY ([snapshot_id], [system_id], [environment_type]) REFERENCES [tsaat].[system_environment]([snapshot_id], [system_id], [environment_type]),
  CONSTRAINT [CK_asset_type]
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other', N'ip-node')),
  CONSTRAINT [CK_asset_security_domain]
    CHECK ([security_domain] COLLATE Latin1_General_100_BIN2 IN (N'PROTECTED', N'SECRET', N'UNKNOWN')),
  CONSTRAINT [CK_asset_environment_type]
    CHECK ([environment_type] IS NULL OR [environment_type] IN (N'Production', N'Development', N'UAT', N'Test')),
  CONSTRAINT [CK_asset_lifecycle_eol_status]
    CHECK ([lifecycle_eol_status] IN (N'Supported', N'EOL', N'Unknown')),
  CONSTRAINT [CK_asset_lifecycle_warranty_status]
    CHECK ([lifecycle_warranty_status] IN (N'InWarranty', N'OutOfWarranty', N'Unknown')),
  CONSTRAINT [CK_asset_system_environment_pair]
    CHECK (
      ([system_id] IS NULL AND [environment_type] IS NULL)
      OR ([system_id] IS NOT NULL AND [environment_type] IS NOT NULL)
    )
);
GO

CREATE TABLE [tsaat].[network_declared_asset] (
  [snapshot_id] BIGINT NOT NULL,
  [network_id] NVARCHAR(255) NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  CONSTRAINT [PK_network_declared_asset] PRIMARY KEY CLUSTERED ([snapshot_id], [network_id], [asset_id]),
  CONSTRAINT [FK_network_declared_asset_network]
    FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
  CONSTRAINT [FK_network_declared_asset_asset]
    FOREIGN KEY ([snapshot_id], [network_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [network_id], [asset_id])
);
GO

CREATE TABLE [tsaat].[system_environment_asset] (
  [snapshot_id] BIGINT NOT NULL,
  [system_id] NVARCHAR(255) NOT NULL,
  [environment_id] NVARCHAR(255) NOT NULL,
  [environment_type] NVARCHAR(20) NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  CONSTRAINT [PK_system_environment_asset] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id], [environment_id], [asset_id]),
  CONSTRAINT [FK_system_environment_asset_environment]
    FOREIGN KEY ([snapshot_id], [system_id], [environment_id], [environment_type])
    REFERENCES [tsaat].[system_environment]([snapshot_id], [system_id], [environment_id], [environment_type]),
  CONSTRAINT [FK_system_environment_asset_asset]
    FOREIGN KEY ([snapshot_id], [system_id], [environment_type], [asset_id])
    REFERENCES [tsaat].[asset]([snapshot_id], [system_id], [environment_type], [asset_id]),
  CONSTRAINT [CK_system_environment_asset_environment_type]
    CHECK ([environment_type] IN (N'Production', N'Development', N'UAT', N'Test'))
);
GO

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
GO

CREATE TABLE [tsaat].[asset_operating_system] (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [family] NVARCHAR(255) NOT NULL,
  [vendor] NVARCHAR(255) NOT NULL,
  [version] NVARCHAR(255) NOT NULL,
  [patch_level] NVARCHAR(255) NULL,
  [support_status] NVARCHAR(20) NOT NULL,
  CONSTRAINT [PK_asset_operating_system] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id]),
  CONSTRAINT [FK_asset_operating_system_asset]
    FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
  CONSTRAINT [CK_asset_operating_system_support_status]
    CHECK ([support_status] IN (N'Supported', N'OutOfSupport', N'Unknown'))
);
GO

CREATE TABLE [tsaat].[asset_network_os] (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [family] NVARCHAR(255) NOT NULL,
  [vendor] NVARCHAR(255) NOT NULL,
  [version] NVARCHAR(255) NOT NULL,
  [patch_level] NVARCHAR(255) NULL,
  [support_status] NVARCHAR(20) NOT NULL,
  CONSTRAINT [PK_asset_network_os] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id]),
  CONSTRAINT [FK_asset_network_os_asset]
    FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
  CONSTRAINT [CK_asset_network_os_support_status]
    CHECK ([support_status] IN (N'Supported', N'OutOfSupport', N'Unknown'))
);
GO

CREATE TABLE [tsaat].[asset_patch_state] (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [is_latest] BIT NULL,
  [last_patched_date] DATE NULL,
  CONSTRAINT [PK_asset_patch_state] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id]),
  CONSTRAINT [FK_asset_patch_state_asset]
    FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id])
);
GO

CREATE TABLE [tsaat].[asset_installed_software] (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [software_ordinal] INT NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [version] NVARCHAR(255) NOT NULL,
  [file_path] NVARCHAR(2048) NULL,
  [last_discovered_date] DATETIME2(3) NULL,
  [discovered_by] NVARCHAR(255) NULL,
  [support_status] NVARCHAR(20) NOT NULL,
  CONSTRAINT [PK_asset_installed_software] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id], [software_ordinal]),
  CONSTRAINT [FK_asset_installed_software_asset]
    FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
  CONSTRAINT [CK_asset_installed_software_ordinal] CHECK ([software_ordinal] > 0),
  CONSTRAINT [CK_asset_installed_software_support_status]
    CHECK ([support_status] IN (N'Supported', N'OutOfSupport', N'Unknown'))
);
GO

CREATE TABLE [tsaat].[asset_vulnerability] (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [vulnerability_id] NVARCHAR(255) NOT NULL,
  [cve] NVARCHAR(255) NOT NULL,
  [cve_name] NVARCHAR(500) NULL,
  [cve_created_date] DATE NULL,
  [software_name] NVARCHAR(255) NULL,
  [software_version] NVARCHAR(100) NULL,
  [reference_url] NVARCHAR(2048) NULL,
  [description] NVARCHAR(MAX) NOT NULL,
  [remediation_guidance] NVARCHAR(MAX) NOT NULL,
  [criticality] NVARCHAR(20) NOT NULL,
  [severity] NVARCHAR(20) NOT NULL,
  [exploitability] NVARCHAR(30) NOT NULL,
  [detected_date] DATE NOT NULL,
  [captured_at] DATETIMEOFFSET(7) NOT NULL,
  [source] NVARCHAR(255) NOT NULL,
  CONSTRAINT [PK_asset_vulnerability] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id], [vulnerability_id]),
  CONSTRAINT [FK_asset_vulnerability_asset]
    FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
  CONSTRAINT [CK_asset_vulnerability_criticality]
    CHECK ([criticality] IN (N'Low', N'Medium', N'High', N'Critical')),
  CONSTRAINT [CK_asset_vulnerability_severity]
    CHECK ([severity] IN (N'Low', N'Medium', N'High', N'Critical')),
  CONSTRAINT [CK_asset_vulnerability_exploitability]
    CHECK ([exploitability] IN (N'No Known Exploit', N'Proof of Concept', N'Exploitable', N'Known Exploited'))
);
GO

CREATE TABLE [tsaat].[discovery_tools_settings_version] (
  [settings_version_id] BIGINT IDENTITY(1,1) NOT NULL,
  [updated_at] DATETIMEOFFSET(7) NOT NULL,
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_discovery_tools_settings_version_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_discovery_tools_settings_version_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_discovery_tools_settings_version_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_discovery_tools_settings_version_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
  CONSTRAINT [PK_discovery_tools_settings_version] PRIMARY KEY CLUSTERED ([settings_version_id]),
  CONSTRAINT [UQ_discovery_tools_settings_version_updated_at] UNIQUE ([updated_at])
);
GO

CREATE TABLE [tsaat].[discovery_tool] (
  [settings_version_id] BIGINT NOT NULL,
  [tool_id] NVARCHAR(255) NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL CONSTRAINT [DF_discovery_tool_description] DEFAULT (N''),
  [el2_owner] NVARCHAR(255) NOT NULL CONSTRAINT [DF_discovery_tool_el2_owner] DEFAULT (N''),
  [el2_operations_manager] NVARCHAR(255) NOT NULL CONSTRAINT [DF_discovery_tool_el2_operations_manager] DEFAULT (N''),
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_discovery_tool_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_discovery_tool_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_discovery_tool_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_discovery_tool_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
  CONSTRAINT [PK_discovery_tool] PRIMARY KEY CLUSTERED ([settings_version_id], [tool_id]),
  CONSTRAINT [FK_discovery_tool_version]
    FOREIGN KEY ([settings_version_id]) REFERENCES [tsaat].[discovery_tools_settings_version]([settings_version_id])
);
GO

CREATE TABLE [tsaat].[discovery_tool_asset_scope] (
  [settings_version_id] BIGINT NOT NULL,
  [tool_id] NVARCHAR(255) NOT NULL,
  [asset_type] NVARCHAR(20) NOT NULL,
  [scope_setting] NVARCHAR(20) NOT NULL,
  CONSTRAINT [PK_discovery_tool_asset_scope] PRIMARY KEY CLUSTERED ([settings_version_id], [tool_id], [asset_type]),
  CONSTRAINT [FK_discovery_tool_asset_scope_tool]
    FOREIGN KEY ([settings_version_id], [tool_id]) REFERENCES [tsaat].[discovery_tool]([settings_version_id], [tool_id]),
  CONSTRAINT [CK_discovery_tool_asset_scope_asset_type]
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other', N'ip-node')),
  CONSTRAINT [CK_discovery_tool_asset_scope_setting]
    CHECK ([scope_setting] IN (N'required', N'na'))
);
GO

CREATE TABLE [tsaat].[discovery_coverage_source] (
  [source_key] NVARCHAR(100) NOT NULL,
  [source_object_name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_discovery_coverage_source_enabled] DEFAULT (1),
  CONSTRAINT [PK_discovery_coverage_source] PRIMARY KEY CLUSTERED ([source_key]),
  CONSTRAINT [CK_discovery_coverage_source_key] CHECK (LEN(LTRIM(RTRIM([source_key]))) > 0)
);
GO

CREATE TABLE [tsaat].[discovery_tool_detection_definition] (
  [tool_id] NVARCHAR(255) NOT NULL,
  [display_order] INT NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_discovery_tool_detection_definition_enabled] DEFAULT (1),
  CONSTRAINT [PK_discovery_tool_detection_definition] PRIMARY KEY CLUSTERED ([tool_id]),
  CONSTRAINT [UQ_discovery_tool_detection_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_discovery_tool_detection_definition_display_order] CHECK ([display_order] > 0)
);
GO

CREATE TABLE [tsaat].[discovery_tool_detection_rule] (
  [detection_rule_id] BIGINT IDENTITY(1,1) NOT NULL,
  [tool_id] NVARCHAR(255) NOT NULL,
  [display_order] INT NOT NULL,
  [condition_key] NVARCHAR(80) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_discovery_tool_detection_rule_enabled] DEFAULT (1),
  CONSTRAINT [PK_discovery_tool_detection_rule] PRIMARY KEY CLUSTERED ([detection_rule_id]),
  CONSTRAINT [FK_discovery_tool_detection_rule_tool]
    FOREIGN KEY ([tool_id]) REFERENCES [tsaat].[discovery_tool_detection_definition]([tool_id]),
  CONSTRAINT [UQ_discovery_tool_detection_rule_order] UNIQUE ([tool_id], [display_order]),
  CONSTRAINT [CK_discovery_tool_detection_rule_display_order] CHECK ([display_order] > 0),
  CONSTRAINT [CK_discovery_tool_detection_rule_condition]
    CHECK ([condition_key] IN (
      N'has-system-context',
      N'asset-type-in',
      N'vulnerability-source-in',
      N'warranty-status-known',
      N'eol-status-known',
      N'has-vulnerability'
    ))
);
GO

CREATE TABLE [tsaat].[discovery_tool_detection_rule_value] (
  [detection_rule_id] BIGINT NOT NULL,
  [value_order] INT NOT NULL,
  [value_text] NVARCHAR(255) NOT NULL,
  CONSTRAINT [PK_discovery_tool_detection_rule_value] PRIMARY KEY CLUSTERED ([detection_rule_id], [value_order]),
  CONSTRAINT [FK_discovery_tool_detection_rule_value_rule]
    FOREIGN KEY ([detection_rule_id]) REFERENCES [tsaat].[discovery_tool_detection_rule]([detection_rule_id]),
  CONSTRAINT [CK_discovery_tool_detection_rule_value_order] CHECK ([value_order] > 0)
);
GO

CREATE INDEX [IX_ict_system_network] ON [tsaat].[ict_system] ([snapshot_id], [network_id]);
CREATE INDEX [IX_managed_network_hierarchy_parent] ON [tsaat].[managed_network_hierarchy] ([snapshot_id], [parent_network_id]);
CREATE INDEX [IX_managed_network_hierarchy_child] ON [tsaat].[managed_network_hierarchy] ([snapshot_id], [child_network_id]);
CREATE INDEX [IX_ict_system_hierarchy_parent] ON [tsaat].[ict_system_hierarchy] ([snapshot_id], [parent_system_id]);
CREATE INDEX [IX_ict_system_hierarchy_child] ON [tsaat].[ict_system_hierarchy] ([snapshot_id], [child_system_id]);
CREATE INDEX [IX_asset_network] ON [tsaat].[asset] ([snapshot_id], [network_id]);
CREATE INDEX [IX_asset_system] ON [tsaat].[asset] ([snapshot_id], [system_id]);
CREATE INDEX [IX_asset_type] ON [tsaat].[asset] ([snapshot_id], [asset_type]);
CREATE INDEX [IX_ci_dependency_source] ON [tsaat].[ci_dependency] ([snapshot_id], [source_asset_id]);
CREATE INDEX [IX_ci_dependency_target] ON [tsaat].[ci_dependency] ([snapshot_id], [target_asset_id]);
CREATE INDEX [IX_ci_dependency_type] ON [tsaat].[ci_dependency] ([snapshot_id], [dependency_type]);





GO

CREATE OR ALTER PROCEDURE [tsaat].[usp_evaluate_discovery_coverage_snapshot]
  @snapshot_id BIGINT,
  @asset_ids_json NVARCHAR(MAX) = NULL,
  @emit_json BIT = 0
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @hasAssetScope BIT = CASE WHEN ISJSON(@asset_ids_json) = 1 THEN 1 ELSE 0 END;
  DECLARE @AssetScope TABLE ([asset_id] NVARCHAR(255) NOT NULL PRIMARY KEY);
  IF @hasAssetScope = 1
  BEGIN
    INSERT INTO @AssetScope ([asset_id])
    SELECT DISTINCT CONVERT(NVARCHAR(255), [value])
    FROM OPENJSON(@asset_ids_json)
    WHERE [type] IN (1, 2) AND LEN(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [value])))) > 0;
  END;

  DECLARE @settingsVersionId BIGINT = (
    SELECT TOP (1) [settings_version_id]
    FROM [tsaat].[discovery_tools_settings_version]
    ORDER BY [updated_at] DESC, [settings_version_id] DESC
  );

  DECLARE @Coverage TABLE (
    [asset_id] NVARCHAR(255) NOT NULL,
    [tool_id] NVARCHAR(255) NOT NULL,
    [tool_name] NVARCHAR(255) NOT NULL,
    [display_order] INT NOT NULL,
    [coverage_value] INT NULL
  );

  INSERT INTO @Coverage ([asset_id], [tool_id], [tool_name], [display_order], [coverage_value])
  SELECT
    a.[asset_id],
    dt.[tool_id],
    dt.[name],
    COALESCE(dtd.[display_order], 100000),
    CASE
      WHEN dts.[scope_setting] = N'na' THEN NULL
      WHEN EXISTS (
        SELECT 1
        FROM [tsaat].[discovery_tool_detection_rule] AS dtr
        WHERE dtr.[tool_id] = dt.[tool_id]
          AND dtr.[enabled] = 1
          AND (
            (dtr.[condition_key] = N'has-system-context' AND a.[system_id] IS NOT NULL)
            OR (dtr.[condition_key] = N'asset-type-in' AND EXISTS (
              SELECT 1 FROM [tsaat].[discovery_tool_detection_rule_value] AS rv
              WHERE rv.[detection_rule_id] = dtr.[detection_rule_id] AND rv.[value_text] = a.[asset_type]
            ))
            OR (dtr.[condition_key] = N'vulnerability-source-in' AND EXISTS (
              SELECT 1
              FROM [tsaat].[asset_vulnerability] AS av
              INNER JOIN [tsaat].[discovery_tool_detection_rule_value] AS rv
                ON rv.[detection_rule_id] = dtr.[detection_rule_id] AND rv.[value_text] = av.[source]
              WHERE av.[snapshot_id] = a.[snapshot_id] AND av.[asset_id] = a.[asset_id]
            ))
            OR (dtr.[condition_key] = N'warranty-status-known' AND a.[lifecycle_warranty_status] <> N'Unknown')
            OR (dtr.[condition_key] = N'eol-status-known' AND a.[lifecycle_eol_status] <> N'Unknown')
            OR (dtr.[condition_key] = N'has-vulnerability' AND EXISTS (
              SELECT 1 FROM [tsaat].[asset_vulnerability] AS av
              WHERE av.[snapshot_id] = a.[snapshot_id] AND av.[asset_id] = a.[asset_id]
            ))
          )
      ) THEN 1
      ELSE 0
    END
  FROM [tsaat].[asset] AS a
  INNER JOIN [tsaat].[discovery_tool] AS dt
    ON dt.[settings_version_id] = @settingsVersionId
  INNER JOIN [tsaat].[discovery_tool_asset_scope] AS dts
    ON dts.[settings_version_id] = dt.[settings_version_id]
    AND dts.[tool_id] = dt.[tool_id]
    AND dts.[asset_type] = a.[asset_type]
  LEFT JOIN [tsaat].[discovery_tool_detection_definition] AS dtd
    ON dtd.[tool_id] = dt.[tool_id] AND dtd.[enabled] = 1
  WHERE a.[snapshot_id] = @snapshot_id
    AND (@hasAssetScope = 0 OR EXISTS (SELECT 1 FROM @AssetScope AS scope WHERE scope.[asset_id] = a.[asset_id]));

  IF @emit_json = 1
  BEGIN
    SELECT
      @snapshot_id AS [snapshotId],
      asset_rows.[asset_id] AS [assetId],
      JSON_QUERY((
        SELECT c.[tool_id] AS [toolId], c.[coverage_value] AS [value]
        FROM @Coverage AS c
        WHERE c.[asset_id] = asset_rows.[asset_id]
        ORDER BY c.[display_order], c.[tool_id]
        FOR JSON PATH, INCLUDE_NULL_VALUES
      )) AS [toolValues],
      JSON_QUERY((
        SELECT c.[tool_id] AS [value]
        FROM @Coverage AS c
        WHERE c.[asset_id] = asset_rows.[asset_id] AND c.[coverage_value] = 0
        ORDER BY c.[display_order], c.[tool_id]
        FOR JSON PATH
      )) AS [missingToolIds],
      JSON_QUERY((
        SELECT c.[tool_name] AS [value]
        FROM @Coverage AS c
        WHERE c.[asset_id] = asset_rows.[asset_id] AND c.[coverage_value] = 0
        ORDER BY c.[display_order], c.[tool_id]
        FOR JSON PATH
      )) AS [missingToolNames],
      CAST(CASE WHEN EXISTS (
        SELECT 1 FROM @Coverage AS c WHERE c.[asset_id] = asset_rows.[asset_id] AND c.[coverage_value] = 0
      ) THEN 0 ELSE 1 END AS BIT) AS [coverageCompliance]
    FROM (SELECT DISTINCT [asset_id] FROM @Coverage) AS asset_rows
    ORDER BY asset_rows.[asset_id]
    FOR JSON PATH;
    RETURN;
  END;

  SELECT
    @snapshot_id AS [snapshot_id],
    asset_rows.[asset_id],
    CAST(CASE WHEN EXISTS (
      SELECT 1 FROM @Coverage AS c WHERE c.[asset_id] = asset_rows.[asset_id] AND c.[coverage_value] = 0
    ) THEN 0 ELSE 1 END AS BIT) AS [coverage_compliance],
    COALESCE((SELECT c.[tool_id], c.[coverage_value] FROM @Coverage AS c WHERE c.[asset_id] = asset_rows.[asset_id] FOR JSON PATH, INCLUDE_NULL_VALUES), N'[]') AS [tool_values_json],
    COALESCE((SELECT c.[tool_id] AS [value] FROM @Coverage AS c WHERE c.[asset_id] = asset_rows.[asset_id] AND c.[coverage_value] = 0 FOR JSON PATH), N'[]') AS [missing_tool_ids_json],
    COALESCE((SELECT c.[tool_name] AS [value] FROM @Coverage AS c WHERE c.[asset_id] = asset_rows.[asset_id] AND c.[coverage_value] = 0 FOR JSON PATH), N'[]') AS [missing_tool_names_json]
  FROM (SELECT DISTINCT [asset_id] FROM @Coverage) AS asset_rows
  ORDER BY asset_rows.[asset_id];
END;
GO

CREATE TABLE [tsaat].[storage_schema_version] (
  [version] INT NOT NULL CONSTRAINT [PK_storage_schema_version] PRIMARY KEY,
  [applied_at_utc] DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT [CK_storage_schema_version] CHECK ([version] = 2)
);
INSERT INTO [tsaat].[storage_schema_version] ([version]) VALUES (2);
GO
