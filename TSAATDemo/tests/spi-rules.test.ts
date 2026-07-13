import { describe, expect, it } from "vitest";
import { renderSpiOutcomeReason } from "@/lib/spi-definitions";
import { testSpiDefinitions } from "./spi-definition-fixtures";

describe("SQL-driven SPI rule metadata", () => {
  it("normalizes SQL calculations for current SPI-1 through SPI-10 definitions", () => {
    expect(testSpiDefinitions.map((definition) => definition.spiId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    for (const definition of testSpiDefinitions) {
      expect(definition.calculationDefinition.ruleKey).toBe(definition.ruleKey);
      expect(definition.calculationDefinition.source.sourceObjectName).toBe("[tsaat].[vw_spi_asset_evaluation_context]");
      expect(definition.calculationDefinition.statusExpressionSql).toContain("CASE");
      expect(definition.calculationDefinition.outcomeExpressionSql).toContain("CASE");
      expect(definition.calculationDefinition.evidenceExpressions.length).toBeGreaterThan(0);
    }
  });

  it("keeps feature bindings in the DB-backed SPI definition graph", () => {
    expect(testSpiDefinitions.find((definition) => definition.spiId === 1)?.featureBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          featureKey: "out-of-support-os-report",
          complianceStatus: "Non-compliant",
          outcomeKey: "unsupported"
        }),
        expect.objectContaining({
          featureKey: "os-non-compliant",
          complianceStatus: "Non-compliant"
        })
      ])
    );
    expect(testSpiDefinitions.find((definition) => definition.spiId === 2)?.featureBindings).toEqual(
      expect.arrayContaining([expect.objectContaining({ featureKey: "os-non-compliant" })])
    );
    expect(testSpiDefinitions.find((definition) => definition.spiId === 3)?.featureBindings).toEqual(
      expect.arrayContaining([expect.objectContaining({ featureKey: "production-critical-exposure" })])
    );
  });

  it("uses DB outcome templates to render SQL evaluation reasons", () => {
    const spi2 = testSpiDefinitions.find((definition) => definition.spiId === 2)!;
    const customized = {
      ...spi2,
      outcomeTemplates: spi2.outcomeTemplates.map((template) =>
        template.outcomeKey === "older_than_n_minus"
          ? { ...template, reasonTemplate: "DB template says OS is outside N-{maxNMinus}." }
          : template
      )
    };

    const reason = renderSpiOutcomeReason(customized, {
      spiId: 2,
      status: "Non-compliant",
      outcomeKey: "older_than_n_minus",
      evidence: {
        operatingSystem: "Windows Server 2016",
        nMinus: 6,
        currentMajor: 2022
      },
      reasons: []
    });

    expect(reason).toBe("DB template says OS is outside N-2.");
  });
});
