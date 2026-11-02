# Generated database catalogue

Generated from the base schema and migration inventory. Do not edit by hand. This is source DDL, not an assertion about a deployed database. Read the migration README and database lifecycle before execution.

Base schema declares **65 tables**. [Schema source](../../Database%20Schema/database-schema.sql) · [Maintained ERD](../../Database%20Schema/ERD.md) · [Database lifecycle](../database.md).

## tsaat.reference_version_set

| Column | Source definition |
| --- | --- |
| version_set_id | BIGINT IDENTITY(1,1) NOT NULL |
| version_set_key | NVARCHAR(100) NOT NULL |
| version_set_name | NVARCHAR(255) NOT NULL |
| effective_date | DATE NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_reference_version_set_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_reference_version_set_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_reference_version_set_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_reference_version_set_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_reference_version_set] PRIMARY KEY CLUSTERED ([version_set_id]),
CONSTRAINT [UQ_reference_version_set_key] UNIQUE ([version_set_key])
```

## tsaat.dataset_snapshot

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT IDENTITY(1,1) NOT NULL |
| snapshot_date | DATE NOT NULL |
| generated_at | DATETIMEOFFSET(7) NOT NULL |
| source_label | NVARCHAR(100) NULL |
| reference_version_set_id | BIGINT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_dataset_snapshot_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_dataset_snapshot_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_dataset_snapshot_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_dataset_snapshot_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_dataset_snapshot] PRIMARY KEY CLUSTERED ([snapshot_id]),
CONSTRAINT [UQ_dataset_snapshot_snapshot_date] UNIQUE ([snapshot_date]),
CONSTRAINT [FK_dataset_snapshot_reference_version_set]
FOREIGN KEY ([reference_version_set_id]) REFERENCES [tsaat].[reference_version_set]([version_set_id])
```

## tsaat.finding_severity_definition

| Column | Source definition |
| --- | --- |
| severity_key | NVARCHAR(30) NOT NULL |
| label | NVARCHAR(80) NOT NULL |
| display_order | INT NOT NULL |
| selectable_in_settings | BIT NOT NULL CONSTRAINT [DF_finding_severity_definition_selectable] DEFAULT (1) |
| tone_key | NVARCHAR(40) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_finding_severity_definition] PRIMARY KEY CLUSTERED ([severity_key]),
CONSTRAINT [UQ_finding_severity_definition_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_finding_severity_definition_display_order] CHECK ([display_order] > 0),
CONSTRAINT [CK_finding_severity_definition_key] CHECK (LEN(LTRIM(RTRIM([severity_key]))) > 0)
```

## tsaat.finding_priority_definition

| Column | Source definition |
| --- | --- |
| priority_rank | INT NOT NULL |
| label | NVARCHAR(40) NOT NULL |
| display_order | INT NOT NULL |
| selectable_in_settings | BIT NOT NULL CONSTRAINT [DF_finding_priority_definition_selectable] DEFAULT (1) |
| description | NVARCHAR(1000) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_finding_priority_definition] PRIMARY KEY CLUSTERED ([priority_rank]),
CONSTRAINT [UQ_finding_priority_definition_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_finding_priority_definition_rank] CHECK ([priority_rank] > 0),
CONSTRAINT [CK_finding_priority_definition_display_order] CHECK ([display_order] > 0)
```

## tsaat.finding_source_policy

