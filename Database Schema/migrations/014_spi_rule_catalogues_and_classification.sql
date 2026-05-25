SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

IF OBJECT_ID(N'tsaat.spi_rule_definition', N'U') IS NULL
BEGIN
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
END;

IF OBJECT_ID(N'tsaat.spi_rule_parameter_definition', N'U') IS NULL
BEGIN
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
    CONSTRAINT [FK_spi_rule_parameter_definition_rule] FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_rule_definition]([rule_key]),
    CONSTRAINT [CK_spi_rule_parameter_definition_type] CHECK ([parameter_type] IN (N'string', N'number', N'boolean')),
    CONSTRAINT [CK_spi_rule_parameter_definition_key] CHECK (LEN(LTRIM(RTRIM([parameter_key]))) > 0),
    CONSTRAINT [CK_spi_rule_parameter_definition_display_order] CHECK ([display_order] > 0),
    CONSTRAINT [CK_spi_rule_parameter_definition_allowed_json] CHECK ([allowed_values_json] IS NULL OR ISJSON([allowed_values_json]) = 1)
  );
END;

IF OBJECT_ID(N'tsaat.spi_rule_outcome_template', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[spi_rule_outcome_template] (
    [rule_key] NVARCHAR(100) NOT NULL,
    [outcome_key] NVARCHAR(100) NOT NULL,
    [compliance_status] NVARCHAR(20) NOT NULL,
    [reason_template] NVARCHAR(MAX) NOT NULL,
    [evidence_template] NVARCHAR(MAX) NULL,
    CONSTRAINT [PK_spi_rule_outcome_template] PRIMARY KEY CLUSTERED ([rule_key], [outcome_key], [compliance_status]),
    CONSTRAINT [FK_spi_rule_outcome_template_rule] FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_rule_definition]([rule_key]),
    CONSTRAINT [CK_spi_rule_outcome_template_status] CHECK ([compliance_status] IN (N'Compliant', N'Non-compliant', N'Unknown')),
    CONSTRAINT [CK_spi_rule_outcome_template_key] CHECK (LEN(LTRIM(RTRIM([outcome_key]))) > 0)
  );
END;

IF OBJECT_ID(N'tsaat.spi_report_detail_definition', N'U') IS NULL
BEGIN
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
END;

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
  UPDATE SET [handler_key] = source.[handler_key], [display_order] = source.[display_order], [name] = source.[name], [description] = source.[description], [enabled] = source.[enabled]
WHEN NOT MATCHED THEN
  INSERT ([rule_key], [handler_key], [display_order], [name], [description], [enabled])
  VALUES (source.[rule_key], source.[handler_key], source.[display_order], source.[name], source.[description], source.[enabled]);

MERGE [tsaat].[spi_report_detail_definition] AS target
USING (VALUES
  (N'standard-asset-annex', N'standard-asset-annex', 1, N'Standard Asset Annex', N'Uses the application-owned standard asset annex renderer for SPI detail reports.', CONVERT(BIT, 1))
) AS source ([report_detail_key], [handler_key], [display_order], [name], [description], [enabled])
ON target.[report_detail_key] = source.[report_detail_key]
WHEN MATCHED THEN
  UPDATE SET [handler_key] = source.[handler_key], [display_order] = source.[display_order], [name] = source.[name], [description] = source.[description], [enabled] = source.[enabled]
WHEN NOT MATCHED THEN
  INSERT ([report_detail_key], [handler_key], [display_order], [name], [description], [enabled])
  VALUES (source.[report_detail_key], source.[handler_key], source.[display_order], source.[name], source.[description], source.[enabled]);

DELETE FROM [tsaat].[spi_rule_parameter_definition]
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

