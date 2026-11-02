import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { executeSqlJson } from "@/lib/sql-server";
import type { StoredKpiEvaluation } from "@/lib/types";

// Opt in against a development database; migration and fixture changes always roll back.
describe.runIf(process.env.TSAAT_SQL_INTEGRATION === "1")("system KPI SQL integration", () => {
  const migration = readFileSync("Database Schema/migrations/023_system_ato_diis_kpis.sql", "utf8");
  const setup = `
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO
${migration}
DECLARE @snapshot BIGINT = (SELECT TOP (1) [snapshot_id] FROM [tsaat].[ict_system] GROUP BY [snapshot_id] HAVING COUNT(*) >= 2 ORDER BY [snapshot_id] DESC);
IF @snapshot IS NULL THROW 51000, 'KPI integration tests require a snapshot with two systems.', 1;
DECLARE @first NVARCHAR(255) = (SELECT MIN([system_id]) FROM [tsaat].[ict_system] WHERE [snapshot_id] = @snapshot);
DECLARE @second NVARCHAR(255) = (SELECT MIN([system_id]) FROM [tsaat].[ict_system] WHERE [snapshot_id] = @snapshot AND [system_id] <> @first);
UPDATE [tsaat].[ict_system] SET [ato_number] = CASE WHEN [system_id] = @first THEN N'ATO-TEST' ELSE N'   ' END,
  [diis_defined] = CASE WHEN [system_id] = @second THEN 1 ELSE 0 END
WHERE [snapshot_id] = @snapshot AND [system_id] IN (@first, @second);
DECLARE @ids NVARCHAR(MAX) = N'["' + STRING_ESCAPE(@first, 'json') + N'","' + STRING_ESCAPE(@second, 'json') + N'","' + STRING_ESCAPE(@first, 'json') + N'"]';
`;
  function expectSystemCounts(rows: StoredKpiEvaluation[]) {
    expect(rows.map((row) => row.kpiId)).toEqual(["KPI-1", "KPI-2"]);
    for (const row of rows) expect(row).toMatchObject({ scorePercent: 50, compliantCount: 1, nonCompliantCount: 1, applicableCount: 2, unknownCount: 0 });
  }
  it("uses stored ATO and DIIS attributes once per selected system even with no assets", async () => {
    const rows = await executeSqlJson<StoredKpiEvaluation[]>(`${setup}
EXEC [tsaat].[usp_evaluate_kpi_snapshot] @snapshot_id = @snapshot, @system_ids_json = @ids, @asset_ids_json = N'[]', @network_ids_json = N'[]', @emit_json = 1;
ROLLBACK TRANSACTION;`);
    expectSystemCounts(rows);
  }, 60000);
  it("uses the same rules for bulk reports", async () => {
    const rows = await executeSqlJson<StoredKpiEvaluation[]>(`${setup}
DECLARE @scopes NVARCHAR(MAX) = N'[{"scopeKey":"test","systemIds":' + @ids + N',"assetIds":[],"networkIds":[],"findings":[]}]';
EXEC [tsaat].[usp_evaluate_kpi_snapshot_bulk] @snapshot_id = @snapshot, @scope_rows_json = @scopes, @emit_json = 1;
ROLLBACK TRANSACTION;`);
    expectSystemCounts(rows);
  }, 60000);
  it("returns zero assessments for an explicitly empty system scope", async () => {
    const rows = await executeSqlJson<StoredKpiEvaluation[]>(`${setup}
EXEC [tsaat].[usp_evaluate_kpi_snapshot] @snapshot_id = @snapshot, @system_ids_json = N'[]', @asset_ids_json = N'[]', @network_ids_json = N'[]', @emit_json = 1;
ROLLBACK TRANSACTION;`);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).toMatchObject({ scorePercent: 0, compliantCount: 0, nonCompliantCount: 0, applicableCount: 0, unknownCount: 0 });
  }, 60000);
});
