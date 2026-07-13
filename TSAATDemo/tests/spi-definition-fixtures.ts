import runtimeConfig from "../data/runtime-config.json";
import { defaultMeasuresSettings, normalizePriorityDefinitions } from "@/lib/measures-settings";
import { normalizeSeverityDefinitions, normalizeSpiDefinitions } from "@/lib/spi-definitions";

const spiDefinitionInput = runtimeConfig.spiDefinitions.map((definition) => ({
  ...definition,
  taskingConditions: Object.entries(definition.taskingConditions).map(
    ([conditionKey, templateText]) => ({ conditionKey, templateText })
  )
}));

export const testSpiDefinitions = normalizeSpiDefinitions(spiDefinitionInput);
export const testSeverityDefinitions = normalizeSeverityDefinitions(runtimeConfig.severityDefinitions);
export const testPriorityDefinitions = normalizePriorityDefinitions(runtimeConfig.priorityDefinitions);
export const testMeasuresSettings = defaultMeasuresSettings(
  testSpiDefinitions,
  testSeverityDefinitions,
  testPriorityDefinitions
);