INSERT INTO [tsaat].[spi_rule_parameter_definition] (
  [rule_key], [parameter_key], [parameter_type], [required], [default_value], [allowed_values_json], [display_order], [description]
)
VALUES
(N'os-support', N'unsupportedStatus', N'string', CONVERT(BIT, 0), N'OutOfSupport', N'["Supported","OutOfSupport","Unknown"]', 1, N'Support status treated as non-compliant.'),
(N'os-support', N'unknownSupportStatus', N'string', CONVERT(BIT, 0), N'Unknown', N'["Unknown"]', 2, N'Support status treated as unknown.'),
(N'os-n-minus', N'maxNMinus', N'number', CONVERT(BIT, 0), N'2', N'[]', 1, N'Maximum compliant N-minus distance.'),
(N'server-critical-vulnerability', N'vulnerabilitySeverity', N'string', CONVERT(BIT, 0), N'Critical', N'["Low","Medium","High","Critical"]', 1, N'Vulnerability severity that triggers non-compliance.'),
(N'production-server-critical-unsupported-os', N'environmentType', N'string', CONVERT(BIT, 0), N'Production', N'["Production","Development","UAT","Test"]', 1, N'System environment type in scope.'),
(N'production-server-critical-unsupported-os', N'vulnerabilitySeverity', N'string', CONVERT(BIT, 0), N'Critical', N'["Low","Medium","High","Critical"]', 2, N'Vulnerability severity that contributes to the high-risk condition.'),
(N'production-server-critical-unsupported-os', N'unsupportedStatus', N'string', CONVERT(BIT, 0), N'OutOfSupport', N'["Supported","OutOfSupport","Unknown"]', 3, N'OS support status that contributes to the high-risk condition.'),
(N'production-server-critical-unsupported-os', N'unknownSupportStatus', N'string', CONVERT(BIT, 0), N'Unknown', N'["Unknown"]', 4, N'OS support status treated as unknown.'),
(N'production-server-critical-unsupported-software', N'environmentType', N'string', CONVERT(BIT, 0), N'Production', N'["Production","Development","UAT","Test"]', 1, N'System environment type in scope.'),
(N'production-server-critical-unsupported-software', N'vulnerabilitySeverity', N'string', CONVERT(BIT, 0), N'Critical', N'["Low","Medium","High","Critical"]', 2, N'Vulnerability severity that contributes to the high-risk condition.'),
(N'production-server-critical-unsupported-software', N'unsupportedStatus', N'string', CONVERT(BIT, 0), N'OutOfSupport', N'["Supported","OutOfSupport","Unknown"]', 3, N'Software support status that contributes to the high-risk condition.'),
(N'production-workstation-critical-unsupported-software', N'environmentType', N'string', CONVERT(BIT, 0), N'Production', N'["Production","Development","UAT","Test"]', 1, N'System environment type in scope.'),
(N'production-workstation-critical-unsupported-software', N'vulnerabilitySeverity', N'string', CONVERT(BIT, 0), N'Critical', N'["Low","Medium","High","Critical"]', 2, N'Vulnerability severity that contributes to the high-risk condition.'),
(N'production-workstation-critical-unsupported-software', N'unsupportedStatus', N'string', CONVERT(BIT, 0), N'OutOfSupport', N'["Supported","OutOfSupport","Unknown"]', 3, N'Software support status that contributes to the high-risk condition.'),
(N'network-device-critical-vulnerability', N'vulnerabilitySeverity', N'string', CONVERT(BIT, 0), N'Critical', N'["Low","Medium","High","Critical"]', 1, N'Vulnerability severity that triggers non-compliance.'),
(N'network-device-support', N'unsupportedStatus', N'string', CONVERT(BIT, 0), N'OutOfSupport', N'["Supported","OutOfSupport","Unknown"]', 1, N'Support status treated as non-compliant.'),
(N'network-device-support', N'unknownSupportStatus', N'string', CONVERT(BIT, 0), N'Unknown', N'["Unknown"]', 2, N'Support status treated as unknown.'),
(N'network-device-patch-currency', N'latestPatchRequired', N'boolean', CONVERT(BIT, 0), N'true', N'["true","false"]', 1, N'Whether latest patch state is required for compliance.'),
(N'asset-lifecycle-currency', N'endOfLifeStatus', N'string', CONVERT(BIT, 0), N'EOL', N'["Supported","EOL","Unknown"]', 1, N'Lifecycle status treated as end-of-life.'),
(N'asset-lifecycle-currency', N'inWarrantyStatus', N'string', CONVERT(BIT, 0), N'InWarranty', N'["InWarranty","OutOfWarranty","Unknown"]', 2, N'Warranty status required for compliance.'),
(N'asset-lifecycle-currency', N'unknownLifecycleStatus', N'string', CONVERT(BIT, 0), N'Unknown', N'["Unknown"]', 3, N'Lifecycle or warranty status treated as unknown.');

