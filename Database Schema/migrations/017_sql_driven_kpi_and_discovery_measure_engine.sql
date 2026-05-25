SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;
GO

IF OBJECT_ID(N'tsaat.discovery_coverage_source', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[discovery_coverage_source] (
    [source_key] NVARCHAR(100) NOT NULL,
    [source_object_name] NVARCHAR(255) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [enabled] BIT NOT NULL CONSTRAINT [DF_discovery_coverage_source_enabled] DEFAULT (1),
    CONSTRAINT [PK_discovery_coverage_source] PRIMARY KEY CLUSTERED ([source_key]),
    CONSTRAINT [CK_discovery_coverage_source_key] CHECK (LEN(LTRIM(RTRIM([source_key]))) > 0)
  );
END;
GO

IF OBJECT_ID(N'tsaat.discovery_tool_detection_definition', N'U') IS NULL
BEGIN
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
END;
GO

IF OBJECT_ID(N'tsaat.discovery_tool_detection_rule', N'U') IS NULL
BEGIN
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
END;
GO

IF OBJECT_ID(N'tsaat.discovery_tool_detection_rule_value', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[discovery_tool_detection_rule_value] (
    [detection_rule_id] BIGINT NOT NULL,
    [value_order] INT NOT NULL,
    [value_text] NVARCHAR(255) NOT NULL,
    CONSTRAINT [PK_discovery_tool_detection_rule_value] PRIMARY KEY CLUSTERED ([detection_rule_id], [value_order]),
    CONSTRAINT [FK_discovery_tool_detection_rule_value_rule]
      FOREIGN KEY ([detection_rule_id]) REFERENCES [tsaat].[discovery_tool_detection_rule]([detection_rule_id]),
    CONSTRAINT [CK_discovery_tool_detection_rule_value_order] CHECK ([value_order] > 0)
  );
END;
GO

IF OBJECT_ID(N'tsaat.kpi_calculation_source', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[kpi_calculation_source] (
    [source_key] NVARCHAR(100) NOT NULL,
    [source_object_name] NVARCHAR(255) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [enabled] BIT NOT NULL CONSTRAINT [DF_kpi_calculation_source_enabled] DEFAULT (1),
    CONSTRAINT [PK_kpi_calculation_source] PRIMARY KEY CLUSTERED ([source_key]),
    CONSTRAINT [CK_kpi_calculation_source_key] CHECK (LEN(LTRIM(RTRIM([source_key]))) > 0)
  );
END;
GO

IF OBJECT_ID(N'tsaat.kpi_calculation_definition', N'U') IS NULL
BEGIN
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
END;
GO

IF OBJECT_ID(N'tsaat.kpi_calculation_parameter', N'U') IS NULL
BEGIN
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
END;
GO

IF COL_LENGTH(N'tsaat.kpi_definition', N'enabled') IS NULL
BEGIN
  ALTER TABLE [tsaat].[kpi_definition]
    ADD [enabled] BIT NOT NULL CONSTRAINT [DF_kpi_definition_enabled] DEFAULT (1);
END;
GO

MERGE [tsaat].[kpi_calculation_source] AS target
USING (VALUES
  (N'kpi-snapshot-scope-context', N'[tsaat].[usp_evaluate_kpi_snapshot] scoped SQL context', N'Approved SQL context combining selected assets, systems, networks, SPI evaluations, effective findings, and discovery coverage rows.', CAST(1 AS BIT))
) AS source ([source_key], [source_object_name], [description], [enabled])
ON target.[source_key] = source.[source_key]
WHEN MATCHED THEN UPDATE SET
  [source_object_name] = source.[source_object_name],
  [description] = source.[description],
  [enabled] = source.[enabled]
WHEN NOT MATCHED BY TARGET THEN
  INSERT ([source_key], [source_object_name], [description], [enabled])
  VALUES (source.[source_key], source.[source_object_name], source.[description], source.[enabled]);
GO

MERGE [tsaat].[kpi_calculation_definition] AS target
USING (VALUES
  (N'overall-spi-compliance', N'kpi-snapshot-scope-context', 1, N'Overall SPI Compliance', N'Compliant SPI evaluations divided by all applicable SPI evaluations.', CAST(1 AS BIT)),
  (N'protected-domain-compliance', N'kpi-snapshot-scope-context', 2, N'Protected Domain Compliance', N'Compliant SPI evaluations for Protected-domain assets divided by all applicable Protected-domain SPI evaluations.', CAST(1 AS BIT)),
  (N'secret-domain-compliance', N'kpi-snapshot-scope-context', 3, N'Secret Domain Compliance', N'Compliant SPI evaluations for Secret-domain assets divided by all applicable Secret-domain SPI evaluations.', CAST(1 AS BIT)),
  (N'critical-ict-system-compliance', N'kpi-snapshot-scope-context', 4, N'Critical ICT System Compliance', N'Compliant SPI evaluations for assets belonging to Critical ICT systems divided by all applicable Critical-system SPI evaluations.', CAST(1 AS BIT)),
  (N'critical-exposure-in-production', N'kpi-snapshot-scope-context', 5, N'Critical Exposure in Production', N'Count of Critical Exposure findings with score percent derived from non-critical-exposure findings over all findings.', CAST(1 AS BIT)),
  (N'discovery-coverage-compliance', N'kpi-snapshot-scope-context', 6, N'Discovery Coverage Compliance', N'Discovery-compliant assets divided by all scoped assets with discovery coverage rows.', CAST(1 AS BIT)),
  (N'active-ato-coverage', N'kpi-snapshot-scope-context', 7, N'Active ATO Coverage', N'Scoped ICT systems passing the seeded deterministic ATO proxy divided by scoped ICT systems.', CAST(1 AS BIT)),
  (N'diis-registration-coverage', N'kpi-snapshot-scope-context', 8, N'DIIS Registration Coverage', N'Scoped ICT systems passing the seeded deterministic DIIS registration proxy divided by scoped ICT systems.', CAST(1 AS BIT)),
  (N'diis-modelled-coverage', N'kpi-snapshot-scope-context', 9, N'DIIS Modelled Coverage', N'DIIS-defined scoped ICT systems with modelling enabled divided by DIIS-defined scoped ICT systems.', CAST(1 AS BIT)),
  (N'network-discovery-enablement', N'kpi-snapshot-scope-context', 10, N'Network Discovery Enablement', N'Scoped networks marked Discovery Enabled divided by scoped networks.', CAST(1 AS BIT))
) AS source ([calculation_key], [source_key], [display_order], [name], [description], [enabled])
ON target.[calculation_key] = source.[calculation_key]
WHEN MATCHED THEN UPDATE SET
  [source_key] = source.[source_key],
  [display_order] = source.[display_order],
  [name] = source.[name],
  [description] = source.[description],
  [enabled] = source.[enabled]
WHEN NOT MATCHED BY TARGET THEN
  INSERT ([calculation_key], [source_key], [display_order], [name], [description], [enabled])
  VALUES (source.[calculation_key], source.[source_key], source.[display_order], source.[name], source.[description], source.[enabled]);
GO

MERGE [tsaat].[kpi_calculation_parameter] AS target
USING (VALUES
  (N'critical-exposure-in-production', N'critical_severity', N'string', N'Critical Exposure'),
  (N'overall-spi-compliance', N'high_priority_threshold', N'number', N'2'),
  (N'discovery-coverage-compliance', N'high_priority_threshold', N'number', N'2'),
  (N'active-ato-coverage', N'hash_suffix', N'string', N':ato'),
  (N'diis-registration-coverage', N'hash_suffix', N'string', N':diis')
) AS source ([calculation_key], [parameter_key], [parameter_type], [parameter_value])
ON target.[calculation_key] = source.[calculation_key]
  AND target.[parameter_key] = source.[parameter_key]
WHEN MATCHED THEN UPDATE SET
  [parameter_type] = source.[parameter_type],
  [parameter_value] = source.[parameter_value]
WHEN NOT MATCHED BY TARGET THEN
  INSERT ([calculation_key], [parameter_key], [parameter_type], [parameter_value])
  VALUES (source.[calculation_key], source.[parameter_key], source.[parameter_type], source.[parameter_value]);
GO

IF EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE [name] = N'CK_kpi_definition_calculation_key'
    AND [parent_object_id] = OBJECT_ID(N'tsaat.kpi_definition', N'U')
)
BEGIN
  ALTER TABLE [tsaat].[kpi_definition] DROP CONSTRAINT [CK_kpi_definition_calculation_key];
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE [name] = N'FK_kpi_definition_calculation_definition'
    AND [parent_object_id] = OBJECT_ID(N'tsaat.kpi_definition', N'U')
)
BEGIN
  ALTER TABLE [tsaat].[kpi_definition]
    ADD CONSTRAINT [FK_kpi_definition_calculation_definition]
      FOREIGN KEY ([calculation_key]) REFERENCES [tsaat].[kpi_calculation_definition]([calculation_key]);
END;
GO

IF OBJECT_ID(N'tsaat.kpi_report_detail_definition', N'U') IS NULL
BEGIN
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
END;
GO

IF OBJECT_ID(N'tsaat.kpi_report_detail_binding', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[kpi_report_detail_binding] (
    [kpi_id] NVARCHAR(40) NOT NULL,
    [report_detail_key] NVARCHAR(100) NOT NULL,
    CONSTRAINT [PK_kpi_report_detail_binding] PRIMARY KEY CLUSTERED ([kpi_id]),
    CONSTRAINT [FK_kpi_report_detail_binding_kpi]
      FOREIGN KEY ([kpi_id]) REFERENCES [tsaat].[kpi_definition]([kpi_id]),
    CONSTRAINT [FK_kpi_report_detail_binding_detail]
      FOREIGN KEY ([report_detail_key]) REFERENCES [tsaat].[kpi_report_detail_definition]([report_detail_key])
  );
END;
GO

IF OBJECT_ID(N'tsaat.kpi_tasking_team', N'U') IS NULL
BEGIN
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
END;
GO

IF OBJECT_ID(N'tsaat.kpi_tasking_action_template', N'U') IS NULL
BEGIN
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
END;
GO

IF OBJECT_ID(N'tsaat.kpi_tasking_condition_template', N'U') IS NULL
BEGIN
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
END;
GO

MERGE [tsaat].[discovery_coverage_source] AS target
USING (VALUES
  (N'asset-discovery-coverage-context', N'[tsaat].[asset] + discovery settings + asset evidence tables', N'Approved SQL context for discovery coverage evaluation over asset, system, lifecycle, vulnerability, and latest discovery tool settings facts.', CAST(1 AS BIT))
) AS source ([source_key], [source_object_name], [description], [enabled])
ON target.[source_key] = source.[source_key]
WHEN MATCHED THEN UPDATE SET [source_object_name] = source.[source_object_name], [description] = source.[description], [enabled] = source.[enabled]
WHEN NOT MATCHED BY TARGET THEN INSERT ([source_key], [source_object_name], [description], [enabled]) VALUES (source.[source_key], source.[source_object_name], source.[description], source.[enabled]);
GO

MERGE [tsaat].[discovery_tool_detection_definition] AS target
USING (VALUES
  (N'ucmdb', 1, N'UCMDB', N'Asset has an ICT system context.', CAST(1 AS BIT)),
  (N'tanium', 2, N'Tanium', N'Server and workstation assets are visible to endpoint tooling.', CAST(1 AS BIT)),
  (N'tenable', 3, N'Tenable', N'Asset has vulnerability evidence from a supported scanner source.', CAST(1 AS BIT)),
  (N'snow', 4, N'SNOW', N'Asset has known warranty lifecycle evidence.', CAST(1 AS BIT)),
  (N'servicenow', 5, N'ServiceNow', N'Asset has known end-of-life lifecycle evidence.', CAST(1 AS BIT)),
  (N'dsoc-siem', 6, N'DSOC SIEM', N'Asset has vulnerability/security telemetry evidence.', CAST(1 AS BIT)),
  (N'elastic', 7, N'Elastic', N'Server and workstation assets are visible to telemetry indexing.', CAST(1 AS BIT))
) AS source ([tool_id], [display_order], [name], [description], [enabled])
ON target.[tool_id] = source.[tool_id]
WHEN MATCHED THEN UPDATE SET [display_order] = source.[display_order], [name] = source.[name], [description] = source.[description], [enabled] = source.[enabled]
WHEN NOT MATCHED BY TARGET THEN INSERT ([tool_id], [display_order], [name], [description], [enabled]) VALUES (source.[tool_id], source.[display_order], source.[name], source.[description], source.[enabled]);
GO

DECLARE @DetectionRules TABLE (
  [tool_id] NVARCHAR(255) NOT NULL,
  [display_order] INT NOT NULL,
  [condition_key] NVARCHAR(80) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  [enabled] BIT NOT NULL
);
INSERT INTO @DetectionRules VALUES
  (N'ucmdb', 1, N'has-system-context', N'Covered when the asset is associated with an ICT system.', 1),
  (N'tanium', 1, N'asset-type-in', N'Covered for server and workstation assets.', 1),
  (N'tenable', 1, N'vulnerability-source-in', N'Covered when a supported vulnerability scanner source is present.', 1),
  (N'snow', 1, N'warranty-status-known', N'Covered when warranty status is known.', 1),
  (N'servicenow', 1, N'eol-status-known', N'Covered when EOL status is known.', 1),
  (N'dsoc-siem', 1, N'has-vulnerability', N'Covered when any vulnerability/security telemetry exists.', 1),
  (N'elastic', 1, N'asset-type-in', N'Covered for server and workstation assets.', 1);

MERGE [tsaat].[discovery_tool_detection_rule] AS target
USING @DetectionRules AS source
ON target.[tool_id] = source.[tool_id] AND target.[display_order] = source.[display_order]
WHEN MATCHED THEN UPDATE SET [condition_key] = source.[condition_key], [description] = source.[description], [enabled] = source.[enabled]
WHEN NOT MATCHED BY TARGET THEN INSERT ([tool_id], [display_order], [condition_key], [description], [enabled]) VALUES (source.[tool_id], source.[display_order], source.[condition_key], source.[description], source.[enabled]);

DECLARE @RuleValues TABLE ([tool_id] NVARCHAR(255) NOT NULL, [display_order] INT NOT NULL, [value_order] INT NOT NULL, [value_text] NVARCHAR(255) NOT NULL);
INSERT INTO @RuleValues VALUES
  (N'tanium', 1, 1, N'server'),
  (N'tanium', 1, 2, N'workstation'),
  (N'tenable', 1, 1, N'Nessus'),
  (N'tenable', 1, 2, N'Qualys'),
  (N'tenable', 1, 3, N'OpenVAS'),
  (N'elastic', 1, 1, N'server'),
  (N'elastic', 1, 2, N'workstation');

DELETE rv
FROM [tsaat].[discovery_tool_detection_rule_value] AS rv
INNER JOIN [tsaat].[discovery_tool_detection_rule] AS dtr ON dtr.[detection_rule_id] = rv.[detection_rule_id]
WHERE EXISTS (SELECT 1 FROM @RuleValues AS seeded WHERE seeded.[tool_id] = dtr.[tool_id] AND seeded.[display_order] = dtr.[display_order]);

INSERT INTO [tsaat].[discovery_tool_detection_rule_value] ([detection_rule_id], [value_order], [value_text])
SELECT dtr.[detection_rule_id], rv.[value_order], rv.[value_text]
FROM @RuleValues AS rv
INNER JOIN [tsaat].[discovery_tool_detection_rule] AS dtr
  ON dtr.[tool_id] = rv.[tool_id] AND dtr.[display_order] = rv.[display_order];
GO

MERGE [tsaat].[kpi_report_detail_definition] AS target
USING (VALUES
  (N'generic-kpi-summary', N'generic-kpi-summary', 1, N'Generic KPI Summary', N'Default KPI tasking report detail section.', CAST(1 AS BIT)),
  (N'critical-system-threshold', N'critical-system-threshold', 2, N'Critical ICT Systems at Threshold', N'Lists critical ICT systems at or below the configured compliance threshold.', CAST(1 AS BIT)),
  (N'critical-exposure-assets', N'critical-exposure-assets', 3, N'Critical Exposure Assets', N'Lists assets with Critical Exposure findings.', CAST(1 AS BIT)),
  (N'unmodelled-diis-systems', N'unmodelled-diis-systems', 4, N'Unmodelled DIIS Systems', N'Lists DIIS-defined ICT systems without modelling enabled.', CAST(1 AS BIT))
) AS source ([report_detail_key], [handler_key], [display_order], [name], [description], [enabled])
ON target.[report_detail_key] = source.[report_detail_key]
WHEN MATCHED THEN UPDATE SET [handler_key] = source.[handler_key], [display_order] = source.[display_order], [name] = source.[name], [description] = source.[description], [enabled] = source.[enabled]
WHEN NOT MATCHED BY TARGET THEN INSERT ([report_detail_key], [handler_key], [display_order], [name], [description], [enabled]) VALUES (source.[report_detail_key], source.[handler_key], source.[display_order], source.[name], source.[description], source.[enabled]);
GO

MERGE [tsaat].[kpi_report_detail_binding] AS target
USING (VALUES
  (N'KPI-4', N'critical-system-threshold'),
  (N'KPI-5', N'critical-exposure-assets'),
  (N'KPI-6', N'generic-kpi-summary'),
  (N'KPI-7', N'generic-kpi-summary'),
  (N'KPI-8', N'generic-kpi-summary'),
  (N'KPI-9', N'unmodelled-diis-systems'),
  (N'KPI-10', N'generic-kpi-summary')
) AS source ([kpi_id], [report_detail_key])
ON target.[kpi_id] = source.[kpi_id]
WHEN MATCHED THEN UPDATE SET [report_detail_key] = source.[report_detail_key]
WHEN NOT MATCHED BY TARGET THEN INSERT ([kpi_id], [report_detail_key]) VALUES (source.[kpi_id], source.[report_detail_key]);
GO

DECLARE @KpiTeams TABLE ([kpi_id] NVARCHAR(40), [display_order] INT, [team] NVARCHAR(255), [support_queue] NVARCHAR(100), [contact_email] NVARCHAR(255));
INSERT INTO @KpiTeams VALUES
  (N'KPI-1', 1, N'Cyber Governance and Assurance Team', N'CGA-POSTURE', N'cga.posture@defence.local'),
  (N'KPI-2', 1, N'Vulnerability Operations Team', N'CYBER-VULN-OPS', N'vuln.ops@defence.local'),
  (N'KPI-3', 1, N'Data Quality and Asset Intelligence Team', N'CYBER-DATA-QUALITY', N'asset.data@defence.local'),
  (N'KPI-4', 1, N'Production Security Response Team', N'CYBER-PROD-RESP', N'prod.response@defence.local'),
  (N'KPI-5', 1, N'Critical Exposure Response Cell', N'CYBER-CRIT-EXPOSURE', N'crit.exposure@defence.local'),
  (N'KPI-6', 1, N'Joint Cyber Operations Tasking Team', N'CYBER-TASKING', N'tasking.ops@defence.local'),
  (N'KPI-7', 1, N'ICT Governance and Accreditation Team', N'ICT-ATO-GOV', N'ato.governance@defence.local'),
  (N'KPI-8', 1, N'ICT Registry and Integration Team', N'ICT-DIIS-REG', N'diis.registry@defence.local'),
  (N'KPI-9', 1, N'ICT Modelling and Architecture Team', N'ICT-MODELLING', N'ict.modelling@defence.local'),
  (N'KPI-10', 1, N'Network Discovery Operations Team', N'NETWORK-DISCOVERY', N'network.discovery@defence.local'),
  (N'KPI-1', 90, N'Cyber Governance and Assurance Team', N'CGA-ASSURANCE', N'cga.assurance@defence.local'),
  (N'KPI-2', 90, N'Cyber Governance and Assurance Team', N'CGA-ASSURANCE', N'cga.assurance@defence.local'),
  (N'KPI-3', 90, N'Cyber Governance and Assurance Team', N'CGA-ASSURANCE', N'cga.assurance@defence.local'),
  (N'KPI-4', 90, N'Cyber Governance and Assurance Team', N'CGA-ASSURANCE', N'cga.assurance@defence.local'),
  (N'KPI-5', 90, N'Cyber Governance and Assurance Team', N'CGA-ASSURANCE', N'cga.assurance@defence.local'),
  (N'KPI-6', 90, N'Cyber Governance and Assurance Team', N'CGA-ASSURANCE', N'cga.assurance@defence.local'),
  (N'KPI-7', 90, N'Cyber Governance and Assurance Team', N'CGA-ASSURANCE', N'cga.assurance@defence.local'),
  (N'KPI-8', 90, N'Cyber Governance and Assurance Team', N'CGA-ASSURANCE', N'cga.assurance@defence.local'),
  (N'KPI-9', 90, N'Cyber Governance and Assurance Team', N'CGA-ASSURANCE', N'cga.assurance@defence.local'),
  (N'KPI-10', 90, N'Cyber Governance and Assurance Team', N'CGA-ASSURANCE', N'cga.assurance@defence.local');
MERGE [tsaat].[kpi_tasking_team] AS target
USING @KpiTeams AS source
ON target.[kpi_id] = source.[kpi_id] AND target.[display_order] = source.[display_order]
WHEN MATCHED THEN UPDATE SET [team] = source.[team], [support_queue] = source.[support_queue], [contact_email] = source.[contact_email]
WHEN NOT MATCHED BY TARGET THEN INSERT ([kpi_id], [display_order], [team], [support_queue], [contact_email]) VALUES (source.[kpi_id], source.[display_order], source.[team], source.[support_queue], source.[contact_email]);
GO

DECLARE @KpiActions TABLE ([kpi_id] NVARCHAR(40), [display_order] INT, [condition_key] NVARCHAR(40), [action_text] NVARCHAR(MAX));
INSERT INTO @KpiActions VALUES
  (N'KPI-1', 1, N'always', N'Prioritize recovery of non-compliant SPI domains with strongest operational impact.'),
  (N'KPI-1', 2, N'always', N'Set two-week checkpoint for compliance uplift verification.'),
  (N'KPI-2', 1, N'always', N'Open remediation tasks for all failing SPI checks and assign accountable owner.'),
  (N'KPI-2', 2, N'always', N'Track closure rate weekly until backlog reaches target.'),
  (N'KPI-3', 1, N'always', N'Resolve unknown data fields in asset, lifecycle, and patch records.'),
  (N'KPI-3', 2, N'always', N'Implement data completeness guardrails in ingestion workflow.'),
  (N'KPI-4', 1, N'always', N'Trigger immediate high-risk production mitigation workflow.'),
  (N'KPI-4', 2, N'always', N'Require executive escalation for unresolved high-risk items older than 48 hours.'),
  (N'KPI-5', 1, N'always', N'Contain and remediate all production critical-exposure assets.'),
  (N'KPI-5', 2, N'always', N'Validate compensating controls where immediate patching is not feasible.'),
  (N'KPI-6', 1, N'always', N'Re-balance operations workload to close priority 1-2 items first.'),
  (N'KPI-6', 2, N'always', N'Run daily command stand-up until immediate backlog returns to target.'),
  (N'KPI-7', 1, N'always', N'Validate ATO currency for non-compliant ICT systems and initiate renewal workflows.'),
  (N'KPI-7', 2, N'always', N'Escalate expired or missing ATO records to ICT governance authority.'),
  (N'KPI-8', 1, N'always', N'Register all non-compliant ICT systems within DIIS and verify metadata completeness.'),
  (N'KPI-8', 2, N'always', N'Set weekly reconciliation between ICT system inventory and DIIS register.'),
  (N'KPI-9', 1, N'always', N'Prioritize DIIS systems with no model and assign modelling owners.'),
  (N'KPI-9', 2, N'always', N'Track modelling completion weekly until DIIS model coverage reaches target.'),
  (N'KPI-10', 1, N'always', N'Enable discovery on all defined networks currently marked Discovery Non Enabled.'),
  (N'KPI-10', 2, N'always', N'Apply weekly validation against network inventory to keep discovery status current.');
MERGE [tsaat].[kpi_tasking_action_template] AS target
USING @KpiActions AS source
ON target.[kpi_id] = source.[kpi_id] AND target.[display_order] = source.[display_order]
WHEN MATCHED THEN UPDATE SET [condition_key] = source.[condition_key], [action_text] = source.[action_text]
WHEN NOT MATCHED BY TARGET THEN INSERT ([kpi_id], [display_order], [condition_key], [action_text]) VALUES (source.[kpi_id], source.[display_order], source.[condition_key], source.[action_text]);
GO

MERGE [tsaat].[kpi_tasking_condition_template] AS target
USING (
  SELECT kd.[kpi_id], conditions.[condition_key], conditions.[template_text]
  FROM [tsaat].[kpi_definition] AS kd
  CROSS JOIN (VALUES
    (N'non_compliant', N'Detected {nonCompliantCount} non-compliant measure item(s) for {kpiId}. This indicates current posture is below target threshold and requires directed remediation.'),
    (N'unknown', N'No non-compliance detected for {kpiId}, however {unknownCount} data-gap item(s) limit confidence in full compliance assessment.'),
    (N'compliant', N'{kpiId} is currently within target in this filter scope with no detected non-compliant condition.')
  ) AS conditions ([condition_key], [template_text])
) AS source
ON target.[kpi_id] = source.[kpi_id] AND target.[condition_key] = source.[condition_key]
WHEN MATCHED THEN UPDATE SET [template_text] = source.[template_text]
WHEN NOT MATCHED BY TARGET THEN INSERT ([kpi_id], [condition_key], [template_text]) VALUES (source.[kpi_id], source.[condition_key], source.[template_text]);
GO

COMMIT TRANSACTION;
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
    END AS [coverage_value]
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

  IF @hasAssetScope = 1
    INSERT INTO @AssetScope SELECT DISTINCT CONVERT(NVARCHAR(255), [value]) FROM OPENJSON(@asset_ids_json) WHERE [type] IN (1, 2);
  IF @hasSystemScope = 1
    INSERT INTO @SystemScope SELECT DISTINCT CONVERT(NVARCHAR(255), [value]) FROM OPENJSON(@system_ids_json) WHERE [type] IN (1, 2);
  IF @hasNetworkScope = 1
    INSERT INTO @NetworkScope SELECT DISTINCT CONVERT(NVARCHAR(255), [value]) FROM OPENJSON(@network_ids_json) WHERE [type] IN (1, 2);

  DECLARE @Assets TABLE (
    [asset_id] NVARCHAR(255) NOT NULL PRIMARY KEY,
    [network_id] NVARCHAR(255) NOT NULL,
    [system_id] NVARCHAR(255) NULL,
    [security_domain] NVARCHAR(20) NOT NULL,
    [system_criticality] NVARCHAR(20) NULL
  );
  INSERT INTO @Assets
  SELECT a.[asset_id], a.[network_id], a.[system_id], a.[security_domain], s.[criticality]
  FROM [tsaat].[asset] AS a
  LEFT JOIN [tsaat].[ict_system] AS s
    ON s.[snapshot_id] = a.[snapshot_id] AND s.[system_id] = a.[system_id]
  WHERE a.[snapshot_id] = @snapshot_id
    AND (@hasAssetScope = 0 OR EXISTS (SELECT 1 FROM @AssetScope AS scope WHERE scope.[asset_id] = a.[asset_id]));

  DECLARE @Systems TABLE (
    [system_id] NVARCHAR(255) NOT NULL PRIMARY KEY,
    [network_id] NVARCHAR(255) NOT NULL,
    [diis_defined] BIT NOT NULL,
    [modelling_status] BIT NOT NULL
  );
  INSERT INTO @Systems
  SELECT s.[system_id], s.[network_id], s.[diis_defined], s.[modelling_status]
  FROM [tsaat].[ict_system] AS s
  WHERE s.[snapshot_id] = @snapshot_id
    AND (@hasSystemScope = 0 OR EXISTS (SELECT 1 FROM @SystemScope AS scope WHERE scope.[system_id] = s.[system_id]));

  DECLARE @Networks TABLE (
    [network_id] NVARCHAR(255) NOT NULL PRIMARY KEY,
    [discovery_status] NVARCHAR(40) NOT NULL
  );
  INSERT INTO @Networks
  SELECT n.[network_id], n.[discovery_status]
  FROM [tsaat].[managed_network] AS n
  WHERE n.[snapshot_id] = @snapshot_id
    AND (@hasNetworkScope = 0 OR EXISTS (SELECT 1 FROM @NetworkScope AS scope WHERE scope.[network_id] = n.[network_id]));

  DECLARE @SpiEvaluations TABLE (
    [snapshot_id] BIGINT NOT NULL,
    [asset_id] NVARCHAR(255) NOT NULL,
    [spi_id] INT NOT NULL,
    [display_order] INT NOT NULL,
    [compliance_status] NVARCHAR(20) NOT NULL,
    [outcome_key] NVARCHAR(100) NOT NULL,
    [evidence_json] NVARCHAR(MAX) NOT NULL
  );
  INSERT INTO @SpiEvaluations
  EXEC [tsaat].[usp_evaluate_spi_snapshot] @snapshot_id = @snapshot_id;

  DELETE se
  FROM @SpiEvaluations AS se
  WHERE NOT EXISTS (SELECT 1 FROM @Assets AS a WHERE a.[asset_id] = se.[asset_id]);

  DECLARE @Discovery TABLE (
    [snapshot_id] BIGINT NOT NULL,
    [asset_id] NVARCHAR(255) NOT NULL,
    [coverage_compliance] BIT NOT NULL,
    [tool_values_json] NVARCHAR(MAX) NOT NULL,
    [missing_tool_ids_json] NVARCHAR(MAX) NOT NULL,
    [missing_tool_names_json] NVARCHAR(MAX) NOT NULL
  );
  INSERT INTO @Discovery
  EXEC [tsaat].[usp_evaluate_discovery_coverage_snapshot]
    @snapshot_id = @snapshot_id,
    @asset_ids_json = @asset_ids_json,
    @emit_json = 0;

  DECLARE @Findings TABLE (
    [asset_id] NVARCHAR(255) NOT NULL,
    [severity] NVARCHAR(30) NOT NULL,
    [priority_rank] INT NOT NULL
  );
  IF ISJSON(@effective_findings_json) = 1
  BEGIN
    INSERT INTO @Findings ([asset_id], [severity], [priority_rank])
    SELECT [asset_id], [severity], [priority_rank]
    FROM OPENJSON(@effective_findings_json) WITH (
      [asset_id] NVARCHAR(255) '$.assetId',
      [severity] NVARCHAR(30) '$.severity',
      [priority_rank] INT '$.priorityRank'
    )
    WHERE [asset_id] IS NOT NULL
      AND EXISTS (SELECT 1 FROM @Assets AS a WHERE a.[asset_id] = [asset_id]);
  END;

  DECLARE @overallTotal INT = (SELECT COUNT(*) FROM @SpiEvaluations);
  DECLARE @overallCompliant INT = (SELECT COUNT(*) FROM @SpiEvaluations WHERE [compliance_status] = N'Compliant');
  DECLARE @overallNonCompliant INT = (SELECT COUNT(*) FROM @SpiEvaluations WHERE [compliance_status] = N'Non-compliant');
  DECLARE @overallUnknown INT = (SELECT COUNT(*) FROM @SpiEvaluations WHERE [compliance_status] = N'Unknown');

  DECLARE @Metric TABLE (
    [calculation_key] NVARCHAR(100) NOT NULL PRIMARY KEY,
    [score] NVARCHAR(100) NOT NULL,
    [score_percent] DECIMAL(9,1) NOT NULL,
    [compliant_count] INT NOT NULL,
    [applicable_count] INT NOT NULL,
    [non_compliant_count] INT NOT NULL,
    [unknown_count] INT NOT NULL,
    [high_priority_count] INT NOT NULL
  );

  ;WITH base AS (
    SELECT se.[compliance_status], a.[security_domain], a.[system_criticality], a.[asset_id], a.[system_id]
    FROM @SpiEvaluations AS se
    INNER JOIN @Assets AS a ON a.[asset_id] = se.[asset_id]
  ),
  grouped AS (
    SELECT
      N'overall-spi-compliance' AS [calculation_key],
      COUNT(*) AS [total],
      SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END) AS [compliant],
      SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END) AS [non_compliant],
      SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END) AS [unknown],
      (SELECT COUNT(*) FROM @Findings WHERE [priority_rank] <= 2) AS [high_priority]
    FROM base
    UNION ALL
    SELECT N'protected-domain-compliance', COUNT(*), SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END), (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS fa ON fa.[asset_id] = f.[asset_id] WHERE f.[priority_rank] <= 2 AND fa.[security_domain] = N'Protected') FROM base WHERE [security_domain] = N'Protected'
    UNION ALL
    SELECT N'secret-domain-compliance', COUNT(*), SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END), (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS fa ON fa.[asset_id] = f.[asset_id] WHERE f.[priority_rank] <= 2 AND fa.[security_domain] = N'Secret') FROM base WHERE [security_domain] = N'Secret'
    UNION ALL
    SELECT N'critical-ict-system-compliance', COUNT(*), SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END), (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS fa ON fa.[asset_id] = f.[asset_id] WHERE f.[priority_rank] <= 2 AND fa.[system_criticality] = N'Critical') FROM base WHERE [system_criticality] = N'Critical'
  )
  INSERT INTO @Metric
  SELECT
    [calculation_key],
    CONVERT(NVARCHAR(40), CAST(CASE WHEN [total] = 0 THEN 0 ELSE ROUND(([compliant] * 100.0) / [total], 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), [compliant]) + N'/' + CONVERT(NVARCHAR(20), [total]) + N')',
    CAST(CASE WHEN [total] = 0 THEN 0 ELSE ROUND(([compliant] * 100.0) / [total], 1) END AS DECIMAL(9,1)),
    COALESCE([compliant], 0),
    COALESCE([total], 0),
    COALESCE([non_compliant], 0),
    COALESCE([unknown], 0),
    COALESCE([high_priority], 0)
  FROM grouped;

  DECLARE @findingTotal INT = (SELECT COUNT(*) FROM @Findings);
  DECLARE @criticalExposure INT = (SELECT COUNT(*) FROM @Findings WHERE [severity] = N'Critical Exposure');
  INSERT INTO @Metric
  VALUES (
    N'critical-exposure-in-production',
    CONVERT(NVARCHAR(20), @criticalExposure),
    CAST(CASE WHEN @findingTotal = 0 THEN 0 ELSE ROUND(((CAST(@findingTotal - @criticalExposure AS DECIMAL(18,4))) * 100.0) / @findingTotal, 1) END AS DECIMAL(9,1)),
    CASE WHEN @findingTotal - @criticalExposure < 0 THEN 0 ELSE @findingTotal - @criticalExposure END,
    @findingTotal,
    @criticalExposure,
    @overallUnknown,
    @criticalExposure
  );

  DECLARE @discoveryTotal INT = (SELECT COUNT(*) FROM @Discovery);
  DECLARE @discoveryCompliant INT = (SELECT COUNT(*) FROM @Discovery WHERE [coverage_compliance] = 1);
  DECLARE @discoveryNonCompliant INT = @discoveryTotal - @discoveryCompliant;
  INSERT INTO @Metric
  VALUES (
    N'discovery-coverage-compliance',
    CONVERT(NVARCHAR(40), CAST(CASE WHEN @discoveryTotal = 0 THEN 0 ELSE ROUND((@discoveryCompliant * 100.0) / @discoveryTotal, 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), @discoveryCompliant) + N'/' + CONVERT(NVARCHAR(20), @discoveryTotal) + N')',
    CAST(CASE WHEN @discoveryTotal = 0 THEN 0 ELSE ROUND((@discoveryCompliant * 100.0) / @discoveryTotal, 1) END AS DECIMAL(9,1)),
    @discoveryCompliant,
    @discoveryTotal,
    @discoveryNonCompliant,
    0,
    (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Discovery AS d ON d.[asset_id] = f.[asset_id] WHERE f.[priority_rank] <= 2 AND d.[coverage_compliance] = 0)
  );

  ;WITH scoped_systems AS (
    SELECT DISTINCT a.[system_id]
    FROM @Assets AS a
    WHERE a.[system_id] IS NOT NULL
  ),
  ato AS (
    SELECT [system_id], CASE WHEN [tsaat].[fn_kpi_stable_hash]([system_id] + N':ato') % 5 <> 0 THEN 1 ELSE 0 END AS [compliant]
    FROM scoped_systems
  ),
  diis AS (
    SELECT [system_id], CASE WHEN [tsaat].[fn_kpi_stable_hash]([system_id] + N':diis') % 4 <> 1 THEN 1 ELSE 0 END AS [compliant]
    FROM scoped_systems
  )
  INSERT INTO @Metric
  SELECT
    N'active-ato-coverage',
    CONVERT(NVARCHAR(40), CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(SUM([compliant]), 0)) + N'/' + CONVERT(NVARCHAR(20), COUNT(*)) + N')',
    CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1)),
    COALESCE(SUM([compliant]), 0),
    COUNT(*),
    COUNT(*) - COALESCE(SUM([compliant]), 0),
    0,
    (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS a ON a.[asset_id] = f.[asset_id] INNER JOIN ato AS ato_rows ON ato_rows.[system_id] = a.[system_id] WHERE f.[priority_rank] <= 2 AND ato_rows.[compliant] = 0)
  FROM ato
  UNION ALL
  SELECT
    N'diis-registration-coverage',
    CONVERT(NVARCHAR(40), CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(SUM([compliant]), 0)) + N'/' + CONVERT(NVARCHAR(20), COUNT(*)) + N')',
    CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1)),
    COALESCE(SUM([compliant]), 0),
    COUNT(*),
    COUNT(*) - COALESCE(SUM([compliant]), 0),
    0,
    (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS a ON a.[asset_id] = f.[asset_id] INNER JOIN diis AS diis_rows ON diis_rows.[system_id] = a.[system_id] WHERE f.[priority_rank] <= 2 AND diis_rows.[compliant] = 0)
  FROM diis;

  DECLARE @diisSystemTotal INT = (SELECT COUNT(*) FROM @Systems WHERE [diis_defined] = 1);
  DECLARE @diisSystemModelled INT = (SELECT COUNT(*) FROM @Systems WHERE [diis_defined] = 1 AND [modelling_status] = 1);
  INSERT INTO @Metric
  VALUES (
    N'diis-modelled-coverage',
    CONVERT(NVARCHAR(40), CAST(CASE WHEN @diisSystemTotal = 0 THEN 0 ELSE ROUND((@diisSystemModelled * 100.0) / @diisSystemTotal, 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), @diisSystemModelled) + N'/' + CONVERT(NVARCHAR(20), @diisSystemTotal) + N')',
    CAST(CASE WHEN @diisSystemTotal = 0 THEN 0 ELSE ROUND((@diisSystemModelled * 100.0) / @diisSystemTotal, 1) END AS DECIMAL(9,1)),
    @diisSystemModelled,
    @diisSystemTotal,
    @diisSystemTotal - @diisSystemModelled,
    0,
    @diisSystemTotal - @diisSystemModelled
  );

  DECLARE @networkTotal INT = (SELECT COUNT(*) FROM @Networks);
  DECLARE @networkEnabled INT = (SELECT COUNT(*) FROM @Networks WHERE [discovery_status] = N'Discovery Enabled');
  INSERT INTO @Metric
  VALUES (
    N'network-discovery-enablement',
    CONVERT(NVARCHAR(40), CAST(CASE WHEN @networkTotal = 0 THEN 0 ELSE ROUND((@networkEnabled * 100.0) / @networkTotal, 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), @networkEnabled) + N'/' + CONVERT(NVARCHAR(20), @networkTotal) + N')',
    CAST(CASE WHEN @networkTotal = 0 THEN 0 ELSE ROUND((@networkEnabled * 100.0) / @networkTotal, 1) END AS DECIMAL(9,1)),
    @networkEnabled,
    @networkTotal,
    @networkTotal - @networkEnabled,
    0,
    @networkTotal - @networkEnabled
  );

  IF @emit_json = 1
  BEGIN
    SELECT
      kd.[kpi_id] AS [kpiId],
      kd.[display_order] AS [displayOrder],
      kd.[calculation_key] AS [calculationKey],
      metric.[score] AS [score],
      metric.[score_percent] AS [scorePercent],
      metric.[compliant_count] AS [compliantCount],
      metric.[applicable_count] AS [applicableCount],
      metric.[non_compliant_count] AS [nonCompliantCount],
      metric.[unknown_count] AS [unknownCount],
      metric.[high_priority_count] AS [highPriorityCount]
    FROM [tsaat].[kpi_definition] AS kd
    INNER JOIN [tsaat].[kpi_calculation_definition] AS kcd
      ON kcd.[calculation_key] = kd.[calculation_key] AND kcd.[enabled] = 1
    INNER JOIN @Metric AS metric
      ON metric.[calculation_key] = kd.[calculation_key]
    WHERE kd.[enabled] = 1
    ORDER BY kd.[display_order], kd.[kpi_id]
    FOR JSON PATH;
    RETURN;
  END;

  SELECT
    @snapshot_id AS [snapshot_id],
    kd.[kpi_id],
    kd.[display_order],
    kd.[calculation_key],
    metric.[score],
    metric.[score_percent],
    metric.[compliant_count],
    metric.[applicable_count],
    metric.[non_compliant_count],
    metric.[unknown_count],
    metric.[high_priority_count]
  FROM [tsaat].[kpi_definition] AS kd
  INNER JOIN [tsaat].[kpi_calculation_definition] AS kcd
    ON kcd.[calculation_key] = kd.[calculation_key] AND kcd.[enabled] = 1
  INNER JOIN @Metric AS metric
    ON metric.[calculation_key] = kd.[calculation_key]
  WHERE kd.[enabled] = 1
  ORDER BY kd.[display_order], kd.[kpi_id];
END;
GO
