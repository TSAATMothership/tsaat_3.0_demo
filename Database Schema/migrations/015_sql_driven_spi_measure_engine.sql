SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

IF OBJECT_ID(N'tsaat.finding_priority_definition', N'U') IS NULL
BEGIN
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
END;

MERGE [tsaat].[finding_priority_definition] AS target
USING (VALUES
  (1, N'P1', 1, CONVERT(BIT, 1), N'Immediate priority remediation.'),
  (2, N'P2', 2, CONVERT(BIT, 1), N'High priority remediation.'),
  (3, N'P3', 3, CONVERT(BIT, 1), N'Major priority remediation.'),
  (4, N'P4', 4, CONVERT(BIT, 1), N'Elevated priority remediation.'),
  (5, N'P5', 5, CONVERT(BIT, 1), N'Standard priority remediation.'),
  (6, N'P6', 6, CONVERT(BIT, 1), N'Lower priority remediation.'),
  (7, N'P7', 7, CONVERT(BIT, 1), N'Lowest selectable priority remediation.'),
  (90, N'P90', 90, CONVERT(BIT, 0), N'Data gap priority used for unknown evidence.')
) AS source ([priority_rank], [label], [display_order], [selectable_in_settings], [description])
ON target.[priority_rank] = source.[priority_rank]
WHEN MATCHED THEN
  UPDATE SET
    [label] = source.[label],
    [display_order] = source.[display_order],
    [selectable_in_settings] = source.[selectable_in_settings],
    [description] = source.[description]
WHEN NOT MATCHED THEN
  INSERT ([priority_rank], [label], [display_order], [selectable_in_settings], [description])
  VALUES (source.[priority_rank], source.[label], source.[display_order], source.[selectable_in_settings], source.[description]);

IF OBJECT_ID(N'tsaat.finding', N'U') IS NOT NULL
BEGIN
  INSERT INTO [tsaat].[finding_priority_definition] ([priority_rank], [label], [display_order], [selectable_in_settings], [description])
  SELECT DISTINCT f.[priority_rank], CONCAT(N'P', f.[priority_rank]), 10000 + f.[priority_rank], CONVERT(BIT, 0), CONCAT(N'Existing priority ', f.[priority_rank])
  FROM [tsaat].[finding] AS f
  WHERE f.[priority_rank] > 0
    AND NOT EXISTS (
      SELECT 1
      FROM [tsaat].[finding_priority_definition] AS fpd
      WHERE fpd.[priority_rank] = f.[priority_rank]
    );
END;

IF OBJECT_ID(N'tsaat.measures_priority_matrix', N'U') IS NOT NULL
BEGIN
  INSERT INTO [tsaat].[finding_priority_definition] ([priority_rank], [label], [display_order], [selectable_in_settings], [description])
  SELECT DISTINCT mpm.[priority_rank], CONCAT(N'P', mpm.[priority_rank]), 11000 + mpm.[priority_rank], CONVERT(BIT, 0), CONCAT(N'Existing settings priority ', mpm.[priority_rank])
  FROM [tsaat].[measures_priority_matrix] AS mpm
  WHERE mpm.[priority_rank] > 0
    AND NOT EXISTS (
      SELECT 1
      FROM [tsaat].[finding_priority_definition] AS fpd
      WHERE fpd.[priority_rank] = mpm.[priority_rank]
    );

  IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_measures_priority_matrix_priority_rank' AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_priority_matrix'))
    ALTER TABLE [tsaat].[measures_priority_matrix] DROP CONSTRAINT [CK_measures_priority_matrix_priority_rank];

  IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_measures_priority_matrix_priority_rank' AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_priority_matrix'))
    ALTER TABLE [tsaat].[measures_priority_matrix] ADD CONSTRAINT [CK_measures_priority_matrix_priority_rank] CHECK ([priority_rank] > 0);

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_measures_priority_matrix_priority' AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_priority_matrix'))
    ALTER TABLE [tsaat].[measures_priority_matrix] WITH CHECK ADD CONSTRAINT [FK_measures_priority_matrix_priority] FOREIGN KEY ([priority_rank]) REFERENCES [tsaat].[finding_priority_definition]([priority_rank]);
