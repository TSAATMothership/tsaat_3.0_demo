import { describe, expect, it } from "vitest";
import { evaluateAssetSpis } from "@/lib/spi-rules";
import { ServerAsset, StorageDeviceAsset, WorkstationAsset } from "@/lib/types";
import { testSpiDefinitions } from "./spi-definition-fixtures";

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
        assetId: "srv-1",
        cve: "CVE-2026-1000",
        description: "Remote code execution in exposed service endpoint.",
        remediationGuidance: "Patch to vendor-fixed version and restrict interface exposure.",
        criticality: "Critical",
        severity: "Critical",
        exploitability: "Known Exploited",
        detectedDate: "2026-01-01",
        capturedAt: "2026-01-01T02:15:00.000Z",
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
    const evaluations = evaluateAssetSpis(baseServer(), testSpiDefinitions);
    const spi4 = evaluations.find((item) => item.spiId === 4);
    const spi5 = evaluations.find((item) => item.spiId === 5);

    expect(spi4?.status).toBe("Non-compliant");
    expect(spi4?.outcomeKey).toBe("triggered");
    expect(spi4?.reasons).toEqual(["High Risk: Production server has critical vulnerability on unsupported OS."]);
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

    const evaluations = evaluateAssetSpis(workstation, testSpiDefinitions);
    expect(evaluations.find((item) => item.spiId === 1)?.status).toBe("Unknown");
    expect(evaluations.find((item) => item.spiId === 2)?.status).toBe("Unknown");
  });

  it("evaluates storage-device assets on SPI 10 only", () => {
    const storage: StorageDeviceAsset = {
      id: "std-1",
      name: "Storage 1",
      hostname: "std-1",
      type: "storage-device",
      networkId: "net-1",
      securityDomain: "Protected",
      lifecycle: { eolStatus: "Supported", warrantyStatus: "InWarranty" },
      vulnerabilities: []
    };

    const evaluations = evaluateAssetSpis(storage, testSpiDefinitions);
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0]?.spiId).toBe(10);
    expect(evaluations[0]?.status).toBe("Compliant");
  });

  it("uses DB outcome templates without changing the rule result", () => {
    const definitions = testSpiDefinitions.map((definition) =>
      definition.spiId === 2
        ? {
            ...definition,
            outcomeTemplates: definition.outcomeTemplates.map((template) =>
              template.outcomeKey === "older_than_n_minus"
                ? { ...template, reasonTemplate: "DB template says OS is outside N-{maxNMinus}." }
                : template
            )
          }
        : definition
    );

    const evaluation = evaluateAssetSpis(baseServer(), definitions).find((item) => item.spiId === 2);

    expect(evaluation?.status).toBe("Non-compliant");
    expect(evaluation?.outcomeKey).toBe("older_than_n_minus");
    expect(evaluation?.reasons).toEqual(["DB template says OS is outside N-2."]);
  });
});
