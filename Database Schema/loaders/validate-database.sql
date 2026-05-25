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
DECLARE @AssetCount BIGINT = (SELECT COUNT(*) FROM [tsaat].[asset]);
DECLARE @FindingCount BIGINT = (SELECT COUNT(*) FROM [tsaat].[finding]);
DECLARE @CiDependencyCount BIGINT = (SELECT COUNT(*) FROM [tsaat].[ci_dependency]);
DECLARE @DiscoveryToolCount INT = (SELECT COUNT(*) FROM [tsaat].[discovery_tool]);
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

IF @AssetCount <= 0
  THROW 52000, 'Validation failed: asset table is empty.', 1;

IF @FindingCount <= 0
  THROW 52000, 'Validation failed: finding table is empty.', 1;

IF @CiDependencyCount <= 0
  THROW 52000, 'Validation failed: ci_dependency table is empty.', 1;

IF @DiscoveryToolCount <= 0
  THROW 52000, 'Validation failed: discovery_tool table is empty.', 1;

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
  @AssetCount AS [asset_count],
  @FindingCount AS [finding_count],
  @CiDependencyCount AS [ci_dependency_count],
  @DiscoveryToolCount AS [discovery_tool_count],
  @MeasureSeverityCount AS [measures_severity_matrix_count],
  @MeasurePriorityCount AS [measures_priority_matrix_count],
  @NetworkTargetStateAssetCount AS [network_target_state_asset_count],
  CAST(1 AS BIT) AS [ready_for_application];
