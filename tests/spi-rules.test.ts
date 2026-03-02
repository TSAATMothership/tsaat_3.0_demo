import { describe, expect, it } from "vitest";
import { evaluateAssetSpis } from "@/lib/spi-rules";
import { ServerAsset, WorkstationAsset } from "@/lib/types";

function baseServer(): ServerAsset {
  return {
    id: "srv-1",
    name: "Server 1",
    hostname: "srv-1",
    type: "server",
    networkId: "net-1",
    securityDomain: "Protected",
    systemContext: { systemId: "sys-1", environmentType: "Production" },
    lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
    vulnerabilities: [
      {
        id: "v1",
        cve: "CVE-2026-1000",
        severity: "Critical",
        detectedDate: "2026-01-01",
        source: "Qualys"
      }
    ],
    operatingSystem: {
      family: "Windows Server",
      vendor: "Microsoft",
      majorVersion: 2016,
      version: "2016",
      supportStatus: "OutOfSupport",
      currentSupportedMajor: 2022,
      nMinus: 6
    },
    installedSoftware: [
      {
        name: "Legacy Middleware",
        version: "1.0",
        supportStatus: "OutOfSupport"
      }
    ]
  };
}

describe("SPI rules", () => {
  it("triggers high-risk SPI 4 and 5 for production server", () => {
    const evaluations = evaluateAssetSpis(baseServer());
    const spi4 = evaluations.find((item) => item.spiId === 4);
    const spi5 = evaluations.find((item) => item.spiId === 5);

    expect(spi4?.status).toBe("Non-compliant");
    expect(spi5?.status).toBe("Non-compliant");
  });

  it("returns unknown when workstation OS data is missing", () => {
    const workstation: WorkstationAsset = {
      id: "wks-1",
      name: "Workstation 1",
      hostname: "wks-1",
      type: "workstation",
      networkId: "net-1",
      securityDomain: "Protected",
      lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
      vulnerabilities: [],
      operatingSystem: null,
      installedSoftware: []
    };

    const evaluations = evaluateAssetSpis(workstation);
    expect(evaluations.find((item) => item.spiId === 1)?.status).toBe("Unknown");
    expect(evaluations.find((item) => item.spiId === 2)?.status).toBe("Unknown");
  });
});
