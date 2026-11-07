import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import type { Dataset, Finding, ServerAsset } from "../lib/types";
import { evaluateSpi } from "../lib/json-store/evaluations";
import { enrichDemoDataset } from "../scripts/enrich-demo-dataset.mjs";
import { enrichCoverage, auditCoverage, enrichJsonStore, loadCoverageConfiguration } from "../scripts/nosql-coverage";
import { initializeJsonStore } from "../scripts/setup-json-store.mjs";
import { testSpiDefinitions, testMeasuresSettings } from "./spi-definition-fixtures";

const configuration = { definitions: testSpiDefinitions, settings: testMeasuresSettings };
const original: Dataset = JSON.parse(await fs.readFile("data/current.json", "utf8"));
original.findings = original.findings!.filter(f => !f.id.startsWith('sample-coverage-'));
const temporary: string[] = [];
afterEach(async () => {
  for (const root of temporary.splice(0)) {
    if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("tsaat-coverage-")) throw new Error("Unsafe cleanup path");
    await fs.rm(root, { recursive: true, force: true });
  }
});
function singleServer(): Dataset {
  const asset: ServerAsset = { id: "server-test", type: "server", name: "Source server", hostname: "server.test", networkId: "net-1", securityDomain: "PROTECTED",
    lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" }, vulnerabilities: [],
    operatingSystem: { family: "OS", vendor: "Vendor", version: "1", supportStatus: "Supported", nMinus: 0, majorVersion: 1, currentSupportedMajor: 1 },
    installedSoftware: [{ name: "App", version: "1", supportStatus: "Supported" }] };
  return { snapshotDate: "2026-04-23", generatedAt: "2026-04-23T00:00:00Z", assets: [asset],
    managedNetworks: [{ ...original.managedNetworks[0], id: "net-1", assetIds: [asset.id], ictSystemIds: [] }], ictSystems: [], findings: [], spiEvaluations: [], ciDependencies: [] };
}
const measured = { ...configuration, definitions: testSpiDefinitions.filter(d => [1, 2, 10].includes(d.spiId)) };
function closedFinding(): Finding {
  return { id: "source-history", spiId: 1, priorityRank: 3, severity: "Major", complianceStatus: "Non-compliant", status: "closed",
    timestamp: "2026-03-01T00:00:00Z", closedTimestamp: "2026-04-10T00:00:00Z", title: "Source history", evidence: { source: "SQL" }, recommendedAction: "Upgrade",
    scope: { assetId: "server-test", networkId: "net-1", systemId: null, environmentType: null } };
}
describe("explicit No-SQL finding coverage", () => {
  it("covers every failed/unknown known-endpoint measure without changing history or Shadow IT identity", () => {
    const input = enrichDemoDataset(original), before = structuredClone(input), result = enrichCoverage(input, configuration);
    const audit = auditCoverage(result, configuration);
    expect(audit).toMatchObject({ assets: 1240, knownEndpoints: 1000, shadowNodes: 240, missingMac: 0, missingModel: 0, uncovered: [], noApplicableMeasureAssets: [] });
    expect(audit.fullyCompliantAssets).toBeGreaterThan(0);
    expect(input).toEqual(before);
    expect(result.findings!.slice(0, before.findings!.length)).toEqual(before.findings);
    expect(result.assets).toEqual(before.assets);
    const added = result.findings!.slice(before.findings!.length);
    expect(added.length).toBeGreaterThan(500);
    expect(added.every(f => f.status === "open" && f.complianceStatus !== "Compliant" && f.evidence.dataOrigin === "Sample enrichment")).toBe(true);
    for (const asset of result.assets) {
      const applicable = configuration.definitions.filter(d => d.applicableAssetTypes.includes(asset.type));
      const failures = applicable.map(d => evaluateSpi(asset, d)).filter(e => e.status !== "Compliant");
      for (const failure of failures) expect(result.findings!.some(f => f.scope.assetId === asset.id && f.spiId === failure.spiId && f.complianceStatus === failure.status && f.status === "open")).toBe(true);
      if (asset.type === "ip-node" || (applicable.length > 0 && failures.length === 0)) expect(added.some(f => f.scope.assetId === asset.id)).toBe(false);
    }
    expect(enrichCoverage(result, configuration)).toEqual(result);
  });
  it("creates no finding for 100% compliance, and resolves both unknown evidence and configured rule failures", () => {
    const dataset = singleServer(), asset = dataset.assets[0] as ServerAsset;
    expect(enrichCoverage(dataset, measured).findings).toEqual([]);
    asset.operatingSystem!.supportStatus = "Unknown";
    asset.operatingSystem!.nMinus = null;
    const unknown = enrichCoverage(dataset, measured).findings!;
    expect(unknown.map(f => f.complianceStatus)).toEqual(["Unknown", "Unknown"]);
    expect(unknown.every(f => f.rawSeverity === "Data Gap" && f.priorityRank === 90)).toBe(true);
    asset.operatingSystem!.supportStatus = "Supported"; asset.operatingSystem!.nMinus = 2;
    const custom = structuredClone(measured); custom.definitions.find(d => d.spiId === 2)!.ruleParameters.maxNMinus = 1;
    custom.settings.severityMatrix["2:server"] = "High Risk"; custom.settings.priorityMatrix["2"] = 5;
    const [finding] = enrichCoverage(dataset, custom).findings!;
    expect(finding).toMatchObject({ spiId: 2, complianceStatus: "Non-compliant", severity: "High Risk", priorityRank: 5 });
  });
  it("does not count closed/future history as present coverage and keeps valid open observations without duplicates", () => {
    const dataset = singleServer(); (dataset.assets[0] as ServerAsset).operatingSystem!.supportStatus = "OutOfSupport";
    const history = closedFinding(); dataset.findings = [history];
    let result = enrichCoverage(dataset, measured);
    expect(result.findings).toHaveLength(2); expect(result.findings![0]).toEqual(history);
    expect(result.findings![1].timestamp).toBe("2026-04-23T23:59:59.999Z");
    dataset.findings = [{ ...history, timestamp: "2026-04-24T00:00:00Z", closedTimestamp: null, status: "open" }];
    expect(enrichCoverage(dataset, measured).findings).toHaveLength(2);
    dataset.findings = [{ ...history, closedTimestamp: "2026-04-25T00:00:00Z" }];
    expect(enrichCoverage(dataset, measured).findings).toHaveLength(1);
    dataset.findings = [{ ...history, closedTimestamp: null, status: "open" }];
    result = enrichCoverage(dataset, measured);
    expect(result.findings).toEqual(dataset.findings);
  });
  it("previews all snapshots, publishes with a backup, preserves settings, and makes no changes on repeat", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "tsaat-coverage-")); temporary.push(root);
    const target = path.join(root, "store"); await initializeJsonStore({ target });
    const configuration = await loadCoverageConfiguration(target);
    expect(configuration.definitions).toEqual(testSpiDefinitions);
    const before = await fs.readFile(path.join(target, "store.json"), "utf8");
    for (const entry of JSON.parse(before).snapshots) {
      const file = path.join(target, entry.file), dataset: Dataset = JSON.parse(await fs.readFile(file, 'utf8'));
      dataset.findings = dataset.findings!.filter(f => !f.id.startsWith('sample-coverage-'));
      await fs.writeFile(file, JSON.stringify(dataset));
    }
    const preview = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "scripts/enrich-nosql-coverage.mjs", "--target", target], { encoding: "utf8", windowsHide: true }));
    expect(preview.applied).toBe(false); expect(preview.changedSnapshots).toBe(8);
    expect(await fs.readFile(path.join(target, "store.json"), "utf8")).toBe(before);
    const result = await enrichJsonStore({ target, apply: true, demo: true, backupDirectory: path.join(root, "backup") });
    expect(result.applied).toBe(true); expect(result.changedSnapshots).toBe(8);
    expect(result.coverage.every(a => a.uncovered.length === 0 && a.missingMac === 0 && a.missingModel === 0)).toBe(true);
    expect(await fs.readFile(path.join(result.backupDirectory!, "store.json"), "utf8")).toBe(before);
    for (const file of ["references/spi-definitions.json", "settings/measures-settings.json", "references/cmdb-attributes.json"]) expect(await fs.readFile(path.join(target, file), "utf8")).toBe(await fs.readFile(path.join(result.backupDirectory!, file), "utf8"));
    expect((await enrichJsonStore({ target, apply: true, demo: true })).changedSnapshots).toBe(0);
  }, 30000);
});