DELETE FROM [tsaat].[spi_rule_outcome_template]
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

INSERT INTO [tsaat].[spi_rule_outcome_template] ([rule_key], [outcome_key], [compliance_status], [reason_template], [evidence_template])
VALUES
(N'os-support', N'missing_os_data', N'Unknown', N'Operating system data is missing.', NULL),
(N'os-support', N'unsupported', N'Non-compliant', N'Operating system is out of support.', NULL),
(N'os-support', N'supported', N'Compliant', N'Operating system is vendor supported.', NULL),
(N'os-n-minus', N'missing_n_minus', N'Unknown', N'N-minus metadata is missing.', NULL),
(N'os-n-minus', N'within_n_minus', N'Compliant', N'OS is within N-{maxNMinus} range.', NULL),
(N'os-n-minus', N'older_than_n_minus', N'Non-compliant', N'OS major version is older than N-{maxNMinus}.', NULL),
(N'server-critical-vulnerability', N'critical_vulnerability_present', N'Non-compliant', N'Server has one or more critical vulnerabilities.', NULL),
(N'server-critical-vulnerability', N'no_critical_vulnerability', N'Compliant', N'No critical server vulnerabilities present.', NULL),
(N'production-server-critical-unsupported-os', N'not_production_context', N'Compliant', N'Asset is not in production context.', NULL),
(N'production-server-critical-unsupported-os', N'missing_os_support', N'Unknown', N'Production server OS support status is missing.', NULL),
(N'production-server-critical-unsupported-os', N'triggered', N'Non-compliant', N'High Risk: Production server has critical vulnerability on unsupported OS.', NULL),
(N'production-server-critical-unsupported-os', N'not_triggered', N'Compliant', N'High Risk condition not triggered.', NULL),
(N'production-server-critical-unsupported-software', N'not_production_context', N'Compliant', N'Asset is not in production context.', NULL),
(N'production-server-critical-unsupported-software', N'missing_software', N'Unknown', N'Installed software data is missing.', NULL),
(N'production-server-critical-unsupported-software', N'triggered', N'Non-compliant', N'High Risk: Production server has critical vulnerability and unsupported installed software.', NULL),
(N'production-server-critical-unsupported-software', N'not_triggered', N'Compliant', N'High Risk condition not triggered.', NULL),
(N'production-workstation-critical-unsupported-software', N'not_production_context', N'Compliant', N'Workstation is not in production-support context.', NULL),
(N'production-workstation-critical-unsupported-software', N'missing_software', N'Unknown', N'Installed software data is missing.', NULL),
(N'production-workstation-critical-unsupported-software', N'triggered', N'Non-compliant', N'High Risk: Production-support workstation has critical vulnerability and unsupported installed software.', NULL),
(N'production-workstation-critical-unsupported-software', N'not_triggered', N'Compliant', N'High Risk condition not triggered.', NULL),
(N'network-device-critical-vulnerability', N'critical_vulnerability_present', N'Non-compliant', N'Network device has critical vulnerabilities.', NULL),
(N'network-device-critical-vulnerability', N'no_critical_vulnerability', N'Compliant', N'No critical vulnerabilities found on network device.', NULL),
(N'network-device-support', N'missing_network_os', N'Unknown', N'Network OS/firmware data is missing.', NULL),
(N'network-device-support', N'unsupported', N'Non-compliant', N'Network OS/firmware is out of support.', NULL),
(N'network-device-support', N'supported', N'Compliant', N'Network OS/firmware is vendor supported.', NULL),
(N'network-device-patch-currency', N'missing_patch_state', N'Unknown', N'Patch state is missing.', NULL),
(N'network-device-patch-currency', N'current', N'Compliant', N'Network device patch level is current.', NULL),
(N'network-device-patch-currency', N'not_current', N'Non-compliant', N'Network device is not on latest patch level.', NULL),
(N'asset-lifecycle-currency', N'missing_lifecycle', N'Unknown', N'Lifecycle data is incomplete.', NULL),
(N'asset-lifecycle-currency', N'current', N'Compliant', N'Lifecycle and warranty are within policy.', NULL),
(N'asset-lifecycle-currency', N'expired', N'Non-compliant', N'Device is EOL or out of warranty.', NULL);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_spi_definition_rule_key' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_definition'))
  ALTER TABLE [tsaat].[spi_definition] DROP CONSTRAINT [CK_spi_definition_rule_key];

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_spi_definition_report_detail_key' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_definition'))
  ALTER TABLE [tsaat].[spi_definition] DROP CONSTRAINT [CK_spi_definition_report_detail_key];

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_definition_rule' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_definition'))
  ALTER TABLE [tsaat].[spi_definition] WITH CHECK ADD CONSTRAINT [FK_spi_definition_rule] FOREIGN KEY ([rule_key]) REFERENCES [tsaat].[spi_rule_definition]([rule_key]);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_definition_report_detail' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_definition'))
  ALTER TABLE [tsaat].[spi_definition] WITH CHECK ADD CONSTRAINT [FK_spi_definition_report_detail] FOREIGN KEY ([report_detail_key]) REFERENCES [tsaat].[spi_report_detail_definition]([report_detail_key]);

