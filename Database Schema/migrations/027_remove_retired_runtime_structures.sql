-- Production schema/config cleanup; no snapshot, finding or settings data is reseeded.
-- Requires schema through 026. Run with sqlcmd -b on an explicit backed-up target.
-- Rerunnable. Published migrations 001-026 must NOT be reapplied after this migration.
-- Recovery: restore the verified pre-upgrade backup together with the previous app.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS (SELECT 1 FROM [tsaat].[kpi_definition] WHERE [calculation_key] NOT IN (N'active-ato-coverage', N'diis-registration-coverage'))
  THROW 51027, 'Cleanup refused: a KPI still uses a retired calculation. Review this installation.', 1;
IF EXISTS (SELECT 1 FROM [tsaat].[kpi_report_detail_binding] WHERE [report_detail_key] <> N'generic-kpi-summary')
  THROW 51027, 'Cleanup refused: a KPI still uses a custom report detail. Review this installation.', 1;
IF EXISTS (SELECT 1 FROM [tsaat].[kpi_calculation_definition] WHERE [calculation_key] NOT IN (
  N'active-ato-coverage', N'diis-registration-coverage', N'overall-spi-compliance', N'protected-domain-compliance',
  N'secret-domain-compliance', N'critical-ict-system-compliance', N'critical-exposure-in-production',
  N'discovery-coverage-compliance', N'diis-modelled-coverage', N'network-discovery-enablement'))
  THROW 51027, 'Cleanup refused: custom KPI calculations require review.', 1;
