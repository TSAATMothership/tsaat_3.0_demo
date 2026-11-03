import { securityDomainFilter } from "@/lib/security-domain.mjs";
import { DiscoveryOverview } from "@/components/discovery-overview";
import { buildDiscoveryOverview } from "@/lib/discovery-overview";
import { initialDiscoveryFilters } from "@/lib/discovery-explorer-links";
import { emptyEndpointFilters, parseEndpointFilters } from "@/lib/endpoint-explorer";
import { emptySoftwareFilters, parseSoftwareFilters } from "@/lib/installed-software-explorer";
import { emptyShadowFilters, parseShadowFilters } from "@/lib/shadow-it-explorer";
import { emptyDiscoveryComplianceFilters, parseDiscoveryComplianceFilters } from "@/lib/discovery-compliance-explorer";
import { applyAssetFilters, parseFilters } from "@/lib/selectors";
import { DiscoveryCoverageCiTotals } from "@/components/discovery-coverage-ci-totals";
import { DiscoveryCoverageByToolSection } from "@/components/discovery-coverage-by-tool-section";
import { DiscoveryComplianceExplorer } from "@/components/discovery-compliance-explorer";
import { buildDiscoveryComplianceRows } from "@/lib/discovery-compliance-explorer";
import { FilterBar } from "@/components/filter-bar";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { getCoreAppData } from "@/lib/app-data";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { filterDiscoveryAssets, removeUnassignedNetworkOption, sanitizeDiscoverySearchParams } from "@/lib/discovery-filter-scope";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { EndpointExplorer } from "@/components/endpoint-explorer";
import { InstalledSoftwareExplorer } from "@/components/installed-software-explorer";
import { SecurityVulnerabilityExplorer } from "@/components/security-vulnerability-explorer";
import { PatchManagementExplorer } from "@/components/patch-management-explorer";
import { parsePatchFilters } from "@/lib/patch-management-explorer";
import { loadPatchManagementExplorerData } from "@/lib/data-loader";
import { parseVulnerabilityFilters } from "@/lib/security-vulnerability-explorer";
import { emptyExplorerTableFilters } from "@/lib/explorer-table";
import { loadSecurityVulnerabilityExplorerData } from "@/lib/data-loader";
import { ShadowItExplorer } from "@/components/shadow-it-explorer";
import { loadDatasetForDate, loadDiscoveryToolsSettings, loadEndpointExplorerData, loadInstalledSoftwareExplorerData, loadShadowItExplorerData } from "@/lib/data-loader";
import { scopeIds } from "@/lib/workspace-navigation";

const pendingDiscoveryViews: Record<string, string> = {
  "target-state": "Target State Analyser"
};

