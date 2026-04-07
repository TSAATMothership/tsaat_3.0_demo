/*
  TSAAT SQL Server schema (Microsoft SQL / T-SQL)
  Source model:
  - docs/database/tsaat_schema.sql (PostgreSQL)
  - data/current.json
  - data/snapshots/week-*.json
  - data/spi-definitions.json
  - data/discovery-tools-settings.json
  - data/measures-settings.json

  Notes:
  1) Enum-like fields are enforced using CHECK constraints.
  2) Snapshot-aware composite keys preserve referential integrity across historical snapshots.
  3) JSON payloads are stored as NVARCHAR(MAX) with ISJSON validation where applicable.
*/

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'tsaat')
BEGIN
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
  CONSTRAINT [PK_dataset_snapshot] PRIMARY KEY CLUSTERED ([snapshot_id]),
  CONSTRAINT [UQ_dataset_snapshot_snapshot_date] UNIQUE ([snapshot_date])
);
GO

CREATE TABLE [tsaat].[spi_definition] (
  [spi_id] SMALLINT NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [success_measure] NVARCHAR(1000) NOT NULL,
  [priority_order] INT NOT NULL,
  [recommended_action] NVARCHAR(MAX) NOT NULL,
  CONSTRAINT [PK_spi_definition] PRIMARY KEY CLUSTERED ([spi_id])
);
GO

CREATE TABLE [tsaat].[spi_applicable_asset_type] (
  [spi_id] SMALLINT NOT NULL,
  [asset_type] NVARCHAR(20) NOT NULL,
  CONSTRAINT [PK_spi_applicable_asset_type] PRIMARY KEY CLUSTERED ([spi_id], [asset_type]),
  CONSTRAINT [FK_spi_applicable_asset_type_spi]
    FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
  CONSTRAINT [CK_spi_applicable_asset_type_asset_type]
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device'))
);
GO

CREATE TABLE [tsaat].[managed_network] (
  [snapshot_id] BIGINT NOT NULL,
  [network_id] NVARCHAR(255) NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [criticality] NVARCHAR(20) NOT NULL,
  [classification] NVARCHAR(255) NULL,
  [discovery_status] NVARCHAR(40) NOT NULL,
  CONSTRAINT [PK_managed_network] PRIMARY KEY CLUSTERED ([snapshot_id], [network_id]),
  CONSTRAINT [FK_managed_network_snapshot]
    FOREIGN KEY ([snapshot_id]) REFERENCES [tsaat].[dataset_snapshot]([snapshot_id]),
  CONSTRAINT [CK_managed_network_criticality]
    CHECK ([criticality] IN (N'Critical', N'Non-Critical')),
  CONSTRAINT [CK_managed_network_discovery_status]
    CHECK ([discovery_status] IN (N'Discovery Enabled', N'Discovery Non Enabled'))
);
GO

CREATE TABLE [tsaat].[ict_system] (
  [snapshot_id] BIGINT NOT NULL,
  [system_id] NVARCHAR(255) NOT NULL,
  [network_id] NVARCHAR(255) NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [modelling_status] BIT NOT NULL,
  [diis_defined] BIT NOT NULL,
  [criticality] NVARCHAR(20) NOT NULL,
  [security_domain] NVARCHAR(20) NOT NULL,
  CONSTRAINT [PK_ict_system] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id]),
  CONSTRAINT [UQ_ict_system_snapshot_system_network] UNIQUE ([snapshot_id], [system_id], [network_id]),
  CONSTRAINT [FK_ict_system_snapshot]
    FOREIGN KEY ([snapshot_id]) REFERENCES [tsaat].[dataset_snapshot]([snapshot_id]),
  CONSTRAINT [FK_ict_system_network]
    FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
  CONSTRAINT [CK_ict_system_criticality]
    CHECK ([criticality] IN (N'Critical', N'Non-Critical')),
  CONSTRAINT [CK_ict_system_security_domain]
    CHECK ([security_domain] IN (N'Secret', N'Protected', N'Unclassified'))
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