IF OBJECT_ID(N'tsaat.kpi_calculation_parameter', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM [tsaat].[kpi_calculation_parameter] WHERE [calculation_key] IN (N'active-ato-coverage', N'diis-registration-coverage'))
    THROW 51027, 'Cleanup refused: active KPI parameters require review.', 1;
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
  DECLARE @AssetScope TABLE ([asset_id] NVARCHAR(255) NOT NULL PRIMARY KEY);
  DECLARE @SystemScope TABLE ([system_id] NVARCHAR(255) NOT NULL PRIMARY KEY);

  IF @hasAssetScope = 1 INSERT INTO @AssetScope SELECT DISTINCT CONVERT(NVARCHAR(255), [value]) FROM OPENJSON(@asset_ids_json) WHERE [type] IN (1, 2);
  IF @hasSystemScope = 1 INSERT INTO @SystemScope SELECT DISTINCT CONVERT(NVARCHAR(255), [value]) FROM OPENJSON(@system_ids_json) WHERE [type] IN (1, 2);

  DECLARE @Assets TABLE ([asset_id] NVARCHAR(255) NOT NULL PRIMARY KEY, [network_id] NVARCHAR(255) NOT NULL, [system_id] NVARCHAR(255) NULL, [security_domain] NVARCHAR(20) NOT NULL, [system_criticality] NVARCHAR(20) NULL);
  INSERT INTO @Assets
  SELECT a.[asset_id], a.[network_id], a.[system_id], a.[security_domain], s.[criticality]
  FROM [tsaat].[asset] AS a
  LEFT JOIN [tsaat].[ict_system] AS s ON s.[snapshot_id] = a.[snapshot_id] AND s.[system_id] = a.[system_id]
  WHERE a.[snapshot_id] = @snapshot_id AND (@hasAssetScope = 0 OR EXISTS (SELECT 1 FROM @AssetScope AS scope WHERE scope.[asset_id] = a.[asset_id]));

  DECLARE @Systems TABLE ([system_id] NVARCHAR(255) NOT NULL PRIMARY KEY, [network_id] NVARCHAR(255) NOT NULL, [diis_defined] BIT NOT NULL, [modelling_status] BIT NOT NULL, [ato_number] NVARCHAR(100) NULL);
  INSERT INTO @Systems
  SELECT s.[system_id], s.[network_id], s.[diis_defined], s.[modelling_status], s.[ato_number]
  FROM [tsaat].[ict_system] AS s
  WHERE s.[snapshot_id] = @snapshot_id AND (@hasSystemScope = 0 OR EXISTS (SELECT 1 FROM @SystemScope AS scope WHERE scope.[system_id] = s.[system_id]));

  DECLARE @Findings TABLE ([asset_id] NVARCHAR(255) NOT NULL, [severity] NVARCHAR(30) NOT NULL, [priority_rank] INT NOT NULL);
  IF ISJSON(@effective_findings_json) = 1
  BEGIN
    INSERT INTO @Findings ([asset_id], [severity], [priority_rank])
    SELECT [asset_id], [severity], [priority_rank]
    FROM OPENJSON(@effective_findings_json) WITH ([asset_id] NVARCHAR(255) '$.assetId', [severity] NVARCHAR(30) '$.severity', [priority_rank] INT '$.priorityRank')
    WHERE [asset_id] IS NOT NULL AND EXISTS (SELECT 1 FROM @Assets AS a WHERE a.[asset_id] = [asset_id]);
  END;

  DECLARE @Metric TABLE ([calculation_key] NVARCHAR(100) NOT NULL PRIMARY KEY, [score] NVARCHAR(100) NOT NULL, [score_percent] DECIMAL(9,1) NOT NULL, [compliant_count] INT NOT NULL, [applicable_count] INT NOT NULL, [non_compliant_count] INT NOT NULL, [unknown_count] INT NOT NULL, [high_priority_count] INT NOT NULL);

  ;WITH scoped_systems AS (SELECT [system_id], [ato_number], [diis_defined] FROM @Systems),
  ato AS (SELECT [system_id], CASE WHEN NULLIF(LTRIM(RTRIM([ato_number])), N'') IS NOT NULL THEN 1 ELSE 0 END AS [compliant] FROM scoped_systems),
  diis AS (SELECT [system_id], CASE WHEN [diis_defined] = 1 THEN 1 ELSE 0 END AS [compliant] FROM scoped_systems)
  INSERT INTO @Metric
  SELECT N'active-ato-coverage', CONVERT(NVARCHAR(40), CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(SUM([compliant]), 0)) + N'/' + CONVERT(NVARCHAR(20), COUNT(*)) + N')', CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1)), COALESCE(SUM([compliant]), 0), COUNT(*), COUNT(*) - COALESCE(SUM([compliant]), 0), 0, (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS a ON a.[asset_id] = f.[asset_id] INNER JOIN ato AS ato_rows ON ato_rows.[system_id] = a.[system_id] WHERE f.[priority_rank] <= 2 AND ato_rows.[compliant] = 0) FROM ato
  UNION ALL
  SELECT N'diis-registration-coverage', CONVERT(NVARCHAR(40), CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(SUM([compliant]), 0)) + N'/' + CONVERT(NVARCHAR(20), COUNT(*)) + N')', CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1)), COALESCE(SUM([compliant]), 0), COUNT(*), COUNT(*) - COALESCE(SUM([compliant]), 0), 0, (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS a ON a.[asset_id] = f.[asset_id] INNER JOIN diis AS diis_rows ON diis_rows.[system_id] = a.[system_id] WHERE f.[priority_rank] <= 2 AND diis_rows.[compliant] = 0) FROM diis;

  IF @emit_json = 1
  BEGIN
    SELECT kd.[kpi_id] AS [kpiId], kd.[display_order] AS [displayOrder], kd.[calculation_key] AS [calculationKey], metric.[score] AS [score], metric.[score_percent] AS [scorePercent], metric.[compliant_count] AS [compliantCount], metric.[applicable_count] AS [applicableCount], metric.[non_compliant_count] AS [nonCompliantCount], metric.[unknown_count] AS [unknownCount], metric.[high_priority_count] AS [highPriorityCount]
    FROM [tsaat].[kpi_definition] AS kd
    INNER JOIN [tsaat].[kpi_calculation_definition] AS kcd ON kcd.[calculation_key] = kd.[calculation_key] AND kcd.[enabled] = 1
    INNER JOIN @Metric AS metric ON metric.[calculation_key] = kd.[calculation_key]
    WHERE kd.[enabled] = 1
    ORDER BY kd.[display_order], kd.[kpi_id]
    FOR JSON PATH;
    RETURN;
  END;

  SELECT @snapshot_id AS [snapshot_id], kd.[kpi_id], kd.[display_order], kd.[calculation_key], metric.[score], metric.[score_percent], metric.[compliant_count], metric.[applicable_count], metric.[non_compliant_count], metric.[unknown_count], metric.[high_priority_count]
  FROM [tsaat].[kpi_definition] AS kd
  INNER JOIN [tsaat].[kpi_calculation_definition] AS kcd ON kcd.[calculation_key] = kd.[calculation_key] AND kcd.[enabled] = 1
  INNER JOIN @Metric AS metric ON metric.[calculation_key] = kd.[calculation_key]
  WHERE kd.[enabled] = 1
  ORDER BY kd.[display_order], kd.[kpi_id];
