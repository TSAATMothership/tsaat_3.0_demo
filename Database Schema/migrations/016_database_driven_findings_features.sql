SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

IF OBJECT_ID(N'tsaat.finding_source_policy', N'U') IS NULL
BEGIN
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
END;
GO

IF OBJECT_ID(N'tsaat.finding_generation_policy', N'U') IS NULL
BEGIN
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
END;
GO

IF OBJECT_ID(N'tsaat.finding_workflow_status_definition', N'U') IS NULL
BEGIN
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
END;
GO

IF OBJECT_ID(N'tsaat.finding_bucket_definition', N'U') IS NULL
BEGIN
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
END;
GO

IF OBJECT_ID(N'tsaat.finding_evidence_field_definition', N'U') IS NULL
BEGIN
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
END;
GO

IF OBJECT_ID(N'tsaat.finding_register_column_definition', N'U') IS NULL
BEGIN
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
END;
GO

DECLARE @FindingDefinitionJson NVARCHAR(MAX) = N'{
  "updatedAt": "2026-05-25T00:00:00.000Z",
  "sourcePolicies": [
    {
      "policyKey": "persisted-first",
      "displayOrder": 1,
      "name": "Persisted Findings First",
      "description": "Use persisted findings when available for a snapshot; generate deterministic SPI findings only when the snapshot has no persisted findings.",
      "usePersistedFindings": true,
      "generateWhenEmpty": true,
      "enabled": true
    }
  ],
  "generationPolicies": [
    {
      "policyKey": "persisted-first",
      "historyStartDate": "2024-02-10",
      "historyWindowYears": 2,
      "baselineBacklogCount": 200,
      "minOpenCount": 180,
      "maxOpenCount": 320,
      "addProbabilityPercent": 38,
      "addRateMinPercent": 0,
      "addRateMaxPercent": 40,
      "closeRateMinPercent": 10,
      "closeRateMaxPercent": 20,
      "closeBackfillMinCount": 1,
      "closeBackfillMaxCount": 3,
      "timezoneOffsetMinutes": -300
    }
  ],
  "workflowStatuses": [
    { "statusKey": "open", "label": "Open", "displayOrder": 1, "toneKey": "warning", "terminalStatus": false },
    { "statusKey": "closed", "label": "Closed", "displayOrder": 2, "toneKey": "success", "terminalStatus": true }
  ],
  "buckets": [
    {
      "bucketKey": "critical-exposure",
      "bucketType": "severity",
      "label": "Critical Exposure",
      "displayOrder": 1,
      "toneKey": "critical",
      "conditionKey": "severity_equals",
      "severityKey": "Critical Exposure",
      "priorityMin": null,
      "priorityMax": null,
      "workflowStatus": null,
      "enabled": true,
      "description": "Findings whose display severity is Critical Exposure."
    },
    {
      "bucketKey": "high-risk",
      "bucketType": "severity",
      "label": "High Risk",
      "displayOrder": 2,
      "toneKey": "warning",
      "conditionKey": "severity_equals",
      "severityKey": "High Risk",
      "priorityMin": null,
      "priorityMax": null,
      "workflowStatus": null,
      "enabled": true,
      "description": "Findings whose display severity is High Risk."
    },
    {
      "bucketKey": "major",
      "bucketType": "severity",
      "label": "Major",
      "displayOrder": 3,
      "toneKey": "major",
      "conditionKey": "severity_equals",
      "severityKey": "Major",
      "priorityMin": null,
      "priorityMax": null,
      "workflowStatus": null,
      "enabled": true,
      "description": "Findings whose display severity is Major."
    },
    {
      "bucketKey": "moderate",
      "bucketType": "severity",
      "label": "Moderate",
      "displayOrder": 4,
      "toneKey": "info",
      "conditionKey": "severity_equals",
      "severityKey": "Moderate",
      "priorityMin": null,
      "priorityMax": null,
      "workflowStatus": null,
      "enabled": true,
      "description": "Findings whose display severity is Moderate."
    },
    {
      "bucketKey": "data-gap",
      "bucketType": "severity",
      "label": "Data Gap",
      "displayOrder": 5,
      "toneKey": "neutral",
      "conditionKey": "severity_equals",
      "severityKey": "Data Gap",
      "priorityMin": null,
      "priorityMax": null,
      "workflowStatus": null,
      "enabled": true,
      "description": "Findings whose display severity is Data Gap."
    },
    {
      "bucketKey": "priority-1-2",
      "bucketType": "priority",
      "label": "P1-P2",
      "displayOrder": 10,
      "toneKey": "critical",
      "conditionKey": "priority_between",
      "severityKey": null,
      "priorityMin": 1,
      "priorityMax": 2,
      "workflowStatus": null,
      "enabled": true,
      "description": "Immediate action priority findings."
    },
    {
      "bucketKey": "priority-data-gap",
      "bucketType": "priority",
      "label": "P90 Data Gap",
      "displayOrder": 11,
      "toneKey": "neutral",
      "conditionKey": "priority_equals",
      "severityKey": null,
      "priorityMin": 90,
      "priorityMax": 90,
      "workflowStatus": null,
      "enabled": true,
      "description": "Data-gap priority findings."
    },
    {
      "bucketKey": "open",
      "bucketType": "workflow",
      "label": "Open",
      "displayOrder": 20,
      "toneKey": "warning",
      "conditionKey": "workflow_equals",
      "severityKey": null,
      "priorityMin": null,
      "priorityMax": null,
      "workflowStatus": "open",
      "enabled": true,
      "description": "Findings open at the selected as-of date."
    },
    {
      "bucketKey": "closed",
      "bucketType": "workflow",
      "label": "Closed",
      "displayOrder": 21,
      "toneKey": "success",
      "conditionKey": "workflow_equals",
      "severityKey": null,
      "priorityMin": null,
      "priorityMax": null,
      "workflowStatus": "closed",
      "enabled": true,
      "description": "Findings closed at the selected as-of date."
    },
    {
      "bucketKey": "other-risk",
      "bucketType": "severity",
      "label": "Other",
      "displayOrder": 99,
      "toneKey": "info",
      "conditionKey": "severity_not_in",
      "severityKey": "Critical Exposure|High Risk",
      "priorityMin": null,
      "priorityMax": null,
      "workflowStatus": null,
      "enabled": true,
      "description": "Findings that are not Critical Exposure or High Risk."
    }
  ],
  "evidenceFields": [
    {
      "fieldKey": "asset-name",
      "displayOrder": 1,
      "label": "Asset Name",
      "purposeKey": "asset_name",
      "candidateKeys": ["assetName", "asset_name", "hostname", "assetHostname"],
      "fallbackValue": null,
      "enabled": true
    },
    {
      "fieldKey": "asset-ip-address",
      "displayOrder": 2,
      "label": "Asset IP address",
      "purposeKey": "asset_ip_address",
      "candidateKeys": ["assetIpAddress", "assetIp", "ipAddress", "ip", "ipv4Address", "ipv4", "ip_address"],
      "fallbackValue": "Not available",
      "enabled": true
    },
    {
      "fieldKey": "asset-type",
      "displayOrder": 3,
      "label": "Asset Type",
      "purposeKey": "asset_type",
      "candidateKeys": ["assetType", "asset_type", "type"],
      "fallbackValue": "Unknown",
      "enabled": true
    },
    {
      "fieldKey": "change-assignment-group",
      "displayOrder": 4,
      "label": "Asset Change Assignment Group",
      "purposeKey": "change_assignment_group",
      "candidateKeys": ["assetChangeAssignmentGroup", "changeAssignmentGroup", "changeGroup", "change_assignment_group"],
      "fallbackValue": "Not assigned",
      "enabled": true
    },
    {
      "fieldKey": "incident-assignment-group",
      "displayOrder": 5,
      "label": "Asset Incident Assignment Group",
      "purposeKey": "incident_assignment_group",
      "candidateKeys": ["assetIncidentAssignmentGroup", "incidentAssignmentGroup", "incidentGroup", "incident_assignment_group"],
      "fallbackValue": "Not assigned",
      "enabled": true
    },
    {
      "fieldKey": "owner",
      "displayOrder": 6,
      "label": "Owner",
      "purposeKey": "owner",
      "candidateKeys": ["assetOwner", "owner", "serviceOwner"],
      "fallbackValue": "Not assigned",
      "enabled": true
    },
    {
      "fieldKey": "evidence-preview-1",
      "displayOrder": 20,
      "label": "Evidence Preview",
      "purposeKey": "evidence_preview",
      "candidateKeys": [],
      "fallbackValue": "No evidence captured",
      "enabled": true
    }
  ],
  "registerColumns": [
    { "columnKey": "measure", "label": "Measure", "displayOrder": 1, "valueKey": "measure", "enabled": true },
    { "columnKey": "severity", "label": "Severity", "displayOrder": 2, "valueKey": "severity", "enabled": true },
    { "columnKey": "timestamp", "label": "Timestamp", "displayOrder": 3, "valueKey": "timestamp", "enabled": true },
    { "columnKey": "title", "label": "Title", "displayOrder": 4, "valueKey": "title", "enabled": true },
    { "columnKey": "status", "label": "Status", "displayOrder": 5, "valueKey": "status", "enabled": true },
    { "columnKey": "evidence", "label": "Evidence", "displayOrder": 6, "valueKey": "evidence_preview", "enabled": true },
    { "columnKey": "recommended-action", "label": "Recommended Action", "displayOrder": 7, "valueKey": "recommended_action", "enabled": true }
  ]
}
';