| Column | Source definition |
| --- | --- |
| policy_key | NVARCHAR(100) NOT NULL |
| display_order | INT NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| use_persisted_findings | BIT NOT NULL CONSTRAINT [DF_finding_source_policy_use_persisted] DEFAULT (1) |
| generate_when_empty | BIT NOT NULL CONSTRAINT [DF_finding_source_policy_generate_empty] DEFAULT (1) |
| enabled | BIT NOT NULL CONSTRAINT [DF_finding_source_policy_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_finding_source_policy] PRIMARY KEY CLUSTERED ([policy_key]),
CONSTRAINT [UQ_finding_source_policy_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_finding_source_policy_key] CHECK (LEN(LTRIM(RTRIM([policy_key]))) > 0),
CONSTRAINT [CK_finding_source_policy_display_order] CHECK ([display_order] > 0)
```

## tsaat.finding_generation_policy

| Column | Source definition |
| --- | --- |
| policy_key | NVARCHAR(100) NOT NULL |
| history_start_date | DATE NOT NULL |
| history_window_years | INT NOT NULL |
| baseline_backlog_count | INT NOT NULL |
| min_open_count | INT NOT NULL |
| max_open_count | INT NOT NULL |
| add_probability_percent | INT NOT NULL |
| add_rate_min_percent | INT NOT NULL |
| add_rate_max_percent | INT NOT NULL |
| close_rate_min_percent | INT NOT NULL |
| close_rate_max_percent | INT NOT NULL |
| close_backfill_min_count | INT NOT NULL |
| close_backfill_max_count | INT NOT NULL |
| timezone_offset_minutes | INT NOT NULL |
| baseline_backlog_count | >= 0 |
| add_probability_percent | BETWEEN 0 AND 100 |

Declared constraints:

```sql
CONSTRAINT [PK_finding_generation_policy] PRIMARY KEY CLUSTERED ([policy_key]),
CONSTRAINT [FK_finding_generation_policy_source]
FOREIGN KEY ([policy_key]) REFERENCES [tsaat].[finding_source_policy]([policy_key]),
CONSTRAINT [CK_finding_generation_policy_window] CHECK ([history_window_years] > 0),
CONSTRAINT [CK_finding_generation_policy_counts] CHECK (
CONSTRAINT [CK_finding_generation_policy_rates] CHECK (
```

## tsaat.finding_workflow_status_definition

| Column | Source definition |
| --- | --- |
| status_key | NVARCHAR(10) NOT NULL |
| label | NVARCHAR(80) NOT NULL |
| display_order | INT NOT NULL |
| tone_key | NVARCHAR(40) NOT NULL |
| terminal_status | BIT NOT NULL CONSTRAINT [DF_finding_workflow_status_terminal] DEFAULT (0) |

Declared constraints:

```sql
CONSTRAINT [PK_finding_workflow_status_definition] PRIMARY KEY CLUSTERED ([status_key]),
CONSTRAINT [UQ_finding_workflow_status_definition_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_finding_workflow_status_definition_key] CHECK ([status_key] IN (N'open', N'closed')),
CONSTRAINT [CK_finding_workflow_status_definition_display_order] CHECK ([display_order] > 0)
```

## tsaat.finding_bucket_definition

| Column | Source definition |
| --- | --- |
| bucket_key | NVARCHAR(100) NOT NULL |
| bucket_type | NVARCHAR(40) NOT NULL |
| label | NVARCHAR(100) NOT NULL |
| display_order | INT NOT NULL |
| tone_key | NVARCHAR(40) NOT NULL |
| condition_key | NVARCHAR(40) NOT NULL |
| severity_key | NVARCHAR(255) NULL |
| priority_min | INT NULL |
| priority_max | INT NULL |
| workflow_status | NVARCHAR(10) NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_finding_bucket_definition_enabled] DEFAULT (1) |
| description | NVARCHAR(1000) NOT NULL |

Declared constraints:

```sql
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
CONSTRAINT [CK_finding_bucket_definition_display_order] CHECK ([display_order] > 0)
```

## tsaat.finding_evidence_field_definition

| Column | Source definition |
| --- | --- |
| field_key | NVARCHAR(100) NOT NULL |
| display_order | INT NOT NULL |
| label | NVARCHAR(120) NOT NULL |
| purpose_key | NVARCHAR(100) NOT NULL |
| candidate_keys_json | NVARCHAR(MAX) NOT NULL CONSTRAINT [DF_finding_evidence_field_candidates] DEFAULT (N'[]') |
| fallback_value | NVARCHAR(255) NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_finding_evidence_field_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_finding_evidence_field_definition] PRIMARY KEY CLUSTERED ([field_key]),
CONSTRAINT [UQ_finding_evidence_field_definition_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_finding_evidence_field_definition_key] CHECK (LEN(LTRIM(RTRIM([field_key]))) > 0),
CONSTRAINT [CK_finding_evidence_field_definition_display_order] CHECK ([display_order] > 0),
CONSTRAINT [CK_finding_evidence_field_definition_candidates] CHECK (ISJSON([candidate_keys_json]) = 1)
```

## tsaat.finding_register_column_definition

| Column | Source definition |
| --- | --- |
| column_key | NVARCHAR(100) NOT NULL |
| label | NVARCHAR(120) NOT NULL |
| display_order | INT NOT NULL |
| value_key | NVARCHAR(100) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_finding_register_column_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_finding_register_column_definition] PRIMARY KEY CLUSTERED ([column_key]),
CONSTRAINT [UQ_finding_register_column_definition_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_finding_register_column_definition_key] CHECK (LEN(LTRIM(RTRIM([column_key]))) > 0),
CONSTRAINT [CK_finding_register_column_definition_display_order] CHECK ([display_order] > 0)
```

## tsaat.spi_rule_definition

| Column | Source definition |
| --- | --- |
| rule_key | NVARCHAR(100) NOT NULL |
| handler_key | NVARCHAR(100) NOT NULL |
| display_order | INT NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_spi_rule_definition_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_spi_rule_definition] PRIMARY KEY CLUSTERED ([rule_key]),
CONSTRAINT [UQ_spi_rule_definition_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_spi_rule_definition_key] CHECK (LEN(LTRIM(RTRIM([rule_key]))) > 0),
CONSTRAINT [CK_spi_rule_definition_handler] CHECK (LEN(LTRIM(RTRIM([handler_key]))) > 0),
CONSTRAINT [CK_spi_rule_definition_display_order] CHECK ([display_order] > 0)
```

## tsaat.spi_rule_parameter_definition

| Column | Source definition |
| --- | --- |
| rule_key | NVARCHAR(100) NOT NULL |
| parameter_key | NVARCHAR(100) NOT NULL |
| parameter_type | NVARCHAR(20) NOT NULL |
| required | BIT NOT NULL CONSTRAINT [DF_spi_rule_parameter_definition_required] DEFAULT (0) |
| default_value | NVARCHAR(4000) NULL |
| allowed_values_json | NVARCHAR(MAX) NULL |
| display_order | INT NOT NULL |
| description | NVARCHAR(1000) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_spi_rule_parameter_definition] PRIMARY KEY CLUSTERED ([rule_key], [parameter_key]),
CONSTRAINT [FK_spi_rule_parameter_definition_rule]
FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_rule_definition]([rule_key]),
CONSTRAINT [CK_spi_rule_parameter_definition_type]
CHECK ([parameter_type] IN (N'string', N'number', N'boolean')),
CONSTRAINT [CK_spi_rule_parameter_definition_key] CHECK (LEN(LTRIM(RTRIM([parameter_key]))) > 0),
CONSTRAINT [CK_spi_rule_parameter_definition_display_order] CHECK ([display_order] > 0),
CONSTRAINT [CK_spi_rule_parameter_definition_allowed_json]
CHECK ([allowed_values_json] IS NULL OR ISJSON([allowed_values_json]) = 1)
```

## tsaat.spi_rule_outcome_template

| Column | Source definition |
| --- | --- |
| rule_key | NVARCHAR(100) NOT NULL |
| outcome_key | NVARCHAR(100) NOT NULL |
| compliance_status | NVARCHAR(20) NOT NULL |
| reason_template | NVARCHAR(MAX) NOT NULL |
| evidence_template | NVARCHAR(MAX) NULL |

Declared constraints:

```sql
CONSTRAINT [PK_spi_rule_outcome_template] PRIMARY KEY CLUSTERED ([rule_key], [outcome_key], [compliance_status]),
CONSTRAINT [FK_spi_rule_outcome_template_rule]
FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_rule_definition]([rule_key]),
CONSTRAINT [CK_spi_rule_outcome_template_status]
CHECK ([compliance_status] IN (N'Compliant', N'Non-compliant', N'Unknown')),
CONSTRAINT [CK_spi_rule_outcome_template_key] CHECK (LEN(LTRIM(RTRIM([outcome_key]))) > 0)
```

## tsaat.spi_report_detail_definition

| Column | Source definition |
| --- | --- |
| report_detail_key | NVARCHAR(100) NOT NULL |
| handler_key | NVARCHAR(100) NOT NULL |
| display_order | INT NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_spi_report_detail_definition_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_spi_report_detail_definition] PRIMARY KEY CLUSTERED ([report_detail_key]),
CONSTRAINT [UQ_spi_report_detail_definition_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_spi_report_detail_definition_key] CHECK (LEN(LTRIM(RTRIM([report_detail_key]))) > 0),
CONSTRAINT [CK_spi_report_detail_definition_handler] CHECK (LEN(LTRIM(RTRIM([handler_key]))) > 0),
CONSTRAINT [CK_spi_report_detail_definition_display_order] CHECK ([display_order] > 0)
```

## tsaat.spi_calculation_source

| Column | Source definition |
| --- | --- |
| source_key | NVARCHAR(100) NOT NULL |
| source_object_name | NVARCHAR(255) NOT NULL |
| display_order | INT NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_spi_calculation_source_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_spi_calculation_source] PRIMARY KEY CLUSTERED ([source_key]),
CONSTRAINT [UQ_spi_calculation_source_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_spi_calculation_source_key] CHECK (LEN(LTRIM(RTRIM([source_key]))) > 0),
CONSTRAINT [CK_spi_calculation_source_object]
CHECK ([source_object_name] IN (N'[tsaat].[vw_spi_asset_evaluation_context]')),
CONSTRAINT [CK_spi_calculation_source_display_order] CHECK ([display_order] > 0)
```

## tsaat.spi_calculation_definition

| Column | Source definition |
| --- | --- |
| rule_key | NVARCHAR(100) NOT NULL |
| source_key | NVARCHAR(100) NOT NULL |
| display_order | INT NOT NULL |
| status_expression_sql | NVARCHAR(MAX) NOT NULL |
| outcome_expression_sql | NVARCHAR(MAX) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_spi_calculation_definition_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_spi_calculation_definition] PRIMARY KEY CLUSTERED ([rule_key]),
CONSTRAINT [UQ_spi_calculation_definition_display_order] UNIQUE ([display_order]),
CONSTRAINT [FK_spi_calculation_definition_rule]
FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_rule_definition]([rule_key]),
CONSTRAINT [FK_spi_calculation_definition_source]
FOREIGN KEY ([source_key]) REFERENCES [tsaat].[spi_calculation_source]([source_key]),
CONSTRAINT [CK_spi_calculation_definition_display_order] CHECK ([display_order] > 0),
CONSTRAINT [CK_spi_calculation_definition_status_sql] CHECK (
CONSTRAINT [CK_spi_calculation_definition_outcome_sql] CHECK (
```

## tsaat.spi_calculation_evidence_expression

| Column | Source definition |
| --- | --- |
| rule_key | NVARCHAR(100) NOT NULL |
| evidence_key | NVARCHAR(100) NOT NULL |
| display_order | INT NOT NULL |
| value_type | NVARCHAR(20) NOT NULL |
| value_expression_sql | NVARCHAR(MAX) NOT NULL |
| omit_when_null | BIT NOT NULL CONSTRAINT [DF_spi_calculation_evidence_expression_omit] DEFAULT (0) |

Declared constraints:

