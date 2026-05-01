SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @SnapshotCount INT = (SELECT COUNT(*) FROM [tsaat].[dataset_snapshot]);
DECLARE @SpiCount INT = (SELECT COUNT(*) FROM [tsaat].[spi_definition]);
DECLARE @AssetCount BIGINT = (SELECT COUNT(*) FROM [tsaat].[asset]);
DECLARE @FindingCount BIGINT = (SELECT COUNT(*) FROM [tsaat].[finding]);
DECLARE @CiDependencyCount BIGINT = (SELECT COUNT(*) FROM [tsaat].[ci_dependency]);
DECLARE @DiscoveryToolCount INT = (SELECT COUNT(*) FROM [tsaat].[discovery_tool]);
DECLARE @MeasureCount INT = (SELECT COUNT(*) FROM [tsaat].[measures_severity_matrix]);
DECLARE @NetworkTargetStateAssetCount BIGINT = (SELECT COUNT(*) FROM [tsaat].[network_target_state_asset]);

IF @SnapshotCount <> 8
  THROW 52000, 'Validation failed: dataset_snapshot count must be 8.', 1;

IF @SpiCount <> 10
  THROW 52000, 'Validation failed: spi_definition count must be 10.', 1;

IF @AssetCount <= 0
  THROW 52000, 'Validation failed: asset table is empty.', 1;

IF @FindingCount <= 0
  THROW 52000, 'Validation failed: finding table is empty.', 1;

IF @CiDependencyCount <= 0
  THROW 52000, 'Validation failed: ci_dependency table is empty.', 1;

IF @DiscoveryToolCount <= 0
  THROW 52000, 'Validation failed: discovery_tool table is empty.', 1;

IF @MeasureCount <= 0
  THROW 52000, 'Validation failed: measures_severity_matrix table is empty.', 1;

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
  @AssetCount AS [asset_count],
  @FindingCount AS [finding_count],
  @CiDependencyCount AS [ci_dependency_count],
  @DiscoveryToolCount AS [discovery_tool_count],
  @MeasureCount AS [measures_severity_matrix_count],
  @NetworkTargetStateAssetCount AS [network_target_state_asset_count],
  CAST(1 AS BIT) AS [ready_for_application];