MERGE [tsaat].[finding_source_policy] AS target
USING (
  SELECT
    source_policy.[policy_key],
    source_policy.[display_order],
    source_policy.[name],
    source_policy.[description],
    source_policy.[use_persisted_findings],
    source_policy.[generate_when_empty],
    source_policy.[enabled]
  FROM OPENJSON(@FindingDefinitionJson, '$.sourcePolicies') WITH (
    [policy_key] NVARCHAR(100) '$.policyKey',
    [display_order] INT '$.displayOrder',
    [name] NVARCHAR(255) '$.name',
    [description] NVARCHAR(1000) '$.description',
    [use_persisted_findings] BIT '$.usePersistedFindings',
    [generate_when_empty] BIT '$.generateWhenEmpty',
    [enabled] BIT '$.enabled'
  ) AS source_policy
) AS source
ON target.[policy_key] = source.[policy_key]
WHEN MATCHED THEN
  UPDATE SET
    [display_order] = source.[display_order],
    [name] = source.[name],
    [description] = source.[description],
    [use_persisted_findings] = source.[use_persisted_findings],
    [generate_when_empty] = source.[generate_when_empty],
    [enabled] = source.[enabled]
WHEN NOT MATCHED THEN
  INSERT ([policy_key], [display_order], [name], [description], [use_persisted_findings], [generate_when_empty], [enabled])
  VALUES (source.[policy_key], source.[display_order], source.[name], source.[description], source.[use_persisted_findings], source.[generate_when_empty], source.[enabled]);

