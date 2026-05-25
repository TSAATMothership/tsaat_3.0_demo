import { beforeEach, describe, expect, it, vi } from "vitest";
import { ASSET_TYPES } from "@/lib/asset-taxonomy";
import {
  __resetDataLoaderCachesForTest,
  loadDatasetForDate,
  loadFindingDisplayConfiguration,
  loadFindingPriorityDefinitions,
  loadKpiDefinitions,
  loadSnapshotKpiEvaluationsForScope,
  loadSnapshotKpiEvaluationsForScopes,
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

    if (sql.includes("FROM [tsaat].[discovery_tools_settings_version]")) {
      return { settingsVersionId: 11, updatedAt: "2026-04-30T02:00:00.000Z" };
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

    if (sql.includes("FROM [tsaat].[finding_source_policy]")) {
      return [
        {
          policyKey: "persisted-first",
          displayOrder: 1,
          name: "Persisted Findings First",
          description: "Use persisted findings first.",
          usePersistedFindings: true,
          generateWhenEmpty: true,
          enabled: true
        }
      ];
    }

    if (sql.includes("FROM [tsaat].[finding_generation_policy]")) {
      return [
        {
          policyKey: "persisted-first",
          historyStartDate: "2024-02-10",
          historyWindowYears: 2,
          baselineBacklogCount: 200,
          minOpenCount: 180,
          maxOpenCount: 320,
          addProbabilityPercent: 38,
          addRateMinPercent: 0,
          addRateMaxPercent: 40,
          closeRateMinPercent: 10,
          closeRateMaxPercent: 20,
          closeBackfillMinCount: 1,
          closeBackfillMaxCount: 3,
          timezoneOffsetMinutes: -300
        }
      ];
    }

    if (sql.includes("FROM [tsaat].[finding_workflow_status_definition]")) {
      return [
        { statusKey: "open", label: "Open", displayOrder: 1, toneKey: "warning", terminalStatus: false },
        { statusKey: "closed", label: "Closed", displayOrder: 2, toneKey: "success", terminalStatus: true }
      ];
    }

    if (sql.includes("FROM [tsaat].[finding_bucket_definition]")) {
      return [
        {
          bucketKey: "high-risk",
          bucketType: "severity",
          label: "High Risk",
          displayOrder: 1,
          toneKey: "warning",
          conditionKey: "severity_equals",
          severityKey: "High Risk",
          priorityMin: null,
          priorityMax: null,
          workflowStatus: null,
          enabled: true,
          description: "High risk findings."
        },
        {
          bucketKey: "priority-1-2",
          bucketType: "priority",
          label: "P1-P2",
          displayOrder: 10,
          toneKey: "critical",
          conditionKey: "priority_between",
          severityKey: null,
          priorityMin: 1,
          priorityMax: 2,
          workflowStatus: null,
          enabled: true,
          description: "Immediate action priorities."
        }
      ];
    }

    if (sql.includes("FROM [tsaat].[finding_evidence_field_definition]")) {
      return [
        {
          fieldKey: "asset-name",
          displayOrder: 1,
          label: "Asset Name",
          purposeKey: "asset_name",
          candidateKeysJson: JSON.stringify(["assetName"]),
          fallbackValue: null,
          enabled: true
        }
      ];
    }

    if (sql.includes("FROM [tsaat].[finding_register_column_definition]")) {
      return [
        { columnKey: "measure", label: "Measure", displayOrder: 1, valueKey: "measure", enabled: true }
      ];
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

    if (sql.includes("usp_evaluate_kpi_snapshot_bulk")) {
      return [
        {
          scopeKey: "Secret::net-1",
          kpiId: "KPI-6",
          displayOrder: 6,
          calculationKey: "discovery-coverage-compliance",
          score: "100.0% (1/1)",
          scorePercent: 100,
          compliantCount: 1,
          applicableCount: 1,
          nonCompliantCount: 0,
          unknownCount: 0,
          highPriorityCount: 0
        }
      ];
    }

    if (sql.includes("usp_evaluate_kpi_snapshot")) {
      return [
        {
          kpiId: "KPI-6",
          displayOrder: 6,
          calculationKey: "discovery-coverage-compliance",
          score: "100.0% (1/1)",
          scorePercent: 100,
          compliantCount: 1,
          applicableCount: 1,
          nonCompliantCount: 0,
          unknownCount: 0,
          highPriorityCount: 0
        }
      ];
    }

    if (sql.includes("usp_evaluate_spi_snapshot")) {
      return [];
    }

    if (sql.includes("usp_get_effective_findings_snapshot")) {
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
    expect(sqlCallsContaining("usp_get_effective_findings_snapshot")).toBe(1);
  });

  it("separates snapshot dataset cache entries by load profile", async () => {
    await loadDatasetForDate("2026-04-30", { profile: "summary" });
    await loadDatasetForDate("2026-04-30", { profile: "summary" });
    await loadDatasetForDate("2026-04-30", { profile: "full" });

    const payloadSql = executeSqlJsonMock.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => sql.includes("DECLARE @snapshotId BIGINT"));

    expect(payloadSql).toHaveLength(2);
    expect(payloadSql[0]).toContain("DECLARE @includeRiskPayload BIT = 0;");
    expect(payloadSql[0]).toContain("DECLARE @includeFullPayload BIT = 0;");
    expect(payloadSql[1]).toContain("DECLARE @includeRiskPayload BIT = 1;");
    expect(payloadSql[1]).toContain("DECLARE @includeFullPayload BIT = 1;");
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

  it("caches scoped KPI evaluations for repeated reads", async () => {
    const kpiDefinitions = await loadKpiDefinitions();

    await loadSnapshotKpiEvaluationsForScope({
      snapshotId: 1,
      assetIds: ["asset-1"],
      systemIds: ["sys-1"],
      networkIds: ["net-1"],
      findings: [],
      kpiDefinitions
    });
    await loadSnapshotKpiEvaluationsForScope({
      snapshotId: 1,
      assetIds: ["asset-1"],
      systemIds: ["sys-1"],
      networkIds: ["net-1"],
      findings: [],
      kpiDefinitions
    });

    expect(sqlCallsContaining("usp_evaluate_kpi_snapshot")).toBe(1);
  });

  it("caches bulk scoped KPI evaluations for performance report rows", async () => {
    const kpiDefinitions = await loadKpiDefinitions();
    const scopes = [
      {
        scopeKey: "Secret::net-1",
        assetIds: ["asset-1"],
        systemIds: ["sys-1"],
        networkIds: ["net-1"],
        findings: []
      }
    ];

    const first = await loadSnapshotKpiEvaluationsForScopes({ snapshotId: 1, scopes, kpiDefinitions });
    const second = await loadSnapshotKpiEvaluationsForScopes({ snapshotId: 1, scopes, kpiDefinitions });

    expect(first.get("Secret::net-1")?.[0]?.scorePercent).toBe(100);
    expect(second).toBe(first);
    expect(sqlCallsContaining("usp_evaluate_kpi_snapshot_bulk")).toBe(1);
  });

  it("caches finding priority definitions for repeated reads", async () => {
    await loadFindingPriorityDefinitions();
    await loadFindingPriorityDefinitions();

    expect(sqlCallsContaining("FROM [tsaat].[finding_priority_definition]")).toBe(1);
  });

  it("caches finding display configuration for repeated reads", async () => {
    await loadFindingDisplayConfiguration();
    await loadFindingDisplayConfiguration();

    expect(sqlCallsContaining("FROM [tsaat].[finding_source_policy]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[finding_bucket_definition]")).toBe(1);
    expect(sqlCallsContaining("FROM [tsaat].[finding_evidence_field_definition]")).toBe(1);
  });
});
