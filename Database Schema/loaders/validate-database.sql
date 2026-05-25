SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @SnapshotCount INT = (SELECT COUNT(*) FROM [tsaat].[dataset_snapshot]);
DECLARE @SpiCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_definition]);
DECLARE @SeverityCount INT = (SELECT COUNT(*) FROM [tsaat].[finding_severity_definition]);
DECLARE @PriorityDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[finding_priority_definition]);
DECLARE @FindingSourcePolicyCount INT = (SELECT COUNT(*) FROM [tsaat].[finding_source_policy]);
DECLARE @FindingGenerationPolicyCount INT = (SELECT COUNT(*) FROM [tsaat].[finding_generation_policy]);
DECLARE @FindingWorkflowStatusDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[finding_workflow_status_definition]);
DECLARE @FindingBucketDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[finding_bucket_definition]);
DECLARE @FindingEvidenceFieldDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[finding_evidence_field_definition]);
DECLARE @FindingRegisterColumnDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[finding_register_column_definition]);
DECLARE @SpiRuleDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_rule_definition]);
DECLARE @SpiRuleParameterDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_rule_parameter_definition]);
DECLARE @SpiRuleOutcomeTemplateCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_rule_outcome_template]);
DECLARE @SpiReportDetailDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_report_detail_definition]);
DECLARE @SpiCalculationSourceCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_calculation_source]);
DECLARE @SpiCalculationDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_calculation_definition]);
DECLARE @SpiCalculationEvidenceCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_calculation_evidence_expression]);
DECLARE @SpiFeatureBindingCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_feature_binding]);
DECLARE @SpiFindingClassificationRuleCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_finding_classification_rule]);
DECLARE @SpiRuleParameterCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_rule_parameter]);
DECLARE @SpiTaskingTeamCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_tasking_team]);
DECLARE @SpiTaskingActionCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_tasking_action_template]);
DECLARE @SpiTaskingConditionCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_tasking_condition_template]);
DECLARE @KpiCount INT = (SELECT COUNT(*) FROM [tsaat].[kpi_definition]);
DECLARE @KpiCalculationSourceCount INT = (SELECT COUNT(*) FROM [tsaat].[kpi_calculation_source]);
DECLARE @KpiCalculationDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[kpi_calculation_definition]);
DECLARE @KpiTaskingTeamCount INT = (SELECT COUNT(*) FROM [tsaat].[kpi_tasking_team]);
DECLARE @KpiTaskingActionCount INT = (SELECT COUNT(*) FROM [tsaat].[kpi_tasking_action_template]);
DECLARE @KpiTaskingConditionCount INT = (SELECT COUNT(*) FROM [tsaat].[kpi_tasking_condition_template]);
DECLARE @KpiReportDetailDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[kpi_report_detail_definition]);
DECLARE @KpiReportDetailBindingCount INT = (SELECT COUNT(*) FROM [tsaat].[kpi_report_detail_binding]);
DECLARE @AssetCount BIGINT = (SELECT COUNT(*) FROM [tsaat].[asset]);
DECLARE @FindingCount BIGINT = (SELECT COUNT(*) FROM [tsaat].[finding]);
DECLARE @CiDependencyCount BIGINT = (SELECT COUNT(*) FROM [tsaat].[ci_dependency]);
DECLARE @DiscoveryToolCount INT = (SELECT COUNT(*) FROM [tsaat].[discovery_tool]);
DECLARE @DiscoveryCoverageSourceCount INT = (SELECT COUNT(*) FROM [tsaat].[discovery_coverage_source]);
DECLARE @DiscoveryDetectionDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[discovery_tool_detection_definition]);
DECLARE @DiscoveryDetectionRuleCount INT = (SELECT COUNT(*) FROM [tsaat].[discovery_tool_detection_rule]);
DECLARE @MeasureSeverityCount INT = (SELECT COUNT(*) FROM [tsaat].[measures_severity_matrix]);
DECLARE @MeasurePriorityCount INT = (SELECT COUNT(*) FROM [tsaat].[measures_priority_matrix]);
DECLARE @NetworkTargetStateAssetCount BIGINT = (SELECT COUNT(*) FROM [tsaat].[network_target_state_asset]);

