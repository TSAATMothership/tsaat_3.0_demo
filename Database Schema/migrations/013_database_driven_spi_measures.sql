SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

IF OBJECT_ID(N'tsaat.finding_severity_definition', N'U') IS NULL
BEGIN
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
END;

MERGE [tsaat].[finding_severity_definition] AS target
USING (VALUES
  (N'Critical Exposure', N'Critical Exposure', 1, CONVERT(BIT, 1), N'critical'),
  (N'High Risk', N'High Risk', 2, CONVERT(BIT, 1), N'high'),
  (N'Major', N'Major', 3, CONVERT(BIT, 1), N'major'),
  (N'Moderate', N'Moderate', 4, CONVERT(BIT, 1), N'moderate'),
  (N'Data Gap', N'Data Gap', 5, CONVERT(BIT, 0), N'data-gap')
) AS source ([severity_key], [label], [display_order], [selectable_in_settings], [tone_key])
ON target.[severity_key] = source.[severity_key]
WHEN MATCHED THEN
  UPDATE SET
    [label] = source.[label],
    [display_order] = source.[display_order],
    [selectable_in_settings] = source.[selectable_in_settings],
    [tone_key] = source.[tone_key]
WHEN NOT MATCHED THEN
  INSERT ([severity_key], [label], [display_order], [selectable_in_settings], [tone_key])
  VALUES (source.[severity_key], source.[label], source.[display_order], source.[selectable_in_settings], source.[tone_key]);

IF OBJECT_ID(N'tsaat.spi_applicable_asset_type', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_applicable_asset_type_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_applicable_asset_type'))
    ALTER TABLE [tsaat].[spi_applicable_asset_type] DROP CONSTRAINT [FK_spi_applicable_asset_type_spi];
  IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_spi_applicable_asset_type' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_applicable_asset_type'))
    ALTER TABLE [tsaat].[spi_applicable_asset_type] DROP CONSTRAINT [PK_spi_applicable_asset_type];
END;

IF OBJECT_ID(N'tsaat.finding', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_finding_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.finding'))
    ALTER TABLE [tsaat].[finding] DROP CONSTRAINT [FK_finding_spi];
  IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_finding_severity' AND [parent_object_id] = OBJECT_ID(N'tsaat.finding'))
    ALTER TABLE [tsaat].[finding] DROP CONSTRAINT [CK_finding_severity];
END;

IF OBJECT_ID(N'tsaat.measures_severity_matrix', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_measures_severity_matrix_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_severity_matrix'))
    ALTER TABLE [tsaat].[measures_severity_matrix] DROP CONSTRAINT [FK_measures_severity_matrix_spi];
  IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_measures_severity_matrix_severity' AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_severity_matrix'))
    ALTER TABLE [tsaat].[measures_severity_matrix] DROP CONSTRAINT [CK_measures_severity_matrix_severity];
  IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_measures_severity_matrix' AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_severity_matrix'))
    ALTER TABLE [tsaat].[measures_severity_matrix] DROP CONSTRAINT [PK_measures_severity_matrix];
END;

IF OBJECT_ID(N'tsaat.measures_priority_matrix', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_measures_priority_matrix_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_priority_matrix'))
    ALTER TABLE [tsaat].[measures_priority_matrix] DROP CONSTRAINT [FK_measures_priority_matrix_spi];
  IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_measures_priority_matrix' AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_priority_matrix'))
    ALTER TABLE [tsaat].[measures_priority_matrix] DROP CONSTRAINT [PK_measures_priority_matrix];
END;

