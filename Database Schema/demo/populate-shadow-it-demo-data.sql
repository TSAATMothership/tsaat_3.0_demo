/* DEMO ONLY. Requires migration 022 and populated known endpoint discovery details.
   Adds IP Scan nodes per network and ARP nodes per representative network/system owner.
   Existing CIs are preserved. Repeat execution inserts no duplicate nodes.
   IP Nodes deliberately have no invented MAC address, device model, OS or software. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  CREATE TABLE #Touched(snapshot_id BIGINT NOT NULL);
  CREATE TABLE #Numbers(n INT PRIMARY KEY);
  INSERT INTO #Numbers VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12);

  SELECT snapshot_id, asset_id INTO #Owners FROM (
    SELECT snapshot_id, MIN(asset_id) AS asset_id FROM tsaat.asset
    WHERE asset_type <> N'ip-node' AND system_id IS NOT NULL AND network_id <> N'net-unassigned'
    GROUP BY snapshot_id, system_id
    UNION
    SELECT snapshot_id, asset_id FROM (
      SELECT snapshot_id, asset_id, ROW_NUMBER() OVER (PARTITION BY snapshot_id, network_id
        ORDER BY CASE WHEN asset_type = N'network-device' THEN 0 ELSE 1 END, asset_id) AS owner_rank
      FROM tsaat.asset WHERE asset_type <> N'ip-node' AND network_id <> N'net-unassigned' AND LTRIM(RTRIM(network_id)) <> N''
    ) ranked WHERE owner_rank = 1
  ) owners;

  SELECT s.snapshot_id, CONVERT(NVARCHAR(255), CONCAT(N'ip-node-demo-scan-', s.network_id, N'-', nums.n)) AS asset_id,
    s.network_id, s.security_domain, CONVERT(NVARCHAR(20), N'IP Scan') AS discovery_approach,
    CONVERT(NVARCHAR(255), NULL) AS arp_owner_asset_id,
    CONVERT(NVARCHAR(255), CASE WHEN nums.n % 2 = 0 THEN N'Demo: Active IP Scan' ELSE N'Demo: Scheduled IP Scan' END) AS discovered_by
  INTO #Candidates
  FROM (SELECT snapshot_id, network_id, MIN(security_domain) AS security_domain FROM tsaat.asset
    WHERE asset_type <> N'ip-node' AND network_id <> N'net-unassigned' AND LTRIM(RTRIM(network_id)) <> N'' GROUP BY snapshot_id, network_id) s
  CROSS JOIN #Numbers nums
  UNION ALL
  SELECT a.snapshot_id, CONCAT(N'ip-node-demo-arp-', a.asset_id, N'-', nums.n), a.network_id, a.security_domain,
    N'ARP Table', a.asset_id, CASE WHEN a.asset_type = N'network-device' THEN N'Demo: Switch ARP Poll' ELSE N'Demo: Endpoint ARP Collection' END
  FROM #Owners owners JOIN tsaat.asset a ON a.snapshot_id = owners.snapshot_id AND a.asset_id = owners.asset_id
  CROSS JOIN #Numbers nums WHERE nums.n <= 3;

  SELECT asset_id, CONVERT(INT, ROW_NUMBER() OVER (ORDER BY asset_id)) AS ordinal,
    CONVERT(INT, ABS(CONVERT(BIGINT, CHECKSUM(asset_id))) % 1000000) AS seed
  INTO #Identity FROM (SELECT DISTINCT asset_id FROM #Candidates) ids;
  IF (SELECT COUNT(*) FROM #Identity) > 65024 THROW 51010, 'Shadow IT demo address pool exhausted.', 1;

  SELECT c.*, CONCAT(N'10.88.', (i.ordinal - 1) / 254, N'.', (i.ordinal - 1) % 254 + 1) AS ip_address,
    DATEADD(MINUTE, 540 + i.seed % 480, DATEADD(DAY, -CASE i.seed % 4 WHEN 0 THEN i.seed % 7
      WHEN 1 THEN 8 + i.seed % 23 WHEN 2 THEN 31 + i.seed % 60 ELSE 91 + i.seed % 60 END,
      CONVERT(DATETIME2(3), s.snapshot_date))) AS last_discovered_date
  INTO #Nodes FROM #Candidates c JOIN #Identity i ON i.asset_id = c.asset_id
  JOIN tsaat.dataset_snapshot s ON s.snapshot_id = c.snapshot_id;

  IF EXISTS (SELECT 1 FROM #Nodes n JOIN tsaat.asset a ON a.snapshot_id = n.snapshot_id AND a.ip_address = n.ip_address AND a.asset_id <> n.asset_id)
    THROW 51011, 'A generated demo IP address is already assigned to a different CI.', 1;
  IF EXISTS (SELECT 1 FROM #Nodes n JOIN tsaat.asset a ON a.snapshot_id = n.snapshot_id AND a.asset_id = n.asset_id WHERE a.asset_type <> N'ip-node')
    THROW 51012, 'A demo node ID is already assigned to a known CI.', 1;

  INSERT INTO tsaat.asset (snapshot_id, asset_id, name, hostname, ip_address, asset_type, network_id, security_domain,
    lifecycle_eol_status, lifecycle_warranty_status, last_discovered_date, discovered_by, discovery_approach, arp_owner_asset_id)
  OUTPUT inserted.snapshot_id INTO #Touched
  SELECT n.snapshot_id, n.asset_id, CONCAT(N'IP Node ', n.ip_address), N'', n.ip_address, N'ip-node', n.network_id, n.security_domain,
    N'Unknown', N'Unknown', n.last_discovered_date, n.discovered_by, n.discovery_approach, n.arp_owner_asset_id
  FROM #Nodes n WHERE NOT EXISTS (SELECT 1 FROM tsaat.asset a WHERE a.snapshot_id = n.snapshot_id AND a.asset_id = n.asset_id);
  DECLARE @inserted INT = @@ROWCOUNT;
  UPDATE s SET generated_at = TODATETIMEOFFSET(SYSUTCDATETIME(), N'+00:00'), updated_at_utc = SYSUTCDATETIME(), updated_by = SUSER_SNAME()
  FROM tsaat.dataset_snapshot s WHERE EXISTS (SELECT 1 FROM #Touched t WHERE t.snapshot_id = s.snapshot_id);
  DECLARE @snapshots INT = @@ROWCOUNT;
  COMMIT TRANSACTION;
  SELECT @inserted AS insertedNodes, @snapshots AS refreshedSnapshots FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
