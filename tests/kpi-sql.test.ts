import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { executeSqlJson } from "@/lib/sql-server";
import type { StoredKpiEvaluation } from "@/lib/types";

// Opt in against a development database; migration and fixture changes always roll back.
describe.runIf(process.env.TSAAT_SQL_INTEGRATION === "1")("system KPI SQL integration", () => {
  const migration = readFileSync("Database Schema/migrations/027_remove_retired_runtime_structures.sql", "utf8");
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
  it("preserves tabular procedure output for SQL consumers", async () => {
    const rows = await executeSqlJson<StoredKpiEvaluation[]>(`${setup}
DECLARE @result TABLE (snapshot_id BIGINT, kpi_id NVARCHAR(50), display_order INT, calculation_key NVARCHAR(100),
  score NVARCHAR(100), score_percent DECIMAL(9,1), compliant_count INT, applicable_count INT,
  non_compliant_count INT, unknown_count INT, high_priority_count INT);
INSERT INTO @result EXEC [tsaat].[usp_evaluate_kpi_snapshot] @snapshot_id = @snapshot,
  @system_ids_json = @ids, @asset_ids_json = N'[]', @emit_json = 0;
SELECT kpi_id AS kpiId, score_percent AS scorePercent, compliant_count AS compliantCount,
  applicable_count AS applicableCount, non_compliant_count AS nonCompliantCount, unknown_count AS unknownCount
FROM @result ORDER BY display_order FOR JSON PATH;
ROLLBACK TRANSACTION;`);
    expectSystemCounts(rows);
  }, 60000);
  it("removes only retired structures and preserves active catalogue and tasking bindings on rerun", async () => {
    const result = await executeSqlJson<{ calculations: number; reports: number; kpis: number; bindings: number; parametersGone: boolean; hashGone: boolean; networkAppIdGone: boolean; systemAppIdPresent: boolean }>(`${setup}
${migration}
SELECT (SELECT COUNT(*) FROM tsaat.kpi_calculation_definition) AS calculations,
  (SELECT COUNT(*) FROM tsaat.kpi_report_detail_definition) AS reports,
  (SELECT COUNT(*) FROM tsaat.kpi_definition) AS kpis,
  (SELECT COUNT(*) FROM tsaat.kpi_report_detail_binding) AS bindings,
  CAST(CASE WHEN OBJECT_ID(N'tsaat.kpi_calculation_parameter') IS NULL THEN 1 ELSE 0 END AS BIT) AS parametersGone,
  CAST(CASE WHEN OBJECT_ID(N'tsaat.fn_kpi_stable_hash') IS NULL THEN 1 ELSE 0 END AS BIT) AS hashGone,
  CAST(CASE WHEN COL_LENGTH(N'tsaat.managed_network', N'apm_number') IS NULL THEN 1 ELSE 0 END AS BIT) AS networkAppIdGone,
  CAST(CASE WHEN COL_LENGTH(N'tsaat.ict_system', N'apm_number') IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS systemAppIdPresent
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
ROLLBACK TRANSACTION;`);
    expect(result).toEqual({ calculations: 2, reports: 1, kpis: 2, bindings: 2, parametersGone: true, hashGone: true, networkAppIdGone: true, systemAppIdPresent: true });
  }, 60000);
  it("refuses custom calculation records without committing the fixture", async () => {
    await expect(executeSqlJson(`SET XACT_ABORT ON;
BEGIN TRANSACTION;
INSERT INTO tsaat.kpi_calculation_definition (calculation_key, source_key, display_order, name, description, enabled)
SELECT N'cleanup-test-custom', MIN(source_key), 999997, N'Custom', N'Preserve custom configuration', 1 FROM tsaat.kpi_calculation_source;
GO
${migration}`)).rejects.toThrow(/custom KPI calculations require review/);
    const rows = await executeSqlJson<Array<{ count: number }>>(`SELECT COUNT(*) AS count FROM tsaat.kpi_calculation_definition WHERE calculation_key=N'cleanup-test-custom' FOR JSON PATH;`);
    expect(rows).toEqual([{ count: 0 }]);
  }, 60000);
  it("refuses a custom report binding without changing the active binding", async () => {
    await expect(executeSqlJson(`SET XACT_ABORT ON;
BEGIN TRANSACTION;
INSERT INTO tsaat.kpi_report_detail_definition (report_detail_key, handler_key, display_order, name, description, enabled)
VALUES (N'cleanup-test-custom', N'custom', 999997, N'Custom', N'Preserve custom report binding', 1);
UPDATE tsaat.kpi_report_detail_binding SET report_detail_key=N'cleanup-test-custom' WHERE kpi_id=N'KPI-1';
GO
${migration}`)).rejects.toThrow(/custom report detail/);
    const rows = await executeSqlJson<Array<{ report: string }>>(`SELECT report_detail_key AS report FROM tsaat.kpi_report_detail_binding WHERE kpi_id=N'KPI-1' FOR JSON PATH;`);
    expect(rows).toEqual([{ report: 'generic-kpi-summary' }]);
  }, 60000);
});