IF @SnapshotCount <> 8
  THROW 52000, 'Validation failed: dataset_snapshot count must be 8.', 1;

IF @SpiCount < 10
  THROW 52000, 'Validation failed: spi_definition count must be at least 10.', 1;

IF @SeverityCount < 5
  THROW 52000, 'Validation failed: finding_severity_definition count must be at least 5.', 1;

IF @PriorityDefinitionCount < 8
  THROW 52000, 'Validation failed: finding_priority_definition count must include selectable priorities and data-gap priority.', 1;

IF @FindingSourcePolicyCount <= 0
  THROW 52000, 'Validation failed: finding_source_policy table is empty.', 1;

IF @FindingGenerationPolicyCount <= 0
  THROW 52000, 'Validation failed: finding_generation_policy table is empty.', 1;

IF @FindingWorkflowStatusDefinitionCount < 2
  THROW 52000, 'Validation failed: finding_workflow_status_definition must include open and closed statuses.', 1;

IF @FindingBucketDefinitionCount < 5
  THROW 52000, 'Validation failed: finding_bucket_definition count must include severity, priority, and workflow buckets.', 1;

IF @FindingEvidenceFieldDefinitionCount < 6
  THROW 52000, 'Validation failed: finding_evidence_field_definition count must include register evidence mappings.', 1;

IF @FindingRegisterColumnDefinitionCount < 7
  THROW 52000, 'Validation failed: finding_register_column_definition count must include register display columns.', 1;

IF @SpiRuleDefinitionCount < 10
  THROW 52000, 'Validation failed: spi_rule_definition count must be at least 10.', 1;

IF @SpiRuleParameterDefinitionCount <= 0
  THROW 52000, 'Validation failed: spi_rule_parameter_definition table is empty.', 1;

IF @SpiRuleOutcomeTemplateCount <= 0
  THROW 52000, 'Validation failed: spi_rule_outcome_template table is empty.', 1;

IF @SpiReportDetailDefinitionCount <= 0
  THROW 52000, 'Validation failed: spi_report_detail_definition table is empty.', 1;

IF @SpiCalculationSourceCount <= 0
  THROW 52000, 'Validation failed: spi_calculation_source table is empty.', 1;

IF @SpiCalculationDefinitionCount < 10
  THROW 52000, 'Validation failed: spi_calculation_definition count must be at least 10.', 1;

IF @SpiCalculationEvidenceCount < 10
  THROW 52000, 'Validation failed: spi_calculation_evidence_expression count must be at least 10.', 1;

IF @SpiFeatureBindingCount < 5
  THROW 52000, 'Validation failed: spi_feature_binding count must be at least 5.', 1;

IF @SpiFindingClassificationRuleCount <= 0
  THROW 52000, 'Validation failed: spi_finding_classification_rule table is empty.', 1;

IF @SpiRuleParameterCount <= 0
  THROW 52000, 'Validation failed: spi_rule_parameter table is empty.', 1;

IF @SpiTaskingTeamCount <= 0
  THROW 52000, 'Validation failed: spi_tasking_team table is empty.', 1;

IF @SpiTaskingActionCount <= 0
  THROW 52000, 'Validation failed: spi_tasking_action_template table is empty.', 1;

IF @SpiTaskingConditionCount <= 0
  THROW 52000, 'Validation failed: spi_tasking_condition_template table is empty.', 1;

IF @KpiCount <= 0
  THROW 52000, 'Validation failed: kpi_definition table is empty.', 1;

IF @KpiCalculationSourceCount <= 0
  THROW 52000, 'Validation failed: kpi_calculation_source table is empty.', 1;

IF @KpiCalculationDefinitionCount < 10
  THROW 52000, 'Validation failed: kpi_calculation_definition count must be at least 10.', 1;

