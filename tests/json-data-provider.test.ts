import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync, mkdtempSync, rmSync, copyFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { initializeJsonStore } from "../scripts/setup-json-store.mjs";
import { loadStoreManifest, atomicWriteJson, readJson, withStoreWriteLock } from "@/lib/json-store/files";
import { loadCmdbAttributeDefinitions } from "@/lib/json-store/cmdb-attributes";
import * as data from "../lib/json-store/data-loader";
import { evaluateSpi, evaluateDiscovery } from "../lib/json-store/evaluations";
import { resolveKpiScope } from "@/lib/kpi-scope";
import { severityMatrixKey, priorityMatrixKey } from "@/lib/measures-settings";
import type { Asset, Dataset, NetworkDeviceAsset, ServerAsset, Vulnerability } from "@/lib/types";
import type { SpiDefinition } from "@/lib/spi-definitions";

let definitions: SpiDefinition[];
let sample: Dataset;
let historicalDate: string;
const directory = mkdtempSync(path.join(os.tmpdir(), "tsaat-json-store-"));
const previousDirectory = process.env.TSAAT_JSON_DATA_DIR;
beforeAll(async () => {
  process.env.TSAAT_JSON_DATA_DIR = directory;
  await initializeJsonStore({ target: directory });
  definitions = await data.loadSpiDefinitions();
  sample = await data.loadCurrentDataset();
  historicalDate = (await loadStoreManifest()).snapshots[0].date;
});
function restoreSettings() {
  for (const name of ["measures-settings", "discovery-tools-settings"]) copyFileSync(path.join(directory, "references", name + ".json"), path.join(directory, "settings", name + ".json"));
  data.clearDataLoaderCaches();
}
beforeEach(restoreSettings);
afterAll(() => {
  if (previousDirectory === undefined) delete process.env.TSAAT_JSON_DATA_DIR; else process.env.TSAAT_JSON_DATA_DIR = previousDirectory;
  if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("tsaat-json-store-")) throw new Error("Unsafe test path.");
  rmSync(directory, { recursive: true, force: true });
});
const baseline = (): ServerAsset => ({
  id: "test-server", name: "Test server", hostname: "test.example.invalid", type: "server", networkId: "net-1", securityDomain: "PROTECTED",
  systemContext: { systemId: "sys-1", environmentType: "Production" }, vulnerabilities: [],
  lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
  operatingSystem: { family: "OS", vendor: "Vendor", version: "1", majorVersion: 1, currentSupportedMajor: 3, nMinus: 2, supportStatus: "Supported" },
  installedSoftware: [{ name: "Application", version: "1", supportStatus: "Supported" }]
});
const vulnerability = { id: "v1", assetId: "test-server", cve: "CVE-2025-0001", severity: "Critical", criticality: "Critical", source: "Nessus",
  description: "Sample", remediationGuidance: "Patch", exploitability: "No Known Exploit", detectedDate: "2026-01-01", capturedAt: "2026-01-01" } satisfies Vulnerability;
function evaluate(id: number, asset: Asset) { return evaluateSpi(asset, definitions.find(d => d.spiId === id)!); }