END;

IF OBJECT_ID(N'tsaat.finding', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_finding_priority' AND [parent_object_id] = OBJECT_ID(N'tsaat.finding'))
    ALTER TABLE [tsaat].[finding] WITH CHECK ADD CONSTRAINT [FK_finding_priority] FOREIGN KEY ([priority_rank]) REFERENCES [tsaat].[finding_priority_definition]([priority_rank]);
END;

IF OBJECT_ID(N'tsaat.spi_calculation_source', N'U') IS NULL
BEGIN
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
    CONSTRAINT [CK_spi_calculation_source_object] CHECK ([source_object_name] IN (N'[tsaat].[vw_spi_asset_evaluation_context]')),
    CONSTRAINT [CK_spi_calculation_source_display_order] CHECK ([display_order] > 0)
  );
END;

IF OBJECT_ID(N'tsaat.spi_calculation_definition', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[spi_calculation_definition] (
    [rule_key] NVARCHAR(100) NOT NULL,
    [source_key] NVARCHAR(100) NOT NULL,
    [display_order] INT NOT NULL,
    [status_expression_sql] NVARCHAR(MAX) NOT NULL,
    [outcome_expression_sql] NVARCHAR(MAX) NOT NULL,
    [enabled] BIT NOT NULL CONSTRAINT [DF_spi_calculation_definition_enabled] DEFAULT (1),
    CONSTRAINT [PK_spi_calculation_definition] PRIMARY KEY CLUSTERED ([rule_key]),
    CONSTRAINT [UQ_spi_calculation_definition_display_order] UNIQUE ([display_order]),
    CONSTRAINT [FK_spi_calculation_definition_rule] FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_rule_definition]([rule_key]),
    CONSTRAINT [FK_spi_calculation_definition_source] FOREIGN KEY ([source_key]) REFERENCES [tsaat].[spi_calculation_source]([source_key]),
    CONSTRAINT [CK_spi_calculation_definition_display_order] CHECK ([display_order] > 0),
    CONSTRAINT [CK_spi_calculation_definition_status_sql] CHECK (LEN(LTRIM(RTRIM([status_expression_sql]))) > 0 AND [status_expression_sql] NOT LIKE N'%;%' AND [status_expression_sql] NOT LIKE N'%--%' AND [status_expression_sql] NOT LIKE N'%/*%'),
    CONSTRAINT [CK_spi_calculation_definition_outcome_sql] CHECK (LEN(LTRIM(RTRIM([outcome_expression_sql]))) > 0 AND [outcome_expression_sql] NOT LIKE N'%;%' AND [outcome_expression_sql] NOT LIKE N'%--%' AND [outcome_expression_sql] NOT LIKE N'%/*%')
  );
END;

IF OBJECT_ID(N'tsaat.spi_calculation_evidence_expression', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[spi_calculation_evidence_expression] (
    [rule_key] NVARCHAR(100) NOT NULL,
    [evidence_key] NVARCHAR(100) NOT NULL,
    [display_order] INT NOT NULL,
    [value_type] NVARCHAR(20) NOT NULL,
    [value_expression_sql] NVARCHAR(MAX) NOT NULL,
    [omit_when_null] BIT NOT NULL CONSTRAINT [DF_spi_calculation_evidence_expression_omit] DEFAULT (0),
    CONSTRAINT [PK_spi_calculation_evidence_expression] PRIMARY KEY CLUSTERED ([rule_key], [evidence_key]),
    CONSTRAINT [FK_spi_calculation_evidence_expression_definition] FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_calculation_definition]([rule_key]),
    CONSTRAINT [CK_spi_calculation_evidence_expression_key] CHECK (LEN(LTRIM(RTRIM([evidence_key]))) > 0 AND [evidence_key] NOT LIKE N'%[^A-Za-z0-9_]%' COLLATE Latin1_General_BIN2),
    CONSTRAINT [CK_spi_calculation_evidence_expression_display_order] CHECK ([display_order] > 0),
    CONSTRAINT [CK_spi_calculation_evidence_expression_type] CHECK ([value_type] IN (N'string', N'number', N'boolean')),
    CONSTRAINT [CK_spi_calculation_evidence_expression_sql] CHECK (LEN(LTRIM(RTRIM([value_expression_sql]))) > 0 AND [value_expression_sql] NOT LIKE N'%;%' AND [value_expression_sql] NOT LIKE N'%--%' AND [value_expression_sql] NOT LIKE N'%/*%')
  );
