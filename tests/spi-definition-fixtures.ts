import { readFileSync } from "fs";
import path from "path";
import { defaultMeasuresSettings } from "@/lib/measures-settings";
import { normalizeSeverityDefinitions, normalizeSpiDefinitions } from "@/lib/spi-definitions";

const repoRoot = process.cwd();

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function buildSpiDefinitionInput(): unknown {
  const spiSeed = readJson("Database Schema/data/spi-definitions.json") as { spis?: Record<string, unknown>[] };
  const ruleSeed = readJson("Database Schema/data/spi-rule-definitions.json") as { rules?: Record<string, unknown>[] };
  const reportSeed = readJson("Database Schema/data/spi-report-detail-definitions.json") as {
    reportDetails?: Record<string, unknown>[];
  };
  const classificationSeed = readJson("Database Schema/data/spi-finding-classification-rules.json") as {
    classificationRules?: Record<string, unknown>[];
  };
  const ruleByKey = new Map((ruleSeed.rules ?? []).map((rule) => [String(rule.ruleKey), rule]));
  const reportByKey = new Map(
    (reportSeed.reportDetails ?? []).map((reportDetail) => [String(reportDetail.reportDetailKey), reportDetail])
  );

  return {
    spis: (spiSeed.spis ?? []).map((spi) => {
      const ruleDefinition = ruleByKey.get(String(spi.ruleKey));
      return {
        ...spi,
        ruleDefinition,
        parameterDefinitions: Array.isArray(ruleDefinition?.parameters) ? ruleDefinition.parameters : [],
        outcomeTemplates: Array.isArray(ruleDefinition?.outcomes) ? ruleDefinition.outcomes : [],
        reportDetailDefinition: reportByKey.get(String(spi.reportDetailKey)),
        classificationRules: classificationSeed.classificationRules ?? []
      };
    })
  };
}

export const testSpiDefinitions = normalizeSpiDefinitions(buildSpiDefinitionInput());
export const testSeverityDefinitions = normalizeSeverityDefinitions(readJson("Database Schema/data/severity-definitions.json"));
export const testMeasuresSettings = defaultMeasuresSettings(testSpiDefinitions, testSeverityDefinitions);
