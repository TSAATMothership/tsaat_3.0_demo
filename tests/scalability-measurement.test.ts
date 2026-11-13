import { expect, it } from "vitest";
import fs from "node:fs/promises";
import * as sql from "@/lib/sql-data-loader";
import * as json from "@/lib/json-store/data-loader";
import { buildTopologyExplorer } from "@/lib/topology-explorer";
import { buildCmdbAssetDetails } from "@/lib/cmdb-drill-through";
import { executeSqlJson, resolveAppDatabaseName } from "@/lib/sql-server";

it.runIf(Boolean(process.env.TSAAT_EVIDENCE_PARITY_DATABASE))("records repeatable local read costs and schema candidates without changing data", async () => {
  const database = process.env.TSAAT_EVIDENCE_PARITY_DATABASE!;
  expect(database).toMatch(/^TSAAT_EvidenceParity_[A-Za-z0-9_]+$/);
  process.env.TSAAT_APP_DATABASE = database;
  expect(await resolveAppDatabaseName()).toBe(database);
  expect(process.env.TSAAT_JSON_DATA_DIR).toBeTruthy();
  const date = "2026-11-07", scope = { network: "net-1", dataDate: date };
  const measurements: Array<{ provider: string; operation: string; medianMs: number; bytes: number }> = [];
  for (const [name, provider] of [["sql", sql], ["json", json]] as const) {
    const baseline = await provider.loadDatasetForDate(date, { profile: "full" });
    const assetId = baseline.assets.find(asset => asset.type === "server")!.id;
    for (const [operation, read] of [
      ["full snapshot", () => provider.loadDatasetForDate(date, { profile: "full" })],
      ["summary for metadata (before)", () => provider.loadDatasetForDate(date, { profile: "summary" })],
      ["metadata", () => provider.loadSnapshotMetadataForDate(date)],
      ["one CMDB endpoint", () => provider.loadCmdbDatasetForDate(date, assetId)],
      ["scoped Topology", () => provider.loadTopologyDatasetForDate(date, scope)]
    ] as const) {
      const durations: number[] = []; let bytes = 0;
      for (let run = 0; run < 3; run++) {
        provider.clearDataLoaderCaches();
        const start = performance.now(), value = await read();
        durations.push(performance.now() - start); bytes = Buffer.byteLength(JSON.stringify(value));
        if (operation === "one CMDB endpoint" && "assets" in value) expect(buildCmdbAssetDetails(value, assetId)).toEqual(buildCmdbAssetDetails(baseline, assetId));
        if (operation === "scoped Topology" && "assets" in value) expect(buildTopologyExplorer(value, scope)).toEqual(buildTopologyExplorer(baseline, scope));
      }
      measurements.push({ provider: name, operation, medianMs: Math.round(durations.sort((a,b) => a-b)[1]), bytes });
    }
  }
  const schema = await executeSqlJson(`SELECT
    (SELECT COUNT(*) FROM tsaat.asset_vulnerability) AS observations,
    (SELECT COUNT(*) FROM (SELECT DISTINCT cve FROM tsaat.asset_vulnerability) c) AS distinctCves,
    (SELECT COUNT(*) FROM (SELECT snapshot_id, business_service_id FROM tsaat.system_business_service GROUP BY snapshot_id,business_service_id HAVING COUNT(DISTINCT name) > 1) s) AS conflictingBusinessNames,
    (SELECT COUNT(*) FROM (SELECT snapshot_id, mission_capability_id FROM tsaat.system_mission_capability GROUP BY snapshot_id,mission_capability_id HAVING COUNT(DISTINCT name) > 1) s) AS conflictingMissionNames,
    (SELECT COUNT(*) FROM (SELECT snapshot_id, asset_id FROM tsaat.system_environment_asset GROUP BY snapshot_id,asset_id HAVING COUNT(DISTINCT system_id) > 1) s) AS multiSystemMemberships
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;`);
  await fs.mkdir(".local", { recursive: true });
  await fs.writeFile(".local/scalability-measurements.json", JSON.stringify({ database, date, scope, method: "3 cold application-cache runs; warm OS/SQL caches; serialized provider payload bytes, not network or heap usage", measurements, schema }, null, 2));
  console.table(measurements);
}, 180_000);