IF OBJECT_ID(N'tsaat.spi_rule_parameter', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_rule_parameter_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_rule_parameter'))
    ALTER TABLE [tsaat].[spi_rule_parameter] DROP CONSTRAINT [FK_spi_rule_parameter_spi];
END;

IF OBJECT_ID(N'tsaat.spi_finding_classification_rule', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_finding_classification_rule_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_finding_classification_rule'))
    ALTER TABLE [tsaat].[spi_finding_classification_rule] DROP CONSTRAINT [FK_spi_finding_classification_rule_spi];
END;

IF OBJECT_ID(N'tsaat.spi_tasking_team', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_tasking_team_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_tasking_team'))
    ALTER TABLE [tsaat].[spi_tasking_team] DROP CONSTRAINT [FK_spi_tasking_team_spi];
END;

IF OBJECT_ID(N'tsaat.spi_tasking_action_template', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_tasking_action_template_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_tasking_action_template'))
    ALTER TABLE [tsaat].[spi_tasking_action_template] DROP CONSTRAINT [FK_spi_tasking_action_template_spi];
END;

IF OBJECT_ID(N'tsaat.spi_tasking_condition_template', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_tasking_condition_template_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_tasking_condition_template'))
    ALTER TABLE [tsaat].[spi_tasking_condition_template] DROP CONSTRAINT [FK_spi_tasking_condition_template_spi];
END;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_spi_definition_spi_id' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_definition'))
  ALTER TABLE [tsaat].[spi_definition] DROP CONSTRAINT [CK_spi_definition_spi_id];
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_spi_definition' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_definition'))
  ALTER TABLE [tsaat].[spi_definition] DROP CONSTRAINT [PK_spi_definition];

IF COL_LENGTH(N'tsaat.spi_definition', N'spi_id') IS NOT NULL
  ALTER TABLE [tsaat].[spi_definition] ALTER COLUMN [spi_id] INT NOT NULL;
IF OBJECT_ID(N'tsaat.spi_applicable_asset_type', N'U') IS NOT NULL
  ALTER TABLE [tsaat].[spi_applicable_asset_type] ALTER COLUMN [spi_id] INT NOT NULL;
IF OBJECT_ID(N'tsaat.finding', N'U') IS NOT NULL
  ALTER TABLE [tsaat].[finding] ALTER COLUMN [spi_id] INT NOT NULL;
IF OBJECT_ID(N'tsaat.measures_severity_matrix', N'U') IS NOT NULL
  ALTER TABLE [tsaat].[measures_severity_matrix] ALTER COLUMN [spi_id] INT NOT NULL;
IF OBJECT_ID(N'tsaat.measures_priority_matrix', N'U') IS NOT NULL
  ALTER TABLE [tsaat].[measures_priority_matrix] ALTER COLUMN [spi_id] INT NOT NULL;

IF COL_LENGTH(N'tsaat.spi_definition', N'display_order') IS NULL
  ALTER TABLE [tsaat].[spi_definition] ADD [display_order] INT NULL;
IF COL_LENGTH(N'tsaat.spi_definition', N'default_severity') IS NULL
  ALTER TABLE [tsaat].[spi_definition] ADD [default_severity] NVARCHAR(30) NULL;
IF COL_LENGTH(N'tsaat.spi_definition', N'enabled') IS NULL
  ALTER TABLE [tsaat].[spi_definition] ADD [enabled] BIT NOT NULL CONSTRAINT [DF_spi_definition_enabled] DEFAULT (1);
IF COL_LENGTH(N'tsaat.spi_definition', N'rule_key') IS NULL
  ALTER TABLE [tsaat].[spi_definition] ADD [rule_key] NVARCHAR(100) NULL;
IF COL_LENGTH(N'tsaat.spi_definition', N'report_available') IS NULL
  ALTER TABLE [tsaat].[spi_definition] ADD [report_available] BIT NOT NULL CONSTRAINT [DF_spi_definition_report_available] DEFAULT (1);
IF COL_LENGTH(N'tsaat.spi_definition', N'trend_report_available') IS NULL
  ALTER TABLE [tsaat].[spi_definition] ADD [trend_report_available] BIT NOT NULL CONSTRAINT [DF_spi_definition_trend_report_available] DEFAULT (1);
IF COL_LENGTH(N'tsaat.spi_definition', N'report_detail_key') IS NULL
  ALTER TABLE [tsaat].[spi_definition] ADD [report_detail_key] NVARCHAR(100) NOT NULL CONSTRAINT [DF_spi_definition_report_detail_key] DEFAULT (N'standard-asset-annex');

DECLARE @SpiSeed TABLE (
  [spi_id] INT NOT NULL PRIMARY KEY,
  [display_order] INT NOT NULL,
  [name] NVARCHAR(255) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [success_measure] NVARCHAR(1000) NOT NULL,
  [priority_order] INT NOT NULL,
  [default_severity] NVARCHAR(30) NOT NULL,
  [recommended_action] NVARCHAR(MAX) NOT NULL,
  [rule_key] NVARCHAR(100) NOT NULL
);

INSERT INTO @SpiSeed VALUES
(1, 1, N'Operating System Support', N'Operating systems must not be out of vendor support.', N'100% of applicable servers/workstations run vendor-supported OS versions.', 3, N'Major', N'Upgrade or migrate affected operating systems to vendor-supported versions and add lifecycle governance checkpoints.', N'os-support'),
(2, 2, N'Operating System N-2', N'Operating systems must be N-2 or better.', N'100% of applicable servers/workstations are N-2 or better.', 4, N'Moderate', N'Plan staged OS major-version uplift to reach N-2 or better across impacted hosts.', N'os-n-minus'),
(3, 3, N'Server Critical Vulnerability', N'Servers must not have Critical vulnerabilities.', N'0 servers with critical vulnerabilities.', 2, N'Critical Exposure', N'Patch or mitigate critical server vulnerabilities immediately and confirm exploitability posture.', N'server-critical-vulnerability'),
(4, 4, N'Production Server High Risk (Critical + Unsupported OS)', N'High Risk: Production servers must not have Critical vulns with out-of-support OS.', N'0 production servers with critical vulnerabilities on unsupported OS.', 1, N'High Risk', N'Treat as immediate operational risk: isolate or patch production server, remove critical vuln, and uplift unsupported OS.', N'production-server-critical-unsupported-os'),
(5, 5, N'Production Server High Risk (Critical + Unsupported Software)', N'High Risk: Production servers must not have Critical vulns with out-of-support installed software.', N'0 production servers with critical vulnerabilities plus unsupported installed software.', 1, N'High Risk', N'Prioritize production server software remediation: update unsupported software and clear linked critical vulnerabilities.', N'production-server-critical-unsupported-software'),
(6, 6, N'Production Workstation High Risk (Critical + Unsupported Software)', N'High Risk: Production-supporting workstations must not have Critical vulns with out-of-support installed software.', N'0 production-supporting workstations with critical vulnerabilities plus unsupported installed software.', 1, N'High Risk', N'Prioritize production-support workstation software remediation: update unsupported software and clear linked critical vulnerabilities.', N'production-workstation-critical-unsupported-software'),
(7, 7, N'Network Device Critical Vulnerability', N'Network devices must not have Critical vulnerabilities.', N'0 network devices with critical vulnerabilities.', 2, N'Critical Exposure', N'Patch or mitigate critical network-device vulnerabilities and validate rule/ACL hardening.', N'network-device-critical-vulnerability'),
(8, 8, N'Network Device Support', N'Network devices must not have unsupported OS/firmware.', N'100% of network-device OS/firmware versions are supported.', 3, N'Major', N'Upgrade device firmware/OS to supported releases and align with approved baseline catalog.', N'network-device-support'),
(9, 9, N'Network Device Patch Currency', N'Network devices must be on latest patches.', N'100% of network devices on latest patch level.', 6, N'Moderate', N'Bring network devices to latest patch level and enforce maintenance windows with SLA tracking.', N'network-device-patch-currency'),
(10, 10, N'Asset Lifecycle Currency', N'No physical device should be EOL or out of warranty.', N'0 physical devices in EOL or out-of-warranty state.', 7, N'Moderate', N'Replace or renew lifecycle-expired assets (EOL / out-of-warranty) through prioritized capital plan.', N'asset-lifecycle-currency');

IF OBJECT_ID(N'tsaat.spi_rule_definition', N'U') IS NOT NULL
BEGIN
  MERGE [tsaat].[spi_rule_definition] AS target
  USING (VALUES
    (N'os-support', N'os-support', 1, N'Operating System Support Rule', N'Evaluates operating system vendor support status for servers and workstations.', CONVERT(BIT, 1)),
    (N'os-n-minus', N'os-n-minus', 2, N'Operating System N-Minus Rule', N'Evaluates operating system currency against the configured N-minus threshold.', CONVERT(BIT, 1)),
    (N'server-critical-vulnerability', N'server-critical-vulnerability', 3, N'Server Critical Vulnerability Rule', N'Evaluates whether a server has vulnerabilities at the configured severity.', CONVERT(BIT, 1)),
    (N'production-server-critical-unsupported-os', N'production-server-critical-unsupported-os', 4, N'Production Server Critical Unsupported OS Rule', N'Evaluates production servers for the high-risk combination of critical vulnerability and unsupported OS.', CONVERT(BIT, 1)),
    (N'production-server-critical-unsupported-software', N'production-server-critical-unsupported-software', 5, N'Production Server Critical Unsupported Software Rule', N'Evaluates production servers for critical vulnerabilities with unsupported installed software.', CONVERT(BIT, 1)),
    (N'production-workstation-critical-unsupported-software', N'production-workstation-critical-unsupported-software', 6, N'Production Workstation Critical Unsupported Software Rule', N'Evaluates production-supporting workstations for critical vulnerabilities with unsupported installed software.', CONVERT(BIT, 1)),
    (N'network-device-critical-vulnerability', N'network-device-critical-vulnerability', 7, N'Network Device Critical Vulnerability Rule', N'Evaluates whether a network device has vulnerabilities at the configured severity.', CONVERT(BIT, 1)),
    (N'network-device-support', N'network-device-support', 8, N'Network Device Support Rule', N'Evaluates network device OS or firmware vendor support status.', CONVERT(BIT, 1)),
    (N'network-device-patch-currency', N'network-device-patch-currency', 9, N'Network Device Patch Currency Rule', N'Evaluates whether network devices are on the configured current patch state.', CONVERT(BIT, 1)),
    (N'asset-lifecycle-currency', N'asset-lifecycle-currency', 10, N'Asset Lifecycle Currency Rule', N'Evaluates physical asset lifecycle and warranty currency.', CONVERT(BIT, 1))
  ) AS source ([rule_key], [handler_key], [display_order], [name], [description], [enabled])
  ON target.[rule_key] = source.[rule_key]
  WHEN MATCHED THEN
    UPDATE SET
      [handler_key] = source.[handler_key],
      [display_order] = source.[display_order],
      [name] = source.[name],
      [description] = source.[description],
      [enabled] = source.[enabled]
  WHEN NOT MATCHED THEN
    INSERT ([rule_key], [handler_key], [display_order], [name], [description], [enabled])
    VALUES (source.[rule_key], source.[handler_key], source.[display_order], source.[name], source.[description], source.[enabled]);
END;

IF OBJECT_ID(N'tsaat.spi_report_detail_definition', N'U') IS NOT NULL
BEGIN
  MERGE [tsaat].[spi_report_detail_definition] AS target
  USING (VALUES
    (N'standard-asset-annex', N'standard-asset-annex', 1, N'Standard Asset Annex', N'Uses the application-owned standard asset annex renderer for SPI detail reports.', CONVERT(BIT, 1))
  ) AS source ([report_detail_key], [handler_key], [display_order], [name], [description], [enabled])
  ON target.[report_detail_key] = source.[report_detail_key]
  WHEN MATCHED THEN
    UPDATE SET
      [handler_key] = source.[handler_key],
      [display_order] = source.[display_order],
      [name] = source.[name],
      [description] = source.[description],
      [enabled] = source.[enabled]
  WHEN NOT MATCHED THEN
    INSERT ([report_detail_key], [handler_key], [display_order], [name], [description], [enabled])
    VALUES (source.[report_detail_key], source.[handler_key], source.[display_order], source.[name], source.[description], source.[enabled]);
END;

MERGE [tsaat].[spi_definition] AS target
USING @SpiSeed AS source
ON target.[spi_id] = source.[spi_id]
WHEN MATCHED THEN UPDATE SET
  [display_order] = source.[display_order],
  [name] = source.[name],
  [description] = source.[description],
  [success_measure] = source.[success_measure],
  [priority_order] = source.[priority_order],
  [default_severity] = source.[default_severity],
  [recommended_action] = source.[recommended_action],
  [enabled] = 1,
  [rule_key] = source.[rule_key],
  [report_available] = 1,
  [trend_report_available] = 1,
  [report_detail_key] = N'standard-asset-annex'
WHEN NOT MATCHED THEN INSERT
  ([spi_id], [display_order], [name], [description], [success_measure], [priority_order], [default_severity], [recommended_action], [enabled], [rule_key], [report_available], [trend_report_available], [report_detail_key])
  VALUES (source.[spi_id], source.[display_order], source.[name], source.[description], source.[success_measure], source.[priority_order], source.[default_severity], source.[recommended_action], 1, source.[rule_key], 1, 1, N'standard-asset-annex');

IF EXISTS (SELECT 1 FROM [tsaat].[spi_definition] WHERE [display_order] IS NULL OR [default_severity] IS NULL OR [rule_key] IS NULL)
  THROW 51300, 'SPI migration could not populate required SPI metadata for all rows.', 1;

ALTER TABLE [tsaat].[spi_definition] ALTER COLUMN [display_order] INT NOT NULL;
ALTER TABLE [tsaat].[spi_definition] ALTER COLUMN [default_severity] NVARCHAR(30) NOT NULL;
ALTER TABLE [tsaat].[spi_definition] ALTER COLUMN [rule_key] NVARCHAR(100) NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_spi_definition' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_definition'))
  ALTER TABLE [tsaat].[spi_definition] ADD CONSTRAINT [PK_spi_definition] PRIMARY KEY CLUSTERED ([spi_id]);
IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'UQ_spi_definition_display_order' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_definition'))
  ALTER TABLE [tsaat].[spi_definition] ADD CONSTRAINT [UQ_spi_definition_display_order] UNIQUE ([display_order]);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_spi_definition_spi_id' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_definition'))
  ALTER TABLE [tsaat].[spi_definition] ADD CONSTRAINT [CK_spi_definition_spi_id] CHECK ([spi_id] > 0);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_spi_definition_display_order' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_definition'))
  ALTER TABLE [tsaat].[spi_definition] ADD CONSTRAINT [CK_spi_definition_display_order] CHECK ([display_order] > 0);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_spi_definition_rule_key' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_definition'))
  ALTER TABLE [tsaat].[spi_definition] ADD CONSTRAINT [CK_spi_definition_rule_key] CHECK ([rule_key] IN (N'os-support', N'os-n-minus', N'server-critical-vulnerability', N'production-server-critical-unsupported-os', N'production-server-critical-unsupported-software', N'production-workstation-critical-unsupported-software', N'network-device-critical-vulnerability', N'network-device-support', N'network-device-patch-currency', N'asset-lifecycle-currency'));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_spi_definition_report_detail_key' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_definition'))
  ALTER TABLE [tsaat].[spi_definition] ADD CONSTRAINT [CK_spi_definition_report_detail_key] CHECK ([report_detail_key] IN (N'standard-asset-annex'));
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_definition_default_severity' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_definition'))
  ALTER TABLE [tsaat].[spi_definition] ADD CONSTRAINT [FK_spi_definition_default_severity] FOREIGN KEY ([default_severity]) REFERENCES [tsaat].[finding_severity_definition]([severity_key]);