IF @KpiTaskingTeamCount <= 0
  THROW 52000, 'Validation failed: kpi_tasking_team table is empty.', 1;

IF @KpiTaskingActionCount <= 0
  THROW 52000, 'Validation failed: kpi_tasking_action_template table is empty.', 1;

IF @KpiTaskingConditionCount <= 0
  THROW 52000, 'Validation failed: kpi_tasking_condition_template table is empty.', 1;

IF @KpiReportDetailDefinitionCount <= 0
  THROW 52000, 'Validation failed: kpi_report_detail_definition table is empty.', 1;

IF @KpiReportDetailBindingCount < 3
  THROW 52000, 'Validation failed: kpi_report_detail_binding must include the seeded KPI detail bindings.', 1;

IF @AssetCount <= 0
  THROW 52000, 'Validation failed: asset table is empty.', 1;

IF @FindingCount <= 0
  THROW 52000, 'Validation failed: finding table is empty.', 1;

IF @CiDependencyCount <= 0
  THROW 52000, 'Validation failed: ci_dependency table is empty.', 1;

IF @DiscoveryToolCount <= 0
  THROW 52000, 'Validation failed: discovery_tool table is empty.', 1;

IF @DiscoveryCoverageSourceCount <= 0
  THROW 52000, 'Validation failed: discovery_coverage_source table is empty.', 1;

IF @DiscoveryDetectionDefinitionCount < 7
  THROW 52000, 'Validation failed: discovery_tool_detection_definition count must include seeded discovery tools.', 1;

IF @DiscoveryDetectionRuleCount < 7
  THROW 52000, 'Validation failed: discovery_tool_detection_rule count must include seeded discovery coverage rules.', 1;

IF @MeasureSeverityCount <= 0
  THROW 52000, 'Validation failed: measures_severity_matrix table is empty.', 1;

IF @MeasurePriorityCount <= 0
  THROW 52000, 'Validation failed: measures_priority_matrix table is empty.', 1;

IF @NetworkTargetStateAssetCount <= 0
  THROW 52000, 'Validation failed: network_target_state_asset table is empty.', 1;

IF OBJECT_ID(N'tsaat.vw_spi_asset_evaluation_context', N'V') IS NULL
  THROW 52000, 'Validation failed: vw_spi_asset_evaluation_context is missing.', 1;

IF OBJECT_ID(N'tsaat.usp_evaluate_spi_snapshot', N'P') IS NULL
  THROW 52000, 'Validation failed: usp_evaluate_spi_snapshot is missing.', 1;

IF OBJECT_ID(N'tsaat.vw_persisted_finding_normalized', N'V') IS NULL
  THROW 52000, 'Validation failed: vw_persisted_finding_normalized is missing.', 1;

IF OBJECT_ID(N'tsaat.fn_finding_hash_int', N'FN') IS NULL
  THROW 52000, 'Validation failed: fn_finding_hash_int is missing.', 1;

IF OBJECT_ID(N'tsaat.usp_generate_spi_findings_snapshot', N'P') IS NULL
  THROW 52000, 'Validation failed: usp_generate_spi_findings_snapshot is missing.', 1;

IF OBJECT_ID(N'tsaat.usp_get_effective_findings_snapshot', N'P') IS NULL
  THROW 52000, 'Validation failed: usp_get_effective_findings_snapshot is missing.', 1;

IF OBJECT_ID(N'tsaat.usp_get_finding_history_snapshot', N'P') IS NULL
  THROW 52000, 'Validation failed: usp_get_finding_history_snapshot is missing.', 1;

IF OBJECT_ID(N'tsaat.usp_get_finding_spi_history_snapshot', N'P') IS NULL
  THROW 52000, 'Validation failed: usp_get_finding_spi_history_snapshot is missing.', 1;

IF OBJECT_ID(N'tsaat.fn_kpi_stable_hash', N'FN') IS NULL
  THROW 52000, 'Validation failed: fn_kpi_stable_hash is missing.', 1;

