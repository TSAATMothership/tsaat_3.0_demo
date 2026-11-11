import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { executeSqlJsonWithConnection } from "@/lib/sql-server";
import { enrichPatchManagement } from "../scripts/enrich-patch-management.mjs";
import type { ServerPatchRecord } from "@/lib/types";
const database = process.env.TSAAT_PATCH_PARITY_DATABASE?.trim();
const server = process.env.TSAAT_PATCH_PARITY_SERVER?.trim();
type SampleInput = { snapshotDate: string; assets: Array<{ id: string; type: string; operatingSystem: { patchLevel: string | null }; patchManagement: ServerPatchRecord | null }> };
describe.runIf(Boolean(server && database))("patch SQL/JSON disposable parity", () => {
  it("reruns migration and sample population without replacing existing observations", async () => {
    if (!database?.startsWith("TSAAT_PatchParity_")) throw Error("Select an explicit disposable TSAAT_PatchParity_* database.");
    const migration = readFileSync("Database Schema/migrations/029_patch_management_explorer.sql", "utf8");
    const population = readFileSync("Database Schema/loaders/populate-sample-server-patches.sql", "utf8");
    const result = await executeSqlJsonWithConnection<{ before: SampleInput; after: Array<ServerPatchRecord & { assetId: string }>; firstCount: number; secondCount: number }>(`
SET XACT_ABORT ON;
BEGIN TRANSACTION;
${migration}
${migration}
DECLARE @snapshot BIGINT=(SELECT TOP(1) snapshot_id FROM tsaat.dataset_snapshot ORDER BY snapshot_date DESC);
IF @snapshot IS NULL THROW 51032, 'Disposable parity database needs sample inventory.', 1;
SELECT @snapshot AS snapshot_id, (SELECT CONVERT(CHAR(10),snapshot_date,23) AS snapshotDate,
 JSON_QUERY((SELECT a.asset_id AS id, a.asset_type AS type,
   JSON_QUERY((SELECT os.patch_level AS patchLevel FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER)) AS operatingSystem,
   JSON_QUERY((SELECT CASE WHEN p.[assessment_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), p.[assessment_date], 126) + N'Z' END AS [assessmentDate],
 CONVERT(CHAR(10), p.[assessment_valid_until], 23) AS [assessmentValidUntil],
 CASE WHEN p.[last_patched_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), p.[last_patched_date], 126) + N'Z' END AS [lastPatchedDate],
 CASE WHEN p.[last_restarted_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), p.[last_restarted_date], 126) + N'Z' END AS [lastRestartedDate],
 CASE WHEN p.[verified_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), p.[verified_date], 126) + N'Z' END AS [verifiedDate],
 p.[installed_patch_level] AS [installedPatchLevel],
 p.[target_patch_level] AS [targetPatchLevel],
 p.[missing_updates] AS [missingUpdates],
 p.[missing_critical_updates] AS [missingCriticalUpdates],
 p.[restart_required] AS [restartRequired],
 p.[deployment_status] AS [deploymentStatus],
 CONVERT(CHAR(10), p.[due_date], 23) AS [dueDate],
 CONVERT(CHAR(10), p.[planned_date], 23) AS [plannedDate],
 p.[owner] AS [owner],
 p.[maintenance_window] AS [maintenanceWindow],
 p.[change_reference] AS [changeReference],
 p.[exception_reason] AS [exceptionReason],
 CONVERT(CHAR(10), p.[exception_expires_date], 23) AS [exceptionExpiresDate],
 p.[source] AS [source] FROM tsaat.server_patch_observation p
     WHERE p.snapshot_id=a.snapshot_id AND p.asset_id=a.asset_id FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER)) AS patchManagement
 FROM tsaat.asset a LEFT JOIN tsaat.asset_operating_system os ON os.snapshot_id=a.snapshot_id AND os.asset_id=a.asset_id
 WHERE a.snapshot_id=@snapshot AND a.asset_type=N'server' FOR JSON PATH, INCLUDE_NULL_VALUES)) AS assets
 FROM tsaat.dataset_snapshot WHERE snapshot_id=@snapshot FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS before_json INTO #before;
EXEC sys.sp_set_session_context @key=N'TSAAT_SAMPLE_PATCH_MANAGEMENT', @value=1;
GO
${population}
SELECT COUNT(*) AS count_before INTO #count FROM tsaat.server_patch_observation;
GO
${population}
SELECT JSON_QUERY((SELECT before_json FROM #before)) AS [before],
 JSON_QUERY((SELECT p.asset_id AS assetId, CASE WHEN p.[assessment_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), p.[assessment_date], 126) + N'Z' END AS [assessmentDate],
 CONVERT(CHAR(10), p.[assessment_valid_until], 23) AS [assessmentValidUntil],
 CASE WHEN p.[last_patched_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), p.[last_patched_date], 126) + N'Z' END AS [lastPatchedDate],
 CASE WHEN p.[last_restarted_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), p.[last_restarted_date], 126) + N'Z' END AS [lastRestartedDate],
 CASE WHEN p.[verified_date] IS NOT NULL THEN CONVERT(NVARCHAR(30), p.[verified_date], 126) + N'Z' END AS [verifiedDate],
 p.[installed_patch_level] AS [installedPatchLevel],
 p.[target_patch_level] AS [targetPatchLevel],
 p.[missing_updates] AS [missingUpdates],
 p.[missing_critical_updates] AS [missingCriticalUpdates],
 p.[restart_required] AS [restartRequired],
 p.[deployment_status] AS [deploymentStatus],
 CONVERT(CHAR(10), p.[due_date], 23) AS [dueDate],
 CONVERT(CHAR(10), p.[planned_date], 23) AS [plannedDate],
 p.[owner] AS [owner],
 p.[maintenance_window] AS [maintenanceWindow],
 p.[change_reference] AS [changeReference],
 p.[exception_reason] AS [exceptionReason],
 CONVERT(CHAR(10), p.[exception_expires_date], 23) AS [exceptionExpiresDate],
 p.[source] AS [source] FROM tsaat.server_patch_observation p
 WHERE p.snapshot_id=(SELECT snapshot_id FROM #before) ORDER BY p.asset_id FOR JSON PATH, INCLUDE_NULL_VALUES)) AS [after],
 (SELECT count_before FROM #count) AS firstCount, (SELECT COUNT(*) FROM tsaat.server_patch_observation) AS secondCount
 FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
ROLLBACK TRANSACTION;
`, { server: server!, database, trustedConnection: true, sslEnabled: true, sslType: "strict" });
    expect(result.firstCount).toBe(result.secondCount);
    const expected = enrichPatchManagement(result.before).assets.map(asset => ({ assetId: asset.id, ...asset.patchManagement }));
    const normalize = (rows: Array<ServerPatchRecord & { assetId: string }>) => rows.map(row => Object.fromEntries(Object.entries(row).map(([key,value]) =>
      [key, typeof value === "string" && /T\d{2}:\d{2}:\d{2}/.test(value) ? new Date(value).toISOString() : value]))).sort((a,b) => String(a.assetId).localeCompare(String(b.assetId)));
    expect(expected.length).toBeGreaterThan(0);
    expect(normalize(result.after)).toEqual(normalize(expected));
  }, 120000);
});