IF OBJECT_ID(N'tsaat.spi_rule_parameter', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[spi_rule_parameter] (
    [spi_id] INT NOT NULL,
    [parameter_key] NVARCHAR(100) NOT NULL,
    [parameter_type] NVARCHAR(20) NOT NULL,
    [parameter_value] NVARCHAR(4000) NOT NULL,
    CONSTRAINT [PK_spi_rule_parameter] PRIMARY KEY CLUSTERED ([spi_id], [parameter_key]),
    CONSTRAINT [FK_spi_rule_parameter_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
    CONSTRAINT [CK_spi_rule_parameter_type] CHECK ([parameter_type] IN (N'string', N'number', N'boolean')),
    CONSTRAINT [CK_spi_rule_parameter_key] CHECK (LEN(LTRIM(RTRIM([parameter_key]))) > 0)
  );
END;

IF OBJECT_ID(N'tsaat.spi_tasking_team', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[spi_tasking_team] (
    [spi_id] INT NOT NULL,
    [display_order] INT NOT NULL,
    [team] NVARCHAR(255) NOT NULL,
    [support_queue] NVARCHAR(100) NOT NULL,
    [contact_email] NVARCHAR(255) NOT NULL,
    CONSTRAINT [PK_spi_tasking_team] PRIMARY KEY CLUSTERED ([spi_id], [display_order]),
    CONSTRAINT [FK_spi_tasking_team_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
    CONSTRAINT [CK_spi_tasking_team_display_order] CHECK ([display_order] > 0)
  );
END;

IF OBJECT_ID(N'tsaat.spi_tasking_action_template', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[spi_tasking_action_template] (
    [spi_id] INT NOT NULL,
    [display_order] INT NOT NULL,
    [condition_key] NVARCHAR(40) NOT NULL,
    [action_text] NVARCHAR(MAX) NOT NULL,
    CONSTRAINT [PK_spi_tasking_action_template] PRIMARY KEY CLUSTERED ([spi_id], [display_order]),
    CONSTRAINT [FK_spi_tasking_action_template_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
    CONSTRAINT [CK_spi_tasking_action_template_display_order] CHECK ([display_order] > 0),
    CONSTRAINT [CK_spi_tasking_action_template_condition] CHECK ([condition_key] IN (N'always', N'when_unknown', N'when_fully_compliant'))
  );
END;

IF OBJECT_ID(N'tsaat.spi_tasking_condition_template', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[spi_tasking_condition_template] (
    [spi_id] INT NOT NULL,
    [condition_key] NVARCHAR(40) NOT NULL,
    [template_text] NVARCHAR(MAX) NOT NULL,
    CONSTRAINT [PK_spi_tasking_condition_template] PRIMARY KEY CLUSTERED ([spi_id], [condition_key]),
    CONSTRAINT [FK_spi_tasking_condition_template_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
    CONSTRAINT [CK_spi_tasking_condition_template_condition] CHECK ([condition_key] IN (N'non_compliant', N'unknown', N'compliant'))
  );
END;

DELETE FROM [tsaat].[spi_rule_parameter] WHERE [spi_id] BETWEEN 1 AND 10;
INSERT INTO [tsaat].[spi_rule_parameter] ([spi_id], [parameter_key], [parameter_type], [parameter_value])
VALUES
(1, N'unsupportedStatus', N'string', N'OutOfSupport'),
(1, N'unknownSupportStatus', N'string', N'Unknown'),
(2, N'maxNMinus', N'number', N'2'),
(3, N'vulnerabilitySeverity', N'string', N'Critical'),
(4, N'environmentType', N'string', N'Production'),
(4, N'vulnerabilitySeverity', N'string', N'Critical'),
(4, N'unsupportedStatus', N'string', N'OutOfSupport'),
(4, N'unknownSupportStatus', N'string', N'Unknown'),
(5, N'environmentType', N'string', N'Production'),
(5, N'vulnerabilitySeverity', N'string', N'Critical'),
(5, N'unsupportedStatus', N'string', N'OutOfSupport'),
(6, N'environmentType', N'string', N'Production'),
(6, N'vulnerabilitySeverity', N'string', N'Critical'),
(6, N'unsupportedStatus', N'string', N'OutOfSupport'),
(7, N'vulnerabilitySeverity', N'string', N'Critical'),
(8, N'unsupportedStatus', N'string', N'OutOfSupport'),
(8, N'unknownSupportStatus', N'string', N'Unknown'),
(9, N'latestPatchRequired', N'boolean', N'true'),
(10, N'endOfLifeStatus', N'string', N'EOL'),
(10, N'inWarrantyStatus', N'string', N'InWarranty'),
(10, N'unknownLifecycleStatus', N'string', N'Unknown');

DELETE FROM [tsaat].[spi_tasking_team] WHERE [spi_id] BETWEEN 1 AND 10;
INSERT INTO [tsaat].[spi_tasking_team] ([spi_id], [display_order], [team], [support_queue], [contact_email])
VALUES
(1, 1, N'Endpoint Platform Team', N'ENDPOINT-OS', N'endpoint.os@defence.local'),
(2, 1, N'Endpoint Platform Team', N'ENDPOINT-LIFECYCLE', N'endpoint.lifecycle@defence.local'),
(3, 1, N'Server Security Operations Team', N'SERVER-SEC', N'server.secops@defence.local'),
(4, 1, N'Production Security Response Team', N'PROD-SERVER-RISK', N'prod.server@defence.local'),
(5, 1, N'Application Sustainment and Security Team', N'APP-SUSTAINMENT-SEC', N'app.sec@defence.local'),
(6, 1, N'Workstation Engineering Team', N'WORKSTATION-PROD', N'workstation.ops@defence.local'),
(7, 1, N'Network Security Engineering Team', N'NETWORK-CRITICAL-VULN', N'network.sec@defence.local'),
(8, 1, N'Network Firmware and Baseline Team', N'NETWORK-FIRMWARE', N'network.firmware@defence.local'),
(9, 1, N'Network Patch and Sustainment Team', N'NETWORK-PATCH', N'network.patch@defence.local'),
(10, 1, N'Asset Lifecycle and Sustainment Team', N'ASSET-LIFECYCLE', N'asset.lifecycle@defence.local'),
(1, 2, N'Cyber Security Operations Centre', N'CSOC-ESCALATION', N'csoc@defence.local'),
(2, 2, N'Cyber Security Operations Centre', N'CSOC-ESCALATION', N'csoc@defence.local'),
(3, 2, N'Cyber Security Operations Centre', N'CSOC-ESCALATION', N'csoc@defence.local'),
(4, 2, N'Cyber Security Operations Centre', N'CSOC-ESCALATION', N'csoc@defence.local'),
(5, 2, N'Cyber Security Operations Centre', N'CSOC-ESCALATION', N'csoc@defence.local'),
(6, 2, N'Cyber Security Operations Centre', N'CSOC-ESCALATION', N'csoc@defence.local'),
(7, 2, N'Cyber Security Operations Centre', N'CSOC-ESCALATION', N'csoc@defence.local'),
(8, 2, N'Cyber Security Operations Centre', N'CSOC-ESCALATION', N'csoc@defence.local'),
(9, 2, N'Cyber Security Operations Centre', N'CSOC-ESCALATION', N'csoc@defence.local'),
(10, 2, N'Cyber Security Operations Centre', N'CSOC-ESCALATION', N'csoc@defence.local');

DELETE FROM [tsaat].[spi_tasking_action_template] WHERE [spi_id] BETWEEN 1 AND 10;
INSERT INTO [tsaat].[spi_tasking_action_template] ([spi_id], [display_order], [condition_key], [action_text])
SELECT [spi_id], 1, N'always', [recommended_action] FROM @SpiSeed
UNION ALL SELECT [spi_id], 2, N'when_unknown', N'Resolve missing evidence fields to remove Unknown outcomes and increase confidence.' FROM @SpiSeed
UNION ALL SELECT [spi_id], 3, N'when_fully_compliant', N'Maintain current control baseline and continue scheduled assurance checks.' FROM @SpiSeed;

DELETE FROM [tsaat].[spi_tasking_condition_template] WHERE [spi_id] BETWEEN 1 AND 10;
INSERT INTO [tsaat].[spi_tasking_condition_template] ([spi_id], [condition_key], [template_text])
SELECT [spi_id], N'non_compliant', N'Detected {nonCompliant} non-compliant evaluation(s) for SPI-{spiId}. Current measured compliance is {scorePercent}% across {total} applicable evaluation(s).' FROM @SpiSeed
UNION ALL SELECT [spi_id], N'unknown', N'SPI-{spiId} has no non-compliant evaluations in scope, but {unknown} unknown evaluation(s) require data-quality remediation.' FROM @SpiSeed
UNION ALL SELECT [spi_id], N'compliant', N'SPI-{spiId} is fully compliant in current scope ({scorePercent}% across {total} evaluations).' FROM @SpiSeed;

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_spi_applicable_asset_type' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_applicable_asset_type'))
  ALTER TABLE [tsaat].[spi_applicable_asset_type] ADD CONSTRAINT [PK_spi_applicable_asset_type] PRIMARY KEY CLUSTERED ([spi_id], [asset_type]);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_applicable_asset_type_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_applicable_asset_type'))
  ALTER TABLE [tsaat].[spi_applicable_asset_type] ADD CONSTRAINT [FK_spi_applicable_asset_type_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]);
IF OBJECT_ID(N'tsaat.measures_severity_matrix', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_measures_severity_matrix' AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_severity_matrix'))
    ALTER TABLE [tsaat].[measures_severity_matrix] ADD CONSTRAINT [PK_measures_severity_matrix] PRIMARY KEY CLUSTERED ([settings_version_id], [spi_id], [asset_type]);
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_measures_severity_matrix_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_severity_matrix'))
    ALTER TABLE [tsaat].[measures_severity_matrix] ADD CONSTRAINT [FK_measures_severity_matrix_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]);
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_measures_severity_matrix_severity' AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_severity_matrix'))
    ALTER TABLE [tsaat].[measures_severity_matrix] ADD CONSTRAINT [FK_measures_severity_matrix_severity] FOREIGN KEY ([severity]) REFERENCES [tsaat].[finding_severity_definition]([severity_key]);
END;
IF OBJECT_ID(N'tsaat.measures_priority_matrix', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_measures_priority_matrix' AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_priority_matrix'))
    ALTER TABLE [tsaat].[measures_priority_matrix] ADD CONSTRAINT [PK_measures_priority_matrix] PRIMARY KEY CLUSTERED ([settings_version_id], [spi_id]);
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_measures_priority_matrix_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.measures_priority_matrix'))
    ALTER TABLE [tsaat].[measures_priority_matrix] ADD CONSTRAINT [FK_measures_priority_matrix_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]);