```sql
CONSTRAINT [PK_spi_calculation_evidence_expression] PRIMARY KEY CLUSTERED ([rule_key], [evidence_key]),
CONSTRAINT [FK_spi_calculation_evidence_expression_definition]
FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_calculation_definition]([rule_key]),
CONSTRAINT [CK_spi_calculation_evidence_expression_key]
CHECK (LEN(LTRIM(RTRIM([evidence_key]))) > 0 AND [evidence_key] NOT LIKE N'%[^A-Za-z0-9_]%' COLLATE Latin1_General_BIN2),
CONSTRAINT [CK_spi_calculation_evidence_expression_display_order] CHECK ([display_order] > 0),
CONSTRAINT [CK_spi_calculation_evidence_expression_type] CHECK ([value_type] IN (N'string', N'number', N'boolean')),
CONSTRAINT [CK_spi_calculation_evidence_expression_sql] CHECK (
```

## tsaat.spi_definition

| Column | Source definition |
| --- | --- |
| spi_id | INT NOT NULL |
| display_order | INT NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| success_measure | NVARCHAR(1000) NOT NULL |
| priority_order | INT NOT NULL |
| default_severity | NVARCHAR(30) NOT NULL |
| recommended_action | NVARCHAR(MAX) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_spi_definition_enabled] DEFAULT (1) |
| rule_key | NVARCHAR(100) NOT NULL |
| report_available | BIT NOT NULL CONSTRAINT [DF_spi_definition_report_available] DEFAULT (1) |
| trend_report_available | BIT NOT NULL CONSTRAINT [DF_spi_definition_trend_report_available] DEFAULT (1) |
| report_detail_key | NVARCHAR(100) NOT NULL CONSTRAINT [DF_spi_definition_report_detail_key] DEFAULT (N'standard-asset-annex') |

Declared constraints:

```sql
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
```

## tsaat.spi_feature_binding

| Column | Source definition |
| --- | --- |
| feature_key | NVARCHAR(100) NOT NULL |
| spi_id | INT NOT NULL |
| display_order | INT NOT NULL |
| compliance_status | NVARCHAR(20) NULL |
| outcome_key | NVARCHAR(100) NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_spi_feature_binding_enabled] DEFAULT (1) |
| description | NVARCHAR(1000) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_spi_feature_binding] PRIMARY KEY CLUSTERED ([feature_key], [spi_id], [display_order]),
CONSTRAINT [FK_spi_feature_binding_spi]
FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
CONSTRAINT [CK_spi_feature_binding_key] CHECK (LEN(LTRIM(RTRIM([feature_key]))) > 0),
CONSTRAINT [CK_spi_feature_binding_display_order] CHECK ([display_order] > 0),
CONSTRAINT [CK_spi_feature_binding_status]
CHECK ([compliance_status] IS NULL OR [compliance_status] IN (N'Compliant', N'Non-compliant', N'Unknown'))
```

## tsaat.spi_finding_classification_rule

| Column | Source definition |
| --- | --- |
| classification_rule_id | NVARCHAR(100) NOT NULL |
| display_order | INT NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_spi_finding_classification_rule_enabled] DEFAULT (1) |
| spi_id | INT NULL |
| compliance_status | NVARCHAR(20) NULL |
| condition_key | NVARCHAR(60) NOT NULL |
| severity_key | NVARCHAR(30) NULL |
| priority_rank | INT NULL |
| description | NVARCHAR(1000) NOT NULL |

Declared constraints:

```sql
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
CONSTRAINT [CK_spi_finding_classification_rule_key] CHECK (LEN(LTRIM(RTRIM([classification_rule_id]))) > 0)
```

## tsaat.spi_applicable_asset_type

| Column | Source definition |
| --- | --- |
| spi_id | INT NOT NULL |
| asset_type | NVARCHAR(20) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_spi_applicable_asset_type] PRIMARY KEY CLUSTERED ([spi_id], [asset_type]),
CONSTRAINT [FK_spi_applicable_asset_type_spi]
FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
CONSTRAINT [CK_spi_applicable_asset_type_asset_type]
CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other', N'ip-node'))
```

## tsaat.spi_rule_parameter

| Column | Source definition |
| --- | --- |
| spi_id | INT NOT NULL |
| parameter_key | NVARCHAR(100) NOT NULL |
| parameter_type | NVARCHAR(20) NOT NULL |
| parameter_value | NVARCHAR(4000) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_spi_rule_parameter] PRIMARY KEY CLUSTERED ([spi_id], [parameter_key]),
CONSTRAINT [FK_spi_rule_parameter_spi]
FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
CONSTRAINT [CK_spi_rule_parameter_type]
CHECK ([parameter_type] IN (N'string', N'number', N'boolean')),
CONSTRAINT [CK_spi_rule_parameter_key]
CHECK (LEN(LTRIM(RTRIM([parameter_key]))) > 0)
```

## tsaat.spi_tasking_team

| Column | Source definition |
| --- | --- |
| spi_id | INT NOT NULL |
| display_order | INT NOT NULL |
| team | NVARCHAR(255) NOT NULL |
| support_queue | NVARCHAR(100) NOT NULL |
| contact_email | NVARCHAR(255) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_spi_tasking_team] PRIMARY KEY CLUSTERED ([spi_id], [display_order]),
CONSTRAINT [FK_spi_tasking_team_spi]
FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
CONSTRAINT [CK_spi_tasking_team_display_order] CHECK ([display_order] > 0)
```

## tsaat.spi_tasking_action_template

| Column | Source definition |
| --- | --- |
| spi_id | INT NOT NULL |
| display_order | INT NOT NULL |
| condition_key | NVARCHAR(40) NOT NULL |
| action_text | NVARCHAR(MAX) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_spi_tasking_action_template] PRIMARY KEY CLUSTERED ([spi_id], [display_order]),
CONSTRAINT [FK_spi_tasking_action_template_spi]
FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
CONSTRAINT [CK_spi_tasking_action_template_display_order] CHECK ([display_order] > 0),
CONSTRAINT [CK_spi_tasking_action_template_condition]
CHECK ([condition_key] IN (N'always', N'when_unknown', N'when_fully_compliant'))
```

## tsaat.spi_tasking_condition_template

| Column | Source definition |
| --- | --- |
| spi_id | INT NOT NULL |
| condition_key | NVARCHAR(40) NOT NULL |
| template_text | NVARCHAR(MAX) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_spi_tasking_condition_template] PRIMARY KEY CLUSTERED ([spi_id], [condition_key]),
CONSTRAINT [FK_spi_tasking_condition_template_spi]
FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
CONSTRAINT [CK_spi_tasking_condition_template_condition]
CHECK ([condition_key] IN (N'non_compliant', N'unknown', N'compliant'))
```

## tsaat.kpi_definition

| Column | Source definition |
| --- | --- |
| kpi_id | NVARCHAR(40) NOT NULL |
| display_order | INT NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| success_measure | NVARCHAR(1000) NOT NULL |
| calculation_key | NVARCHAR(100) NOT NULL |
| report_available | BIT NOT NULL CONSTRAINT [DF_kpi_definition_report_available] DEFAULT (0) |
| enabled | BIT NOT NULL CONSTRAINT [DF_kpi_definition_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_kpi_definition] PRIMARY KEY CLUSTERED ([kpi_id]),
CONSTRAINT [UQ_kpi_definition_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_kpi_definition_kpi_id] CHECK (LEN(LTRIM(RTRIM([kpi_id]))) > 0),
CONSTRAINT [CK_kpi_definition_display_order] CHECK ([display_order] > 0)
```

## tsaat.kpi_calculation_source

| Column | Source definition |
| --- | --- |
| source_key | NVARCHAR(100) NOT NULL |
| source_object_name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_kpi_calculation_source_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_kpi_calculation_source] PRIMARY KEY CLUSTERED ([source_key]),
CONSTRAINT [CK_kpi_calculation_source_key] CHECK (LEN(LTRIM(RTRIM([source_key]))) > 0)
```

