import { type DiscoveryCoverageValue } from "@/lib/discovery-coverage";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";
import { resolveNetworkReferenceFields } from "@/lib/network-reference-fields";
import { filterRealNetworks } from "@/lib/network-scope";
import type { ManagedNetwork } from "@/lib/types";

export interface NetworkToolCoverage {
  toolId: string;
  toolName: string;
  covered: number;
  missing: number;
  applicable: number;
  coveragePercent: number;
}

export interface DiscoveryCoverageByNetworkRow {
  networkId: string;
  networkName: string;
  securityDomain?: string;
  modellingStatus: "Modelled" | "Not Modelled";
  discoveryEnabled: boolean;
  coverageAvailable: boolean;
  description?: string;
  owner?: string;
  atoNumber?: string;
  diisId?: string;
  diisUrl?: string;
  grcUrl?: string;
  assetCount?: number;
  overallCoveredSlots?: number;
  overallApplicableSlots?: number;
  overallCoveragePercent?: number;
  toolCoverage: NetworkToolCoverage[];
}

export interface DiscoveryCoverageByNetworkSourceRow {
  networkId: string;
  coverage: {
    toolValues: Record<string, DiscoveryCoverageValue>;
  };
}

export interface DiscoveryCoverageByNetworkToolColumn {
  key: string;
  label: string;
}

function trimText(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function buildAggregate(
  coverageRows: DiscoveryCoverageByNetworkSourceRow[],
  toolColumns: DiscoveryCoverageByNetworkToolColumn[]
) {
  return coverageRows.reduce(
    (map, row) => {
      const current = map.get(row.networkId) ?? {
        assetCount: 0,
        overallCoveredSlots: 0,
        overallApplicableSlots: 0,
        toolCoverage: new Map<string, { covered: number; missing: number; applicable: number }>()
      };
      current.assetCount += 1;

      for (const tool of toolColumns) {
        const value = row.coverage.toolValues[tool.key];
        if (value === null) {
          continue;
        }
        const toolCurrent = current.toolCoverage.get(tool.key) ?? { covered: 0, missing: 0, applicable: 0 };
        toolCurrent.applicable += 1;
        if (value === 1) {
          toolCurrent.covered += 1;
          current.overallCoveredSlots += 1;
        } else {
          toolCurrent.missing += 1;
        }
        current.overallApplicableSlots += 1;
        current.toolCoverage.set(tool.key, toolCurrent);
      }

      map.set(row.networkId, current);
      return map;
    },
    new Map<
      string,
      {
        assetCount: number;
        overallCoveredSlots: number;
        overallApplicableSlots: number;
        toolCoverage: Map<string, { covered: number; missing: number; applicable: number }>;
      }
    >()
  );
}

export function buildDiscoveryCoverageByNetworkRows({
  networks,
  coverageRows,
  toolColumns
}: {
  networks: ManagedNetwork[];
  coverageRows: DiscoveryCoverageByNetworkSourceRow[];
  toolColumns: DiscoveryCoverageByNetworkToolColumn[];
}): DiscoveryCoverageByNetworkRow[] {
  const aggregates = buildAggregate(coverageRows, toolColumns);

  return filterRealNetworks(networks)
    .map((network) => {
      const aggregate = aggregates.get(network.id);
      const discoveryEnabled = network.discoveryStatus === "Discovery Enabled";
      const coverageAvailable = discoveryEnabled && Boolean(aggregate);
      const details = resolveNetworkDetailFields(network);
      const referenceFields = resolveNetworkReferenceFields(network);
      const allowFallbackMetadata = discoveryEnabled;
      const storedAtoNumber = trimText(network.atoNumber);
      const storedDiisId = trimText(network.diisId);
      const storedDiisUrl = trimText(network.diisUrl);
      const storedGrcUrl = trimText(network.grcUrl);

      return {
        networkId: network.id,
        networkName: network.name,
        ...(trimText(network.classification) || allowFallbackMetadata
          ? { securityDomain: trimText(network.classification) ?? "Unknown" }
          : {}),
        modellingStatus: network.modellingStatus ? ("Modelled" as const) : ("Not Modelled" as const),
        discoveryEnabled,
        coverageAvailable,
        ...(trimText(network.description) || allowFallbackMetadata
          ? { description: trimText(network.description) ?? details.description }
          : {}),
        ...(trimText(network.owner) || allowFallbackMetadata ? { owner: trimText(network.owner) ?? details.owner } : {}),
        ...(allowFallbackMetadata
          ? { atoNumber: referenceFields.atoNumber }
          : storedAtoNumber
            ? { atoNumber: storedAtoNumber }
            : {}),
        ...(allowFallbackMetadata
          ? { diisId: referenceFields.diisId }
          : storedDiisId
            ? { diisId: storedDiisId }
            : {}),
        ...(storedDiisId && storedDiisUrl ? { diisUrl: storedDiisUrl } : referenceFields.diisHref ? { diisUrl: referenceFields.diisHref } : {}),
        ...(storedGrcUrl || allowFallbackMetadata ? { grcUrl: storedGrcUrl ?? details.grcUrl } : {}),
        ...(coverageAvailable && aggregate
          ? {
              assetCount: aggregate.assetCount,
              overallCoveredSlots: aggregate.overallCoveredSlots,
              overallApplicableSlots: aggregate.overallApplicableSlots,
              overallCoveragePercent: toPercent(aggregate.overallCoveredSlots, aggregate.overallApplicableSlots),
              toolCoverage: toolColumns.map((tool) => {
                const summary = aggregate.toolCoverage.get(tool.key) ?? {
                  covered: 0,
                  missing: 0,
                  applicable: 0
                };
                return {
                  toolId: tool.key,
                  toolName: tool.label,
                  covered: summary.covered,
                  missing: summary.missing,
                  applicable: summary.applicable,
                  coveragePercent: toPercent(summary.covered, summary.applicable)
                };
              })
            }
          : { toolCoverage: [] })
      };
    })
    .sort((a, b) => a.networkName.localeCompare(b.networkName));
}
