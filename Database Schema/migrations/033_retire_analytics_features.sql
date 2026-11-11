-- Inventory storage v2. Upgrade only; never replay base schema or seed loaders.
-- Stop writers, back up this exact database, then acknowledge its name in this session:
-- EXEC sys.sp_set_session_context @key=N'TSAAT_RETIRE_FEATURES_DATABASE', @value=N'<selected database>';
-- See docs/feature-retirement.md for paired JSON upgrade and recovery.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
IF CONVERT(nvarchar(128), SESSION_CONTEXT(N'TSAAT_RETIRE_FEATURES_DATABASE')) IS NULL
 OR CONVERT(nvarchar(128), SESSION_CONTEXT(N'TSAAT_RETIRE_FEATURES_DATABASE')) <> DB_NAME()
 THROW 51033, 'Explicit target-specific retirement acknowledgement is required after backup.', 1;
IF OBJECT_ID(N'tsaat.asset', N'U') IS NULL OR OBJECT_ID(N'tsaat.persona_settings_version', N'U') IS NULL
 THROW 51033, 'Upgrade requires an existing TSAAT database through migration 032.', 1;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @retired TABLE ([name] sysname PRIMARY KEY, [kind] nvarchar(20));
 INSERT @retired VALUES
(N'finding', N'TABLE'),
(N'finding_bucket_definition', N'TABLE'),
(N'finding_evidence_field_definition', N'TABLE'),
(N'finding_generation_policy', N'TABLE'),
(N'finding_priority_definition', N'TABLE'),
(N'finding_register_column_definition', N'TABLE'),
(N'finding_severity_definition', N'TABLE'),
(N'finding_source_policy', N'TABLE'),
(N'finding_workflow_status_definition', N'TABLE'),
(N'kpi_calculation_definition', N'TABLE'),
(N'kpi_calculation_parameter', N'TABLE'),
(N'kpi_calculation_source', N'TABLE'),
(N'kpi_definition', N'TABLE'),
(N'kpi_report_detail_binding', N'TABLE'),
(N'kpi_report_detail_definition', N'TABLE'),
(N'kpi_tasking_action_template', N'TABLE'),
(N'kpi_tasking_condition_template', N'TABLE'),
(N'kpi_tasking_team', N'TABLE'),
(N'measures_priority_matrix', N'TABLE'),
(N'measures_settings_version', N'TABLE'),
(N'measures_severity_matrix', N'TABLE'),
(N'network_target_state_asset', N'TABLE'),
(N'reference_os_current_major', N'TABLE'),
(N'reference_software_supported_version', N'TABLE'),
(N'reference_version_set', N'TABLE'),
(N'server_patch_observation', N'TABLE'),
(N'spi_applicable_asset_type', N'TABLE'),
(N'spi_calculation_definition', N'TABLE'),
(N'spi_calculation_evidence_expression', N'TABLE'),
(N'spi_calculation_source', N'TABLE'),
(N'spi_definition', N'TABLE'),
(N'spi_feature_binding', N'TABLE'),
(N'spi_finding_classification_rule', N'TABLE'),
(N'spi_report_detail_definition', N'TABLE'),
(N'spi_rule_definition', N'TABLE'),
(N'spi_rule_outcome_template', N'TABLE'),
(N'spi_rule_parameter', N'TABLE'),
(N'spi_rule_parameter_definition', N'TABLE'),
(N'spi_tasking_action_template', N'TABLE'),
(N'spi_tasking_condition_template', N'TABLE'),
(N'spi_tasking_team', N'TABLE'),
(N'vw_spi_asset_evaluation_context', N'VIEW'),
(N'fn_spi_string_parameter', N'FUNCTION'),
(N'fn_spi_number_parameter', N'FUNCTION'),
(N'fn_spi_boolean_parameter', N'FUNCTION'),
(N'fn_spi_vulnerability_count', N'FUNCTION'),
(N'fn_spi_installed_software_count', N'FUNCTION'),
(N'fn_spi_software_support_status_count', N'FUNCTION'),
(N'usp_evaluate_spi_snapshot', N'PROCEDURE'),
(N'usp_evaluate_kpi_snapshot', N'PROCEDURE'),
(N'usp_evaluate_kpi_snapshot_bulk', N'PROCEDURE'),
(N'vw_persisted_finding_normalized', N'VIEW'),
(N'fn_finding_hash_int', N'FUNCTION'),
(N'usp_generate_spi_findings_snapshot', N'PROCEDURE'),
(N'usp_get_effective_findings_snapshot', N'PROCEDURE'),
(N'usp_get_finding_history_snapshot', N'PROCEDURE'),
(N'usp_get_finding_spi_history_snapshot', N'PROCEDURE'),
(N'fn_kpi_stable_hash', N'FUNCTION');
 -- Refuse custom consumers; silently breaking them is not an upgrade.
 IF EXISTS (
   SELECT 1 FROM sys.sql_expression_dependencies d
   JOIN sys.objects consumer ON consumer.object_id=d.referencing_id
   JOIN sys.objects target ON target.object_id=d.referenced_id
   JOIN @retired r ON r.name=target.name AND target.schema_id=SCHEMA_ID(N'tsaat')
   WHERE consumer.type IN ('V','P','FN','IF','TF','TR')
     AND NOT EXISTS(SELECT 1 FROM @retired own WHERE own.name=consumer.name AND consumer.schema_id=SCHEMA_ID(N'tsaat'))
 ) THROW 51033, 'A custom routine depends on retired storage; review it before upgrading.', 1;
 DECLARE @retiredColumns TABLE ([table_name] sysname, [column_name] sysname);
 INSERT @retiredColumns VALUES
   (N'dataset_snapshot',N'reference_version_set_id'),
   (N'asset_operating_system',N'major_version'),
   (N'asset_operating_system',N'current_supported_major'),
   (N'asset_operating_system',N'n_minus'),
   (N'asset_network_os',N'major_version'),
   (N'asset_network_os',N'current_supported_major'),
   (N'asset_network_os',N'n_minus');
 IF EXISTS (
   SELECT 1 FROM sys.sql_expression_dependencies d
   JOIN sys.objects consumer ON consumer.object_id=d.referencing_id
   JOIN sys.tables target ON target.object_id=d.referenced_id AND target.schema_id=SCHEMA_ID(N'tsaat')
   CROSS APPLY sys.dm_sql_referenced_entities(QUOTENAME(OBJECT_SCHEMA_NAME(consumer.object_id))+N'.'+QUOTENAME(consumer.name),N'OBJECT') resolved
   JOIN @retiredColumns r ON r.table_name=target.name AND r.column_name=resolved.referenced_minor_name
     AND resolved.referenced_schema_name=N'tsaat' AND resolved.referenced_entity_name=target.name
   WHERE consumer.type IN ('V','P','FN','IF','TF','TR')
     AND NOT EXISTS(SELECT 1 FROM @retired own WHERE own.name=consumer.name AND consumer.schema_id=SCHEMA_ID(N'tsaat'))
 ) THROW 51033, 'A custom routine depends on a retired inventory column; review it before upgrading.', 1;
 IF EXISTS (
   SELECT 1 FROM sys.foreign_keys fk
   JOIN sys.tables target ON target.object_id=fk.referenced_object_id
   JOIN sys.tables owner ON owner.object_id=fk.parent_object_id
   JOIN @retired r ON r.name=target.name AND target.schema_id=SCHEMA_ID(N'tsaat')
   WHERE NOT EXISTS(SELECT 1 FROM @retired own WHERE own.name=owner.name AND owner.schema_id=SCHEMA_ID(N'tsaat'))
   AND NOT(owner.schema_id=SCHEMA_ID(N'tsaat') AND owner.name=N'dataset_snapshot' AND target.name=N'reference_version_set')
 ) THROW 51033, 'A custom foreign key depends on retired storage; review it before upgrading.', 1;
 DECLARE @command nvarchar(max)=N'';
 SELECT @command=@command+N'DROP '+r.kind+N' [tsaat].'+QUOTENAME(r.name)+N';'+CHAR(10)
 FROM @retired r JOIN sys.objects o ON o.name=r.name AND o.schema_id=SCHEMA_ID(N'tsaat')
 WHERE r.kind<>N'TABLE';
 IF LEN(@command)>0 EXEC sys.sp_executesql @command;
 SET @command=N'';
 SELECT @command=@command+N'ALTER TABLE '+QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))+N'.'+QUOTENAME(OBJECT_NAME(fk.parent_object_id))+N' DROP CONSTRAINT '+QUOTENAME(fk.name)+N';'+CHAR(10)
 FROM sys.foreign_keys fk
 WHERE EXISTS(SELECT 1 FROM @retired r WHERE r.kind=N'TABLE' AND OBJECT_SCHEMA_NAME(fk.parent_object_id)=N'tsaat' AND r.name=OBJECT_NAME(fk.parent_object_id))
    OR EXISTS(SELECT 1 FROM @retired r WHERE r.kind=N'TABLE' AND OBJECT_SCHEMA_NAME(fk.referenced_object_id)=N'tsaat' AND r.name=OBJECT_NAME(fk.referenced_object_id));
 IF LEN(@command)>0 EXEC sys.sp_executesql @command;
 SET @command=N'';
 SELECT @command=@command+N'DROP TABLE [tsaat].'+QUOTENAME(r.name)+N';'+CHAR(10)
 FROM @retired r WHERE r.kind=N'TABLE' AND OBJECT_ID(N'tsaat.'+r.name,N'U') IS NOT NULL;
 IF LEN(@command)>0 EXEC sys.sp_executesql @command;
 IF COL_LENGTH(N'tsaat.dataset_snapshot',N'reference_version_set_id') IS NOT NULL EXEC(N'ALTER TABLE [tsaat].[dataset_snapshot] DROP COLUMN [reference_version_set_id]');
 IF COL_LENGTH(N'tsaat.asset_operating_system',N'major_version') IS NOT NULL EXEC(N'ALTER TABLE [tsaat].[asset_operating_system] DROP COLUMN [major_version]');
 IF COL_LENGTH(N'tsaat.asset_operating_system',N'current_supported_major') IS NOT NULL EXEC(N'ALTER TABLE [tsaat].[asset_operating_system] DROP COLUMN [current_supported_major]');
 IF COL_LENGTH(N'tsaat.asset_operating_system',N'n_minus') IS NOT NULL EXEC(N'ALTER TABLE [tsaat].[asset_operating_system] DROP COLUMN [n_minus]');
 IF COL_LENGTH(N'tsaat.asset_network_os',N'major_version') IS NOT NULL EXEC(N'ALTER TABLE [tsaat].[asset_network_os] DROP COLUMN [major_version]');
 IF COL_LENGTH(N'tsaat.asset_network_os',N'current_supported_major') IS NOT NULL EXEC(N'ALTER TABLE [tsaat].[asset_network_os] DROP COLUMN [current_supported_major]');
 IF COL_LENGTH(N'tsaat.asset_network_os',N'n_minus') IS NOT NULL EXEC(N'ALTER TABLE [tsaat].[asset_network_os] DROP COLUMN [n_minus]');

 -- Remove only retired navigation permissions from every saved revision.
 -- Preserve persona IDs, labels, selected persona, custom fields and revision timestamps.
 DECLARE @revision bigint, @settings nvarchar(max), @index int, @persona nvarchar(max), @array nvarchar(max);
 DECLARE revisions CURSOR LOCAL FAST_FORWARD FOR SELECT settings_version_id,settings_json FROM [tsaat].[persona_settings_version];
 OPEN revisions;
 FETCH NEXT FROM revisions INTO @revision,@settings;
 WHILE @@FETCH_STATUS=0
 BEGIN
   IF ISJSON(@settings)<>1 OR JSON_QUERY(@settings,'$.personas') IS NULL
     THROW 51033, 'Invalid persona revision; the complete transaction has been rolled back.', 1;
   DECLARE people CURSOR LOCAL FAST_FORWARD FOR SELECT CONVERT(int,[key]),[value] FROM OPENJSON(@settings,'$.personas');
   OPEN people;
   FETCH NEXT FROM people INTO @index,@persona;
   WHILE @@FETCH_STATUS=0
   BEGIN
     IF JSON_QUERY(@persona,'$.sections') IS NOT NULL
     BEGIN
       SELECT @array=N'['+COALESCE(STUFF((
         SELECT N','+NCHAR(34)+STRING_ESCAPE([value],'json')+NCHAR(34)
         FROM OPENJSON(@persona,'$.sections') WHERE [value] NOT IN (N'cyber-security',N'observed-measures',N'findings',N'briefs-reports')
         ORDER BY CONVERT(int,[key]) FOR XML PATH(''),TYPE
       ).value('.','nvarchar(max)'),1,1,N''),N'')+N']';
       SET @persona=JSON_MODIFY(@persona,'$.sections',JSON_QUERY(@array));
     END;
     IF JSON_QUERY(@persona,'$.pages') IS NOT NULL
     BEGIN
       SELECT @array=N'['+COALESCE(STUFF((
         SELECT N','+NCHAR(34)+STRING_ESCAPE([value],'json')+NCHAR(34)
         FROM OPENJSON(@persona,'$.pages') WHERE [value] NOT IN (N'governance-overview',N'governance-trends',N'governance-insights',N'discovery-overview',N'network-risk-profile',N'ict-system-risk-profile',N'service-impact',N'ict-system-impact',N'ict-system-dependencies',N'discovery-tools',N'discovery-compliance',N'discovery-patches',N'discovery-life-cycle',N'measures-summary',N'measures-trends',N'measures-kpi',N'measures-spi',N'findings-register',N'briefs-reports')
         ORDER BY CONVERT(int,[key]) FOR XML PATH(''),TYPE
       ).value('.','nvarchar(max)'),1,1,N''),N'')+N']';
       SET @persona=JSON_MODIFY(@persona,'$.pages',JSON_QUERY(@array));
     END;
     IF JSON_QUERY(@persona,'$.popups') IS NOT NULL
     BEGIN
       SELECT @array=N'['+COALESCE(STUFF((
         SELECT N','+NCHAR(34)+STRING_ESCAPE([value],'json')+NCHAR(34)
         FROM OPENJSON(@persona,'$.popups') WHERE [value] NOT IN (N'network-details',N'ict-system-details',N'measure-scope',N'risk-trend',N'impact-graph',N'impact-details',N'finding-details',N'affected-cis',N'cve-details',N'asset-compliance',N'discovery-tool-details')
         ORDER BY CONVERT(int,[key]) FOR XML PATH(''),TYPE
       ).value('.','nvarchar(max)'),1,1,N''),N'')+N']';
       SET @persona=JSON_MODIFY(@persona,'$.popups',JSON_QUERY(@array));
     END;
     SET @settings=JSON_MODIFY(@settings,N'$.personas['+CONVERT(nvarchar(20),@index)+N']',JSON_QUERY(@persona));
     FETCH NEXT FROM people INTO @index,@persona;
   END;
   CLOSE people; DEALLOCATE people;
   UPDATE [tsaat].[persona_settings_version] SET settings_json=@settings WHERE settings_version_id=@revision;
   FETCH NEXT FROM revisions INTO @revision,@settings;
 END;
 CLOSE revisions; DEALLOCATE revisions;
 IF OBJECT_ID(N'tsaat.storage_schema_version',N'U') IS NULL
   CREATE TABLE [tsaat].[storage_schema_version] (
     [version] INT NOT NULL CONSTRAINT [PK_storage_schema_version] PRIMARY KEY,
     [applied_at_utc] DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
     CONSTRAINT [CK_storage_schema_version] CHECK ([version]=2)
   );
 IF NOT EXISTS(SELECT 1 FROM [tsaat].[storage_schema_version] WHERE [version]=2)
   INSERT [tsaat].[storage_schema_version] ([version]) VALUES (2);
 COMMIT TRANSACTION;
 PRINT 'Inventory storage v2 applied. Retained inventory, snapshots and discovery settings preserved.';
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
GO