## tsaat.kpi_calculation_definition

| Column | Source definition |
| --- | --- |
| calculation_key | NVARCHAR(100) NOT NULL |
| source_key | NVARCHAR(100) NOT NULL |
| display_order | INT NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_kpi_calculation_definition_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_kpi_calculation_definition] PRIMARY KEY CLUSTERED ([calculation_key]),
CONSTRAINT [FK_kpi_calculation_definition_source]
FOREIGN KEY ([source_key]) REFERENCES [tsaat].[kpi_calculation_source]([source_key]),
CONSTRAINT [UQ_kpi_calculation_definition_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_kpi_calculation_definition_display_order] CHECK ([display_order] > 0)
```

## tsaat.kpi_calculation_parameter

| Column | Source definition |
| --- | --- |
| calculation_key | NVARCHAR(100) NOT NULL |
| parameter_key | NVARCHAR(100) NOT NULL |
| parameter_type | NVARCHAR(20) NOT NULL |
| parameter_value | NVARCHAR(4000) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_kpi_calculation_parameter] PRIMARY KEY CLUSTERED ([calculation_key], [parameter_key]),
CONSTRAINT [FK_kpi_calculation_parameter_definition]
FOREIGN KEY ([calculation_key]) REFERENCES [tsaat].[kpi_calculation_definition]([calculation_key]),
CONSTRAINT [CK_kpi_calculation_parameter_type] CHECK ([parameter_type] IN (N'string', N'number', N'boolean'))
```

## tsaat.kpi_report_detail_definition

| Column | Source definition |
| --- | --- |
| report_detail_key | NVARCHAR(100) NOT NULL |
| handler_key | NVARCHAR(100) NOT NULL |
| display_order | INT NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_kpi_report_detail_definition_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_kpi_report_detail_definition] PRIMARY KEY CLUSTERED ([report_detail_key]),
CONSTRAINT [UQ_kpi_report_detail_definition_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_kpi_report_detail_definition_display_order] CHECK ([display_order] > 0)
```

## tsaat.kpi_report_detail_binding

| Column | Source definition |
| --- | --- |
| kpi_id | NVARCHAR(40) NOT NULL |
| report_detail_key | NVARCHAR(100) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_kpi_report_detail_binding] PRIMARY KEY CLUSTERED ([kpi_id]),
CONSTRAINT [FK_kpi_report_detail_binding_kpi]
FOREIGN KEY ([kpi_id]) REFERENCES [tsaat].[kpi_definition]([kpi_id]),
CONSTRAINT [FK_kpi_report_detail_binding_detail]
FOREIGN KEY ([report_detail_key]) REFERENCES [tsaat].[kpi_report_detail_definition]([report_detail_key])
```

## tsaat.kpi_tasking_team

| Column | Source definition |
| --- | --- |
| kpi_id | NVARCHAR(40) NOT NULL |
| display_order | INT NOT NULL |
| team | NVARCHAR(255) NOT NULL |
| support_queue | NVARCHAR(100) NOT NULL |
| contact_email | NVARCHAR(255) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_kpi_tasking_team] PRIMARY KEY CLUSTERED ([kpi_id], [display_order]),
CONSTRAINT [FK_kpi_tasking_team_kpi]
FOREIGN KEY ([kpi_id]) REFERENCES [tsaat].[kpi_definition]([kpi_id]),
CONSTRAINT [CK_kpi_tasking_team_display_order] CHECK ([display_order] > 0)
```

## tsaat.kpi_tasking_action_template

| Column | Source definition |
| --- | --- |
| kpi_id | NVARCHAR(40) NOT NULL |
| display_order | INT NOT NULL |
| condition_key | NVARCHAR(40) NOT NULL |
| action_text | NVARCHAR(MAX) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_kpi_tasking_action_template] PRIMARY KEY CLUSTERED ([kpi_id], [display_order]),
CONSTRAINT [FK_kpi_tasking_action_template_kpi]
FOREIGN KEY ([kpi_id]) REFERENCES [tsaat].[kpi_definition]([kpi_id]),
CONSTRAINT [CK_kpi_tasking_action_template_display_order] CHECK ([display_order] > 0),
CONSTRAINT [CK_kpi_tasking_action_template_condition]
CHECK ([condition_key] IN (N'always', N'when_unknown', N'when_fully_compliant'))
```

## tsaat.kpi_tasking_condition_template

| Column | Source definition |
| --- | --- |
| kpi_id | NVARCHAR(40) NOT NULL |
| condition_key | NVARCHAR(40) NOT NULL |
| template_text | NVARCHAR(MAX) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_kpi_tasking_condition_template] PRIMARY KEY CLUSTERED ([kpi_id], [condition_key]),
CONSTRAINT [FK_kpi_tasking_condition_template_kpi]
FOREIGN KEY ([kpi_id]) REFERENCES [tsaat].[kpi_definition]([kpi_id]),
CONSTRAINT [CK_kpi_tasking_condition_template_condition]
CHECK ([condition_key] IN (N'non_compliant', N'unknown', N'compliant'))
```

## tsaat.managed_network

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| network_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| criticality | NVARCHAR(20) NOT NULL |
| adf_platform | BIT NOT NULL |
| enterprise_platform | BIT NOT NULL |
| modelling_status | BIT NOT NULL |
| classification | NVARCHAR(255) NULL |
| description | NVARCHAR(2000) NULL |
| owner | NVARCHAR(255) NULL |
| support_email | NVARCHAR(320) NULL |
| service_catalogue_url | NVARCHAR(1024) NULL |
| diis_id | NVARCHAR(100) NULL |
| ato_number | NVARCHAR(100) NULL |
| apm_number | NVARCHAR(100) NULL |
| diis_url | NVARCHAR(1024) NULL |
| grc_url | NVARCHAR(1024) NULL |
| discovery_status | NVARCHAR(40) NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_managed_network_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_managed_network_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_managed_network_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_managed_network_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_managed_network] PRIMARY KEY CLUSTERED ([snapshot_id], [network_id]),
CONSTRAINT [FK_managed_network_snapshot]
FOREIGN KEY ([snapshot_id]) REFERENCES [tsaat].[dataset_snapshot]([snapshot_id]),
CONSTRAINT [CK_managed_network_criticality]
CHECK ([criticality] IN (N'Critical', N'Non-Critical')),
CONSTRAINT [CK_managed_network_discovery_status]
CHECK ([discovery_status] IN (N'Discovery Enabled', N'Discovery Non Enabled'))
```