IF OBJECT_ID(N'tsaat.usp_evaluate_discovery_coverage_snapshot', N'P') IS NULL
  THROW 52000, 'Validation failed: usp_evaluate_discovery_coverage_snapshot is missing.', 1;

IF OBJECT_ID(N'tsaat.usp_evaluate_kpi_snapshot', N'P') IS NULL
  THROW 52000, 'Validation failed: usp_evaluate_kpi_snapshot is missing.', 1;

IF OBJECT_ID(N'tsaat.usp_evaluate_kpi_snapshot_bulk', N'P') IS NULL
  THROW 52000, 'Validation failed: usp_evaluate_kpi_snapshot_bulk is missing.', 1;

IF EXISTS (
  SELECT 1
  FROM [tsaat].[kpi_definition] AS kd
  LEFT JOIN [tsaat].[kpi_calculation_definition] AS kcd
    ON kcd.[calculation_key] = kd.[calculation_key] AND kcd.[enabled] = 1
  WHERE kd.[enabled] = 1 AND kcd.[calculation_key] IS NULL
)
  THROW 52000, 'Validation failed: every enabled KPI definition must have an enabled SQL calculation definition.', 1;

IF EXISTS (
  SELECT 1
  FROM [tsaat].[kpi_definition] AS kd
  WHERE kd.[enabled] = 1
    AND kd.[report_available] = 1
    AND NOT EXISTS (
      SELECT 1
      FROM [tsaat].[kpi_report_detail_binding] AS krdb
      INNER JOIN [tsaat].[kpi_report_detail_definition] AS krdd
        ON krdd.[report_detail_key] = krdb.[report_detail_key] AND krdd.[enabled] = 1
      WHERE krdb.[kpi_id] = kd.[kpi_id]
    )
)
  THROW 52000, 'Validation failed: every report-enabled KPI definition must have an enabled report detail binding.', 1;

IF EXISTS (
  SELECT 1
  FROM [tsaat].[spi_definition] AS sd
  LEFT JOIN [tsaat].[spi_calculation_definition] AS scd
    ON scd.[rule_key] = sd.[rule_key] AND scd.[enabled] = 1
  WHERE sd.[enabled] = 1 AND scd.[rule_key] IS NULL
)
  THROW 52000, 'Validation failed: every enabled SPI definition must have an enabled SQL calculation definition.', 1;

IF EXISTS (
  SELECT 1
  FROM [tsaat].[spi_definition] AS sd
  WHERE sd.[enabled] = 1
    AND NOT EXISTS (
      SELECT 1
      FROM [tsaat].[spi_calculation_evidence_expression] AS scee
      WHERE scee.[rule_key] = sd.[rule_key]
    )
)
  THROW 52000, 'Validation failed: every enabled SPI definition must have SQL evidence expressions.', 1;

IF EXISTS (
  SELECT 1
  FROM [tsaat].[spi_definition] AS sd
  WHERE sd.[enabled] = 1
    AND NOT EXISTS (
      SELECT 1
      FROM [tsaat].[spi_rule_outcome_template] AS srot
      WHERE srot.[rule_key] = sd.[rule_key]
    )
)
  THROW 52000, 'Validation failed: every enabled SPI definition must have outcome templates.', 1;

DECLARE @LatestSnapshotId BIGINT = (
  SELECT TOP (1) [snapshot_id]
  FROM [tsaat].[dataset_snapshot]
  ORDER BY [snapshot_date] DESC, [snapshot_id] DESC
);

DECLARE @SqlSpiEvaluations TABLE (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [spi_id] INT NOT NULL,
  [display_order] INT NOT NULL,
  [compliance_status] NVARCHAR(20) NOT NULL,
  [outcome_key] NVARCHAR(100) NOT NULL,
  [evidence_json] NVARCHAR(MAX) NOT NULL
);

INSERT INTO @SqlSpiEvaluations (
  [snapshot_id],
  [asset_id],
  [spi_id],
  [display_order],
  [compliance_status],
  [outcome_key],
  [evidence_json]
)
EXEC [tsaat].[usp_evaluate_spi_snapshot] @snapshot_id = @LatestSnapshotId;

