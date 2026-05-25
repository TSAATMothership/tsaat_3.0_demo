import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildSpiRows } from "@/lib/measures";
import { normalizeSeverityDefinitions, normalizeSpiDefinitions } from "@/lib/spi-definitions";
import { remediationActionsForSpi, taskingConditionForSpi, teamsForSpi } from "@/lib/tasking";
import type { AnalyticsResult } from "@/lib/types";
import { testSeverityDefinitions, testSpiDefinitions } from "./spi-definition-fixtures";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function baseAnalytics(): AnalyticsResult {
  return {
    evaluations: [
      {
        assetId: "asset-1",
        assetType: "server",
        networkId: "network-1",
        systemId: "system-1",
        environmentType: "Production",
        securityDomain: "Protected",
        systemCriticality: "Critical",
        discoveryCoverageCompliant: true,
        evaluations: [
          { spiId: 1, status: "Compliant", evidence: {}, reasons: [] },
          { spiId: 11, status: "Non-compliant", evidence: {}, reasons: [] }
        ]
      }
    ],
    findings: [],
    networkRollups: [],
    systemRollups: [],
    environmentRollups: [],
    overallCompliancePercent: 50,
    statusTotals: { compliant: 1, nonCompliant: 1, unknown: 0, impactedAssets: 1 },
    productionCriticalExposureAssetIds: []
  };
}

describe("database-driven SPI definitions", () => {
  it("normalizes current SPI and severity seed data", () => {
    expect(testSpiDefinitions).toHaveLength(10);
    expect(testSpiDefinitions.map((definition) => definition.spiId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(testSpiDefinitions.find((definition) => definition.spiId === 2)?.ruleParameters.maxNMinus).toBe(2);
    expect(testSpiDefinitions.find((definition) => definition.spiId === 4)?.ruleParameters).toMatchObject({
      environmentType: "Production",
      vulnerabilitySeverity: "Critical",
      unsupportedStatus: "OutOfSupport"
    });
    expect(testSpiDefinitions.find((definition) => definition.spiId === 10)?.ruleParameters).toMatchObject({
      endOfLifeStatus: "EOL",
      inWarrantyStatus: "InWarranty"
    });
    expect(testSpiDefinitions[0].ruleDefinition).toMatchObject({
      ruleKey: "os-support",
      handlerKey: "os-support"
    });
    expect(testSpiDefinitions[0].parameterDefinitions.map((definition) => definition.parameterKey)).toEqual([
      "unsupportedStatus",
      "unknownSupportStatus"
    ]);
    expect(testSpiDefinitions[0].outcomeTemplates.map((template) => template.outcomeKey)).toEqual([
      "missing_os_data",
      "supported",
      "unsupported"
    ]);
    expect(testSpiDefinitions[0].classificationRules.some((rule) => rule.classificationRuleId === "unknown-data-gap")).toBe(true);
    expect(testSpiDefinitions.every((definition) => definition.reportDetailKey === "standard-asset-annex")).toBe(true);
    expect(testSpiDefinitions.find((definition) => definition.spiId === 1)?.taskingTeams[0]).toMatchObject({
      team: "Endpoint Platform Team",
      supportQueue: "ENDPOINT-OS"
    });
    expect(testSeverityDefinitions.map((definition) => definition.severityKey)).toEqual([
      "Critical Exposure",
      "High Risk",
      "Major",
      "Moderate",
      "Data Gap"
    ]);
    expect(testSeverityDefinitions.find((definition) => definition.severityKey === "Data Gap")?.selectableInSettings).toBe(false);
  });

  it("filters unsupported or disabled SPI rows while accepting supported SPI 11+ rows", () => {
    const spiOne = testSpiDefinitions[0];
    const normalized = normalizeSpiDefinitions({
      spis: [
        { ...spiOne, spiId: 1, displayOrder: 1 },
        { ...spiOne, spiId: 11, displayOrder: 11, name: "Future OS Support" },
        { ...spiOne, spiId: 12, displayOrder: 12, ruleKey: "unsupported-rule" },
        {
          ...spiOne,
          spiId: 13,
          displayOrder: 13,
          ruleDefinition: { ...spiOne.ruleDefinition, handlerKey: "unsupported-handler" }
        },
        { ...spiOne, spiId: 14, displayOrder: 14, enabled: false }
      ]
    });

    expect(normalized.map((definition) => definition.spiId)).toEqual([1, 11]);
  });

  it("builds SPI rows from active definitions so removed and added rows affect the UI model", () => {
    const spiEleven = { ...testSpiDefinitions[0], spiId: 11, displayOrder: 11, name: "Future OS Support" };
    const rows = buildSpiRows(baseAnalytics(), [testSpiDefinitions[0], spiEleven]);

    expect(rows.map((row) => row.spiId)).toEqual([1, 11]);
    expect(rows.find((row) => row.spiId === 1)).toMatchObject({ compliant: 1, nonCompliant: 0, total: 1 });
    expect(rows.find((row) => row.spiId === 11)).toMatchObject({ compliant: 0, nonCompliant: 1, total: 1 });
  });

  it("renders tasking teams, actions, and condition text from SPI metadata", () => {
    const row = buildSpiRows(baseAnalytics(), testSpiDefinitions).find((item) => item.spiId === 1);
    expect(row).toBeTruthy();

    expect(teamsForSpi(1, testSpiDefinitions)[0]).toMatchObject({
      team: "Endpoint Platform Team",
      supportQueue: "ENDPOINT-OS"
    });
    expect(remediationActionsForSpi(row!, testSpiDefinitions)[0]).toContain("Upgrade or migrate affected operating systems");
    expect(taskingConditionForSpi(row!, testSpiDefinitions[0])).toContain("SPI-1 is fully compliant");
  });

  it("keeps database artefacts synchronized for SPI metadata", () => {
    const schema = readRepoFile("Database Schema/database-schema.sql");
    const migration = readRepoFile("Database Schema/migrations/013_database_driven_spi_measures.sql");
    const catalogueMigration = readRepoFile("Database Schema/migrations/014_spi_rule_catalogues_and_classification.sql");
    const loader = readRepoFile("Database Schema/loaders/load-data.sql");
    const validator = readRepoFile("Database Schema/loaders/validate-database.sql");
    const manifest = readRepoFile("Database Schema/data/database-build-manifest.json");
    const mapping = readRepoFile("Database Schema/data-mapping-description.txt");

    for (const table of [
      "finding_severity_definition",
      "spi_rule_parameter",
      "spi_rule_definition",
      "spi_rule_parameter_definition",
      "spi_rule_outcome_template",
      "spi_report_detail_definition",
      "spi_finding_classification_rule",
      "spi_tasking_team",
      "spi_tasking_action_template",
      "spi_tasking_condition_template"
    ]) {
      expect(schema).toContain(table);
      expect(`${migration}\n${catalogueMigration}`).toContain(table);
      expect(loader).toContain(table);
      expect(validator).toContain(table);
    }
    expect(manifest).toContain("severity-definitions.json");
    expect(manifest).toContain("spi-rule-definitions.json");
    expect(manifest).toContain("spi-report-detail-definitions.json");
    expect(manifest).toContain("spi-finding-classification-rules.json");
    expect(mapping).toContain("ruleKey");
    expect(normalizeSeverityDefinitions(JSON.parse(readRepoFile("Database Schema/data/severity-definitions.json")))).toHaveLength(5);
  });
});
