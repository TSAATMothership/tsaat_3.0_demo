import { describe, expect, it } from "vitest";
import runtimeConfig from "../data/runtime-config.json";
import { loadKpiDefinitions } from "@/lib/data-loader";
import { normalizeKpiDefinitions } from "@/lib/kpi-definitions";

function runtimeKpiDefinitionInput(): unknown[] {
  return runtimeConfig.kpiDefinitions.map((definition) => ({
    ...definition,
    taskingConditions: Object.entries(definition.taskingConditions).map(
      ([conditionKey, templateText]) => ({ conditionKey, templateText })
    )
  }));
}

describe("KPI definitions", () => {
  it("normalizes demo JSON KPI definitions in display order", () => {
    const definitions = normalizeKpiDefinitions(runtimeKpiDefinitionInput());

    expect(definitions).toHaveLength(10);
    expect(definitions.map((definition) => definition.id)).toEqual([
      "KPI-1",
      "KPI-2",
      "KPI-3",
      "KPI-4",
      "KPI-5",
      "KPI-6",
      "KPI-7",
      "KPI-8",
      "KPI-9",
      "KPI-10"
    ]);
    expect(definitions.filter((definition) => definition.reportAvailable).map((definition) => definition.id)).toEqual([
      "KPI-5",
      "KPI-6",
      "KPI-7",
      "KPI-8",
      "KPI-9",
      "KPI-10"
    ]);
  });

  it("drops unsupported or duplicate rows during normalization", () => {
    const definitions = normalizeKpiDefinitions({
      kpis: [
        {
          id: "kpi-custom",
          displayOrder: 2,
          name: "Custom",
          description: "Custom description",
          successMeasure: "Custom success measure",
          calculationKey: "discovery-coverage-compliance",
          reportAvailable: 1,
          calculationDefinition: {
            calculationKey: "discovery-coverage-compliance",
            sourceKey: "kpi-scope-context",
            displayOrder: 1,
            name: "Discovery",
            description: "Discovery",
            enabled: true
          }
        },
        {
          id: "KPI-DUPLICATE-ORDER",
          displayOrder: 2,
          name: "Duplicate",
          description: "Duplicate description",
          successMeasure: "Duplicate success measure",
          calculationKey: "overall-spi-compliance",
          reportAvailable: true
        },
        {
          id: "KPI-UNKNOWN",
          displayOrder: 3,
          name: "Unsupported",
          description: "Unsupported description",
          successMeasure: "Unsupported success measure",
          calculationKey: "unsupported-calculation",
          reportAvailable: true,
          calculationDefinition: {
            calculationKey: "unsupported-calculation",
            sourceKey: "kpi-scope-context",
            displayOrder: 99,
            name: "Unsupported",
            description: "Unsupported",
            enabled: false
          }
        }
      ]
    });

    expect(definitions).toHaveLength(1);
    expect(definitions[0]).toMatchObject({
      id: "KPI-CUSTOM",
      displayOrder: 2,
      name: "Custom",
      description: "Custom description",
      successMeasure: "Custom success measure",
      calculationKey: "discovery-coverage-compliance",
      reportAvailable: true,
      enabled: true
    });
  });

  it("loads the complete KPI catalogue from the demo runtime JSON", async () => {
    const expected = normalizeKpiDefinitions(runtimeKpiDefinitionInput());
    const loaded = await loadKpiDefinitions();

    expect(loaded).toEqual(expected);
    expect(loaded).toHaveLength(runtimeConfig.kpiDefinitions.length);
    expect(loaded[0]?.calculationDefinition?.sourceKey).toBe("kpi-snapshot-scope-context");
    expect(loaded[0]?.reportDetailDefinition?.handlerKey).toBe("generic-kpi-summary");
    expect(loaded[0]?.taskingConditions.non_compliant).toContain("below target threshold");
    expect(loaded[9]?.calculationKey).toBe("network-discovery-enablement");
  });
});