IF NOT EXISTS (SELECT 1 FROM @SqlSpiEvaluations)
  THROW 52000, 'Validation failed: SQL SPI evaluation procedure returned no rows for the latest snapshot.', 1;

IF EXISTS (
  SELECT 1
  FROM @SqlSpiEvaluations
  WHERE [compliance_status] NOT IN (N'Compliant', N'Non-compliant', N'Unknown')
    OR ISJSON([evidence_json]) <> 1
)
  THROW 52000, 'Validation failed: SQL SPI evaluation returned invalid status or evidence JSON.', 1;

DECLARE @ScopedAssetIdsJson NVARCHAR(MAX) = (
  SELECT N'[' + STRING_AGG(CAST(N'"' + STRING_ESCAPE([asset_id], 'json') + N'"' AS NVARCHAR(MAX)), N',') + N']'
  FROM (
    SELECT TOP (5) [asset_id]
    FROM [tsaat].[asset]
    WHERE [snapshot_id] = @LatestSnapshotId
    ORDER BY [asset_id]
  ) AS scoped_assets
);

DECLARE @ScopedSqlSpiEvaluations TABLE (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [spi_id] INT NOT NULL,
  [display_order] INT NOT NULL,
  [compliance_status] NVARCHAR(20) NOT NULL,
  [outcome_key] NVARCHAR(100) NOT NULL,
  [evidence_json] NVARCHAR(MAX) NOT NULL
);

INSERT INTO @ScopedSqlSpiEvaluations
EXEC [tsaat].[usp_evaluate_spi_snapshot] @snapshot_id = @LatestSnapshotId, @asset_ids_json = @ScopedAssetIdsJson;

IF NOT EXISTS (SELECT 1 FROM @ScopedSqlSpiEvaluations)
  THROW 52000, 'Validation failed: scoped SQL SPI evaluation returned no rows.', 1;

IF EXISTS (
  SELECT 1
  FROM @ScopedSqlSpiEvaluations AS scoped_spi
  WHERE NOT EXISTS (
    SELECT 1
    FROM OPENJSON(@ScopedAssetIdsJson) AS asset_scope
    WHERE CONVERT(NVARCHAR(255), asset_scope.[value]) = scoped_spi.[asset_id]
  )
)
  THROW 52000, 'Validation failed: scoped SQL SPI evaluation returned rows outside the requested asset scope.', 1;

DECLARE @EffectiveFindings TABLE (
  [snapshot_id] BIGINT NULL,
  [finding_id] NVARCHAR(255) NULL,
  [spi_id] INT NULL,
  [raw_priority_rank] INT NULL,
  [raw_severity] NVARCHAR(30) NULL,
  [display_priority_rank] INT NULL,
  [display_severity] NVARCHAR(30) NULL,
  [compliance_status] NVARCHAR(20) NULL,
  [network_id] NVARCHAR(255) NULL,
  [system_id] NVARCHAR(255) NULL,
  [environment_type] NVARCHAR(20) NULL,
  [asset_id] NVARCHAR(255) NULL,
  [title] NVARCHAR(1000) NULL,
  [evidence] NVARCHAR(MAX) NULL,
  [recommended_action] NVARCHAR(MAX) NULL,
  [workflow_status] NVARCHAR(10) NULL,
  [observed_at] DATETIMEOFFSET(7) NULL,
  [closed_at] DATETIMEOFFSET(7) NULL,
  [source_kind] NVARCHAR(20) NULL
);

INSERT INTO @EffectiveFindings
EXEC [tsaat].[usp_get_effective_findings_snapshot] @snapshot_id = @LatestSnapshotId, @as_of_date = NULL, @emit_json = 0;

IF NOT EXISTS (SELECT 1 FROM @EffectiveFindings)
  THROW 52000, 'Validation failed: effective findings procedure returned no rows for the latest snapshot.', 1;

