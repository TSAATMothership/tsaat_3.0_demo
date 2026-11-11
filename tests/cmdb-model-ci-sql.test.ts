import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { initializeJsonStore } from "../scripts/setup-json-store.mjs";
import { executeSqlJson } from "@/lib/sql-server";
import { loadDatasetForDate as sqlDataset } from "@/lib/sql-data-loader";
import { loadDatasetForDate as jsonDataset } from "@/lib/json-store/data-loader";
import { loadCmdbAttributeDefinitions as sqlMappings } from "@/lib/sql-cmdb-attribute-loader";
import { loadCmdbAttributeDefinitions as jsonMappings } from "@/lib/json-store/cmdb-attributes";
import { buildCmdbModelCiDetails } from "@/lib/cmdb-model-ci";
import { buildCmdbModelCiView } from "@/lib/cmdb-attributes";
import { MODEL_CI_TYPES } from "@/lib/cmdb-ci-types";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

describe.runIf(process.env.TSAAT_SQL_INTEGRATION === "1")("Model CI disposable SQL/JSON parity", () => {
  let directory: string;
  const previousJson = process.env.TSAAT_JSON_DATA_DIR;
  beforeAll(async () => {
    expect(process.env.TSAAT_APP_DATABASE).toMatch(/^TSAAT_EvidenceParity_ModelCi_[A-Za-z0-9_]+$/);
    directory = await mkdtemp(path.join(os.tmpdir(), "tsaat-model-ci-parity-"));
    const target = path.join(directory, "store"); await initializeJsonStore({ target }); process.env.TSAAT_JSON_DATA_DIR = target;
  });
  afterAll(async () => {
    if (previousJson === undefined) delete process.env.TSAAT_JSON_DATA_DIR; else process.env.TSAAT_JSON_DATA_DIR = previousJson;
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  it("upgrades legacy SQL mappings once, preserving endpoint/custom/disabled/empty mappings and all evidence", async () => {
    const oldMigration = readFileSync("Database Schema/migrations/025_cmdb_asset_type_attributes.sql", "utf8");
    const migration = readFileSync("Database Schema/migrations/032_model_ci_cmdb_attributes.sql", "utf8");
    const result = await executeSqlJson<{ defaults: number; endpointPreserved: boolean; emptyPreserved: boolean; customLabel: string; historyPreserved: boolean }>(`
SET XACT_ABORT ON;
BEGIN TRANSACTION;
SELECT (SELECT COUNT_BIG(*) FROM tsaat.asset) assets, (SELECT COUNT_BIG(*) FROM tsaat.dataset_snapshot) snapshots,
  (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM tsaat.system_business_service) services,
  (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM tsaat.system_mission_capability) missions INTO #before;
DROP TABLE tsaat.cmdb_asset_type_attribute;
DROP TABLE tsaat.cmdb_attribute_definition;
GO
${oldMigration}
UPDATE tsaat.cmdb_asset_type_attribute SET is_enabled=0, display_order=777 WHERE asset_type=N'server' AND attribute_key=N'assetName';
DELETE FROM tsaat.cmdb_asset_type_attribute WHERE asset_type=N'printer-device';
GO
${migration}
SELECT COUNT(*) n INTO #defaults FROM tsaat.cmdb_asset_type_attribute WHERE asset_type IN (N'business-service',N'mission-capability');
DELETE FROM tsaat.cmdb_asset_type_attribute WHERE asset_type=N'business-service';
UPDATE tsaat.cmdb_attribute_definition SET label=N'Custom CI identifier' WHERE attribute_key=N'ciId';
UPDATE tsaat.cmdb_asset_type_attribute SET is_enabled=0, display_order=999 WHERE asset_type=N'mission-capability' AND attribute_key=N'ciName';
GO
${migration}
SELECT (SELECT n FROM #defaults) defaults,
 CAST(CASE WHEN EXISTS(SELECT 1 FROM tsaat.cmdb_asset_type_attribute WHERE asset_type=N'server' AND attribute_key=N'assetName' AND is_enabled=0 AND display_order=777)
 AND NOT EXISTS(SELECT 1 FROM tsaat.cmdb_asset_type_attribute WHERE asset_type=N'printer-device') THEN 1 ELSE 0 END AS bit) endpointPreserved,
 CAST(CASE WHEN NOT EXISTS(SELECT 1 FROM tsaat.cmdb_asset_type_attribute WHERE asset_type=N'business-service')
 AND EXISTS(SELECT 1 FROM tsaat.cmdb_asset_type_attribute WHERE asset_type=N'mission-capability' AND attribute_key=N'ciName' AND is_enabled=0 AND display_order=999) THEN 1 ELSE 0 END AS bit) emptyPreserved,
 (SELECT label FROM tsaat.cmdb_attribute_definition WHERE attribute_key=N'ciId') customLabel,
 CAST(CASE WHEN (SELECT assets FROM #before)=(SELECT COUNT_BIG(*) FROM tsaat.asset)
 AND (SELECT snapshots FROM #before)=(SELECT COUNT_BIG(*) FROM tsaat.dataset_snapshot)
 AND (SELECT services FROM #before)=(SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM tsaat.system_business_service)
 AND (SELECT missions FROM #before)=(SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM tsaat.system_mission_capability) THEN 1 ELSE 0 END AS bit) historyPreserved
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
ROLLBACK TRANSACTION;
`);
    expect(result).toEqual({ defaults: 14, endpointPreserved: true, emptyPreserved: true, customLabel: "Custom CI identifier", historyPreserved: true });
  }, 60000);
  it("returns identical model CI details/mappings across historical dates, scopes and security domains", async () => {
    const scopes: WorkspaceSearchParams[] = [{}, {network: "net-1"}, {system: "sys-1"}, {securityDomain: "SECRET"}, {network: "net-1", securityDomain: "PROTECTED"}, {securityDomain: "NONE"}];
    const mappings = new Map(await Promise.all(MODEL_CI_TYPES.map(async type => {
      const definitions = await sqlMappings(type); expect(definitions).toEqual(await jsonMappings(type)); return [type, definitions] as const;
    })));
    for (const date of ["2026-09-19", "2026-10-17", "2026-11-07"]) {
      const [sql, json] = await Promise.all([sqlDataset(date, { profile: "full" }), jsonDataset(date, { profile: "full" })]);
      for (const type of MODEL_CI_TYPES) {
        const field = type === "business-service" ? "businessServices" : "missionCapabilities";
        const ids = [...new Set(json.ictSystems.flatMap(system => system[field].map(ci => ci.id)))];
        expect(ids.length).toBeGreaterThan(0);
        for (const scope of scopes) for (const id of ids) {
          const sqlCi = buildCmdbModelCiDetails(sql, type, id, scope), jsonCi = buildCmdbModelCiDetails(json, type, id, scope);
          expect(sqlCi, `${date} ${type} ${id} ${JSON.stringify(scope)}`).toEqual(jsonCi);
          if (sqlCi && jsonCi) expect(buildCmdbModelCiView(sqlCi, mappings.get(type)!)).toEqual(buildCmdbModelCiView(jsonCi, mappings.get(type)!));
        }
      }
    }
  }, 240000);
});
