SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @PackageDataRoot NVARCHAR(4000) = N'$(PackageDataRoot)';
DECLARE @SnapshotsRoot NVARCHAR(4000) = N'$(SnapshotsRoot)';
DECLARE @RawDataLoadMode NVARCHAR(100) = N'$(DataLoadMode)';
DECLARE @DataLoadModeKey NVARCHAR(100) = LOWER(REPLACE(REPLACE(LTRIM(RTRIM(@RawDataLoadMode)), N'-', N''), N'_', N''));
DECLARE @DataLoadMode NVARCHAR(40);

IF @PackageDataRoot IS NULL OR LTRIM(RTRIM(@PackageDataRoot)) = N''
BEGIN
  THROW 51000, 'PackageDataRoot sqlcmd variable is required.', 1;
END;

IF @SnapshotsRoot IS NULL OR LTRIM(RTRIM(@SnapshotsRoot)) = N''
BEGIN
  THROW 51000, 'SnapshotsRoot sqlcmd variable is required.', 1;
END;

IF @DataLoadModeKey = N'' OR @DataLoadModeKey = N'1' OR @DataLoadModeKey = N'clientpayload'
BEGIN
  SET @DataLoadMode = N'ClientPayload';
END
ELSE IF @DataLoadModeKey = N'2' OR @DataLoadModeKey = N'sqlserverfiles'
BEGIN
  SET @DataLoadMode = N'SqlServerFiles';
END
ELSE
BEGIN
  THROW 51000, 'DataLoadMode sqlcmd variable must be ClientPayload or SqlServerFiles.', 1;
END;

IF @DataLoadMode = N'ClientPayload' AND OBJECT_ID(N'tempdb..#TSAAT_JsonPayload') IS NULL
BEGIN
  THROW 51000, 'ClientPayload data load requires #TSAAT_JsonPayload to be staged in the current sqlcmd session.', 1;
END;

DECLARE @ReadFileSql NVARCHAR(MAX);
DECLARE @ReadPayloadSql NVARCHAR(MAX) = N'SELECT @out = [json_payload] FROM #TSAAT_JsonPayload WHERE [payload_key] = @key;';
DECLARE @FilePath NVARCHAR(4000);
DECLARE @Json NVARCHAR(MAX);
DECLARE @LoadError NVARCHAR(2048);

PRINT 'Loading seed/reference data...';

SET IDENTITY_INSERT [tsaat].[reference_version_set] ON;
INSERT INTO [tsaat].[reference_version_set] (
  [version_set_id],
  [version_set_key],
  [version_set_name],
  [effective_date]
)
VALUES (
  1,
  N'default-reference',
  N'Default Reference Versions',
  CONVERT(DATE, SYSUTCDATETIME())
);
SET IDENTITY_INSERT [tsaat].[reference_version_set] OFF;

SET @FilePath = @PackageDataRoot + N'\reference-versions.json';
SET @Json = NULL;
IF @DataLoadMode = N'ClientPayload'
BEGIN
  EXEC sp_executesql @ReadPayloadSql, N'@key NVARCHAR(4000), @out NVARCHAR(MAX) OUTPUT', @key = @FilePath, @out = @Json OUTPUT;
END
ELSE
BEGIN
  SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
  EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @Json OUTPUT;
END;
IF @Json IS NULL
BEGIN
  SET @LoadError = N'Unable to load JSON payload: ' + @FilePath;
  THROW 51000, @LoadError, 1;
END;

INSERT INTO [tsaat].[reference_os_current_major] (
  [version_set_id],
  [os_key],
  [current_supported_major]
)
SELECT
  1,
  os_major.[key],
  TRY_CONVERT(INT, os_major.[value])
FROM OPENJSON(@Json, '$.osCurrentMajor') AS os_major;

INSERT INTO [tsaat].[reference_software_supported_version] (
  [version_set_id],
  [software_name],
  [version_ordinal],
  [version]
)
SELECT
  1,
  ss.[key],
  TRY_CONVERT(INT, v.[key]) + 1,
  v.[value]
FROM OPENJSON(@Json, '$.softwareSupportMatrix') AS ss
CROSS APPLY OPENJSON(ss.[value]) AS v;

SET @FilePath = @PackageDataRoot + N'\spi-definitions.json';
SET @Json = NULL;
IF @DataLoadMode = N'ClientPayload'
BEGIN
  EXEC sp_executesql @ReadPayloadSql, N'@key NVARCHAR(4000), @out NVARCHAR(MAX) OUTPUT', @key = @FilePath, @out = @Json OUTPUT;
END
ELSE
BEGIN
  SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
  EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @Json OUTPUT;
END;
IF @Json IS NULL
BEGIN
  SET @LoadError = N'Unable to load JSON payload: ' + @FilePath;
  THROW 51000, @LoadError, 1;
END;

DECLARE @SeverityJson NVARCHAR(MAX);
SET @FilePath = @PackageDataRoot + N'\severity-definitions.json';
SET @SeverityJson = NULL;
IF @DataLoadMode = N'ClientPayload'
BEGIN
  EXEC sp_executesql @ReadPayloadSql, N'@key NVARCHAR(4000), @out NVARCHAR(MAX) OUTPUT', @key = @FilePath, @out = @SeverityJson OUTPUT;
END
ELSE
BEGIN
  SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
  EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @SeverityJson OUTPUT;
END;
IF @SeverityJson IS NULL
BEGIN
  SET @LoadError = N'Unable to load JSON payload: ' + @FilePath;
  THROW 51000, @LoadError, 1;
END;

DECLARE @SpiRuleDefinitionJson NVARCHAR(MAX);
SET @FilePath = @PackageDataRoot + N'\spi-rule-definitions.json';
SET @SpiRuleDefinitionJson = NULL;
IF @DataLoadMode = N'ClientPayload'
BEGIN
  EXEC sp_executesql @ReadPayloadSql, N'@key NVARCHAR(4000), @out NVARCHAR(MAX) OUTPUT', @key = @FilePath, @out = @SpiRuleDefinitionJson OUTPUT;
END
ELSE
BEGIN
  SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
  EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @SpiRuleDefinitionJson OUTPUT;
END;
IF @SpiRuleDefinitionJson IS NULL
BEGIN
  SET @LoadError = N'Unable to load JSON payload: ' + @FilePath;
  THROW 51000, @LoadError, 1;
END;

DECLARE @SpiReportDetailJson NVARCHAR(MAX);
SET @FilePath = @PackageDataRoot + N'\spi-report-detail-definitions.json';
SET @SpiReportDetailJson = NULL;
IF @DataLoadMode = N'ClientPayload'
BEGIN
  EXEC sp_executesql @ReadPayloadSql, N'@key NVARCHAR(4000), @out NVARCHAR(MAX) OUTPUT', @key = @FilePath, @out = @SpiReportDetailJson OUTPUT;
END
ELSE
BEGIN
  SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
  EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @SpiReportDetailJson OUTPUT;
END;
IF @SpiReportDetailJson IS NULL
BEGIN
  SET @LoadError = N'Unable to load JSON payload: ' + @FilePath;
  THROW 51000, @LoadError, 1;
END;

DECLARE @SpiClassificationJson NVARCHAR(MAX);
SET @FilePath = @PackageDataRoot + N'\spi-finding-classification-rules.json';
SET @SpiClassificationJson = NULL;
IF @DataLoadMode = N'ClientPayload'
BEGIN
  EXEC sp_executesql @ReadPayloadSql, N'@key NVARCHAR(4000), @out NVARCHAR(MAX) OUTPUT', @key = @FilePath, @out = @SpiClassificationJson OUTPUT;
END
ELSE
BEGIN
  SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
  EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @SpiClassificationJson OUTPUT;
END;
IF @SpiClassificationJson IS NULL
BEGIN
  SET @LoadError = N'Unable to load JSON payload: ' + @FilePath;
  THROW 51000, @LoadError, 1;
END;

MERGE [tsaat].[finding_severity_definition] AS target
USING (
  SELECT
    severity.[severity_key],
    severity.[label],
    severity.[display_order],
    severity.[selectable_in_settings],
    severity.[tone_key]
  FROM OPENJSON(@SeverityJson, '$.severities') WITH (
    [severity_key] NVARCHAR(30) '$.severityKey',
    [label] NVARCHAR(80) '$.label',
    [display_order] INT '$.displayOrder',
    [selectable_in_settings] BIT '$.selectableInSettings',
    [tone_key] NVARCHAR(40) '$.toneKey'
  ) AS severity
) AS source
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