MERGE [tsaat].[finding_generation_policy] AS target
USING (
  SELECT
    generation_policy.[policy_key],
    generation_policy.[history_start_date],
    generation_policy.[history_window_years],
    generation_policy.[baseline_backlog_count],
    generation_policy.[min_open_count],
    generation_policy.[max_open_count],
    generation_policy.[add_probability_percent],
    generation_policy.[add_rate_min_percent],
    generation_policy.[add_rate_max_percent],
    generation_policy.[close_rate_min_percent],
    generation_policy.[close_rate_max_percent],
    generation_policy.[close_backfill_min_count],
    generation_policy.[close_backfill_max_count],
    generation_policy.[timezone_offset_minutes]
  FROM OPENJSON(@FindingDefinitionJson, '$.generationPolicies') WITH (
    [policy_key] NVARCHAR(100) '$.policyKey',
    [history_start_date] DATE '$.historyStartDate',
    [history_window_years] INT '$.historyWindowYears',
    [baseline_backlog_count] INT '$.baselineBacklogCount',
    [min_open_count] INT '$.minOpenCount',
    [max_open_count] INT '$.maxOpenCount',
    [add_probability_percent] INT '$.addProbabilityPercent',
    [add_rate_min_percent] INT '$.addRateMinPercent',
    [add_rate_max_percent] INT '$.addRateMaxPercent',
    [close_rate_min_percent] INT '$.closeRateMinPercent',
    [close_rate_max_percent] INT '$.closeRateMaxPercent',
    [close_backfill_min_count] INT '$.closeBackfillMinCount',
    [close_backfill_max_count] INT '$.closeBackfillMaxCount',
    [timezone_offset_minutes] INT '$.timezoneOffsetMinutes'
  ) AS generation_policy
) AS source
ON target.[policy_key] = source.[policy_key]
WHEN MATCHED THEN
  UPDATE SET
    [history_start_date] = source.[history_start_date],
    [history_window_years] = source.[history_window_years],
    [baseline_backlog_count] = source.[baseline_backlog_count],
    [min_open_count] = source.[min_open_count],
    [max_open_count] = source.[max_open_count],
    [add_probability_percent] = source.[add_probability_percent],
    [add_rate_min_percent] = source.[add_rate_min_percent],
    [add_rate_max_percent] = source.[add_rate_max_percent],
    [close_rate_min_percent] = source.[close_rate_min_percent],
    [close_rate_max_percent] = source.[close_rate_max_percent],
    [close_backfill_min_count] = source.[close_backfill_min_count],
    [close_backfill_max_count] = source.[close_backfill_max_count],
    [timezone_offset_minutes] = source.[timezone_offset_minutes]