IF OBJECT_ID(N'tsaat.spi_finding_classification_rule', N'U') IS NULL
BEGIN
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
    CONSTRAINT [FK_spi_finding_classification_rule_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
    CONSTRAINT [FK_spi_finding_classification_rule_severity] FOREIGN KEY ([severity_key]) REFERENCES [tsaat].[finding_severity_definition]([severity_key]),
    CONSTRAINT [CK_spi_finding_classification_rule_display_order] CHECK ([display_order] > 0),
    CONSTRAINT [CK_spi_finding_classification_rule_priority] CHECK ([priority_rank] IS NULL OR [priority_rank] > 0),
    CONSTRAINT [CK_spi_finding_classification_rule_status] CHECK ([compliance_status] IS NULL OR [compliance_status] IN (N'Compliant', N'Non-compliant', N'Unknown')),
    CONSTRAINT [CK_spi_finding_classification_rule_condition] CHECK ([condition_key] IN (N'always', N'when_unknown', N'when_non_compliant', N'when_production_critical_asset', N'when_not_production_critical_asset')),
    CONSTRAINT [CK_spi_finding_classification_rule_key] CHECK (LEN(LTRIM(RTRIM([classification_rule_id]))) > 0)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_finding_classification_rule_spi' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_finding_classification_rule'))
  ALTER TABLE [tsaat].[spi_finding_classification_rule] WITH CHECK ADD CONSTRAINT [FK_spi_finding_classification_rule_spi] FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_spi_finding_classification_rule_severity' AND [parent_object_id] = OBJECT_ID(N'tsaat.spi_finding_classification_rule'))
  ALTER TABLE [tsaat].[spi_finding_classification_rule] WITH CHECK ADD CONSTRAINT [FK_spi_finding_classification_rule_severity] FOREIGN KEY ([severity_key]) REFERENCES [tsaat].[finding_severity_definition]([severity_key]);

IF OBJECT_ID(N'tsaat.finding_priority_definition', N'U') IS NOT NULL
BEGIN
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
END;

