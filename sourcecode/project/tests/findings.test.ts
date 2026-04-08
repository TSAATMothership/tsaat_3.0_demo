import { describe, expect, it } from "vitest";
import { buildFindings } from "@/lib/findings";
import { Asset, AssetSpiEvaluation } from "@/lib/types";

describe("findings prioritization", () => {
  it("places high-risk findings above others", () => {
    const assets: Asset[] = [
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
        installedSoftware: []
      },
      {
        id: "netd-1",
        name: "Device 1",
        hostname: "netd-1",
        type: "network-device",
        networkId: "net-1",
        securityDomain: "Protected",
        lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
        vulnerabilities: [],
        networkOs: null,
        patchState: null
      }
    ];

    const evaluations: AssetSpiEvaluation[] = [
      {
        assetId: "srv-1",
        assetType: "server",
        networkId: "net-1",
        systemId: "sys-1",
        environmentType: "Production",
        evaluations: [
          {
            spiId: 4,
            status: "Non-compliant",
            evidence: { productionContext: true },
            reasons: ["High risk"]
          }
        ]
      },
      {
        assetId: "netd-1",
        assetType: "network-device",
        networkId: "net-1",
        systemId: null,
        environmentType: null,
        evaluations: [
          {
            spiId: 9,
            status: "Non-compliant",
            evidence: { patchLatest: false },
            reasons: ["Patch lag"]
          }
        ]
      }
    ];

    const findings = buildFindings(assets, evaluations, new Set(["srv-1"]));

    expect(findings[0].spiId).toBe(4);
    expect(findings[0].severity).toBe("High Risk");
    expect(findings[0].complianceStatus).toBe("Non-compliant");
    expect(["open", "closed"]).toContain(findings[0].status);
    expect(findings.some((finding) => finding.priorityRank > findings[0].priorityRank)).toBe(true);
  });
});