END;
IF OBJECT_ID(N'tsaat.finding', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_finding_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.finding'))
    ALTER TABLE [tsaat].[finding] ADD CONSTRAINT [FK_finding_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]);
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_finding_severity' AND [parent_object_id] = OBJECT_ID(N'tsaat.finding'))
    ALTER TABLE [tsaat].[finding] ADD CONSTRAINT [FK_finding_severity] FOREIGN KEY ([severity]) REFERENCES [tsaat].[finding_severity_definition]([severity_key]);
END;

IF OBJECT_ID(N'tsaat.spi_rule_parameter', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_rule_parameter_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_rule_parameter'))
    ALTER TABLE [tsaat].[spi_rule_parameter] ADD CONSTRAINT [FK_spi_rule_parameter_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]);
END;
IF OBJECT_ID(N'tsaat.spi_tasking_team', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_tasking_team_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_tasking_team'))
    ALTER TABLE [tsaat].[spi_tasking_team] ADD CONSTRAINT [FK_spi_tasking_team_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]);
END;
IF OBJECT_ID(N'tsaat.spi_tasking_action_template', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_tasking_action_template_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_tasking_action_template'))
    ALTER TABLE [tsaat].[spi_tasking_action_template] ADD CONSTRAINT [FK_spi_tasking_action_template_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]);
END;
IF OBJECT_ID(N'tsaat.spi_tasking_condition_template', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_tasking_condition_template_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_tasking_condition_template'))
    ALTER TABLE [tsaat].[spi_tasking_condition_template] ADD CONSTRAINT [FK_spi_tasking_condition_template_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]);
END;

COMMIT TRANSACTION;
GO
