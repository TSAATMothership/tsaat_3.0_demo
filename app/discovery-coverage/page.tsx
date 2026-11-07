import { securityDomainFilter } from "@/lib/security-domain.mjs";
import { DiscoveryOverview } from "@/components/discovery-overview";
import { LifeCycleManagement } from "@/components/life-cycle-management";
import { loadLifeCycleManagement } from "@/lib/life-cycle-management-data";
import { loadDiscoveryOverview } from "@/lib/discovery-overview-data";
import { initialDiscoveryFilters } from "@/lib/discovery-explorer-links";
import { emptyEndpointFilters, parseEndpointFilters } from "@/lib/endpoint-explorer";
import { emptySoftwareFilters, parseSoftwareFilters } from "@/lib/installed-software-explorer";
import { emptyShadowFilters, parseShadowFilters } from "@/lib/shadow-it-explorer";
import { emptyDiscoveryComplianceFilters, parseDiscoveryComplianceFilters } from "@/lib/discovery-compliance-explorer";
import { DiscoveryCoverageCiTotals } from "@/components/discovery-coverage-ci-totals";
import { DiscoveryCoverageByToolSection } from "@/components/discovery-coverage-by-tool-section";
import { DiscoveryComplianceExplorer } from "@/components/discovery-compliance-explorer";
import { buildDiscoveryComplianceRows } from "@/lib/discovery-compliance-explorer";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { getCoreAppData } from "@/lib/app-data";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { filterDiscoveryAssets, sanitizeDiscoverySearchParams } from "@/lib/discovery-filter-scope";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { EndpointExplorer } from "@/components/endpoint-explorer";
import { InstalledSoftwareExplorer } from "@/components/installed-software-explorer";
import { InstalledSoftwareDashboard } from "@/components/installed-software-insights";
import { buildInstalledSoftwareInsights } from "@/lib/installed-software-insights";
import { workspaceHref } from "@/lib/workspace-navigation";
import { SecurityVulnerabilityExplorer } from "@/components/security-vulnerability-explorer";
import { PatchManagementExplorer } from "@/components/patch-management-explorer";
import { parsePatchFilters } from "@/lib/patch-management-explorer";
import { loadPatchManagementExplorerData } from "@/lib/data-loader";
import { parseVulnerabilityFilters } from "@/lib/security-vulnerability-explorer";
import { emptyExplorerTableFilters } from "@/lib/explorer-table";
import { loadSecurityVulnerabilityExplorerData } from "@/lib/data-loader";
import { ShadowItExplorer } from "@/components/shadow-it-explorer";
import { loadEndpointExplorerData, loadInstalledSoftwareExplorerData, loadShadowItExplorerData } from "@/lib/data-loader";
import { scopeIds } from "@/lib/workspace-navigation";
import { TopologyExplorer } from "@/components/topology-explorer";
import { loadTopologyExplorer } from "@/lib/topology-explorer-data";

const pendingDiscoveryViews: Record<string, string> = {
  "target-state": "Target State Analyser"
};

