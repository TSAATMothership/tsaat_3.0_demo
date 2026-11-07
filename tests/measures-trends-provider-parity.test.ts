import { expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initializeJsonStore } from "../scripts/setup-json-store.mjs";
import { MEASURE_HISTORY_OPTIONS, type MeasuresTrendsModel } from "@/lib/measures-trends";

const database = process.env.TSAAT_MEASURES_PARITY_DATABASE;
it.runIf(Boolean(database))("matches every KPI/SPI history model across SQL and JSON ranges/scopes", async () => {
  if (!/^TSAAT_EvidenceParity_[A-Za-z0-9_]+$/.test(database ?? "")) throw Error("Select a disposable TSAAT_EvidenceParity_* database explicitly.");
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "tsaat-measure-parity-"));
  const keys = ["TSAAT_APP_DATABASE", "TSAAT_JSON_DATA_DIR", "NEXT_PUBLIC_TSAAT_DATA_PROVIDER"] as const;
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    await initializeJsonStore({ target });
    const manifest = JSON.parse(await fs.readFile(path.join(target, "store.json"), "utf8"));
    const cutoff = manifest.snapshots.at(-1).date;
    process.env.TSAAT_APP_DATABASE = database; process.env.TSAAT_JSON_DATA_DIR = target;
    const outputs: Record<string, MeasuresTrendsModel[]> = {};
    for (const provider of ["sql", "json"]) {
      process.env.NEXT_PUBLIC_TSAAT_DATA_PROVIDER = provider; vi.resetModules();
      const { loadMeasuresTrends } = await import("@/lib/measures-trends-data");
      const { resolveAppDatabaseName } = await import("@/lib/sql-server");
      expect(await resolveAppDatabaseName()).toBe(database);
      outputs[provider] = [];
      for (const range of MEASURE_HISTORY_OPTIONS) for (const scope of [{ network: "net-1" }, { system: "sys-1" }, { network: "net-1", securityDomain: "SECRET" }, { network: "net-1", securityDomain: "NONE" }]) {
        outputs[provider].push(await loadMeasuresTrends({ ...scope, dataDate: cutoff, measureHistory: range.value }));
      }
      outputs[provider].push(await loadMeasuresTrends({ system: "sys-1", dataDate: manifest.snapshots[0].date, measureHistory: "week" }));
    }
    expect(outputs.sql).toEqual(outputs.json);
  } finally {
    for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
    vi.resetModules();
    if (path.dirname(target) !== os.tmpdir() || !path.basename(target).startsWith("tsaat-measure-parity-")) throw Error("Unsafe cleanup");
    await fs.rm(target, { recursive: true, force: true });
  }
}, 180000);
