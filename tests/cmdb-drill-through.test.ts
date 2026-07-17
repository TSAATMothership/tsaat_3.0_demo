import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildCmdbAssetDetails } from "@/lib/cmdb-drill-through";
import type { Dataset } from "@/lib/types";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const dataset: Dataset = {
  generatedAt: "2026-07-16T00:00:00.000Z",
  snapshotDate: "2026-07-15",
  managedNetworks: [
    {
      id: "network-1",
      name: "Operational Network",
      criticality: "Critical",
      adfPlatform: true,
      enterprisePlatform: false,
      modellingStatus: true,
      discoveryStatus: "Discovery Enabled",
      ictSystemIds: ["system-1"],
      assetIds: ["asset-1", "asset-2"]
    }
  ],
  ictSystems: [
    {
      id: "system-1",
      name: "Mission System",
      adfPlatform: true,
      enterprisePlatform: false,
      modellingStatus: true,
      diisDefined: true,
      networkId: "network-1",
      criticality: "Critical",
      securityDomain: "Secret",
      missionCapabilities: [],
      businessServices: [],
      environments: [
        {
          id: "environment-1",
          name: "Production",
          type: "Production",
          assetIds: ["asset-1"]
        }
      ]
    }
  ],
  assets: [
    {
      id: "asset-1",
      name: "Application Server 1",
      hostname: "app-server-1",
      cmdbRecordUrl: "https://cmdb.example.test/assets/asset-1",
      networkId: "network-1",
      securityDomain: "Secret",
      lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
      vulnerabilities: [
        {
          id: "vulnerability-1",
          assetId: "asset-1",
          cve: "CVE-2026-0001",
          description: "Test vulnerability",
          remediationGuidance: "Patch",
          criticality: "Critical",
          severity: "Critical",
          exploitability: "Known Exploited",
          detectedDate: "2026-07-14",
          capturedAt: "2026-07-15T00:00:00.000Z",
          source: "test"
        }
      ],
      systemContext: { systemId: "system-1", environmentType: "Production" },
      type: "server",
      operatingSystem: {
        family: "Windows Server",
        vendor: "Microsoft",
        majorVersion: 2022,
        version: "2022",
        supportStatus: "Supported",
        currentSupportedMajor: 2022,
        nMinus: 0
      },
      installedSoftware: [{ name: "Agent", version: "1.0", supportStatus: "Supported" }]
    },
    {
      id: "asset-2",
      name: "Core Switch",
      hostname: "core-switch-1",
      cmdbRecordUrl: null,
      networkId: "network-1",
      securityDomain: "Protected",
      lifecycle: { eolStatus: "Unknown", warrantyStatus: "Unknown" },
      vulnerabilities: [],
      type: "network-device",
      networkOs: null,
      patchState: { isLatest: false, lastPatchedDate: "2026-06-30" }
    }
  ],
  spiEvaluations: []
};

describe("CMDB drill through", () => {
  it("builds canonical device details from the selected snapshot", () => {
    expect(buildCmdbAssetDetails(dataset, "asset-1")).toEqual(
      expect.objectContaining({
        snapshotDate: "2026-07-15",
        assetId: "asset-1",
        assetName: "Application Server 1",
        assetHostname: "app-server-1",
        assetType: "server",
        networkName: "Operational Network",
        systemName: "Mission System",
        environmentType: "Production",
        operatingSystemSummary: "Microsoft Windows Server 2022 | Supported",
        installedSoftwareCount: 1,
        vulnerabilityCount: 1,
        criticalVulnerabilityCount: 1,
        cmdbRecordUrl: "https://cmdb.example.test/assets/asset-1"
      })
    );
  });

  it("handles unmodelled devices, patch summaries, and unknown asset IDs", () => {
    expect(buildCmdbAssetDetails(dataset, "asset-2")).toEqual(
      expect.objectContaining({
        assetName: "Core Switch",
        hasIctSystem: false,
        systemId: null,
        systemName: "Not linked to ICT system",
        environmentType: null,
        patchStateSummary: "Latest: No | Last patched: 2026-06-30",
        cmdbRecordUrl: null
      })
    );
    expect(buildCmdbAssetDetails(dataset, "unknown-asset")).toBeNull();
  });

  it("uses one global provider, one canonical endpoint, and the existing analyser D action", () => {
    const layout = readRepoFile("app/layout.tsx");
    const drawer = readRepoFile("components/cmdb-drill-through.tsx");
    const analyser = readRepoFile("components/ict-system-impact-analyser-2.tsx");
    const route = readRepoFile("app/api/assets/cmdb-details/route.ts");

    expect(layout).toContain("<CmdbDrillThroughProvider>{children}</CmdbDrillThroughProvider>");
    expect(drawer).toContain("createPortal(");
    expect(drawer).toContain("z-[11000]");
    expect(drawer).toContain("bg-slate-950/55 transition-opacity");
    expect(drawer).toContain("border-sky-300/25 bg-slate-950 p-4");
    expect(drawer).not.toContain("bg-slate-950/98 p-4");
    expect(drawer).toContain("window.location.hash.startsWith(\"#/\")");
    expect(drawer).toContain("openCmdbDrillThrough");
    expect(drawer).toContain("data-cmdb-asset-id={assetId}");
    expect(drawer).toContain('event.key === "Escape"');
    expect(drawer).toContain("event.stopImmediatePropagation()");
    expect(drawer).toContain('window.addEventListener("keydown", onKeyDown, true)');
    expect(drawer).toContain('event.key !== "Tab"');
    expect(drawer).toContain('document.addEventListener("focusin", onFocusIn, true)');
    expect(route).toContain("buildCmdbAssetDetails(dataset, assetId)");
    expect(route).toContain("loadDatasetForDate(dataDate, { profile: \"full\" })");
    expect(analyser).toContain('context.fillText("D"');
    expect(analyser).toContain("openCmdbDrillThrough(node.value, assetName)");
    expect(analyser).toContain("<CmdbDeviceName");
    expect(analyser).toContain("openCmdbDrillThrough(option.value, option.label)");
    expect(analyser).toContain("Select in diagram");
    expect(analyser).not.toContain("function AssetDetailsPanel");
  });

  it("wires every structured device-name table and nested panel surface", () => {
    const expectedTriggerCounts: Array<[string, number]> = [
      ["components/discovery-coverage-by-tool-section.tsx", 1],
      ["app/networks/[networkId]/page.tsx", 3],
      ["app/systems/[systemId]/page.tsx", 1],
      ["components/findings-table.tsx", 2],
      ["components/measures-spi-heatmap.tsx", 2],
      ["components/network-compliance-overview.tsx", 2],
      ["components/network-detail-risk-charts.tsx", 4],
      ["components/top-risks.tsx", 1],
      ["components/detailed-topology-view.tsx", 1]
    ];

    for (const [relativePath, minimumCount] of expectedTriggerCounts) {
      const source = readRepoFile(relativePath);
      expect(source.match(/<CmdbDeviceName\b/g)?.length ?? 0, relativePath).toBeGreaterThanOrEqual(minimumCount);
    }

    const dashboard = readRepoFile("components/cyber-cop-dashboard.tsx");
    expect(dashboard).toContain("openCmdbDrillThrough(asset.id, asset.name)");
  });
});
