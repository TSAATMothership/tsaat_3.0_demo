import { loadDatasetForDate, loadInstalledSoftwareExplorerData } from "@/lib/data-loader";
import { buildInstalledSoftwareInsights } from "@/lib/installed-software-insights";
import { securityDomainSelection } from "@/lib/security-domain.mjs";
import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

/** The visible briefing's scoped rows are authoritative; metadata is pinned to their resolved snapshot. */
export async function loadSoftwareInsightsReport(searchParams: WorkspaceSearchParams) {
  const scope = { network: scopeIds(searchParams.network), system: scopeIds(searchParams.system),
    securityDomain: searchParams.securityDomain, dataDate: searchParams.dataDate };
  const software = await loadInstalledSoftwareExplorerData(scope);
  const dataset = await loadDatasetForDate(software.snapshotDate, { profile: "summary" });
  if (dataset.snapshotDate !== software.snapshotDate) throw new Error("Software Insights snapshot mismatch");
  const labels = (ids: string[], entities: Array<{ id: string; name: string }>) => ids.map(id => {
    const entity = entities.find(row => row.id === id);
    return entity ? `${entity.name} (${id})` : `${id} (not present in snapshot)`;
  });
  return { model: buildInstalledSoftwareInsights(software.rows, software.snapshotDate), snapshotGeneratedAt: dataset.generatedAt,
    scopeLabels: { networks: labels(scope.network, dataset.managedNetworks), systems: labels(scope.system, dataset.ictSystems),
      domains: securityDomainSelection(scope.securityDomain) } };
}
export type SoftwareInsightsReportData = Awaited<ReturnType<typeof loadSoftwareInsightsReport>>;