## tsaat.managed_network_hierarchy

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| parent_network_id | NVARCHAR(255) NOT NULL |
| child_network_id | NVARCHAR(255) NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_managed_network_hierarchy_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_managed_network_hierarchy_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_managed_network_hierarchy_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_managed_network_hierarchy_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_managed_network_hierarchy] PRIMARY KEY CLUSTERED ([snapshot_id], [parent_network_id], [child_network_id]),
CONSTRAINT [FK_managed_network_hierarchy_parent]
FOREIGN KEY ([snapshot_id], [parent_network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
CONSTRAINT [FK_managed_network_hierarchy_child]
FOREIGN KEY ([snapshot_id], [child_network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
CONSTRAINT [CK_managed_network_hierarchy_not_self] CHECK ([parent_network_id] <> [child_network_id])
```

## tsaat.ict_system

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| system_id | NVARCHAR(255) NOT NULL |
| network_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| adf_platform | BIT NOT NULL |
| enterprise_platform | BIT NOT NULL |
| description | NVARCHAR(2000) NULL |
| diis_id | NVARCHAR(100) NULL |
| owner | NVARCHAR(255) NULL |
| support_email | NVARCHAR(320) NULL |
| service_catalogue_url | NVARCHAR(1024) NULL |
| ato_number | NVARCHAR(100) NULL |
| apm_number | NVARCHAR(100) NULL |
| diis_url | NVARCHAR(1024) NULL |
| grc_url | NVARCHAR(1024) NULL |
| modelling_status | BIT NOT NULL |
| diis_defined | BIT NOT NULL |
| criticality | NVARCHAR(20) NOT NULL |
| security_domain | NVARCHAR(20) NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_ict_system_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_ict_system_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_ict_system_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_ict_system_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
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
```

## tsaat.ict_system_hierarchy

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| parent_system_id | NVARCHAR(255) NOT NULL |
| child_system_id | NVARCHAR(255) NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_ict_system_hierarchy_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_ict_system_hierarchy_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_ict_system_hierarchy_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_ict_system_hierarchy_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_ict_system_hierarchy] PRIMARY KEY CLUSTERED ([snapshot_id], [parent_system_id], [child_system_id]),
CONSTRAINT [FK_ict_system_hierarchy_parent]
FOREIGN KEY ([snapshot_id], [parent_system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
CONSTRAINT [FK_ict_system_hierarchy_child]
FOREIGN KEY ([snapshot_id], [child_system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
CONSTRAINT [CK_ict_system_hierarchy_not_self] CHECK ([parent_system_id] <> [child_system_id])
```

## tsaat.network_declared_system

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| network_id | NVARCHAR(255) NOT NULL |
| system_id | NVARCHAR(255) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_network_declared_system] PRIMARY KEY CLUSTERED ([snapshot_id], [network_id], [system_id]),
CONSTRAINT [FK_network_declared_system_network]
FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
CONSTRAINT [FK_network_declared_system_system]
FOREIGN KEY ([snapshot_id], [system_id], [network_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id], [network_id])
```

## tsaat.system_mission_capability

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| system_id | NVARCHAR(255) NOT NULL |
| mission_capability_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| criticality | NVARCHAR(20) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_system_mission_capability] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id], [mission_capability_id]),
CONSTRAINT [FK_system_mission_capability_system]
FOREIGN KEY ([snapshot_id], [system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
CONSTRAINT [CK_system_mission_capability_criticality]
CHECK ([criticality] IN (N'Critical', N'Non-Critical'))
```

## tsaat.system_business_service

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| system_id | NVARCHAR(255) NOT NULL |
| business_service_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| criticality | NVARCHAR(20) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_system_business_service] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id], [business_service_id]),
CONSTRAINT [FK_system_business_service_system]
FOREIGN KEY ([snapshot_id], [system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
CONSTRAINT [CK_system_business_service_criticality]
CHECK ([criticality] IN (N'Critical', N'Non-Critical'))
```

## tsaat.system_environment

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| system_id | NVARCHAR(255) NOT NULL |
| environment_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| environment_type | NVARCHAR(20) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_system_environment] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id], [environment_id]),
CONSTRAINT [UQ_system_environment_type] UNIQUE ([snapshot_id], [system_id], [environment_type]),
CONSTRAINT [UQ_system_environment_full] UNIQUE ([snapshot_id], [system_id], [environment_id], [environment_type]),
CONSTRAINT [FK_system_environment_system]
FOREIGN KEY ([snapshot_id], [system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
CONSTRAINT [CK_system_environment_type]
CHECK ([environment_type] IN (N'Production', N'Development', N'UAT', N'Test'))
```

## tsaat.cmdb_attribute_definition

| Column | Source definition |
| --- | --- |
| attribute_key | NVARCHAR(64) NOT NULL |
| label | NVARCHAR(100) NOT NULL |
| asset_type | NVARCHAR(20) NOT NULL |
| attribute_key | NVARCHAR(64) NOT NULL |
| display_order | INT NOT NULL |
| is_enabled | BIT NOT NULL CONSTRAINT [DF_cmdb_asset_type_attribute_enabled] DEFAULT (1) |
| snapshot_id | BIGINT NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| hostname | NVARCHAR(255) NOT NULL |
| ip_address | NVARCHAR(64) NULL |
| mac_address | NVARCHAR(64) NULL |
| device_model | NVARCHAR(255) NULL |
| last_discovered_date | DATETIME2(3) NULL |
| discovered_by | NVARCHAR(255) NULL |
| discovery_approach | NVARCHAR(20) NULL |
| arp_owner_asset_id | NVARCHAR(255) NULL |
| cmdb_record_url | NVARCHAR(1024) NULL |
| asset_type | NVARCHAR(20) NOT NULL |
| network_id | NVARCHAR(255) NOT NULL |
| security_domain | NVARCHAR(20) NOT NULL |
| system_id | NVARCHAR(255) NULL |
| environment_type | NVARCHAR(20) NULL |
| lifecycle_eol_status | NVARCHAR(20) NOT NULL |
| lifecycle_warranty_status | NVARCHAR(20) NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_asset_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_asset_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_asset_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_asset_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_cmdb_attribute_definition] PRIMARY KEY ([attribute_key]),
CONSTRAINT [CK_cmdb_attribute_definition_key] CHECK ([attribute_key] IN (
CONSTRAINT [CK_cmdb_attribute_definition_label] CHECK (LEN(LTRIM(RTRIM([label]))) > 0)
CONSTRAINT [PK_cmdb_asset_type_attribute] PRIMARY KEY ([asset_type], [attribute_key]),
CONSTRAINT [FK_cmdb_asset_type_attribute_definition] FOREIGN KEY ([attribute_key])
REFERENCES [tsaat].[cmdb_attribute_definition] ([attribute_key]),
CONSTRAINT [CK_cmdb_asset_type_attribute_type] CHECK ([asset_type] IN (
CONSTRAINT [CK_cmdb_asset_type_attribute_order] CHECK ([display_order] >= 0)
CONSTRAINT [PK_asset] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id]),
CONSTRAINT [UQ_asset_snapshot_network_asset] UNIQUE ([snapshot_id], [network_id], [asset_id]),
CONSTRAINT [UQ_asset_snapshot_system_asset] UNIQUE ([snapshot_id], [system_id], [asset_id]),
CONSTRAINT [UQ_asset_snapshot_system_env_asset] UNIQUE ([snapshot_id], [system_id], [environment_type], [asset_id]),
CONSTRAINT [FK_asset_arp_owner] FOREIGN KEY ([snapshot_id], [network_id], [arp_owner_asset_id])
REFERENCES [tsaat].[asset]([snapshot_id], [network_id], [asset_id]),
CONSTRAINT [CK_asset_ip_node_discovery] CHECK (
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
CHECK ([security_domain] IN (N'Secret', N'Protected', N'Unclassified')),
CONSTRAINT [CK_asset_environment_type]
CHECK ([environment_type] IS NULL OR [environment_type] IN (N'Production', N'Development', N'UAT', N'Test')),
CONSTRAINT [CK_asset_lifecycle_eol_status]
CHECK ([lifecycle_eol_status] IN (N'Supported', N'EOL', N'Unknown')),
CONSTRAINT [CK_asset_lifecycle_warranty_status]
CHECK ([lifecycle_warranty_status] IN (N'InWarranty', N'OutOfWarranty', N'Unknown')),
CONSTRAINT [CK_asset_system_environment_pair]
CHECK (
```

## tsaat.network_declared_asset

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| network_id | NVARCHAR(255) NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_network_declared_asset] PRIMARY KEY CLUSTERED ([snapshot_id], [network_id], [asset_id]),
CONSTRAINT [FK_network_declared_asset_network]
FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
CONSTRAINT [FK_network_declared_asset_asset]
FOREIGN KEY ([snapshot_id], [network_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [network_id], [asset_id])
```

## tsaat.network_target_state_asset

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| network_id | NVARCHAR(255) NOT NULL |
| asset_type | NVARCHAR(20) NOT NULL |
| asset_name | NVARCHAR(255) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_network_target_state_asset] PRIMARY KEY CLUSTERED ([snapshot_id], [network_id], [asset_type], [asset_name]),
CONSTRAINT [FK_network_target_state_asset_network]
FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
CONSTRAINT [CK_network_target_state_asset_asset_type]
CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other', N'ip-node'))
```

## tsaat.system_environment_asset

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| system_id | NVARCHAR(255) NOT NULL |
| environment_id | NVARCHAR(255) NOT NULL |
| environment_type | NVARCHAR(20) NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_system_environment_asset] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id], [environment_id], [asset_id]),
CONSTRAINT [FK_system_environment_asset_environment]
FOREIGN KEY ([snapshot_id], [system_id], [environment_id], [environment_type])
REFERENCES [tsaat].[system_environment]([snapshot_id], [system_id], [environment_id], [environment_type]),
CONSTRAINT [FK_system_environment_asset_asset]
FOREIGN KEY ([snapshot_id], [system_id], [environment_type], [asset_id])
REFERENCES [tsaat].[asset]([snapshot_id], [system_id], [environment_type], [asset_id]),
CONSTRAINT [CK_system_environment_asset_environment_type]
CHECK ([environment_type] IN (N'Production', N'Development', N'UAT', N'Test'))
```

## tsaat.ci_dependency

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| dependency_id | NVARCHAR(255) NOT NULL |
| source_asset_id | NVARCHAR(255) NOT NULL |
| target_asset_id | NVARCHAR(255) NOT NULL |
| dependency_type | NVARCHAR(30) NOT NULL |
| flow_protocol | NVARCHAR(20) NULL |
| source_port | INT NULL |
| target_port | INT NULL |
| observation_method | NVARCHAR(255) NULL |
| observed_at | DATETIMEOFFSET(7) NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_ci_dependency_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_ci_dependency_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_ci_dependency_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_ci_dependency_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
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
```

## tsaat.asset_operating_system

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |
| family | NVARCHAR(255) NOT NULL |
| vendor | NVARCHAR(255) NOT NULL |
| major_version | INT NULL |
| version | NVARCHAR(255) NOT NULL |
| patch_level | NVARCHAR(255) NULL |
| support_status | NVARCHAR(20) NOT NULL |
| current_supported_major | INT NULL |
| n_minus | INT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_asset_operating_system] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id]),
CONSTRAINT [FK_asset_operating_system_asset]
FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
CONSTRAINT [CK_asset_operating_system_support_status]
CHECK ([support_status] IN (N'Supported', N'OutOfSupport', N'Unknown'))
```

## tsaat.asset_network_os

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |
| family | NVARCHAR(255) NOT NULL |
| vendor | NVARCHAR(255) NOT NULL |
| major_version | INT NULL |
| version | NVARCHAR(255) NOT NULL |
| patch_level | NVARCHAR(255) NULL |
| support_status | NVARCHAR(20) NOT NULL |
| current_supported_major | INT NULL |
| n_minus | INT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_asset_network_os] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id]),
CONSTRAINT [FK_asset_network_os_asset]
FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
CONSTRAINT [CK_asset_network_os_support_status]
CHECK ([support_status] IN (N'Supported', N'OutOfSupport', N'Unknown'))
```

