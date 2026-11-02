import { describe, expect, it } from "vitest";
import { buildCveVulnerabilityIndexByAssetId, buildHighRiskCveIndexByAssetId } from "@/lib/cve";
import type { Asset, Vulnerability, VulnerabilitySeverity } from "@/lib/types";

function vulnerability(id: string, cve: string, criticality: VulnerabilitySeverity, capturedAt: string): Vulnerability {
  return {
    id,
    assetId: "asset-1",
    cve,
    description: `${cve} description`,
    remediationGuidance: `${cve} remediation`,
    criticality,
    severity: criticality,
    exploitability: criticality === "Critical" ? "Known Exploited" : "No Known Exploit",
    detectedDate: capturedAt.slice(0, 10),
    capturedAt,
    source: "Tenable"
  };
}

function serverAsset(vulnerabilities: Vulnerability[]): Asset {
  return {
    id: "asset-1",
    name: "Server 1",
    hostname: "server-1",
    networkId: "net-1",
    securityDomain: "Protected",
    lifecycle: {
      eolStatus: "Supported",
      warrantyStatus: "InWarranty"
    },
    vulnerabilities,
    type: "server",
    operatingSystem: null,
    installedSoftware: []
  };
}

describe("CVE vulnerability indexes", () => {
  it("indexes every asset CVE vulnerability for affected CI drillthroughs", () => {
    const asset = serverAsset([
      vulnerability("vuln-low", "CVE-2026-0001", "Low", "2026-01-01T00:00:00.000Z"),
      vulnerability("vuln-medium", "CVE-2026-0002", "Medium", "2026-02-01T00:00:00.000Z"),
      vulnerability("vuln-high", "CVE-2026-0003", "High", "2026-03-01T00:00:00.000Z"),
      vulnerability("vuln-critical", "CVE-2026-0004", "Critical", "2026-04-01T00:00:00.000Z")
    ]);

    const index = buildCveVulnerabilityIndexByAssetId([asset]);

    expect(index["asset-1"]).toHaveLength(4);
    expect(index["asset-1"].map((entry) => entry.criticality)).toEqual(["Critical", "High", "Medium", "Low"]);
    expect(index["asset-1"].map((entry) => entry.cve)).toEqual([
      "CVE-2026-0004",
      "CVE-2026-0003",
      "CVE-2026-0002",
      "CVE-2026-0001"
    ]);
  });

  it("keeps the existing high-risk CVE index constrained to critical vulnerabilities", () => {
    const asset = serverAsset([
      vulnerability("vuln-low", "CVE-2026-0001", "Low", "2026-01-01T00:00:00.000Z"),
      vulnerability("vuln-medium", "CVE-2026-0002", "Medium", "2026-02-01T00:00:00.000Z"),
      vulnerability("vuln-high", "CVE-2026-0003", "High", "2026-03-01T00:00:00.000Z"),
      vulnerability("vuln-critical", "CVE-2026-0004", "Critical", "2026-04-01T00:00:00.000Z")
    ]);

    const index = buildHighRiskCveIndexByAssetId([asset]);

    expect(index["asset-1"]).toHaveLength(1);
    expect(index["asset-1"][0].cve).toBe("CVE-2026-0004");
  });
});
