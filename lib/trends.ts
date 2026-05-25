import { buildAnalytics } from "@/lib/analytics";
import { defaultDiscoveryToolsSettings, DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { MeasuresSettings } from "@/lib/measures-settings";
import { SpiDefinition } from "@/lib/spi-definitions";
import { Dataset, Filters, TrendPoint } from "@/lib/types";

export function buildTrendPoints(
  snapshots: Dataset[],
  filters: Filters,
  spiDefinitions: SpiDefinition[],
  measuresSettings: MeasuresSettings,
  discoveryToolsSettings: DiscoveryToolsSettings = defaultDiscoveryToolsSettings()
): TrendPoint[] {
  return snapshots.map((snapshot, index) => {
    const analytics = buildAnalytics(snapshot, snapshot.ictSystems, filters, spiDefinitions, measuresSettings, discoveryToolsSettings);
    const highRiskCount = analytics.findings.filter((finding) => finding.severity === "High Risk").length;
    const criticalExposureCount = analytics.findings.filter(
      (finding) => finding.severity === "Critical Exposure"
    ).length;
    const immediateActionCount = analytics.findings.filter((finding) => finding.priorityRank <= 2).length;

    return {
      weekLabel: `W${String(index + 1).padStart(2, "0")}`,
      snapshotDate: snapshot.snapshotDate,
      compliancePercent: analytics.overallCompliancePercent,
      nonCompliantCount: analytics.statusTotals.nonCompliant,
      unknownCount: analytics.statusTotals.unknown,
      highRiskCount,
      criticalExposureCount,
      immediateActionCount
    };
  });
}

export interface ChangeSummary {
  improved: number;
  worsened: number;
  unchanged: number;
}

export interface NetworkP12TrendSeries {
  networkId: string;
  networkName: string;
  points: Array<{
    weekLabel: string;
    snapshotDate: string;
    count: number;
  }>;
  latestCount: number;
  deltaFromPrevious: number;
}

export function buildNetworkP12TrendSeries(
  snapshots: Dataset[],
  networks: Array<{ id: string; name: string }>,
  filters: Filters,
  spiDefinitions: SpiDefinition[],
  measuresSettings: MeasuresSettings,
  lookbackWeeks = 12,
  discoveryToolsSettings: DiscoveryToolsSettings = defaultDiscoveryToolsSettings()
): NetworkP12TrendSeries[] {
  const scopedSnapshots = snapshots.slice(-lookbackWeeks);
  const globalScopeFilters: Filters = {
    ...filters,
    managedNetwork: undefined
  };

  const pointRows = scopedSnapshots.map((snapshot, index) => {
    const analytics = buildAnalytics(
      snapshot,
      snapshot.ictSystems,
      globalScopeFilters,
      spiDefinitions,
      measuresSettings,
      discoveryToolsSettings
    );
    const p12Findings = analytics.findings.filter((finding) => finding.priorityRank <= 2);

    const countByNetwork = p12Findings.reduce((map, finding) => {
      map.set(finding.scope.networkId, (map.get(finding.scope.networkId) ?? 0) + 1);
      return map;
    }, new Map<string, number>());

    return {
      weekLabel: `W${String(scopedSnapshots.length - index).padStart(2, "0")}`,
      snapshotDate: snapshot.snapshotDate,
      countByNetwork
    };
  });

  return networks.map((network) => {
    const points = pointRows.map((row) => ({
      weekLabel: row.weekLabel,
      snapshotDate: row.snapshotDate,
      count: row.countByNetwork.get(network.id) ?? 0
    }));

    const latestCount = points[points.length - 1]?.count ?? 0;
    const previousCount = points[points.length - 2]?.count ?? latestCount;

    return {
      networkId: network.id,
      networkName: network.name,
      points,
      latestCount,
      deltaFromPrevious: latestCount - previousCount
    };
  });
}

export function compareSnapshotCompliance(previous: Dataset, current: Dataset): ChangeSummary {
  const previousAssets = new Map(previous.assets.map((asset) => [asset.id, asset]));
  let improved = 0;
  let worsened = 0;
  let unchanged = 0;

  for (const asset of current.assets) {
    const older = previousAssets.get(asset.id);
    if (!older) {
      worsened += 1;
      continue;
    }

    const oldCritical = older.vulnerabilities.filter((v) => v.severity === "Critical").length;
    const newCritical = asset.vulnerabilities.filter((v) => v.severity === "Critical").length;

    if (newCritical < oldCritical) {
      improved += 1;
    } else if (newCritical > oldCritical) {
      worsened += 1;
    } else {
      unchanged += 1;
    }
  }

  return { improved, worsened, unchanged };
}
