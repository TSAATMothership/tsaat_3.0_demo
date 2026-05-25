import { beforeEach, describe, expect, it, vi } from "vitest";
import { ASSET_TYPES } from "@/lib/asset-taxonomy";
import {
  __resetDataLoaderCachesForTest,
  loadDatasetForDate,
  loadFindingPriorityDefinitions,
  loadKpiDefinitions,
  loadMeasuresSettings,
  loadReferenceVersions,
  saveMeasuresSettings
} from "@/lib/data-loader";
import {
  testMeasuresSettings,
  testPriorityDefinitions,
  testSeverityDefinitions,
  testSpiDefinitions
} from "./spi-definition-fixtures";

const executeSqlJsonMock = vi.hoisted(() => vi.fn());
const executeSqlTextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sql-server", () => ({
  executeSqlJson: executeSqlJsonMock,
  executeSqlText: executeSqlTextMock,
  toSqlUnicodeLiteral: (value: string) => `N'${String(value).replace(/'/g, "''")}'`
}));

const emptySnapshotPayload = {
  managedNetworks: [],
  managedNetworkHierarchy: [],
  networkDeclaredSystems: [],
  networkDeclaredAssets: [],
  networkTargetStateAssets: [],
  ictSystems: [],
  ictSystemHierarchy: [],
  systemMissionCapabilities: [],
  systemBusinessServices: [],
  systemEnvironments: [],
  systemEnvironmentAssets: [],
  assets: [],
  assetOperatingSystems: [],
  assetNetworkOperatingSystems: [],
  assetPatchStates: [],
  assetInstalledSoftware: [],
  assetVulnerabilities: [],
  ciDependencies: [],
  findings: []
};

function installSqlMock(): void {
  executeSqlJsonMock.mockImplementation(async (sql: string) => {
    if (sql.includes("ds.[snapshot_id] AS [snapshotId]")) {
      return [{ snapshotId: 1, snapshotDate: "2026-04-30", generatedAt: "2026-04-30T00:00:00.000Z" }];
    }

    if (sql.includes("DECLARE @snapshotId BIGINT")) {
      return emptySnapshotPayload;
    }

    if (sql.includes("FROM [tsaat].[measures_settings_version]")) {
      return { settingsVersionId: 7, updatedAt: "2026-04-30T01:00:00.000Z" };
    }

    if (sql.includes("FROM [tsaat].[measures_severity_matrix]")) {
      return ASSET_TYPES.map((assetType) => ({
        spiId: 1,
        assetType,
        severity: "Major"
      }));
    }

    if (sql.includes("FROM [tsaat].[measures_priority_matrix]")) {
      return [{ spiId: 1, priorityRank: 3 }];
    }

    if (sql.includes("FROM [tsaat].[finding_severity_definition]")) {
      return testSeverityDefinitions.map((definition) => ({
        severityKey: definition.severityKey,
        label: definition.label,
        displayOrder: definition.displayOrder,
        selectableInSettings: definition.selectableInSettings,
        toneKey: definition.toneKey
      }));
    }

    if (sql.includes("FROM [tsaat].[finding_priority_definition]")) {
      return testPriorityDefinitions.map((definition) => ({
        priorityRank: definition.priorityRank,
        label: definition.label,
        displayOrder: definition.displayOrder,
        selectableInSettings: definition.selectableInSettings,
        description: definition.description
      }));
    }

    if (sql.includes("FROM [tsaat].[spi_definition] sd")) {
      return testSpiDefinitions.map((definition) => ({
        spiId: definition.spiId,
        displayOrder: definition.displayOrder,
        name: definition.name,
        description: definition.description,
        successMeasure: definition.successMeasure,
        priorityOrder: definition.priorityOrder,
        defaultSeverity: definition.defaultSeverity,
        recommendedAction: definition.recommendedAction,
        enabled: definition.enabled,
        ruleKey: definition.ruleKey,
        reportAvailable: definition.reportAvailable,
        trendReportAvailable: definition.trendReportAvailable,
        reportDetailKey: definition.reportDetailKey
      }));
    }

    if (sql.includes("FROM [tsaat].[spi_applicable_asset_type]")) {
      return testSpiDefinitions.flatMap((definition) =>
        definition.applicableAssetTypes.map((assetType) => ({ spiId: definition.spiId, assetType }))
      );
    }

    if (sql.includes("FROM [tsaat].[spi_rule_definition]")) {
      return Array.from(new Map(testSpiDefinitions.map((definition) => [definition.ruleKey, definition.ruleDefinition])).values());
    }

    if (sql.includes("FROM [tsaat].[spi_calculation_source]")) {
      return Array.from(
        new Map(
          testSpiDefinitions.map((definition) => [
            definition.calculationDefinition.sourceKey,
            definition.calculationDefinition.source
          ])
        ).values()
      );
    }

    if (sql.includes("FROM [tsaat].[spi_calculation_definition]")) {
      return testSpiDefinitions.map((definition) => ({
        ruleKey: definition.calculationDefinition.ruleKey,
        sourceKey: definition.calculationDefinition.sourceKey,
        displayOrder: definition.calculationDefinition.displayOrder,
        statusExpressionSql: definition.calculationDefinition.statusExpressionSql,
        outcomeExpressionSql: definition.calculationDefinition.outcomeExpressionSql,
        enabled: definition.calculationDefinition.enabled
      }));
    }

    if (sql.includes("FROM [tsaat].[spi_calculation_evidence_expression]")) {
      return testSpiDefinitions.flatMap((definition) => definition.calculationDefinition.evidenceExpressions);
    }

    if (sql.includes("FROM [tsaat].[spi_rule_parameter_definition]")) {
      return testSpiDefinitions.flatMap((definition) =>
        definition.parameterDefinitions.map((parameterDefinition) => ({
          ...parameterDefinition,
          allowedValuesJson: JSON.stringify(parameterDefinition.allowedValues)
        }))
      );
    }

    if (sql.includes("FROM [tsaat].[spi_rule_outcome_template]")) {
      return testSpiDefinitions.flatMap((definition) => definition.outcomeTemplates);
    }

    if (sql.includes("FROM [tsaat].[spi_report_detail_definition]")) {
      return Array.from(
        new Map(
          testSpiDefinitions.map((definition) => [definition.reportDetailKey, definition.reportDetailDefinition])
        ).values()
      );
    }

    if (sql.includes("FROM [tsaat].[spi_finding_classification_rule]")) {
      return Array.from(
        new Map(
          testSpiDefinitions.flatMap((definition) =>
            definition.classificationRules.map((rule) => [rule.classificationRuleId, rule] as const)
          )
        ).values()
      );
    }

    if (sql.includes("FROM [tsaat].[spi_feature_binding]")) {
      return testSpiDefinitions.flatMap((definition) => definition.featureBindings);
    }

    if (sql.includes("FROM [tsaat].[spi_rule_parameter]")) {
      return testSpiDefinitions.flatMap((definition) =>
        Object.entries(definition.ruleParameters).map(([parameterKey, parameterValue]) => ({
          spiId: definition.spiId,
          parameterKey,
          parameterType: typeof parameterValue === "number" ? "number" : typeof parameterValue === "boolean" ? "boolean" : "string",
          parameterValue: String(parameterValue)
        }))
      );
    }

    if (sql.includes("FROM [tsaat].[spi_tasking_team]")) {
      return testSpiDefinitions.flatMap((definition) =>
        definition.taskingTeams.map((team) => ({ spiId: definition.spiId, ...team }))
      );
    }

    if (sql.includes("FROM [tsaat].[spi_tasking_action_template]")) {
      return testSpiDefinitions.flatMap((definition) =>
        definition.taskingActions.map((action) => ({ spiId: definition.spiId, ...action }))
      );
    }

    if (sql.includes("FROM [tsaat].[spi_tasking_condition_template]")) {
      return testSpiDefinitions.flatMap((definition) =>
        Object.entries(definition.taskingConditions).map(([conditionKey, templateText]) => ({
          spiId: definition.spiId,
          conditionKey,
          templateText
        }))
      );
    }

    if (sql.includes("FROM [tsaat].[kpi_definition]")) {
      return [
        {
          id: "KPI-6",
          displayOrder: 6,
          name: "Discovery Coverage Compliance",
          description: "Share of in-scope assets meeting discovery coverage.",
          successMeasure: "Target = 100% discovery coverage compliance.",
          calculationKey: "discovery-coverage-compliance",
          reportAvailable: true
        }
      ];
    }

    if (sql.includes("usp_evaluate_spi_snapshot")) {
      return [];
    }

    if (sql.includes("version_ref.[version_set_id] AS [versionSetId]")) {
      return { versionSetId: 3 };
    }

    if (sql.includes("FROM [tsaat].[reference_os_current_major]")) {
      return [{ osKey: "Windows Server", currentSupportedMajor: 2022 }];
    }

    if (sql.includes("FROM [tsaat].[reference_software_supported_version]")) {
      return [{ softwareName: "SQL Server", versionOrdinal: 1, version: "2022" }];
    }

    return [];
  });
}

