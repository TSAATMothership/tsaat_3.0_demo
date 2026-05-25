/*
  TSAAT SQL Server schema package (Microsoft SQL / T-SQL).
  Primary source model:
  - lib/types.ts
  - lib/spi-definitions.ts
  - lib/data-loader.ts
  - lib/findings-config.ts
  - lib/discovery-tools-settings.ts
  - lib/measures-settings.ts
  - lib/kpi-definitions.ts
  - data/current.json
  - Database Schema/data/reference-versions.json
  - Database Schema/data/kpi-definitions.json
  - Database Schema/data/spi-definitions.json
  - Database Schema/data/finding-definitions.json
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

CREATE TABLE [tsaat].[finding_priority_definition] (
  [priority_rank] INT NOT NULL,
  [label] NVARCHAR(40) NOT NULL,
  [display_order] INT NOT NULL,
  [selectable_in_settings] BIT NOT NULL CONSTRAINT [DF_finding_priority_definition_selectable] DEFAULT (1),
  [description] NVARCHAR(1000) NOT NULL,
  CONSTRAINT [PK_finding_priority_definition] PRIMARY KEY CLUSTERED ([priority_rank]),
  CONSTRAINT [UQ_finding_priority_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_finding_priority_definition_rank] CHECK ([priority_rank] > 0),
  CONSTRAINT [CK_finding_priority_definition_display_order] CHECK ([display_order] > 0)
);
GO

CREATE TABLE [tsaat].[finding_source_policy] (
  [policy_key] NVARCHAR(100) NOT NULL,
  [display_order] INT NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [use_persisted_findings] BIT NOT NULL CONSTRAINT [DF_finding_source_policy_use_persisted] DEFAULT (1),
  [generate_when_empty] BIT NOT NULL CONSTRAINT [DF_finding_source_policy_generate_empty] DEFAULT (1),
  [enabled] BIT NOT NULL CONSTRAINT [DF_finding_source_policy_enabled] DEFAULT (1),
  CONSTRAINT [PK_finding_source_policy] PRIMARY KEY CLUSTERED ([policy_key]),
  CONSTRAINT [UQ_finding_source_policy_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_finding_source_policy_key] CHECK (LEN(LTRIM(RTRIM([policy_key]))) > 0),
  CONSTRAINT [CK_finding_source_policy_display_order] CHECK ([display_order] > 0)
);
GO

CREATE TABLE [tsaat].[finding_generation_policy] (
  [policy_key] NVARCHAR(100) NOT NULL,
  [history_start_date] DATE NOT NULL,
  [history_window_years] INT NOT NULL,
  [baseline_backlog_count] INT NOT NULL,
  [min_open_count] INT NOT NULL,
  [max_open_count] INT NOT NULL,
  [add_probability_percent] INT NOT NULL,
  [add_rate_min_percent] INT NOT NULL,
  [add_rate_max_percent] INT NOT NULL,
  [close_rate_min_percent] INT NOT NULL,
  [close_rate_max_percent] INT NOT NULL,
  [close_backfill_min_count] INT NOT NULL,
  [close_backfill_max_count] INT NOT NULL,
  [timezone_offset_minutes] INT NOT NULL,
  CONSTRAINT [PK_finding_generation_policy] PRIMARY KEY CLUSTERED ([policy_key]),
  CONSTRAINT [FK_finding_generation_policy_source]
    FOREIGN KEY ([policy_key]) REFERENCES [tsaat].[finding_source_policy]([policy_key]),
  CONSTRAINT [CK_finding_generation_policy_window] CHECK ([history_window_years] > 0),
  CONSTRAINT [CK_finding_generation_policy_counts] CHECK (
    [baseline_backlog_count] >= 0
    AND [min_open_count] >= 0
    AND [max_open_count] >= [min_open_count]
    AND [close_backfill_min_count] >= 0
    AND [close_backfill_max_count] >= [close_backfill_min_count]
  ),
  CONSTRAINT [CK_finding_generation_policy_rates] CHECK (
    [add_probability_percent] BETWEEN 0 AND 100
    AND [add_rate_min_percent] BETWEEN 0 AND 100
    AND [add_rate_max_percent] BETWEEN [add_rate_min_percent] AND 100
    AND [close_rate_min_percent] BETWEEN 0 AND 100
    AND [close_rate_max_percent] BETWEEN [close_rate_min_percent] AND 100
  )
);
GO

CREATE TABLE [tsaat].[finding_workflow_status_definition] (
  [status_key] NVARCHAR(10) NOT NULL,
  [label] NVARCHAR(80) NOT NULL,
  [display_order] INT NOT NULL,
  [tone_key] NVARCHAR(40) NOT NULL,
  [terminal_status] BIT NOT NULL CONSTRAINT [DF_finding_workflow_status_terminal] DEFAULT (0),
  CONSTRAINT [PK_finding_workflow_status_definition] PRIMARY KEY CLUSTERED ([status_key]),
  CONSTRAINT [UQ_finding_workflow_status_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_finding_workflow_status_definition_key] CHECK ([status_key] IN (N'open', N'closed')),
  CONSTRAINT [CK_finding_workflow_status_definition_display_order] CHECK ([display_order] > 0)
);
GO

CREATE TABLE [tsaat].[finding_bucket_definition] (
  [bucket_key] NVARCHAR(100) NOT NULL,
  [bucket_type] NVARCHAR(40) NOT NULL,
  [label] NVARCHAR(100) NOT NULL,
  [display_order] INT NOT NULL,
  [tone_key] NVARCHAR(40) NOT NULL,
  [condition_key] NVARCHAR(40) NOT NULL,
  [severity_key] NVARCHAR(255) NULL,
  [priority_min] INT NULL,
  [priority_max] INT NULL,
  [workflow_status] NVARCHAR(10) NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_finding_bucket_definition_enabled] DEFAULT (1),
  [description] NVARCHAR(1000) NOT NULL,
  CONSTRAINT [PK_finding_bucket_definition] PRIMARY KEY CLUSTERED ([bucket_key]),
  CONSTRAINT [UQ_finding_bucket_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [FK_finding_bucket_definition_workflow]
    FOREIGN KEY ([workflow_status]) REFERENCES [tsaat].[finding_workflow_status_definition]([status_key]),
  CONSTRAINT [CK_finding_bucket_definition_key] CHECK (LEN(LTRIM(RTRIM([bucket_key]))) > 0),
  CONSTRAINT [CK_finding_bucket_definition_type]
    CHECK ([bucket_type] IN (N'severity', N'priority', N'workflow', N'custom')),
  CONSTRAINT [CK_finding_bucket_definition_condition]
    CHECK ([condition_key] IN (N'always', N'severity_equals', N'severity_not_in', N'priority_equals', N'priority_between', N'workflow_equals')),
  CONSTRAINT [CK_finding_bucket_definition_priority]
    CHECK (
      ([priority_min] IS NULL AND [priority_max] IS NULL)
      OR ([priority_min] IS NOT NULL AND [priority_max] IS NOT NULL AND [priority_min] > 0 AND [priority_max] >= [priority_min])
    ),
  CONSTRAINT [CK_finding_bucket_definition_display_order] CHECK ([display_order] > 0)
);
GO

CREATE TABLE [tsaat].[finding_evidence_field_definition] (
  [field_key] NVARCHAR(100) NOT NULL,
  [display_order] INT NOT NULL,
  [label] NVARCHAR(120) NOT NULL,
  [purpose_key] NVARCHAR(100) NOT NULL,
  [candidate_keys_json] NVARCHAR(MAX) NOT NULL CONSTRAINT [DF_finding_evidence_field_candidates] DEFAULT (N'[]'),
  [fallback_value] NVARCHAR(255) NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_finding_evidence_field_enabled] DEFAULT (1),
  CONSTRAINT [PK_finding_evidence_field_definition] PRIMARY KEY CLUSTERED ([field_key]),
  CONSTRAINT [UQ_finding_evidence_field_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_finding_evidence_field_definition_key] CHECK (LEN(LTRIM(RTRIM([field_key]))) > 0),
  CONSTRAINT [CK_finding_evidence_field_definition_display_order] CHECK ([display_order] > 0),
  CONSTRAINT [CK_finding_evidence_field_definition_candidates] CHECK (ISJSON([candidate_keys_json]) = 1)
);
GO

CREATE TABLE [tsaat].[finding_register_column_definition] (
  [column_key] NVARCHAR(100) NOT NULL,
  [label] NVARCHAR(120) NOT NULL,
  [display_order] INT NOT NULL,
  [value_key] NVARCHAR(100) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_finding_register_column_enabled] DEFAULT (1),
  CONSTRAINT [PK_finding_register_column_definition] PRIMARY KEY CLUSTERED ([column_key]),
  CONSTRAINT [UQ_finding_register_column_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_finding_register_column_definition_key] CHECK (LEN(LTRIM(RTRIM([column_key]))) > 0),
  CONSTRAINT [CK_finding_register_column_definition_display_order] CHECK ([display_order] > 0)
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

CREATE TABLE [tsaat].[spi_calculation_source] (
  [source_key] NVARCHAR(100) NOT NULL,
  [source_object_name] NVARCHAR(255) NOT NULL,
  [display_order] INT NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_spi_calculation_source_enabled] DEFAULT (1),
  CONSTRAINT [PK_spi_calculation_source] PRIMARY KEY CLUSTERED ([source_key]),
  CONSTRAINT [UQ_spi_calculation_source_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_spi_calculation_source_key] CHECK (LEN(LTRIM(RTRIM([source_key]))) > 0),
  CONSTRAINT [CK_spi_calculation_source_object]
    CHECK ([source_object_name] IN (N'[tsaat].[vw_spi_asset_evaluation_context]')),
  CONSTRAINT [CK_spi_calculation_source_display_order] CHECK ([display_order] > 0)
);
GO

CREATE TABLE [tsaat].[spi_calculation_definition] (
  [rule_key] NVARCHAR(100) NOT NULL,
  [source_key] NVARCHAR(100) NOT NULL,
  [display_order] INT NOT NULL,
  [status_expression_sql] NVARCHAR(MAX) NOT NULL,
  [outcome_expression_sql] NVARCHAR(MAX) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_spi_calculation_definition_enabled] DEFAULT (1),
  CONSTRAINT [PK_spi_calculation_definition] PRIMARY KEY CLUSTERED ([rule_key]),
  CONSTRAINT [UQ_spi_calculation_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [FK_spi_calculation_definition_rule]
    FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_rule_definition]([rule_key]),
  CONSTRAINT [FK_spi_calculation_definition_source]
    FOREIGN KEY ([source_key]) REFERENCES [tsaat].[spi_calculation_source]([source_key]),
  CONSTRAINT [CK_spi_calculation_definition_display_order] CHECK ([display_order] > 0),
  CONSTRAINT [CK_spi_calculation_definition_status_sql] CHECK (
    LEN(LTRIM(RTRIM([status_expression_sql]))) > 0
    AND [status_expression_sql] NOT LIKE N'%;%'
    AND [status_expression_sql] NOT LIKE N'%--%'
    AND [status_expression_sql] NOT LIKE N'%/*%'
  ),
  CONSTRAINT [CK_spi_calculation_definition_outcome_sql] CHECK (
    LEN(LTRIM(RTRIM([outcome_expression_sql]))) > 0
    AND [outcome_expression_sql] NOT LIKE N'%;%'
    AND [outcome_expression_sql] NOT LIKE N'%--%'
    AND [outcome_expression_sql] NOT LIKE N'%/*%'
  )
);
GO

CREATE TABLE [tsaat].[spi_calculation_evidence_expression] (
  [rule_key] NVARCHAR(100) NOT NULL,
  [evidence_key] NVARCHAR(100) NOT NULL,
  [display_order] INT NOT NULL,
  [value_type] NVARCHAR(20) NOT NULL,
  [value_expression_sql] NVARCHAR(MAX) NOT NULL,
  [omit_when_null] BIT NOT NULL CONSTRAINT [DF_spi_calculation_evidence_expression_omit] DEFAULT (0),
  CONSTRAINT [PK_spi_calculation_evidence_expression] PRIMARY KEY CLUSTERED ([rule_key], [evidence_key]),
  CONSTRAINT [FK_spi_calculation_evidence_expression_definition]
    FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_calculation_definition]([rule_key]),
  CONSTRAINT [CK_spi_calculation_evidence_expression_key]
    CHECK (LEN(LTRIM(RTRIM([evidence_key]))) > 0 AND [evidence_key] NOT LIKE N'%[^A-Za-z0-9_]%' COLLATE Latin1_General_BIN2),
  CONSTRAINT [CK_spi_calculation_evidence_expression_display_order] CHECK ([display_order] > 0),
  CONSTRAINT [CK_spi_calculation_evidence_expression_type] CHECK ([value_type] IN (N'string', N'number', N'boolean')),
  CONSTRAINT [CK_spi_calculation_evidence_expression_sql] CHECK (
    LEN(LTRIM(RTRIM([value_expression_sql]))) > 0
    AND [value_expression_sql] NOT LIKE N'%;%'
    AND [value_expression_sql] NOT LIKE N'%--%'
    AND [value_expression_sql] NOT LIKE N'%/*%'
  )
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

CREATE TABLE [tsaat].[spi_feature_binding] (
  [feature_key] NVARCHAR(100) NOT NULL,
  [spi_id] INT NOT NULL,
  [display_order] INT NOT NULL,
  [compliance_status] NVARCHAR(20) NULL,
  [outcome_key] NVARCHAR(100) NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_spi_feature_binding_enabled] DEFAULT (1),
  [description] NVARCHAR(1000) NOT NULL,
  CONSTRAINT [PK_spi_feature_binding] PRIMARY KEY CLUSTERED ([feature_key], [spi_id], [display_order]),
  CONSTRAINT [FK_spi_feature_binding_spi]
    FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
  CONSTRAINT [CK_spi_feature_binding_key] CHECK (LEN(LTRIM(RTRIM([feature_key]))) > 0),
  CONSTRAINT [CK_spi_feature_binding_display_order] CHECK ([display_order] > 0),
  CONSTRAINT [CK_spi_feature_binding_status]
    CHECK ([compliance_status] IS NULL OR [compliance_status] IN (N'Compliant', N'Non-compliant', N'Unknown'))
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
  CONSTRAINT [FK_spi_finding_classification_rule_priority]
    FOREIGN KEY ([priority_rank]) REFERENCES [tsaat].[finding_priority_definition]([priority_rank]),
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
  [enabled] BIT NOT NULL CONSTRAINT [DF_kpi_definition_enabled] DEFAULT (1),
  CONSTRAINT [PK_kpi_definition] PRIMARY KEY CLUSTERED ([kpi_id]),
  CONSTRAINT [UQ_kpi_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_kpi_definition_kpi_id] CHECK (LEN(LTRIM(RTRIM([kpi_id]))) > 0),
  CONSTRAINT [CK_kpi_definition_display_order] CHECK ([display_order] > 0)
);
GO

CREATE TABLE [tsaat].[kpi_calculation_source] (
  [source_key] NVARCHAR(100) NOT NULL,
  [source_object_name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_kpi_calculation_source_enabled] DEFAULT (1),
  CONSTRAINT [PK_kpi_calculation_source] PRIMARY KEY CLUSTERED ([source_key]),
  CONSTRAINT [CK_kpi_calculation_source_key] CHECK (LEN(LTRIM(RTRIM([source_key]))) > 0)
);
GO

CREATE TABLE [tsaat].[kpi_calculation_definition] (
  [calculation_key] NVARCHAR(100) NOT NULL,
  [source_key] NVARCHAR(100) NOT NULL,
  [display_order] INT NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_kpi_calculation_definition_enabled] DEFAULT (1),
  CONSTRAINT [PK_kpi_calculation_definition] PRIMARY KEY CLUSTERED ([calculation_key]),
  CONSTRAINT [FK_kpi_calculation_definition_source]
    FOREIGN KEY ([source_key]) REFERENCES [tsaat].[kpi_calculation_source]([source_key]),
  CONSTRAINT [UQ_kpi_calculation_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_kpi_calculation_definition_display_order] CHECK ([display_order] > 0)
);
GO

ALTER TABLE [tsaat].[kpi_definition]
  ADD CONSTRAINT [FK_kpi_definition_calculation_definition]
    FOREIGN KEY ([calculation_key]) REFERENCES [tsaat].[kpi_calculation_definition]([calculation_key]);
GO

CREATE TABLE [tsaat].[kpi_calculation_parameter] (
  [calculation_key] NVARCHAR(100) NOT NULL,
  [parameter_key] NVARCHAR(100) NOT NULL,
  [parameter_type] NVARCHAR(20) NOT NULL,
  [parameter_value] NVARCHAR(4000) NOT NULL,
  CONSTRAINT [PK_kpi_calculation_parameter] PRIMARY KEY CLUSTERED ([calculation_key], [parameter_key]),
  CONSTRAINT [FK_kpi_calculation_parameter_definition]
    FOREIGN KEY ([calculation_key]) REFERENCES [tsaat].[kpi_calculation_definition]([calculation_key]),
  CONSTRAINT [CK_kpi_calculation_parameter_type] CHECK ([parameter_type] IN (N'string', N'number', N'boolean'))
);
GO

CREATE TABLE [tsaat].[kpi_report_detail_definition] (
  [report_detail_key] NVARCHAR(100) NOT NULL,
  [handler_key] NVARCHAR(100) NOT NULL,
  [display_order] INT NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [DF_kpi_report_detail_definition_enabled] DEFAULT (1),
  CONSTRAINT [PK_kpi_report_detail_definition] PRIMARY KEY CLUSTERED ([report_detail_key]),
  CONSTRAINT [UQ_kpi_report_detail_definition_display_order] UNIQUE ([display_order]),
  CONSTRAINT [CK_kpi_report_detail_definition_display_order] CHECK ([display_order] > 0)
);
GO

CREATE TABLE [tsaat].[kpi_report_detail_binding] (
  [kpi_id] NVARCHAR(40) NOT NULL,
  [report_detail_key] NVARCHAR(100) NOT NULL,
  CONSTRAINT [PK_kpi_report_detail_binding] PRIMARY KEY CLUSTERED ([kpi_id]),
  CONSTRAINT [FK_kpi_report_detail_binding_kpi]
    FOREIGN KEY ([kpi_id]) REFERENCES [tsaat].[kpi_definition]([kpi_id]),
  CONSTRAINT [FK_kpi_report_detail_binding_detail]
    FOREIGN KEY ([report_detail_key]) REFERENCES [tsaat].[kpi_report_detail_definition]([report_detail_key])
);
GO

CREATE TABLE [tsaat].[kpi_tasking_team] (
  [kpi_id] NVARCHAR(40) NOT NULL,
  [display_order] INT NOT NULL,
  [team] NVARCHAR(255) NOT NULL,
  [support_queue] NVARCHAR(100) NOT NULL,
  [contact_email] NVARCHAR(255) NOT NULL,
  CONSTRAINT [PK_kpi_tasking_team] PRIMARY KEY CLUSTERED ([kpi_id], [display_order]),
  CONSTRAINT [FK_kpi_tasking_team_kpi]
    FOREIGN KEY ([kpi_id]) REFERENCES [tsaat].[kpi_definition]([kpi_id]),
  CONSTRAINT [CK_kpi_tasking_team_display_order] CHECK ([display_order] > 0)
);
GO

CREATE TABLE [tsaat].[kpi_tasking_action_template] (
  [kpi_id] NVARCHAR(40) NOT NULL,
  [display_order] INT NOT NULL,
  [condition_key] NVARCHAR(40) NOT NULL,
  [action_text] NVARCHAR(MAX) NOT NULL,
  CONSTRAINT [PK_kpi_tasking_action_template] PRIMARY KEY CLUSTERED ([kpi_id], [display_order]),
  CONSTRAINT [FK_kpi_tasking_action_template_kpi]
    FOREIGN KEY ([kpi_id]) REFERENCES [tsaat].[kpi_definition]([kpi_id]),
  CONSTRAINT [CK_kpi_tasking_action_template_display_order] CHECK ([display_order] > 0),
  CONSTRAINT [CK_kpi_tasking_action_template_condition]
    CHECK ([condition_key] IN (N'always', N'when_unknown', N'when_fully_compliant'))
);
GO

CREATE TABLE [tsaat].[kpi_tasking_condition_template] (
  [kpi_id] NVARCHAR(40) NOT NULL,
  [condition_key] NVARCHAR(40) NOT NULL,
  [template_text] NVARCHAR(MAX) NOT NULL,
  CONSTRAINT [PK_kpi_tasking_condition_template] PRIMARY KEY CLUSTERED ([kpi_id], [condition_key]),
  CONSTRAINT [FK_kpi_tasking_condition_template_kpi]
    FOREIGN KEY ([kpi_id]) REFERENCES [tsaat].[kpi_definition]([kpi_id]),
  CONSTRAINT [CK_kpi_tasking_condition_template_condition]
    CHECK ([condition_key] IN (N'non_compliant', N'unknown', N'compliant'))
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
  CONSTRAINT [FK_finding_priority]
    FOREIGN KEY ([priority_rank]) REFERENCES [tsaat].[finding_priority_definition]([priority_rank]),
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
  CONSTRAINT [FK_measures_priority_matrix_priority]
    FOREIGN KEY ([priority_rank]) REFERENCES [tsaat].[finding_priority_definition]([priority_rank]),
  CONSTRAINT [CK_measures_priority_matrix_priority_rank]
    CHECK ([priority_rank] > 0)
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

CREATE OR ALTER VIEW [tsaat].[vw_spi_asset_evaluation_context]
AS
SELECT
  a.[snapshot_id],
  a.[asset_id],
  a.[asset_type],
  a.[network_id],
  a.[system_id],
  a.[environment_type],
  a.[security_domain],
  a.[lifecycle_eol_status],
  a.[lifecycle_warranty_status],
  CASE WHEN aos.[asset_id] IS NULL THEN NULL ELSE CONCAT(aos.[family], N' ', aos.[version]) END AS [os_display_name],
  aos.[support_status] AS [os_support_status],
  aos.[n_minus] AS [os_n_minus],
  aos.[current_supported_major] AS [os_current_supported_major],
  CASE WHEN nos.[asset_id] IS NULL THEN NULL ELSE CONCAT(nos.[family], N' ', nos.[version]) END AS [network_os_display_name],
  nos.[support_status] AS [network_os_support_status],
  ps.[is_latest] AS [patch_is_latest],
  CONVERT(CHAR(10), ps.[last_patched_date], 23) AS [patch_last_patched_date]
FROM [tsaat].[asset] AS a
LEFT JOIN [tsaat].[asset_operating_system] AS aos
  ON aos.[snapshot_id] = a.[snapshot_id] AND aos.[asset_id] = a.[asset_id]
LEFT JOIN [tsaat].[asset_network_os] AS nos
  ON nos.[snapshot_id] = a.[snapshot_id] AND nos.[asset_id] = a.[asset_id]
LEFT JOIN [tsaat].[asset_patch_state] AS ps
  ON ps.[snapshot_id] = a.[snapshot_id] AND ps.[asset_id] = a.[asset_id];
GO

CREATE OR ALTER FUNCTION [tsaat].[fn_spi_string_parameter] (
  @spi_id INT,
  @parameter_key NVARCHAR(100),
  @fallback NVARCHAR(4000)
)
RETURNS NVARCHAR(4000)
AS
BEGIN
  DECLARE @value NVARCHAR(4000);
  SELECT @value = [parameter_value]
  FROM [tsaat].[spi_rule_parameter]
  WHERE [spi_id] = @spi_id AND [parameter_key] = @parameter_key AND [parameter_type] = N'string';
  RETURN COALESCE(NULLIF(LTRIM(RTRIM(@value)), N''), @fallback);
END;
GO

CREATE OR ALTER FUNCTION [tsaat].[fn_spi_number_parameter] (
  @spi_id INT,
  @parameter_key NVARCHAR(100),
  @fallback DECIMAL(18,4)
)
RETURNS DECIMAL(18,4)
AS
BEGIN
  DECLARE @value DECIMAL(18,4);
  SELECT @value = TRY_CONVERT(DECIMAL(18,4), [parameter_value])
  FROM [tsaat].[spi_rule_parameter]
  WHERE [spi_id] = @spi_id AND [parameter_key] = @parameter_key AND [parameter_type] = N'number';
  RETURN COALESCE(@value, @fallback);
END;
GO

CREATE OR ALTER FUNCTION [tsaat].[fn_spi_boolean_parameter] (
  @spi_id INT,
  @parameter_key NVARCHAR(100),
  @fallback BIT
)
RETURNS BIT
AS
BEGIN
  DECLARE @raw NVARCHAR(4000);
  SELECT @raw = LOWER(LTRIM(RTRIM([parameter_value])))
  FROM [tsaat].[spi_rule_parameter]
  WHERE [spi_id] = @spi_id AND [parameter_key] = @parameter_key AND [parameter_type] = N'boolean';
  RETURN CASE
    WHEN @raw IN (N'1', N'true', N'yes') THEN CAST(1 AS BIT)
    WHEN @raw IN (N'0', N'false', N'no') THEN CAST(0 AS BIT)
    ELSE @fallback
  END;
END;
GO

CREATE OR ALTER FUNCTION [tsaat].[fn_spi_vulnerability_count] (
  @snapshot_id BIGINT,
  @asset_id NVARCHAR(255),
  @severity NVARCHAR(20)
)
RETURNS INT
AS
BEGIN
  DECLARE @count INT;
  SELECT @count = COUNT(*)
  FROM [tsaat].[asset_vulnerability]
  WHERE [snapshot_id] = @snapshot_id AND [asset_id] = @asset_id AND [severity] = @severity;
  RETURN COALESCE(@count, 0);
END;
GO

CREATE OR ALTER FUNCTION [tsaat].[fn_spi_installed_software_count] (
  @snapshot_id BIGINT,
  @asset_id NVARCHAR(255)
)
RETURNS INT
AS
BEGIN
  DECLARE @count INT;
  SELECT @count = COUNT(*)
  FROM [tsaat].[asset_installed_software]
  WHERE [snapshot_id] = @snapshot_id AND [asset_id] = @asset_id;
  RETURN COALESCE(@count, 0);
END;
GO

CREATE OR ALTER FUNCTION [tsaat].[fn_spi_software_support_status_count] (
  @snapshot_id BIGINT,
  @asset_id NVARCHAR(255),
  @support_status NVARCHAR(20)
)
RETURNS INT
AS
BEGIN
  DECLARE @count INT;
  SELECT @count = COUNT(*)
  FROM [tsaat].[asset_installed_software]
  WHERE [snapshot_id] = @snapshot_id AND [asset_id] = @asset_id AND [support_status] = @support_status;
  RETURN COALESCE(@count, 0);
END;
GO

CREATE OR ALTER PROCEDURE [tsaat].[usp_evaluate_spi_snapshot]
  @snapshot_id BIGINT
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @sql NVARCHAR(MAX) = N'';
  DECLARE @ruleKey NVARCHAR(100);
  DECLARE @spiId INT;
  DECLARE @displayOrder INT;
  DECLARE @statusSql NVARCHAR(MAX);
  DECLARE @outcomeSql NVARCHAR(MAX);
  DECLARE @evidenceSelect NVARCHAR(MAX);
  DECLARE @statement NVARCHAR(MAX);

  DECLARE calculation_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT
      sd.[rule_key],
      sd.[spi_id],
      sd.[display_order],
      scd.[status_expression_sql],
      scd.[outcome_expression_sql]
    FROM [tsaat].[spi_definition] AS sd
    INNER JOIN [tsaat].[spi_rule_definition] AS srd
      ON srd.[rule_key] = sd.[rule_key] AND srd.[enabled] = 1
    INNER JOIN [tsaat].[spi_calculation_definition] AS scd
      ON scd.[rule_key] = sd.[rule_key] AND scd.[enabled] = 1
    INNER JOIN [tsaat].[spi_calculation_source] AS scs
      ON scs.[source_key] = scd.[source_key]
      AND scs.[enabled] = 1
      AND scs.[source_object_name] = N'[tsaat].[vw_spi_asset_evaluation_context]'
    WHERE sd.[enabled] = 1
    ORDER BY sd.[display_order], sd.[spi_id];

  OPEN calculation_cursor;
  FETCH NEXT FROM calculation_cursor INTO @ruleKey, @spiId, @displayOrder, @statusSql, @outcomeSql;

  WHILE @@FETCH_STATUS = 0
  BEGIN
    SELECT @evidenceSelect = STRING_AGG(
      CAST([value_expression_sql] + N' AS ' + QUOTENAME([evidence_key]) AS NVARCHAR(MAX)),
      N', '
    ) WITHIN GROUP (ORDER BY [display_order], [evidence_key])
    FROM [tsaat].[spi_calculation_evidence_expression]
    WHERE [rule_key] = @ruleKey;

    IF @evidenceSelect IS NULL OR LEN(@evidenceSelect) = 0
    BEGIN
      THROW 53000, 'SPI calculation evidence configuration is missing.', 1;
    END;

    SET @statement =
      N'SELECT ctx.[snapshot_id], ctx.[asset_id], ' +
      CONVERT(NVARCHAR(20), @spiId) +
      N' AS [spi_id], ' +
      CONVERT(NVARCHAR(20), @displayOrder) +
      N' AS [display_order], ' +
      @statusSql +
      N' AS [compliance_status], ' +
      @outcomeSql +
      N' AS [outcome_key], JSON_QUERY((SELECT ' +
      @evidenceSelect +
      N' FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES)) AS [evidence_json] ' +
      N'FROM [tsaat].[vw_spi_asset_evaluation_context] AS ctx ' +
      N'CROSS JOIN (SELECT CAST(' +
      CONVERT(NVARCHAR(20), @spiId) +
      N' AS INT) AS [spi_id]) AS sd ' +
      N'WHERE ctx.[snapshot_id] = @snapshot_id ' +
      N'AND EXISTS (SELECT 1 FROM [tsaat].[spi_applicable_asset_type] AS saat WHERE saat.[spi_id] = sd.[spi_id] AND saat.[asset_type] = ctx.[asset_type])';

    SET @sql = CASE WHEN LEN(@sql) = 0 THEN @statement ELSE @sql + N' UNION ALL ' + @statement END;

    FETCH NEXT FROM calculation_cursor INTO @ruleKey, @spiId, @displayOrder, @statusSql, @outcomeSql;
  END;

  CLOSE calculation_cursor;
  DEALLOCATE calculation_cursor;

  IF LEN(@sql) > 0
  BEGIN
    SET @sql =
      N'SELECT [snapshot_id], [asset_id], [spi_id], [display_order], [compliance_status], [outcome_key], [evidence_json] ' +
      N'FROM (' + @sql + N') AS evaluation_result ' +
      N'ORDER BY [asset_id], [display_order], [spi_id]';

    EXEC sp_executesql @sql, N'@snapshot_id BIGINT', @snapshot_id = @snapshot_id;
    RETURN;
  END;

  SELECT
    CAST(NULL AS BIGINT) AS [snapshot_id],
    CAST(NULL AS NVARCHAR(255)) AS [asset_id],
    CAST(NULL AS INT) AS [spi_id],
    CAST(NULL AS INT) AS [display_order],
    CAST(NULL AS NVARCHAR(20)) AS [compliance_status],
    CAST(NULL AS NVARCHAR(100)) AS [outcome_key],
    CAST(NULL AS NVARCHAR(MAX)) AS [evidence_json]
  WHERE 1 = 0;
END;
GO

CREATE OR ALTER FUNCTION [tsaat].[fn_kpi_stable_hash](@value NVARCHAR(4000))
RETURNS BIGINT
AS
BEGIN
  DECLARE @hash BIGINT = 0;
  DECLARE @index INT = 1;
  DECLARE @length INT = LEN(COALESCE(@value, N''));
  WHILE @index <= @length
  BEGIN
    SET @hash = ((@hash * 31) + UNICODE(SUBSTRING(@value, @index, 1))) % 4294967296;
    SET @index += 1;
  END;
  RETURN @hash;
END;
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

CREATE OR ALTER PROCEDURE [tsaat].[usp_evaluate_kpi_snapshot]
  @snapshot_id BIGINT,
  @asset_ids_json NVARCHAR(MAX) = NULL,
  @system_ids_json NVARCHAR(MAX) = NULL,
  @network_ids_json NVARCHAR(MAX) = NULL,
  @effective_findings_json NVARCHAR(MAX) = N'[]',
  @emit_json BIT = 0
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @hasAssetScope BIT = CASE WHEN ISJSON(@asset_ids_json) = 1 THEN 1 ELSE 0 END;
  DECLARE @hasSystemScope BIT = CASE WHEN ISJSON(@system_ids_json) = 1 THEN 1 ELSE 0 END;
  DECLARE @hasNetworkScope BIT = CASE WHEN ISJSON(@network_ids_json) = 1 THEN 1 ELSE 0 END;
  DECLARE @AssetScope TABLE ([asset_id] NVARCHAR(255) NOT NULL PRIMARY KEY);
  DECLARE @SystemScope TABLE ([system_id] NVARCHAR(255) NOT NULL PRIMARY KEY);
  DECLARE @NetworkScope TABLE ([network_id] NVARCHAR(255) NOT NULL PRIMARY KEY);

  IF @hasAssetScope = 1 INSERT INTO @AssetScope SELECT DISTINCT CONVERT(NVARCHAR(255), [value]) FROM OPENJSON(@asset_ids_json) WHERE [type] IN (1, 2);
  IF @hasSystemScope = 1 INSERT INTO @SystemScope SELECT DISTINCT CONVERT(NVARCHAR(255), [value]) FROM OPENJSON(@system_ids_json) WHERE [type] IN (1, 2);
  IF @hasNetworkScope = 1 INSERT INTO @NetworkScope SELECT DISTINCT CONVERT(NVARCHAR(255), [value]) FROM OPENJSON(@network_ids_json) WHERE [type] IN (1, 2);

  DECLARE @Assets TABLE ([asset_id] NVARCHAR(255) NOT NULL PRIMARY KEY, [network_id] NVARCHAR(255) NOT NULL, [system_id] NVARCHAR(255) NULL, [security_domain] NVARCHAR(20) NOT NULL, [system_criticality] NVARCHAR(20) NULL);
  INSERT INTO @Assets
  SELECT a.[asset_id], a.[network_id], a.[system_id], a.[security_domain], s.[criticality]
  FROM [tsaat].[asset] AS a
  LEFT JOIN [tsaat].[ict_system] AS s ON s.[snapshot_id] = a.[snapshot_id] AND s.[system_id] = a.[system_id]
  WHERE a.[snapshot_id] = @snapshot_id AND (@hasAssetScope = 0 OR EXISTS (SELECT 1 FROM @AssetScope AS scope WHERE scope.[asset_id] = a.[asset_id]));

  DECLARE @Systems TABLE ([system_id] NVARCHAR(255) NOT NULL PRIMARY KEY, [network_id] NVARCHAR(255) NOT NULL, [diis_defined] BIT NOT NULL, [modelling_status] BIT NOT NULL);
  INSERT INTO @Systems
  SELECT s.[system_id], s.[network_id], s.[diis_defined], s.[modelling_status]
  FROM [tsaat].[ict_system] AS s
  WHERE s.[snapshot_id] = @snapshot_id AND (@hasSystemScope = 0 OR EXISTS (SELECT 1 FROM @SystemScope AS scope WHERE scope.[system_id] = s.[system_id]));

  DECLARE @Networks TABLE ([network_id] NVARCHAR(255) NOT NULL PRIMARY KEY, [discovery_status] NVARCHAR(40) NOT NULL);
  INSERT INTO @Networks
  SELECT n.[network_id], n.[discovery_status]
  FROM [tsaat].[managed_network] AS n
  WHERE n.[snapshot_id] = @snapshot_id AND (@hasNetworkScope = 0 OR EXISTS (SELECT 1 FROM @NetworkScope AS scope WHERE scope.[network_id] = n.[network_id]));

  DECLARE @SpiEvaluations TABLE ([snapshot_id] BIGINT NOT NULL, [asset_id] NVARCHAR(255) NOT NULL, [spi_id] INT NOT NULL, [display_order] INT NOT NULL, [compliance_status] NVARCHAR(20) NOT NULL, [outcome_key] NVARCHAR(100) NOT NULL, [evidence_json] NVARCHAR(MAX) NOT NULL);
  INSERT INTO @SpiEvaluations EXEC [tsaat].[usp_evaluate_spi_snapshot] @snapshot_id = @snapshot_id;
  DELETE se FROM @SpiEvaluations AS se WHERE NOT EXISTS (SELECT 1 FROM @Assets AS a WHERE a.[asset_id] = se.[asset_id]);

  DECLARE @Discovery TABLE ([snapshot_id] BIGINT NOT NULL, [asset_id] NVARCHAR(255) NOT NULL, [coverage_compliance] BIT NOT NULL, [tool_values_json] NVARCHAR(MAX) NOT NULL, [missing_tool_ids_json] NVARCHAR(MAX) NOT NULL, [missing_tool_names_json] NVARCHAR(MAX) NOT NULL);
  INSERT INTO @Discovery EXEC [tsaat].[usp_evaluate_discovery_coverage_snapshot] @snapshot_id = @snapshot_id, @asset_ids_json = @asset_ids_json, @emit_json = 0;

  DECLARE @Findings TABLE ([asset_id] NVARCHAR(255) NOT NULL, [severity] NVARCHAR(30) NOT NULL, [priority_rank] INT NOT NULL);
  IF ISJSON(@effective_findings_json) = 1
  BEGIN
    INSERT INTO @Findings ([asset_id], [severity], [priority_rank])
    SELECT [asset_id], [severity], [priority_rank]
    FROM OPENJSON(@effective_findings_json) WITH ([asset_id] NVARCHAR(255) '$.assetId', [severity] NVARCHAR(30) '$.severity', [priority_rank] INT '$.priorityRank')
    WHERE [asset_id] IS NOT NULL AND EXISTS (SELECT 1 FROM @Assets AS a WHERE a.[asset_id] = [asset_id]);
  END;

  DECLARE @overallUnknown INT = (SELECT COUNT(*) FROM @SpiEvaluations WHERE [compliance_status] = N'Unknown');
  DECLARE @Metric TABLE ([calculation_key] NVARCHAR(100) NOT NULL PRIMARY KEY, [score] NVARCHAR(100) NOT NULL, [score_percent] DECIMAL(9,1) NOT NULL, [compliant_count] INT NOT NULL, [applicable_count] INT NOT NULL, [non_compliant_count] INT NOT NULL, [unknown_count] INT NOT NULL, [high_priority_count] INT NOT NULL);

  ;WITH base AS (
    SELECT se.[compliance_status], a.[security_domain], a.[system_criticality], a.[asset_id], a.[system_id]
    FROM @SpiEvaluations AS se INNER JOIN @Assets AS a ON a.[asset_id] = se.[asset_id]
  ),
  grouped AS (
    SELECT N'overall-spi-compliance' AS [calculation_key], COUNT(*) AS [total], SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END) AS [compliant], SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END) AS [non_compliant], SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END) AS [unknown], (SELECT COUNT(*) FROM @Findings WHERE [priority_rank] <= 2) AS [high_priority] FROM base
    UNION ALL SELECT N'protected-domain-compliance', COUNT(*), SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END), (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS fa ON fa.[asset_id] = f.[asset_id] WHERE f.[priority_rank] <= 2 AND fa.[security_domain] = N'Protected') FROM base WHERE [security_domain] = N'Protected'
    UNION ALL SELECT N'secret-domain-compliance', COUNT(*), SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END), (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS fa ON fa.[asset_id] = f.[asset_id] WHERE f.[priority_rank] <= 2 AND fa.[security_domain] = N'Secret') FROM base WHERE [security_domain] = N'Secret'
    UNION ALL SELECT N'critical-ict-system-compliance', COUNT(*), SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END), (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS fa ON fa.[asset_id] = f.[asset_id] WHERE f.[priority_rank] <= 2 AND fa.[system_criticality] = N'Critical') FROM base WHERE [system_criticality] = N'Critical'
  )
  INSERT INTO @Metric
  SELECT [calculation_key], CONVERT(NVARCHAR(40), CAST(CASE WHEN [total] = 0 THEN 0 ELSE ROUND(([compliant] * 100.0) / [total], 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE([compliant], 0)) + N'/' + CONVERT(NVARCHAR(20), COALESCE([total], 0)) + N')', CAST(CASE WHEN [total] = 0 THEN 0 ELSE ROUND(([compliant] * 100.0) / [total], 1) END AS DECIMAL(9,1)), COALESCE([compliant], 0), COALESCE([total], 0), COALESCE([non_compliant], 0), COALESCE([unknown], 0), COALESCE([high_priority], 0)
  FROM grouped;

  DECLARE @findingTotal INT = (SELECT COUNT(*) FROM @Findings);
  DECLARE @criticalExposure INT = (SELECT COUNT(*) FROM @Findings WHERE [severity] = N'Critical Exposure');
  INSERT INTO @Metric VALUES (N'critical-exposure-in-production', CONVERT(NVARCHAR(20), @criticalExposure), CAST(CASE WHEN @findingTotal = 0 THEN 0 ELSE ROUND(((CAST(@findingTotal - @criticalExposure AS DECIMAL(18,4))) * 100.0) / @findingTotal, 1) END AS DECIMAL(9,1)), CASE WHEN @findingTotal - @criticalExposure < 0 THEN 0 ELSE @findingTotal - @criticalExposure END, @findingTotal, @criticalExposure, @overallUnknown, @criticalExposure);

  DECLARE @discoveryTotal INT = (SELECT COUNT(*) FROM @Discovery);
  DECLARE @discoveryCompliant INT = (SELECT COUNT(*) FROM @Discovery WHERE [coverage_compliance] = 1);
  INSERT INTO @Metric VALUES (N'discovery-coverage-compliance', CONVERT(NVARCHAR(40), CAST(CASE WHEN @discoveryTotal = 0 THEN 0 ELSE ROUND((@discoveryCompliant * 100.0) / @discoveryTotal, 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), @discoveryCompliant) + N'/' + CONVERT(NVARCHAR(20), @discoveryTotal) + N')', CAST(CASE WHEN @discoveryTotal = 0 THEN 0 ELSE ROUND((@discoveryCompliant * 100.0) / @discoveryTotal, 1) END AS DECIMAL(9,1)), @discoveryCompliant, @discoveryTotal, @discoveryTotal - @discoveryCompliant, 0, (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Discovery AS d ON d.[asset_id] = f.[asset_id] WHERE f.[priority_rank] <= 2 AND d.[coverage_compliance] = 0));

  ;WITH scoped_systems AS (SELECT DISTINCT [system_id] FROM @Assets WHERE [system_id] IS NOT NULL),
  ato AS (SELECT [system_id], CASE WHEN [tsaat].[fn_kpi_stable_hash]([system_id] + N':ato') % 5 <> 0 THEN 1 ELSE 0 END AS [compliant] FROM scoped_systems),
  diis AS (SELECT [system_id], CASE WHEN [tsaat].[fn_kpi_stable_hash]([system_id] + N':diis') % 4 <> 1 THEN 1 ELSE 0 END AS [compliant] FROM scoped_systems)
  INSERT INTO @Metric
  SELECT N'active-ato-coverage', CONVERT(NVARCHAR(40), CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(SUM([compliant]), 0)) + N'/' + CONVERT(NVARCHAR(20), COUNT(*)) + N')', CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1)), COALESCE(SUM([compliant]), 0), COUNT(*), COUNT(*) - COALESCE(SUM([compliant]), 0), 0, (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS a ON a.[asset_id] = f.[asset_id] INNER JOIN ato AS ato_rows ON ato_rows.[system_id] = a.[system_id] WHERE f.[priority_rank] <= 2 AND ato_rows.[compliant] = 0) FROM ato
  UNION ALL
  SELECT N'diis-registration-coverage', CONVERT(NVARCHAR(40), CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(SUM([compliant]), 0)) + N'/' + CONVERT(NVARCHAR(20), COUNT(*)) + N')', CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1)), COALESCE(SUM([compliant]), 0), COUNT(*), COUNT(*) - COALESCE(SUM([compliant]), 0), 0, (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS a ON a.[asset_id] = f.[asset_id] INNER JOIN diis AS diis_rows ON diis_rows.[system_id] = a.[system_id] WHERE f.[priority_rank] <= 2 AND diis_rows.[compliant] = 0) FROM diis;

  DECLARE @diisSystemTotal INT = (SELECT COUNT(*) FROM @Systems WHERE [diis_defined] = 1);
  DECLARE @diisSystemModelled INT = (SELECT COUNT(*) FROM @Systems WHERE [diis_defined] = 1 AND [modelling_status] = 1);
  INSERT INTO @Metric VALUES (N'diis-modelled-coverage', CONVERT(NVARCHAR(40), CAST(CASE WHEN @diisSystemTotal = 0 THEN 0 ELSE ROUND((@diisSystemModelled * 100.0) / @diisSystemTotal, 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), @diisSystemModelled) + N'/' + CONVERT(NVARCHAR(20), @diisSystemTotal) + N')', CAST(CASE WHEN @diisSystemTotal = 0 THEN 0 ELSE ROUND((@diisSystemModelled * 100.0) / @diisSystemTotal, 1) END AS DECIMAL(9,1)), @diisSystemModelled, @diisSystemTotal, @diisSystemTotal - @diisSystemModelled, 0, @diisSystemTotal - @diisSystemModelled);

  DECLARE @networkTotal INT = (SELECT COUNT(*) FROM @Networks);
  DECLARE @networkEnabled INT = (SELECT COUNT(*) FROM @Networks WHERE [discovery_status] = N'Discovery Enabled');
  INSERT INTO @Metric VALUES (N'network-discovery-enablement', CONVERT(NVARCHAR(40), CAST(CASE WHEN @networkTotal = 0 THEN 0 ELSE ROUND((@networkEnabled * 100.0) / @networkTotal, 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), @networkEnabled) + N'/' + CONVERT(NVARCHAR(20), @networkTotal) + N')', CAST(CASE WHEN @networkTotal = 0 THEN 0 ELSE ROUND((@networkEnabled * 100.0) / @networkTotal, 1) END AS DECIMAL(9,1)), @networkEnabled, @networkTotal, @networkTotal - @networkEnabled, 0, @networkTotal - @networkEnabled);

  IF @emit_json = 1
  BEGIN
    SELECT kd.[kpi_id] AS [kpiId], kd.[display_order] AS [displayOrder], kd.[calculation_key] AS [calculationKey], metric.[score] AS [score], metric.[score_percent] AS [scorePercent], metric.[compliant_count] AS [compliantCount], metric.[applicable_count] AS [applicableCount], metric.[non_compliant_count] AS [nonCompliantCount], metric.[unknown_count] AS [unknownCount], metric.[high_priority_count] AS [highPriorityCount]
    FROM [tsaat].[kpi_definition] AS kd
    INNER JOIN [tsaat].[kpi_calculation_definition] AS kcd ON kcd.[calculation_key] = kd.[calculation_key] AND kcd.[enabled] = 1
    INNER JOIN @Metric AS metric ON metric.[calculation_key] = kd.[calculation_key]
    WHERE kd.[enabled] = 1
    ORDER BY kd.[display_order], kd.[kpi_id]
    FOR JSON PATH;
    RETURN;
  END;

  SELECT @snapshot_id AS [snapshot_id], kd.[kpi_id], kd.[display_order], kd.[calculation_key], metric.[score], metric.[score_percent], metric.[compliant_count], metric.[applicable_count], metric.[non_compliant_count], metric.[unknown_count], metric.[high_priority_count]
  FROM [tsaat].[kpi_definition] AS kd
  INNER JOIN [tsaat].[kpi_calculation_definition] AS kcd ON kcd.[calculation_key] = kd.[calculation_key] AND kcd.[enabled] = 1
  INNER JOIN @Metric AS metric ON metric.[calculation_key] = kd.[calculation_key]
  WHERE kd.[enabled] = 1
  ORDER BY kd.[display_order], kd.[kpi_id];
END;
GO

CREATE OR ALTER VIEW [tsaat].[vw_persisted_finding_normalized]
AS
SELECT
  f.[snapshot_id],
  f.[finding_id],
  f.[spi_id],
  f.[priority_rank] AS [raw_priority_rank],
  f.[severity] AS [raw_severity],
  f.[priority_rank] AS [display_priority_rank],
  f.[severity] AS [display_severity],
  f.[compliance_status],
  f.[network_id],
  f.[system_id],
  f.[environment_type],
  f.[asset_id],
  f.[title],
  f.[evidence],
  f.[recommended_action],
  f.[workflow_status],
  f.[observed_at],
  f.[closed_at],
  CAST(N'persisted' AS NVARCHAR(20)) AS [source_kind]
FROM [tsaat].[finding] AS f;
GO

CREATE OR ALTER FUNCTION [tsaat].[fn_finding_hash_int](
  @value NVARCHAR(MAX),
  @minimum INT,
  @maximum INT
)
RETURNS INT
AS
BEGIN
  DECLARE @range INT = @maximum - @minimum + 1;
  DECLARE @hash BIGINT = CONVERT(BIGINT, CHECKSUM(COALESCE(@value, N'')));
  IF @range <= 0
    RETURN @minimum;
  IF @hash < 0
    SET @hash = -@hash;
  RETURN @minimum + CONVERT(INT, @hash % @range);
END;
GO

CREATE OR ALTER PROCEDURE [tsaat].[usp_generate_spi_findings_snapshot]
  @snapshot_id BIGINT,
  @as_of_date DATE = NULL,
  @emit_json BIT = 0
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @snapshotDate DATE = (
    SELECT [snapshot_date]
    FROM [tsaat].[dataset_snapshot]
    WHERE [snapshot_id] = @snapshot_id
  );

  IF @snapshotDate IS NULL
  BEGIN
    THROW 54000, 'Snapshot not found for generated findings.', 1;
  END;

  DECLARE @policyKey NVARCHAR(100);
  DECLARE @historyStart DATE;
  DECLARE @baselineBacklogCount INT;
  DECLARE @minOpenCount INT;
  DECLARE @maxOpenCount INT;
  DECLARE @addProbabilityPercent INT;
  DECLARE @addRateMinPercent INT;
  DECLARE @addRateMaxPercent INT;
  DECLARE @closeRateMinPercent INT;
  DECLARE @closeRateMaxPercent INT;
  DECLARE @closeBackfillMinCount INT;
  DECLARE @closeBackfillMaxCount INT;
  DECLARE @timezoneOffsetMinutes INT;

  SELECT TOP (1)
    @policyKey = fsp.[policy_key],
    @historyStart = fgp.[history_start_date],
    @baselineBacklogCount = fgp.[baseline_backlog_count],
    @minOpenCount = fgp.[min_open_count],
    @maxOpenCount = fgp.[max_open_count],
    @addProbabilityPercent = fgp.[add_probability_percent],
    @addRateMinPercent = fgp.[add_rate_min_percent],
    @addRateMaxPercent = fgp.[add_rate_max_percent],
    @closeRateMinPercent = fgp.[close_rate_min_percent],
    @closeRateMaxPercent = fgp.[close_rate_max_percent],
    @closeBackfillMinCount = fgp.[close_backfill_min_count],
    @closeBackfillMaxCount = fgp.[close_backfill_max_count],
    @timezoneOffsetMinutes = fgp.[timezone_offset_minutes]
  FROM [tsaat].[finding_source_policy] AS fsp
  INNER JOIN [tsaat].[finding_generation_policy] AS fgp
    ON fgp.[policy_key] = fsp.[policy_key]
  WHERE fsp.[enabled] = 1 AND fsp.[generate_when_empty] = 1
  ORDER BY fsp.[display_order], fsp.[policy_key];

  IF @policyKey IS NULL
  BEGIN
    IF @emit_json = 1
    BEGIN
      SELECT
        CAST(NULL AS NVARCHAR(255)) AS [id],
        CAST(NULL AS INT) AS [spiId],
        CAST(NULL AS INT) AS [priorityRank],
        CAST(NULL AS NVARCHAR(30)) AS [severity],
        CAST(NULL AS NVARCHAR(20)) AS [rawSeverity],
        CAST(NULL AS INT) AS [rawPriorityRank],
        CAST(NULL AS NVARCHAR(20)) AS [complianceStatus],
        CAST(NULL AS NVARCHAR(255)) AS [networkId],
        CAST(NULL AS NVARCHAR(255)) AS [systemId],
        CAST(NULL AS NVARCHAR(20)) AS [environmentType],
        CAST(NULL AS NVARCHAR(255)) AS [assetId],
        CAST(NULL AS NVARCHAR(1000)) AS [title],
        JSON_QUERY(N'{}') AS [evidence],
        CAST(NULL AS NVARCHAR(MAX)) AS [recommendedAction],
        CAST(NULL AS NVARCHAR(10)) AS [status],
        CAST(NULL AS NVARCHAR(40)) AS [timestamp],
        CAST(NULL AS NVARCHAR(40)) AS [closedTimestamp],
        CAST(NULL AS NVARCHAR(20)) AS [sourceKind]
      WHERE 1 = 0
      FOR JSON PATH;
      RETURN;
    END;
    SELECT
      CAST(NULL AS BIGINT) AS [snapshot_id],
      CAST(NULL AS NVARCHAR(255)) AS [finding_id],
      CAST(NULL AS INT) AS [spi_id],
      CAST(NULL AS INT) AS [raw_priority_rank],
      CAST(NULL AS NVARCHAR(30)) AS [raw_severity],
      CAST(NULL AS INT) AS [display_priority_rank],
      CAST(NULL AS NVARCHAR(30)) AS [display_severity],
      CAST(NULL AS NVARCHAR(20)) AS [compliance_status],
      CAST(NULL AS NVARCHAR(255)) AS [network_id],
      CAST(NULL AS NVARCHAR(255)) AS [system_id],
      CAST(NULL AS NVARCHAR(20)) AS [environment_type],
      CAST(NULL AS NVARCHAR(255)) AS [asset_id],
      CAST(NULL AS NVARCHAR(1000)) AS [title],
      CAST(NULL AS NVARCHAR(MAX)) AS [evidence],
      CAST(NULL AS NVARCHAR(MAX)) AS [recommended_action],
      CAST(NULL AS NVARCHAR(10)) AS [workflow_status],
      CAST(NULL AS DATETIMEOFFSET(7)) AS [observed_at],
      CAST(NULL AS DATETIMEOFFSET(7)) AS [closed_at],
      CAST(NULL AS NVARCHAR(20)) AS [source_kind]
    WHERE 1 = 0;
    RETURN;
  END;

  DECLARE @SpiEvaluations TABLE (
    [snapshot_id] BIGINT NOT NULL,
    [asset_id] NVARCHAR(255) NOT NULL,
    [spi_id] INT NOT NULL,
    [display_order] INT NOT NULL,
    [compliance_status] NVARCHAR(20) NOT NULL,
    [outcome_key] NVARCHAR(100) NOT NULL,
    [evidence_json] NVARCHAR(MAX) NOT NULL
  );

  INSERT INTO @SpiEvaluations (
    [snapshot_id],
    [asset_id],
    [spi_id],
    [display_order],
    [compliance_status],
    [outcome_key],
    [evidence_json]
  )
  EXEC [tsaat].[usp_evaluate_spi_snapshot] @snapshot_id = @snapshot_id;

  DECLARE @ProductionCriticalAssets TABLE ([asset_id] NVARCHAR(255) NOT NULL PRIMARY KEY);
  INSERT INTO @ProductionCriticalAssets ([asset_id])
  SELECT DISTINCT e.[asset_id]
  FROM @SpiEvaluations AS e
  INNER JOIN [tsaat].[spi_feature_binding] AS sfb
    ON sfb.[spi_id] = e.[spi_id]
    AND sfb.[enabled] = 1
    AND sfb.[feature_key] = N'production-critical-exposure'
    AND (sfb.[compliance_status] IS NULL OR sfb.[compliance_status] = e.[compliance_status])
    AND (sfb.[outcome_key] IS NULL OR sfb.[outcome_key] = e.[outcome_key]);

  DECLARE @Drafts TABLE (
    [draft_ordinal] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [asset_id] NVARCHAR(255) NOT NULL,
    [spi_id] INT NOT NULL,
    [raw_priority_rank] INT NOT NULL,
    [raw_severity] NVARCHAR(30) NOT NULL,
    [display_priority_rank] INT NOT NULL,
    [display_severity] NVARCHAR(30) NOT NULL,
    [compliance_status] NVARCHAR(20) NOT NULL,
    [network_id] NVARCHAR(255) NOT NULL,
    [system_id] NVARCHAR(255) NULL,
    [environment_type] NVARCHAR(20) NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [evidence] NVARCHAR(MAX) NOT NULL,
    [recommended_action] NVARCHAR(MAX) NOT NULL
  );

  INSERT INTO @Drafts (
    [asset_id],
    [spi_id],
    [raw_priority_rank],
    [raw_severity],
    [display_priority_rank],
    [display_severity],
    [compliance_status],
    [network_id],
    [system_id],
    [environment_type],
    [title],
    [evidence],
    [recommended_action]
  )
  SELECT
    e.[asset_id],
    e.[spi_id],
    COALESCE(rule_match.[priority_rank], sd.[priority_order]),
    COALESCE(rule_match.[severity_key], sd.[default_severity]),
    CASE
      WHEN e.[compliance_status] = N'Non-compliant'
        THEN COALESCE(mpm.[priority_rank], rule_match.[priority_rank], sd.[priority_order])
      ELSE COALESCE(rule_match.[priority_rank], sd.[priority_order])
    END,
    COALESCE(msm.[severity], rule_match.[severity_key], sd.[default_severity]),
    e.[compliance_status],
    a.[network_id],
    a.[system_id],
    a.[environment_type],
    sd.[description],
    JSON_MODIFY(JSON_MODIFY(COALESCE(e.[evidence_json], N'{}'), N'$.assetName', a.[name]), N'$.assetType', a.[asset_type]),
    sd.[recommended_action]
  FROM @SpiEvaluations AS e
  INNER JOIN [tsaat].[asset] AS a
    ON a.[snapshot_id] = @snapshot_id AND a.[asset_id] = e.[asset_id]
  INNER JOIN [tsaat].[spi_definition] AS sd
    ON sd.[spi_id] = e.[spi_id]
  OUTER APPLY (
    SELECT TOP (1)
      sfcr.[severity_key],
      sfcr.[priority_rank]
    FROM [tsaat].[spi_finding_classification_rule] AS sfcr
    WHERE sfcr.[enabled] = 1
      AND (sfcr.[spi_id] IS NULL OR sfcr.[spi_id] = e.[spi_id])
      AND (sfcr.[compliance_status] IS NULL OR sfcr.[compliance_status] = e.[compliance_status])
      AND (
        sfcr.[condition_key] = N'always'
        OR (sfcr.[condition_key] = N'when_unknown' AND e.[compliance_status] = N'Unknown')
        OR (sfcr.[condition_key] = N'when_non_compliant' AND e.[compliance_status] = N'Non-compliant')
        OR (sfcr.[condition_key] = N'when_production_critical_asset' AND e.[compliance_status] = N'Non-compliant' AND EXISTS (SELECT 1 FROM @ProductionCriticalAssets AS pca WHERE pca.[asset_id] = e.[asset_id]))
        OR (sfcr.[condition_key] = N'when_not_production_critical_asset' AND e.[compliance_status] = N'Non-compliant' AND NOT EXISTS (SELECT 1 FROM @ProductionCriticalAssets AS pca WHERE pca.[asset_id] = e.[asset_id]))
      )
    ORDER BY sfcr.[display_order], sfcr.[classification_rule_id]
  ) AS rule_match
  OUTER APPLY (
    SELECT TOP (1) msv.[settings_version_id]
    FROM [tsaat].[measures_settings_version] AS msv
    ORDER BY msv.[updated_at] DESC, msv.[settings_version_id] DESC
  ) AS latest_settings
  LEFT JOIN [tsaat].[measures_severity_matrix] AS msm
    ON msm.[settings_version_id] = latest_settings.[settings_version_id]
    AND msm.[spi_id] = e.[spi_id]
    AND msm.[asset_type] = a.[asset_type]
  LEFT JOIN [tsaat].[measures_priority_matrix] AS mpm
    ON mpm.[settings_version_id] = latest_settings.[settings_version_id]
    AND mpm.[spi_id] = e.[spi_id]
  WHERE e.[compliance_status] IN (N'Non-compliant', N'Unknown');

  DECLARE @Generated TABLE (
    [sequence_id] INT NOT NULL PRIMARY KEY,
    [draft_ordinal] INT NOT NULL,
    [workflow_status] NVARCHAR(10) NOT NULL,
    [observed_at] DATETIMEOFFSET(7) NOT NULL,
    [closed_at] DATETIMEOFFSET(7) NULL
  );

  DECLARE @OpenSequences TABLE ([sequence_id] INT NOT NULL PRIMARY KEY);
  DECLARE @draftCount INT = (SELECT COUNT(*) FROM @Drafts);
  DECLARE @sequence INT = 1;

  IF @draftCount > 0
  BEGIN
    DECLARE @day DATE = @historyStart;
    DECLARE @dayIndex INT = 0;

    WHILE @day <= @snapshotDate
    BEGIN
      DECLARE @openCount INT = (SELECT COUNT(*) FROM @OpenSequences);
      DECLARE @chooseAdd BIT = 0;
      IF @dayIndex = 0 OR @openCount <= @minOpenCount
        SET @chooseAdd = 1;
      ELSE IF @openCount >= @maxOpenCount
        SET @chooseAdd = 0;
      ELSE IF [tsaat].[fn_finding_hash_int](CONCAT(N'daily-direction:', @snapshotDate, N':', @dayIndex), 1, 100) <= @addProbabilityPercent
        SET @chooseAdd = 1;

      IF @chooseAdd = 1
      BEGIN
        DECLARE @addCount INT;
        IF @dayIndex = 0
          SET @addCount = @baselineBacklogCount;
        ELSE
        BEGIN
          DECLARE @addRate INT = [tsaat].[fn_finding_hash_int](CONCAT(N'daily-add-rate:', @snapshotDate, N':', @dayIndex), @addRateMinPercent, @addRateMaxPercent);
          SET @addCount = CASE WHEN @openCount > 0 THEN (@openCount * @addRate) / 100 ELSE 0 END;
          IF @addCount < 1 SET @addCount = 1;
        END;

        DECLARE @addIndex INT = 0;
        WHILE @addIndex < @addCount
        BEGIN
          DECLARE @draftOrdinal INT = [tsaat].[fn_finding_hash_int](CONCAT(N'template:', @snapshotDate, N':', @dayIndex, N':', @addIndex), 1, @draftCount);
          DECLARE @minuteOffset INT = [tsaat].[fn_finding_hash_int](CONCAT(N'timestamp:', @snapshotDate, N':', @dayIndex, N':', @addIndex), 0, 1439);
          DECLARE @observedAt DATETIMEOFFSET(7) = TODATETIMEOFFSET(DATEADD(MINUTE, @minuteOffset, CAST(@day AS DATETIME2(7))), '-05:00');
          IF CONVERT(DATE, @observedAt) > @snapshotDate
            SET @observedAt = TODATETIMEOFFSET(CAST(@snapshotDate AS DATETIME2(7)), '-05:00');

          INSERT INTO @Generated ([sequence_id], [draft_ordinal], [workflow_status], [observed_at], [closed_at])
          VALUES (@sequence, @draftOrdinal, N'open', @observedAt, NULL);
          INSERT INTO @OpenSequences ([sequence_id]) VALUES (@sequence);
          SET @sequence += 1;
          SET @addIndex += 1;
        END;
      END
      ELSE IF @openCount > 0
      BEGIN
        DECLARE @closeRate INT = [tsaat].[fn_finding_hash_int](CONCAT(N'daily-close-rate:', @snapshotDate, N':', @dayIndex), @closeRateMinPercent, @closeRateMaxPercent);
        DECLARE @closeCount INT = (@openCount * @closeRate) / 100;
        IF @closeCount < 1 SET @closeCount = 1;
        IF @closeCount > @openCount SET @closeCount = @openCount;

        ;WITH close_pick AS (
          SELECT TOP (@closeCount)
            os.[sequence_id],
            ROW_NUMBER() OVER (ORDER BY [tsaat].[fn_finding_hash_int](CONCAT(N'close-pick:', @snapshotDate, N':', @dayIndex, N':', os.[sequence_id]), 0, 2147483646), os.[sequence_id]) AS [close_ordinal]
          FROM @OpenSequences AS os
          ORDER BY [tsaat].[fn_finding_hash_int](CONCAT(N'close-pick:', @snapshotDate, N':', @dayIndex, N':', os.[sequence_id]), 0, 2147483646), os.[sequence_id]
        )
        UPDATE g
          SET
            [workflow_status] = N'closed',
            [closed_at] = CASE
              WHEN close_time.[closed_at] <= g.[observed_at] THEN DATEADD(MINUTE, 1, g.[observed_at])
              ELSE close_time.[closed_at]
            END
        FROM @Generated AS g
        INNER JOIN close_pick AS cp
          ON cp.[sequence_id] = g.[sequence_id]
        CROSS APPLY (
          SELECT TODATETIMEOFFSET(
            DATEADD(MINUTE, [tsaat].[fn_finding_hash_int](CONCAT(N'closed:', @snapshotDate, N':', @dayIndex, N':', cp.[sequence_id]), 0, 1439), CAST(@day AS DATETIME2(7))),
            '-05:00'
          ) AS [closed_at]
        ) AS close_time;

        DELETE os
        FROM @OpenSequences AS os
        WHERE EXISTS (
          SELECT 1
          FROM @Generated AS g
          WHERE g.[sequence_id] = os.[sequence_id] AND g.[workflow_status] = N'closed'
        );

        DECLARE @backfillCount INT = [tsaat].[fn_finding_hash_int](CONCAT(N'daily-close-backfill:', @snapshotDate, N':', @dayIndex), @closeBackfillMinCount, @closeBackfillMaxCount);
        DECLARE @backfillIndex INT = 0;
        WHILE @backfillIndex < @backfillCount
        BEGIN
          DECLARE @backfillDraftOrdinal INT = [tsaat].[fn_finding_hash_int](CONCAT(N'daily-close-backfill-template:', @snapshotDate, N':', @dayIndex, N':', @backfillIndex), 1, @draftCount);
          DECLARE @backfillMinute INT = [tsaat].[fn_finding_hash_int](CONCAT(N'daily-close-backfill-time:', @snapshotDate, N':', @dayIndex, N':', @backfillIndex), 0, 1439);
          INSERT INTO @Generated ([sequence_id], [draft_ordinal], [workflow_status], [observed_at], [closed_at])
          VALUES (@sequence, @backfillDraftOrdinal, N'open', TODATETIMEOFFSET(DATEADD(MINUTE, @backfillMinute, CAST(@day AS DATETIME2(7))), '-05:00'), NULL);
          INSERT INTO @OpenSequences ([sequence_id]) VALUES (@sequence);
          SET @sequence += 1;
          SET @backfillIndex += 1;
        END;
      END;

      SET @dayIndex += 1;
      SET @day = DATEADD(DAY, 1, @day);
    END;
  END;

  DECLARE @Rows TABLE (
    [snapshot_id] BIGINT NOT NULL,
    [finding_id] NVARCHAR(255) NOT NULL,
    [spi_id] INT NOT NULL,
    [raw_priority_rank] INT NOT NULL,
    [raw_severity] NVARCHAR(30) NOT NULL,
    [display_priority_rank] INT NOT NULL,
    [display_severity] NVARCHAR(30) NOT NULL,
    [compliance_status] NVARCHAR(20) NOT NULL,
    [network_id] NVARCHAR(255) NOT NULL,
    [system_id] NVARCHAR(255) NULL,
    [environment_type] NVARCHAR(20) NULL,
    [asset_id] NVARCHAR(255) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [evidence] NVARCHAR(MAX) NOT NULL,
    [recommended_action] NVARCHAR(MAX) NOT NULL,
    [workflow_status] NVARCHAR(10) NOT NULL,
    [observed_at] DATETIMEOFFSET(7) NOT NULL,
    [closed_at] DATETIMEOFFSET(7) NULL,
    [source_kind] NVARCHAR(20) NOT NULL
  );

  INSERT INTO @Rows
  SELECT
    @snapshot_id,
    CONCAT(N'finding-', RIGHT(CONCAT(N'000000', g.[sequence_id]), 6)),
    d.[spi_id],
    d.[raw_priority_rank],
    d.[raw_severity],
    d.[display_priority_rank],
    d.[display_severity],
    d.[compliance_status],
    d.[network_id],
    d.[system_id],
    d.[environment_type],
    d.[asset_id],
    d.[title],
    d.[evidence],
    d.[recommended_action],
    CASE
      WHEN @as_of_date IS NULL THEN g.[workflow_status]
      WHEN CONVERT(DATE, g.[observed_at]) > @as_of_date THEN N'future'
      WHEN g.[closed_at] IS NOT NULL AND CONVERT(DATE, g.[closed_at]) <= @as_of_date THEN N'closed'
      ELSE N'open'
    END,
    g.[observed_at],
    g.[closed_at],
    N'generated'
  FROM @Generated AS g
  INNER JOIN @Drafts AS d
    ON d.[draft_ordinal] = g.[draft_ordinal]
  WHERE @as_of_date IS NULL
    OR (
      CONVERT(DATE, g.[observed_at]) <= @as_of_date
      AND (
        g.[closed_at] IS NULL
        OR CONVERT(DATE, g.[closed_at]) > @historyStart
      )
    );

  DELETE FROM @Rows WHERE [workflow_status] = N'future';

  IF @emit_json = 1
  BEGIN
    SELECT
      r.[finding_id] AS [id],
      r.[spi_id] AS [spiId],
      r.[display_priority_rank] AS [priorityRank],
      r.[display_severity] AS [severity],
      r.[raw_severity] AS [rawSeverity],
      r.[raw_priority_rank] AS [rawPriorityRank],
      r.[compliance_status] AS [complianceStatus],
      r.[network_id] AS [networkId],
      r.[system_id] AS [systemId],
      r.[environment_type] AS [environmentType],
      r.[asset_id] AS [assetId],
      r.[title] AS [title],
      JSON_QUERY(r.[evidence]) AS [evidence],
      r.[recommended_action] AS [recommendedAction],
      r.[workflow_status] AS [status],
      CONVERT(NVARCHAR(40), r.[observed_at], 127) AS [timestamp],
      CONVERT(NVARCHAR(40), r.[closed_at], 127) AS [closedTimestamp],
      r.[source_kind] AS [sourceKind]
    FROM @Rows AS r
    ORDER BY r.[display_priority_rank], r.[display_severity], r.[finding_id]
    FOR JSON PATH;
    RETURN;
  END;

  SELECT
    [snapshot_id],
    [finding_id],
    [spi_id],
    [raw_priority_rank],
    [raw_severity],
    [display_priority_rank],
    [display_severity],
    [compliance_status],
    [network_id],
    [system_id],
    [environment_type],
    [asset_id],
    [title],
    [evidence],
    [recommended_action],
    [workflow_status],
    [observed_at],
    [closed_at],
    [source_kind]
  FROM @Rows
  ORDER BY [display_priority_rank], [display_severity], [finding_id];
END;
GO

CREATE OR ALTER PROCEDURE [tsaat].[usp_get_effective_findings_snapshot]
  @snapshot_id BIGINT,
  @as_of_date DATE = NULL,
  @emit_json BIT = 0
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @usePersisted BIT = 1;
  DECLARE @generateWhenEmpty BIT = 1;
  SELECT TOP (1)
    @usePersisted = [use_persisted_findings],
    @generateWhenEmpty = [generate_when_empty]
  FROM [tsaat].[finding_source_policy]
  WHERE [enabled] = 1
  ORDER BY [display_order], [policy_key];

  IF @usePersisted = 1 AND EXISTS (SELECT 1 FROM [tsaat].[finding] WHERE [snapshot_id] = @snapshot_id)
  BEGIN
    DECLARE @Rows TABLE (
      [finding_id] NVARCHAR(255) NOT NULL,
      [spi_id] INT NOT NULL,
      [raw_priority_rank] INT NOT NULL,
      [raw_severity] NVARCHAR(30) NOT NULL,
      [display_priority_rank] INT NOT NULL,
      [display_severity] NVARCHAR(30) NOT NULL,
      [compliance_status] NVARCHAR(20) NOT NULL,
      [network_id] NVARCHAR(255) NOT NULL,
      [system_id] NVARCHAR(255) NULL,
      [environment_type] NVARCHAR(20) NULL,
      [asset_id] NVARCHAR(255) NOT NULL,
      [title] NVARCHAR(1000) NOT NULL,
      [evidence] NVARCHAR(MAX) NOT NULL,
      [recommended_action] NVARCHAR(MAX) NOT NULL,
      [workflow_status] NVARCHAR(10) NOT NULL,
      [observed_at] DATETIMEOFFSET(7) NOT NULL,
      [closed_at] DATETIMEOFFSET(7) NULL,
      [source_kind] NVARCHAR(20) NOT NULL
    );

    INSERT INTO @Rows
    SELECT
      f.[finding_id],
      f.[spi_id],
      f.[raw_priority_rank],
      f.[raw_severity],
      CASE
        WHEN f.[compliance_status] = N'Non-compliant' THEN COALESCE(mpm.[priority_rank], f.[raw_priority_rank])
        ELSE f.[raw_priority_rank]
      END,
      COALESCE(msm.[severity], f.[raw_severity]),
      f.[compliance_status],
      f.[network_id],
      f.[system_id],
      f.[environment_type],
      f.[asset_id],
      f.[title],
      f.[evidence],
      f.[recommended_action],
      CASE
        WHEN @as_of_date IS NULL THEN f.[workflow_status]
        WHEN CONVERT(DATE, f.[observed_at]) > @as_of_date THEN N'future'
        WHEN f.[closed_at] IS NOT NULL AND CONVERT(DATE, f.[closed_at]) <= @as_of_date THEN N'closed'
        ELSE N'open'
      END,
      f.[observed_at],
      f.[closed_at],
      f.[source_kind]
    FROM [tsaat].[vw_persisted_finding_normalized] AS f
    INNER JOIN [tsaat].[asset] AS a
      ON a.[snapshot_id] = f.[snapshot_id] AND a.[asset_id] = f.[asset_id]
    OUTER APPLY (
      SELECT TOP (1) msv.[settings_version_id]
      FROM [tsaat].[measures_settings_version] AS msv
      ORDER BY msv.[updated_at] DESC, msv.[settings_version_id] DESC
    ) AS latest_settings
    LEFT JOIN [tsaat].[measures_severity_matrix] AS msm
      ON msm.[settings_version_id] = latest_settings.[settings_version_id]
      AND msm.[spi_id] = f.[spi_id]
      AND msm.[asset_type] = a.[asset_type]
    LEFT JOIN [tsaat].[measures_priority_matrix] AS mpm
      ON mpm.[settings_version_id] = latest_settings.[settings_version_id]
      AND mpm.[spi_id] = f.[spi_id]
    WHERE f.[snapshot_id] = @snapshot_id
      AND (@as_of_date IS NULL OR CONVERT(DATE, f.[observed_at]) <= @as_of_date);

    DELETE FROM @Rows WHERE [workflow_status] = N'future';

    IF @emit_json = 1
    BEGIN
      SELECT
        r.[finding_id] AS [id],
        r.[spi_id] AS [spiId],
        r.[display_priority_rank] AS [priorityRank],
        r.[display_severity] AS [severity],
        r.[raw_severity] AS [rawSeverity],
        r.[raw_priority_rank] AS [rawPriorityRank],
        r.[compliance_status] AS [complianceStatus],
        r.[network_id] AS [networkId],
        r.[system_id] AS [systemId],
        r.[environment_type] AS [environmentType],
        r.[asset_id] AS [assetId],
        r.[title] AS [title],
        JSON_QUERY(r.[evidence]) AS [evidence],
        r.[recommended_action] AS [recommendedAction],
        r.[workflow_status] AS [status],
        CONVERT(NVARCHAR(40), r.[observed_at], 127) AS [timestamp],
        CONVERT(NVARCHAR(40), r.[closed_at], 127) AS [closedTimestamp],
        r.[source_kind] AS [sourceKind]
      FROM @Rows AS r
      ORDER BY r.[display_priority_rank], r.[display_severity], r.[finding_id]
      FOR JSON PATH;
      RETURN;
    END;

    SELECT
      @snapshot_id AS [snapshot_id],
      [finding_id],
      [spi_id],
      [raw_priority_rank],
      [raw_severity],
      [display_priority_rank],
      [display_severity],
      [compliance_status],
      [network_id],
      [system_id],
      [environment_type],
      [asset_id],
      [title],
      [evidence],
      [recommended_action],
      [workflow_status],
      [observed_at],
      [closed_at],
      [source_kind]
    FROM @Rows
    ORDER BY [display_priority_rank], [display_severity], [finding_id];
    RETURN;
  END;

  IF @generateWhenEmpty = 1
  BEGIN
    EXEC [tsaat].[usp_generate_spi_findings_snapshot]
      @snapshot_id = @snapshot_id,
      @as_of_date = @as_of_date,
      @emit_json = @emit_json;
    RETURN;
  END;

  IF @emit_json = 1
  BEGIN
    SELECT
      CAST(NULL AS NVARCHAR(255)) AS [id],
      CAST(NULL AS INT) AS [spiId],
      CAST(NULL AS INT) AS [priorityRank],
      CAST(NULL AS NVARCHAR(30)) AS [severity],
      CAST(NULL AS NVARCHAR(30)) AS [rawSeverity],
      CAST(NULL AS INT) AS [rawPriorityRank],
      CAST(NULL AS NVARCHAR(20)) AS [complianceStatus],
      CAST(NULL AS NVARCHAR(255)) AS [networkId],
      CAST(NULL AS NVARCHAR(255)) AS [systemId],
      CAST(NULL AS NVARCHAR(20)) AS [environmentType],
      CAST(NULL AS NVARCHAR(255)) AS [assetId],
      CAST(NULL AS NVARCHAR(1000)) AS [title],
      JSON_QUERY(N'{}') AS [evidence],
      CAST(NULL AS NVARCHAR(MAX)) AS [recommendedAction],
      CAST(NULL AS NVARCHAR(10)) AS [status],
      CAST(NULL AS NVARCHAR(40)) AS [timestamp],
      CAST(NULL AS NVARCHAR(40)) AS [closedTimestamp],
      CAST(NULL AS NVARCHAR(20)) AS [sourceKind]
    WHERE 1 = 0
    FOR JSON PATH;
    RETURN;
  END;

  SELECT
    CAST(NULL AS BIGINT) AS [snapshot_id],
    CAST(NULL AS NVARCHAR(255)) AS [finding_id],
    CAST(NULL AS INT) AS [spi_id],
    CAST(NULL AS INT) AS [raw_priority_rank],
    CAST(NULL AS NVARCHAR(30)) AS [raw_severity],
    CAST(NULL AS INT) AS [display_priority_rank],
    CAST(NULL AS NVARCHAR(30)) AS [display_severity],
    CAST(NULL AS NVARCHAR(20)) AS [compliance_status],
    CAST(NULL AS NVARCHAR(255)) AS [network_id],
    CAST(NULL AS NVARCHAR(255)) AS [system_id],
    CAST(NULL AS NVARCHAR(20)) AS [environment_type],
    CAST(NULL AS NVARCHAR(255)) AS [asset_id],
    CAST(NULL AS NVARCHAR(1000)) AS [title],
    CAST(NULL AS NVARCHAR(MAX)) AS [evidence],
    CAST(NULL AS NVARCHAR(MAX)) AS [recommended_action],
    CAST(NULL AS NVARCHAR(10)) AS [workflow_status],
    CAST(NULL AS DATETIMEOFFSET(7)) AS [observed_at],
    CAST(NULL AS DATETIMEOFFSET(7)) AS [closed_at],
    CAST(NULL AS NVARCHAR(20)) AS [source_kind]
  WHERE 1 = 0;
END;
GO

CREATE OR ALTER PROCEDURE [tsaat].[usp_get_finding_history_snapshot]
  @snapshot_id BIGINT,
  @status_key NVARCHAR(10),
  @history_start_date DATE,
  @history_end_date DATE,
  @emit_json BIT = 0
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Findings TABLE (
    [snapshot_id] BIGINT NULL,
    [finding_id] NVARCHAR(255) NOT NULL,
    [spi_id] INT NOT NULL,
    [raw_priority_rank] INT NOT NULL,
    [raw_severity] NVARCHAR(30) NOT NULL,
    [display_priority_rank] INT NOT NULL,
    [display_severity] NVARCHAR(30) NOT NULL,
    [compliance_status] NVARCHAR(20) NOT NULL,
    [network_id] NVARCHAR(255) NOT NULL,
    [system_id] NVARCHAR(255) NULL,
    [environment_type] NVARCHAR(20) NULL,
    [asset_id] NVARCHAR(255) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [evidence] NVARCHAR(MAX) NOT NULL,
    [recommended_action] NVARCHAR(MAX) NOT NULL,
    [workflow_status] NVARCHAR(10) NOT NULL,
    [observed_at] DATETIMEOFFSET(7) NOT NULL,
    [closed_at] DATETIMEOFFSET(7) NULL,
    [source_kind] NVARCHAR(20) NOT NULL
  );

  INSERT INTO @Findings
  EXEC [tsaat].[usp_get_effective_findings_snapshot] @snapshot_id = @snapshot_id, @as_of_date = NULL, @emit_json = 0;

  DECLARE @Dates TABLE ([date_key] DATE NOT NULL PRIMARY KEY);
  DECLARE @cursor DATE = @history_start_date;
  WHILE @cursor <= @history_end_date
  BEGIN
    INSERT INTO @Dates ([date_key]) VALUES (@cursor);
    SET @cursor = DATEADD(DAY, 1, @cursor);
  END;

  ;WITH opened AS (
    SELECT CONVERT(DATE, [observed_at]) AS [date_key], COUNT(*) AS [count_value]
    FROM @Findings
    WHERE CONVERT(DATE, [observed_at]) BETWEEN @history_start_date AND @history_end_date
    GROUP BY CONVERT(DATE, [observed_at])
  ),
  closed AS (
    SELECT CONVERT(DATE, [closed_at]) AS [date_key], COUNT(*) AS [count_value]
    FROM @Findings
    WHERE [closed_at] IS NOT NULL
      AND CONVERT(DATE, [closed_at]) BETWEEN @history_start_date AND @history_end_date
    GROUP BY CONVERT(DATE, [closed_at])
  ),
  balance AS (
    SELECT COUNT(*) AS [opening_balance]
    FROM @Findings
    WHERE (
      @status_key = N'open'
      AND CONVERT(DATE, [observed_at]) < @history_start_date
      AND ([closed_at] IS NULL OR CONVERT(DATE, [closed_at]) >= @history_start_date)
    )
    OR (
      @status_key = N'closed'
      AND [closed_at] IS NOT NULL
      AND CONVERT(DATE, [closed_at]) < @history_start_date
      AND CONVERT(DATE, [observed_at]) <= @history_start_date
    )
  ),
  series AS (
    SELECT
      d.[date_key],
      CASE
        WHEN @status_key = N'closed' THEN
          (SELECT [opening_balance] FROM balance)
          + SUM(COALESCE(c.[count_value], 0)) OVER (ORDER BY d.[date_key] ROWS UNBOUNDED PRECEDING)
        ELSE
          (SELECT [opening_balance] FROM balance)
          + SUM(COALESCE(o.[count_value], 0) - COALESCE(c.[count_value], 0)) OVER (ORDER BY d.[date_key] ROWS UNBOUNDED PRECEDING)
      END AS [finding_count]
    FROM @Dates AS d
    LEFT JOIN opened AS o ON o.[date_key] = d.[date_key]
    LEFT JOIN closed AS c ON c.[date_key] = d.[date_key]
  )
  SELECT
    CONVERT(NVARCHAR(10), [date_key], 23) AS [date],
    CASE WHEN [finding_count] < 0 THEN 0 ELSE [finding_count] END AS [openFindings]
  FROM series
  ORDER BY [date_key]
  FOR JSON PATH;
END;
GO

CREATE OR ALTER PROCEDURE [tsaat].[usp_get_finding_spi_history_snapshot]
  @snapshot_id BIGINT,
  @status_key NVARCHAR(10),
  @history_start_date DATE,
  @history_end_date DATE,
  @emit_json BIT = 0
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Findings TABLE (
    [snapshot_id] BIGINT NULL,
    [finding_id] NVARCHAR(255) NOT NULL,
    [spi_id] INT NOT NULL,
    [raw_priority_rank] INT NOT NULL,
    [raw_severity] NVARCHAR(30) NOT NULL,
    [display_priority_rank] INT NOT NULL,
    [display_severity] NVARCHAR(30) NOT NULL,
    [compliance_status] NVARCHAR(20) NOT NULL,
    [network_id] NVARCHAR(255) NOT NULL,
    [system_id] NVARCHAR(255) NULL,
    [environment_type] NVARCHAR(20) NULL,
    [asset_id] NVARCHAR(255) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [evidence] NVARCHAR(MAX) NOT NULL,
    [recommended_action] NVARCHAR(MAX) NOT NULL,
    [workflow_status] NVARCHAR(10) NOT NULL,
    [observed_at] DATETIMEOFFSET(7) NOT NULL,
    [closed_at] DATETIMEOFFSET(7) NULL,
    [source_kind] NVARCHAR(20) NOT NULL
  );

  INSERT INTO @Findings
  EXEC [tsaat].[usp_get_effective_findings_snapshot] @snapshot_id = @snapshot_id, @as_of_date = NULL, @emit_json = 0;

  DECLARE @Dates TABLE ([date_key] DATE NOT NULL PRIMARY KEY);
  DECLARE @cursor DATE = @history_start_date;
  WHILE @cursor <= @history_end_date
  BEGIN
    INSERT INTO @Dates ([date_key]) VALUES (@cursor);
    SET @cursor = DATEADD(DAY, 1, @cursor);
  END;

  ;WITH spi_dates AS (
    SELECT sd.[spi_id], d.[date_key]
    FROM [tsaat].[spi_definition] AS sd
    CROSS JOIN @Dates AS d
    WHERE sd.[enabled] = 1
  ),
  opened AS (
    SELECT [spi_id], CONVERT(DATE, [observed_at]) AS [date_key], COUNT(*) AS [count_value]
    FROM @Findings
    WHERE CONVERT(DATE, [observed_at]) BETWEEN @history_start_date AND @history_end_date
    GROUP BY [spi_id], CONVERT(DATE, [observed_at])
  ),
  closed AS (
    SELECT [spi_id], CONVERT(DATE, [closed_at]) AS [date_key], COUNT(*) AS [count_value]
    FROM @Findings
    WHERE [closed_at] IS NOT NULL
      AND CONVERT(DATE, [closed_at]) BETWEEN @history_start_date AND @history_end_date
    GROUP BY [spi_id], CONVERT(DATE, [closed_at])
  ),
  balances AS (
    SELECT
      sd.[spi_id],
      COUNT(f.[finding_id]) AS [opening_balance]
    FROM [tsaat].[spi_definition] AS sd
    LEFT JOIN @Findings AS f
      ON f.[spi_id] = sd.[spi_id]
      AND (
        (
          @status_key = N'open'
          AND CONVERT(DATE, f.[observed_at]) < @history_start_date
          AND (f.[closed_at] IS NULL OR CONVERT(DATE, f.[closed_at]) >= @history_start_date)
        )
        OR (
          @status_key = N'closed'
          AND f.[closed_at] IS NOT NULL
          AND CONVERT(DATE, f.[closed_at]) < @history_start_date
          AND CONVERT(DATE, f.[observed_at]) <= @history_start_date
        )
      )
    WHERE sd.[enabled] = 1
    GROUP BY sd.[spi_id]
  ),
  series AS (
    SELECT
      sd.[spi_id],
      sd.[date_key],
      CASE
        WHEN @status_key = N'closed' THEN
          b.[opening_balance]
          + SUM(COALESCE(c.[count_value], 0)) OVER (PARTITION BY sd.[spi_id] ORDER BY sd.[date_key] ROWS UNBOUNDED PRECEDING)
        ELSE
          b.[opening_balance]
          + SUM(COALESCE(o.[count_value], 0) - COALESCE(c.[count_value], 0)) OVER (PARTITION BY sd.[spi_id] ORDER BY sd.[date_key] ROWS UNBOUNDED PRECEDING)
      END AS [finding_count]
    FROM spi_dates AS sd
    INNER JOIN balances AS b ON b.[spi_id] = sd.[spi_id]
    LEFT JOIN opened AS o ON o.[spi_id] = sd.[spi_id] AND o.[date_key] = sd.[date_key]
    LEFT JOIN closed AS c ON c.[spi_id] = sd.[spi_id] AND c.[date_key] = sd.[date_key]
  )
  SELECT
    CONVERT(NVARCHAR(10), [date_key], 23) AS [date],
    [spi_id] AS [spiId],
    CASE WHEN [finding_count] < 0 THEN 0 ELSE [finding_count] END AS [openFindings]
  FROM series
  ORDER BY [date_key], [spi_id]
  FOR JSON PATH;
END;
GO