IF EXISTS (
  SELECT 1
  FROM @EffectiveFindings
  WHERE [workflow_status] NOT IN (N'open', N'closed')
    OR [source_kind] NOT IN (N'persisted', N'generated')
    OR [display_priority_rank] IS NULL
    OR [display_severity] IS NULL
    OR ISJSON([evidence]) <> 1
)
  THROW 52000, 'Validation failed: effective findings procedure returned invalid finding rows.', 1;

DECLARE @SqlDiscoveryCoverage TABLE (
  [snapshot_id] BIGINT NOT NULL,
  [asset_id] NVARCHAR(255) NOT NULL,
  [coverage_compliance] BIT NOT NULL,
  [tool_values_json] NVARCHAR(MAX) NOT NULL,
  [missing_tool_ids_json] NVARCHAR(MAX) NOT NULL,
  [missing_tool_names_json] NVARCHAR(MAX) NOT NULL
);

INSERT INTO @SqlDiscoveryCoverage
EXEC [tsaat].[usp_evaluate_discovery_coverage_snapshot] @snapshot_id = @LatestSnapshotId, @asset_ids_json = NULL, @emit_json = 0;

IF NOT EXISTS (SELECT 1 FROM @SqlDiscoveryCoverage)
  THROW 52000, 'Validation failed: SQL discovery coverage procedure returned no rows for the latest snapshot.', 1;

IF EXISTS (
  SELECT 1
  FROM @SqlDiscoveryCoverage
  WHERE ISJSON([tool_values_json]) <> 1
    OR ISJSON([missing_tool_ids_json]) <> 1
    OR ISJSON([missing_tool_names_json]) <> 1
)
  THROW 52000, 'Validation failed: SQL discovery coverage procedure returned invalid JSON fields.', 1;

DECLARE @EffectiveFindingsJson NVARCHAR(MAX) = (
  SELECT
    [asset_id] AS [assetId],
    [display_severity] AS [severity],
    [display_priority_rank] AS [priorityRank]
  FROM @EffectiveFindings
  FOR JSON PATH
);

EXEC [tsaat].[usp_evaluate_kpi_snapshot]
  @snapshot_id = @LatestSnapshotId,
  @asset_ids_json = NULL,
  @system_ids_json = NULL,
  @network_ids_json = NULL,
  @effective_findings_json = @EffectiveFindingsJson,
  @emit_json = 0;

DECLARE @ScopedSystemIdsJson NVARCHAR(MAX) = (
  SELECT N'[' + COALESCE(STRING_AGG(CAST(N'"' + STRING_ESCAPE([system_id], 'json') + N'"' AS NVARCHAR(MAX)), N','), N'') + N']'
  FROM (
    SELECT DISTINCT TOP (5) [system_id]
    FROM [tsaat].[asset]
    WHERE [snapshot_id] = @LatestSnapshotId AND [system_id] IS NOT NULL
    ORDER BY [system_id]
  ) AS scoped_systems
);

DECLARE @ScopedNetworkIdsJson NVARCHAR(MAX) = (
  SELECT N'[' + COALESCE(STRING_AGG(CAST(N'"' + STRING_ESCAPE([network_id], 'json') + N'"' AS NVARCHAR(MAX)), N','), N'') + N']'
  FROM (
    SELECT DISTINCT TOP (5) [network_id]
    FROM [tsaat].[asset]
    WHERE [snapshot_id] = @LatestSnapshotId
    ORDER BY [network_id]
  ) AS scoped_networks
);

DECLARE @BulkKpiScopeJson NVARCHAR(MAX) = (
  SELECT
    N'validation-scope' AS [scopeKey],
    JSON_QUERY(@ScopedAssetIdsJson) AS [assetIds],
    JSON_QUERY(@ScopedSystemIdsJson) AS [systemIds],
    JSON_QUERY(@ScopedNetworkIdsJson) AS [networkIds],
    JSON_QUERY(@EffectiveFindingsJson) AS [findings]
  FOR JSON PATH
);