function sqlCallsContaining(text: string): number {
  return executeSqlJsonMock.mock.calls.filter(([sql]) => String(sql).includes(text)).length;
}

describe("data loader caches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetDataLoaderCachesForTest();
    installSqlMock();
    executeSqlTextMock.mockResolvedValue("");
  });

  it("reuses snapshot metadata and snapshot datasets within the cache window", async () => {
    await loadDatasetForDate("2026-04-30");
    await loadDatasetForDate("2026-04-30");

    expect(sqlCallsContaining("ds.[snapshot_id] AS [snapshotId]")).toBe(1);
    expect(sqlCallsContaining("DECLARE @snapshotId BIGINT")).toBe(1);
    expect(sqlCallsContaining("usp_evaluate_spi_snapshot")).toBe(1);
  });

  it("reuses measures settings by latest version", async () => {
    await loadMeasuresSettings();
    await loadMeasuresSettings();

    expect(sqlCallsContaining("FROM [tsaat].[measures_settings_version]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[measures_severity_matrix]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[measures_priority_matrix]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[finding_priority_definition]")).toBe(1);
  });

  it("invalidates measures settings cache after a save", async () => {
    await loadMeasuresSettings();
    await saveMeasuresSettings(testMeasuresSettings);
    executeSqlJsonMock.mockClear();

    await loadMeasuresSettings();

    expect(sqlCallsContaining("FROM [tsaat].[measures_settings_version]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[measures_severity_matrix]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[measures_priority_matrix]")).toBe(1);
  });

  it("caches reference versions for repeated reads", async () => {
    await loadReferenceVersions();
    await loadReferenceVersions();

    expect(sqlCallsContaining("version_ref.[version_set_id] AS [versionSetId]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[reference_os_current_major]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[reference_software_supported_version]")).toBe(1);
  });

  it("caches KPI definitions for repeated reads", async () => {
    await loadKpiDefinitions();
    await loadKpiDefinitions();

    expect(sqlCallsContaining("FROM [tsaat].[kpi_definition]")).toBe(1);
  });

  it("caches finding priority definitions for repeated reads", async () => {
    await loadFindingPriorityDefinitions();
    await loadFindingPriorityDefinitions();

    expect(sqlCallsContaining("FROM [tsaat].[finding_priority_definition]")).toBe(1);
  });
});
