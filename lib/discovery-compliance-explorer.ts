import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { NOT_RECORDED } from "@/lib/endpoint-explorer";
import type { DiscoveryCoverageResult } from "@/lib/discovery-coverage";
import type { Asset, Dataset } from "@/lib/types";

export interface DiscoveryComplianceRecord {
  assetId: string;
  hostname: string;
  ipAddress: string;
  lastDiscoveredDate: string | null;
  discoveredBy: string | null;
  assetType: string;
  network: string;
  system: string;
  environment: string;
  compliant: boolean;
  coveredToolCount: number;
  applicableToolCount: number;
  missingTools: string[];
}

export const DISCOVERY_COMPLIANCE_COLUMNS = [
  { key: "hostname", label: "Name" },
  { key: "assetType", label: "CI Type" },
  { key: "ipAddress", label: "IP Address" },
  { key: "lastDiscoveredDate", label: "Last Discovered Date" },
  { key: "discoveredBy", label: "Discovered By" },
  { key: "network", label: "Managed Network" },
  { key: "system", label: "ICT System" },
  { key: "environment", label: "Environment" },
  { key: "compliant", label: "Compliance" },
  { key: "missingTools", label: "Missing Tools" }
] as const;
export type DiscoveryComplianceColumn = typeof DISCOVERY_COMPLIANCE_COLUMNS[number]["key"];
export interface DiscoveryComplianceFilters {
  search: string;
  columns: Partial<Record<DiscoveryComplianceColumn, string[]>>;
}
export const emptyDiscoveryComplianceFilters = (): DiscoveryComplianceFilters => ({ search: "", columns: {} });

export function discoveryComplianceValue(row: DiscoveryComplianceRecord, key: DiscoveryComplianceColumn): string {
  if (key === "compliant") return row.compliant ? "Compliant" : "Coverage gaps";
  if (key === "missingTools") return row.missingTools.join(", ") || "None";
  if (key === "assetType") return formatAssetTypeLabel(row.assetType);
  const value = row[key]?.trim();
  if (!value) return NOT_RECORDED;
  // Match Endpoint Explorer: group recorded discovery timestamps by UTC date.
  return key === "lastDiscoveredDate" ? value.slice(0, 10) : value;
}

function columnValues(row: DiscoveryComplianceRecord, key: DiscoveryComplianceColumn): string[] {
  return key === "missingTools" && row.missingTools.length ? [...new Set(row.missingTools)] : [discoveryComplianceValue(row, key)];
}

export function filterDiscoveryComplianceRows(rows: readonly DiscoveryComplianceRecord[], filters: DiscoveryComplianceFilters, except?: DiscoveryComplianceColumn): DiscoveryComplianceRecord[] {
  const query = filters.search.trim().toLocaleLowerCase();
  return rows.filter((row) => (!query || [row.assetId, ...DISCOVERY_COMPLIANCE_COLUMNS.map(({ key }) => discoveryComplianceValue(row, key))]
    .join(" ").toLocaleLowerCase().includes(query)) && DISCOVERY_COMPLIANCE_COLUMNS.every(({ key }) =>
    key === except || !filters.columns[key]?.length || columnValues(row, key).some((value) => filters.columns[key]!.includes(value))));
}

export function discoveryComplianceFacets(rows: readonly DiscoveryComplianceRecord[], filters: DiscoveryComplianceFilters) {
  return Object.fromEntries(DISCOVERY_COMPLIANCE_COLUMNS.map(({ key }) => {
    const counts = new Map<string, number>();
    for (const row of filterDiscoveryComplianceRows(rows, filters, key)) {
      for (const value of columnValues(row, key)) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [key, [...counts].map(([value, count]) => ({ value, count }))];
  })) as Record<DiscoveryComplianceColumn, Array<{ value: string; count: number }>>;
}

export function discoveryComplianceSummary(rows: readonly DiscoveryComplianceRecord[], filters: DiscoveryComplianceFilters) {
  // Status totals act like the Compliance column facet, retaining all other filters.
  const summaryRows = filterDiscoveryComplianceRows(rows, filters, "compliant");
  const compliant = summaryRows.filter((row) => row.compliant).length;
  const matching = filterDiscoveryComplianceRows(rows, filters);
  const covered = matching.reduce((sum, row) => sum + row.coveredToolCount, 0);
  const applicable = matching.reduce((sum, row) => sum + row.applicableToolCount, 0);
  return {
    total: summaryRows.length,
    compliant,
    gaps: summaryRows.length - compliant,
    coveragePercent: applicable ? Number((covered / applicable * 100).toFixed(1)) : 0
  };
}

export function parseDiscoveryComplianceFilters(input: unknown): DiscoveryComplianceFilters {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid filters.");
  const value = input as Record<string, unknown>;
  if (typeof value.search !== "string" || value.search.length > 500) throw new Error("Invalid search.");
  if (!value.columns || typeof value.columns !== "object" || Array.isArray(value.columns)) throw new Error("Invalid columns.");
  const columns: DiscoveryComplianceFilters["columns"] = {};
  for (const [key, values] of Object.entries(value.columns)) {
    if (!DISCOVERY_COMPLIANCE_COLUMNS.some((column) => column.key === key) || !Array.isArray(values) || values.length > 10000 ||
      !values.every((item) => typeof item === "string" && item.length <= 1024)) throw new Error("Invalid column selection.");
    columns[key as DiscoveryComplianceColumn] = [...new Set(values as string[])];
  }
  return { search: value.search, columns };
}

export function buildDiscoveryComplianceRows(assets: Asset[], coverageById: Map<string, DiscoveryCoverageResult>, dataset: Pick<Dataset, "managedNetworks" | "ictSystems">): DiscoveryComplianceRecord[] {
  const networkNames = new Map(dataset.managedNetworks.map((network) => [network.id, network.name]));
  const systemNames = new Map(dataset.ictSystems.map((system) => [system.id, system.name]));
  return assets.map((asset) => {
    const coverage = coverageById.get(asset.id)!;
    const source = asset as Asset & { ipAddress?: string; ip?: string; ipv4?: string; ipv4Address?: string; primaryIp?: string };
    return {
      assetId: asset.id, hostname: asset.hostname || asset.name,
      ipAddress: source.ipAddress || source.ip || source.ipv4 || source.ipv4Address || source.primaryIp || "",
      lastDiscoveredDate: asset.lastDiscoveredDate ?? null, discoveredBy: asset.discoveredBy ?? null,
      assetType: asset.type, network: networkNames.get(asset.networkId) ?? asset.networkId,
      system: systemNames.get(asset.systemContext?.systemId ?? "") ?? "Unassigned",
      environment: asset.systemContext?.environmentType ?? "", compliant: coverage.coverageCompliance,
      coveredToolCount: Object.values(coverage.toolValues).filter((value) => value === 1).length,
      applicableToolCount: Object.values(coverage.toolValues).filter((value) => value === 0 || value === 1).length,
      missingTools: coverage.missingToolNames
    };
  }).sort((a, b) => a.hostname.localeCompare(b.hostname));
}
