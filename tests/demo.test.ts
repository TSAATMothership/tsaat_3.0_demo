import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createDemoPackage } from "../scripts/build-demo.mjs";
import { configureDemoPackage, demoPackage } from "../Demo/src/package";
import * as data from "../Demo/src/data-loader";
import { evaluateSpi, evaluateDiscovery } from "../Demo/src/evaluations";
import { resolveKpiScope } from "@/lib/kpi-scope";
import { severityMatrixKey, priorityMatrixKey } from "@/lib/measures-settings";
import type { Asset, Dataset, NetworkDeviceAsset, ServerAsset, Vulnerability } from "@/lib/types";
import type { SpiDefinition } from "@/lib/spi-definitions";

let definitions: SpiDefinition[];
let sample: Dataset;
beforeAll(async () => {
  configureDemoPackage(createDemoPackage());
  definitions = await data.loadSpiDefinitions();
  sample = await data.loadCurrentDataset();
});
beforeEach(() => data.resetDemoSettings());
const baseline = (): ServerAsset => ({
  id: "test-server", name: "Test server", hostname: "test.example.invalid", type: "server", networkId: "net-1", securityDomain: "Protected",
  systemContext: { systemId: "sys-1", environmentType: "Production" }, vulnerabilities: [],
  lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
  operatingSystem: { family: "OS", vendor: "Vendor", version: "1", majorVersion: 1, currentSupportedMajor: 3, nMinus: 2, supportStatus: "Supported" },
  installedSoftware: [{ name: "Application", version: "1", supportStatus: "Supported" }]
});
const vulnerability = { id: "v1", assetId: "test-server", cve: "CVE-2025-0001", severity: "Critical", criticality: "Critical", source: "Nessus",
  description: "Sample", remediationGuidance: "Patch", exploitability: "No Known Exploit", detectedDate: "2026-01-01", capturedAt: "2026-01-01" } satisfies Vulnerability;
function evaluate(id: number, asset: Asset) { return evaluateSpi(asset, definitions.find(d => d.spiId === id)!); }

describe("offline JSON calculation contract", () => {
  it("loads all configured indicators, snapshots, metadata and real reference relationships", async () => {
    expect(definitions).toHaveLength(10);
    expect((await data.loadKpiDefinitions()).map(k => k.id)).toEqual(["KPI-1", "KPI-2"]);
    expect(demoPackage().snapshots).toHaveLength(8);
    expect(sample.spiEvaluations.length).toBeGreaterThan(4000);
    expect(sample.managedNetworks.every(n => n.description && n.owner && n.supportEmail)).toBe(true);
    expect(sample.ictSystems.every(s => s.description && s.owner && s.supportEmail && s.apmNumber)).toBe(true);
    expect(sample.assets.every(a => a.ipAddress && a.deviceModel && a.lastDiscoveredDate && a.discoveredBy)).toBe(true);
    const ids = new Set(sample.assets.map(a => a.id));
    expect(sample.ciDependencies?.every(d => ids.has(d.sourceAssetId) && ids.has(d.targetAssetId))).toBe(true);
    expect((await data.loadShadowItExplorerData({ network: "net-1" })).rows).toHaveLength(2);
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
    data.resetDemoSettings();
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
    const early = demoPackage().snapshots[0].date;
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
  it("requires an explicit demo review when SQL calculation contracts change", () => {
    const contract = JSON.parse(readFileSync("Demo/data/calculation-contract.json", "utf8").replace(/^\uFEFF/, "")) as { files: Record<string,string> };
    for (const [file, expected] of Object.entries(contract.files)) {
      const source = readFileSync(file,"utf8").replace(/^\uFEFF/,"").replace(/\r\n/g,"\n");
      expect(createHash("sha256").update(source).digest("hex"), file + ": review demo evaluators/tests before updating contract").toBe(expected);
    }
  });
});