## tsaat.asset_patch_state

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |
| is_latest | BIT NULL |
| last_patched_date | DATE NULL |

Declared constraints:

```sql
CONSTRAINT [PK_asset_patch_state] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id]),
CONSTRAINT [FK_asset_patch_state_asset]
FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id])
```

## tsaat.asset_installed_software

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |
| software_ordinal | INT NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| version | NVARCHAR(255) NOT NULL |
| file_path | NVARCHAR(2048) NULL |
| last_discovered_date | DATETIME2(3) NULL |
| discovered_by | NVARCHAR(255) NULL |
| support_status | NVARCHAR(20) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_asset_installed_software] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id], [software_ordinal]),
CONSTRAINT [FK_asset_installed_software_asset]
FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
CONSTRAINT [CK_asset_installed_software_ordinal] CHECK ([software_ordinal] > 0),
CONSTRAINT [CK_asset_installed_software_support_status]
CHECK ([support_status] IN (N'Supported', N'OutOfSupport', N'Unknown'))
```

## tsaat.asset_vulnerability

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |
| vulnerability_id | NVARCHAR(255) NOT NULL |
| cve | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(MAX) NOT NULL |
| remediation_guidance | NVARCHAR(MAX) NOT NULL |
| criticality | NVARCHAR(20) NOT NULL |
| severity | NVARCHAR(20) NOT NULL |
| exploitability | NVARCHAR(30) NOT NULL |
| detected_date | DATE NOT NULL |
| captured_at | DATETIMEOFFSET(7) NOT NULL |
| source | NVARCHAR(255) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_asset_vulnerability] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id], [vulnerability_id]),
CONSTRAINT [FK_asset_vulnerability_asset]
FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
CONSTRAINT [CK_asset_vulnerability_criticality]
CHECK ([criticality] IN (N'Low', N'Medium', N'High', N'Critical')),
CONSTRAINT [CK_asset_vulnerability_severity]
CHECK ([severity] IN (N'Low', N'Medium', N'High', N'Critical')),
CONSTRAINT [CK_asset_vulnerability_exploitability]
CHECK ([exploitability] IN (N'No Known Exploit', N'Proof of Concept', N'Exploitable', N'Known Exploited'))
```

## tsaat.finding

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| finding_id | NVARCHAR(255) NOT NULL |
| spi_id | INT NOT NULL |
| priority_rank | INT NOT NULL |
| severity | NVARCHAR(30) NOT NULL |
| compliance_status | NVARCHAR(20) NOT NULL |
| network_id | NVARCHAR(255) NOT NULL |
| system_id | NVARCHAR(255) NULL |
| environment_type | NVARCHAR(20) NULL |
| asset_id | NVARCHAR(255) NOT NULL |
| title | NVARCHAR(1000) NOT NULL |
| evidence | NVARCHAR(MAX) NOT NULL CONSTRAINT [DF_finding_evidence] DEFAULT (N'{}') |
| recommended_action | NVARCHAR(MAX) NOT NULL |
| workflow_status | NVARCHAR(10) NOT NULL |
| observed_at | DATETIMEOFFSET(7) NOT NULL |
| closed_at | DATETIMEOFFSET(7) NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_finding_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_finding_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_finding_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_finding_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
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
CONSTRAINT [CK_finding_closed_status_consistency]
CHECK (
CONSTRAINT [CK_finding_evidence_json]
CHECK (ISJSON([evidence]) = 1)
```

## tsaat.reference_os_current_major

| Column | Source definition |
| --- | --- |
| version_set_id | BIGINT NOT NULL |
| os_key | NVARCHAR(100) NOT NULL |
| current_supported_major | INT NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_reference_os_current_major_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_reference_os_current_major_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_reference_os_current_major_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_reference_os_current_major_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_reference_os_current_major] PRIMARY KEY CLUSTERED ([version_set_id], [os_key]),
CONSTRAINT [FK_reference_os_current_major_version_set]
FOREIGN KEY ([version_set_id]) REFERENCES [tsaat].[reference_version_set]([version_set_id]),
CONSTRAINT [CK_reference_os_current_major_non_negative] CHECK ([current_supported_major] >= 0)
```

## tsaat.reference_software_supported_version

| Column | Source definition |
| --- | --- |
| version_set_id | BIGINT NOT NULL |
| software_name | NVARCHAR(255) NOT NULL |
| version_ordinal | INT NOT NULL |
| version | NVARCHAR(100) NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_reference_software_supported_version_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_reference_software_supported_version_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_reference_software_supported_version_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_reference_software_supported_version_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_reference_software_supported_version] PRIMARY KEY CLUSTERED ([version_set_id], [software_name], [version_ordinal]),
CONSTRAINT [FK_reference_software_supported_version_version_set]
FOREIGN KEY ([version_set_id]) REFERENCES [tsaat].[reference_version_set]([version_set_id]),
CONSTRAINT [CK_reference_software_supported_version_ordinal] CHECK ([version_ordinal] > 0)
```

## tsaat.discovery_tools_settings_version

| Column | Source definition |
| --- | --- |
| settings_version_id | BIGINT IDENTITY(1,1) NOT NULL |
| updated_at | DATETIMEOFFSET(7) NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_discovery_tools_settings_version_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_discovery_tools_settings_version_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_discovery_tools_settings_version_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_discovery_tools_settings_version_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_tools_settings_version] PRIMARY KEY CLUSTERED ([settings_version_id]),
CONSTRAINT [UQ_discovery_tools_settings_version_updated_at] UNIQUE ([updated_at])
```

