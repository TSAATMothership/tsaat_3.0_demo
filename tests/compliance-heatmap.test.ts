import { describe, expect, it } from "vitest";
import { buildComplianceHeatmap, heatmapCellSize, heatmapRowWindow } from "@/lib/compliance-heatmap";
import type { Asset, AssetSpiEvaluation, ComplianceStatus } from "@/lib/types";
import type { SpiDefinition } from "@/lib/spi-definitions";
import { testSeverityDefinitions, testSpiDefinitions } from "./spi-definition-fixtures";

const asset = (id: string, name = id): Asset => ({ id, name, hostname: id, networkId: "net-1", type: "server", securityDomain: "Protected",
  lifecycle: { eolStatus: "Unknown", warrantyStatus: "Unknown" }, vulnerabilities: [], operatingSystem: null, installedSoftware: [], ipAddress: "192.0.2.1" });
const evaluation = (id: string, statuses: ComplianceStatus[]): AssetSpiEvaluation => ({ assetId: id, assetType: "server", networkId: "net-1",
  systemId: null, environmentType: null, securityDomain: "Protected", systemCriticality: null, discoveryCoverageCompliant: true,
  evaluations: statuses.map((status, index) => ({ spiId: index + 1, status, evidence: {}, reasons: [] })) });
function input() {
  return {
    assets: [asset("missing"), asset("bad", "A failed device"), asset("good", "Z healthy device"), asset("unknown")],
    evaluations: [evaluation("good", ["Compliant", "Compliant", "Compliant"]), evaluation("bad", ["Compliant", "Non-compliant", "Unknown"]),
      evaluation("unknown", ["Compliant", "Unknown", "Compliant"]), evaluation("outside-scope", ["Non-compliant"])],
    spiDefinitions: ["Critical Exposure", "Moderate", "High Risk"].map((defaultSeverity, index): SpiDefinition => ({ ...testSpiDefinitions[0], spiId: index + 1,
      name: `Test ${index + 1}`, enabled: true, displayOrder: index + 1, defaultSeverity, applicableAssetTypes: ["server" as const] })),
    severityDefinitions: testSeverityDefinitions,
    measuresSettings: { updatedAt: "2026-11-01", severityMatrix: {} as Record<string, string>, priorityMatrix: {} }
  };
}

describe("device compliance heatmap", () => {
  it("orders devices compliant, non-compliant, unknown and keeps cells aligned with severity-sorted SPIs", () => {
    const model = buildComplianceHeatmap(input());
    expect(model.spis.map(spi => spi.id)).toEqual([2, 3, 1]);
    expect(model.devices.map(device => device.id)).toEqual(["good", "bad", "missing", "unknown"]);
    expect(model.devices.map(device => device.cells)).toEqual([[0, 0, 0], [1, 2, 0], [2, 2, 2], [2, 0, 0]]);
    expect(model.groups).toEqual({ compliant: 1, nonCompliant: 1, unknown: 2 });
    expect(model.devices[1]).toMatchObject({ compliant: 1, nonCompliant: 1, unknown: 1, status: 1 });
  });
  it("uses saved per-device-type risk settings, with the highest applicable severity on the right", () => {
    const data = input();
    data.measuresSettings.severityMatrix = { "1:server": "Major", "2:server": "High Risk", "3:server": "Moderate", "3:workstation": "Critical Exposure" };
    expect(buildComplianceHeatmap(data).spis.map(spi => spi.id)).toEqual([3, 1, 2]);
    data.assets.push({ ...asset("workstation"), type: "workstation", operatingSystem: null, installedSoftware: [] });
    data.spiDefinitions[2] = { ...data.spiDefinitions[2], applicableAssetTypes: ["server", "workstation"] };
    const model = buildComplianceHeatmap(data);
    expect(model.spis.map(spi => spi.id)).toEqual([1, 2, 3]);
    expect(model.spis[2]).toMatchObject({ severity: "Critical Exposure", severityByAssetType: { server: "Moderate", workstation: "Critical Exposure" } });
    data.measuresSettings.severityMatrix["3:workstation"] = "Moderate";
    expect(buildComplianceHeatmap(data).spis.map(spi => spi.id)).toEqual([3, 1, 2]);
  });
  it("excludes disabled SPIs and distinguishes non-applicable checks from missing applicable results", () => {
    const data = input();
    data.spiDefinitions[0].enabled = false;
    data.spiDefinitions[1].applicableAssetTypes = ["workstation"];
    const model = buildComplianceHeatmap(data);
    expect(model.spis.map(spi => spi.id)).toEqual([2, 3]);
    expect(model.devices.find(device => device.id === "missing")?.cells).toEqual([3, 2]);
    expect(model.devices.find(device => device.id === "good")).toMatchObject({ cells: [3, 0], status: 0, unknown: 0 });
  });
  it("handles no devices, no SPIs and devices with no applicable checks without false compliance", () => {
    expect(buildComplianceHeatmap({ ...input(), assets: [] }).devices).toEqual([]);
    const model = buildComplianceHeatmap({ ...input(), spiDefinitions: [] });
    expect(model.spis).toEqual([]);
    expect(model.groups).toEqual({ compliant: 0, nonCompliant: 0, unknown: 4 });
    expect(model.devices.every(device => device.cells.length === 0)).toBe(true);
  });
  it("scales squares with the number of devices and available space while preserving a readable minimum", () => {
    expect(heatmapCellSize(4, 8, 1200, 700, 232)).toBe(40);
    expect(heatmapCellSize(20, 8, 1200, 700, 232)).toBe(26);
    expect(heatmapCellSize(10000, 8, 1200, 700, 232)).toBe(12);
    expect(heatmapCellSize(4, 20, 350, 700, 156)).toBe(12);
  });
  it("keeps large inventories scrollable through the last row with bounded rendered rows", () => {
    const top = heatmapRowWindow(10000, 12, 0, 560);
    expect(top.start).toBe(0);
    expect(top.end - top.start).toBeLessThan(65);
    const bottom = heatmapRowWindow(10000, 12, 10000 * 12 - 350, 560);
    expect(bottom.end).toBe(10000);
    expect(bottom.end - bottom.start).toBeLessThan(65);
    expect(heatmapRowWindow(0, 40, 0, 560)).toEqual({ start: 0, end: 0 });
  });
});
