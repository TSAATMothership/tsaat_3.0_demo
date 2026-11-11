import { loadCmdbAttributeDefinitions } from "@/lib/json-store/cmdb-attributes";
import { atomicWriteJson, loadStoreManifest, readJson, withStoreWriteLock } from "@/lib/json-store/files";
import type { Dataset, ServerAsset } from "@/lib/types";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as data from "../lib/json-store/data-loader";
import { evaluateDiscovery } from "../lib/json-store/evaluations";
import { initializeJsonStore } from "../scripts/setup-json-store.mjs";
let sample: Dataset;
let historicalDate: string;
const directory = mkdtempSync(path.join(os.tmpdir(), "tsaat-json-store-"));
const previousDirectory = process.env.TSAAT_JSON_DATA_DIR;
beforeAll(async () => {
    process.env.TSAAT_JSON_DATA_DIR = directory;
    await initializeJsonStore({ target: directory });
    sample = await data.loadCurrentDataset();
    historicalDate = (await loadStoreManifest()).snapshots[0].date;
});
function restoreSettings() {
    for (const name of ["discovery-tools-settings"])
        copyFileSync(path.join(directory, "references", name + ".json"), path.join(directory, "settings", name + ".json"));
    data.clearDataLoaderCaches();
}
beforeEach(restoreSettings);
afterAll(() => {
    if (previousDirectory === undefined)
        delete process.env.TSAAT_JSON_DATA_DIR;
    else
        process.env.TSAAT_JSON_DATA_DIR = previousDirectory;
    if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("tsaat-json-store-"))
        throw new Error("Unsafe test path.");
    rmSync(directory, { recursive: true, force: true });
});
const baseline = (): ServerAsset => ({
    id: "test-server", name: "Test server", hostname: "test.example.invalid", type: "server", networkId: "net-1", securityDomain: "PROTECTED",
    systemContext: { systemId: "sys-1", environmentType: "Production" }, vulnerabilities: [],
    lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
    operatingSystem: { family: "OS", vendor: "Vendor", version: "1", supportStatus: "Supported" },
    installedSoftware: [{ name: "Application", version: "1", supportStatus: "Supported" }]
});
describe("JSON datastore calculation contract", () => {
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
        const settings = await data.loadDiscoveryToolsSettings();
        const tools = settings.tools.map(tool => ({ id: tool.id, assetTypeScope: { ...tool.assetTypeScope, server: "na" } }));
        await data.saveDiscoveryToolsSettings({ tools });
        data.clearDataLoaderCaches();
        expect((await data.loadDiscoveryToolsSettings()).tools.every(tool => tool.assetTypeScope.server === "na")).toBe(true);
        expect((await initializeJsonStore({ target: directory })).created).toBe(false);
        expect((await readJson<typeof settings>("settings/discovery-tools-settings.json")).tools.every(tool => tool.assetTypeScope.server === "na")).toBe(true);
    });
    it("reloads changed per-type CMDB mappings without affecting another asset type", async () => {
        const file = "references/cmdb-attributes.json";
        const mappings = await readJson<Record<string, Array<{
            key: string;
            label: string;
            displayOrder: number;
        }>>>(file);
        const original = structuredClone(mappings);
        const network = await loadCmdbAttributeDefinitions("network-device");
        try {
            mappings.server = [{ key: "assetName", label: "Server name", displayOrder: 1 }];
            await atomicWriteJson(file, mappings);
            expect(await loadCmdbAttributeDefinitions("server")).toEqual(mappings.server);
            expect(await loadCmdbAttributeDefinitions("network-device")).toEqual(network);
        }
        finally {
            await atomicWriteJson(file, original);
        }
    });
    it("rejects future store formats and nonempty uninitialized directories without replacing data", async () => {
        const manifest = await readJson("store.json");
        try {
            await atomicWriteJson("store.json", { format: "tsaat-json-store", schemaVersion: 99, snapshots: [] });
            await expect(initializeJsonStore({ target: directory })).rejects.toThrow("not overwritten");
            await expect(loadStoreManifest()).rejects.toThrow("Unsupported");
            expect((await readJson<{
                schemaVersion: number;
            }>("store.json")).schemaVersion).toBe(99);
        }
        finally {
            await atomicWriteJson("store.json", manifest);
        }
        await atomicWriteJson("occupied/keep.json", { keep: true });
        await expect(initializeJsonStore({ target: path.join(directory, "occupied") })).rejects.toThrow("Nothing was overwritten");
        expect(await readJson("occupied/keep.json")).toEqual({ keep: true });
    });
    it("serializes writers and leaves valid JSON on disk", async () => {
        await atomicWriteJson("settings/counter.json", { value: 0 });
        await Promise.all(Array.from({ length: 5 }, () => withStoreWriteLock(async () => {
            const counter = await readJson<{
                value: number;
            }>("settings/counter.json");
            await atomicWriteJson("settings/counter.json", { value: counter.value + 1 });
        })));
        expect(await readJson("settings/counter.json")).toEqual({ value: 5 });
        await expect(readJson("../outside.json")).rejects.toThrow("inside");
    });
    it("requires an explicit JSON provider review when SQL calculation contracts change", () => {
        const contract = JSON.parse(readFileSync("NoSQL/calculation-contract.json", "utf8").replace(/^\uFEFF/, "")) as {
            files: Record<string, string>;
        };
        for (const [file, expected] of Object.entries(contract.files)) {
            const source = readFileSync(file, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
            expect(createHash("sha256").update(source).digest("hex"), file + ": review JSON evaluators/tests before updating contract").toBe(expected);
        }
    });
});
it("applies the same domain partition to endpoint, software, vulnerability and patch projections", async () => {
    const network = sample.managedNetworks.filter(n => n.id !== "net-unassigned").map(n => n.id), scope = { network, dataDate: sample.snapshotDate };
    for (const loader of [data.loadEndpointExplorerData, data.loadInstalledSoftwareExplorerData, data.loadSecurityVulnerabilityExplorerData]) {
        const all = await loader(scope), partitioned = [];
        for (const securityDomain of ["PROTECTED", "SECRET", "UNKNOWN"]) {
            const result = await loader({ ...scope, securityDomain });
            expect(result.snapshotDate).toBe(all.snapshotDate);
            expect(result.rows.every(row => sample.assets.some(a => a.id === row.assetId && a.securityDomain === securityDomain))).toBe(true);
            partitioned.push(...result.rows);
        }
        expect(partitioned).toHaveLength(all.rows.length);
        expect((await loader({ ...scope, securityDomain: "NONE" })).rows).toEqual([]);
    }
});