DECLARE @SeedRuleKeys TABLE ([rule_key] NVARCHAR(100) NOT NULL PRIMARY KEY);
INSERT INTO @SeedRuleKeys ([rule_key])
SELECT rule_definition.[rule_key]
FROM OPENJSON(@SpiRuleDefinitionJson, '$.rules') WITH ([rule_key] NVARCHAR(100) '$.ruleKey') AS rule_definition;

MERGE [tsaat].[spi_rule_definition] AS target
USING (
  SELECT
    rule_definition.[rule_key],
    rule_definition.[handler_key],
    rule_definition.[display_order],
    rule_definition.[name],
    rule_definition.[description],
    rule_definition.[enabled]
  FROM OPENJSON(@SpiRuleDefinitionJson, '$.rules') WITH (
    [rule_key] NVARCHAR(100) '$.ruleKey',
    [handler_key] NVARCHAR(100) '$.handlerKey',
    [display_order] INT '$.displayOrder',
    [name] NVARCHAR(255) '$.name',
    [description] NVARCHAR(1000) '$.description',
    [enabled] BIT '$.enabled'
  ) AS rule_definition
) AS source
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

DELETE child FROM [tsaat].[spi_rule_outcome_template] AS child INNER JOIN @SeedRuleKeys AS seed ON seed.[rule_key] = child.[rule_key];
DELETE child FROM [tsaat].[spi_rule_parameter_definition] AS child INNER JOIN @SeedRuleKeys AS seed ON seed.[rule_key] = child.[rule_key];

INSERT INTO [tsaat].[spi_rule_parameter_definition] (
  [rule_key],
  [parameter_key],
  [parameter_type],
  [required],
  [default_value],
  [allowed_values_json],
  [display_order],
  [description]
)
SELECT
  rule_definition.[rule_key],
  parameter.[parameter_key],
  parameter.[parameter_type],
  parameter.[required],
  parameter.[default_value],
  JSON_QUERY(parameter.[allowed_values_json]),
  parameter.[display_order],
  parameter.[description]
FROM OPENJSON(@SpiRuleDefinitionJson, '$.rules') WITH (
  [rule_key] NVARCHAR(100) '$.ruleKey',
  [parameters] NVARCHAR(MAX) '$.parameters' AS JSON
) AS rule_definition
CROSS APPLY OPENJSON(COALESCE(rule_definition.[parameters], N'[]')) WITH (
  [parameter_key] NVARCHAR(100) '$.parameterKey',
  [parameter_type] NVARCHAR(20) '$.parameterType',
  [required] BIT '$.required',
  [default_value] NVARCHAR(4000) '$.defaultValue',
  [allowed_values_json] NVARCHAR(MAX) '$.allowedValues' AS JSON,
  [display_order] INT '$.displayOrder',
  [description] NVARCHAR(1000) '$.description'
) AS parameter;

INSERT INTO [tsaat].[spi_rule_outcome_template] (
  [rule_key],
  [outcome_key],
  [compliance_status],
  [reason_template],
  [evidence_template]
)
SELECT
  rule_definition.[rule_key],
  outcome.[outcome_key],
  outcome.[compliance_status],
  outcome.[reason_template],
  outcome.[evidence_template]
FROM OPENJSON(@SpiRuleDefinitionJson, '$.rules') WITH (
  [rule_key] NVARCHAR(100) '$.ruleKey',
  [outcomes] NVARCHAR(MAX) '$.outcomes' AS JSON
) AS rule_definition
CROSS APPLY OPENJSON(COALESCE(rule_definition.[outcomes], N'[]')) WITH (
  [outcome_key] NVARCHAR(100) '$.outcomeKey',
  [compliance_status] NVARCHAR(20) '$.complianceStatus',
  [reason_template] NVARCHAR(MAX) '$.reasonTemplate',
  [evidence_template] NVARCHAR(MAX) '$.evidenceTemplate'
) AS outcome;

MERGE [tsaat].[spi_report_detail_definition] AS target
USING (
  SELECT
    report_detail.[report_detail_key],
    report_detail.[handler_key],
    report_detail.[display_order],
    report_detail.[name],
    report_detail.[description],
    report_detail.[enabled]
  FROM OPENJSON(@SpiReportDetailJson, '$.reportDetails') WITH (
    [report_detail_key] NVARCHAR(100) '$.reportDetailKey',
    [handler_key] NVARCHAR(100) '$.handlerKey',
    [display_order] INT '$.displayOrder',
    [name] NVARCHAR(255) '$.name',
    [description] NVARCHAR(1000) '$.description',
    [enabled] BIT '$.enabled'
  ) AS report_detail
) AS source
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

DECLARE @SeedSpiIds TABLE ([spi_id] INT NOT NULL PRIMARY KEY);
INSERT INTO @SeedSpiIds ([spi_id])
SELECT spi.[spi_id]
FROM OPENJSON(@Json, '$.spis') WITH ([spi_id] INT '$.spiId') AS spi;

MERGE [tsaat].[spi_definition] AS target
USING (
  SELECT
    spi.spi_id,
    spi.[display_order],
    spi.[name],
    spi.[description],
    spi.[success_measure],
    spi.[priority_order],
    spi.[default_severity],
    spi.[recommended_action],
    spi.[enabled],
    spi.[rule_key],
    spi.[report_available],
    spi.[trend_report_available],
    spi.[report_detail_key]
  FROM OPENJSON(@Json, '$.spis') WITH (
    [spi_id] INT '$.spiId',
    [display_order] INT '$.displayOrder',
    [name] NVARCHAR(255) '$.name',
    [description] NVARCHAR(1000) '$.description',
    [success_measure] NVARCHAR(1000) '$.successMeasure',
    [priority_order] INT '$.priorityOrder',
    [default_severity] NVARCHAR(30) '$.defaultSeverity',
    [recommended_action] NVARCHAR(MAX) '$.recommendedAction',
    [enabled] BIT '$.enabled',
    [rule_key] NVARCHAR(100) '$.ruleKey',
    [report_available] BIT '$.reportAvailable',
    [trend_report_available] BIT '$.trendReportAvailable',
    [report_detail_key] NVARCHAR(100) '$.reportDetailKey'
  ) AS spi
) AS source
ON target.[spi_id] = source.[spi_id]
WHEN MATCHED THEN
  UPDATE SET
    [display_order] = source.[display_order],
    [name] = source.[name],
    [description] = source.[description],
    [success_measure] = source.[success_measure],
    [priority_order] = source.[priority_order],
    [default_severity] = source.[default_severity],
    [recommended_action] = source.[recommended_action],
    [enabled] = source.[enabled],
    [rule_key] = source.[rule_key],
    [report_available] = source.[report_available],
    [trend_report_available] = source.[trend_report_available],
    [report_detail_key] = source.[report_detail_key]
WHEN NOT MATCHED THEN
  INSERT ([spi_id], [display_order], [name], [description], [success_measure], [priority_order], [default_severity], [recommended_action], [enabled], [rule_key], [report_available], [trend_report_available], [report_detail_key])
  VALUES (source.[spi_id], source.[display_order], source.[name], source.[description], source.[success_measure], source.[priority_order], source.[default_severity], source.[recommended_action], source.[enabled], source.[rule_key], source.[report_available], source.[trend_report_available], source.[report_detail_key]);

MERGE [tsaat].[spi_finding_classification_rule] AS target
USING (
  SELECT
    classification.[classification_rule_id],
    classification.[display_order],
    classification.[enabled],
    classification.[spi_id],
    classification.[compliance_status],
    classification.[condition_key],
    classification.[severity_key],
    classification.[priority_rank],
    classification.[description]
  FROM OPENJSON(@SpiClassificationJson, '$.classificationRules') WITH (
    [classification_rule_id] NVARCHAR(100) '$.classificationRuleId',
    [display_order] INT '$.displayOrder',
    [enabled] BIT '$.enabled',
    [spi_id] INT '$.spiId',
    [compliance_status] NVARCHAR(20) '$.complianceStatus',
    [condition_key] NVARCHAR(60) '$.conditionKey',
    [severity_key] NVARCHAR(30) '$.severityKey',
    [priority_rank] INT '$.priorityRank',
    [description] NVARCHAR(1000) '$.description'
  ) AS classification
) AS source
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

