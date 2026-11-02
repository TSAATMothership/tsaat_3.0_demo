import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { executeSqlJson } from "@/lib/sql-server";
import { ASSET_TYPES } from "@/lib/asset-taxonomy";
import { CMDB_ATTRIBUTE_KEYS } from "@/lib/cmdb-attributes";
import { loadCmdbAttributeDefinitions } from "@/lib/cmdb-attribute-loader";
import { GET } from "@/app/api/assets/cmdb-details/route";
import { NextRequest } from "next/server";

describe.runIf(process.env.TSAAT_SQL_INTEGRATION === "1")("CMDB attribute SQL integration", () => {
  it("installs defaults without changing asset data and preserves later per-type mappings on rerun", async () => {
    const migration = readFileSync("Database Schema/migrations/025_cmdb_asset_type_attributes.sql", "utf8");
    const rows = await executeSqlJson<{
      defaults: Array<{ assetType: string; key: string; label: string; displayOrder: number; enabled: boolean }>;
      modified: Array<{ assetType: string; key: string; displayOrder: number; enabled: boolean }>;
      label: string; assetsUnchanged: boolean; snapshotsUnchanged: boolean;
    }>(`
SET XACT_ABORT ON;
BEGIN TRANSACTION;
SELECT COUNT_BIG(*) AS asset_count, CHECKSUM_AGG(BINARY_CHECKSUM(*)) AS asset_checksum,
  (SELECT COUNT(*) FROM [tsaat].[dataset_snapshot]) AS snapshot_count INTO #cmdb_initial FROM [tsaat].[asset];
-- Recreate only these metadata tables inside the rollback-only test transaction.
DROP TABLE IF EXISTS [tsaat].[cmdb_asset_type_attribute];
DROP TABLE IF EXISTS [tsaat].[cmdb_attribute_definition];
GO
${migration}
DECLARE @defaults NVARCHAR(MAX) = (SELECT m.[asset_type] AS [assetType], m.[attribute_key] AS [key],
  d.[label], m.[display_order] AS [displayOrder], m.[is_enabled] AS [enabled]
  FROM [tsaat].[cmdb_asset_type_attribute] m JOIN [tsaat].[cmdb_attribute_definition] d ON d.[attribute_key] = m.[attribute_key]
  ORDER BY m.[asset_type], m.[display_order] FOR JSON PATH);
UPDATE [tsaat].[cmdb_asset_type_attribute] SET [is_enabled] = 0, [display_order] = 777
  WHERE [asset_type] = N'workstation' AND [attribute_key] = N'assetHostname';
DELETE FROM [tsaat].[cmdb_asset_type_attribute] WHERE [asset_type] = N'printer-device'
  OR ([asset_type] = N'workstation' AND [attribute_key] = N'networkOsSummary');
UPDATE [tsaat].[cmdb_attribute_definition] SET [label] = N'Configured Hostname' WHERE [attribute_key] = N'assetHostname';
-- The second migration contains GO; preserve the test results in a session temporary table.
SELECT asset_count, asset_checksum, snapshot_count, @defaults AS defaults_json INTO #cmdb_before FROM #cmdb_initial;
GO
${migration}
SELECT JSON_QUERY((SELECT defaults_json FROM #cmdb_before)) AS [defaults],
  JSON_QUERY((SELECT [asset_type] AS [assetType], [attribute_key] AS [key], [display_order] AS [displayOrder], [is_enabled] AS [enabled]
    FROM [tsaat].[cmdb_asset_type_attribute] ORDER BY [asset_type], [display_order] FOR JSON PATH)) AS [modified],
  (SELECT [label] FROM [tsaat].[cmdb_attribute_definition] WHERE [attribute_key] = N'assetHostname') AS [label],
  CAST(CASE WHEN (SELECT asset_count FROM #cmdb_before) = (SELECT COUNT_BIG(*) FROM [tsaat].[asset])
    AND (SELECT asset_checksum FROM #cmdb_before) = (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM [tsaat].[asset]) THEN 1 ELSE 0 END AS BIT) AS [assetsUnchanged],
  CAST(CASE WHEN (SELECT snapshot_count FROM #cmdb_before) = (SELECT COUNT(*) FROM [tsaat].[dataset_snapshot]) THEN 1 ELSE 0 END AS BIT) AS [snapshotsUnchanged]
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
ROLLBACK TRANSACTION;
`);
    expect(rows.defaults).toHaveLength(126);
    for (const assetType of ASSET_TYPES) {
      const defaults = rows.defaults.filter(row => row.assetType === assetType);
      expect(defaults.map(row => row.key)).toEqual([...CMDB_ATTRIBUTE_KEYS]);
      expect(defaults.every(row => row.enabled)).toBe(true);
    }
    expect(rows.modified.filter(row => row.assetType === "printer-device")).toEqual([]);
    expect(rows.modified.filter(row => row.assetType === "server")).toHaveLength(18);
    expect(rows.modified.find(row => row.assetType === "workstation" && row.key === "assetHostname"))
      .toMatchObject({ enabled: false, displayOrder: 777 });
    expect(rows.modified.some(row => row.assetType === "workstation" && row.key === "networkOsSummary")).toBe(false);
    expect(rows.label).toBe("Configured Hostname");
    expect(rows.assetsUnchanged).toBe(true);
    expect(rows.snapshotsUnchanged).toBe(true);
  }, 60000);

  it("serves real snapshot values for populated asset types and validates mappings for every supported type", async () => {
    const assets = await executeSqlJson<Array<{ assetId: string; assetType: typeof ASSET_TYPES[number]; snapshotDate: string }>>(`
      WITH candidates AS (
        SELECT a.[asset_id] AS [assetId], a.[asset_type] AS [assetType], CONVERT(CHAR(10), s.[snapshot_date], 23) AS [snapshotDate],
          ROW_NUMBER() OVER (PARTITION BY a.[asset_type] ORDER BY a.[asset_id]) AS rn
        FROM [tsaat].[asset] a JOIN [tsaat].[dataset_snapshot] s ON s.[snapshot_id] = a.[snapshot_id]
        WHERE s.[snapshot_id] = (SELECT TOP (1) [snapshot_id] FROM [tsaat].[dataset_snapshot] ORDER BY [snapshot_date] DESC)
      ) SELECT [assetId], [assetType], [snapshotDate] FROM candidates WHERE rn = 1 FOR JSON PATH;
    `);
    expect(assets.length).toBeGreaterThan(0);
    expect(assets.every(asset => ASSET_TYPES.includes(asset.assetType))).toBe(true);
    for (const assetType of ASSET_TYPES) {
      const mapping = await loadCmdbAttributeDefinitions(assetType);
      expect(mapping.map(row => row.key)).toEqual([...CMDB_ATTRIBUTE_KEYS]);
    }
    for (const asset of assets) {
      const mapping = await loadCmdbAttributeDefinitions(asset.assetType);
      const params = new URLSearchParams({ assetId: asset.assetId, dataDate: asset.snapshotDate });
      const response = await GET(new NextRequest(`http://localhost/api/assets/cmdb-details?${params}`));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.asset).toMatchObject({ assetId: asset.assetId, assetType: asset.assetType, snapshotDate: asset.snapshotDate });
      expect(body.asset.attributes.map((row: { key: string; label: string }) => ({ key: row.key, label: row.label })))
        .toEqual(mapping.map(row => ({ key: row.key, label: row.label })));
      for (const row of body.asset.attributes) expect(typeof row.value).toBe("string");
    }
  }, 60000);
});