END;

IF OBJECT_ID(N'tsaat.spi_feature_binding', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[spi_feature_binding] (
    [feature_key] NVARCHAR(100) NOT NULL,
    [spi_id] INT NOT NULL,
    [display_order] INT NOT NULL,
    [compliance_status] NVARCHAR(20) NULL,
    [outcome_key] NVARCHAR(100) NULL,
    [enabled] BIT NOT NULL CONSTRAINT [DF_spi_feature_binding_enabled] DEFAULT (1),
    [description] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [PK_spi_feature_binding] PRIMARY KEY CLUSTERED ([feature_key], [spi_id], [display_order]),
    CONSTRAINT [FK_spi_feature_binding_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
    CONSTRAINT [CK_spi_feature_binding_key] CHECK (LEN(LTRIM(RTRIM([feature_key]))) > 0),
    CONSTRAINT [CK_spi_feature_binding_display_order] CHECK ([display_order] > 0),
    CONSTRAINT [CK_spi_feature_binding_status] CHECK ([compliance_status] IS NULL OR [compliance_status] IN (N'Compliant', N'Non-compliant', N'Unknown'))
  );
END;

IF OBJECT_ID(N'tsaat.spi_feature_binding', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_feature_binding_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_feature_binding'))
    ALTER TABLE [tsaat].[spi_feature_binding] WITH CHECK ADD CONSTRAINT [FK_spi_feature_binding_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]);
END;

MERGE [tsaat].[spi_calculation_source] AS target
USING (VALUES
  (N'asset-evaluation-context', N'[tsaat].[vw_spi_asset_evaluation_context]', 1, N'SPI Asset Evaluation Context', N'Approved read-only source for SQL-driven SPI measure calculations.', CONVERT(BIT, 1))
) AS source ([source_key], [source_object_name], [display_order], [name], [description], [enabled])
ON target.[source_key] = source.[source_key]
WHEN MATCHED THEN
  UPDATE SET [source_object_name] = source.[source_object_name], [display_order] = source.[display_order], [name] = source.[name], [description] = source.[description], [enabled] = source.[enabled]
WHEN NOT MATCHED THEN
  INSERT ([source_key], [source_object_name], [display_order], [name], [description], [enabled])
  VALUES (source.[source_key], source.[source_object_name], source.[display_order], source.[name], source.[description], source.[enabled]);

MERGE [tsaat].[spi_calculation_definition] AS target
USING (VALUES
  (N'os-support', N'asset-evaluation-context', 1, N'CASE WHEN ctx.os_display_name IS NULL THEN N''Unknown'' WHEN ctx.os_support_status IS NULL OR ctx.os_support_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unknownSupportStatus'',N''Unknown'') THEN N''Unknown'' WHEN ctx.os_support_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unsupportedStatus'',N''OutOfSupport'') THEN N''Non-compliant'' ELSE N''Compliant'' END', N'CASE WHEN ctx.os_display_name IS NULL THEN N''missing_os_data'' WHEN ctx.os_support_status IS NULL OR ctx.os_support_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unknownSupportStatus'',N''Unknown'') THEN N''missing_os_data'' WHEN ctx.os_support_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unsupportedStatus'',N''OutOfSupport'') THEN N''unsupported'' ELSE N''supported'' END', CONVERT(BIT, 1)),
  (N'os-n-minus', N'asset-evaluation-context', 2, N'CASE WHEN ctx.os_n_minus IS NULL THEN N''Unknown'' WHEN ctx.os_n_minus <= [tsaat].[fn_spi_number_parameter](sd.spi_id,N''maxNMinus'',2) THEN N''Compliant'' ELSE N''Non-compliant'' END', N'CASE WHEN ctx.os_n_minus IS NULL THEN N''missing_n_minus'' WHEN ctx.os_n_minus <= [tsaat].[fn_spi_number_parameter](sd.spi_id,N''maxNMinus'',2) THEN N''within_n_minus'' ELSE N''older_than_n_minus'' END', CONVERT(BIT, 1)),
  (N'server-critical-vulnerability', N'asset-evaluation-context', 3, N'CASE WHEN [tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical'')) > 0 THEN N''Non-compliant'' ELSE N''Compliant'' END', N'CASE WHEN [tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical'')) > 0 THEN N''critical_vulnerability_present'' ELSE N''no_critical_vulnerability'' END', CONVERT(BIT, 1)),
  (N'production-server-critical-unsupported-os', N'asset-evaluation-context', 4, N'CASE WHEN ctx.environment_type <> [tsaat].[fn_spi_string_parameter](sd.spi_id,N''environmentType'',N''Production'') OR ctx.environment_type IS NULL THEN N''Compliant'' WHEN ctx.os_support_status IS NULL OR ctx.os_support_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unknownSupportStatus'',N''Unknown'') THEN N''Unknown'' WHEN [tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical'')) > 0 AND ctx.os_support_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unsupportedStatus'',N''OutOfSupport'') THEN N''Non-compliant'' ELSE N''Compliant'' END', N'CASE WHEN ctx.environment_type <> [tsaat].[fn_spi_string_parameter](sd.spi_id,N''environmentType'',N''Production'') OR ctx.environment_type IS NULL THEN N''not_production_context'' WHEN ctx.os_support_status IS NULL OR ctx.os_support_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unknownSupportStatus'',N''Unknown'') THEN N''missing_os_support'' WHEN [tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical'')) > 0 AND ctx.os_support_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unsupportedStatus'',N''OutOfSupport'') THEN N''triggered'' ELSE N''not_triggered'' END', CONVERT(BIT, 1)),
  (N'production-server-critical-unsupported-software', N'asset-evaluation-context', 5, N'CASE WHEN ctx.environment_type <> [tsaat].[fn_spi_string_parameter](sd.spi_id,N''environmentType'',N''Production'') OR ctx.environment_type IS NULL THEN N''Compliant'' WHEN [tsaat].[fn_spi_installed_software_count](ctx.snapshot_id,ctx.asset_id) = 0 THEN N''Unknown'' WHEN [tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical'')) > 0 AND [tsaat].[fn_spi_software_support_status_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''unsupportedStatus'',N''OutOfSupport'')) > 0 THEN N''Non-compliant'' ELSE N''Compliant'' END', N'CASE WHEN ctx.environment_type <> [tsaat].[fn_spi_string_parameter](sd.spi_id,N''environmentType'',N''Production'') OR ctx.environment_type IS NULL THEN N''not_production_context'' WHEN [tsaat].[fn_spi_installed_software_count](ctx.snapshot_id,ctx.asset_id) = 0 THEN N''missing_software'' WHEN [tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical'')) > 0 AND [tsaat].[fn_spi_software_support_status_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''unsupportedStatus'',N''OutOfSupport'')) > 0 THEN N''triggered'' ELSE N''not_triggered'' END', CONVERT(BIT, 1)),
  (N'production-workstation-critical-unsupported-software', N'asset-evaluation-context', 6, N'CASE WHEN ctx.environment_type <> [tsaat].[fn_spi_string_parameter](sd.spi_id,N''environmentType'',N''Production'') OR ctx.environment_type IS NULL THEN N''Compliant'' WHEN [tsaat].[fn_spi_installed_software_count](ctx.snapshot_id,ctx.asset_id) = 0 THEN N''Unknown'' WHEN [tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical'')) > 0 AND [tsaat].[fn_spi_software_support_status_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''unsupportedStatus'',N''OutOfSupport'')) > 0 THEN N''Non-compliant'' ELSE N''Compliant'' END', N'CASE WHEN ctx.environment_type <> [tsaat].[fn_spi_string_parameter](sd.spi_id,N''environmentType'',N''Production'') OR ctx.environment_type IS NULL THEN N''not_production_context'' WHEN [tsaat].[fn_spi_installed_software_count](ctx.snapshot_id,ctx.asset_id) = 0 THEN N''missing_software'' WHEN [tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical'')) > 0 AND [tsaat].[fn_spi_software_support_status_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''unsupportedStatus'',N''OutOfSupport'')) > 0 THEN N''triggered'' ELSE N''not_triggered'' END', CONVERT(BIT, 1)),
  (N'network-device-critical-vulnerability', N'asset-evaluation-context', 7, N'CASE WHEN [tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical'')) > 0 THEN N''Non-compliant'' ELSE N''Compliant'' END', N'CASE WHEN [tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical'')) > 0 THEN N''critical_vulnerability_present'' ELSE N''no_critical_vulnerability'' END', CONVERT(BIT, 1)),
  (N'network-device-support', N'asset-evaluation-context', 8, N'CASE WHEN ctx.network_os_display_name IS NULL THEN N''Unknown'' WHEN ctx.network_os_support_status IS NULL OR ctx.network_os_support_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unknownSupportStatus'',N''Unknown'') THEN N''Unknown'' WHEN ctx.network_os_support_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unsupportedStatus'',N''OutOfSupport'') THEN N''Non-compliant'' ELSE N''Compliant'' END', N'CASE WHEN ctx.network_os_display_name IS NULL THEN N''missing_network_os'' WHEN ctx.network_os_support_status IS NULL OR ctx.network_os_support_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unknownSupportStatus'',N''Unknown'') THEN N''missing_network_os'' WHEN ctx.network_os_support_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unsupportedStatus'',N''OutOfSupport'') THEN N''unsupported'' ELSE N''supported'' END', CONVERT(BIT, 1)),
  (N'network-device-patch-currency', N'asset-evaluation-context', 9, N'CASE WHEN ctx.patch_is_latest IS NULL THEN N''Unknown'' WHEN ctx.patch_is_latest = [tsaat].[fn_spi_boolean_parameter](sd.spi_id,N''latestPatchRequired'',1) THEN N''Compliant'' ELSE N''Non-compliant'' END', N'CASE WHEN ctx.patch_is_latest IS NULL THEN N''missing_patch_state'' WHEN ctx.patch_is_latest = [tsaat].[fn_spi_boolean_parameter](sd.spi_id,N''latestPatchRequired'',1) THEN N''current'' ELSE N''not_current'' END', CONVERT(BIT, 1)),
  (N'asset-lifecycle-currency', N'asset-evaluation-context', 10, N'CASE WHEN ctx.lifecycle_eol_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unknownLifecycleStatus'',N''Unknown'') OR ctx.lifecycle_warranty_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unknownLifecycleStatus'',N''Unknown'') THEN N''Unknown'' WHEN ctx.lifecycle_eol_status <> [tsaat].[fn_spi_string_parameter](sd.spi_id,N''endOfLifeStatus'',N''EOL'') AND ctx.lifecycle_warranty_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''inWarrantyStatus'',N''InWarranty'') THEN N''Compliant'' ELSE N''Non-compliant'' END', N'CASE WHEN ctx.lifecycle_eol_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unknownLifecycleStatus'',N''Unknown'') OR ctx.lifecycle_warranty_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''unknownLifecycleStatus'',N''Unknown'') THEN N''missing_lifecycle'' WHEN ctx.lifecycle_eol_status <> [tsaat].[fn_spi_string_parameter](sd.spi_id,N''endOfLifeStatus'',N''EOL'') AND ctx.lifecycle_warranty_status = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''inWarrantyStatus'',N''InWarranty'') THEN N''current'' ELSE N''expired'' END', CONVERT(BIT, 1))
) AS source ([rule_key], [source_key], [display_order], [status_expression_sql], [outcome_expression_sql], [enabled])
ON target.[rule_key] = source.[rule_key]
WHEN MATCHED THEN
  UPDATE SET [source_key] = source.[source_key], [display_order] = source.[display_order], [status_expression_sql] = source.[status_expression_sql], [outcome_expression_sql] = source.[outcome_expression_sql], [enabled] = source.[enabled]
WHEN NOT MATCHED THEN
  INSERT ([rule_key], [source_key], [display_order], [status_expression_sql], [outcome_expression_sql], [enabled])
  VALUES (source.[rule_key], source.[source_key], source.[display_order], source.[status_expression_sql], source.[outcome_expression_sql], source.[enabled]);

DELETE FROM [tsaat].[spi_calculation_evidence_expression]
WHERE [rule_key] IN (
  N'os-support',
  N'os-n-minus',
  N'server-critical-vulnerability',
  N'production-server-critical-unsupported-os',
  N'production-server-critical-unsupported-software',
  N'production-workstation-critical-unsupported-software',
  N'network-device-critical-vulnerability',
  N'network-device-support',
  N'network-device-patch-currency',
  N'asset-lifecycle-currency'
);

INSERT INTO [tsaat].[spi_calculation_evidence_expression] ([rule_key], [evidence_key], [display_order], [value_type], [value_expression_sql], [omit_when_null])
VALUES
(N'os-support', N'operatingSystem', 1, N'string', N'ctx.os_display_name', CONVERT(BIT, 0)),
(N'os-support', N'supportStatus', 2, N'string', N'ctx.os_support_status', CONVERT(BIT, 0)),
(N'os-n-minus', N'operatingSystem', 1, N'string', N'ctx.os_display_name', CONVERT(BIT, 0)),
(N'os-n-minus', N'nMinus', 2, N'number', N'ctx.os_n_minus', CONVERT(BIT, 0)),
(N'os-n-minus', N'currentMajor', 3, N'number', N'ctx.os_current_supported_major', CONVERT(BIT, 0)),
(N'server-critical-vulnerability', N'criticalVulnerabilities', 1, N'number', N'[tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical''))', CONVERT(BIT, 0)),
(N'production-server-critical-unsupported-os', N'productionContext', 1, N'boolean', N'CAST(CASE WHEN ctx.environment_type = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''environmentType'',N''Production'') THEN 1 ELSE 0 END AS BIT)', CONVERT(BIT, 0)),
(N'production-server-critical-unsupported-os', N'criticalVulnerability', 2, N'boolean', N'CAST(CASE WHEN [tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical'')) > 0 THEN 1 ELSE 0 END AS BIT)', CONVERT(BIT, 0)),
(N'production-server-critical-unsupported-os', N'osSupportStatus', 3, N'string', N'ctx.os_support_status', CONVERT(BIT, 0)),
(N'production-server-critical-unsupported-software', N'productionContext', 1, N'boolean', N'CAST(CASE WHEN ctx.environment_type = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''environmentType'',N''Production'') THEN 1 ELSE 0 END AS BIT)', CONVERT(BIT, 0)),
(N'production-server-critical-unsupported-software', N'criticalVulnerability', 2, N'boolean', N'CAST(CASE WHEN [tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical'')) > 0 THEN 1 ELSE 0 END AS BIT)', CONVERT(BIT, 0)),
(N'production-server-critical-unsupported-software', N'outOfSupportSoftwareCount', 3, N'number', N'CASE WHEN ctx.environment_type <> [tsaat].[fn_spi_string_parameter](sd.spi_id,N''environmentType'',N''Production'') OR ctx.environment_type IS NULL THEN 0 WHEN [tsaat].[fn_spi_installed_software_count](ctx.snapshot_id,ctx.asset_id) = 0 THEN NULL ELSE [tsaat].[fn_spi_software_support_status_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''unsupportedStatus'',N''OutOfSupport'')) END', CONVERT(BIT, 0)),
(N'production-workstation-critical-unsupported-software', N'productionContext', 1, N'boolean', N'CAST(CASE WHEN ctx.environment_type = [tsaat].[fn_spi_string_parameter](sd.spi_id,N''environmentType'',N''Production'') THEN 1 ELSE 0 END AS BIT)', CONVERT(BIT, 0)),
(N'production-workstation-critical-unsupported-software', N'criticalVulnerability', 2, N'boolean', N'CAST(CASE WHEN [tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical'')) > 0 THEN 1 ELSE 0 END AS BIT)', CONVERT(BIT, 0)),
(N'production-workstation-critical-unsupported-software', N'outOfSupportSoftwareCount', 3, N'number', N'CASE WHEN ctx.environment_type <> [tsaat].[fn_spi_string_parameter](sd.spi_id,N''environmentType'',N''Production'') OR ctx.environment_type IS NULL THEN 0 WHEN [tsaat].[fn_spi_installed_software_count](ctx.snapshot_id,ctx.asset_id) = 0 THEN NULL ELSE [tsaat].[fn_spi_software_support_status_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''unsupportedStatus'',N''OutOfSupport'')) END', CONVERT(BIT, 0)),
(N'network-device-critical-vulnerability', N'criticalVulnerabilities', 1, N'number', N'[tsaat].[fn_spi_vulnerability_count](ctx.snapshot_id,ctx.asset_id,[tsaat].[fn_spi_string_parameter](sd.spi_id,N''vulnerabilitySeverity'',N''Critical''))', CONVERT(BIT, 0)),
(N'network-device-support', N'networkOs', 1, N'string', N'ctx.network_os_display_name', CONVERT(BIT, 0)),
(N'network-device-support', N'supportStatus', 2, N'string', N'ctx.network_os_support_status', CONVERT(BIT, 0)),
(N'network-device-patch-currency', N'isLatestPatch', 1, N'boolean', N'ctx.patch_is_latest', CONVERT(BIT, 0)),
(N'network-device-patch-currency', N'lastPatchedDate', 2, N'string', N'ctx.patch_last_patched_date', CONVERT(BIT, 0)),
(N'asset-lifecycle-currency', N'eolStatus', 1, N'string', N'ctx.lifecycle_eol_status', CONVERT(BIT, 0)),
(N'asset-lifecycle-currency', N'warrantyStatus', 2, N'string', N'ctx.lifecycle_warranty_status', CONVERT(BIT, 0));

DELETE FROM [tsaat].[spi_feature_binding]
WHERE [spi_id] IN (1, 2, 3, 7);

INSERT INTO [tsaat].[spi_feature_binding] ([feature_key], [spi_id], [display_order], [compliance_status], [outcome_key], [enabled], [description])
VALUES
(N'out-of-support-os-report', 1, 1, N'Non-compliant', N'unsupported', CONVERT(BIT, 1), N'Source SPI row for the ICT System out of support OS report.'),
(N'os-non-compliant', 1, 1, N'Non-compliant', NULL, CONVERT(BIT, 1), N'Operating-system posture non-compliance for server/workstation filters.'),
(N'os-non-compliant', 2, 2, N'Non-compliant', NULL, CONVERT(BIT, 1), N'Operating-system N-minus posture non-compliance for server/workstation filters.'),
(N'production-critical-exposure', 3, 1, N'Non-compliant', NULL, CONVERT(BIT, 1), N'Server critical vulnerability row used to classify production critical exposure.'),
(N'production-critical-exposure', 7, 2, N'Non-compliant', NULL, CONVERT(BIT, 1), N'Network device critical vulnerability row used to classify production critical exposure.');

IF OBJECT_ID(N'tsaat.spi_finding_classification_rule', N'U') IS NOT NULL
BEGIN
  INSERT INTO [tsaat].[finding_priority_definition] ([priority_rank], [label], [display_order], [selectable_in_settings], [description])
  SELECT DISTINCT sfcr.[priority_rank], CONCAT(N'P', sfcr.[priority_rank]), 12000 + sfcr.[priority_rank], CONVERT(BIT, 0), CONCAT(N'Existing classification priority ', sfcr.[priority_rank])
  FROM [tsaat].[spi_finding_classification_rule] AS sfcr
  WHERE sfcr.[priority_rank] IS NOT NULL
    AND sfcr.[priority_rank] > 0
    AND NOT EXISTS (
      SELECT 1
      FROM [tsaat].[finding_priority_definition] AS fpd
      WHERE fpd.[priority_rank] = sfcr.[priority_rank]
    );

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_finding_classification_rule_priority' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_finding_classification_rule'))
    ALTER TABLE [tsaat].[spi_finding_classification_rule] WITH CHECK ADD CONSTRAINT [FK_spi_finding_classification_rule_priority] FOREIGN KEY ([priority_rank]) REFERENCES [tsaat].[finding_priority_definition]([priority_rank]);
END;

COMMIT TRANSACTION;
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