describe("JSON datastore calculation contract", () => {
  it("projects sample server patch records through network, system and historical scopes", async () => {
    const result = await data.loadPatchManagementExplorerData({ network: "net-1", dataDate: sample.snapshotDate });
    const expected = sample.assets.filter(asset => asset.type === "server" && asset.networkId === "net-1");
    expect(result.rows).toHaveLength(expected.length);
    expect(result.rows.every(row => expected.some(asset => asset.id === row.assetId) && row.source?.startsWith("Sample"))).toBe(true);
    expect((await data.loadPatchManagementExplorerData({})).rows).toEqual([]);
    expect((await data.loadPatchManagementExplorerData({ network: "missing" })).rows).toEqual([]);
    const system = expected.find(asset => asset.systemContext)?.systemContext?.systemId;
    const selected = await data.loadPatchManagementExplorerData({ system, dataDate: historicalDate });
    expect(selected.snapshotDate).toBe(historicalDate);
    expect(selected.rows.length).toBeGreaterThan(0);
    expect(selected.rows.every(row => sample.assets.some(asset => asset.id === row.assetId && asset.systemContext?.systemId === system))).toBe(true);
  });
  it("scopes vulnerability observations to their endpoint and snapshot, with sourced software mappings", async () => {
    const scope = { network: "net-1", dataDate: sample.snapshotDate };
    const result = await data.loadSecurityVulnerabilityExplorerData(scope);
    const ids = new Set(sample.assets.filter(asset => asset.networkId === "net-1").map(asset => asset.id));
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every(row => ids.has(row.assetId) && row.detectedDate <= result.snapshotDate)).toBe(true);
    const mapped = result.rows.filter(row => row.source.startsWith("Sample inventory match"));
    expect(mapped.length).toBeGreaterThan(0);
    expect(mapped.every(row => row.softwareName && row.softwareVersion && row.cveCreatedDate && row.referenceUrl)).toBe(true);
    expect((await data.loadSecurityVulnerabilityExplorerData({})).rows).toEqual([]);
    expect((await data.loadSecurityVulnerabilityExplorerData({ network: "net-unassigned", dataDate: sample.snapshotDate })).rows).toEqual([]);
    const system = sample.assets.find(asset => asset.networkId === "net-1" && asset.systemContext)?.systemContext?.systemId;
    expect(system).toBeDefined();
    const selected = await data.loadSecurityVulnerabilityExplorerData({ system, dataDate: sample.snapshotDate });
    const systemIds = new Set(sample.assets.filter(asset => asset.systemContext?.systemId === system).map(asset => asset.id));
    expect(selected.rows.every(row => systemIds.has(row.assetId))).toBe(true);
    const older = await data.loadSecurityVulnerabilityExplorerData({ network: "net-1", dataDate: historicalDate });
    expect(older.snapshotDate).toBe(historicalDate);
    expect(older.rows.every(row => row.detectedDate <= older.snapshotDate)).toBe(true);
  });
  it("exposes MAC and model data for every scoped known endpoint while retaining unidentified nodes", async () => {
    const result = await data.loadEndpointExplorerData({ network: sample.managedNetworks.map(n => n.id), dataDate: sample.snapshotDate });
    const known = new Set(sample.assets.filter(a => a.type !== "ip-node").map(a => a.id));
    const endpoints = result.rows.filter(row => known.has(row.assetId));
    expect(endpoints).toHaveLength(1000);
    expect(endpoints.every(row => row.macAddress?.trim() && row.deviceModel?.trim())).toBe(true);
    const nodes = result.rows.filter(row => !known.has(row.assetId));
    expect(nodes).toHaveLength(240);
    expect(nodes.every(row => !row.macAddress && !row.deviceModel)).toBe(true);
  });
  it("loads all configured indicators, snapshots, metadata and real reference relationships", async () => {
    expect(definitions).toHaveLength(10);
    expect((await data.loadKpiDefinitions()).map(k => k.id)).toEqual(["KPI-1", "KPI-2"]);
    expect((await loadStoreManifest()).snapshots).toHaveLength(8);
    expect(sample.spiEvaluations.length).toBeGreaterThan(4000);
    const ids = new Set(sample.assets.map(a => a.id));
    expect(sample.ciDependencies?.every(d => ids.has(d.sourceAssetId) && ids.has(d.targetAssetId))).toBe(true);
  });
  it("preserves the configured SQL evidence keys for every SPI", () => {
    for (const definition of definitions) {
      const asset = sample.assets.find(a => definition.applicableAssetTypes.includes(a.type))!;
      expect(Object.keys(evaluateSpi(asset, definition).evidence).sort()).toEqual(definition.calculationDefinition.evidenceExpressions.map(e => e.evidenceKey).sort());
    }
  });
  it("applies OS support and N-minus boundaries with missing evidence", () => {
    const a = baseline();
    expect(evaluate(1, a).status).toBe("Compliant");
    a.operatingSystem!.supportStatus = "OutOfSupport";
    expect(evaluate(1, a).status).toBe("Non-compliant");
    a.operatingSystem!.supportStatus = "Unknown";
    expect(evaluate(1, a).status).toBe("Unknown");
    expect(evaluate(2, a).status).toBe("Compliant");
    a.operatingSystem!.nMinus = 3;
    expect(evaluate(2, a).status).toBe("Non-compliant");
    a.operatingSystem = null;
    expect(evaluate(1, a).status).toBe("Unknown");
    expect(evaluate(2, a).status).toBe("Unknown");
  });
  it("checks critical vulnerabilities, production context and unsupported OS/software independently", () => {
    const a = baseline();
    expect(evaluate(3, a).status).toBe("Compliant");
    a.vulnerabilities = [vulnerability];
    expect(evaluate(3, a).status).toBe("Non-compliant");
    expect(evaluate(4, a).status).toBe("Compliant");
    a.operatingSystem!.supportStatus = "OutOfSupport";
    expect(evaluate(4, a).status).toBe("Non-compliant");
    a.installedSoftware[0].supportStatus = "OutOfSupport";
    expect(evaluate(5, a).status).toBe("Non-compliant");
    expect(evaluate(6, { ...a, type: "workstation" }).status).toBe("Non-compliant");
    a.installedSoftware = [];
    expect(evaluate(5, a).status).toBe("Unknown");
    a.operatingSystem = null;
    expect(evaluate(4, a).status).toBe("Unknown");
    a.systemContext!.environmentType = "Test";
    expect(evaluate(4, a).status).toBe("Compliant");
    expect(evaluate(5, a).status).toBe("Compliant");
    expect(evaluate(6, { ...a, type: "workstation" }).status).toBe("Compliant");
  });
  it("checks network support, patch currency and lifecycle unknowns", () => {
    const a: NetworkDeviceAsset = { ...baseline(), type: "network-device", networkOs: baseline().operatingSystem, patchState: { isLatest: true, lastPatchedDate: null } };
    expect([7,8,9,10].map(id => evaluate(id,a).status)).toEqual(["Compliant","Compliant","Compliant","Compliant"]);
    a.vulnerabilities = [vulnerability]; a.networkOs!.supportStatus = "OutOfSupport"; a.patchState!.isLatest = false; a.lifecycle.eolStatus = "EOL";
    expect([7,8,9,10].map(id => evaluate(id,a).status)).toEqual(["Non-compliant","Non-compliant","Non-compliant","Non-compliant"]);
    a.networkOs = null; a.patchState = null; a.lifecycle.warrantyStatus = "Unknown";
    expect([8,9,10].map(id => evaluate(id,a).status)).toEqual(["Unknown","Unknown","Unknown"]);
  });
  it("uses configured SPI parameters and refuses unimplemented rules", () => {
    const definition = structuredClone(definitions.find(d => d.spiId === 2)!);
    definition.ruleParameters.maxNMinus = 1;
    expect(evaluateSpi(baseline(), definition).status).toBe("Non-compliant");
    expect(() => evaluateSpi(baseline(), { ...definition, ruleKey: "future-rule" })).toThrow("Unsupported");
  });
  it("counts distinct ICT systems from selected infrastructure and treats ATO presence as yes/no", async () => {
    const dataset = await data.loadCurrentDataset();
    const scope = resolveKpiScope(dataset, { managedNetwork: "net-1,net-2" });
    expect(new Set(scope.systems.map(s => s.id)).size).toBe(scope.systems.length);
    const input = { snapshotId: dataset.snapshotId!, systemIds: scope.systems.map(s => s.id), networkIds: ["net-1", "net-2"], assetIds: dataset.assets.map(a => a.id), findings: [] };
    const result = await data.loadSnapshotKpiEvaluationsForScope(input);
    expect(result[0].applicableCount).toBe(scope.systems.length);
    expect(result[0].compliantCount).toBe(scope.systems.filter(s => s.atoNumber?.trim()).length);
    expect(result[1].compliantCount).toBe(scope.systems.filter(s => s.diisDefined).length);
    expect(result.every(k => k.unknownCount === 0)).toBe(true);
    const system = scope.systems[0]; const previous = system.atoNumber;
    system.atoNumber = "   ";
    expect((await data.loadSnapshotKpiEvaluationsForScope({ ...input, systemIds: [system.id] }))[0].compliantCount).toBe(0);
    system.atoNumber = "ATO-test";
    expect((await data.loadSnapshotKpiEvaluationsForScope({ ...input, systemIds: [system.id] }))[0].scorePercent).toBe(100);
    system.atoNumber = previous;
    expect((await data.loadSnapshotKpiEvaluationsForScope({ ...input, systemIds: [] }))[0].score).toBe("0.0% (0/0)");
  });
  it("recalculates effective findings when risk and priority settings are saved", async () => {
    const before = await data.loadCurrentDataset();
    const finding = before.findings!.find(f => f.complianceStatus === "Non-compliant")!;
    const asset = before.assets.find(a => a.id === finding.scope.assetId)!;
    const settings = await data.loadMeasuresSettings();
    settings.severityMatrix[severityMatrixKey(finding.spiId, asset.type)] = "Critical Exposure";
    settings.priorityMatrix[priorityMatrixKey(finding.spiId)] = 7;
    await data.saveMeasuresSettings(settings);
    const after = await data.loadCurrentDataset();
    const changed = after.findings!.find(f => f.id === finding.id)!;
    expect(changed.severity).toBe("Critical Exposure");
    expect(changed.priorityRank).toBe(7);
    expect(after).not.toBe(before);
    restoreSettings();
    expect((await data.loadCurrentDataset()).findings!.find(f => f.id === finding.id)?.priorityRank).toBe(finding.priorityRank);
  });
  it("recalculates discovery coverage using saved applicability", async () => {
    const settings = await data.loadDiscoveryToolsSettings();
    settings.tools.forEach(tool => { tool.assetTypeScope.server = "na"; });
    await data.saveDiscoveryToolsSettings(settings);
    const dataset = await data.loadCurrentDataset();
    const server = dataset.assets.find(a => a.type === "server")!;
    const result = dataset.discoveryCoverageEvaluations!.find(e => e.assetId === server.id)!;
    expect(result.coverageCompliance).toBe(true);
    expect(Object.values(result.toolValues).every(v => v === null)).toBe(true);
    expect(() => evaluateDiscovery(baseline(), settings, [{ toolId: "ucmdb", enabled: true, conditionKey: "future" }])).not.toThrow();
  });
  it("respects snapshot selection, historical status and scope isolation", async () => {
    const early = (await loadStoreManifest()).snapshots[0].date;
    expect((await data.loadDatasetForDate(early)).snapshotDate).toBe(early);
    expect(await data.loadLatestSnapshotsForDate(early)).toHaveLength(1);
    const asOf = "2026-04-01";
    const findings = await data.loadSnapshotEffectiveFindings(sample.snapshotId!, asOf);
    expect(findings.every(f => f.timestamp.slice(0,10) <= asOf)).toBe(true);
    expect(findings.filter(f => f.status === "closed").every(f => f.closedTimestamp!.slice(0,10) <= asOf)).toBe(true);
    expect((await data.loadEndpointExplorerData({})).rows).toEqual([]);
    const systems = await data.loadEndpointExplorerData({ system: "sys-1", dataDate: early });
    const source = await data.loadDatasetForDate(early);
    expect(systems.rows.every(row => source.assets.find(a => a.id === row.assetId)?.systemContext?.systemId === "sys-1")).toBe(true);
  });
  it("includes ARP observations in their owner's system scope and keeps unowned scans out", async () => {
    const systemId = "sys-1", dataset = await data.loadCurrentDataset();
    const rows = (await data.loadShadowItExplorerData({ system: systemId, dataDate: dataset.snapshotDate })).rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(row => row.discoveryApproach === "ARP Table" && dataset.assets.find(a => a.id === row.ownerAssetId)?.systemContext?.systemId === systemId)).toBe(true);
    const owner = dataset.assets.find(a => a.id === rows[0].ownerAssetId)!;
    const networks = await data.loadShadowItExplorerData({ network: owner.networkId, dataDate: dataset.snapshotDate });
    expect(networks.rows.some(row => row.discoveryApproach === "IP Scan")).toBe(true);
    expect(networks.rows.find(row => row.assetId === rows[0].assetId)).toEqual(rows[0]);
    expect((await data.loadShadowItExplorerData({})).rows).toEqual([]);
    expect((await data.loadShadowItExplorerData({ system: systemId, network: "missing-network" })).rows).toEqual([]);
  });
  it("persists settings to disk, preserves history and does not overwrite an existing store during setup", async () => {
    const settings = await data.loadMeasuresSettings();
    settings.priorityMatrix["1"] = 7;
    await data.saveMeasuresSettings(settings);
    data.clearDataLoaderCaches();
    expect((await data.loadMeasuresSettings()).priorityMatrix["1"]).toBe(7);
    expect((await initializeJsonStore({ target: directory })).created).toBe(false);
    expect((await readJson<typeof settings>("settings/measures-settings.json")).priorityMatrix["1"]).toBe(7);
  });
  it("reloads changed per-type CMDB mappings without affecting another asset type", async () => {
    const file = "references/cmdb-attributes.json";
    const mappings = await readJson<Record<string, Array<{ key: string; label: string; displayOrder: number }>>>(file);
    const original = structuredClone(mappings);
    const network = await loadCmdbAttributeDefinitions("network-device");
    try {
      mappings.server = [{ key: "assetName", label: "Server name", displayOrder: 1 }];
      await atomicWriteJson(file, mappings);
      expect(await loadCmdbAttributeDefinitions("server")).toEqual(mappings.server);
      expect(await loadCmdbAttributeDefinitions("network-device")).toEqual(network);
    } finally { await atomicWriteJson(file, original); }
  });
  it("rejects future store formats and nonempty uninitialized directories without replacing data", async () => {
    const manifest = await readJson("store.json");
    try {
      await atomicWriteJson("store.json", { format: "tsaat-json-store", schemaVersion: 99, snapshots: [] });
      await expect(initializeJsonStore({ target: directory })).rejects.toThrow("not overwritten");
      await expect(loadStoreManifest()).rejects.toThrow("Unsupported");
      expect((await readJson<{ schemaVersion: number }>("store.json")).schemaVersion).toBe(99);
    } finally { await atomicWriteJson("store.json", manifest); }
    await atomicWriteJson("occupied/keep.json", { keep: true });
    await expect(initializeJsonStore({ target: path.join(directory, "occupied") })).rejects.toThrow("Nothing was overwritten");
    expect(await readJson("occupied/keep.json")).toEqual({ keep: true });
  });
  it("serializes writers and leaves valid JSON on disk", async () => {
    await atomicWriteJson("settings/counter.json", { value: 0 });
    await Promise.all(Array.from({ length: 5 }, () => withStoreWriteLock(async () => {
      const counter = await readJson<{ value: number }>("settings/counter.json");
      await atomicWriteJson("settings/counter.json", { value: counter.value + 1 });
    })));
    expect(await readJson("settings/counter.json")).toEqual({ value: 5 });
    await expect(readJson("../outside.json")).rejects.toThrow("inside");
  });
  it("requires an explicit JSON provider review when SQL calculation contracts change", () => {
    const contract = JSON.parse(readFileSync("NoSQL/calculation-contract.json", "utf8").replace(/^\uFEFF/, "")) as { files: Record<string,string> };
    for (const [file, expected] of Object.entries(contract.files)) {
      const source = readFileSync(file,"utf8").replace(/^\uFEFF/,"").replace(/\r\n/g,"\n");
      expect(createHash("sha256").update(source).digest("hex"), file + ": review JSON evaluators/tests before updating contract").toBe(expected);
    }
  });
});

it("applies the same domain partition to endpoint, software, vulnerability and patch projections",async()=>{
 const network=sample.managedNetworks.filter(n=>n.id!=="net-unassigned").map(n=>n.id),scope={network,dataDate:sample.snapshotDate};
 for(const loader of [data.loadEndpointExplorerData,data.loadInstalledSoftwareExplorerData,data.loadSecurityVulnerabilityExplorerData,data.loadPatchManagementExplorerData]){
   const all=await loader(scope),partitioned=[];
   for(const securityDomain of ["PROTECTED","SECRET","UNKNOWN"]){
     const result=await loader({...scope,securityDomain});
     expect(result.snapshotDate).toBe(all.snapshotDate);
     expect(result.rows.every(row=>sample.assets.some(a=>a.id===row.assetId&&a.securityDomain===securityDomain))).toBe(true);
     partitioned.push(...result.rows);
   }
   expect(partitioned).toHaveLength(all.rows.length);
   expect((await loader({...scope,securityDomain:"NONE"})).rows).toEqual([]);
 }
});