DELETE child FROM [tsaat].[spi_tasking_condition_template] AS child INNER JOIN @SeedSpiIds AS seed ON seed.[spi_id] = child.[spi_id];
DELETE child FROM [tsaat].[spi_tasking_action_template] AS child INNER JOIN @SeedSpiIds AS seed ON seed.[spi_id] = child.[spi_id];
DELETE child FROM [tsaat].[spi_tasking_team] AS child INNER JOIN @SeedSpiIds AS seed ON seed.[spi_id] = child.[spi_id];
DELETE child FROM [tsaat].[spi_rule_parameter] AS child INNER JOIN @SeedSpiIds AS seed ON seed.[spi_id] = child.[spi_id];
DELETE child FROM [tsaat].[spi_applicable_asset_type] AS child INNER JOIN @SeedSpiIds AS seed ON seed.[spi_id] = child.[spi_id];

INSERT INTO [tsaat].[spi_applicable_asset_type] (
  [spi_id],
  [asset_type]
)
SELECT
  spi.spi_id,
  aat.[value]
FROM OPENJSON(@Json, '$.spis') WITH (
  [spi_id] INT '$.spiId',
  [applicable_asset_types] NVARCHAR(MAX) '$.applicableAssetTypes' AS JSON
) AS spi
CROSS APPLY OPENJSON(spi.[applicable_asset_types]) AS aat;

INSERT INTO [tsaat].[spi_rule_parameter] (
  [spi_id],
  [parameter_key],
  [parameter_type],
  [parameter_value]
)
SELECT
  spi.[spi_id],
  parameter.[key],
  CASE
    WHEN parameter.[type] = 2 THEN N'number'
    WHEN parameter.[type] = 3 THEN N'boolean'
    ELSE N'string'
  END,
  CONVERT(NVARCHAR(4000), parameter.[value])
FROM OPENJSON(@Json, '$.spis') WITH (
  [spi_id] INT '$.spiId',
  [rule_parameters] NVARCHAR(MAX) '$.ruleParameters' AS JSON
) AS spi
CROSS APPLY OPENJSON(COALESCE(spi.[rule_parameters], N'{}')) AS parameter;

INSERT INTO [tsaat].[spi_tasking_team] (
  [spi_id],
  [display_order],
  [team],
  [support_queue],
  [contact_email]
)
SELECT
  spi.[spi_id],
  team.[display_order],
  team.[team],
  team.[support_queue],
  team.[contact_email]
FROM OPENJSON(@Json, '$.spis') WITH (
  [spi_id] INT '$.spiId',
  [tasking_teams] NVARCHAR(MAX) '$.taskingTeams' AS JSON
) AS spi
CROSS APPLY OPENJSON(spi.[tasking_teams]) WITH (
  [display_order] INT '$.displayOrder',
  [team] NVARCHAR(255) '$.team',
  [support_queue] NVARCHAR(100) '$.supportQueue',
  [contact_email] NVARCHAR(255) '$.contactEmail'
) AS team;

INSERT INTO [tsaat].[spi_tasking_action_template] (
  [spi_id],
  [display_order],
  [condition_key],
  [action_text]
)
SELECT
  spi.[spi_id],
  action.[display_order],
  action.[condition_key],
  action.[action_text]
FROM OPENJSON(@Json, '$.spis') WITH (
  [spi_id] INT '$.spiId',
  [tasking_actions] NVARCHAR(MAX) '$.taskingActions' AS JSON
) AS spi
CROSS APPLY OPENJSON(spi.[tasking_actions]) WITH (
  [display_order] INT '$.displayOrder',
  [condition_key] NVARCHAR(40) '$.conditionKey',
  [action_text] NVARCHAR(MAX) '$.actionText'
) AS action;

INSERT INTO [tsaat].[spi_tasking_condition_template] (
  [spi_id],
  [condition_key],
  [template_text]
)
SELECT
  spi.[spi_id],
  condition.[condition_key],
  condition.[template_text]
FROM OPENJSON(@Json, '$.spis') WITH (
  [spi_id] INT '$.spiId',
  [tasking_conditions] NVARCHAR(MAX) '$.taskingConditions' AS JSON
) AS spi
CROSS APPLY OPENJSON(spi.[tasking_conditions]) WITH (
  [condition_key] NVARCHAR(40) '$.conditionKey',
  [template_text] NVARCHAR(MAX) '$.templateText'
) AS condition;

SET @FilePath = @PackageDataRoot + N'\kpi-definitions.json';
SET @Json = NULL;
IF @DataLoadMode = N'ClientPayload'
BEGIN
  EXEC sp_executesql @ReadPayloadSql, N'@key NVARCHAR(4000), @out NVARCHAR(MAX) OUTPUT', @key = @FilePath, @out = @Json OUTPUT;
END
ELSE
BEGIN
  SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
  EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @Json OUTPUT;
END;
IF @Json IS NULL
BEGIN
  SET @LoadError = N'Unable to load JSON payload: ' + @FilePath;
  THROW 51000, @LoadError, 1;
END;

MERGE [tsaat].[kpi_definition] AS target
USING (
  SELECT
    kpi.[kpi_id],
    kpi.[display_order],
    kpi.[name],
    kpi.[description],
    kpi.[success_measure],
    kpi.[calculation_key],
    kpi.[report_available]
  FROM OPENJSON(@Json, '$.kpis') WITH (
    [kpi_id] NVARCHAR(40) '$.id',
    [display_order] INT '$.displayOrder',
    [name] NVARCHAR(255) '$.name',
    [description] NVARCHAR(1000) '$.description',
    [success_measure] NVARCHAR(1000) '$.successMeasure',
    [calculation_key] NVARCHAR(100) '$.calculationKey',
    [report_available] BIT '$.reportAvailable'
  ) AS kpi
) AS source
ON target.[kpi_id] = source.[kpi_id]
WHEN MATCHED THEN
  UPDATE SET
    [display_order] = source.[display_order],
    [name] = source.[name],
    [description] = source.[description],
    [success_measure] = source.[success_measure],
    [calculation_key] = source.[calculation_key],
    [report_available] = source.[report_available]
WHEN NOT MATCHED BY TARGET THEN
  INSERT (
    [kpi_id],
    [display_order],
    [name],
    [description],
    [success_measure],
    [calculation_key],
    [report_available]
  )
  VALUES (
    source.[kpi_id],
    source.[display_order],
    source.[name],
    source.[description],
    source.[success_measure],
    source.[calculation_key],
    source.[report_available]
  );

SET @FilePath = @PackageDataRoot + N'\discovery-tools-settings.json';
SET @Json = NULL;
IF @DataLoadMode = N'ClientPayload'
BEGIN
  EXEC sp_executesql @ReadPayloadSql, N'@key NVARCHAR(4000), @out NVARCHAR(MAX) OUTPUT', @key = @FilePath, @out = @Json OUTPUT;
END
ELSE
BEGIN
  SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
  EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @Json OUTPUT;
END;
IF @Json IS NULL
BEGIN
  SET @LoadError = N'Unable to load JSON payload: ' + @FilePath;
  THROW 51000, @LoadError, 1;
END;

SET IDENTITY_INSERT [tsaat].[discovery_tools_settings_version] ON;
INSERT INTO [tsaat].[discovery_tools_settings_version] (
  [settings_version_id],
  [updated_at]
)
VALUES (
  1,
  TRY_CONVERT(DATETIMEOFFSET(7), JSON_VALUE(@Json, '$.updatedAt'))
);
SET IDENTITY_INSERT [tsaat].[discovery_tools_settings_version] OFF;

INSERT INTO [tsaat].[discovery_tool] (
  [settings_version_id],
  [tool_id],
  [name],
  [description],
  [el2_owner],
  [el2_operations_manager]
)
SELECT
  1,
  tool.tool_id,
  tool.[name],
  tool.[description],
  tool.[el2_owner],
  tool.[el2_operations_manager]
FROM OPENJSON(@Json, '$.tools') WITH (
  [tool_id] NVARCHAR(255) '$.id',
  [name] NVARCHAR(255) '$.name',
  [description] NVARCHAR(1000) '$.description',
  [el2_owner] NVARCHAR(255) '$.el2Owner',
  [el2_operations_manager] NVARCHAR(255) '$.el2OperationsManager'
) AS tool;

INSERT INTO [tsaat].[discovery_tool_asset_scope] (
  [settings_version_id],
  [tool_id],
  [asset_type],
  [scope_setting]
)
SELECT
  1,
  tool.tool_id,
  scope_map.[key],
  scope_map.[value]
FROM OPENJSON(@Json, '$.tools') WITH (
  [tool_id] NVARCHAR(255) '$.id',
  [asset_type_scope] NVARCHAR(MAX) '$.assetTypeScope' AS JSON
) AS tool
CROSS APPLY OPENJSON(tool.[asset_type_scope]) AS scope_map;

