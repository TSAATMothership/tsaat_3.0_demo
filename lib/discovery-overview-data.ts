import { loadDatasetForDate, loadDiscoveryToolsSettings, loadEndpointExplorerData, loadInstalledSoftwareExplorerData, loadShadowItExplorerData, loadSecurityVulnerabilityExplorerData, loadPatchManagementExplorerData } from "@/lib/data-loader";
import { buildDiscoveryOverview } from "@/lib/discovery-overview";
import { filterDiscoveryAssets } from "@/lib/discovery-filter-scope";
import { applyAssetFilters, parseFilters } from "@/lib/selectors";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { securityDomainFilter, securityDomainSelection } from "@/lib/security-domain.mjs";
import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";

/** The page and PDF resolve one snapshot, then use exactly the same provider operations. */
export async function loadDiscoveryOverview(searchParams: WorkspaceSearchParams) {
  const scope = { network: scopeIds(searchParams.network), system: scopeIds(searchParams.system),
    securityDomain: securityDomainFilter(searchParams.securityDomain), dataDate: searchParams.dataDate };
  const selectedDate = Array.isArray(scope.dataDate) ? scope.dataDate[0] : scope.dataDate;
  const [dataset, settings] = await Promise.all([loadDatasetForDate(selectedDate, { profile: "summary" }), loadDiscoveryToolsSettings()]);
  const snapshotScope = { ...scope, dataDate: dataset.snapshotDate };
  const [endpoints, software, shadow, vulnerabilities, patches] = await Promise.all([
    loadEndpointExplorerData(snapshotScope), loadInstalledSoftwareExplorerData(snapshotScope), loadShadowItExplorerData(snapshotScope),
    loadSecurityVulnerabilityExplorerData(snapshotScope), loadPatchManagementExplorerData(snapshotScope)
  ]);
  const assets = filterDiscoveryAssets(applyAssetFilters(dataset.assets, dataset.ictSystems, parseFilters(snapshotScope)));
  const coverage = buildScopedDiscoveryToolCoverage(assets, settings, dataset.discoveryCoverageEvaluations);
  const model = buildDiscoveryOverview({ coverage, endpoints: endpoints.rows, software: software.rows, shadow: shadow.rows,
    vulnerabilities: vulnerabilities.rows, patches: patches.rows, snapshotDate: dataset.snapshotDate });
  const labels = (ids: string[], entities: Array<{ id: string; name: string }>) => ids.map(id => {
    const entity = entities.find(row => row.id === id); return entity ? entity.name + " (" + id + ")" : id + " (not present in snapshot)";
  });
  return { model, scope: snapshotScope,
    scopeLabels: { networks: labels(scope.network, dataset.managedNetworks), systems: labels(scope.system, dataset.ictSystems),
      domains: securityDomainSelection(scope.securityDomain) } };
}
export type DiscoveryOverviewData = Awaited<ReturnType<typeof loadDiscoveryOverview>>;
