import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { executeSqlJson } from "@/lib/sql-server";
import { clearDataLoaderCaches, loadDatasetTimeline } from "@/lib/data-loader";
import { buildNetworkDetails } from "@/lib/network-details";
import { buildIctSystemDetails } from "@/lib/ict-system-details";

describe.runIf(process.env.TSAAT_SQL_INTEGRATION === "1")("Risk entity panel details backfill", () => {
  it("fills all snapshots, preserves stored values and posture data, and does not rewrite populated rows", async () => {
    const migration = readFileSync("Database Schema/migrations/026_populate_demo_entity_panel_details.sql", "utf8");
    const result = await executeSqlJson<{
      missing: number; preserved: boolean; postureUnchanged: boolean; assetsUnchanged: boolean; rerunUnchanged: boolean;
    }>(`
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
-- Null and blank values exercise both backfill cases. Preserve custom fields
-- alongside missing fields on the same row, including explicitly missing ATO.
UPDATE [tsaat].[managed_network] SET [description] = NULL, [owner] = N'  ', [support_email] = NULL,
  [service_catalogue_url] = N'  ' WHERE [network_id] = N'net-1';
UPDATE [tsaat].[ict_system] SET [description] = N'Existing system description', [owner] = N'Existing owner',
  [support_email] = NULL, [service_catalogue_url] = N'https://existing.example.test/catalogue',
  [ato_number] = NULL, [diis_defined] = 0 WHERE [system_id] = N'sys-1';
SELECT [snapshot_id], [network_id], [name], [criticality], [adf_platform], [enterprise_platform], [modelling_status],
  [classification], [diis_id], [ato_number], [diis_url], [grc_url], [discovery_status]
  INTO #network_posture FROM [tsaat].[managed_network];
SELECT [snapshot_id], [system_id], [network_id], [name], [adf_platform], [enterprise_platform], [diis_id],
  [ato_number], [apm_number], [diis_url], [grc_url], [modelling_status], [diis_defined], [criticality], [security_domain]
  INTO #system_posture FROM [tsaat].[ict_system];
SELECT COUNT_BIG(*) AS count, CHECKSUM_AGG(BINARY_CHECKSUM(*)) AS checksum INTO #assets FROM [tsaat].[asset];
${migration}
SELECT [snapshot_id], [network_id], CAST([row_version] AS BINARY(8)) AS version INTO #network_after FROM [tsaat].[managed_network];
SELECT [snapshot_id], [system_id], CAST([row_version] AS BINARY(8)) AS version INTO #system_after FROM [tsaat].[ict_system];
${migration}
SELECT
  (SELECT COUNT(*) FROM (
    SELECT [description], [owner], [support_email], [service_catalogue_url] FROM [tsaat].[managed_network]
    UNION ALL SELECT [description], [owner], [support_email], [service_catalogue_url] FROM [tsaat].[ict_system]
  ) e WHERE NULLIF(LTRIM(RTRIM([description])), N'') IS NULL OR NULLIF(LTRIM(RTRIM([owner])), N'') IS NULL
    OR NULLIF(LTRIM(RTRIM([support_email])), N'') IS NULL OR NULLIF(LTRIM(RTRIM([service_catalogue_url])), N'') IS NULL) AS missing,
  CAST(CASE WHEN EXISTS (SELECT 1 FROM [tsaat].[ict_system] WHERE [system_id] = N'sys-1') AND NOT EXISTS (
    SELECT 1 FROM [tsaat].[ict_system] WHERE [system_id] = N'sys-1' AND ([description] <> N'Existing system description'
      OR [owner] <> N'Existing owner' OR [service_catalogue_url] <> N'https://existing.example.test/catalogue')) THEN 1 ELSE 0 END AS BIT) AS preserved,
  CAST(CASE WHEN NOT EXISTS (SELECT * FROM #network_posture EXCEPT SELECT [snapshot_id], [network_id], [name],
    [criticality], [adf_platform], [enterprise_platform], [modelling_status], [classification], [diis_id], [ato_number],
    [diis_url], [grc_url], [discovery_status] FROM [tsaat].[managed_network])
    AND NOT EXISTS (SELECT * FROM #system_posture EXCEPT SELECT [snapshot_id], [system_id], [network_id], [name],
    [adf_platform], [enterprise_platform], [diis_id], [ato_number], [apm_number], [diis_url], [grc_url],
    [modelling_status], [diis_defined], [criticality], [security_domain] FROM [tsaat].[ict_system]) THEN 1 ELSE 0 END AS BIT) AS postureUnchanged,
  CAST(CASE WHEN (SELECT count FROM #assets) = (SELECT COUNT_BIG(*) FROM [tsaat].[asset]) AND
    (SELECT checksum FROM #assets) = (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM [tsaat].[asset]) THEN 1 ELSE 0 END AS BIT) AS assetsUnchanged,
  CAST(CASE WHEN NOT EXISTS (SELECT * FROM #network_after EXCEPT SELECT [snapshot_id], [network_id], CAST([row_version] AS BINARY(8)) FROM [tsaat].[managed_network])
    AND NOT EXISTS (SELECT * FROM #system_after EXCEPT SELECT [snapshot_id], [system_id], CAST([row_version] AS BINARY(8)) FROM [tsaat].[ict_system]) THEN 1 ELSE 0 END AS BIT) AS rerunUnchanged
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
ROLLBACK TRANSACTION;
`);
    expect(result).toEqual({ missing: 0, preserved: true, postureUnchanged: true, assetsUnchanged: true, rerunUnchanged: true });
  }, 60000);

  it("loads populated panel models from SQL for every network and ICT system in every snapshot", async () => {
    clearDataLoaderCaches();
    const datasets = await loadDatasetTimeline({ profile: "risk-summary" });
    expect(datasets.length).toBeGreaterThan(0);
    for (const dataset of datasets) {
      expect(dataset.managedNetworks.length).toBeGreaterThan(0);
      expect(dataset.ictSystems.length).toBeGreaterThan(0);
      const networks = dataset.managedNetworks.map(network => buildNetworkDetails(network,
        dataset.assets.filter(asset => asset.networkId === network.id),
        dataset.ictSystems.filter(system => network.ictSystemIds.includes(system.id))));
      const systems = dataset.ictSystems.map(system => buildIctSystemDetails(system,
        dataset.assets.filter(asset => asset.systemContext?.systemId === system.id),
        dataset.managedNetworks.filter(network => network.id === system.networkId)));
      for (const details of [...networks, ...systems]) {
        for (const key of ["description", "owner", "supportEmail", "serviceCatalogueUrl", "atoNumber", "diisId"] as const) {
          expect(details[key].trim(), `${dataset.snapshotDate}: ${details.id} ${key}`).not.toBe("");
        }
        expect(new URL(details.serviceCatalogueUrl).protocol).toMatch(/^https?:$/);
      }
      for (const system of systems) expect(system.apmNumber, `${dataset.snapshotDate}: ${system.id} APP-ID`).not.toBe("");
    }
  }, 60000);
});
