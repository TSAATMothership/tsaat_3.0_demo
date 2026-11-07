import { expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initializeJsonStore } from "../scripts/setup-json-store.mjs";
import { traceTopology, type TopologyExplorerModel } from "@/lib/topology-explorer";

const database = process.env.TSAAT_TOPOLOGY_PARITY_DATABASE;
it.runIf(Boolean(database))("matches lookup evidence, Business Impact and Dependencies across SQL and JSON", async () => {
  if (!/^TSAAT_EvidenceParity_[A-Za-z0-9_]+$/.test(database ?? "")) throw Error("Select a disposable TSAAT_EvidenceParity_* database explicitly.");
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "tsaat-topology-parity-"));
  const keys = ["TSAAT_APP_DATABASE", "TSAAT_JSON_DATA_DIR", "NEXT_PUBLIC_TSAAT_DATA_PROVIDER"] as const;
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    await initializeJsonStore({ target });
    const manifest = JSON.parse(await fs.readFile(path.join(target, "store.json"), "utf8"));
    process.env.TSAAT_APP_DATABASE = database; process.env.TSAAT_JSON_DATA_DIR = target;
    const outputs: Record<string, TopologyExplorerModel[]> = {};
    for (const provider of ["sql", "json"]) {
      process.env.NEXT_PUBLIC_TSAAT_DATA_PROVIDER = provider; vi.resetModules();
      const { loadTopologyExplorer } = await import("@/lib/topology-explorer-data");
      const { resolveAppDatabaseName } = await import("@/lib/sql-server");
      expect(await resolveAppDatabaseName()).toBe(database);
      outputs[provider] = [];
      for (const date of [manifest.snapshots[0].date, manifest.snapshots[3].date, manifest.snapshots.at(-1).date]) {
        for (const scope of [{ network: "net-1" }, { system: "sys-1" }, { network: "net-1,net-2" }, { network: "net-new-2" }, { system: "sys-6", securityDomain: "PROTECTED" }, { network: "net-1", securityDomain: "PROTECTED" }, { network: "net-1", securityDomain: "SECRET" }, { network: "net-1", securityDomain: "NONE" }]) {
          outputs[provider].push(await loadTopologyExplorer({ ...scope, dataDate: date }));
        }
      }
    }
    expect(outputs.sql).toEqual(outputs.json);
    let externalTraces = 0;
    for (let i = 0; i < outputs.sql.length; i++) {
      const sql = outputs.sql[i], json = outputs.json[i];
      for (const kind of ["asset", "system", "network", "business", "mission"]) {
        const node = sql.nodes.find(node => node.kind === kind);
        if (node) for (const mode of ["business-impact", "dependencies"] as const) expect(traceTopology(sql, node.id, mode)).toEqual(traceTopology(json, node.id, mode));
      }
      const communicating = sql.edges.find(edge => edge.kind === "communication");
      if (communicating) {
        expect(traceTopology(sql, communicating.source, "dependencies")).toEqual(traceTopology(json, communicating.source, "dependencies"));
        expect(traceTopology(sql, communicating.target, "dependencies")).toEqual(traceTopology(json, communicating.target, "dependencies"));
      }
      const lookupIds = new Set(sql.nodes.map(node => node.id));
      const external = sql.dependencyContext?.edges.find(edge => edge.kind === "communication" && lookupIds.has(edge.source) !== lookupIds.has(edge.target));
      if (external) {
        const root = lookupIds.has(external.source) ? external.source : external.target;
        const graph = traceTopology(sql, root, "dependencies");
        expect(graph).toEqual(traceTopology(json, root, "dependencies"));
        expect(graph.nodes.some(node => !lookupIds.has(node.id))).toBe(true);
        externalTraces++;
      }
    }
    expect(outputs.sql.some(model => model.edges.some(edge => edge.kind === "communication"))).toBe(true);
    expect(externalTraces).toBeGreaterThan(0);
  } finally {
    for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
    vi.resetModules();
    if (path.dirname(target) !== os.tmpdir() || !path.basename(target).startsWith("tsaat-topology-parity-")) throw Error("Unsafe cleanup");
    await fs.rm(target, { recursive: true, force: true });
  }
}, 180000);
