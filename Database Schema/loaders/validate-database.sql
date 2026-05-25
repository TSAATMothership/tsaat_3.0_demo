SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @SnapshotCount INT = (SELECT COUNT(*) FROM [tsaat].[dataset_snapshot]);
DECLARE @SpiCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_definition]);
DECLARE @SeverityCount INT = (SELECT COUNT(*) FROM [tsaat].[finding_severity_definition]);
DECLARE @SpiRuleDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_rule_definition]);
DECLARE @SpiRuleParameterDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_rule_parameter_definition]);
DECLARE @SpiRuleOutcomeTemplateCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_rule_outcome_template]);
DECLARE @SpiReportDetailDefinitionCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_report_detail_definition]);
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

IF @SpiRuleDefinitionCount < 10
  THROW 52000, 'Validation failed: spi_rule_definition count must be at least 10.', 1;

IF @SpiRuleParameterDefinitionCount <= 0
  THROW 52000, 'Validation failed: spi_rule_parameter_definition table is empty.', 1;

IF @SpiRuleOutcomeTemplateCount <= 0
  THROW 52000, 'Validation failed: spi_rule_outcome_template table is empty.', 1;

IF @SpiReportDetailDefinitionCount <= 0
  THROW 52000, 'Validation failed: spi_report_detail_definition table is empty.', 1;

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
  @SpiRuleDefinitionCount AS [spi_rule_definition_count],
  @SpiRuleParameterDefinitionCount AS [spi_rule_parameter_definition_count],
  @SpiRuleOutcomeTemplateCount AS [spi_rule_outcome_template_count],
  @SpiReportDetailDefinitionCount AS [spi_report_detail_definition_count],
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
