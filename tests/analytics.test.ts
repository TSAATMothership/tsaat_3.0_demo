import { describe, expect, it } from "vitest";
import { buildAnalytics } from "@/lib/analytics";
import { MeasuresSettings } from "@/lib/measures-settings";
import { Dataset, Finding } from "@/lib/types";

function baseFinding(id: string, assetId: string): Finding {
  return {
    id,
    spiId: 1,
    priorityRank: 3,
    severity: "Major",
    status: "open",
    complianceStatus: "Non-compliant",
    timestamp: "2025-01-01T10:00:00-05:00",
    closedTimestamp: null,
    scope: {
      networkId: "net-1",
      systemId: "sys-1",
      environmentType: "Production",
      assetId
    },
    title: "SPI sample",
    evidence: {
      assetName: assetId,
      assetType: assetId.startsWith("srv") ? "server" : "workstation"
    },
    recommendedAction: "Fix"
  };
}

describe("analytics findings filtering", () => {
  it("filters seeded findings by asset scope instead of regenerating them", () => {
    const dataset: Dataset = {
      generatedAt: "2026-02-28T00:00:00.000Z",
      snapshotDate: "2026-02-28",
      managedNetworks: [
        {
          id: "net-1",
          name: "Network 1",
          criticality: "Critical",
          adfPlatform: false,
          enterprisePlatform: false,
          modellingStatus: true,
          discoveryStatus: "Discovery Enabled",
          ictSystemIds: ["sys-1"],
          assetIds: ["srv-1", "wks-1"]
        }
      ],
      ictSystems: [
        {
          id: "sys-1",
          name: "System 1",
          adfPlatform: false,
          enterprisePlatform: false,
          modellingStatus: true,
          diisDefined: true,
          networkId: "net-1",
          criticality: "Critical",
          securityDomain: "Protected",
          missionCapabilities: [],
          businessServices: [],
          environments: [
            { id: "env-1", name: "Production", type: "Production", assetIds: ["srv-1", "wks-1"] },
            { id: "env-2", name: "Development", type: "Development", assetIds: [] }
          ]
        }
      ],
      assets: [
        {
          id: "srv-1",
          name: "Server 1",
          hostname: "srv-1",
          type: "server",
          networkId: "net-1",
          securityDomain: "Protected",
          lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
          vulnerabilities: [],
          operatingSystem: null,
          installedSoftware: [],
          systemContext: { systemId: "sys-1", environmentType: "Production" }
        },
        {
          id: "wks-1",
          name: "Workstation 1",
          hostname: "wks-1",
          type: "workstation",
          networkId: "net-1",
          securityDomain: "Protected",
          lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
          vulnerabilities: [],
          operatingSystem: null,
          installedSoftware: [],
          systemContext: { systemId: "sys-1", environmentType: "Production" }
        }
      ],
      findings: [baseFinding("finding-1", "srv-1"), baseFinding("finding-2", "wks-1")]
    };

    const unfiltered = buildAnalytics(dataset, dataset.ictSystems);
    const serverOnly = buildAnalytics(dataset, dataset.ictSystems, { assetType: "server" });

    expect(unfiltered.findings.map((finding) => finding.id).sort()).toEqual(["finding-1", "finding-2"]);
    expect(serverOnly.findings.map((finding) => finding.id)).toEqual(["finding-1"]);
  });

  it("deduplicates same-asset findings across all severities while keeping different assets", () => {
    const dataset: Dataset = {
      generatedAt: "2026-02-28T00:00:00.000Z",
      snapshotDate: "2026-02-28",
      managedNetworks: [
        {
          id: "net-1",
          name: "Network 1",
          criticality: "Critical",
          adfPlatform: false,
          enterprisePlatform: false,
          modellingStatus: true,
          discoveryStatus: "Discovery Enabled",
          ictSystemIds: ["sys-1"],
          assetIds: ["srv-1", "wks-1"]
        }
      ],
      ictSystems: [
        {
          id: "sys-1",
          name: "System 1",
          adfPlatform: false,
          enterprisePlatform: false,
          modellingStatus: true,
          diisDefined: true,
          networkId: "net-1",
          criticality: "Critical",
          securityDomain: "Protected",
          missionCapabilities: [],
          businessServices: [],
          environments: [{ id: "env-1", name: "Production", type: "Production", assetIds: ["srv-1", "wks-1"] }]
        }
      ],
      assets: [
        {
          id: "srv-1",
          name: "Server 1",
          hostname: "srv-1",
          type: "server",
          networkId: "net-1",
          securityDomain: "Protected",
          lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
          vulnerabilities: [],
          operatingSystem: null,
          installedSoftware: [],
          systemContext: { systemId: "sys-1", environmentType: "Production" }
        },
        {
          id: "wks-1",
          name: "Workstation 1",
          hostname: "wks-1",
          type: "workstation",
          networkId: "net-1",
          securityDomain: "Protected",
          lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
          vulnerabilities: [],
          operatingSystem: null,
          installedSoftware: [],
          systemContext: { systemId: "sys-1", environmentType: "Production" }
        }
      ],
      findings: [
        { ...baseFinding("srv-ce-old", "srv-1"), spiId: 3, severity: "Critical Exposure", timestamp: "2025-01-01T10:00:00-05:00" },
        { ...baseFinding("srv-ce-new", "srv-1"), spiId: 3, severity: "Critical Exposure", timestamp: "2025-01-02T10:00:00-05:00" },
        { ...baseFinding("wks-ce", "wks-1"), spiId: 3, severity: "Critical Exposure", timestamp: "2025-01-01T10:00:00-05:00" },
        { ...baseFinding("srv-hr-old", "srv-1"), spiId: 4, severity: "High Risk", timestamp: "2025-01-01T10:00:00-05:00" },
        { ...baseFinding("srv-hr-new", "srv-1"), spiId: 4, severity: "High Risk", timestamp: "2025-01-02T10:00:00-05:00" },
        { ...baseFinding("wks-hr", "wks-1"), spiId: 4, severity: "High Risk", timestamp: "2025-01-01T10:00:00-05:00" },
        { ...baseFinding("srv-maj-old", "srv-1"), spiId: 1, severity: "Major", timestamp: "2025-01-01T10:00:00-05:00" },
        { ...baseFinding("srv-maj-new", "srv-1"), spiId: 1, severity: "Major", timestamp: "2025-01-02T10:00:00-05:00" },
        { ...baseFinding("wks-maj", "wks-1"), spiId: 1, severity: "Major", timestamp: "2025-01-01T10:00:00-05:00" },
        { ...baseFinding("srv-mod-old", "srv-1"), spiId: 2, severity: "Moderate", timestamp: "2025-01-01T10:00:00-05:00" },
        { ...baseFinding("srv-mod-new", "srv-1"), spiId: 2, severity: "Moderate", timestamp: "2025-01-02T10:00:00-05:00" },
        { ...baseFinding("wks-mod", "wks-1"), spiId: 2, severity: "Moderate", timestamp: "2025-01-01T10:00:00-05:00" },
        { ...baseFinding("srv-dg-old", "srv-1"), spiId: 9, severity: "Data Gap", complianceStatus: "Unknown", timestamp: "2025-01-01T10:00:00-05:00" },
        { ...baseFinding("srv-dg-new", "srv-1"), spiId: 9, severity: "Data Gap", complianceStatus: "Unknown", timestamp: "2025-01-02T10:00:00-05:00" },
        { ...baseFinding("wks-dg", "wks-1"), spiId: 9, severity: "Data Gap", complianceStatus: "Unknown", timestamp: "2025-01-01T10:00:00-05:00" }
      ]
    };

    const analytics = buildAnalytics(dataset, dataset.ictSystems);
    const findingIds = analytics.findings.map((finding) => finding.id);

    expect(analytics.findings).toHaveLength(10);
    expect(findingIds).toEqual(
      expect.arrayContaining([
        "srv-ce-new",
        "wks-ce",
        "srv-hr-new",
        "wks-hr",
        "srv-maj-new",
        "wks-maj",
        "srv-mod-new",
        "wks-mod",
        "srv-dg-new",
        "wks-dg"
      ])
    );
    expect(findingIds).not.toEqual(expect.arrayContaining(["srv-ce-old", "srv-hr-old", "srv-maj-old", "srv-mod-old", "srv-dg-old"]));
  });

  it("applies SPI and asset-type severity overrides from measures settings", () => {
    const dataset: Dataset = {
      generatedAt: "2026-02-28T00:00:00.000Z",
      snapshotDate: "2026-02-28",
      managedNetworks: [
        {
          id: "net-1",
          name: "Network 1",
          criticality: "Critical",
          adfPlatform: false,
          enterprisePlatform: false,
          modellingStatus: true,
          discoveryStatus: "Discovery Enabled",
          ictSystemIds: ["sys-1"],
          assetIds: ["srv-1"]
        }
      ],
      ictSystems: [
        {
          id: "sys-1",
          name: "System 1",
          adfPlatform: false,
          enterprisePlatform: false,
          modellingStatus: true,
          diisDefined: true,
          networkId: "net-1",
          criticality: "Critical",
          securityDomain: "Protected",
          missionCapabilities: [],
          businessServices: [],
          environments: [{ id: "env-1", name: "Production", type: "Production", assetIds: ["srv-1"] }]
        }
      ],
      assets: [
        {
          id: "srv-1",
          name: "Server 1",
          hostname: "srv-1",
          type: "server",
          networkId: "net-1",
          securityDomain: "Protected",
          lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
          vulnerabilities: [],
          operatingSystem: null,
          installedSoftware: [],
          systemContext: { systemId: "sys-1", environmentType: "Production" }
        }
      ],
      findings: [{ ...baseFinding("finding-override", "srv-1"), spiId: 1, severity: "Major" }]
    };

    const settings: MeasuresSettings = {
      updatedAt: "2026-03-01T00:00:00.000Z",
      severityMatrix: {
        "1:server": "High Risk",
        "1:workstation": "Major",
        "1:network-device": "Major"
      }
    };

    const analytics = buildAnalytics(dataset, dataset.ictSystems, {}, settings);
    expect(analytics.findings).toHaveLength(1);
    expect(analytics.findings[0]?.severity).toBe("High Risk");
  });
});