export default async function DiscoveryCoveragePage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  if (!hasWorkspaceScope(searchParams)) return <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />;
  const requestedView = Array.isArray(searchParams.discoveryView) ? searchParams.discoveryView[0] : searchParams.discoveryView;
  if (requestedView === "topology") {
    const ready = <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />;
    try {
      const model = await loadTopologyExplorer(searchParams);
      return <>{ready}<TopologyExplorer model={model} key={JSON.stringify([model.snapshotDate, scopeIds(searchParams.network), scopeIds(searchParams.system), searchParams.securityDomain])} /></>;
    } catch {
      const query = new URLSearchParams({ discoveryView: "topology" });
      for (const key of ["network", "system", "securityDomain", "dataDate", "topologyCi", "topologyMode", "topology_filters", "topology_name", "topology_software", "topology_cve", "topology_ip", "topology_kind"]) {
        const value = searchParams[key]; if (value) query.set(key, Array.isArray(value) ? value.join(",") : value);
      }
      return <>{ready}<section className="panel p-5" role="alert"><p className="endpoint-eyebrow">Discovery / Topology Explorer</p>
        <h1 className="mt-2 text-2xl font-semibold">Topology is temporarily unavailable</h1><p className="my-4 text-slate-300">The selected snapshot could not be loaded. Retry to refresh the CI inventory and relationships.</p>
        <a className="endpoint-export" href={`/discovery-coverage?${query}`}>Try again</a></section></>;
    }
  }
  if (requestedView === "installed-software-insights") {
    const ready = <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />;
    const scope = { network: searchParams.network, system: searchParams.system, securityDomain: searchParams.securityDomain, dataDate: searchParams.dataDate };
    try {
      const data = await loadInstalledSoftwareExplorerData(scope);
      const model = buildInstalledSoftwareInsights(data.rows, data.snapshotDate);
      return <>{ready}<InstalledSoftwareDashboard model={model} scope={scope}
        key={JSON.stringify([data.snapshotDate, scopeIds(scope.network), scopeIds(scope.system), scope.securityDomain])} /></>;
    } catch {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(scope)) if (value) query.set(key, Array.isArray(value) ? value.join(",") : value);
      return <>{ready}<section className="panel p-5" role="alert"><p className="endpoint-eyebrow">Discovery / Installed Software Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold">Software dashboard is temporarily unavailable</h1>
        <p className="my-4 text-slate-300">The selected software inventory could not be loaded. Retry to refresh the evidence.</p>
        <a className="endpoint-export" href={workspaceHref("/discovery-coverage?discoveryView=installed-software-insights", query)}>Try again</a></section></>;
    }
  }
  if (requestedView === "life-cycle-management") {
    const ready = <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />;
    try {
      const model = await loadLifeCycleManagement(searchParams);
      return <>{ready}<LifeCycleManagement model={model} key={JSON.stringify([model.snapshotDate, scopeIds(searchParams.network), scopeIds(searchParams.system), searchParams.securityDomain])} /></>;
    } catch {
      const query = new URLSearchParams({ discoveryView: "life-cycle-management" });
      for (const key of ["network", "system", "securityDomain", "dataDate"] as const) {
        const value = searchParams[key]; if (value) query.set(key, Array.isArray(value) ? value.join(",") : value);
      }
      return <>{ready}<section className="panel p-5" role="alert"><p className="endpoint-eyebrow">Discovery / Life Cycle Management</p>
        <h1 className="mt-2 text-2xl font-semibold">Lifecycle evidence is temporarily unavailable</h1><p className="my-4 text-slate-300">The selected inventory snapshot could not be loaded. Retry to refresh the evidence.</p>
        <a className="endpoint-export" href={`/discovery-coverage?${query}`}>Try again</a></section></>;
    }
  }
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
    const { model, scope: snapshotScope } = await loadDiscoveryOverview(searchParams);
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

  const discoveryDataSearchParams = sanitizeDiscoverySearchParams(searchParams);
  delete discoveryDataSearchParams.criticality;
  const { dataset, analytics, discoveryToolsSettings } = await getCoreAppData(discoveryDataSearchParams, { profile: "summary" });
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

  if (view === "compliance") return <><RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
    <DiscoveryComplianceExplorer initialFilters={initialDiscoveryFilters(searchParams.discoveryFilters, parseDiscoveryComplianceFilters, emptyDiscoveryComplianceFilters)} key={`${JSON.stringify(discoveryDataSearchParams)}:${dataset.snapshotDate}:${discoveryToolsSettings.updatedAt}`} rows={complianceRows} snapshotDate={dataset.snapshotDate} scope={discoveryDataSearchParams} /></>;

  return <div className="workspace-page coverage-explorer">
    <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
    <header className="endpoint-hero">
      <div><p className="endpoint-eyebrow">Discovery / Tool coverage</p><h1>Discovery Tool Coverage</h1><p className="endpoint-description">Compare discovery tools and investigate assets with missing coverage.</p></div>
      <div className="endpoint-total"><span>Discovery tools</span><strong>{toolStats.length.toLocaleString("en-AU")}</strong><small>Snapshot · {dataset.snapshotDate}</small></div>
    </header>
    <div id="discovery-coverage-summary-slideout-scope" className="relative flex min-h-0 flex-1 flex-col gap-3">
      <section className="coverage-snapshot grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Coverage Snapshot">
        {[{ label: "Total Assets In Scope", value: coverageRows.length }, { label: "Coverage Compliant Assets", value: compliantCount }, { label: "Assets With Coverage Gaps", value: coverageRows.length - compliantCount }, { label: "Overall Tool Coverage", value: `${overallToolCoveragePercent}%` }].map((card) => <div className="panel p-4" key={card.label}><p className="text-[11px] uppercase tracking-wider text-slate-400">{card.label}</p><p className="mt-2 text-2xl font-semibold text-sky-100">{card.value}</p></div>)}</section>
      <DiscoveryCoverageCiTotals totals={coverageModel.ciTypeTotals} />
      <DiscoveryCoverageByToolSection
        key={`${view}:${JSON.stringify(discoveryDataSearchParams)}:${discoveryToolsSettings.updatedAt}`} variant="explorer"
        toolStats={toolStats} slideoutScopeId="discovery-coverage-summary-slideout-scope" className="min-h-0 flex-1" />
    </div>
  </div>;
}
