import { expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initializeJsonStore } from "../scripts/setup-json-store.mjs";
import { traceTopology, traceTopologySelection, type TopologyExplorerModel } from "@/lib/topology-explorer";
import { topologyImpactReportJob } from "@/lib/topology-impact-report";

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
    let memberTraces = 0;
    for (let i = 0; i < outputs.sql.length; i++) {
      const sql = outputs.sql[i], json = outputs.json[i];
      for (const mode of ["business-impact", "dependencies"] as const) {
        const left = traceTopologySelection(sql, sql.nodes.map(node => node.id), mode), right = traceTopologySelection(json, json.nodes.map(node => node.id), mode);
        expect(left).toEqual(right);
        const capture = (model: TopologyExplorerModel, graph: typeof left) => topologyImpactReportJob(model, graph, "All matching CIs", new URLSearchParams("network=net-1"), [], "hierarchical", new Map(), new Date("2026-11-12T00:00:00Z"));
        expect(capture(sql, left)).toEqual(capture(json, right));
      }
      for (const kind of ["asset", "system", "network", "business", "mission"]) {
        const node = sql.nodes.find(node => node.kind === kind);
        if (node) for (const mode of ["business-impact", "dependencies"] as const) expect(traceTopology(sql, node.id, mode)).toEqual(traceTopology(json, node.id, mode));
      }
      for (const node of sql.nodes.filter(node => node.kind === "system")) {
        const graph = traceTopology(sql, node.id, "dependencies");
        expect(graph).toEqual(traceTopology(json, node.id, "dependencies"));
        expect(graph.edges.every(edge => edge.kind !== "observation")).toBe(true);
        expect(graph.nodes.every(node => sql.nodes.some(scoped => scoped.id === node.id))).toBe(true);
        if (graph.memberCount) memberTraces++;
      }
    }
    expect(outputs.sql.some(model => model.edges.some(edge => edge.environments?.length))).toBe(true);
    expect(memberTraces).toBeGreaterThan(0);
  } finally {
    for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
    vi.resetModules();
    if (path.dirname(target) !== os.tmpdir() || !path.basename(target).startsWith("tsaat-topology-parity-")) throw Error("Unsafe cleanup");
    await fs.rm(target, { recursive: true, force: true });
  }
}, 180000);