SET @FilePath = @PackageDataRoot + N'\measures-settings.json';
SET @Json = NULL;
IF @DataLoadMode = N'ClientPayload'
BEGIN
  EXEC sp_executesql @ReadPayloadSql, N'@key NVARCHAR(4000), @out NVARCHAR(MAX) OUTPUT', @key = @FilePath, @out = @Json OUTPUT;
END
ELSE
BEGIN
  SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
  EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @Json OUTPUT;
END;
IF @Json IS NULL
BEGIN
  SET @LoadError = N'Unable to load JSON payload: ' + @FilePath;
  THROW 51000, @LoadError, 1;
END;

SET IDENTITY_INSERT [tsaat].[measures_settings_version] ON;
INSERT INTO [tsaat].[measures_settings_version] (
  [settings_version_id],
  [updated_at]
)
VALUES (
  1,
  TRY_CONVERT(DATETIMEOFFSET(7), JSON_VALUE(@Json, '$.updatedAt'))
);
SET IDENTITY_INSERT [tsaat].[measures_settings_version] OFF;

INSERT INTO [tsaat].[measures_severity_matrix] (
  [settings_version_id],
  [spi_id],
  [asset_type],
  [severity]
)
SELECT
  1,
  TRY_CONVERT(INT, LEFT(ms.[key], CHARINDEX(':', ms.[key]) - 1)),
  SUBSTRING(ms.[key], CHARINDEX(':', ms.[key]) + 1, 255),
  ms.[value]
FROM OPENJSON(@Json, '$.severityMatrix') AS ms
WHERE CHARINDEX(':', ms.[key]) > 0;

INSERT INTO [tsaat].[measures_priority_matrix] (
  [settings_version_id],
  [spi_id],
  [priority_rank]
)
SELECT
  1,
  sd.[spi_id],
  COALESCE(mp.[priority_rank], sd.[priority_order])
FROM [tsaat].[spi_definition] AS sd
OUTER APPLY (
  SELECT TRY_CONVERT(INT, JSON_VALUE(@Json, CONCAT('$.priorityMatrix."', sd.[spi_id], '"'))) AS [priority_rank]
) AS mp
WHERE COALESCE(mp.[priority_rank], sd.[priority_order]) BETWEEN 1 AND 7;

PRINT 'Loading snapshot/application data...';

DECLARE @SnapshotFiles TABLE (
  [snapshot_id] INT NOT NULL PRIMARY KEY,
  [file_name] NVARCHAR(100) NOT NULL
);

INSERT INTO @SnapshotFiles ([snapshot_id], [file_name])
VALUES
  (1, N'week-01.json'),
  (2, N'week-02.json'),
  (3, N'week-03.json'),
  (4, N'week-04.json'),
  (5, N'week-05.json'),
  (6, N'week-06.json'),
  (7, N'week-07.json'),
  (8, N'week-08.json');

DECLARE @SnapshotId INT;
DECLARE @SnapshotFile NVARCHAR(100);

SET IDENTITY_INSERT [tsaat].[dataset_snapshot] ON;

DECLARE snapshot_cursor CURSOR LOCAL FAST_FORWARD FOR
  SELECT [snapshot_id], [file_name]
  FROM @SnapshotFiles
  ORDER BY [snapshot_id];

OPEN snapshot_cursor;
FETCH NEXT FROM snapshot_cursor INTO @SnapshotId, @SnapshotFile;

