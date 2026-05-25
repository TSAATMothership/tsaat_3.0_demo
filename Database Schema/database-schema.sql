/*
  TSAAT SQL Server schema package (Microsoft SQL / T-SQL).
  Primary source model:
  - lib/types.ts
  - lib/spi-rules.ts
  - lib/findings.ts
  - lib/discovery-tools-settings.ts
  - lib/measures-settings.ts
  - lib/kpi-definitions.ts
  - data/current.json
  - Database Schema/data/reference-versions.json
  - Database Schema/data/kpi-definitions.json
  - Database Schema/data/spi-definitions.json
  - Database Schema/data/severity-definitions.json
  - Database Schema/data/discovery-tools-settings.json
  - Database Schema/data/measures-settings.json

  Design notes:
  1) Enum-like fields are enforced with CHECK constraints.
  2) Snapshot-aware composite keys preserve historical integrity per snapshot.
  3) Evidence payloads are stored as NVARCHAR(MAX) and validated with ISJSON.
  4) SQL connection/auth mode is configured externally via local encrypted repository root DB_config.
  5) Application login credentials are configured externally via local encrypted repository root logindetails.
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

CREATE TABLE [tsaat].[reference_version_set] (
  [version_set_id] BIGINT IDENTITY(1,1) NOT NULL,
  [version_set_key] NVARCHAR(100) NOT NULL,
  [version_set_name] NVARCHAR(255) NOT NULL,
  [effective_date] DATE NULL,
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_reference_version_set_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_reference_version_set_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_reference_version_set_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_reference_version_set_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
  CONSTRAINT [PK_reference_version_set] PRIMARY KEY CLUSTERED ([version_set_id]),
  CONSTRAINT [UQ_reference_version_set_key] UNIQUE ([version_set_key])
);
GO

CREATE TABLE [tsaat].[dataset_snapshot] (
  [snapshot_id] BIGINT IDENTITY(1,1) NOT NULL,
  [snapshot_date] DATE NOT NULL,
  [generated_at] DATETIMEOFFSET(7) NOT NULL,
  [source_label] NVARCHAR(100) NULL,
  [reference_version_set_id] BIGINT NULL,
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_dataset_snapshot_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_dataset_snapshot_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_dataset_snapshot_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_dataset_snapshot_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
  CONSTRAINT [PK_dataset_snapshot] PRIMARY KEY CLUSTERED ([snapshot_id]),
  CONSTRAINT [UQ_dataset_snapshot_snapshot_date] UNIQUE ([snapshot_date]),
  CONSTRAINT [FK_dataset_snapshot_reference_version_set]
    FOREIGN KEY ([reference_version_set_id]) REFERENCES [tsaat].[reference_version_set]([version_set_id])
);
GO

CREATE TABLE [tsaat].[finding_severity_definition] (
  [severity_key] NVARCHAR(30) NOT NULL,
  [label] NVARCHAR(80) NOT NULL,
  [display_order] INT NOT NULL,
  [selectable_in_settings] BIT NOT NULL CONSTRAINT [DF_finding_severity_definition_selectable] DEFAULT (1),
  [tone_key] NVARCHAR(40) NOT NULL,
  CONSTRAINT [PK_finding_severity_definition] PRIMARY KEY CLUSTERED ([severity_key]),
  CONSTRAINT [UQ_finding_severity_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_finding_severity_definition_display_order] CHECK ([display_order] > 0),
  CONSTRAINT [CK_finding_severity_definition_key] CHECK (LEN(LTRIM(RTRIM([severity_key]))) > 0)
);
GO

CREATE TABLE [tsaat].[spi_rule_definition] (
  [rule_key] NVARCHAR(100) NOT NULL,
  [handler_key] NVARCHAR(100) NOT NULL,
  [display_order] INT NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_spi_rule_definition_enabled] DEFAULT (1),
  CONSTRAINT [PK_spi_rule_definition] PRIMARY KEY CLUSTERED ([rule_key]),
  CONSTRAINT [UQ_spi_rule_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_spi_rule_definition_key] CHECK (LEN(LTRIM(RTRIM([rule_key]))) > 0),
  CONSTRAINT [CK_spi_rule_definition_handler] CHECK (LEN(LTRIM(RTRIM([handler_key]))) > 0),
  CONSTRAINT [CK_spi_rule_definition_display_order] CHECK ([display_order] > 0)
);
GO

CREATE TABLE [tsaat].[spi_rule_parameter_definition] (
  [rule_key] NVARCHAR(100) NOT NULL,
  [parameter_key] NVARCHAR(100) NOT NULL,
  [parameter_type] NVARCHAR(20) NOT NULL,
  [required] BIT NOT NULL CONSTRAINT [DF_spi_rule_parameter_definition_required] DEFAULT (0),
  [default_value] NVARCHAR(4000) NULL,
  [allowed_values_json] NVARCHAR(MAX) NULL,
  [display_order] INT NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  CONSTRAINT [PK_spi_rule_parameter_definition] PRIMARY KEY CLUSTERED ([rule_key], [parameter_key]),
  CONSTRAINT [FK_spi_rule_parameter_definition_rule]
    FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_rule_definition]([rule_key]),
  CONSTRAINT [CK_spi_rule_parameter_definition_type]
    CHECK ([parameter_type] IN (N'string', N'number', N'boolean')),
  CONSTRAINT [CK_spi_rule_parameter_definition_key] CHECK (LEN(LTRIM(RTRIM([parameter_key]))) > 0),
  CONSTRAINT [CK_spi_rule_parameter_definition_display_order] CHECK ([display_order] > 0),
  CONSTRAINT [CK_spi_rule_parameter_definition_allowed_json]
    CHECK ([allowed_values_json] IS NULL OR ISJSON([allowed_values_json]) = 1)
);
GO

CREATE TABLE [tsaat].[spi_rule_outcome_template] (
  [rule_key] NVARCHAR(100) NOT NULL,
  [outcome_key] NVARCHAR(100) NOT NULL,
  [compliance_status] NVARCHAR(20) NOT NULL,
  [reason_template] NVARCHAR(MAX) NOT NULL,
  [evidence_template] NVARCHAR(MAX) NULL,
  CONSTRAINT [PK_spi_rule_outcome_template] PRIMARY KEY CLUSTERED ([rule_key], [outcome_key], [compliance_status]),
  CONSTRAINT [FK_spi_rule_outcome_template_rule]
    FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_rule_definition]([rule_key]),
  CONSTRAINT [CK_spi_rule_outcome_template_status]
    CHECK ([compliance_status] IN (N'Compliant', N'Non-compliant', N'Unknown')),
  CONSTRAINT [CK_spi_rule_outcome_template_key] CHECK (LEN(LTRIM(RTRIM([outcome_key]))) > 0)
);
GO

CREATE TABLE [tsaat].[spi_report_detail_definition] (
  [report_detail_key] NVARCHAR(100) NOT NULL,
  [handler_key] NVARCHAR(100) NOT NULL,
  [display_order] INT NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_spi_report_detail_definition_enabled] DEFAULT (1),
  CONSTRAINT [PK_spi_report_detail_definition] PRIMARY KEY CLUSTERED ([report_detail_key]),
  CONSTRAINT [UQ_spi_report_detail_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_spi_report_detail_definition_key] CHECK (LEN(LTRIM(RTRIM([report_detail_key]))) > 0),
  CONSTRAINT [CK_spi_report_detail_definition_handler] CHECK (LEN(LTRIM(RTRIM([handler_key]))) > 0),
  CONSTRAINT [CK_spi_report_detail_definition_display_order] CHECK ([display_order] > 0)
);
GO

CREATE TABLE [tsaat].[spi_definition] (
  [spi_id] INT NOT NULL,
  [display_order] INT NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [success_measure] NVARCHAR(1000) NOT NULL,
  [priority_order] INT NOT NULL,
  [default_severity] NVARCHAR(30) NOT NULL,
  [recommended_action] NVARCHAR(MAX) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_spi_definition_enabled] DEFAULT (1),
  [rule_key] NVARCHAR(100) NOT NULL,
  [report_available] BIT NOT NULL CONSTRAINT [DF_spi_definition_report_available] DEFAULT (1),
  [trend_report_available] BIT NOT NULL CONSTRAINT [DF_spi_definition_trend_report_available] DEFAULT (1),
  [report_detail_key] NVARCHAR(100) NOT NULL CONSTRAINT [DF_spi_definition_report_detail_key] DEFAULT (N'standard-asset-annex'),
  CONSTRAINT [PK_spi_definition] PRIMARY KEY CLUSTERED ([spi_id]),
  CONSTRAINT [UQ_spi_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [FK_spi_definition_default_severity]
    FOREIGN KEY ([default_severity]) REFERENCES [tsaat].[finding_severity_definition]([severity_key]),
  CONSTRAINT [FK_spi_definition_rule]
    FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_rule_definition]([rule_key]),
  CONSTRAINT [FK_spi_definition_report_detail]
    FOREIGN KEY ([report_detail_key]) REFERENCES [tsaat].[spi_report_detail_definition]([report_detail_key]),
  CONSTRAINT [CK_spi_definition_spi_id] CHECK ([spi_id] > 0),
  CONSTRAINT [CK_spi_definition_display_order] CHECK ([display_order] > 0),
  CONSTRAINT [CK_spi_definition_priority_order] CHECK ([priority_order] > 0)
);
GO

CREATE TABLE [tsaat].[spi_finding_classification_rule] (
  [classification_rule_id] NVARCHAR(100) NOT NULL,
  [display_order] INT NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_spi_finding_classification_rule_enabled] DEFAULT (1),
  [spi_id] INT NULL,
  [compliance_status] NVARCHAR(20) NULL,
  [condition_key] NVARCHAR(60) NOT NULL,
  [severity_key] NVARCHAR(30) NULL,
  [priority_rank] INT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  CONSTRAINT [PK_spi_finding_classification_rule] PRIMARY KEY CLUSTERED ([classification_rule_id]),
  CONSTRAINT [UQ_spi_finding_classification_rule_display_order] UNIQUE ([display_order]),
  CONSTRAINT [FK_spi_finding_classification_rule_spi]
    FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
  CONSTRAINT [FK_spi_finding_classification_rule_severity]
    FOREIGN KEY ([severity_key]) REFERENCES [tsaat].[finding_severity_definition]([severity_key]),
  CONSTRAINT [CK_spi_finding_classification_rule_display_order] CHECK ([display_order] > 0),
  CONSTRAINT [CK_spi_finding_classification_rule_priority] CHECK ([priority_rank] IS NULL OR [priority_rank] > 0),
  CONSTRAINT [CK_spi_finding_classification_rule_status]
    CHECK ([compliance_status] IS NULL OR [compliance_status] IN (N'Compliant', N'Non-compliant', N'Unknown')),
  CONSTRAINT [CK_spi_finding_classification_rule_condition]
    CHECK ([condition_key] IN (
      N'always',
      N'when_unknown',
      N'when_non_compliant',
      N'when_production_critical_asset',
      N'when_not_production_critical_asset'
    )),
  CONSTRAINT [CK_spi_finding_classification_rule_key] CHECK (LEN(LTRIM(RTRIM([classification_rule_id]))) > 0)
);
GO

CREATE TABLE [tsaat].[spi_applicable_asset_type] (
  [spi_id] INT NOT NULL,
  [asset_type] NVARCHAR(20) NOT NULL,
  CONSTRAINT [PK_spi_applicable_asset_type] PRIMARY KEY CLUSTERED ([spi_id], [asset_type]),
  CONSTRAINT [FK_spi_applicable_asset_type_spi]
    FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
  CONSTRAINT [CK_spi_applicable_asset_type_asset_type]
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other'))
);
GO

CREATE TABLE [tsaat].[spi_rule_parameter] (
  [spi_id] INT NOT NULL,
  [parameter_key] NVARCHAR(100) NOT NULL,
  [parameter_type] NVARCHAR(20) NOT NULL,
  [parameter_value] NVARCHAR(4000) NOT NULL,
  CONSTRAINT [PK_spi_rule_parameter] PRIMARY KEY CLUSTERED ([spi_id], [parameter_key]),
  CONSTRAINT [FK_spi_rule_parameter_spi]
    FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
  CONSTRAINT [CK_spi_rule_parameter_type]
    CHECK ([parameter_type] IN (N'string', N'number', N'boolean')),
  CONSTRAINT [CK_spi_rule_parameter_key]
    CHECK (LEN(LTRIM(RTRIM([parameter_key]))) > 0)
);
GO

CREATE TABLE [tsaat].[spi_tasking_team] (
  [spi_id] INT NOT NULL,
  [display_order] INT NOT NULL,
  [team] NVARCHAR(255) NOT NULL,
  [support_queue] NVARCHAR(100) NOT NULL,
  [contact_email] NVARCHAR(255) NOT NULL,
  CONSTRAINT [PK_spi_tasking_team] PRIMARY KEY CLUSTERED ([spi_id], [display_order]),
  CONSTRAINT [FK_spi_tasking_team_spi]
    FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
  CONSTRAINT [CK_spi_tasking_team_display_order] CHECK ([display_order] > 0)
);
GO

CREATE TABLE [tsaat].[spi_tasking_action_template] (
  [spi_id] INT NOT NULL,
  [display_order] INT NOT NULL,
  [condition_key] NVARCHAR(40) NOT NULL,
  [action_text] NVARCHAR(MAX) NOT NULL,
  CONSTRAINT [PK_spi_tasking_action_template] PRIMARY KEY CLUSTERED ([spi_id], [display_order]),
  CONSTRAINT [FK_spi_tasking_action_template_spi]
    FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
  CONSTRAINT [CK_spi_tasking_action_template_display_order] CHECK ([display_order] > 0),
  CONSTRAINT [CK_spi_tasking_action_template_condition]
    CHECK ([condition_key] IN (N'always', N'when_unknown', N'when_fully_compliant'))
);
GO

CREATE TABLE [tsaat].[spi_tasking_condition_template] (
  [spi_id] INT NOT NULL,
  [condition_key] NVARCHAR(40) NOT NULL,
  [template_text] NVARCHAR(MAX) NOT NULL,
  CONSTRAINT [PK_spi_tasking_condition_template] PRIMARY KEY CLUSTERED ([spi_id], [condition_key]),
  CONSTRAINT [FK_spi_tasking_condition_template_spi]
    FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
  CONSTRAINT [CK_spi_tasking_condition_template_condition]
    CHECK ([condition_key] IN (N'non_compliant', N'unknown', N'compliant'))
);
GO

CREATE TABLE [tsaat].[kpi_definition] (
  [kpi_id] NVARCHAR(40) NOT NULL,
  [display_order] INT NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [success_measure] NVARCHAR(1000) NOT NULL,
  [calculation_key] NVARCHAR(100) NOT NULL,
  [report_available] BIT NOT NULL CONSTRAINT [DF_kpi_definition_report_available] DEFAULT (0),
  CONSTRAINT [PK_kpi_definition] PRIMARY KEY CLUSTERED ([kpi_id]),
  CONSTRAINT [UQ_kpi_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_kpi_definition_kpi_id] CHECK (LEN(LTRIM(RTRIM([kpi_id]))) > 0),
  CONSTRAINT [CK_kpi_definition_display_order] CHECK ([display_order] > 0),
  CONSTRAINT [CK_kpi_definition_calculation_key] CHECK ([calculation_key] IN (
    N'overall-spi-compliance',
    N'protected-domain-compliance',
    N'secret-domain-compliance',
    N'critical-ict-system-compliance',
    N'critical-exposure-in-production',
    N'discovery-coverage-compliance',
    N'active-ato-coverage',
    N'diis-registration-coverage',
    N'diis-modelled-coverage',
    N'network-discovery-enablement'
  ))
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
  [description] NVARCHAR(2000) NULL,
  [owner] NVARCHAR(255) NULL,
  [support_email] NVARCHAR(320) NULL,
  [service_catalogue_url] NVARCHAR(1024) NULL,
  [diis_id] NVARCHAR(100) NULL,
  [ato_number] NVARCHAR(100) NULL,
  [apm_number] NVARCHAR(100) NULL,
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
  [security_domain] NVARCHAR(20) NOT NULL,
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
    CHECK ([security_domain] IN (N'Secret', N'Protected', N'Unclassified'))
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

CREATE TABLE [tsaat].[asset] (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [hostname] NVARCHAR(255) NOT NULL,
  [ip_address] NVARCHAR(64) NULL,
  [asset_type] NVARCHAR(20) NOT NULL,
  [network_id] NVARCHAR(255) NOT NULL,
  [security_domain] NVARCHAR(20) NOT NULL,
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
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other')),
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
  [spi_id] INT NOT NULL,
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
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_finding_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_finding_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_finding_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_finding_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
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
  CONSTRAINT [FK_finding_severity]
    FOREIGN KEY ([severity]) REFERENCES [tsaat].[finding_severity_definition]([severity_key]),
  CONSTRAINT [CK_finding_priority_rank]
    CHECK ([priority_rank] > 0),
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

CREATE TABLE [tsaat].[reference_os_current_major] (
  [version_set_id] BIGINT NOT NULL,
  [os_key] NVARCHAR(100) NOT NULL,
  [current_supported_major] INT NOT NULL,
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_reference_os_current_major_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_reference_os_current_major_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_reference_os_current_major_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_reference_os_current_major_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
  CONSTRAINT [PK_reference_os_current_major] PRIMARY KEY CLUSTERED ([version_set_id], [os_key]),
  CONSTRAINT [FK_reference_os_current_major_version_set]
    FOREIGN KEY ([version_set_id]) REFERENCES [tsaat].[reference_version_set]([version_set_id]),
  CONSTRAINT [CK_reference_os_current_major_non_negative] CHECK ([current_supported_major] >= 0)
);
GO

CREATE TABLE [tsaat].[reference_software_supported_version] (
  [version_set_id] BIGINT NOT NULL,
  [software_name] NVARCHAR(255) NOT NULL,
  [version_ordinal] INT NOT NULL,
  [version] NVARCHAR(100) NOT NULL,
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_reference_software_supported_version_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_reference_software_supported_version_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_reference_software_supported_version_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_reference_software_supported_version_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
  CONSTRAINT [PK_reference_software_supported_version] PRIMARY KEY CLUSTERED ([version_set_id], [software_name], [version_ordinal]),
  CONSTRAINT [FK_reference_software_supported_version_version_set]
    FOREIGN KEY ([version_set_id]) REFERENCES [tsaat].[reference_version_set]([version_set_id]),
  CONSTRAINT [CK_reference_software_supported_version_ordinal] CHECK ([version_ordinal] > 0)
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
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other')),
  CONSTRAINT [CK_discovery_tool_asset_scope_setting]
    CHECK ([scope_setting] IN (N'required', N'na'))
);
GO

CREATE TABLE [tsaat].[measures_settings_version] (
  [settings_version_id] BIGINT IDENTITY(1,1) NOT NULL,
  [updated_at] DATETIMEOFFSET(7) NOT NULL,
  [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_measures_settings_version_created_at_utc] DEFAULT (SYSUTCDATETIME()),
  [created_by] SYSNAME NOT NULL CONSTRAINT [DF_measures_settings_version_created_by] DEFAULT (SUSER_SNAME()),
  [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_measures_settings_version_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
  [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_measures_settings_version_updated_by] DEFAULT (SUSER_SNAME()),
  [row_version] ROWVERSION NOT NULL,
  CONSTRAINT [PK_measures_settings_version] PRIMARY KEY CLUSTERED ([settings_version_id]),
  CONSTRAINT [UQ_measures_settings_version_updated_at] UNIQUE ([updated_at])
);
GO

CREATE TABLE [tsaat].[measures_severity_matrix] (
  [settings_version_id] BIGINT NOT NULL,
  [spi_id] INT NOT NULL,
  [asset_type] NVARCHAR(20) NOT NULL,
  [severity] NVARCHAR(30) NOT NULL,
  CONSTRAINT [PK_measures_severity_matrix] PRIMARY KEY CLUSTERED ([settings_version_id], [spi_id], [asset_type]),
  CONSTRAINT [FK_measures_severity_matrix_version]
    FOREIGN KEY ([settings_version_id]) REFERENCES [tsaat].[measures_settings_version]([settings_version_id]),
  CONSTRAINT [FK_measures_severity_matrix_spi]
    FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
  CONSTRAINT [FK_measures_severity_matrix_severity]
    FOREIGN KEY ([severity]) REFERENCES [tsaat].[finding_severity_definition]([severity_key]),
  CONSTRAINT [CK_measures_severity_matrix_asset_type]
    CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other'))
);
GO

CREATE TABLE [tsaat].[measures_priority_matrix] (
  [settings_version_id] BIGINT NOT NULL,
  [spi_id] INT NOT NULL,
  [priority_rank] INT NOT NULL,
  CONSTRAINT [PK_measures_priority_matrix] PRIMARY KEY CLUSTERED ([settings_version_id], [spi_id]),
  CONSTRAINT [FK_measures_priority_matrix_version]
    FOREIGN KEY ([settings_version_id]) REFERENCES [tsaat].[measures_settings_version]([settings_version_id]),
  CONSTRAINT [FK_measures_priority_matrix_spi]
    FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
  CONSTRAINT [CK_measures_priority_matrix_priority_rank]
    CHECK ([priority_rank] BETWEEN 1 AND 7)
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
CREATE INDEX [IX_finding_scope] ON [tsaat].[finding] ([snapshot_id], [network_id], [system_id], [asset_id]);
CREATE INDEX [IX_finding_spi] ON [tsaat].[finding] ([snapshot_id], [spi_id]);
CREATE INDEX [IX_finding_status] ON [tsaat].[finding] ([snapshot_id], [workflow_status], [compliance_status]);
CREATE INDEX [IX_finding_timeline] ON [tsaat].[finding] ([snapshot_id], [observed_at], [closed_at]);
CREATE INDEX [IX_reference_software_supported_version_name] ON [tsaat].[reference_software_supported_version] ([version_set_id], [software_name]);
GO