## tsaat.discovery_tool

| Column | Source definition |
| --- | --- |
| settings_version_id | BIGINT NOT NULL |
| tool_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL CONSTRAINT [DF_discovery_tool_description] DEFAULT (N'') |
| el2_owner | NVARCHAR(255) NOT NULL CONSTRAINT [DF_discovery_tool_el2_owner] DEFAULT (N'') |
| el2_operations_manager | NVARCHAR(255) NOT NULL CONSTRAINT [DF_discovery_tool_el2_operations_manager] DEFAULT (N'') |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_discovery_tool_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_discovery_tool_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_discovery_tool_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_discovery_tool_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_tool] PRIMARY KEY CLUSTERED ([settings_version_id], [tool_id]),
CONSTRAINT [FK_discovery_tool_version]
FOREIGN KEY ([settings_version_id]) REFERENCES [tsaat].[discovery_tools_settings_version]([settings_version_id])
```

## tsaat.discovery_tool_asset_scope

| Column | Source definition |
| --- | --- |
| settings_version_id | BIGINT NOT NULL |
| tool_id | NVARCHAR(255) NOT NULL |
| asset_type | NVARCHAR(20) NOT NULL |
| scope_setting | NVARCHAR(20) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_tool_asset_scope] PRIMARY KEY CLUSTERED ([settings_version_id], [tool_id], [asset_type]),
CONSTRAINT [FK_discovery_tool_asset_scope_tool]
FOREIGN KEY ([settings_version_id], [tool_id]) REFERENCES [tsaat].[discovery_tool]([settings_version_id], [tool_id]),
CONSTRAINT [CK_discovery_tool_asset_scope_asset_type]
CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other', N'ip-node')),
CONSTRAINT [CK_discovery_tool_asset_scope_setting]
CHECK ([scope_setting] IN (N'required', N'na'))
```

## tsaat.discovery_coverage_source

| Column | Source definition |
| --- | --- |
| source_key | NVARCHAR(100) NOT NULL |
| source_object_name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_discovery_coverage_source_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_coverage_source] PRIMARY KEY CLUSTERED ([source_key]),
CONSTRAINT [CK_discovery_coverage_source_key] CHECK (LEN(LTRIM(RTRIM([source_key]))) > 0)
```

## tsaat.discovery_tool_detection_definition

| Column | Source definition |
| --- | --- |
| tool_id | NVARCHAR(255) NOT NULL |
| display_order | INT NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_discovery_tool_detection_definition_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_tool_detection_definition] PRIMARY KEY CLUSTERED ([tool_id]),
CONSTRAINT [UQ_discovery_tool_detection_definition_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_discovery_tool_detection_definition_display_order] CHECK ([display_order] > 0)
```

## tsaat.discovery_tool_detection_rule

