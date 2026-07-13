import { afterEach, beforeEach, describe, expect, it } from "vitest";
import runtimeConfig from "../data/runtime-config.json";
import {
  __resetDataLoaderCachesForTest,
  loadCurrentDataset,
  loadDatasetForDate,
  loadDiscoveryToolsSettings,
  loadFindingDisplayConfiguration,
  loadFindingPriorityDefinitions,
  loadKpiDefinitions,
  loadMeasuresSettings,
  loadReferenceVersions,
  loadSeverityDefinitions,
  loadSnapshotEffectiveFindings,
  loadSnapshotKpiEvaluationsForScope,
  loadSpiDefinitions,
  saveDiscoveryToolsSettings,
  saveMeasuresSettings
} from "@/lib/data-loader";

describe("database-free demo data loader", () => {
  beforeEach(() => {
    __resetDataLoaderCachesForTest();
  });

  afterEach(() => {
    __resetDataLoaderCachesForTest();
  });

  it("selects exported snapshots by date and preserves load profiles", async () => {
    const earliest = await loadDatasetForDate("2020-01-01", { profile: "summary" });
    const firstWeek = await loadDatasetForDate("2026-03-10", { profile: "summary" });
    const latest = await loadDatasetForDate("2099-01-01", { profile: "full" });

    expect(earliest.snapshotId).toBe(1);
    expect(firstWeek.snapshotId).toBe(1);
    expect(latest.snapshotId).toBe(8);
    expect(earliest.assets).toHaveLength(1000);
    expect(earliest.assets.every((asset) => asset.vulnerabilities.length === 0)).toBe(true);
    expect(
      earliest.assets
        .filter((asset) => asset.type === "server" || asset.type === "workstation")
        .every((asset) => asset.installedSoftware.length === 0)
    ).toBe(true);
    expect(earliest.ciDependencies).toEqual([]);
    expect(latest.ciDependencies).toHaveLength(27441);

    const riskSummary = await loadDatasetForDate("2099-01-01", { profile: "risk-summary" });
    expect(riskSummary.assets.some((asset) => asset.vulnerabilities.length > 0)).toBe(true);
    expect(
      riskSummary.assets
        .filter((asset) => asset.type === "server" || asset.type === "workstation")
        .every((asset) => asset.installedSoftware.length === 0)
    ).toBe(true);
    expect(riskSummary.ciDependencies).toEqual([]);
  }, 30_000);

  it("loads every normalized runtime catalogue without losing tasking templates", async () => {
    const [
      versions,
      severities,
      priorities,
      findingConfiguration,
      spis,
      kpis,
      measures,
      discovery
    ] = await Promise.all([
      loadReferenceVersions(),
      loadSeverityDefinitions(),
      loadFindingPriorityDefinitions(),
      loadFindingDisplayConfiguration(),
      loadSpiDefinitions(),
      loadKpiDefinitions(),
      loadMeasuresSettings(),
      loadDiscoveryToolsSettings()
    ]);

    expect(Object.keys(versions.osCurrentMajor).length).toBeGreaterThan(0);
    expect(Object.keys(versions.softwareSupportMatrix).length).toBeGreaterThan(0);
    expect(severities).toHaveLength(5);
    expect(priorities).toHaveLength(8);
    expect(findingConfiguration.buckets).toHaveLength(10);
    expect(findingConfiguration).toEqual(runtimeConfig.findingDisplayConfiguration);
    expect(spis).toHaveLength(10);
    expect(spis[0]?.taskingConditions).toEqual(runtimeConfig.spiDefinitions[0]?.taskingConditions);
    expect(kpis).toHaveLength(10);
    expect(kpis[0]?.taskingConditions).toEqual(runtimeConfig.kpiDefinitions[0]?.taskingConditions);
    expect(kpis[0]?.taskingConditions.non_compliant).toContain("below target threshold");
    expect(Object.keys(measures.severityMatrix)).toHaveLength(60);
    expect(discovery.tools).toHaveLength(7);
  });

  it("recomputes finding workflow state for an as-of date", async () => {
    const dataset = await loadCurrentDataset({ profile: "risk-summary" });
    const closedFinding = dataset.findings?.find(
      (finding) =>
        finding.closedTimestamp &&
        finding.timestamp.slice(0, 10) < finding.closedTimestamp.slice(0, 10)
    );
    expect(closedFinding).toBeDefined();
    if (!closedFinding?.closedTimestamp || !dataset.snapshotId) {
      return;
    }

    const openedDate = closedFinding.timestamp.slice(0, 10);
    const closedDate = closedFinding.closedTimestamp.slice(0, 10);
    const onOpenedDate = await loadSnapshotEffectiveFindings(dataset.snapshotId, openedDate);
    const onClosedDate = await loadSnapshotEffectiveFindings(dataset.snapshotId, closedDate);

    expect(onOpenedDate.find((finding) => finding.id === closedFinding.id)?.status).toBe("open");
    expect(onClosedDate.find((finding) => finding.id === closedFinding.id)?.status).toBe("closed");
  }, 30_000);

  it("keeps Measures changes in memory and reapplies them to exported raw finding values", async () => {
    const initialDataset = await loadCurrentDataset({ profile: "risk-summary" });
    const target = initialDataset.findings?.find(
      (finding) => finding.complianceStatus === "Non-compliant"
    );
    expect(target).toBeDefined();
    if (!target) {
      return;
    }

    const asset = initialDataset.assets.find((candidate) => candidate.id === target.scope.assetId);
    expect(asset).toBeDefined();
    if (!asset) {
      return;
    }

    const settings = await loadMeasuresSettings();
    const severityKey = `${target.spiId}:${asset.type}`;
    const nextSeverity = settings.severityMatrix[severityKey] === "Moderate" ? "Major" : "Moderate";
    const nextPriority = settings.priorityMatrix[String(target.spiId)] === 7 ? 6 : 7;
    const saved = await saveMeasuresSettings({
      ...settings,
      severityMatrix: { ...settings.severityMatrix, [severityKey]: nextSeverity },
      priorityMatrix: { ...settings.priorityMatrix, [String(target.spiId)]: nextPriority }
    });
    const reloaded = await loadCurrentDataset({ profile: "risk-summary" });
    const remapped = reloaded.findings?.find((finding) => finding.id === target.id);

    expect(saved.severityMatrix[severityKey]).toBe(nextSeverity);
    expect(remapped?.severity).toBe(nextSeverity);
    expect(remapped?.priorityRank).toBe(nextPriority);
  }, 30_000);

  it("re-scopes captured discovery values when an asset type is not applicable", async () => {
    const initialDataset = await loadCurrentDataset({ profile: "summary" });
    const targetEvaluation = initialDataset.discoveryCoverageEvaluations?.find(
      (evaluation) => evaluation.missingToolIds.length > 0
    );
    expect(targetEvaluation).toBeDefined();
    if (!targetEvaluation) {
      return;
    }

    const asset = initialDataset.assets.find((candidate) => candidate.id === targetEvaluation.assetId);
    const toolId = targetEvaluation.missingToolIds[0];
    expect(asset).toBeDefined();
    if (!asset || !toolId) {
      return;
    }

    const settings = await loadDiscoveryToolsSettings();
    await saveDiscoveryToolsSettings({
      tools: settings.tools.map((tool) => ({
        id: tool.id,
        assetTypeScope: {
          ...tool.assetTypeScope,
          ...(tool.id === toolId ? { [asset.type]: "na" as const } : {})
        }
      }))
    });

    const reloaded = await loadCurrentDataset({ profile: "summary" });
    const rescoped = reloaded.discoveryCoverageEvaluations?.find(
      (evaluation) => evaluation.assetId === targetEvaluation.assetId
    );
    expect(rescoped?.toolValues[toolId]).toBeNull();
    expect(rescoped?.missingToolIds).not.toContain(toolId);
  }, 30_000);

  it("evaluates and caches all ten KPIs for an arbitrary offline scope", async () => {
    const dataset = await loadCurrentDataset({ profile: "full" });
    const definitions = await loadKpiDefinitions();
    const input = {
      snapshotId: dataset.snapshotId!,
      assetIds: dataset.assets.map((asset) => asset.id),
      systemIds: dataset.ictSystems.map((system) => system.id),
      networkIds: dataset.managedNetworks.map((network) => network.id),
      findings: dataset.findings ?? [],
      kpiDefinitions: definitions
    };
    const first = await loadSnapshotKpiEvaluationsForScope(input);
    const second = await loadSnapshotKpiEvaluationsForScope(input);

    expect(first).toHaveLength(10);
    expect(second).toBe(first);
    expect(first.map((evaluation) => evaluation.kpiId)).toEqual(
      definitions.map((definition) => definition.id)
    );
  }, 30_000);
});
