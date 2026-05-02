import { describe, expect, it } from "vitest";
import { createAssetTypeRecord } from "@/lib/asset-taxonomy";
import {
  buildScopedDiscoveryToolCoverage,
  discoveryCoverageValueLabel
} from "@/lib/scoped-discovery-tool-coverage";
import { defaultDiscoveryToolsSettings, type DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import type { Asset, AssetType, Vulnerability } from "@/lib/types";

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
      settings
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
    const model = buildScopedDiscoveryToolCoverage([asset("server"), asset("printer-device")], settings);
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
