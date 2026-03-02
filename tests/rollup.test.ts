import { describe, expect, it } from "vitest";
import { buildRollups } from "@/lib/rollup";
import { AssetSpiEvaluation } from "@/lib/types";

describe("rollup precedence", () => {
  it("returns non-compliant when any child is non-compliant", () => {
    const evaluations: AssetSpiEvaluation[] = [
      {
        assetId: "a1",
        assetType: "server",
        networkId: "net-1",
        systemId: "sys-1",
        environmentType: "Production",
        evaluations: [
          { spiId: 1, status: "Compliant", evidence: {}, reasons: [] },
          { spiId: 10, status: "Compliant", evidence: {}, reasons: [] }
        ]
      },
      {
        assetId: "a2",
        assetType: "server",
        networkId: "net-1",
        systemId: "sys-1",
        environmentType: "Production",
        evaluations: [
          { spiId: 1, status: "Non-compliant", evidence: {}, reasons: [] },
          { spiId: 10, status: "Unknown", evidence: {}, reasons: [] }
        ]
      }
    ];

    const { networkRollups } = buildRollups(evaluations);
    const spi1 = networkRollups.find((rollup) => rollup.scopeId === "net-1" && rollup.spiId === 1);
    const spi10 = networkRollups.find((rollup) => rollup.scopeId === "net-1" && rollup.spiId === 10);

    expect(spi1?.status).toBe("Non-compliant");
    expect(spi10?.status).toBe("Unknown");
  });
});