MERGE [tsaat].[spi_finding_classification_rule] AS target
USING (VALUES
  (N'unknown-data-gap', 1, CONVERT(BIT, 1), NULL, N'Unknown', N'when_unknown', N'Data Gap', 90, N'Unknown SPI outcomes generate Data Gap findings.'),
  (N'spi4-high-risk', 10, CONVERT(BIT, 1), 4, N'Non-compliant', N'when_non_compliant', N'High Risk', 1, N'SPI-4 non-compliance is High Risk priority 1.'),
  (N'spi5-high-risk', 11, CONVERT(BIT, 1), 5, N'Non-compliant', N'when_non_compliant', N'High Risk', 1, N'SPI-5 non-compliance is High Risk priority 1.'),
  (N'spi6-high-risk', 12, CONVERT(BIT, 1), 6, N'Non-compliant', N'when_non_compliant', N'High Risk', 1, N'SPI-6 non-compliance is High Risk priority 1.'),
  (N'spi3-critical-exposure-production', 20, CONVERT(BIT, 1), 3, N'Non-compliant', N'when_production_critical_asset', N'Critical Exposure', 2, N'SPI-3 production-critical non-compliance is Critical Exposure priority 2.'),
  (N'spi7-critical-exposure-production', 21, CONVERT(BIT, 1), 7, N'Non-compliant', N'when_production_critical_asset', N'Critical Exposure', 2, N'SPI-7 production-critical non-compliance is Critical Exposure priority 2.'),
  (N'spi3-major-non-production', 22, CONVERT(BIT, 1), 3, N'Non-compliant', N'when_not_production_critical_asset', N'Major', 2, N'SPI-3 non-production-critical non-compliance is Major priority 2.'),
  (N'spi7-major-non-production', 23, CONVERT(BIT, 1), 7, N'Non-compliant', N'when_not_production_critical_asset', N'Major', 2, N'SPI-7 non-production-critical non-compliance is Major priority 2.'),
  (N'spi1-major', 30, CONVERT(BIT, 1), 1, N'Non-compliant', N'when_non_compliant', N'Major', 3, N'SPI-1 non-compliance is Major priority 3.'),
  (N'spi8-major', 31, CONVERT(BIT, 1), 8, N'Non-compliant', N'when_non_compliant', N'Major', 3, N'SPI-8 non-compliance is Major priority 3.'),
  (N'spi2-moderate', 40, CONVERT(BIT, 1), 2, N'Non-compliant', N'when_non_compliant', N'Moderate', 4, N'SPI-2 non-compliance is Moderate priority 4.'),
  (N'spi9-moderate', 60, CONVERT(BIT, 1), 9, N'Non-compliant', N'when_non_compliant', N'Moderate', 6, N'SPI-9 non-compliance is Moderate priority 6.'),
  (N'spi10-moderate', 70, CONVERT(BIT, 1), 10, N'Non-compliant', N'when_non_compliant', N'Moderate', 7, N'SPI-10 non-compliance is Moderate priority 7.')
) AS source ([classification_rule_id], [display_order], [enabled], [spi_id], [compliance_status], [condition_key], [severity_key], [priority_rank], [description])
ON target.[classification_rule_id] = source.[classification_rule_id]
WHEN MATCHED THEN
  UPDATE SET
    [display_order] = source.[display_order],
    [enabled] = source.[enabled],
    [spi_id] = source.[spi_id],
    [compliance_status] = source.[compliance_status],
    [condition_key] = source.[condition_key],
    [severity_key] = source.[severity_key],
    [priority_rank] = source.[priority_rank],
    [description] = source.[description]
WHEN NOT MATCHED THEN
  INSERT ([classification_rule_id], [display_order], [enabled], [spi_id], [compliance_status], [condition_key], [severity_key], [priority_rank], [description])
  VALUES (source.[classification_rule_id], source.[display_order], source.[enabled], source.[spi_id], source.[compliance_status], source.[condition_key], source.[severity_key], source.[priority_rank], source.[description]);

COMMIT TRANSACTION;
GO