END;
GO

CREATE OR ALTER PROCEDURE [tsaat].[usp_evaluate_kpi_snapshot_bulk]
  @snapshot_id BIGINT,
  @scope_rows_json NVARCHAR(MAX),
  @emit_json BIT = 0
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Scope TABLE (
    [scope_key] NVARCHAR(255) NOT NULL PRIMARY KEY,
    [asset_ids_json] NVARCHAR(MAX) NULL,
    [system_ids_json] NVARCHAR(MAX) NULL,
    [network_ids_json] NVARCHAR(MAX) NULL,
    [findings_json] NVARCHAR(MAX) NULL
  );

  IF ISJSON(@scope_rows_json) = 1
  BEGIN
    INSERT INTO @Scope ([scope_key], [asset_ids_json], [system_ids_json], [network_ids_json], [findings_json])
    SELECT
      [scope_key],
      [asset_ids_json],
      [system_ids_json],
      [network_ids_json],
      [findings_json]
    FROM OPENJSON(@scope_rows_json) WITH (
      [scope_key] NVARCHAR(255) '$.scopeKey',
      [asset_ids_json] NVARCHAR(MAX) '$.assetIds' AS JSON,
      [system_ids_json] NVARCHAR(MAX) '$.systemIds' AS JSON,
      [network_ids_json] NVARCHAR(MAX) '$.networkIds' AS JSON,
      [findings_json] NVARCHAR(MAX) '$.findings' AS JSON
    )
    WHERE [scope_key] IS NOT NULL AND LEN(LTRIM(RTRIM([scope_key]))) > 0;
  END;

  DECLARE @ScopeAssets TABLE (
    [scope_key] NVARCHAR(255) NOT NULL,
    [asset_id] NVARCHAR(255) NOT NULL,
    [network_id] NVARCHAR(255) NOT NULL,
    [system_id] NVARCHAR(255) NULL,
    [security_domain] NVARCHAR(20) NOT NULL,
    [system_criticality] NVARCHAR(20) NULL
  );

  INSERT INTO @ScopeAssets ([scope_key], [asset_id], [network_id], [system_id], [security_domain], [system_criticality])
  SELECT DISTINCT
    s.[scope_key],
    a.[asset_id],
    a.[network_id],
    a.[system_id],
    a.[security_domain],
    sys.[criticality]
  FROM @Scope AS s
  CROSS APPLY OPENJSON(CASE WHEN ISJSON(s.[asset_ids_json]) = 1 THEN s.[asset_ids_json] ELSE N'[]' END) AS asset_scope
  INNER JOIN [tsaat].[asset] AS a
    ON a.[snapshot_id] = @snapshot_id
    AND a.[asset_id] = CONVERT(NVARCHAR(255), asset_scope.[value])
  LEFT JOIN [tsaat].[ict_system] AS sys
    ON sys.[snapshot_id] = a.[snapshot_id]
    AND sys.[system_id] = a.[system_id]
  WHERE asset_scope.[type] IN (1, 2);

  DECLARE @ScopeSystems TABLE (
    [scope_key] NVARCHAR(255) NOT NULL,
    [system_id] NVARCHAR(255) NOT NULL,
    [network_id] NVARCHAR(255) NOT NULL,
    [diis_defined] BIT NOT NULL,
    [modelling_status] BIT NOT NULL,
    [ato_number] NVARCHAR(100) NULL
  );

  INSERT INTO @ScopeSystems ([scope_key], [system_id], [network_id], [diis_defined], [modelling_status], [ato_number])
  SELECT DISTINCT
    s.[scope_key],
    sys.[system_id],
    sys.[network_id],
    sys.[diis_defined],
    sys.[modelling_status],
    sys.[ato_number]
  FROM @Scope AS s
  CROSS APPLY OPENJSON(CASE WHEN ISJSON(s.[system_ids_json]) = 1 THEN s.[system_ids_json] ELSE N'[]' END) AS system_scope
  INNER JOIN [tsaat].[ict_system] AS sys
    ON sys.[snapshot_id] = @snapshot_id
    AND sys.[system_id] = CONVERT(NVARCHAR(255), system_scope.[value])
  WHERE system_scope.[type] IN (1, 2);

  DECLARE @Findings TABLE (
    [scope_key] NVARCHAR(255) NOT NULL,
    [asset_id] NVARCHAR(255) NOT NULL,
    [severity] NVARCHAR(30) NOT NULL,
    [priority_rank] INT NOT NULL
  );
  INSERT INTO @Findings ([scope_key], [asset_id], [severity], [priority_rank])
  SELECT
    s.[scope_key],
    finding_row.[asset_id],
    finding_row.[severity],
    finding_row.[priority_rank]
  FROM @Scope AS s
  CROSS APPLY OPENJSON(CASE WHEN ISJSON(s.[findings_json]) = 1 THEN s.[findings_json] ELSE N'[]' END)
    WITH ([asset_id] NVARCHAR(255) '$.assetId', [severity] NVARCHAR(30) '$.severity', [priority_rank] INT '$.priorityRank') AS finding_row
  WHERE finding_row.[asset_id] IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM @ScopeAssets AS scoped_asset
      WHERE scoped_asset.[scope_key] = s.[scope_key]
        AND scoped_asset.[asset_id] = finding_row.[asset_id]
    );

  DECLARE @Metric TABLE (
    [scope_key] NVARCHAR(255) NOT NULL,
    [calculation_key] NVARCHAR(100) NOT NULL,
    [score] NVARCHAR(100) NOT NULL,
    [score_percent] DECIMAL(9,1) NOT NULL,
    [compliant_count] INT NOT NULL,
    [applicable_count] INT NOT NULL,
    [non_compliant_count] INT NOT NULL,
    [unknown_count] INT NOT NULL,
    [high_priority_count] INT NOT NULL,
    PRIMARY KEY ([scope_key], [calculation_key])
  );

  ;WITH scoped_systems AS (SELECT [scope_key], [system_id], [ato_number], [diis_defined] FROM @ScopeSystems),
  ato AS (SELECT [scope_key], [system_id], CASE WHEN NULLIF(LTRIM(RTRIM([ato_number])), N'') IS NOT NULL THEN 1 ELSE 0 END AS [compliant] FROM scoped_systems),
  diis AS (SELECT [scope_key], [system_id], CASE WHEN [diis_defined] = 1 THEN 1 ELSE 0 END AS [compliant] FROM scoped_systems),
  ato_grouped AS (SELECT [scope_key], COUNT(*) AS [total], SUM([compliant]) AS [compliant] FROM ato GROUP BY [scope_key]),
  diis_grouped AS (SELECT [scope_key], COUNT(*) AS [total], SUM([compliant]) AS [compliant] FROM diis GROUP BY [scope_key])
  INSERT INTO @Metric
  SELECT s.[scope_key], N'active-ato-coverage', CONVERT(NVARCHAR(40), CAST(CASE WHEN COALESCE(ag.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(ag.[compliant], 0) * 100.0) / ag.[total], 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(ag.[compliant], 0)) + N'/' + CONVERT(NVARCHAR(20), COALESCE(ag.[total], 0)) + N')', CAST(CASE WHEN COALESCE(ag.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(ag.[compliant], 0) * 100.0) / ag.[total], 1) END AS DECIMAL(9,1)), COALESCE(ag.[compliant], 0), COALESCE(ag.[total], 0), COALESCE(ag.[total], 0) - COALESCE(ag.[compliant], 0), 0, (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @ScopeAssets AS a ON a.[scope_key] = f.[scope_key] AND a.[asset_id] = f.[asset_id] INNER JOIN ato AS ato_rows ON ato_rows.[scope_key] = a.[scope_key] AND ato_rows.[system_id] = a.[system_id] WHERE f.[scope_key] = s.[scope_key] AND f.[priority_rank] <= 2 AND ato_rows.[compliant] = 0) FROM @Scope AS s LEFT JOIN ato_grouped AS ag ON ag.[scope_key] = s.[scope_key]
  UNION ALL
  SELECT s.[scope_key], N'diis-registration-coverage', CONVERT(NVARCHAR(40), CAST(CASE WHEN COALESCE(dg.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(dg.[compliant], 0) * 100.0) / dg.[total], 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(dg.[compliant], 0)) + N'/' + CONVERT(NVARCHAR(20), COALESCE(dg.[total], 0)) + N')', CAST(CASE WHEN COALESCE(dg.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(dg.[compliant], 0) * 100.0) / dg.[total], 1) END AS DECIMAL(9,1)), COALESCE(dg.[compliant], 0), COALESCE(dg.[total], 0), COALESCE(dg.[total], 0) - COALESCE(dg.[compliant], 0), 0, (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @ScopeAssets AS a ON a.[scope_key] = f.[scope_key] AND a.[asset_id] = f.[asset_id] INNER JOIN diis AS diis_rows ON diis_rows.[scope_key] = a.[scope_key] AND diis_rows.[system_id] = a.[system_id] WHERE f.[scope_key] = s.[scope_key] AND f.[priority_rank] <= 2 AND diis_rows.[compliant] = 0) FROM @Scope AS s LEFT JOIN diis_grouped AS dg ON dg.[scope_key] = s.[scope_key];

  IF @emit_json = 1
  BEGIN
    SELECT metric.[scope_key] AS [scopeKey], kd.[kpi_id] AS [kpiId], kd.[display_order] AS [displayOrder], kd.[calculation_key] AS [calculationKey], metric.[score] AS [score], metric.[score_percent] AS [scorePercent], metric.[compliant_count] AS [compliantCount], metric.[applicable_count] AS [applicableCount], metric.[non_compliant_count] AS [nonCompliantCount], metric.[unknown_count] AS [unknownCount], metric.[high_priority_count] AS [highPriorityCount]
    FROM [tsaat].[kpi_definition] AS kd
    INNER JOIN [tsaat].[kpi_calculation_definition] AS kcd ON kcd.[calculation_key] = kd.[calculation_key] AND kcd.[enabled] = 1
    INNER JOIN @Metric AS metric ON metric.[calculation_key] = kd.[calculation_key]
    WHERE kd.[enabled] = 1
    ORDER BY metric.[scope_key], kd.[display_order], kd.[kpi_id]
    FOR JSON PATH;
    RETURN;
  END;

  SELECT @snapshot_id AS [snapshot_id], metric.[scope_key], kd.[kpi_id], kd.[display_order], kd.[calculation_key], metric.[score], metric.[score_percent], metric.[compliant_count], metric.[applicable_count], metric.[non_compliant_count], metric.[unknown_count], metric.[high_priority_count]
  FROM [tsaat].[kpi_definition] AS kd
  INNER JOIN [tsaat].[kpi_calculation_definition] AS kcd ON kcd.[calculation_key] = kd.[calculation_key] AND kcd.[enabled] = 1
  INNER JOIN @Metric AS metric ON metric.[calculation_key] = kd.[calculation_key]
  WHERE kd.[enabled] = 1
  ORDER BY metric.[scope_key], kd.[display_order], kd.[kpi_id];
END;
GO

IF OBJECT_ID(N'tsaat.kpi_calculation_parameter', N'U') IS NOT NULL
  DROP TABLE [tsaat].[kpi_calculation_parameter];
DELETE FROM [tsaat].[kpi_calculation_definition]
WHERE [calculation_key] NOT IN (N'active-ato-coverage', N'diis-registration-coverage');
DELETE FROM [tsaat].[kpi_report_detail_definition]
WHERE [report_detail_key] IN (N'critical-system-threshold', N'critical-exposure-assets', N'unmodelled-diis-systems');
IF OBJECT_ID(N'tsaat.fn_kpi_stable_hash', N'FN') IS NOT NULL
  DROP FUNCTION [tsaat].[fn_kpi_stable_hash];
IF COL_LENGTH(N'tsaat.managed_network', N'apm_number') IS NOT NULL
  ALTER TABLE [tsaat].[managed_network] DROP COLUMN [apm_number];
COMMIT TRANSACTION;
GO
