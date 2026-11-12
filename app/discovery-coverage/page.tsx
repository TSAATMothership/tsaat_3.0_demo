import { securityDomainFilter } from "@/lib/security-domain.mjs";
import { initialDiscoveryFilters } from "@/lib/discovery-explorer-links";
import { emptyEndpointFilters, parseEndpointFilters } from "@/lib/endpoint-explorer";
import { emptySoftwareFilters, parseSoftwareFilters } from "@/lib/installed-software-explorer";
import { emptyShadowFilters, parseShadowFilters } from "@/lib/shadow-it-explorer";
import { RouteReadyMarker } from "@/components/route-ready-marker";
import { hasWorkspaceScope, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { EndpointExplorer } from "@/components/endpoint-explorer";
import { InstalledSoftwareExplorer } from "@/components/installed-software-explorer";
import { InstalledSoftwareDashboard } from "@/components/installed-software-insights";
import { buildInstalledSoftwareInsights } from "@/lib/installed-software-insights";
import { workspaceHref } from "@/lib/workspace-navigation";
import { SecurityVulnerabilityExplorer } from "@/components/security-vulnerability-explorer";
import { parseVulnerabilityFilters } from "@/lib/security-vulnerability-explorer";
import { emptyExplorerTableFilters } from "@/lib/explorer-table";
import { loadSecurityVulnerabilityExplorerData } from "@/lib/data-loader";
import { ShadowItExplorer } from "@/components/shadow-it-explorer";
import { loadEndpointExplorerData, loadInstalledSoftwareExplorerData, loadShadowItExplorerData } from "@/lib/data-loader";
import { scopeIds } from "@/lib/workspace-navigation";
import { TopologyExplorer } from "@/components/topology-explorer";
import { loadTopologyExplorer } from "@/lib/topology-explorer-data";

import { RetiredFeature } from "@/components/retired-feature";

export default async function DiscoveryCoveragePage({ searchParams }: { searchParams: WorkspaceSearchParams }) {
  const requestedView = (Array.isArray(searchParams.discoveryView) ? searchParams.discoveryView[0] : searchParams.discoveryView) || "endpoints";
  if (["overview","tools","tools-2","tool-coverage","compliance","patch-management","life-cycle-management","target-state"].includes(requestedView))
    return <RetiredFeature pathname="/discovery-coverage" searchParams={searchParams} />;
  if (!hasWorkspaceScope(searchParams)) return <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />;
  if (requestedView === "topology") {
    const ready = <RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />;
    try {
      const model = await loadTopologyExplorer(searchParams);
      return <>{ready}<TopologyExplorer model={model} key={JSON.stringify([model.snapshotDate, scopeIds(searchParams.network), scopeIds(searchParams.system), searchParams.securityDomain])} /></>;
    } catch {
      const query = new URLSearchParams({ discoveryView: "topology" });
      for (const key of ["network", "system", "securityDomain", "dataDate", "topologyCi", "topologyAll", "topologyMode", "topology_filters", "topology_name", "topology_software", "topology_cve", "topology_ip", "topology_kind"]) {
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
  if (requestedView === "security-vulnerabilities") {
    const data = await loadSecurityVulnerabilityExplorerData(searchParams);
    const initialFilters = initialDiscoveryFilters(searchParams.discoveryFilters, parseVulnerabilityFilters, emptyExplorerTableFilters);
    return <><RouteReadyMarker pathname="/discovery-coverage" searchParams={searchParams} />
      <SecurityVulnerabilityExplorer key={JSON.stringify([data.snapshotDate, scopeIds(searchParams.network), scopeIds(searchParams.system), searchParams.securityDomain, initialFilters])}
        initialFilters={initialFilters} rows={data.rows} snapshotDate={data.snapshotDate}
        scope={{ network: scopeIds(searchParams.network), system: scopeIds(searchParams.system), securityDomain: securityDomainFilter(searchParams.securityDomain), dataDate: data.snapshotDate }} /></>;
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
  return <RetiredFeature pathname="/discovery-coverage" searchParams={searchParams} />;
}
