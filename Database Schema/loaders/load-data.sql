SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @PackageDataRoot NVARCHAR(4000) = N'$(PackageDataRoot)';
DECLARE @SnapshotsRoot NVARCHAR(4000) = N'$(SnapshotsRoot)';

IF @PackageDataRoot IS NULL OR LTRIM(RTRIM(@PackageDataRoot)) = N''
BEGIN
  THROW 51000, 'PackageDataRoot sqlcmd variable is required.', 1;
END;

IF @SnapshotsRoot IS NULL OR LTRIM(RTRIM(@SnapshotsRoot)) = N''
BEGIN
  THROW 51000, 'SnapshotsRoot sqlcmd variable is required.', 1;
END;

DECLARE @ReadFileSql NVARCHAR(MAX);
DECLARE @FilePath NVARCHAR(4000);
DECLARE @Json NVARCHAR(MAX);

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
SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
SET @Json = NULL;
EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @Json OUTPUT;

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
SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
SET @Json = NULL;
EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @Json OUTPUT;

INSERT INTO [tsaat].[spi_definition] (
  [spi_id],
  [name],
  [description],
  [success_measure],
  [priority_order],
  [recommended_action]
)
SELECT
  spi.spi_id,
  spi.[name],
  spi.[description],
  spi.[success_measure],
  spi.[priority_order],
  spi.[recommended_action]
FROM OPENJSON(@Json, '$.spis') WITH (
  [spi_id] SMALLINT '$.spiId',
  [name] NVARCHAR(255) '$.name',
  [description] NVARCHAR(1000) '$.description',
  [success_measure] NVARCHAR(1000) '$.successMeasure',
  [priority_order] INT '$.priorityOrder',
  [recommended_action] NVARCHAR(MAX) '$.recommendedAction'
) AS spi;

INSERT INTO [tsaat].[spi_applicable_asset_type] (
  [spi_id],
  [asset_type]
)
SELECT
  spi.spi_id,
  aat.[value]
FROM OPENJSON(@Json, '$.spis') WITH (
  [spi_id] SMALLINT '$.spiId',
  [applicable_asset_types] NVARCHAR(MAX) '$.applicableAssetTypes' AS JSON
) AS spi
CROSS APPLY OPENJSON(spi.[applicable_asset_types]) AS aat;

SET @FilePath = @PackageDataRoot + N'\discovery-tools-settings.json';
SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
SET @Json = NULL;
EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @Json OUTPUT;

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
SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
SET @Json = NULL;
EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @Json OUTPUT;

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
  TRY_CONVERT(SMALLINT, LEFT(ms.[key], CHARINDEX(':', ms.[key]) - 1)),
  SUBSTRING(ms.[key], CHARINDEX(':', ms.[key]) + 1, 255),
  ms.[value]
FROM OPENJSON(@Json, '$.severityMatrix') AS ms
WHERE CHARINDEX(':', ms.[key]) > 0;

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
  SET @ReadFileSql = N'SELECT @out = BulkColumn FROM OPENROWSET(BULK ''' + REPLACE(@FilePath, '''', '''''') + ''', SINGLE_CLOB) src;';
  SET @Json = NULL;
  EXEC sp_executesql @ReadFileSql, N'@out NVARCHAR(MAX) OUTPUT', @out = @Json OUTPUT;

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

  INSERT INTO [tsaat].[managed_network] (
    [snapshot_id],
    [network_id],
    [name],
    [criticality],
    [classification],
    [description],
    [owner],
    [support_email],
    [service_catalogue_url],
    [ato_number],
    [diis_url],
    [grc_url],
    [discovery_status]
  )
  SELECT
    @SnapshotId,
    n.[id],
    n.[name],
    n.[criticality],
    n.[classification],
    n.[description],
    n.[owner],
    n.[support_email],
    n.[service_catalogue_url],
    n.[ato_number],
    n.[diis_url],
    n.[grc_url],
    n.[discovery_status]
  FROM OPENJSON(@Json, '$.managedNetworks') WITH (
    [id] NVARCHAR(255) '$.id',
    [name] NVARCHAR(255) '$.name',
    [criticality] NVARCHAR(20) '$.criticality',
    [classification] NVARCHAR(255) '$.classification',
    [description] NVARCHAR(2000) '$.description',
    [owner] NVARCHAR(255) '$.owner',
    [support_email] NVARCHAR(320) '$.supportEmail',
    [service_catalogue_url] NVARCHAR(1024) '$.serviceCatalogueUrl',
    [ato_number] NVARCHAR(100) '$.atoNumber',
    [diis_url] NVARCHAR(1024) '$.diisUrl',
    [grc_url] NVARCHAR(1024) '$.grcUrl',
    [discovery_status] NVARCHAR(40) '$.discoveryStatus'
  ) AS n;

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
      [classification],
      [description],
      [discovery_status]
    )
    VALUES (
      @SnapshotId,
      N'net-unassigned',
      N'Unassigned Systems',
      N'Non-Critical',
      N'Unclassified',
      N'Synthetic network created during load for systems without networkId.',
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

  INSERT INTO [tsaat].[ict_system] (
    [snapshot_id],
    [system_id],
    [network_id],
    [name],
    [description],
    [diis_id],
    [owner],
    [support_email],
    [service_catalogue_url],
    [ato_number],
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
    s.[description],
    s.[diis_id],
    s.[owner],
    s.[support_email],
    s.[service_catalogue_url],
    s.[ato_number],
    s.[diis_url],
    s.[grc_url],
    s.[modelling_status],
    s.[diis_defined],
    s.[criticality],
    s.[security_domain]
  FROM OPENJSON(@Json, '$.ictSystems') WITH (
    [id] NVARCHAR(255) '$.id',
    [network_id] NVARCHAR(255) '$.networkId',
    [name] NVARCHAR(255) '$.name',
    [description] NVARCHAR(2000) '$.description',
    [diis_id] NVARCHAR(100) '$.diisId',
    [owner] NVARCHAR(255) '$.owner',
    [support_email] NVARCHAR(320) '$.supportEmail',
    [service_catalogue_url] NVARCHAR(1024) '$.serviceCatalogueUrl',
    [ato_number] NVARCHAR(100) '$.atoNumber',
    [diis_url] NVARCHAR(1024) '$.diisUrl',
    [grc_url] NVARCHAR(1024) '$.grcUrl',
    [modelling_status] BIT '$.modellingStatus',
    [diis_defined] BIT '$.diisDefined',
    [criticality] NVARCHAR(20) '$.criticality',
    [security_domain] NVARCHAR(20) '$.securityDomain'
  ) AS s;

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