EXEC [tsaat].[usp_evaluate_kpi_snapshot_bulk]
  @snapshot_id = @LatestSnapshotId,
  @scope_rows_json = @BulkKpiScopeJson,
  @emit_json = 0;

;WITH row_counts AS (
  SELECT
    t.[name] AS [table_name],
    SUM(p.[rows]) AS [row_count]
  FROM sys.tables AS t
  INNER JOIN sys.schemas AS s ON s.[schema_id] = t.[schema_id]
  INNER JOIN sys.partitions AS p ON p.[object_id] = t.[object_id] AND p.[index_id] IN (0,1)
  WHERE s.[name] = N'tsaat'
  GROUP BY t.[name]
)
SELECT [table_name], [row_count]
FROM row_counts
ORDER BY [table_name];

SELECT
  @SnapshotCount AS [dataset_snapshot_count],
  @SpiCount AS [spi_definition_count],
  @SeverityCount AS [finding_severity_definition_count],
  @PriorityDefinitionCount AS [finding_priority_definition_count],
  @FindingSourcePolicyCount AS [finding_source_policy_count],
  @FindingGenerationPolicyCount AS [finding_generation_policy_count],
  @FindingWorkflowStatusDefinitionCount AS [finding_workflow_status_definition_count],
  @FindingBucketDefinitionCount AS [finding_bucket_definition_count],
  @FindingEvidenceFieldDefinitionCount AS [finding_evidence_field_definition_count],
  @FindingRegisterColumnDefinitionCount AS [finding_register_column_definition_count],
  @SpiRuleDefinitionCount AS [spi_rule_definition_count],
  @SpiRuleParameterDefinitionCount AS [spi_rule_parameter_definition_count],
  @SpiRuleOutcomeTemplateCount AS [spi_rule_outcome_template_count],
  @SpiReportDetailDefinitionCount AS [spi_report_detail_definition_count],
  @SpiCalculationSourceCount AS [spi_calculation_source_count],
  @SpiCalculationDefinitionCount AS [spi_calculation_definition_count],
  @SpiCalculationEvidenceCount AS [spi_calculation_evidence_expression_count],
  @SpiFeatureBindingCount AS [spi_feature_binding_count],
  @SpiFindingClassificationRuleCount AS [spi_finding_classification_rule_count],
  @SpiRuleParameterCount AS [spi_rule_parameter_count],
  @SpiTaskingTeamCount AS [spi_tasking_team_count],
  @SpiTaskingActionCount AS [spi_tasking_action_template_count],
  @SpiTaskingConditionCount AS [spi_tasking_condition_template_count],
  @KpiCount AS [kpi_definition_count],
  @KpiCalculationSourceCount AS [kpi_calculation_source_count],
  @KpiCalculationDefinitionCount AS [kpi_calculation_definition_count],
  @KpiTaskingTeamCount AS [kpi_tasking_team_count],
  @KpiTaskingActionCount AS [kpi_tasking_action_template_count],
  @KpiTaskingConditionCount AS [kpi_tasking_condition_template_count],
  @KpiReportDetailDefinitionCount AS [kpi_report_detail_definition_count],
  @KpiReportDetailBindingCount AS [kpi_report_detail_binding_count],
  @AssetCount AS [asset_count],
  @FindingCount AS [finding_count],
  @CiDependencyCount AS [ci_dependency_count],
  @DiscoveryToolCount AS [discovery_tool_count],
  @DiscoveryCoverageSourceCount AS [discovery_coverage_source_count],
  @DiscoveryDetectionDefinitionCount AS [discovery_tool_detection_definition_count],
  @DiscoveryDetectionRuleCount AS [discovery_tool_detection_rule_count],
  @MeasureSeverityCount AS [measures_severity_matrix_count],
  @MeasurePriorityCount AS [measures_priority_matrix_count],
  @NetworkTargetStateAssetCount AS [network_target_state_asset_count],
  CAST(1 AS BIT) AS [ready_for_application];
