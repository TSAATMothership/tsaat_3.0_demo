-- Read-only audit of the exact fields displayed by the two CMDB explorers.
SELECT
  (SELECT COUNT(*) FROM tsaat.dataset_snapshot) AS snapshots,
  (SELECT COUNT_BIG(*) FROM tsaat.asset WHERE asset_type <> N'ip-node') AS endpointRecords,
  (SELECT COUNT_BIG(*) FROM tsaat.asset WHERE asset_type = N'ip-node') AS ipNodeRecords,
  (SELECT COUNT_BIG(*) FROM tsaat.asset_installed_software) AS installationRecords,
  JSON_QUERY((
    SELECT f.field, SUM(CASE WHEN NULLIF(LTRIM(RTRIM(f.value)), N'') IS NULL THEN 1 ELSE 0 END) AS missing
    FROM tsaat.asset a
    LEFT JOIN tsaat.managed_network n ON n.snapshot_id = a.snapshot_id AND n.network_id = a.network_id
    CROSS APPLY (VALUES
      (N'Name', CONVERT(NVARCHAR(2048), a.name)), (N'CI Type', a.asset_type), (N'IP Address', a.ip_address),
      (N'MAC Address', a.mac_address), (N'Device Model', a.device_model),
      (N'Last Discovered Date', CONVERT(NVARCHAR(30), a.last_discovered_date, 126)),
      (N'Discovered By', a.discovered_by), (N'Managed Network', n.name)
    ) f(field, value)
    WHERE a.asset_type <> N'ip-node'
    GROUP BY f.field ORDER BY f.field FOR JSON PATH
  )) AS endpointFields,
  JSON_QUERY((
    SELECT f.field, SUM(CASE WHEN NULLIF(LTRIM(RTRIM(f.value)), N'') IS NULL THEN 1 ELSE 0 END) AS missing
    FROM tsaat.asset_installed_software sw
    JOIN tsaat.asset a ON a.snapshot_id = sw.snapshot_id AND a.asset_id = sw.asset_id
    LEFT JOIN tsaat.asset_operating_system os ON os.snapshot_id = a.snapshot_id AND os.asset_id = a.asset_id
    LEFT JOIN tsaat.asset_network_os nos ON nos.snapshot_id = a.snapshot_id AND nos.asset_id = a.asset_id
    CROSS APPLY (VALUES
      (N'Software Name', CONVERT(NVARCHAR(2048), sw.name)), (N'Software Version', sw.version),
      (N'File Path', sw.file_path), (N'Last Discovered Date', CONVERT(NVARCHAR(30), sw.last_discovered_date, 126)),
      (N'Discovered By', sw.discovered_by), (N'End Point Device Name', a.name), (N'End Point Device Model', a.device_model),
      (N'End Point OS Name', CASE WHEN os.asset_id IS NOT NULL THEN os.family ELSE nos.family END),
      (N'End Point OS Version', CASE WHEN os.asset_id IS NOT NULL THEN os.version ELSE nos.version END),
      (N'End Point OS Patch Level', CASE WHEN os.asset_id IS NOT NULL THEN os.patch_level ELSE nos.patch_level END)
    ) f(field, value)
    GROUP BY f.field ORDER BY f.field FOR JSON PATH
  )) AS softwareFields,
  JSON_QUERY((SELECT asset_type, COUNT(*) AS records FROM tsaat.asset GROUP BY asset_type ORDER BY asset_type FOR JSON PATH)) AS ciTypes,
  JSON_QUERY((SELECT family, COUNT(*) AS records FROM tsaat.asset_operating_system GROUP BY family ORDER BY family FOR JSON PATH)) AS osFamilies,
  JSON_QUERY((SELECT TOP (1) snapshot_id AS id, CONVERT(CHAR(10), snapshot_date, 23) AS date FROM tsaat.dataset_snapshot ORDER BY snapshot_date DESC FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS latestSnapshot
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