WHEN NOT MATCHED THEN
  INSERT ([policy_key], [history_start_date], [history_window_years], [baseline_backlog_count], [min_open_count], [max_open_count], [add_probability_percent], [add_rate_min_percent], [add_rate_max_percent], [close_rate_min_percent], [close_rate_max_percent], [close_backfill_min_count], [close_backfill_max_count], [timezone_offset_minutes])
  VALUES (source.[policy_key], source.[history_start_date], source.[history_window_years], source.[baseline_backlog_count], source.[min_open_count], source.[max_open_count], source.[add_probability_percent], source.[add_rate_min_percent], source.[add_rate_max_percent], source.[close_rate_min_percent], source.[close_rate_max_percent], source.[close_backfill_min_count], source.[close_backfill_max_count], source.[timezone_offset_minutes]);

MERGE [tsaat].[finding_workflow_status_definition] AS target
USING (
  SELECT
    workflow.[status_key],
    workflow.[label],
    workflow.[display_order],
    workflow.[tone_key],
    workflow.[terminal_status]
  FROM OPENJSON(@FindingDefinitionJson, '$.workflowStatuses') WITH (
    [status_key] NVARCHAR(10) '$.statusKey',
    [label] NVARCHAR(80) '$.label',
    [display_order] INT '$.displayOrder',
    [tone_key] NVARCHAR(40) '$.toneKey',
    [terminal_status] BIT '$.terminalStatus'
  ) AS workflow
) AS source
ON target.[status_key] = source.[status_key]
WHEN MATCHED THEN
  UPDATE SET
    [label] = source.[label],
    [display_order] = source.[display_order],
    [tone_key] = source.[tone_key],
    [terminal_status] = source.[terminal_status]
WHEN NOT MATCHED THEN
  INSERT ([status_key], [label], [display_order], [tone_key], [terminal_status])
  VALUES (source.[status_key], source.[label], source.[display_order], source.[tone_key], source.[terminal_status]);

MERGE [tsaat].[finding_bucket_definition] AS target
USING (
  SELECT
    bucket.[bucket_key],
    bucket.[bucket_type],
    bucket.[label],
    bucket.[display_order],
    bucket.[tone_key],
    bucket.[condition_key],
    bucket.[severity_key],
    bucket.[priority_min],
    bucket.[priority_max],
    bucket.[workflow_status],
    bucket.[enabled],
    bucket.[description]
  FROM OPENJSON(@FindingDefinitionJson, '$.buckets') WITH (
    [bucket_key] NVARCHAR(100) '$.bucketKey',
    [bucket_type] NVARCHAR(40) '$.bucketType',
    [label] NVARCHAR(100) '$.label',
    [display_order] INT '$.displayOrder',
    [tone_key] NVARCHAR(40) '$.toneKey',
    [condition_key] NVARCHAR(40) '$.conditionKey',
    [severity_key] NVARCHAR(255) '$.severityKey',
    [priority_min] INT '$.priorityMin',
    [priority_max] INT '$.priorityMax',
    [workflow_status] NVARCHAR(10) '$.workflowStatus',
    [enabled] BIT '$.enabled',
    [description] NVARCHAR(1000) '$.description'
  ) AS bucket
) AS source
ON target.[bucket_key] = source.[bucket_key]
WHEN MATCHED THEN
  UPDATE SET
    [bucket_type] = source.[bucket_type],
    [label] = source.[label],
    [display_order] = source.[display_order],
    [tone_key] = source.[tone_key],
    [condition_key] = source.[condition_key],
    [severity_key] = source.[severity_key],
    [priority_min] = source.[priority_min],
    [priority_max] = source.[priority_max],
    [workflow_status] = source.[workflow_status],
    [enabled] = source.[enabled],
    [description] = source.[description]
