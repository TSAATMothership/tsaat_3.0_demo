PRINT 'Applying migration: 018_performance_optimized_sql_runtime.sql';
GO

CREATE OR ALTER PROCEDURE [tsaat].[usp_evaluate_spi_snapshot]
  @snapshot_id BIGINT,
  @asset_ids_json NVARCHAR(MAX) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @hasAssetScope BIT = CASE WHEN ISJSON(@asset_ids_json) = 1 THEN 1 ELSE 0 END;
  CREATE TABLE #SpiAssetScope ([asset_id] NVARCHAR(255) NOT NULL PRIMARY KEY);
  IF @hasAssetScope = 1
  BEGIN
    INSERT INTO #SpiAssetScope ([asset_id])
    SELECT DISTINCT CONVERT(NVARCHAR(255), [value])
    FROM OPENJSON(@asset_ids_json)
    WHERE [type] IN (1, 2) AND LEN(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [value])))) > 0;
  END;

  DECLARE @sql NVARCHAR(MAX) = N'';
  DECLARE @ruleKey NVARCHAR(100);
  DECLARE @spiId INT;
  DECLARE @displayOrder INT;
  DECLARE @statusSql NVARCHAR(MAX);
  DECLARE @outcomeSql NVARCHAR(MAX);
  DECLARE @evidenceSelect NVARCHAR(MAX);
  DECLARE @statement NVARCHAR(MAX);

  DECLARE calculation_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT
      sd.[rule_key],
      sd.[spi_id],
      sd.[display_order],
      scd.[status_expression_sql],
      scd.[outcome_expression_sql]
    FROM [tsaat].[spi_definition] AS sd
    INNER JOIN [tsaat].[spi_rule_definition] AS srd
      ON srd.[rule_key] = sd.[rule_key] AND srd.[enabled] = 1
    INNER JOIN [tsaat].[spi_calculation_definition] AS scd
      ON scd.[rule_key] = sd.[rule_key] AND scd.[enabled] = 1
    INNER JOIN [tsaat].[spi_calculation_source] AS scs
      ON scs.[source_key] = scd.[source_key]
      AND scs.[enabled] = 1
      AND scs.[source_object_name] = N'[tsaat].[vw_spi_asset_evaluation_context]'
    WHERE sd.[enabled] = 1
    ORDER BY sd.[display_order], sd.[spi_id];

  OPEN calculation_cursor;
  FETCH NEXT FROM calculation_cursor INTO @ruleKey, @spiId, @displayOrder, @statusSql, @outcomeSql;

  WHILE @@FETCH_STATUS = 0
  BEGIN
    SELECT @evidenceSelect = STRING_AGG(
      CAST([value_expression_sql] + N' AS ' + QUOTENAME([evidence_key]) AS NVARCHAR(MAX)),
      N', '
    ) WITHIN GROUP (ORDER BY [display_order], [evidence_key])
    FROM [tsaat].[spi_calculation_evidence_expression]
    WHERE [rule_key] = @ruleKey;

    IF @evidenceSelect IS NULL OR LEN(@evidenceSelect) = 0
    BEGIN
      THROW 53000, 'SPI calculation evidence configuration is missing.', 1;
    END;

    SET @statement =
      N'SELECT ctx.[snapshot_id], ctx.[asset_id], ' +
      CONVERT(NVARCHAR(20), @spiId) +
      N' AS [spi_id], ' +
      CONVERT(NVARCHAR(20), @displayOrder) +
      N' AS [display_order], ' +
      @statusSql +
      N' AS [compliance_status], ' +
      @outcomeSql +
      N' AS [outcome_key], JSON_QUERY((SELECT ' +
      @evidenceSelect +
      N' FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES)) AS [evidence_json] ' +
      N'FROM [tsaat].[vw_spi_asset_evaluation_context] AS ctx ' +
      N'CROSS JOIN (SELECT CAST(' +
      CONVERT(NVARCHAR(20), @spiId) +
      N' AS INT) AS [spi_id]) AS sd ' +
      N'WHERE ctx.[snapshot_id] = @snapshot_id ' +
      N'AND (@hasAssetScope = 0 OR EXISTS (SELECT 1 FROM #SpiAssetScope AS scope WHERE scope.[asset_id] = ctx.[asset_id])) ' +
      N'AND EXISTS (SELECT 1 FROM [tsaat].[spi_applicable_asset_type] AS saat WHERE saat.[spi_id] = sd.[spi_id] AND saat.[asset_type] = ctx.[asset_type])';

    SET @sql = CASE WHEN LEN(@sql) = 0 THEN @statement ELSE @sql + N' UNION ALL ' + @statement END;

    FETCH NEXT FROM calculation_cursor INTO @ruleKey, @spiId, @displayOrder, @statusSql, @outcomeSql;
  END;

  CLOSE calculation_cursor;
  DEALLOCATE calculation_cursor;

  IF LEN(@sql) > 0
  BEGIN
    SET @sql =
      N'SELECT [snapshot_id], [asset_id], [spi_id], [display_order], [compliance_status], [outcome_key], [evidence_json] ' +
      N'FROM (' + @sql + N') AS evaluation_result ' +
      N'ORDER BY [asset_id], [display_order], [spi_id]';

    EXEC sp_executesql @sql, N'@snapshot_id BIGINT, @hasAssetScope BIT', @snapshot_id = @snapshot_id, @hasAssetScope = @hasAssetScope;
    RETURN;
  END;

  SELECT
    CAST(NULL AS BIGINT) AS [snapshot_id],
    CAST(NULL AS NVARCHAR(255)) AS [asset_id],
    CAST(NULL AS INT) AS [spi_id],
    CAST(NULL AS INT) AS [display_order],
    CAST(NULL AS NVARCHAR(20)) AS [compliance_status],
    CAST(NULL AS NVARCHAR(100)) AS [outcome_key],
    CAST(NULL AS NVARCHAR(MAX)) AS [evidence_json]
  WHERE 1 = 0;
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

  IF @hasAssetScope = 1 INSERT INTO @AssetScope SELECT DISTINCT CONVERT(NVARCHAR(255), [value]) FROM OPENJSON(@asset_ids_json) WHERE [type] IN (1, 2);
  IF @hasSystemScope = 1 INSERT INTO @SystemScope SELECT DISTINCT CONVERT(NVARCHAR(255), [value]) FROM OPENJSON(@system_ids_json) WHERE [type] IN (1, 2);
  IF @hasNetworkScope = 1 INSERT INTO @NetworkScope SELECT DISTINCT CONVERT(NVARCHAR(255), [value]) FROM OPENJSON(@network_ids_json) WHERE [type] IN (1, 2);

  DECLARE @Assets TABLE ([asset_id] NVARCHAR(255) NOT NULL PRIMARY KEY, [network_id] NVARCHAR(255) NOT NULL, [system_id] NVARCHAR(255) NULL, [security_domain] NVARCHAR(20) NOT NULL, [system_criticality] NVARCHAR(20) NULL);
  INSERT INTO @Assets
  SELECT a.[asset_id], a.[network_id], a.[system_id], a.[security_domain], s.[criticality]
  FROM [tsaat].[asset] AS a
  LEFT JOIN [tsaat].[ict_system] AS s ON s.[snapshot_id] = a.[snapshot_id] AND s.[system_id] = a.[system_id]
  WHERE a.[snapshot_id] = @snapshot_id AND (@hasAssetScope = 0 OR EXISTS (SELECT 1 FROM @AssetScope AS scope WHERE scope.[asset_id] = a.[asset_id]));

  DECLARE @Systems TABLE ([system_id] NVARCHAR(255) NOT NULL PRIMARY KEY, [network_id] NVARCHAR(255) NOT NULL, [diis_defined] BIT NOT NULL, [modelling_status] BIT NOT NULL);
  INSERT INTO @Systems
  SELECT s.[system_id], s.[network_id], s.[diis_defined], s.[modelling_status]
  FROM [tsaat].[ict_system] AS s
  WHERE s.[snapshot_id] = @snapshot_id AND (@hasSystemScope = 0 OR EXISTS (SELECT 1 FROM @SystemScope AS scope WHERE scope.[system_id] = s.[system_id]));

  DECLARE @Networks TABLE ([network_id] NVARCHAR(255) NOT NULL PRIMARY KEY, [discovery_status] NVARCHAR(40) NOT NULL);
  INSERT INTO @Networks
  SELECT n.[network_id], n.[discovery_status]
  FROM [tsaat].[managed_network] AS n
  WHERE n.[snapshot_id] = @snapshot_id AND (@hasNetworkScope = 0 OR EXISTS (SELECT 1 FROM @NetworkScope AS scope WHERE scope.[network_id] = n.[network_id]));

  DECLARE @SpiEvaluations TABLE ([snapshot_id] BIGINT NOT NULL, [asset_id] NVARCHAR(255) NOT NULL, [spi_id] INT NOT NULL, [display_order] INT NOT NULL, [compliance_status] NVARCHAR(20) NOT NULL, [outcome_key] NVARCHAR(100) NOT NULL, [evidence_json] NVARCHAR(MAX) NOT NULL);
  INSERT INTO @SpiEvaluations EXEC [tsaat].[usp_evaluate_spi_snapshot] @snapshot_id = @snapshot_id, @asset_ids_json = @asset_ids_json;
  DELETE se FROM @SpiEvaluations AS se WHERE NOT EXISTS (SELECT 1 FROM @Assets AS a WHERE a.[asset_id] = se.[asset_id]);

  DECLARE @Discovery TABLE ([snapshot_id] BIGINT NOT NULL, [asset_id] NVARCHAR(255) NOT NULL, [coverage_compliance] BIT NOT NULL, [tool_values_json] NVARCHAR(MAX) NOT NULL, [missing_tool_ids_json] NVARCHAR(MAX) NOT NULL, [missing_tool_names_json] NVARCHAR(MAX) NOT NULL);
  INSERT INTO @Discovery EXEC [tsaat].[usp_evaluate_discovery_coverage_snapshot] @snapshot_id = @snapshot_id, @asset_ids_json = @asset_ids_json, @emit_json = 0;

  DECLARE @Findings TABLE ([asset_id] NVARCHAR(255) NOT NULL, [severity] NVARCHAR(30) NOT NULL, [priority_rank] INT NOT NULL);
  IF ISJSON(@effective_findings_json) = 1
  BEGIN
    INSERT INTO @Findings ([asset_id], [severity], [priority_rank])
    SELECT [asset_id], [severity], [priority_rank]
    FROM OPENJSON(@effective_findings_json) WITH ([asset_id] NVARCHAR(255) '$.assetId', [severity] NVARCHAR(30) '$.severity', [priority_rank] INT '$.priorityRank')
    WHERE [asset_id] IS NOT NULL AND EXISTS (SELECT 1 FROM @Assets AS a WHERE a.[asset_id] = [asset_id]);
  END;

  DECLARE @overallUnknown INT = (SELECT COUNT(*) FROM @SpiEvaluations WHERE [compliance_status] = N'Unknown');
  DECLARE @Metric TABLE ([calculation_key] NVARCHAR(100) NOT NULL PRIMARY KEY, [score] NVARCHAR(100) NOT NULL, [score_percent] DECIMAL(9,1) NOT NULL, [compliant_count] INT NOT NULL, [applicable_count] INT NOT NULL, [non_compliant_count] INT NOT NULL, [unknown_count] INT NOT NULL, [high_priority_count] INT NOT NULL);

  ;WITH base AS (
    SELECT se.[compliance_status], a.[security_domain], a.[system_criticality], a.[asset_id], a.[system_id]
    FROM @SpiEvaluations AS se INNER JOIN @Assets AS a ON a.[asset_id] = se.[asset_id]
  ),
  grouped AS (
    SELECT N'overall-spi-compliance' AS [calculation_key], COUNT(*) AS [total], SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END) AS [compliant], SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END) AS [non_compliant], SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END) AS [unknown], (SELECT COUNT(*) FROM @Findings WHERE [priority_rank] <= 2) AS [high_priority] FROM base
    UNION ALL SELECT N'protected-domain-compliance', COUNT(*), SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END), (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS fa ON fa.[asset_id] = f.[asset_id] WHERE f.[priority_rank] <= 2 AND fa.[security_domain] = N'Protected') FROM base WHERE [security_domain] = N'Protected'
    UNION ALL SELECT N'secret-domain-compliance', COUNT(*), SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END), (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS fa ON fa.[asset_id] = f.[asset_id] WHERE f.[priority_rank] <= 2 AND fa.[security_domain] = N'Secret') FROM base WHERE [security_domain] = N'Secret'
    UNION ALL SELECT N'critical-ict-system-compliance', COUNT(*), SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END), (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS fa ON fa.[asset_id] = f.[asset_id] WHERE f.[priority_rank] <= 2 AND fa.[system_criticality] = N'Critical') FROM base WHERE [system_criticality] = N'Critical'
  )
  INSERT INTO @Metric
  SELECT [calculation_key], CONVERT(NVARCHAR(40), CAST(CASE WHEN [total] = 0 THEN 0 ELSE ROUND(([compliant] * 100.0) / [total], 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE([compliant], 0)) + N'/' + CONVERT(NVARCHAR(20), COALESCE([total], 0)) + N')', CAST(CASE WHEN [total] = 0 THEN 0 ELSE ROUND(([compliant] * 100.0) / [total], 1) END AS DECIMAL(9,1)), COALESCE([compliant], 0), COALESCE([total], 0), COALESCE([non_compliant], 0), COALESCE([unknown], 0), COALESCE([high_priority], 0)
  FROM grouped;

  DECLARE @findingTotal INT = (SELECT COUNT(*) FROM @Findings);
  DECLARE @criticalExposure INT = (SELECT COUNT(*) FROM @Findings WHERE [severity] = N'Critical Exposure');
  INSERT INTO @Metric VALUES (N'critical-exposure-in-production', CONVERT(NVARCHAR(20), @criticalExposure), CAST(CASE WHEN @findingTotal = 0 THEN 0 ELSE ROUND(((CAST(@findingTotal - @criticalExposure AS DECIMAL(18,4))) * 100.0) / @findingTotal, 1) END AS DECIMAL(9,1)), CASE WHEN @findingTotal - @criticalExposure < 0 THEN 0 ELSE @findingTotal - @criticalExposure END, @findingTotal, @criticalExposure, @overallUnknown, @criticalExposure);

  DECLARE @discoveryTotal INT = (SELECT COUNT(*) FROM @Discovery);
  DECLARE @discoveryCompliant INT = (SELECT COUNT(*) FROM @Discovery WHERE [coverage_compliance] = 1);
  INSERT INTO @Metric VALUES (N'discovery-coverage-compliance', CONVERT(NVARCHAR(40), CAST(CASE WHEN @discoveryTotal = 0 THEN 0 ELSE ROUND((@discoveryCompliant * 100.0) / @discoveryTotal, 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), @discoveryCompliant) + N'/' + CONVERT(NVARCHAR(20), @discoveryTotal) + N')', CAST(CASE WHEN @discoveryTotal = 0 THEN 0 ELSE ROUND((@discoveryCompliant * 100.0) / @discoveryTotal, 1) END AS DECIMAL(9,1)), @discoveryCompliant, @discoveryTotal, @discoveryTotal - @discoveryCompliant, 0, (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Discovery AS d ON d.[asset_id] = f.[asset_id] WHERE f.[priority_rank] <= 2 AND d.[coverage_compliance] = 0));

  ;WITH scoped_systems AS (SELECT DISTINCT [system_id] FROM @Assets WHERE [system_id] IS NOT NULL),
  ato AS (SELECT [system_id], CASE WHEN [tsaat].[fn_kpi_stable_hash]([system_id] + N':ato') % 5 <> 0 THEN 1 ELSE 0 END AS [compliant] FROM scoped_systems),
  diis AS (SELECT [system_id], CASE WHEN [tsaat].[fn_kpi_stable_hash]([system_id] + N':diis') % 4 <> 1 THEN 1 ELSE 0 END AS [compliant] FROM scoped_systems)
  INSERT INTO @Metric
  SELECT N'active-ato-coverage', CONVERT(NVARCHAR(40), CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(SUM([compliant]), 0)) + N'/' + CONVERT(NVARCHAR(20), COUNT(*)) + N')', CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1)), COALESCE(SUM([compliant]), 0), COUNT(*), COUNT(*) - COALESCE(SUM([compliant]), 0), 0, (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS a ON a.[asset_id] = f.[asset_id] INNER JOIN ato AS ato_rows ON ato_rows.[system_id] = a.[system_id] WHERE f.[priority_rank] <= 2 AND ato_rows.[compliant] = 0) FROM ato
  UNION ALL
  SELECT N'diis-registration-coverage', CONVERT(NVARCHAR(40), CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(SUM([compliant]), 0)) + N'/' + CONVERT(NVARCHAR(20), COUNT(*)) + N')', CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM([compliant]) * 100.0) / COUNT(*), 1) END AS DECIMAL(9,1)), COALESCE(SUM([compliant]), 0), COUNT(*), COUNT(*) - COALESCE(SUM([compliant]), 0), 0, (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Assets AS a ON a.[asset_id] = f.[asset_id] INNER JOIN diis AS diis_rows ON diis_rows.[system_id] = a.[system_id] WHERE f.[priority_rank] <= 2 AND diis_rows.[compliant] = 0) FROM diis;

  DECLARE @diisSystemTotal INT = (SELECT COUNT(*) FROM @Systems WHERE [diis_defined] = 1);
  DECLARE @diisSystemModelled INT = (SELECT COUNT(*) FROM @Systems WHERE [diis_defined] = 1 AND [modelling_status] = 1);
  INSERT INTO @Metric VALUES (N'diis-modelled-coverage', CONVERT(NVARCHAR(40), CAST(CASE WHEN @diisSystemTotal = 0 THEN 0 ELSE ROUND((@diisSystemModelled * 100.0) / @diisSystemTotal, 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), @diisSystemModelled) + N'/' + CONVERT(NVARCHAR(20), @diisSystemTotal) + N')', CAST(CASE WHEN @diisSystemTotal = 0 THEN 0 ELSE ROUND((@diisSystemModelled * 100.0) / @diisSystemTotal, 1) END AS DECIMAL(9,1)), @diisSystemModelled, @diisSystemTotal, @diisSystemTotal - @diisSystemModelled, 0, @diisSystemTotal - @diisSystemModelled);

  DECLARE @networkTotal INT = (SELECT COUNT(*) FROM @Networks);
  DECLARE @networkEnabled INT = (SELECT COUNT(*) FROM @Networks WHERE [discovery_status] = N'Discovery Enabled');
  INSERT INTO @Metric VALUES (N'network-discovery-enablement', CONVERT(NVARCHAR(40), CAST(CASE WHEN @networkTotal = 0 THEN 0 ELSE ROUND((@networkEnabled * 100.0) / @networkTotal, 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), @networkEnabled) + N'/' + CONVERT(NVARCHAR(20), @networkTotal) + N')', CAST(CASE WHEN @networkTotal = 0 THEN 0 ELSE ROUND((@networkEnabled * 100.0) / @networkTotal, 1) END AS DECIMAL(9,1)), @networkEnabled, @networkTotal, @networkTotal - @networkEnabled, 0, @networkTotal - @networkEnabled);

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
    [modelling_status] BIT NOT NULL
  );

  INSERT INTO @ScopeSystems ([scope_key], [system_id], [network_id], [diis_defined], [modelling_status])
  SELECT DISTINCT
    s.[scope_key],
    sys.[system_id],
    sys.[network_id],
    sys.[diis_defined],
    sys.[modelling_status]
  FROM @Scope AS s
  CROSS APPLY OPENJSON(CASE WHEN ISJSON(s.[system_ids_json]) = 1 THEN s.[system_ids_json] ELSE N'[]' END) AS system_scope
  INNER JOIN [tsaat].[ict_system] AS sys
    ON sys.[snapshot_id] = @snapshot_id
    AND sys.[system_id] = CONVERT(NVARCHAR(255), system_scope.[value])
  WHERE system_scope.[type] IN (1, 2);

  DECLARE @ScopeNetworks TABLE (
    [scope_key] NVARCHAR(255) NOT NULL,
    [network_id] NVARCHAR(255) NOT NULL,
    [discovery_status] NVARCHAR(40) NOT NULL
  );

  INSERT INTO @ScopeNetworks ([scope_key], [network_id], [discovery_status])
  SELECT DISTINCT
    s.[scope_key],
    n.[network_id],
    n.[discovery_status]
  FROM @Scope AS s
  CROSS APPLY OPENJSON(CASE WHEN ISJSON(s.[network_ids_json]) = 1 THEN s.[network_ids_json] ELSE N'[]' END) AS network_scope
  INNER JOIN [tsaat].[managed_network] AS n
    ON n.[snapshot_id] = @snapshot_id
    AND n.[network_id] = CONVERT(NVARCHAR(255), network_scope.[value])
  WHERE network_scope.[type] IN (1, 2);

  DECLARE @AllAssetIdsJson NVARCHAR(MAX) = (
    SELECT N'[' + COALESCE(STRING_AGG(CAST(N'"' + STRING_ESCAPE([asset_id], 'json') + N'"' AS NVARCHAR(MAX)), N','), N'') + N']'
    FROM (SELECT DISTINCT [asset_id] FROM @ScopeAssets) AS scoped_asset
  );

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
  EXEC [tsaat].[usp_evaluate_spi_snapshot] @snapshot_id = @snapshot_id, @asset_ids_json = @AllAssetIdsJson;

  DECLARE @Discovery TABLE (
    [snapshot_id] BIGINT NOT NULL,
    [asset_id] NVARCHAR(255) NOT NULL,
    [coverage_compliance] BIT NOT NULL,
    [tool_values_json] NVARCHAR(MAX) NOT NULL,
    [missing_tool_ids_json] NVARCHAR(MAX) NOT NULL,
    [missing_tool_names_json] NVARCHAR(MAX) NOT NULL
  );
  INSERT INTO @Discovery
  EXEC [tsaat].[usp_evaluate_discovery_coverage_snapshot] @snapshot_id = @snapshot_id, @asset_ids_json = @AllAssetIdsJson, @emit_json = 0;

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

  ;WITH base AS (
    SELECT
      scoped_asset.[scope_key],
      se.[compliance_status],
      scoped_asset.[security_domain],
      scoped_asset.[system_criticality],
      scoped_asset.[asset_id],
      scoped_asset.[system_id]
    FROM @SpiEvaluations AS se
    INNER JOIN @ScopeAssets AS scoped_asset ON scoped_asset.[asset_id] = se.[asset_id]
  ),
  grouped AS (
    SELECT [scope_key], N'overall-spi-compliance' AS [calculation_key], COUNT(*) AS [total], SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END) AS [compliant], SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END) AS [non_compliant], SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END) AS [unknown], (SELECT COUNT(*) FROM @Findings AS f WHERE f.[scope_key] = base.[scope_key] AND f.[priority_rank] <= 2) AS [high_priority] FROM base GROUP BY [scope_key]
    UNION ALL SELECT [scope_key], N'protected-domain-compliance', COUNT(*), SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END), (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @ScopeAssets AS fa ON fa.[scope_key] = f.[scope_key] AND fa.[asset_id] = f.[asset_id] WHERE f.[scope_key] = base.[scope_key] AND f.[priority_rank] <= 2 AND fa.[security_domain] = N'Protected') FROM base WHERE [security_domain] = N'Protected' GROUP BY [scope_key]
    UNION ALL SELECT [scope_key], N'secret-domain-compliance', COUNT(*), SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END), (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @ScopeAssets AS fa ON fa.[scope_key] = f.[scope_key] AND fa.[asset_id] = f.[asset_id] WHERE f.[scope_key] = base.[scope_key] AND f.[priority_rank] <= 2 AND fa.[security_domain] = N'Secret') FROM base WHERE [security_domain] = N'Secret' GROUP BY [scope_key]
    UNION ALL SELECT [scope_key], N'critical-ict-system-compliance', COUNT(*), SUM(CASE WHEN [compliance_status] = N'Compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Non-compliant' THEN 1 ELSE 0 END), SUM(CASE WHEN [compliance_status] = N'Unknown' THEN 1 ELSE 0 END), (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @ScopeAssets AS fa ON fa.[scope_key] = f.[scope_key] AND fa.[asset_id] = f.[asset_id] WHERE f.[scope_key] = base.[scope_key] AND f.[priority_rank] <= 2 AND fa.[system_criticality] = N'Critical') FROM base WHERE [system_criticality] = N'Critical' GROUP BY [scope_key]
  )
  INSERT INTO @Metric
  SELECT [scope_key], [calculation_key], CONVERT(NVARCHAR(40), CAST(CASE WHEN [total] = 0 THEN 0 ELSE ROUND(([compliant] * 100.0) / [total], 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE([compliant], 0)) + N'/' + CONVERT(NVARCHAR(20), COALESCE([total], 0)) + N')', CAST(CASE WHEN [total] = 0 THEN 0 ELSE ROUND(([compliant] * 100.0) / [total], 1) END AS DECIMAL(9,1)), COALESCE([compliant], 0), COALESCE([total], 0), COALESCE([non_compliant], 0), COALESCE([unknown], 0), COALESCE([high_priority], 0)
  FROM grouped;

  INSERT INTO @Metric
  SELECT s.[scope_key], missing_metric.[calculation_key], N'0.0% (0/0)', CAST(0 AS DECIMAL(9,1)), 0, 0, 0, 0, 0
  FROM @Scope AS s
  CROSS JOIN (VALUES
    (N'overall-spi-compliance'),
    (N'protected-domain-compliance'),
    (N'secret-domain-compliance'),
    (N'critical-ict-system-compliance')
  ) AS missing_metric([calculation_key])
  WHERE NOT EXISTS (
    SELECT 1
    FROM @Metric AS existing_metric
    WHERE existing_metric.[scope_key] = s.[scope_key]
      AND existing_metric.[calculation_key] = missing_metric.[calculation_key]
  );

  ;WITH finding_counts AS (
    SELECT [scope_key], COUNT(*) AS [finding_total], SUM(CASE WHEN [severity] = N'Critical Exposure' THEN 1 ELSE 0 END) AS [critical_exposure]
    FROM @Findings
    GROUP BY [scope_key]
  ),
  unknown_counts AS (
    SELECT scoped_asset.[scope_key], COUNT(*) AS [unknown_total]
    FROM @SpiEvaluations AS se
    INNER JOIN @ScopeAssets AS scoped_asset ON scoped_asset.[asset_id] = se.[asset_id]
    WHERE se.[compliance_status] = N'Unknown'
    GROUP BY scoped_asset.[scope_key]
  )
  INSERT INTO @Metric
  SELECT
    s.[scope_key],
    N'critical-exposure-in-production',
    CONVERT(NVARCHAR(20), COALESCE(fc.[critical_exposure], 0)),
    CAST(CASE WHEN COALESCE(fc.[finding_total], 0) = 0 THEN 0 ELSE ROUND(((CAST(fc.[finding_total] - fc.[critical_exposure] AS DECIMAL(18,4))) * 100.0) / fc.[finding_total], 1) END AS DECIMAL(9,1)),
    CASE WHEN COALESCE(fc.[finding_total], 0) - COALESCE(fc.[critical_exposure], 0) < 0 THEN 0 ELSE COALESCE(fc.[finding_total], 0) - COALESCE(fc.[critical_exposure], 0) END,
    COALESCE(fc.[finding_total], 0),
    COALESCE(fc.[critical_exposure], 0),
    COALESCE(uc.[unknown_total], 0),
    COALESCE(fc.[critical_exposure], 0)
  FROM @Scope AS s
  LEFT JOIN finding_counts AS fc ON fc.[scope_key] = s.[scope_key]
  LEFT JOIN unknown_counts AS uc ON uc.[scope_key] = s.[scope_key];

  ;WITH discovery_counts AS (
    SELECT scoped_asset.[scope_key], COUNT(*) AS [total], SUM(CASE WHEN d.[coverage_compliance] = 1 THEN 1 ELSE 0 END) AS [compliant]
    FROM @ScopeAssets AS scoped_asset
    INNER JOIN @Discovery AS d ON d.[asset_id] = scoped_asset.[asset_id]
    GROUP BY scoped_asset.[scope_key]
  )
  INSERT INTO @Metric
  SELECT
    s.[scope_key],
    N'discovery-coverage-compliance',
    CONVERT(NVARCHAR(40), CAST(CASE WHEN COALESCE(dc.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(dc.[compliant], 0) * 100.0) / dc.[total], 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(dc.[compliant], 0)) + N'/' + CONVERT(NVARCHAR(20), COALESCE(dc.[total], 0)) + N')',
    CAST(CASE WHEN COALESCE(dc.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(dc.[compliant], 0) * 100.0) / dc.[total], 1) END AS DECIMAL(9,1)),
    COALESCE(dc.[compliant], 0),
    COALESCE(dc.[total], 0),
    COALESCE(dc.[total], 0) - COALESCE(dc.[compliant], 0),
    0,
    (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @Discovery AS d ON d.[asset_id] = f.[asset_id] WHERE f.[scope_key] = s.[scope_key] AND f.[priority_rank] <= 2 AND d.[coverage_compliance] = 0)
  FROM @Scope AS s
  LEFT JOIN discovery_counts AS dc ON dc.[scope_key] = s.[scope_key];

  ;WITH scoped_systems AS (SELECT DISTINCT [scope_key], [system_id] FROM @ScopeAssets WHERE [system_id] IS NOT NULL),
  ato AS (SELECT [scope_key], [system_id], CASE WHEN [tsaat].[fn_kpi_stable_hash]([system_id] + N':ato') % 5 <> 0 THEN 1 ELSE 0 END AS [compliant] FROM scoped_systems),
  diis AS (SELECT [scope_key], [system_id], CASE WHEN [tsaat].[fn_kpi_stable_hash]([system_id] + N':diis') % 4 <> 1 THEN 1 ELSE 0 END AS [compliant] FROM scoped_systems),
  ato_grouped AS (SELECT [scope_key], COUNT(*) AS [total], SUM([compliant]) AS [compliant] FROM ato GROUP BY [scope_key]),
  diis_grouped AS (SELECT [scope_key], COUNT(*) AS [total], SUM([compliant]) AS [compliant] FROM diis GROUP BY [scope_key])
  INSERT INTO @Metric
  SELECT s.[scope_key], N'active-ato-coverage', CONVERT(NVARCHAR(40), CAST(CASE WHEN COALESCE(ag.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(ag.[compliant], 0) * 100.0) / ag.[total], 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(ag.[compliant], 0)) + N'/' + CONVERT(NVARCHAR(20), COALESCE(ag.[total], 0)) + N')', CAST(CASE WHEN COALESCE(ag.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(ag.[compliant], 0) * 100.0) / ag.[total], 1) END AS DECIMAL(9,1)), COALESCE(ag.[compliant], 0), COALESCE(ag.[total], 0), COALESCE(ag.[total], 0) - COALESCE(ag.[compliant], 0), 0, (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @ScopeAssets AS a ON a.[scope_key] = f.[scope_key] AND a.[asset_id] = f.[asset_id] INNER JOIN ato AS ato_rows ON ato_rows.[scope_key] = a.[scope_key] AND ato_rows.[system_id] = a.[system_id] WHERE f.[scope_key] = s.[scope_key] AND f.[priority_rank] <= 2 AND ato_rows.[compliant] = 0) FROM @Scope AS s LEFT JOIN ato_grouped AS ag ON ag.[scope_key] = s.[scope_key]
  UNION ALL
  SELECT s.[scope_key], N'diis-registration-coverage', CONVERT(NVARCHAR(40), CAST(CASE WHEN COALESCE(dg.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(dg.[compliant], 0) * 100.0) / dg.[total], 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(dg.[compliant], 0)) + N'/' + CONVERT(NVARCHAR(20), COALESCE(dg.[total], 0)) + N')', CAST(CASE WHEN COALESCE(dg.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(dg.[compliant], 0) * 100.0) / dg.[total], 1) END AS DECIMAL(9,1)), COALESCE(dg.[compliant], 0), COALESCE(dg.[total], 0), COALESCE(dg.[total], 0) - COALESCE(dg.[compliant], 0), 0, (SELECT COUNT(*) FROM @Findings AS f INNER JOIN @ScopeAssets AS a ON a.[scope_key] = f.[scope_key] AND a.[asset_id] = f.[asset_id] INNER JOIN diis AS diis_rows ON diis_rows.[scope_key] = a.[scope_key] AND diis_rows.[system_id] = a.[system_id] WHERE f.[scope_key] = s.[scope_key] AND f.[priority_rank] <= 2 AND diis_rows.[compliant] = 0) FROM @Scope AS s LEFT JOIN diis_grouped AS dg ON dg.[scope_key] = s.[scope_key];

  ;WITH diis_modelled AS (
    SELECT [scope_key], COUNT(*) AS [total], SUM(CASE WHEN [diis_defined] = 1 AND [modelling_status] = 1 THEN 1 ELSE 0 END) AS [modelled]
    FROM @ScopeSystems
    WHERE [diis_defined] = 1
    GROUP BY [scope_key]
  )
  INSERT INTO @Metric
  SELECT s.[scope_key], N'diis-modelled-coverage', CONVERT(NVARCHAR(40), CAST(CASE WHEN COALESCE(dm.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(dm.[modelled], 0) * 100.0) / dm.[total], 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(dm.[modelled], 0)) + N'/' + CONVERT(NVARCHAR(20), COALESCE(dm.[total], 0)) + N')', CAST(CASE WHEN COALESCE(dm.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(dm.[modelled], 0) * 100.0) / dm.[total], 1) END AS DECIMAL(9,1)), COALESCE(dm.[modelled], 0), COALESCE(dm.[total], 0), COALESCE(dm.[total], 0) - COALESCE(dm.[modelled], 0), 0, COALESCE(dm.[total], 0) - COALESCE(dm.[modelled], 0)
  FROM @Scope AS s
  LEFT JOIN diis_modelled AS dm ON dm.[scope_key] = s.[scope_key];

  ;WITH network_counts AS (
    SELECT [scope_key], COUNT(*) AS [total], SUM(CASE WHEN [discovery_status] = N'Discovery Enabled' THEN 1 ELSE 0 END) AS [enabled]
    FROM @ScopeNetworks
    GROUP BY [scope_key]
  )
  INSERT INTO @Metric
  SELECT s.[scope_key], N'network-discovery-enablement', CONVERT(NVARCHAR(40), CAST(CASE WHEN COALESCE(nc.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(nc.[enabled], 0) * 100.0) / nc.[total], 1) END AS DECIMAL(9,1))) + N'% (' + CONVERT(NVARCHAR(20), COALESCE(nc.[enabled], 0)) + N'/' + CONVERT(NVARCHAR(20), COALESCE(nc.[total], 0)) + N')', CAST(CASE WHEN COALESCE(nc.[total], 0) = 0 THEN 0 ELSE ROUND((COALESCE(nc.[enabled], 0) * 100.0) / nc.[total], 1) END AS DECIMAL(9,1)), COALESCE(nc.[enabled], 0), COALESCE(nc.[total], 0), COALESCE(nc.[total], 0) - COALESCE(nc.[enabled], 0), 0, COALESCE(nc.[total], 0) - COALESCE(nc.[enabled], 0)
  FROM @Scope AS s
  LEFT JOIN network_counts AS nc ON nc.[scope_key] = s.[scope_key];

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
