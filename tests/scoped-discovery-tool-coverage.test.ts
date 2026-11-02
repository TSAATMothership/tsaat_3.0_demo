import { describe, expect, it } from "vitest";
import { createAssetTypeRecord } from "@/lib/asset-taxonomy";
import {
  buildScopedDiscoveryToolCoverage,
  discoveryCoverageValueLabel
} from "@/lib/scoped-discovery-tool-coverage";
import { defaultDiscoveryToolsSettings, type DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import type { Asset, AssetType, StoredDiscoveryCoverageEvaluation, Vulnerability } from "@/lib/types";

function vulnerability(overrides: Partial<Vulnerability> = {}): Vulnerability {
  return {
    id: "vuln-1",
    assetId: "asset-1",
    cve: "CVE-2026-0001",
    description: "Test vulnerability",
    remediationGuidance: "Patch",
    criticality: "High",
    severity: "High",
    exploitability: "No Known Exploit",
    detectedDate: "2026-04-01",
    capturedAt: "2026-04-23T00:00:00.000Z",
    source: "Nessus",
    ...overrides
  };
}

function asset(type: AssetType, overrides: Partial<Asset> = {}): Asset {
  const base = {
    id: `asset-${type}`,
    name: `Asset ${type}`,
    hostname: `host-${type}`,
    networkId: "net-1",
    securityDomain: "Protected" as const,
    lifecycle: {
      eolStatus: "Supported" as const,
      warrantyStatus: "InWarranty" as const
    },
    vulnerabilities: [] as Vulnerability[],
    systemContext: {
      systemId: "system-1",
      environmentType: "Production" as const
    },
    ...overrides
  };

  if (type === "server" || type === "workstation") {
    return {
      ...base,
      type,
      operatingSystem: null,
      installedSoftware: []
    };
  }
  if (type === "network-device") {
    return {
      ...base,
      type,
      networkOs: null,
      patchState: null
    };
  }
  return {
    ...base,
    type
  } as Asset;
}

function settingsWithScope(
  toolId: string,
  scopeFactory: (assetType: AssetType) => "required" | "na"
): DiscoveryToolsSettings {
  const settings = defaultDiscoveryToolsSettings();
  return {
    ...settings,
    tools: settings.tools.map((tool) =>
      tool.id === toolId
        ? {
            ...tool,
            assetTypeScope: createAssetTypeRecord(scopeFactory)
          }
        : tool
    )
  };
}

function coverage(
  assetId: string,
  toolValues: StoredDiscoveryCoverageEvaluation["toolValues"],
  coverageCompliance = Object.values(toolValues).every((value) => value !== 0)
): StoredDiscoveryCoverageEvaluation {
  return {
    assetId,
    coverageCompliance,
    toolValues,
    missingToolIds: Object.entries(toolValues)
      .filter(([, value]) => value === 0)
      .map(([toolId]) => toolId),
    missingToolNames: []
  };
}

describe("scoped discovery tool coverage", () => {
  it("excludes tools that are not required for any asset type in scope", () => {
    const settings = settingsWithScope("elastic", (assetType) => (assetType === "workstation" ? "required" : "na"));
    const model = buildScopedDiscoveryToolCoverage([asset("server")], settings);

    expect(model.toolColumns.map((tool) => tool.id)).not.toContain("elastic");
  });

  it("uses only applicable assets in each tool denominator", () => {
    const settings = settingsWithScope("tenable", (assetType) => (assetType === "server" ? "required" : "na"));
    const model = buildScopedDiscoveryToolCoverage(
      [
        asset("server", { vulnerabilities: [vulnerability()] }),
        asset("network-device", { vulnerabilities: [vulnerability({ assetId: "asset-network-device" })] })
      ],
      settings,
      [
        coverage("asset-server", { tenable: 1 }),
        coverage("asset-network-device", { tenable: null })
      ]
    );
    const tenable = model.toolCards.find((tool) => tool.id === "tenable");

    expect(tenable).toMatchObject({
      covered: 1,
      missing: 0,
      applicable: 1,
      coveragePercent: 100
    });
  });

  it("includes configured tools such as SNOW, DSOC SIEM, and Elastic when applicable", () => {
    const model = buildScopedDiscoveryToolCoverage([asset("server", { vulnerabilities: [vulnerability()] })], defaultDiscoveryToolsSettings());
    const toolIds = model.toolColumns.map((tool) => tool.id);

    expect(toolIds).toEqual(expect.arrayContaining(["snow", "dsoc-siem", "elastic"]));
  });

  it("preserves non-applicable cells as N/A instead of treating them as covered", () => {
    const settings = settingsWithScope("tenable", (assetType) => (assetType === "server" ? "required" : "na"));
    const model = buildScopedDiscoveryToolCoverage(
      [asset("server"), asset("printer-device")],
      settings,
      [
        coverage("asset-server", { tenable: 0 }, false),
        coverage("asset-printer-device", { tenable: null })
      ]
    );
    const tenable = model.toolCards.find((tool) => tool.id === "tenable");
    const printerCoverage = model.assetCoverageById.get("asset-printer-device");

    expect(tenable).toMatchObject({
      covered: 0,
      missing: 1,
      applicable: 1,
      coveragePercent: 0
    });
    expect(printerCoverage?.toolValues.tenable).toBeNull();
    expect(discoveryCoverageValueLabel(printerCoverage?.toolValues.tenable)).toBe("N/A");
  });
});

describe("saved CI mappings drive tool coverage", () => {
  function mappedSettings(): DiscoveryToolsSettings {
    const defaults = defaultDiscoveryToolsSettings();
    return { ...defaults, tools: defaults.tools.filter((tool) => ["ucmdb", "tanium"].includes(tool.id)).map((tool) => ({
      ...tool,
      assetTypeScope: createAssetTypeRecord((type) => type === (tool.id === "ucmdb" ? "server" : "workstation") ? "required" : "na")
    })) };
  }

  it("recalculates visible tools and denominators as the filtered CI set changes", () => {
    const settings = mappedSettings();
    const assets = [asset("server"), asset("server", { id: "second-server" }), asset("workstation")];
    const evidence = [coverage("asset-server", { ucmdb: 1, tanium: 1 }), coverage("second-server", { ucmdb: 0 }), coverage("asset-workstation", { ucmdb: 1, tanium: 0 })];
    const all = buildScopedDiscoveryToolCoverage(assets, settings, evidence);
    expect(all.toolCards).toEqual([
      expect.objectContaining({ id: "ucmdb", applicable: 2, covered: 1, missing: 1, coveragePercent: 50 }),
      expect.objectContaining({ id: "tanium", applicable: 1, covered: 0, missing: 1, coveragePercent: 0 })
    ]);
    const servers = buildScopedDiscoveryToolCoverage(assets.filter((row) => row.type === "server"), settings, evidence);
    expect(servers.toolCards.map((tool) => tool.id)).toEqual(["ucmdb"]);
    expect(servers.ciTypeTotals.find((item) => item.type === "server")).toMatchObject({ inScope: 2, usedInCalculations: 2 });
    expect(servers.ciTypeTotals.find((item) => item.type === "workstation")).toMatchObject({ inScope: 0, usedInCalculations: 0 });
    const workstations = buildScopedDiscoveryToolCoverage(assets.filter((row) => row.type === "workstation"), settings, evidence);
    expect(workstations.toolCards.map((tool) => tool.id)).toEqual(["tanium"]);
    expect(buildScopedDiscoveryToolCoverage([], settings, evidence).toolCards).toEqual([]);
    expect(buildScopedDiscoveryToolCoverage([asset("ip-node")], settings, evidence).toolColumns).toEqual([]);
  });

  it("excludes unmapped SQL detections and gaps from both counts and compliance", () => {
    const model = buildScopedDiscoveryToolCoverage([asset("server")], mappedSettings(), [coverage("asset-server", { ucmdb: 1, tanium: 0 }, false)]);
    expect(model.assetCoverages[0]).toMatchObject({ toolValues: { ucmdb: 1, tanium: null }, missingToolIds: [], coverageCompliance: true });
  });

  it("counts mapped CIs without detection evidence as missing", () => {
    const settings = mappedSettings();
    const model = buildScopedDiscoveryToolCoverage([asset("server"), asset("server", { id: "second-server" })], settings, [coverage("asset-server", { ucmdb: null })]);
    expect(model.toolCards[0]).toMatchObject({ applicable: 2, covered: 0, missing: 2, coveragePercent: 0 });
    expect(model.assetCoverages[0].missingToolNames).toEqual(["UCMDB"]);
  });

  it("counts CIs by type once across tools and includes only each tool's mapped types in its denominator", () => {
    const settings = mappedSettings();
    settings.tools[1].assetTypeScope.server = "required";
    const assets = [asset("server"), asset("server", { id: "second-server" }), asset("workstation"), asset("printer-device")];
    const model = buildScopedDiscoveryToolCoverage(assets, settings);
    expect(model.ciTypeTotals).toEqual([
      { type: "server", inScope: 2, usedInCalculations: 2 },
      { type: "workstation", inScope: 1, usedInCalculations: 1 },
      { type: "network-device", inScope: 0, usedInCalculations: 0 },
      { type: "storage-device", inScope: 0, usedInCalculations: 0 },
      { type: "printer-device", inScope: 1, usedInCalculations: 0 },
      { type: "other", inScope: 0, usedInCalculations: 0 },
      { type: "ip-node", inScope: 0, usedInCalculations: 0 }
    ]);
    expect(model.toolCards.find((tool) => tool.id === "ucmdb")?.applicableByCiType).toMatchObject({ server: 2, workstation: 0, "printer-device": 0 });
    expect(model.toolCards.find((tool) => tool.id === "tanium")?.applicableByCiType).toMatchObject({ server: 2, workstation: 1, "printer-device": 0 });
    for (const tool of model.toolCards) {
      expect(Object.values(tool.applicableByCiType).reduce((sum, count) => sum + count, 0)).toBe(tool.applicable);
      expect(tool.covered + tool.missing).toBe(tool.applicable);
    }
    const empty = buildScopedDiscoveryToolCoverage([], settings);
    expect(empty.ciTypeTotals.every((item) => item.inScope === 0 && item.usedInCalculations === 0)).toBe(true);
  });

  it("hides a tool after its final mapping is removed", () => {
    const settings = mappedSettings();
    settings.tools[0].assetTypeScope.server = "na";
    const model = buildScopedDiscoveryToolCoverage([asset("server")], settings, [coverage("asset-server", { ucmdb: 1 })]);
    expect(model.toolCards).toEqual([]);
    expect(model.toolColumns).toEqual([]);
    expect(model.ciTypeTotals.find((item) => item.type === "server")).toMatchObject({ inScope: 1, usedInCalculations: 0 });
  });
});