| Column | Source definition |
| --- | --- |
| detection_rule_id | BIGINT IDENTITY(1,1) NOT NULL |
| tool_id | NVARCHAR(255) NOT NULL |
| display_order | INT NOT NULL |
| condition_key | NVARCHAR(80) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_discovery_tool_detection_rule_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_tool_detection_rule] PRIMARY KEY CLUSTERED ([detection_rule_id]),
CONSTRAINT [FK_discovery_tool_detection_rule_tool]
FOREIGN KEY ([tool_id]) REFERENCES [tsaat].[discovery_tool_detection_definition]([tool_id]),
CONSTRAINT [UQ_discovery_tool_detection_rule_order] UNIQUE ([tool_id], [display_order]),
CONSTRAINT [CK_discovery_tool_detection_rule_display_order] CHECK ([display_order] > 0),
CONSTRAINT [CK_discovery_tool_detection_rule_condition]
CHECK ([condition_key] IN (
```

## tsaat.discovery_tool_detection_rule_value

| Column | Source definition |
| --- | --- |
| detection_rule_id | BIGINT NOT NULL |
| value_order | INT NOT NULL |
| value_text | NVARCHAR(255) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_tool_detection_rule_value] PRIMARY KEY CLUSTERED ([detection_rule_id], [value_order]),
CONSTRAINT [FK_discovery_tool_detection_rule_value_rule]
FOREIGN KEY ([detection_rule_id]) REFERENCES [tsaat].[discovery_tool_detection_rule]([detection_rule_id]),
CONSTRAINT [CK_discovery_tool_detection_rule_value_order] CHECK ([value_order] > 0)
```

## tsaat.measures_settings_version

| Column | Source definition |
| --- | --- |
| settings_version_id | BIGINT IDENTITY(1,1) NOT NULL |
| updated_at | DATETIMEOFFSET(7) NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_measures_settings_version_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_measures_settings_version_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_measures_settings_version_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_measures_settings_version_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_measures_settings_version] PRIMARY KEY CLUSTERED ([settings_version_id]),
CONSTRAINT [UQ_measures_settings_version_updated_at] UNIQUE ([updated_at])
```

## tsaat.measures_severity_matrix

| Column | Source definition |
| --- | --- |
| settings_version_id | BIGINT NOT NULL |
| spi_id | INT NOT NULL |
| asset_type | NVARCHAR(20) NOT NULL |
| severity | NVARCHAR(30) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_measures_severity_matrix] PRIMARY KEY CLUSTERED ([settings_version_id], [spi_id], [asset_type]),
CONSTRAINT [FK_measures_severity_matrix_version]
FOREIGN KEY ([settings_version_id]) REFERENCES [tsaat].[measures_settings_version]([settings_version_id]),
CONSTRAINT [FK_measures_severity_matrix_spi]
FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
CONSTRAINT [FK_measures_severity_matrix_severity]
FOREIGN KEY ([severity]) REFERENCES [tsaat].[finding_severity_definition]([severity_key]),
CONSTRAINT [CK_measures_severity_matrix_asset_type]
CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other', N'ip-node'))
```

## tsaat.measures_priority_matrix

| Column | Source definition |
| --- | --- |
| settings_version_id | BIGINT NOT NULL |
| spi_id | INT NOT NULL |
| priority_rank | INT NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_measures_priority_matrix] PRIMARY KEY CLUSTERED ([settings_version_id], [spi_id]),
CONSTRAINT [FK_measures_priority_matrix_version]
FOREIGN KEY ([settings_version_id]) REFERENCES [tsaat].[measures_settings_version]([settings_version_id]),
CONSTRAINT [FK_measures_priority_matrix_spi]
FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
CONSTRAINT [FK_measures_priority_matrix_priority]
FOREIGN KEY ([priority_rank]) REFERENCES [tsaat].[finding_priority_definition]([priority_rank]),
CONSTRAINT [CK_measures_priority_matrix_priority_rank]
CHECK ([priority_rank] > 0)
```

## Routines

- FUNCTION tsaat.fn_finding_hash_int
- FUNCTION tsaat.fn_kpi_stable_hash
- FUNCTION tsaat.fn_spi_boolean_parameter
- FUNCTION tsaat.fn_spi_installed_software_count
- FUNCTION tsaat.fn_spi_number_parameter
- FUNCTION tsaat.fn_spi_software_support_status_count
- FUNCTION tsaat.fn_spi_string_parameter
- FUNCTION tsaat.fn_spi_vulnerability_count
- PROCEDURE tsaat.usp_evaluate_discovery_coverage_snapshot
- PROCEDURE tsaat.usp_evaluate_kpi_snapshot
- PROCEDURE tsaat.usp_evaluate_kpi_snapshot_bulk
- PROCEDURE tsaat.usp_evaluate_spi_snapshot
- PROCEDURE tsaat.usp_generate_spi_findings_snapshot
- PROCEDURE tsaat.usp_get_effective_findings_snapshot
- PROCEDURE tsaat.usp_get_finding_history_snapshot
- PROCEDURE tsaat.usp_get_finding_spi_history_snapshot
- VIEW tsaat.vw_persisted_finding_normalized
- VIEW tsaat.vw_spi_asset_evaluation_context

## Ordered migrations

Apply approved missing upgrades only; 026 contains demonstration metadata.

| Migration | SHA-256 |
| --- | --- |
| [001_add_ci_dependency.sql](../../Database%20Schema/migrations/001_add_ci_dependency.sql) | a9213c08f10013408e778365f889a67e8d18d003c38abc4e10a79976b33ea3aa |
| [002_ensure_shuffydog_full_access.sql](../../Database%20Schema/migrations/002_ensure_shuffydog_full_access.sql) | 7b1417fb48588180723d2f32b712c2aecfe5509a972bb3871cc38fb26e0f4516 |
| [003_add_platform_flags.sql](../../Database%20Schema/migrations/003_add_platform_flags.sql) | c6678de304cd1a9eaa0094ba46b69217bd2bebd43e9c3d82f64a878c7bfd26ac |
| [004_expand_asset_type_taxonomy.sql](../../Database%20Schema/migrations/004_expand_asset_type_taxonomy.sql) | ac058efeeeff348e7882fbee6d2def97c27571cfb92ed8c4eeefc813bd795f69 |
| [005_add_network_target_state_asset.sql](../../Database%20Schema/migrations/005_add_network_target_state_asset.sql) | 113b4957ceb583cac61784371635cabe9206e5778358166c0153f3972898bfcb |
| [006_add_app_auth.sql](../../Database%20Schema/migrations/006_add_app_auth.sql) | 6625d57fce5f0e6fac861c447d4b141aa6dc739e26b29d9ddb948b4ac446a75d |
| [007_drop_app_auth.sql](../../Database%20Schema/migrations/007_drop_app_auth.sql) | 5e581f850a4cce458e95a6458206f38d7618774c45d5810482926c6f7750be8a |
| [008_add_network_modelling_status.sql](../../Database%20Schema/migrations/008_add_network_modelling_status.sql) | 661f275d8e593b047ca814f44d1599bba514febcbcf5e2fb6b16d9dd2ecec72a |
| [009_add_network_diis_id_and_ato_backfill.sql](../../Database%20Schema/migrations/009_add_network_diis_id_and_ato_backfill.sql) | 473a62cf197f7a0a767a032a68e880a1d4315260092577147d728e463460f2f0 |
| [010_add_apm_numbers_and_reference_backfill.sql](../../Database%20Schema/migrations/010_add_apm_numbers_and_reference_backfill.sql) | d987cc1bd097f702848311c67399de623ebc5b9143d90ed5796f62634b43a787 |
| [011_add_measures_priority_matrix.sql](../../Database%20Schema/migrations/011_add_measures_priority_matrix.sql) | 90e604e6c1e7460f9ec4acf2462545ce46f85054ae7e1ae294652d832fa58336 |
| [012_add_kpi_definition.sql](../../Database%20Schema/migrations/012_add_kpi_definition.sql) | e744dad6f623070a7cc22a26020db0251cb398b87aacd0b24b323d55ce0dafef |
| [013_database_driven_spi_measures.sql](../../Database%20Schema/migrations/013_database_driven_spi_measures.sql) | f6958d27bd6b401db8065f4ef92520a1614ed6d4f056bec25fd69630f322109f |
| [014_spi_rule_catalogues_and_classification.sql](../../Database%20Schema/migrations/014_spi_rule_catalogues_and_classification.sql) | 47eac0f6ae864ee5837c342a110257b9fc5061ca07c0d46b26166cf284ae6e79 |
| [015_sql_driven_spi_measure_engine.sql](../../Database%20Schema/migrations/015_sql_driven_spi_measure_engine.sql) | c8d28b73aae555fc69d13bb5c013ac77d763d17f578f66b2144ad886928e4d16 |
| [016_database_driven_findings_features.sql](../../Database%20Schema/migrations/016_database_driven_findings_features.sql) | 237a6855f649c8fb55285a9d3415d47e544f66f7eb6178f3648d318278213c76 |
| [017_sql_driven_kpi_and_discovery_measure_engine.sql](../../Database%20Schema/migrations/017_sql_driven_kpi_and_discovery_measure_engine.sql) | 03864001a4291f4420607f5cb863af1f84ab970e3ac9db1003e53a39c3647b1c |
| [018_performance_optimized_sql_runtime.sql](../../Database%20Schema/migrations/018_performance_optimized_sql_runtime.sql) | 14af9427bb8d02e88a4bc211484dc6e0f13b6e390209779d060e6466d2e82b9a |
| [019_add_asset_cmdb_record_url.sql](../../Database%20Schema/migrations/019_add_asset_cmdb_record_url.sql) | c9859303e41fa008dabaf231c5ec7a56ea55c45fb4d9e88a3b39d6d6ae449b36 |
| [020_add_endpoint_discovery_fields.sql](../../Database%20Schema/migrations/020_add_endpoint_discovery_fields.sql) | 6a3cdd5cd05ac45ee0956330b23dd3ac3a1e7b303d9e5c08bb2faee3e1d6d96b |
| [021_add_software_inventory_fields.sql](../../Database%20Schema/migrations/021_add_software_inventory_fields.sql) | e78d247e682c4512c991f07aa6fb170dd442175cd31d2aa1975ba830a9b36eba |
| [022_add_ip_node_discovery.sql](../../Database%20Schema/migrations/022_add_ip_node_discovery.sql) | 9831f08e07d26168ea8c673531edbeb6309abb4cf7439c64db0afa75d6b79c16 |
| [023_system_ato_diis_kpis.sql](../../Database%20Schema/migrations/023_system_ato_diis_kpis.sql) | ac37e2679a9e33398f6d09048bd2b43a074de64f527852d7b9199b29f3e3f6b0 |
| [024_remove_ci_assignment_and_owner_fields.sql](../../Database%20Schema/migrations/024_remove_ci_assignment_and_owner_fields.sql) | aaf74a392898466306defbac5b5addb927b1ed276fd43eef225bb36ab60f8f1a |
| [025_cmdb_asset_type_attributes.sql](../../Database%20Schema/migrations/025_cmdb_asset_type_attributes.sql) | 341d5881bd67ff101089f056377b8fefa1e0ebce1792f3349a923f6f0c8d1551 |
| [026_populate_demo_entity_panel_details.sql](../../Database%20Schema/migrations/026_populate_demo_entity_panel_details.sql) | a8335a7fcb19b1a21c3764690637ee2f313dd7051ae606fcdc13f39fada66dcf |