CREATE TABLE [tsaat].[asset] (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [hostname] NVARCHAR(255) NOT NULL,
  [asset_type] NVARCHAR(20) NOT NULL,
  [network_id] NVARCHAR(255) NOT NULL,
  [security_domain] NVARCHAR(20) NOT NULL,
  [system_id] NVARCHAR(255) NULL,
  [environment_type] NVARCHAR(20) NULL,
  [lifecycle_eol_status] NVARCHAR(20) NOT NULL,
  [lifecycle_warranty_status] NVARCHAR(20) NOT NULL,
  CONSTRAINT [PK_asset] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id]),
  CONSTRAINT [UQ_asset_snapshot_network_asset] UNIQUE ([snapshot_id], [network_id], [asset_id]),
  CONSTRAINT [UQ_asset_snapshot_system_asset] UNIQUE ([snapshot_id], [system_id], [asset_id]),
  CONSTRAINT [UQ_asset_snapshot_system_env_asset] UNIQUE ([snapshot_id], [system_id], [environment_type], [asset_id]),
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
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device')),
  CONSTRAINT [CK_asset_security_domain]
    CHECK ([security_domain] IN (N'Secret', N'Protected', N'Unclassified')),
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

CREATE TABLE [tsaat].[asset_operating_system] (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [family] NVARCHAR(255) NOT NULL,
  [vendor] NVARCHAR(255) NOT NULL,
  [major_version] INT NULL,
  [version] NVARCHAR(255) NOT NULL,
  [support_status] NVARCHAR(20) NOT NULL,
  [current_supported_major] INT NULL,
  [n_minus] INT NULL,
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
  [major_version] INT NULL,
  [version] NVARCHAR(255) NOT NULL,
  [support_status] NVARCHAR(20) NOT NULL,
  [current_supported_major] INT NULL,
  [n_minus] INT NULL,
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

CREATE TABLE [tsaat].[finding] (
  [snapshot_id] BIGINT NOT NULL,
  [finding_id] NVARCHAR(255) NOT NULL,
  [spi_id] SMALLINT NOT NULL,
  [priority_rank] INT NOT NULL,
  [severity] NVARCHAR(30) NOT NULL,
  [compliance_status] NVARCHAR(20) NOT NULL,
  [network_id] NVARCHAR(255) NOT NULL,
  [system_id] NVARCHAR(255) NULL,
  [environment_type] NVARCHAR(20) NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [title] NVARCHAR(1000) NOT NULL,
  [evidence] NVARCHAR(MAX) NOT NULL CONSTRAINT [DF_finding_evidence] DEFAULT (N'{}'),
  [recommended_action] NVARCHAR(MAX) NOT NULL,
  [workflow_status] NVARCHAR(10) NOT NULL,
  [observed_at] DATETIMEOFFSET(7) NOT NULL,
  [closed_at] DATETIMEOFFSET(7) NULL,
  CONSTRAINT [PK_finding] PRIMARY KEY CLUSTERED ([snapshot_id], [finding_id]),
  CONSTRAINT [FK_finding_snapshot]
    FOREIGN KEY ([snapshot_id]) REFERENCES [tsaat].[dataset_snapshot]([snapshot_id]),
  CONSTRAINT [FK_finding_network]
    FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
  CONSTRAINT [FK_finding_asset]
    FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
  CONSTRAINT [FK_finding_asset_network]
    FOREIGN KEY ([snapshot_id], [network_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [network_id], [asset_id]),
  CONSTRAINT [FK_finding_system]
    FOREIGN KEY ([snapshot_id], [system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
  CONSTRAINT [FK_finding_system_network]
    FOREIGN KEY ([snapshot_id], [system_id], [network_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id], [network_id]),
  CONSTRAINT [FK_finding_asset_system]
    FOREIGN KEY ([snapshot_id], [system_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [system_id], [asset_id]),
  CONSTRAINT [FK_finding_system_environment]
    FOREIGN KEY ([snapshot_id], [system_id], [environment_type]) REFERENCES [tsaat].[system_environment]([snapshot_id], [system_id], [environment_type]),
  CONSTRAINT [FK_finding_spi]
    FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
  CONSTRAINT [CK_finding_severity]
    CHECK ([severity] IN (N'High Risk', N'Critical Exposure', N'Major', N'Moderate', N'Data Gap')),
  CONSTRAINT [CK_finding_compliance_status]
    CHECK ([compliance_status] IN (N'Compliant', N'Non-compliant', N'Unknown')),
  CONSTRAINT [CK_finding_environment_type]
    CHECK ([environment_type] IS NULL OR [environment_type] IN (N'Production', N'Development', N'UAT', N'Test')),
  CONSTRAINT [CK_finding_workflow_status]
    CHECK ([workflow_status] IN (N'open', N'closed')),
  CONSTRAINT [CK_finding_system_environment_pair]
    CHECK (
      ([system_id] IS NULL AND [environment_type] IS NULL)
      OR ([system_id] IS NOT NULL AND [environment_type] IS NOT NULL)
    ),
  CONSTRAINT [CK_finding_closed_status_consistency]
    CHECK (
      ([workflow_status] = N'open' AND [closed_at] IS NULL)
      OR ([workflow_status] = N'closed' AND [closed_at] IS NOT NULL)
    ),
  CONSTRAINT [CK_finding_evidence_json]
    CHECK (ISJSON([evidence]) = 1)
);
GO

CREATE TABLE [tsaat].[discovery_tools_settings_version] (
  [settings_version_id] BIGINT IDENTITY(1,1) NOT NULL,
  [updated_at] DATETIMEOFFSET(7) NOT NULL,
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
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device')),
  CONSTRAINT [CK_discovery_tool_asset_scope_setting]
    CHECK ([scope_setting] IN (N'required', N'na'))
);
GO

CREATE TABLE [tsaat].[measures_settings_version] (
  [settings_version_id] BIGINT IDENTITY(1,1) NOT NULL,
  [updated_at] DATETIMEOFFSET(7) NOT NULL,
  CONSTRAINT [PK_measures_settings_version] PRIMARY KEY CLUSTERED ([settings_version_id]),
  CONSTRAINT [UQ_measures_settings_version_updated_at] UNIQUE ([updated_at])
);
GO

CREATE TABLE [tsaat].[measures_severity_matrix] (
  [settings_version_id] BIGINT NOT NULL,
  [spi_id] SMALLINT NOT NULL,
  [asset_type] NVARCHAR(20) NOT NULL,
  [severity] NVARCHAR(30) NOT NULL,
  CONSTRAINT [PK_measures_severity_matrix] PRIMARY KEY CLUSTERED ([settings_version_id], [spi_id], [asset_type]),
  CONSTRAINT [FK_measures_severity_matrix_version]
    FOREIGN KEY ([settings_version_id]) REFERENCES [tsaat].[measures_settings_version]([settings_version_id]),
  CONSTRAINT [FK_measures_severity_matrix_spi]
    FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
  CONSTRAINT [CK_measures_severity_matrix_asset_type]
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device')),
  CONSTRAINT [CK_measures_severity_matrix_severity]
    CHECK ([severity] IN (N'High Risk', N'Critical Exposure', N'Major', N'Moderate', N'Data Gap'))
);
GO

CREATE INDEX [IX_ict_system_network] ON [tsaat].[ict_system] ([snapshot_id], [network_id]);
CREATE INDEX [IX_asset_network] ON [tsaat].[asset] ([snapshot_id], [network_id]);
CREATE INDEX [IX_asset_system] ON [tsaat].[asset] ([snapshot_id], [system_id]);
CREATE INDEX [IX_asset_type] ON [tsaat].[asset] ([snapshot_id], [asset_type]);
CREATE INDEX [IX_finding_scope] ON [tsaat].[finding] ([snapshot_id], [network_id], [system_id], [asset_id]);
CREATE INDEX [IX_finding_spi] ON [tsaat].[finding] ([snapshot_id], [spi_id]);
CREATE INDEX [IX_finding_status] ON [tsaat].[finding] ([snapshot_id], [workflow_status], [compliance_status]);
GO

