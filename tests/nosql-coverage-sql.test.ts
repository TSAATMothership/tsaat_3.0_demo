import { describe, expect, it } from "vitest";
import { evaluateSpi } from "../lib/spi-evaluation";
import { auditCoverage, enrichCoverage } from "../scripts/nosql-coverage";
import { resolveAppDatabaseName } from "../lib/sql-server";
import * as sql from "../lib/sql-data-loader";

// Read-only parity against an explicitly named, separately provisioned disposable database.
// This never installs a schema, runs a seed loader or weakens certificate validation.
const database = process.env.TSAAT_COVERAGE_PARITY_DATABASE?.trim();
describe.runIf(Boolean(database))("known-endpoint SQL/JSON coverage parity", () => {
  it("matches configured SQL evaluations and covers every failed/unknown result without rewriting source history", async () => {
    if (!database?.startsWith("TSAAT_CoverageParity_")) throw new Error("Select a disposable TSAAT_CoverageParity_* database explicitly.");
    const previous = process.env.TSAAT_APP_DATABASE;
    process.env.TSAAT_APP_DATABASE = database;
    sql.clearDataLoaderCaches();
    try {
      expect(await resolveAppDatabaseName()).toBe(database);
      const [dataset, definitions, settings] = await Promise.all([sql.loadCurrentDataset({ profile: "full" }), sql.loadSpiDefinitions(), sql.loadMeasuresSettings()]);
      const known = dataset.assets.filter(asset => asset.type !== "ip-node");
      expect(known.length).toBeGreaterThan(0);
      const evaluations = new Map(dataset.spiEvaluations.map(e => [JSON.stringify([e.assetId, e.spiId]), e]));
      for (const asset of known) {
        for (const definition of definitions.filter(d => d.applicableAssetTypes.includes(asset.type))) {
          const actual = evaluateSpi(asset, definition), expected = evaluations.get(JSON.stringify([asset.id, definition.spiId]));
          expect(expected).toBeDefined();
          expect(actual).toMatchObject({ status: expected!.status, outcomeKey: expected!.outcomeKey, evidence: expected!.evidence });
        }
      }
      const result = enrichCoverage(dataset, { definitions, settings });
      expect(auditCoverage(result, { definitions, settings }).uncovered).toEqual([]);
      expect(result.findings!.slice(0, dataset.findings!.length)).toEqual(dataset.findings);
    } finally {
      if (previous === undefined) delete process.env.TSAAT_APP_DATABASE; else process.env.TSAAT_APP_DATABASE = previous;
      sql.clearDataLoaderCaches();
    }
  }, 120000);
});