WHEN NOT MATCHED THEN
  INSERT ([bucket_key], [bucket_type], [label], [display_order], [tone_key], [condition_key], [severity_key], [priority_min], [priority_max], [workflow_status], [enabled], [description])
  VALUES (source.[bucket_key], source.[bucket_type], source.[label], source.[display_order], source.[tone_key], source.[condition_key], source.[severity_key], source.[priority_min], source.[priority_max], source.[workflow_status], source.[enabled], source.[description]);

MERGE [tsaat].[finding_evidence_field_definition] AS target
USING (
  SELECT
    evidence_field.[field_key],
    evidence_field.[display_order],
    evidence_field.[label],
    evidence_field.[purpose_key],
    JSON_QUERY(evidence_field.[candidate_keys_json]) AS [candidate_keys_json],
    evidence_field.[fallback_value],
    evidence_field.[enabled]
  FROM OPENJSON(@FindingDefinitionJson, '$.evidenceFields') WITH (
    [field_key] NVARCHAR(100) '$.fieldKey',
    [display_order] INT '$.displayOrder',
    [label] NVARCHAR(120) '$.label',
    [purpose_key] NVARCHAR(100) '$.purposeKey',
    [candidate_keys_json] NVARCHAR(MAX) '$.candidateKeys' AS JSON,
    [fallback_value] NVARCHAR(255) '$.fallbackValue',
    [enabled] BIT '$.enabled'
  ) AS evidence_field
) AS source
ON target.[field_key] = source.[field_key]
WHEN MATCHED THEN
  UPDATE SET
    [display_order] = source.[display_order],
    [label] = source.[label],
    [purpose_key] = source.[purpose_key],
    [candidate_keys_json] = COALESCE(source.[candidate_keys_json], N'[]'),
    [fallback_value] = source.[fallback_value],
    [enabled] = source.[enabled]
WHEN NOT MATCHED THEN
  INSERT ([field_key], [display_order], [label], [purpose_key], [candidate_keys_json], [fallback_value], [enabled])
  VALUES (source.[field_key], source.[display_order], source.[label], source.[purpose_key], COALESCE(source.[candidate_keys_json], N'[]'), source.[fallback_value], source.[enabled]);

MERGE [tsaat].[finding_register_column_definition] AS target
USING (
  SELECT
    register_column.[column_key],
    register_column.[label],
    register_column.[display_order],
    register_column.[value_key],
    register_column.[enabled]
  FROM OPENJSON(@FindingDefinitionJson, '$.registerColumns') WITH (
    [column_key] NVARCHAR(100) '$.columnKey',
    [label] NVARCHAR(120) '$.label',
    [display_order] INT '$.displayOrder',
    [value_key] NVARCHAR(100) '$.valueKey',
    [enabled] BIT '$.enabled'
  ) AS register_column
) AS source
ON target.[column_key] = source.[column_key]
WHEN MATCHED THEN
  UPDATE SET
    [label] = source.[label],
    [display_order] = source.[display_order],
    [value_key] = source.[value_key],
    [enabled] = source.[enabled]
WHEN NOT MATCHED THEN
  INSERT ([column_key], [label], [display_order], [value_key], [enabled])
  VALUES (source.[column_key], source.[label], source.[display_order], source.[value_key], source.[enabled]);

COMMIT TRANSACTION;
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