WHILE @@FETCH_STATUS = 0
BEGIN
  SET @FilePath = @SnapshotsRoot + N'\' + @SnapshotFile;
  SET @Json = NULL;
  IF @DataLoadMode = N'ClientPayload'
  BEGIN
    EXEC sp_executesql @ReadPayloadSql, N'@key NVARCHAR(4000), @out NVARCHAR(MAX) OUTPUT', @key = @FilePath, @out = @Json OUTPUT;
  END
  ELSE
  BEGIN
    SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
    EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @Json OUTPUT;
  END;
  IF @Json IS NULL
  BEGIN
    SET @LoadError = N'Unable to load JSON payload: ' + @FilePath;
    THROW 51000, @LoadError, 1;
  END;

  INSERT INTO [tsaat].[dataset_snapshot] (
    [snapshot_id],
    [snapshot_date],
    [generated_at],
    [source_label],
    [reference_version_set_id]
  )
  VALUES (
    @SnapshotId,
    TRY_CONVERT(DATE, JSON_VALUE(@Json, '$.snapshotDate')),
    TRY_CONVERT(DATETIMEOFFSET(7), JSON_VALUE(@Json, '$.generatedAt')),
    @SnapshotFile,
    1
  );

  ;WITH network_source AS (
    SELECT
      n.*,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE
            WHEN n.[id] LIKE N'net-[0-9]%' AND n.[id] NOT LIKE N'net-new-%' THEN 1
            WHEN n.[id] LIKE N'net-new-[0-9]%' THEN 2
            ELSE 3
          END,
          CASE
            WHEN n.[id] LIKE N'net-[0-9]%' AND n.[id] NOT LIKE N'net-new-%'
              THEN TRY_CONVERT(INT, SUBSTRING(n.[id], 5, 32))
            WHEN n.[id] LIKE N'net-new-[0-9]%'
              THEN TRY_CONVERT(INT, SUBSTRING(n.[id], 9, 32))
            ELSE NULL
          END,
          n.[id]
      ) AS [network_ordinal]
    FROM OPENJSON(@Json, '$.managedNetworks') WITH (
      [id] NVARCHAR(255) '$.id',
      [name] NVARCHAR(255) '$.name',
      [criticality] NVARCHAR(20) '$.criticality',
      [adf_platform] BIT '$.adfPlatform',
      [enterprise_platform] BIT '$.enterprisePlatform',
      [modelling_status] BIT '$.modellingStatus',
      [classification] NVARCHAR(255) '$.classification',
      [description] NVARCHAR(2000) '$.description',
      [owner] NVARCHAR(255) '$.owner',
      [support_email] NVARCHAR(320) '$.supportEmail',
      [service_catalogue_url] NVARCHAR(1024) '$.serviceCatalogueUrl',
      [diis_id] NVARCHAR(100) '$.diisId',
      [ato_number] NVARCHAR(100) '$.atoNumber',
      [apm_number] NVARCHAR(100) '$.apmNumber',
      [diis_url] NVARCHAR(1024) '$.diisUrl',
      [grc_url] NVARCHAR(1024) '$.grcUrl',
      [discovery_status] NVARCHAR(40) '$.discoveryStatus'
    ) AS n
  )
  INSERT INTO [tsaat].[managed_network] (
    [snapshot_id],
    [network_id],
    [name],
    [criticality],
    [adf_platform],
    [enterprise_platform],
    [modelling_status],
    [classification],
    [description],
    [owner],
    [support_email],
    [service_catalogue_url],
    [diis_id],
    [ato_number],
    [apm_number],
    [diis_url],
    [grc_url],
    [discovery_status]
  )
  SELECT
    @SnapshotId,
    n.[id],
    n.[name],
    n.[criticality],
    n.[adf_platform],
    n.[enterprise_platform],
    COALESCE(
      n.[modelling_status],
      CASE
        WHEN n.[discovery_status] = N'Discovery Non Enabled' THEN CAST(0 AS BIT)
        ELSE CAST(1 AS BIT)
      END
    ),
    n.[classification],
    n.[description],
    n.[owner],
    n.[support_email],
    n.[service_catalogue_url],
    COALESCE(
      NULLIF(LTRIM(RTRIM(n.[diis_id])), N''),
      CASE
        WHEN n.[id] = N'net-unassigned' THEN N'DIIS-NET-000'
        ELSE CONCAT(N'DIIS-NET-', RIGHT(CONCAT(N'000', CONVERT(NVARCHAR(10), n.[network_ordinal])), 3))
      END
    ),
    COALESCE(
      NULLIF(LTRIM(RTRIM(n.[ato_number])), N''),
      CASE
        WHEN n.[id] = N'net-unassigned' THEN N'ATO-NET-000'
        ELSE CONCAT(N'ATO-NET-', RIGHT(CONCAT(N'000', CONVERT(NVARCHAR(10), n.[network_ordinal])), 3))
      END
    ),
    COALESCE(
      NULLIF(LTRIM(RTRIM(n.[apm_number])), N''),
      CASE
        WHEN n.[id] = N'net-unassigned' THEN N'APM-NET-000'
        ELSE CONCAT(N'APM-NET-', RIGHT(CONCAT(N'000', CONVERT(NVARCHAR(10), n.[network_ordinal])), 3))
      END
    ),
    n.[diis_url],
    n.[grc_url],
    n.[discovery_status]
  FROM network_source AS n;

  IF EXISTS (
    SELECT 1
    FROM OPENJSON(@Json, '$.ictSystems') WITH (
      [network_id] NVARCHAR(255) '$.networkId'
    ) AS s
    WHERE NULLIF(s.[network_id], N'') IS NULL
  )
  BEGIN
    INSERT INTO [tsaat].[managed_network] (
      [snapshot_id],
      [network_id],
      [name],
      [criticality],
      [adf_platform],
      [enterprise_platform],
      [modelling_status],
      [classification],
      [description],
      [diis_id],
      [ato_number],
      [apm_number],
      [discovery_status]
    )
    VALUES (
      @SnapshotId,
      N'net-unassigned',
      N'Unassigned Systems',
      N'Non-Critical',
      0,
      0,
      0,
      N'Unclassified',
      N'Synthetic network created during load for systems without networkId.',
      N'DIIS-NET-000',
      N'ATO-NET-000',
      N'APM-NET-000',
      N'Discovery Non Enabled'
    );
  END;

  ;WITH parent_links AS (
    SELECT
      n.[parent_network_id],
      n.[id] AS [child_network_id]
    FROM OPENJSON(@Json, '$.managedNetworks') WITH (
      [id] NVARCHAR(255) '$.id',
      [parent_network_id] NVARCHAR(255) '$.parentNetworkId'
    ) AS n
    WHERE n.[parent_network_id] IS NOT NULL
  ),
  child_links AS (
    SELECT
      n.[id] AS [parent_network_id],
      cn.[value] AS [child_network_id]
    FROM OPENJSON(@Json, '$.managedNetworks') WITH (
      [id] NVARCHAR(255) '$.id',
      [child_network_ids] NVARCHAR(MAX) '$.childNetworkIds' AS JSON
    ) AS n
    CROSS APPLY OPENJSON(n.[child_network_ids]) AS cn
  )
  INSERT INTO [tsaat].[managed_network_hierarchy] (
    [snapshot_id],
    [parent_network_id],
    [child_network_id]
  )
  SELECT DISTINCT
    @SnapshotId,
    links.[parent_network_id],
    links.[child_network_id]
  FROM (
    SELECT [parent_network_id], [child_network_id] FROM parent_links
    UNION ALL
    SELECT [parent_network_id], [child_network_id] FROM child_links
  ) AS links
  WHERE links.[parent_network_id] IS NOT NULL
    AND links.[child_network_id] IS NOT NULL
    AND links.[parent_network_id] <> links.[child_network_id];

  ;WITH system_source AS (
    SELECT
      s.*,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE
            WHEN s.[id] LIKE N'sys-[0-9]%' THEN 1
            ELSE 2
          END,
          CASE
            WHEN s.[id] LIKE N'sys-[0-9]%' THEN TRY_CONVERT(INT, SUBSTRING(s.[id], 5, 32))
            ELSE NULL
          END,
          s.[id]
      ) AS [system_ordinal]
    FROM OPENJSON(@Json, '$.ictSystems') WITH (
      [id] NVARCHAR(255) '$.id',
      [network_id] NVARCHAR(255) '$.networkId',
      [name] NVARCHAR(255) '$.name',
      [adf_platform] BIT '$.adfPlatform',
      [enterprise_platform] BIT '$.enterprisePlatform',
      [description] NVARCHAR(2000) '$.description',
      [diis_id] NVARCHAR(100) '$.diisId',
      [owner] NVARCHAR(255) '$.owner',
      [support_email] NVARCHAR(320) '$.supportEmail',
      [service_catalogue_url] NVARCHAR(1024) '$.serviceCatalogueUrl',
      [ato_number] NVARCHAR(100) '$.atoNumber',
      [apm_number] NVARCHAR(100) '$.apmNumber',
      [diis_url] NVARCHAR(1024) '$.diisUrl',
      [grc_url] NVARCHAR(1024) '$.grcUrl',
      [modelling_status] BIT '$.modellingStatus',
      [diis_defined] BIT '$.diisDefined',
      [criticality] NVARCHAR(20) '$.criticality',
      [security_domain] NVARCHAR(20) '$.securityDomain'
    ) AS s
  )
  INSERT INTO [tsaat].[ict_system] (
    [snapshot_id],
    [system_id],
    [network_id],
    [name],
    [adf_platform],
    [enterprise_platform],
    [description],
    [diis_id],
    [owner],
    [support_email],
    [service_catalogue_url],
    [ato_number],
    [apm_number],
    [diis_url],
    [grc_url],
    [modelling_status],
    [diis_defined],
    [criticality],
    [security_domain]
  )
  SELECT
    @SnapshotId,
    s.[id],
    COALESCE(NULLIF(s.[network_id], N''), N'net-unassigned'),
    s.[name],
    s.[adf_platform],
    s.[enterprise_platform],
    s.[description],
    COALESCE(
      NULLIF(LTRIM(RTRIM(s.[diis_id])), N''),
      CONCAT(N'DIIS-SYS-', RIGHT(CONCAT(N'000', CONVERT(NVARCHAR(10), s.[system_ordinal])), 3))
    ),
    s.[owner],
    s.[support_email],
    s.[service_catalogue_url],
    COALESCE(
      NULLIF(LTRIM(RTRIM(s.[ato_number])), N''),
      CONCAT(N'ATO-SYS-', RIGHT(CONCAT(N'000', CONVERT(NVARCHAR(10), s.[system_ordinal])), 3))
    ),
    COALESCE(
      NULLIF(LTRIM(RTRIM(s.[apm_number])), N''),
      CONCAT(N'APM-SYS-', RIGHT(CONCAT(N'000', CONVERT(NVARCHAR(10), s.[system_ordinal])), 3))
    ),
    s.[diis_url],
    s.[grc_url],
    s.[modelling_status],
    s.[diis_defined],
    s.[criticality],
    s.[security_domain]
  FROM system_source AS s;

  ;WITH parent_links AS (
    SELECT
      s.[parent_system_id],
      s.[id] AS [child_system_id]
    FROM OPENJSON(@Json, '$.ictSystems') WITH (
      [id] NVARCHAR(255) '$.id',
      [parent_system_id] NVARCHAR(255) '$.parentSystemId'
    ) AS s
    WHERE s.[parent_system_id] IS NOT NULL
  ),
  child_links AS (
    SELECT
      s.[id] AS [parent_system_id],
      cs.[value] AS [child_system_id]
    FROM OPENJSON(@Json, '$.ictSystems') WITH (
      [id] NVARCHAR(255) '$.id',
      [child_system_ids] NVARCHAR(MAX) '$.childSystemIds' AS JSON
    ) AS s
    CROSS APPLY OPENJSON(s.[child_system_ids]) AS cs
  )
  INSERT INTO [tsaat].[ict_system_hierarchy] (
    [snapshot_id],
    [parent_system_id],
    [child_system_id]
  )
  SELECT DISTINCT
    @SnapshotId,
    links.[parent_system_id],
    links.[child_system_id]
  FROM (
    SELECT [parent_system_id], [child_system_id] FROM parent_links
    UNION ALL
    SELECT [parent_system_id], [child_system_id] FROM child_links
  ) AS links
  WHERE links.[parent_system_id] IS NOT NULL
    AND links.[child_system_id] IS NOT NULL
    AND links.[parent_system_id] <> links.[child_system_id];

  INSERT INTO [tsaat].[network_declared_system] (
    [snapshot_id],
    [network_id],
    [system_id]
  )
  SELECT DISTINCT
    @SnapshotId,
    n.[network_id],
    si.[value]
  FROM OPENJSON(@Json, '$.managedNetworks') WITH (
    [network_id] NVARCHAR(255) '$.id',
    [ict_system_ids] NVARCHAR(MAX) '$.ictSystemIds' AS JSON
  ) AS n
  CROSS APPLY OPENJSON(n.[ict_system_ids]) AS si;

  INSERT INTO [tsaat].[system_mission_capability] (
    [snapshot_id],
    [system_id],
    [mission_capability_id],
    [name],
    [criticality]
  )
  SELECT
    @SnapshotId,
    s.[system_id],
    mc.[id],
    mc.[name],
    mc.[criticality]
  FROM OPENJSON(@Json, '$.ictSystems') WITH (
    [system_id] NVARCHAR(255) '$.id',
    [mission_capabilities] NVARCHAR(MAX) '$.missionCapabilities' AS JSON
  ) AS s
  CROSS APPLY OPENJSON(s.[mission_capabilities]) WITH (
    [id] NVARCHAR(255) '$.id',
    [name] NVARCHAR(255) '$.name',
    [criticality] NVARCHAR(20) '$.criticality'
  ) AS mc;

  INSERT INTO [tsaat].[system_business_service] (
    [snapshot_id],
    [system_id],
    [business_service_id],
    [name],
    [criticality]
  )
  SELECT
    @SnapshotId,
    s.[system_id],
    bs.[id],
    bs.[name],
    bs.[criticality]
  FROM OPENJSON(@Json, '$.ictSystems') WITH (
    [system_id] NVARCHAR(255) '$.id',
    [business_services] NVARCHAR(MAX) '$.businessServices' AS JSON
  ) AS s
  CROSS APPLY OPENJSON(s.[business_services]) WITH (
    [id] NVARCHAR(255) '$.id',
    [name] NVARCHAR(255) '$.name',
    [criticality] NVARCHAR(20) '$.criticality'
  ) AS bs;

  INSERT INTO [tsaat].[system_environment] (
    [snapshot_id],
    [system_id],
    [environment_id],
    [name],
    [environment_type]
  )
  SELECT
    @SnapshotId,
    s.[system_id],
    env.[environment_id],
    env.[name],
    env.[environment_type]
  FROM OPENJSON(@Json, '$.ictSystems') WITH (
    [system_id] NVARCHAR(255) '$.id',
    [environments] NVARCHAR(MAX) '$.environments' AS JSON
  ) AS s
  CROSS APPLY OPENJSON(s.[environments]) WITH (
    [environment_id] NVARCHAR(255) '$.id',
    [name] NVARCHAR(255) '$.name',
    [environment_type] NVARCHAR(20) '$.type',
    [asset_ids] NVARCHAR(MAX) '$.assetIds' AS JSON
  ) AS env;

  INSERT INTO [tsaat].[asset] (
    [snapshot_id],
    [asset_id],
    [name],
    [hostname],
    [ip_address],
    [asset_type],
    [network_id],
    [security_domain],
    [system_id],
    [environment_type],
    [lifecycle_eol_status],
    [lifecycle_warranty_status]
  )
  SELECT
    @SnapshotId,
    a.[id],
    a.[name],
    a.[hostname],
    a.[ip_address],
    a.[asset_type],
    a.[network_id],
    a.[security_domain],
    a.[system_id],
    a.[environment_type],
    a.[lifecycle_eol_status],
    a.[lifecycle_warranty_status]
  FROM OPENJSON(@Json, '$.assets') WITH (
    [id] NVARCHAR(255) '$.id',
    [name] NVARCHAR(255) '$.name',
    [hostname] NVARCHAR(255) '$.hostname',
    [ip_address] NVARCHAR(64) '$.ipAddress',
    [asset_type] NVARCHAR(20) '$.type',
    [network_id] NVARCHAR(255) '$.networkId',
    [security_domain] NVARCHAR(20) '$.securityDomain',
    [system_id] NVARCHAR(255) '$.systemContext.systemId',
    [environment_type] NVARCHAR(20) '$.systemContext.environmentType',
    [lifecycle_eol_status] NVARCHAR(20) '$.lifecycle.eolStatus',
    [lifecycle_warranty_status] NVARCHAR(20) '$.lifecycle.warrantyStatus'
  ) AS a;

  INSERT INTO [tsaat].[network_declared_asset] (
    [snapshot_id],
    [network_id],
    [asset_id]
  )
  SELECT DISTINCT
    @SnapshotId,
    n.[network_id],
    ai.[value]
  FROM OPENJSON(@Json, '$.managedNetworks') WITH (
    [network_id] NVARCHAR(255) '$.id',
    [asset_ids] NVARCHAR(MAX) '$.assetIds' AS JSON
  ) AS n
  CROSS APPLY OPENJSON(n.[asset_ids]) AS ai;

  INSERT INTO [tsaat].[network_target_state_asset] (
    [snapshot_id],
    [network_id],
    [asset_type],
    [asset_name]
  )
  SELECT DISTINCT
    @SnapshotId,
    n.[network_id],
    target_map.[key],
    LTRIM(RTRIM(CONVERT(NVARCHAR(255), target_name.[value])))
  FROM OPENJSON(@Json, '$.managedNetworks') WITH (
    [network_id] NVARCHAR(255) '$.id',
    [target_state_assets] NVARCHAR(MAX) '$.targetStateAssets' AS JSON
  ) AS n
  CROSS APPLY OPENJSON(n.[target_state_assets]) AS target_map
  CROSS APPLY OPENJSON(target_map.[value]) AS target_name
  WHERE NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), target_name.[value]))), N'') IS NOT NULL;

  INSERT INTO [tsaat].[system_environment_asset] (
    [snapshot_id],
    [system_id],
    [environment_id],
    [environment_type],
    [asset_id]
  )
  SELECT DISTINCT
    @SnapshotId,
    s.[system_id],
    env.[environment_id],
    env.[environment_type],
    ai.[value]
  FROM OPENJSON(@Json, '$.ictSystems') WITH (
    [system_id] NVARCHAR(255) '$.id',
    [environments] NVARCHAR(MAX) '$.environments' AS JSON
  ) AS s
  CROSS APPLY OPENJSON(s.[environments]) WITH (
    [environment_id] NVARCHAR(255) '$.id',
    [environment_type] NVARCHAR(20) '$.type',
    [asset_ids] NVARCHAR(MAX) '$.assetIds' AS JSON
  ) AS env
  CROSS APPLY OPENJSON(env.[asset_ids]) AS ai;

  INSERT INTO [tsaat].[asset_operating_system] (
    [snapshot_id],
    [asset_id],
    [family],
    [vendor],
    [major_version],
    [version],
    [support_status],
    [current_supported_major],
    [n_minus]
  )
  SELECT
    @SnapshotId,
    a.[asset_id],
    os.[family],
    os.[vendor],
    os.[major_version],
    os.[version],
    os.[support_status],
    os.[current_supported_major],
    os.[n_minus]
  FROM OPENJSON(@Json, '$.assets') WITH (
    [asset_id] NVARCHAR(255) '$.id',
    [operating_system] NVARCHAR(MAX) '$.operatingSystem' AS JSON
  ) AS a
  CROSS APPLY OPENJSON(a.[operating_system]) WITH (
    [family] NVARCHAR(255) '$.family',
    [vendor] NVARCHAR(255) '$.vendor',
    [major_version] INT '$.majorVersion',
    [version] NVARCHAR(255) '$.version',
    [support_status] NVARCHAR(20) '$.supportStatus',
    [current_supported_major] INT '$.currentSupportedMajor',
    [n_minus] INT '$.nMinus'
  ) AS os;

  INSERT INTO [tsaat].[asset_network_os] (
    [snapshot_id],
    [asset_id],
    [family],
    [vendor],
    [major_version],
    [version],
    [support_status],
    [current_supported_major],
    [n_minus]
  )
  SELECT
    @SnapshotId,
    a.[asset_id],
    nos.[family],
    nos.[vendor],
    nos.[major_version],
    nos.[version],
    nos.[support_status],
    nos.[current_supported_major],
    nos.[n_minus]
  FROM OPENJSON(@Json, '$.assets') WITH (
    [asset_id] NVARCHAR(255) '$.id',
    [network_os] NVARCHAR(MAX) '$.networkOs' AS JSON
  ) AS a
  CROSS APPLY OPENJSON(a.[network_os]) WITH (
    [family] NVARCHAR(255) '$.family',
    [vendor] NVARCHAR(255) '$.vendor',
    [major_version] INT '$.majorVersion',
    [version] NVARCHAR(255) '$.version',
    [support_status] NVARCHAR(20) '$.supportStatus',
    [current_supported_major] INT '$.currentSupportedMajor',
    [n_minus] INT '$.nMinus'
  ) AS nos;

  INSERT INTO [tsaat].[asset_patch_state] (
    [snapshot_id],
    [asset_id],
    [is_latest],
    [last_patched_date]
  )
  SELECT
    @SnapshotId,
    a.[asset_id],
    ps.[is_latest],
    TRY_CONVERT(DATE, ps.[last_patched_date])
  FROM OPENJSON(@Json, '$.assets') WITH (
    [asset_id] NVARCHAR(255) '$.id',
    [patch_state] NVARCHAR(MAX) '$.patchState' AS JSON
  ) AS a
  CROSS APPLY OPENJSON(a.[patch_state]) WITH (
    [is_latest] BIT '$.isLatest',
    [last_patched_date] NVARCHAR(50) '$.lastPatchedDate'
  ) AS ps;

  INSERT INTO [tsaat].[asset_installed_software] (
    [snapshot_id],
    [asset_id],
    [software_ordinal],
    [name],
    [version],
    [support_status]
  )
  SELECT
    @SnapshotId,
    a.[asset_id],
    TRY_CONVERT(INT, sw.[key]) + 1,
    JSON_VALUE(sw.[value], '$.name'),
    JSON_VALUE(sw.[value], '$.version'),
    JSON_VALUE(sw.[value], '$.supportStatus')
  FROM OPENJSON(@Json, '$.assets') WITH (
    [asset_id] NVARCHAR(255) '$.id',
    [installed_software] NVARCHAR(MAX) '$.installedSoftware' AS JSON
  ) AS a
  CROSS APPLY OPENJSON(a.[installed_software]) AS sw;

  INSERT INTO [tsaat].[asset_vulnerability] (
    [snapshot_id],
    [asset_id],
    [vulnerability_id],
    [cve],
    [description],
    [remediation_guidance],
    [criticality],
    [severity],
    [exploitability],
    [detected_date],
    [captured_at],
    [source]
  )
  SELECT
    @SnapshotId,
    a.[asset_id],
    JSON_VALUE(vuln.[value], '$.id'),
    JSON_VALUE(vuln.[value], '$.cve'),
    JSON_VALUE(vuln.[value], '$.description'),
    JSON_VALUE(vuln.[value], '$.remediationGuidance'),
    JSON_VALUE(vuln.[value], '$.criticality'),
    JSON_VALUE(vuln.[value], '$.severity'),
    JSON_VALUE(vuln.[value], '$.exploitability'),
    TRY_CONVERT(DATE, JSON_VALUE(vuln.[value], '$.detectedDate')),
    TRY_CONVERT(DATETIMEOFFSET(7), JSON_VALUE(vuln.[value], '$.capturedAt')),
    JSON_VALUE(vuln.[value], '$.source')
  FROM OPENJSON(@Json, '$.assets') WITH (
    [asset_id] NVARCHAR(255) '$.id',
    [vulnerabilities] NVARCHAR(MAX) '$.vulnerabilities' AS JSON
  ) AS a
  CROSS APPLY OPENJSON(a.[vulnerabilities]) AS vuln;

  ;WITH dependency_source AS (
    SELECT
      COALESCE(
        NULLIF(dep.[id], N''),
        CONCAT(
          N'dep-',
          @SnapshotId,
          N'-',
          RIGHT(
            N'000000' + CONVERT(
              NVARCHAR(6),
              ROW_NUMBER() OVER (ORDER BY dep.[source_asset_id], dep.[target_asset_id], dep.[dependency_type])
            ),
            6
          )
        )
      ) AS [dependency_id],
      dep.[source_asset_id] AS [source_asset_id],
      dep.[target_asset_id] AS [target_asset_id],
      dep.[dependency_type] AS [dependency_type],
      NULLIF(dep.[flow_protocol], N'') AS [flow_protocol],
      dep.[source_port] AS [source_port],
      dep.[target_port] AS [target_port],
      NULLIF(dep.[observation_method], N'') AS [observation_method],
      TRY_CONVERT(DATETIMEOFFSET(7), dep.[observed_at]) AS [observed_at]
    FROM OPENJSON(@Json, '$.ciDependencies') WITH (
      [id] NVARCHAR(255) '$.id',
      [source_asset_id] NVARCHAR(255) '$.sourceAssetId',
      [target_asset_id] NVARCHAR(255) '$.targetAssetId',
      [dependency_type] NVARCHAR(30) '$.dependencyType',
      [flow_protocol] NVARCHAR(20) '$.protocol',
      [source_port] INT '$.sourcePort',
      [target_port] INT '$.targetPort',
      [observation_method] NVARCHAR(255) '$.observationMethod',
      [observed_at] NVARCHAR(40) '$.observedAt'
    ) AS dep
  )
  INSERT INTO [tsaat].[ci_dependency] (
    [snapshot_id],
    [dependency_id],
    [source_asset_id],
    [target_asset_id],
    [dependency_type],
    [flow_protocol],
    [source_port],
    [target_port],
    [observation_method],
    [observed_at]
  )
  SELECT
    @SnapshotId,
    ds.[dependency_id],
    ds.[source_asset_id],
    ds.[target_asset_id],
    ds.[dependency_type],
    ds.[flow_protocol],
    ds.[source_port],
    ds.[target_port],
    ds.[observation_method],
    ds.[observed_at]
  FROM dependency_source AS ds
  WHERE ds.[source_asset_id] IS NOT NULL
    AND ds.[target_asset_id] IS NOT NULL
    AND ds.[source_asset_id] <> ds.[target_asset_id]
    AND ds.[dependency_type] IN (N'Logical Dependency', N'Flow Dependency')
    AND EXISTS (
      SELECT 1
      FROM [tsaat].[asset] AS src
      WHERE src.[snapshot_id] = @SnapshotId
        AND src.[asset_id] = ds.[source_asset_id]
    )
    AND EXISTS (
      SELECT 1
      FROM [tsaat].[asset] AS tgt
      WHERE tgt.[snapshot_id] = @SnapshotId
        AND tgt.[asset_id] = ds.[target_asset_id]
    );

  IF NOT EXISTS (
    SELECT 1
    FROM [tsaat].[ci_dependency] AS d
    WHERE d.[snapshot_id] = @SnapshotId
  )
  BEGIN
    ;WITH environment_assets AS (
      SELECT
        sea.[system_id],
        sea.[environment_id],
        sea.[environment_type],
        sea.[asset_id],
        ROW_NUMBER() OVER (
          PARTITION BY sea.[system_id], sea.[environment_id]
          ORDER BY sea.[asset_id]
        ) AS [rn]
      FROM [tsaat].[system_environment_asset] AS sea
      WHERE sea.[snapshot_id] = @SnapshotId
    ),
    logical_edges AS (
      SELECT
        CONCAT(
          N'auto-logical-env-',
          left_env.[system_id],
          N'-',
          left_env.[environment_id],
          N'-',
          left_env.[rn]
        ) AS [dependency_id],
        left_env.[asset_id] AS [source_asset_id],
        right_env.[asset_id] AS [target_asset_id],
        N'Logical Dependency' AS [dependency_type],
        CAST(NULL AS NVARCHAR(20)) AS [flow_protocol],
        CAST(NULL AS INT) AS [source_port],
        CAST(NULL AS INT) AS [target_port],
        CAST(N'Synthetic load generation' AS NVARCHAR(255)) AS [observation_method]
      FROM environment_assets AS left_env
      INNER JOIN environment_assets AS right_env
        ON right_env.[system_id] = left_env.[system_id]
       AND right_env.[environment_id] = left_env.[environment_id]
       AND right_env.[rn] = left_env.[rn] + 1
      WHERE left_env.[rn] <= 4
    ),
    app_assets AS (
      SELECT
        sea.[system_id],
        sea.[environment_id],
        sea.[asset_id],
        ROW_NUMBER() OVER (
          PARTITION BY sea.[system_id], sea.[environment_id]
          ORDER BY sea.[asset_id]
        ) AS [rn]
      FROM [tsaat].[system_environment_asset] AS sea
      INNER JOIN [tsaat].[asset] AS a
        ON a.[snapshot_id] = sea.[snapshot_id]
       AND a.[asset_id] = sea.[asset_id]
      WHERE sea.[snapshot_id] = @SnapshotId
        AND a.[asset_type] IN (N'server', N'workstation')
    ),
    network_device_assets AS (
      SELECT
        sea.[system_id],
        sea.[environment_id],
        sea.[asset_id],
        ROW_NUMBER() OVER (
          PARTITION BY sea.[system_id], sea.[environment_id]
          ORDER BY sea.[asset_id]
        ) AS [rn]
      FROM [tsaat].[system_environment_asset] AS sea
      INNER JOIN [tsaat].[asset] AS a
        ON a.[snapshot_id] = sea.[snapshot_id]
       AND a.[asset_id] = sea.[asset_id]
      WHERE sea.[snapshot_id] = @SnapshotId
        AND a.[asset_type] = N'network-device'
    ),
    flow_edges_environment AS (
      SELECT
        CONCAT(
          N'auto-flow-env-',
          app.[system_id],
          N'-',
          app.[environment_id]
        ) AS [dependency_id],
        app.[asset_id] AS [source_asset_id],
        dev.[asset_id] AS [target_asset_id],
        N'Flow Dependency' AS [dependency_type],
        CAST(N'TCP' AS NVARCHAR(20)) AS [flow_protocol],
        CAST(54000 AS INT) AS [source_port],
        CAST(443 AS INT) AS [target_port],
        CAST(N'Synthetic load generation' AS NVARCHAR(255)) AS [observation_method]
      FROM app_assets AS app
      INNER JOIN network_device_assets AS dev
        ON dev.[system_id] = app.[system_id]
       AND dev.[environment_id] = app.[environment_id]
      WHERE app.[rn] = 1
        AND dev.[rn] = 1
    ),
    network_system_assets AS (
      SELECT
        a.[network_id],
        a.[system_id],
        MIN(a.[asset_id]) AS [first_asset_id]
      FROM [tsaat].[asset] AS a
      INNER JOIN [tsaat].[ict_system] AS s
        ON s.[snapshot_id] = a.[snapshot_id]
       AND s.[system_id] = a.[system_id]
      WHERE a.[snapshot_id] = @SnapshotId
        AND a.[system_id] IS NOT NULL
        AND s.[modelling_status] = 1
      GROUP BY a.[network_id], a.[system_id]
    ),
    network_ordered AS (
      SELECT
        nsa.[network_id],
        nsa.[system_id],
        nsa.[first_asset_id],
        ROW_NUMBER() OVER (
          PARTITION BY nsa.[network_id]
          ORDER BY nsa.[system_id]
        ) AS [rn]
      FROM network_system_assets AS nsa
    ),
    flow_edges_network AS (
      SELECT
        CONCAT(
          N'auto-flow-net-',
          current_net.[network_id],
          N'-',
          current_net.[rn]
        ) AS [dependency_id],
        current_net.[first_asset_id] AS [source_asset_id],
        next_net.[first_asset_id] AS [target_asset_id],
        N'Flow Dependency' AS [dependency_type],
        CAST(N'TCP' AS NVARCHAR(20)) AS [flow_protocol],
        CAST(55000 AS INT) AS [source_port],
        CAST(8443 AS INT) AS [target_port],
        CAST(N'Synthetic load generation' AS NVARCHAR(255)) AS [observation_method]
      FROM network_ordered AS current_net
      INNER JOIN network_ordered AS next_net
        ON next_net.[network_id] = current_net.[network_id]
       AND next_net.[rn] = current_net.[rn] + 1
    ),
    modelled_assets AS (
      SELECT
        a.[asset_id],
        ROW_NUMBER() OVER (ORDER BY a.[asset_id]) AS [rn]
      FROM [tsaat].[asset] AS a
      INNER JOIN [tsaat].[ict_system] AS s
        ON s.[snapshot_id] = a.[snapshot_id]
       AND s.[system_id] = a.[system_id]
      WHERE a.[snapshot_id] = @SnapshotId
        AND s.[modelling_status] = 1
    ),
    unmodelled_assets AS (
      SELECT
        a.[asset_id],
        ROW_NUMBER() OVER (ORDER BY a.[asset_id]) AS [rn]
      FROM [tsaat].[asset] AS a
      LEFT JOIN [tsaat].[ict_system] AS s
        ON s.[snapshot_id] = a.[snapshot_id]
       AND s.[system_id] = a.[system_id]
      WHERE a.[snapshot_id] = @SnapshotId
        AND (a.[system_id] IS NULL OR s.[modelling_status] = 0 OR s.[system_id] IS NULL)
    ),
    logical_edges_unmodelled AS (
      SELECT
        CONCAT(N'auto-logical-unmodelled-', unm.[rn]) AS [dependency_id],
        mdl.[asset_id] AS [source_asset_id],
        unm.[asset_id] AS [target_asset_id],
        N'Logical Dependency' AS [dependency_type],
        CAST(NULL AS NVARCHAR(20)) AS [flow_protocol],
        CAST(NULL AS INT) AS [source_port],
        CAST(NULL AS INT) AS [target_port],
        CAST(N'Synthetic load generation' AS NVARCHAR(255)) AS [observation_method]
      FROM modelled_assets AS mdl
      INNER JOIN unmodelled_assets AS unm
        ON unm.[rn] = mdl.[rn]
      WHERE unm.[rn] <= 140
    ),
    all_edges AS (
      SELECT * FROM logical_edges
      UNION ALL
      SELECT * FROM flow_edges_environment
      UNION ALL
      SELECT * FROM flow_edges_network
      UNION ALL
      SELECT * FROM logical_edges_unmodelled
    ),
    deduped AS (
      SELECT
        ae.[dependency_id],
        ae.[source_asset_id],
        ae.[target_asset_id],
        ae.[dependency_type],
        ae.[flow_protocol],
        ae.[source_port],
        ae.[target_port],
        ae.[observation_method],
        ROW_NUMBER() OVER (
          PARTITION BY ae.[source_asset_id], ae.[target_asset_id], ae.[dependency_type]
          ORDER BY ae.[dependency_id]
        ) AS [dedupe_rank]
      FROM all_edges AS ae
      WHERE ae.[source_asset_id] <> ae.[target_asset_id]
    )
    INSERT INTO [tsaat].[ci_dependency] (
      [snapshot_id],
      [dependency_id],
      [source_asset_id],
      [target_asset_id],
      [dependency_type],
      [flow_protocol],
      [source_port],
      [target_port],
      [observation_method],
      [observed_at]
    )
    SELECT
      @SnapshotId,
      deduped.[dependency_id],
      deduped.[source_asset_id],
      deduped.[target_asset_id],
      deduped.[dependency_type],
      deduped.[flow_protocol],
      deduped.[source_port],
      deduped.[target_port],
      deduped.[observation_method],
      COALESCE(
        TRY_CONVERT(DATETIMEOFFSET(7), JSON_VALUE(@Json, '$.generatedAt')),
        SYSDATETIMEOFFSET()
      )
    FROM deduped
    WHERE deduped.[dedupe_rank] = 1
      AND EXISTS (
        SELECT 1
        FROM [tsaat].[asset] AS src
        WHERE src.[snapshot_id] = @SnapshotId
          AND src.[asset_id] = deduped.[source_asset_id]
      )
      AND EXISTS (
        SELECT 1
        FROM [tsaat].[asset] AS tgt
        WHERE tgt.[snapshot_id] = @SnapshotId
          AND tgt.[asset_id] = deduped.[target_asset_id]
      );
  END;

  INSERT INTO [tsaat].[finding] (
    [snapshot_id],
    [finding_id],
    [spi_id],
    [priority_rank],
    [severity],
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
    [closed_at]
  )
  SELECT
    @SnapshotId,
    f.[id],
    f.[spi_id],
    f.[priority_rank],
    f.[severity],
    f.[compliance_status],
    f.[network_id],
    f.[system_id],
    f.[environment_type],
    f.[asset_id],
    f.[title],
    COALESCE(f.[evidence], N'{}'),
    f.[recommended_action],
    f.[workflow_status],
    f.[observed_at],
    f.[closed_at]
  FROM OPENJSON(@Json, '$.findings') WITH (
    [id] NVARCHAR(255) '$.id',
    [spi_id] SMALLINT '$.spiId',
    [priority_rank] INT '$.priorityRank',
    [severity] NVARCHAR(30) '$.severity',
    [compliance_status] NVARCHAR(20) '$.complianceStatus',
    [network_id] NVARCHAR(255) '$.scope.networkId',
    [system_id] NVARCHAR(255) '$.scope.systemId',
    [environment_type] NVARCHAR(20) '$.scope.environmentType',
    [asset_id] NVARCHAR(255) '$.scope.assetId',
    [title] NVARCHAR(1000) '$.title',
    [evidence] NVARCHAR(MAX) '$.evidence' AS JSON,
    [recommended_action] NVARCHAR(MAX) '$.recommendedAction',
    [workflow_status] NVARCHAR(10) '$.status',
    [observed_at] DATETIMEOFFSET(7) '$.timestamp',
    [closed_at] DATETIMEOFFSET(7) '$.closedTimestamp'
  ) AS f;

  PRINT CONCAT('Loaded snapshot ', @SnapshotId, ' from ', @SnapshotFile);

  FETCH NEXT FROM snapshot_cursor INTO @SnapshotId, @SnapshotFile;
END;

CLOSE snapshot_cursor;
DEALLOCATE snapshot_cursor;

SET IDENTITY_INSERT [tsaat].[dataset_snapshot] OFF;

PRINT 'Data load complete.';