export default async function DiscoveryCoveragePage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  if (!hasWorkspaceScope(searchParams)) return <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />;
  const requestedView = Array.isArray(searchParams.discoveryView) ? searchParams.discoveryView[0] : searchParams.discoveryView;
  if (requestedView === "patch-management") {
    const data = await loadPatchManagementExplorerData(searchParams);
    const initialFilters = initialDiscoveryFilters(searchParams.discoveryFilters, parsePatchFilters, emptyExplorerTableFilters);
    return <><RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
      <PatchManagementExplorer initialFilters={initialFilters} key={JSON.stringify([data.snapshotDate, scopeIds(searchParams.network), scopeIds(searchParams.system), searchParams.securityDomain, initialFilters])}
        rows={data.rows} snapshotDate={data.snapshotDate}
        scope={{ network: scopeIds(searchParams.network), system: scopeIds(searchParams.system), securityDomain: securityDomainFilter(searchParams.securityDomain), dataDate: data.snapshotDate }} /></>;
  }
  if (requestedView === "security-vulnerabilities") {
    const data = await loadSecurityVulnerabilityExplorerData(searchParams);
    const initialFilters = initialDiscoveryFilters(searchParams.discoveryFilters, parseVulnerabilityFilters, emptyExplorerTableFilters);
    return <><RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
      <SecurityVulnerabilityExplorer key={JSON.stringify([data.snapshotDate, scopeIds(searchParams.network), scopeIds(searchParams.system), searchParams.securityDomain, initialFilters])}
        initialFilters={initialFilters} rows={data.rows} snapshotDate={data.snapshotDate}
        scope={{ network: scopeIds(searchParams.network), system: scopeIds(searchParams.system), securityDomain: securityDomainFilter(searchParams.securityDomain), dataDate: data.snapshotDate }} /></>;
  }
  if (requestedView === "overview") {
    // All summaries share the workspace scope, just like the inventory explorers.
    const scope = { network: scopeIds(searchParams.network), system: scopeIds(searchParams.system), securityDomain: securityDomainFilter(searchParams.securityDomain), dataDate: searchParams.dataDate };
    const selectedDate = Array.isArray(scope.dataDate) ? scope.dataDate[0] : scope.dataDate;
    const [dataset, settings] = await Promise.all([
      loadDatasetForDate(selectedDate, { profile: "summary" }), loadDiscoveryToolsSettings()
    ]);
    const snapshotScope = { ...scope, dataDate: dataset.snapshotDate };
    const [endpoints, software, shadow, vulnerabilities, patches] = await Promise.all([
      loadEndpointExplorerData(snapshotScope), loadInstalledSoftwareExplorerData(snapshotScope), loadShadowItExplorerData(snapshotScope),
      loadSecurityVulnerabilityExplorerData(snapshotScope), loadPatchManagementExplorerData(snapshotScope)
    ]);
    const assets = filterDiscoveryAssets(applyAssetFilters(dataset.assets, dataset.ictSystems, parseFilters(snapshotScope)));
    const coverage = buildScopedDiscoveryToolCoverage(assets, settings, dataset.discoveryCoverageEvaluations);
    const model = buildDiscoveryOverview({ coverage, endpoints: endpoints.rows, software: software.rows, shadow: shadow.rows,
      vulnerabilities: vulnerabilities.rows, patches: patches.rows, snapshotDate: dataset.snapshotDate });
    return <><RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} /><DiscoveryOverview model={model} scope={snapshotScope} /></>;
  }
  if (requestedView === "shadow-it") {
    const data = await loadShadowItExplorerData(searchParams);
    const initialFilters = initialDiscoveryFilters(searchParams.discoveryFilters, parseShadowFilters, emptyShadowFilters);
    const selectedDate = Array.isArray(searchParams.dataDate) ? searchParams.dataDate[0] : searchParams.dataDate;
    return <>
      <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
      <ShadowItExplorer initialFilters={initialFilters} key={JSON.stringify([data.snapshotDate, scopeIds(searchParams.network), scopeIds(searchParams.system), searchParams.securityDomain, initialFilters])}
        rows={data.rows} snapshotDate={data.snapshotDate} scope={{ network: scopeIds(searchParams.network), system: scopeIds(searchParams.system), securityDomain: securityDomainFilter(searchParams.securityDomain), dataDate: selectedDate ?? data.snapshotDate }} />
    </>;
  }
  if (requestedView === "installed-software") {
    const data = await loadInstalledSoftwareExplorerData(searchParams);
    const initialFilters = initialDiscoveryFilters(searchParams.discoveryFilters, parseSoftwareFilters, emptySoftwareFilters);
    const selectedDate = Array.isArray(searchParams.dataDate) ? searchParams.dataDate[0] : searchParams.dataDate;
    return <>
      <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
      <InstalledSoftwareExplorer initialFilters={initialFilters} key={JSON.stringify([data.snapshotDate, scopeIds(searchParams.network), scopeIds(searchParams.system), searchParams.securityDomain, initialFilters])}
        rows={data.rows} snapshotDate={data.snapshotDate} scope={{ network: scopeIds(searchParams.network), system: scopeIds(searchParams.system), securityDomain: securityDomainFilter(searchParams.securityDomain), dataDate: selectedDate ?? data.snapshotDate }} />
    </>;
  }
  if (requestedView === "endpoints") {
    const data = await loadEndpointExplorerData(searchParams);
    const initialFilters = initialDiscoveryFilters(searchParams.discoveryFilters, parseEndpointFilters, emptyEndpointFilters);
    const selectedDate = Array.isArray(searchParams.dataDate) ? searchParams.dataDate[0] : searchParams.dataDate;
    return <>
      <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
      <EndpointExplorer initialFilters={initialFilters} key={JSON.stringify([data.snapshotDate, scopeIds(searchParams.network), scopeIds(searchParams.system), searchParams.securityDomain, initialFilters])}
        rows={data.rows} snapshotDate={data.snapshotDate} scope={{ network: scopeIds(searchParams.network), system: scopeIds(searchParams.system), securityDomain: securityDomainFilter(searchParams.securityDomain), dataDate: selectedDate ?? data.snapshotDate }} />
    </>;
  }
  if (requestedView && Object.hasOwn(pendingDiscoveryViews, requestedView)) {
    return <div className="workspace-page">
      <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
      <section className="panel shrink-0 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Discovery</p>
        <h1 className="mt-1 text-2xl font-semibold">{pendingDiscoveryViews[requestedView]}</h1>
      </section>
      <section className="panel p-5"><p className="text-sm text-slate-300">This view is not available yet.</p></section>
    </div>;
  }
  const view = requestedView === "compliance" ? "compliance" : "tools";
  const title = { compliance: "Discovery Compliance Explorer", tools: "Discovery Tool Coverage" }[view];
  const discoveryDataSearchParams = sanitizeDiscoverySearchParams(searchParams);
  delete discoveryDataSearchParams.criticality;
  const { dataset, analytics, filters, filterOptions, discoveryToolsSettings } = await getCoreAppData(discoveryDataSearchParams, { profile: "summary" });
  const discoveryFilterOptions = removeUnassignedNetworkOption(filterOptions);
  const scopedAssetIds = new Set(analytics.evaluations.map((evaluation) => evaluation.assetId));
  const scopedAssets = filterDiscoveryAssets(dataset.assets.filter((asset) => scopedAssetIds.has(asset.id)));
  const coverageModel = buildScopedDiscoveryToolCoverage(scopedAssets, discoveryToolsSettings, dataset.discoveryCoverageEvaluations);
  const coverageRows = scopedAssets.map((asset) => ({ asset, coverage: coverageModel.assetCoverageById.get(asset.id)! }));
  const toolStats = coverageModel.toolCards;
  const compliantCount = coverageRows.filter(({ coverage }) => coverage.coverageCompliance).length;
  const applicableSlots = toolStats.reduce((sum, tool) => sum + tool.applicable, 0);
  const coveredSlots = toolStats.reduce((sum, tool) => sum + tool.covered, 0);
  const overallToolCoveragePercent = applicableSlots ? (coveredSlots / applicableSlots * 100).toFixed(1) : "0";
  const complianceRows = buildDiscoveryComplianceRows(scopedAssets, coverageModel.assetCoverageById, dataset);

  return <div className={view === "tools" ? "workspace-page coverage-explorer" : "workspace-page endpoint-explorer discovery-compliance-page"}>
    <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
    <header className="endpoint-hero">
      <div><p className="endpoint-eyebrow">Discovery / {view === "compliance" ? "Compliance" : "Tool coverage"}</p><h1>{title}</h1><p className="endpoint-description">{view === "compliance" ? "Find, filter and inspect CI discovery compliance and missing tool coverage." : "Compare discovery tools and investigate assets with missing coverage."}</p></div>
      <div className="endpoint-total"><span>{view === "compliance" ? "Total records in scope" : "Discovery tools"}</span><strong>{(view === "compliance" ? complianceRows.length : toolStats.length).toLocaleString("en-AU")}</strong><small>Snapshot · {dataset.snapshotDate}</small></div>
    </header>
    <FilterBar options={discoveryFilterOptions} filters={filters} hiddenFields={["systemCriticality"]} enableLoadingOverlay className="panel no-print flex shrink-0 flex-wrap gap-3 p-3" />
    <div id="discovery-coverage-summary-slideout-scope" className="relative flex min-h-0 flex-1 flex-col gap-3">
      {view === "tools" && <section className="coverage-snapshot grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Coverage Snapshot">
        {[{ label: "Total Assets In Scope", value: coverageRows.length }, { label: "Coverage Compliant Assets", value: compliantCount }, { label: "Assets With Coverage Gaps", value: coverageRows.length - compliantCount }, { label: "Overall Tool Coverage", value: `${overallToolCoveragePercent}%` }].map((card) => <div className="panel p-4" key={card.label}><p className="text-[11px] uppercase tracking-wider text-slate-400">{card.label}</p><p className="mt-2 text-2xl font-semibold text-sky-100">{card.value}</p></div>)}</section>}
      {view === "tools" && <DiscoveryCoverageCiTotals totals={coverageModel.ciTypeTotals} />}
      {view === "tools" ? <DiscoveryCoverageByToolSection
        key={`${view}:${JSON.stringify(discoveryDataSearchParams)}:${discoveryToolsSettings.updatedAt}`} variant="explorer"
        toolStats={toolStats} slideoutScopeId="discovery-coverage-summary-slideout-scope" className="min-h-0 flex-1" />
        : <DiscoveryComplianceExplorer initialFilters={initialDiscoveryFilters(searchParams.discoveryFilters, parseDiscoveryComplianceFilters, emptyDiscoveryComplianceFilters)} key={`${JSON.stringify(discoveryDataSearchParams)}:${dataset.snapshotDate}:${discoveryToolsSettings.updatedAt}`} rows={complianceRows} snapshotDate={dataset.snapshotDate} scope={discoveryDataSearchParams} />}
    </div>
  </div>;
}
