/* DEMONSTRATION DATA ONLY. Run explicitly after loading demo snapshots.
   Requires migrations 020 and 021. Not part of production migrations/imports.
   Fills NULL/blank explorer attributes only; keeps existing values and relationships.
   Addresses/models are stable per CI across snapshots. Dates are relative to each snapshot.
   Demo discovery sources and patch labels identify the synthetic enrichment.
   The caller should save the affected tables before running this script. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  CREATE TABLE #Touched (snapshot_id BIGINT NOT NULL);
  DECLARE @changes TABLE (entity NVARCHAR(60), records INT);

  SELECT asset_id, CONVERT(INT, ROW_NUMBER() OVER (ORDER BY asset_id)) AS ordinal,
    CONVERT(INT, ABS(CONVERT(BIGINT, CHECKSUM(asset_id))) % 1000000) AS seed
  INTO #DemoCI FROM (SELECT DISTINCT asset_id FROM tsaat.asset WHERE asset_type <> N'ip-node') ids;
  CREATE UNIQUE CLUSTERED INDEX IX_DemoCI ON #DemoCI(asset_id);
  IF (SELECT COUNT(*) FROM #DemoCI) > 65024
    THROW 51000, 'Demo address pool is limited to 65,024 distinct endpoints.', 1;

  UPDATE a SET
    name = CASE WHEN NULLIF(LTRIM(RTRIM(a.name)), N'') IS NULL THEN CONCAT(N'Demo Endpoint ', d.ordinal) ELSE a.name END,
    ip_address = CASE WHEN NULLIF(LTRIM(RTRIM(a.ip_address)), N'') IS NULL
      THEN CONCAT(N'10.77.', (d.ordinal - 1) / 254, N'.', (d.ordinal - 1) % 254 + 1) ELSE a.ip_address END,
    mac_address = CASE WHEN NULLIF(LTRIM(RTRIM(a.mac_address)), N'') IS NULL
      THEN CONCAT(N'02:77:', SUBSTRING(h.hexid, 1, 2), N':', SUBSTRING(h.hexid, 3, 2), N':', SUBSTRING(h.hexid, 5, 2), N':', SUBSTRING(h.hexid, 7, 2)) ELSE a.mac_address END,
    device_model = CASE WHEN NULLIF(LTRIM(RTRIM(a.device_model)), N'') IS NULL THEN
      CASE a.asset_type
        WHEN N'server' THEN CHOOSE(d.seed % 3 + 1, N'PowerEdge R750', N'ProLiant DL380 Gen10', N'ThinkSystem SR650')
        WHEN N'workstation' THEN CHOOSE(d.seed % 3 + 1, N'Latitude 7440', N'EliteBook 840 G10', N'ThinkPad T14 Gen4')
        WHEN N'network-device' THEN CHOOSE(d.seed % 3 + 1, N'Catalyst 9300', N'Aruba CX 6300', N'Juniper EX4400')
        WHEN N'storage-device' THEN CHOOSE(d.seed % 3 + 1, N'PowerStore 500T', N'NetApp AFF A250', N'MSA 2060')
        WHEN N'printer-device' THEN CHOOSE(d.seed % 3 + 1, N'LaserJet Enterprise M507', N'Lexmark MS823', N'Brother HL-L6400DW')
        ELSE CHOOSE(d.seed % 3 + 1, N'Demo Console Appliance', N'Demo Monitoring Appliance', N'Demo Management Gateway') END ELSE a.device_model END,
    last_discovered_date = COALESCE(a.last_discovered_date,
      DATEADD(MINUTE, 480 + d.seed % 600, DATEADD(DAY, -age.days, CONVERT(DATETIME2(3), s.snapshot_date)))),
    discovered_by = CASE WHEN NULLIF(LTRIM(RTRIM(a.discovered_by)), N'') IS NULL
      THEN CHOOSE(d.seed % 4 + 1, N'Demo: Endpoint Agent', N'Demo: Network Scan', N'Demo: Configuration Manager', N'Demo: CMDB Import') ELSE a.discovered_by END,
    updated_at_utc = SYSUTCDATETIME(), updated_by = SUSER_SNAME()
  OUTPUT inserted.snapshot_id INTO #Touched
  FROM tsaat.asset a JOIN #DemoCI d ON d.asset_id = a.asset_id
  JOIN tsaat.dataset_snapshot s ON s.snapshot_id = a.snapshot_id
  CROSS APPLY (SELECT CONVERT(VARCHAR(8), CONVERT(BINARY(4), d.ordinal), 2) AS hexid) h
  CROSS APPLY (SELECT CASE WHEN d.seed % 10 < 6 THEN d.seed % 7
    WHEN d.seed % 10 < 8 THEN 8 + d.seed % 23
    WHEN d.seed % 10 = 8 THEN 31 + d.seed % 60 ELSE 91 + d.seed % 60 END AS days) age
  WHERE a.asset_type <> N'ip-node' AND (NULLIF(LTRIM(RTRIM(a.name)), N'') IS NULL OR NULLIF(LTRIM(RTRIM(a.ip_address)), N'') IS NULL
    OR NULLIF(LTRIM(RTRIM(a.mac_address)), N'') IS NULL OR NULLIF(LTRIM(RTRIM(a.device_model)), N'') IS NULL
    OR a.last_discovered_date IS NULL OR NULLIF(LTRIM(RTRIM(a.discovered_by)), N'') IS NULL);
  INSERT INTO @changes VALUES (N'endpoints enriched', @@ROWCOUNT);

  UPDATE n SET name = CONCAT(N'Demo Network ', n.network_id)
  OUTPUT inserted.snapshot_id INTO #Touched
  FROM tsaat.managed_network n WHERE NULLIF(LTRIM(RTRIM(n.name)), N'') IS NULL;
  INSERT INTO @changes VALUES (N'network labels filled', @@ROWCOUNT);

  -- Only software-hosting endpoints require an OS record for the requested table.
  -- Unknown support metadata is retained for new mock OS records; no compliance is asserted.
  INSERT INTO tsaat.asset_operating_system
    (snapshot_id, asset_id, family, vendor, major_version, version, patch_level, support_status, current_supported_major, n_minus)
  OUTPUT inserted.snapshot_id INTO #Touched
  SELECT a.snapshot_id, a.asset_id,
    CASE WHEN a.asset_type = N'workstation' THEN CHOOSE(d.seed % 2 + 1, N'Windows', N'Ubuntu Desktop')
      ELSE CHOOSE(d.seed % 3 + 1, N'Windows Server', N'Ubuntu Server', N'RHEL') END,
    CASE WHEN a.asset_type = N'workstation' THEN CHOOSE(d.seed % 2 + 1, N'Microsoft', N'Canonical')
      ELSE CHOOSE(d.seed % 3 + 1, N'Microsoft', N'Canonical', N'Red Hat') END,
    NULL,
    CASE WHEN a.asset_type = N'workstation' THEN CHOOSE(d.seed % 2 + 1, N'11.0', N'22.04')
      ELSE CHOOSE(d.seed % 3 + 1, N'2022', N'22.04', N'9.3') END,
    NULL, N'Unknown', NULL, NULL
  FROM tsaat.asset a JOIN #DemoCI d ON d.asset_id = a.asset_id
  WHERE EXISTS (SELECT 1 FROM tsaat.asset_installed_software sw WHERE sw.snapshot_id = a.snapshot_id AND sw.asset_id = a.asset_id)
    AND NOT EXISTS (SELECT 1 FROM tsaat.asset_operating_system os WHERE os.snapshot_id = a.snapshot_id AND os.asset_id = a.asset_id)
    AND NOT EXISTS (SELECT 1 FROM tsaat.asset_network_os nos WHERE nos.snapshot_id = a.snapshot_id AND nos.asset_id = a.asset_id);
  INSERT INTO @changes VALUES (N'missing host OS records added', @@ROWCOUNT);

  UPDATE os SET
    family = CASE WHEN NULLIF(LTRIM(RTRIM(os.family)), N'') IS NULL THEN N'Demo Endpoint OS' ELSE os.family END,
    version = CASE WHEN NULLIF(LTRIM(RTRIM(os.version)), N'') IS NULL THEN N'1.0-demo' ELSE os.version END,
    patch_level = CASE WHEN NULLIF(LTRIM(RTRIM(os.patch_level)), N'') IS NULL THEN
      CONCAT(CASE WHEN os.family LIKE N'%Windows%' THEN N'DEMO-WIN-' ELSE N'DEMO-LINUX-' END,
        CONVERT(CHAR(7), DATEADD(MONTH, -(d.seed % 4), s.snapshot_date), 23), N'-R', d.seed % 5 + 1) ELSE os.patch_level END
  OUTPUT inserted.snapshot_id INTO #Touched
  FROM tsaat.asset_operating_system os JOIN #DemoCI d ON d.asset_id = os.asset_id
  JOIN tsaat.dataset_snapshot s ON s.snapshot_id = os.snapshot_id
  WHERE NULLIF(LTRIM(RTRIM(os.family)), N'') IS NULL OR NULLIF(LTRIM(RTRIM(os.version)), N'') IS NULL
    OR NULLIF(LTRIM(RTRIM(os.patch_level)), N'') IS NULL;
  INSERT INTO @changes VALUES (N'endpoint OS records enriched', @@ROWCOUNT);

  UPDATE os SET
    family = CASE WHEN NULLIF(LTRIM(RTRIM(os.family)), N'') IS NULL THEN N'Demo Network OS' ELSE os.family END,
    version = CASE WHEN NULLIF(LTRIM(RTRIM(os.version)), N'') IS NULL THEN N'1.0-demo' ELSE os.version END,
    patch_level = CASE WHEN NULLIF(LTRIM(RTRIM(os.patch_level)), N'') IS NULL THEN
      CONCAT(N'DEMO-FW-', CONVERT(CHAR(7), DATEADD(MONTH, -(d.seed % 4), s.snapshot_date), 23), N'-R', d.seed % 5 + 1) ELSE os.patch_level END
  OUTPUT inserted.snapshot_id INTO #Touched
  FROM tsaat.asset_network_os os JOIN #DemoCI d ON d.asset_id = os.asset_id
  JOIN tsaat.dataset_snapshot s ON s.snapshot_id = os.snapshot_id
  WHERE NULLIF(LTRIM(RTRIM(os.family)), N'') IS NULL OR NULLIF(LTRIM(RTRIM(os.version)), N'') IS NULL
    OR NULLIF(LTRIM(RTRIM(os.patch_level)), N'') IS NULL;
  INSERT INTO @changes VALUES (N'network OS records enriched', @@ROWCOUNT);

  UPDATE sw SET
    name = CASE WHEN NULLIF(LTRIM(RTRIM(sw.name)), N'') IS NULL THEN CONCAT(N'Demo Application ', sw.software_ordinal) ELSE sw.name END,
    version = CASE WHEN NULLIF(LTRIM(RTRIM(sw.version)), N'') IS NULL THEN CONCAT(N'1.', sw.software_ordinal, N'.0-demo') ELSE sw.version END,
    file_path = CASE WHEN NULLIF(LTRIM(RTRIM(sw.file_path)), N'') IS NULL THEN
      CASE WHEN COALESCE(os.family, nos.family) LIKE N'%Windows%'
        THEN CONCAT(N'C:\Program Files\', names.folder, N'\', names.version, N'\', LOWER(REPLACE(names.folder, N' ', N'-')), N'.exe')
        ELSE CONCAT(N'/opt/', LOWER(REPLACE(names.folder, N' ', N'-')), N'/', names.version, N'/bin/', LOWER(REPLACE(names.folder, N' ', N'-'))) END
      ELSE sw.file_path END,
    last_discovered_date = COALESCE(sw.last_discovered_date, DATEADD(MINUTE, -(30 + sw.software_ordinal % 90),
      CASE WHEN a.last_discovered_date < DATEADD(DAY, 1, CONVERT(DATETIME2(3), s.snapshot_date)) THEN a.last_discovered_date ELSE CONVERT(DATETIME2(3), s.snapshot_date) END)),
    discovered_by = CASE WHEN NULLIF(LTRIM(RTRIM(sw.discovered_by)), N'') IS NULL THEN
      CHOOSE((d.seed + sw.software_ordinal) % 4 + 1, N'Demo: Software Scanner', N'Demo: Configuration Manager', N'Demo: Endpoint Agent', N'Demo: Package Inventory') ELSE sw.discovered_by END
  OUTPUT inserted.snapshot_id INTO #Touched
  FROM tsaat.asset_installed_software sw
  JOIN tsaat.asset a ON a.snapshot_id = sw.snapshot_id AND a.asset_id = sw.asset_id
  JOIN #DemoCI d ON d.asset_id = sw.asset_id
  JOIN tsaat.dataset_snapshot s ON s.snapshot_id = sw.snapshot_id
  LEFT JOIN tsaat.asset_operating_system os ON os.snapshot_id = sw.snapshot_id AND os.asset_id = sw.asset_id
  LEFT JOIN tsaat.asset_network_os nos ON nos.snapshot_id = sw.snapshot_id AND nos.asset_id = sw.asset_id
  CROSS APPLY (SELECT
    TRANSLATE(COALESCE(NULLIF(LTRIM(RTRIM(sw.name)), N''), CONCAT(N'Demo Application ', sw.software_ordinal)), N'\/:*?"<>|', N'_________') AS folder,
    TRANSLATE(COALESCE(NULLIF(LTRIM(RTRIM(sw.version)), N''), CONCAT(N'1.', sw.software_ordinal, N'.0-demo')), N'\/:*?"<>|', N'_________') AS version) names
  WHERE NULLIF(LTRIM(RTRIM(sw.name)), N'') IS NULL OR NULLIF(LTRIM(RTRIM(sw.version)), N'') IS NULL
    OR NULLIF(LTRIM(RTRIM(sw.file_path)), N'') IS NULL OR sw.last_discovered_date IS NULL
    OR NULLIF(LTRIM(RTRIM(sw.discovered_by)), N'') IS NULL;
  INSERT INTO @changes VALUES (N'software installations enriched', @@ROWCOUNT);

  -- Refresh the data version so the application reloads its cached snapshot payloads.
  -- Preserve snapshot dates, which determine historical filtering and discovery age.
  UPDATE s SET generated_at = TODATETIMEOFFSET(SYSUTCDATETIME(), N'+00:00'),
    updated_at_utc = SYSUTCDATETIME(), updated_by = SUSER_SNAME()
  FROM tsaat.dataset_snapshot s WHERE EXISTS (SELECT 1 FROM #Touched t WHERE t.snapshot_id = s.snapshot_id);
  INSERT INTO @changes VALUES (N'snapshot data versions refreshed', @@ROWCOUNT);

  IF EXISTS (
    SELECT 1 FROM tsaat.asset a JOIN tsaat.managed_network n ON n.snapshot_id = a.snapshot_id AND n.network_id = a.network_id
    WHERE a.asset_type <> N'ip-node' AND (NULLIF(LTRIM(RTRIM(a.name)), N'') IS NULL OR NULLIF(LTRIM(RTRIM(a.asset_type)), N'') IS NULL
      OR NULLIF(LTRIM(RTRIM(a.ip_address)), N'') IS NULL OR NULLIF(LTRIM(RTRIM(a.mac_address)), N'') IS NULL
      OR NULLIF(LTRIM(RTRIM(a.device_model)), N'') IS NULL OR a.last_discovered_date IS NULL
      OR NULLIF(LTRIM(RTRIM(a.discovered_by)), N'') IS NULL OR NULLIF(LTRIM(RTRIM(n.name)), N'') IS NULL)
  ) THROW 51001, 'Endpoint explorer fields remain incomplete; demo update rolled back.', 1;
  IF EXISTS (
    SELECT 1 FROM tsaat.asset_installed_software sw
    LEFT JOIN tsaat.asset_operating_system os ON os.snapshot_id = sw.snapshot_id AND os.asset_id = sw.asset_id
    LEFT JOIN tsaat.asset_network_os nos ON nos.snapshot_id = sw.snapshot_id AND nos.asset_id = sw.asset_id
    WHERE NULLIF(LTRIM(RTRIM(sw.name)), N'') IS NULL OR NULLIF(LTRIM(RTRIM(sw.version)), N'') IS NULL
      OR NULLIF(LTRIM(RTRIM(sw.file_path)), N'') IS NULL OR sw.last_discovered_date IS NULL
      OR NULLIF(LTRIM(RTRIM(sw.discovered_by)), N'') IS NULL
      OR NULLIF(LTRIM(RTRIM(CASE WHEN os.asset_id IS NOT NULL THEN os.family ELSE nos.family END)), N'') IS NULL
      OR NULLIF(LTRIM(RTRIM(CASE WHEN os.asset_id IS NOT NULL THEN os.version ELSE nos.version END)), N'') IS NULL
      OR NULLIF(LTRIM(RTRIM(CASE WHEN os.asset_id IS NOT NULL THEN os.patch_level ELSE nos.patch_level END)), N'') IS NULL
  ) THROW 51002, 'Software explorer fields remain incomplete; demo update rolled back.', 1;
  COMMIT TRANSACTION;
  SELECT entity, records FROM @changes FOR JSON PATH;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
