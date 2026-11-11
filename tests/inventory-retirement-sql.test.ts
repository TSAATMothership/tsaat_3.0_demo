import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { executeSqlJson, executeSqlText } from '@/lib/sql-server';

describe.runIf(process.env.TSAAT_SQL_INTEGRATION === '1')('inventory retirement SQL guards', () => {
  const migration = readFileSync('Database Schema/migrations/033_retire_analytics_features.sql', 'utf8');
  const acknowledgement = "DECLARE @target sysname=DB_NAME(); EXEC sys.sp_set_session_context @key=N'TSAAT_RETIRE_FEATURES_DATABASE', @value=@target;";
  beforeAll(() => expect(process.env.TSAAT_APP_DATABASE).toMatch(/^TSAAT_EvidenceParity_[A-Za-z0-9_]+$/));
  const state = () => executeSqlJson<{ snapshots: number; assets: number; version: number; probe: number; retiredColumn: number; finding: number }>(`
SELECT (SELECT COUNT(*) FROM tsaat.dataset_snapshot) snapshots,
 (SELECT COUNT(*) FROM tsaat.asset) assets,
 (SELECT MAX(version) FROM tsaat.storage_schema_version) version,
 COALESCE(OBJECT_ID(N'tsaat.retirement_guard_probe'),0) probe,
 COALESCE(COL_LENGTH(N'tsaat.asset_operating_system',N'n_minus'),0) retiredColumn,
 COALESCE(OBJECT_ID(N'tsaat.finding'),0) finding
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;`);
  it('requires the exact target acknowledgement and preserves the selected database', async () => {
    const before = await state();
    await expect(executeSqlText(migration)).rejects.toThrow(/acknowledgement/i);
    expect(await state()).toEqual(before);
  });
  it('refuses custom views over retired columns and rolls back staged DDL', async () => {
    const before = await state();
    await expect(executeSqlText(`BEGIN TRANSACTION;
ALTER TABLE tsaat.asset_operating_system ADD n_minus INT NULL;
EXEC(N'CREATE VIEW tsaat.retirement_guard_probe AS SELECT n_minus FROM tsaat.asset_operating_system');
${acknowledgement}
${migration}`)).rejects.toThrow(/retired inventory column/i);
    expect(await state()).toEqual(before);
  });
  it('refuses custom triggers over retired tables and rolls back staged DDL', async () => {
    const before = await state();
    await expect(executeSqlText(`BEGIN TRANSACTION;
CREATE TABLE tsaat.finding (id int);
EXEC(N'CREATE TRIGGER tsaat.retirement_guard_probe ON tsaat.asset AFTER UPDATE AS BEGIN SELECT id FROM tsaat.finding; END');
${acknowledgement}
${migration}`)).rejects.toThrow(/depends on retired storage/i);
    expect(await state()).toEqual(before);
  });
  it('repeats safely without changing retained inventory', async () => {
    const before = await state();
    await executeSqlText(acknowledgement + '\n' + migration);
    expect(await state()).toEqual(before);
  });
});
