import Link from "next/link";
import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { discoveryExplorerHref } from "@/lib/discovery-explorer-links";
import { STALE_DISCOVERY_AGES, type DiscoveryOverviewModel } from "@/lib/discovery-overview";
import { NOT_RECORDED, type EndpointFilters, type DiscoveryAge } from "@/lib/endpoint-explorer";
import type { SoftwareFilters } from "@/lib/installed-software-explorer";
import type { ShadowFilters } from "@/lib/shadow-it-explorer";
import type { DiscoveryComplianceFilters } from "@/lib/discovery-compliance-explorer";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

const number = (value: number) => value.toLocaleString("en-AU");
function Arrow() { return <span aria-hidden="true">↗</span>; }
function Finding({ label, count, href, unit }: { label: string; count: number; href: string; unit?: string }) {
  return <Link prefetch={false} href={href} className="discovery-overview-finding"><span>{label}</span><strong>{number(count)}{unit && <small> {unit}</small>}</strong><Arrow /></Link>;
}

export function DiscoveryOverview({ model, scope }: { model: DiscoveryOverviewModel; scope: WorkspaceSearchParams }) {
  const { coverage, endpoints, software, shadow, snapshotDate } = model;
  const complianceLink = (columns: DiscoveryComplianceFilters["columns"] = {}) => discoveryExplorerHref("compliance", scope, snapshotDate, { search: "", columns });
  const endpointLink = (columns: EndpointFilters["columns"] = {}, recency: DiscoveryAge[] = []) => discoveryExplorerHref("endpoints", scope, snapshotDate, { search: "", columns, recency });
  const softwareLink = (columns: SoftwareFilters["columns"] = {}, recency: DiscoveryAge[] = []) => discoveryExplorerHref("installed-software", scope, snapshotDate, { search: "", columns, recency });
  const shadowLink = (columns: ShadowFilters["columns"] = {}, recency: DiscoveryAge[] = []) => discoveryExplorerHref("shadow-it", scope, snapshotDate, { search: "", columns, recency });
  const toolsLink = discoveryExplorerHref("tools", scope, snapshotDate);
  const gapsLink = complianceLink({ compliant: ["Coverage gaps"] });
  const staleEndpointsLink = endpointLink({}, STALE_DISCOVERY_AGES);
  const versionLink = softwareLink({ softwareVersion: [NOT_RECORDED] });
  const actions = [
    { title: "Close required tool coverage gaps", detail: "Inspect missing tools for each CI and restore discovery coverage.", count: coverage.gaps, unit: "CIs", href: gapsLink },
    { title: "Identify unknown IP nodes", detail: "Use IP scan and ARP evidence to investigate unidentified devices.", count: shadow.total, unit: "IP nodes", href: shadowLink() },
    { title: "Refresh older endpoint discoveries", detail: "Review discoveries more than 30 days before the snapshot.", count: endpoints.stale, unit: "endpoints", href: staleEndpointsLink },
    { title: "Resolve missing discovery dates", detail: "Check collection evidence where the discovery date is missing.", count: endpoints.undated, unit: "endpoints", href: endpointLink({}, [NOT_RECORDED]) },
    { title: "Complete software version evidence", detail: "Review software installations with no recorded version.", count: software.missingVersion, unit: "installations", href: versionLink }
  ].filter((action) => action.count > 0);

  return <div className="workspace-page discovery-overview">
    <header className="endpoint-hero discovery-overview-hero">
      <div><h1>Discovery Overview</h1><div className="discovery-overview-context"><span><strong>{number(coverage.total)}</strong> CIs in scope</span><span><strong>{number(coverage.tools.length)}</strong> applicable tools</span><span>Select a finding to investigate</span></div></div>
      <div className="discovery-overview-snapshot"><span>Snapshot</span><strong>{snapshotDate}</strong></div>
    </header>

    <section className="discovery-overview-metrics" aria-label="Discovery findings at a glance">
      {[
        { label: "CIs with coverage gaps", value: coverage.gaps, note: `${number(coverage.missingChecks)} missing tool-to-CI checks`, href: gapsLink, tone: "amber" },
        { label: "Endpoints last seen >30 days ago", value: endpoints.stale, note: `${number(endpoints.undated)} without a discovery date`, href: staleEndpointsLink, tone: "cyan" },
        { label: "Software with no version", value: software.missingVersion, note: `Out of ${number(software.total)} recorded installations`, href: versionLink, tone: "violet" },
        { label: "Unidentified IP nodes", value: shadow.total, note: `${number(shadow.ipScan)} IP scan / ${number(shadow.arp)} ARP table`, href: shadowLink(), tone: "teal" }
      ].map((metric) => <Link prefetch={false} key={metric.label} href={metric.href} className={`discovery-overview-metric tone-${metric.tone}`}><strong>{number(metric.value)}</strong><div><span>{metric.label}</span><small>{metric.note}</small></div><Arrow /></Link>)}
    </section>

    <div className="discovery-overview-primary">
      <section className="discovery-overview-panel" aria-labelledby="overview-coverage-title">
        <header><h2 id="overview-coverage-title">Tool coverage & compliance</h2><Link prefetch={false} href={toolsLink}>Tool coverage <Arrow /></Link></header>
        <div className="discovery-overview-coverage-total"><strong>{coverage.percent === null ? "N/A" : `${coverage.percent}%`}</strong><span>required tool coverage</span><p>{number(coverage.coveredChecks)} / {number(coverage.applicableChecks)} checks covered</p></div>
        <div className="discovery-overview-statuses"><Link prefetch={false} href={complianceLink({ compliant: ["Compliant"] })}><i className="status-covered" /><strong>{number(coverage.compliant)}</strong> compliant CIs <Arrow /></Link><Link prefetch={false} href={gapsLink}><i className="status-gap" /><strong>{number(coverage.gaps)}</strong> CIs with gaps <Arrow /></Link></div>
        {coverage.unmapped > 0 && <p className="discovery-overview-note">{number(coverage.unmapped)} CIs have no applicable tool mapping. They are included in compliant CIs because no tool is required, and excluded from the coverage percentage.</p>}
        {coverage.tools.length > 0 ? <div className="discovery-overview-table-scroll"><table className="discovery-overview-tools"><caption className="sr-only">Required tool coverage, ordered by missing CIs</caption><thead><tr><th scope="col">Discovery tool</th><th scope="col">Covered / applicable CIs</th><th scope="col">Missing CIs</th></tr></thead><tbody>{coverage.tools.map((tool) => <tr key={tool.id}><th scope="row">{tool.label}</th><td><div className="discovery-overview-tool-count"><span>{number(tool.covered)} / {number(tool.applicable)}</span><strong>{tool.coveragePercent}%</strong></div><progress aria-label={`${tool.label} coverage`} value={tool.coveragePercent} max={100} /></td><td><Link prefetch={false} href={complianceLink({ missingTools: [tool.label] })} aria-label={`Inspect ${number(tool.missing)} CIs missing ${tool.label}`}>{number(tool.missing)} <Arrow /></Link></td></tr>)}</tbody></table></div>
          : <p className="discovery-overview-empty">{coverage.total ? "No discovery tools map to the CI types in this scope. Review Discovery Tools Settings to define the required coverage." : "No CIs are recorded for the selected scope and snapshot."}</p>}
        {coverage.ciTypes.length > 0 && <details className="discovery-overview-ci-types"><summary>CI types used in the calculations</summary><dl>{coverage.ciTypes.map((row) => <div key={row.type}><dt>{formatAssetTypeLabel(row.type)}</dt><dd>{number(row.usedInCalculations)} mapped / {number(row.inScope)} in scope</dd></div>)}</dl></details>}
      </section>
      <section className="discovery-overview-panel discovery-overview-actions" aria-labelledby="overview-actions-title">
        <header><h2 id="overview-actions-title">Suggested next actions</h2><span className="discovery-overview-badge">{actions.length} checks to review</span></header>
        <p className="discovery-overview-note">Counts can overlap across these checks.</p>
        {actions.length ? <ol>{actions.map((action) => <li key={action.title}><Link prefetch={false} href={action.href}><div className="discovery-overview-action-heading"><h3>{action.title}</h3><span className="discovery-overview-action-count"><strong>{number(action.count)}</strong><small>{action.unit}</small><Arrow /></span></div><p>{action.detail}</p></Link></li>)}</ol>
          : <div className="discovery-overview-empty"><strong>{coverage.total || software.total || shadow.total ? "No findings in these five checks" : "No discovery records in this scope"}</strong><p>Review the explorer summaries below or change the scope and snapshot.</p></div>}
      </section>
    </div>

    <div className="discovery-overview-explorers">
      <section className="discovery-overview-panel" aria-labelledby="overview-endpoints-title">
        <header><h2 id="overview-endpoints-title">Endpoint discovery</h2><Link prefetch={false} href={endpointLink()} aria-label="Open End Point Explorer"><Arrow /></Link></header>
        <p className="discovery-overview-inventory-total"><strong>{number(endpoints.total)}</strong> endpoint records</p>
        <div className="discovery-overview-age-bars" aria-label="Endpoint discovery age">{endpoints.ages.map(({ age, count }, index) => <Link prefetch={false} href={endpointLink({}, [age])} key={age}><span>{age}</span><div><span style={{ width: `${endpoints.total ? count / endpoints.total * 100 : 0}%`, background: ["#5fc4b1", "#5ccde0", "#eab96b", "#ed996c", "#ac9ae5", "#8497aa"][index] }} /></div><strong>{number(count)}</strong></Link>)}</div>
        <Finding label="Source not recorded" count={endpoints.missingSource} href={endpointLink({ discoveredBy: [NOT_RECORDED] })} />
      </section>
      <section className="discovery-overview-panel" aria-labelledby="overview-software-title">
        <header><h2 id="overview-software-title">Software inventory</h2><Link prefetch={false} href={softwareLink()} aria-label="Open Installed Software Explorer"><Arrow /></Link></header>
        <p className="discovery-overview-inventory-total"><strong>{number(software.total)}</strong> installations <span>{number(software.products)} products / {number(software.endpoints)} endpoints</span></p>
        <div className="discovery-overview-findings">
          <Finding label="Version not recorded" count={software.missingVersion} href={versionLink} />
          <Finding label="Last discovered >30 days" count={software.stale} href={softwareLink({}, STALE_DISCOVERY_AGES)} />
          <Finding label="Date not recorded" count={software.undated} href={softwareLink({}, [NOT_RECORDED])} />
          <Finding label="Source not recorded" count={software.missingSource} href={softwareLink({ discoveredBy: [NOT_RECORDED] })} />
          {software.afterSnapshot > 0 && <Finding label="Date after snapshot" count={software.afterSnapshot} href={softwareLink({}, ["After snapshot"])} />}
        </div>
        {!software.total && <p className="discovery-overview-note">No software installations are recorded for this scope and snapshot.</p>}
      </section>
      <section className="discovery-overview-panel" aria-labelledby="overview-shadow-title">
        <header><h2 id="overview-shadow-title">Shadow IT</h2><Link prefetch={false} href={shadowLink()} aria-label="Open Shadow IT Explorer"><Arrow /></Link></header>
        <p className="discovery-overview-inventory-total"><strong>{number(shadow.total)}</strong> IP nodes <span>{number(shadow.owners)} ARP owner {shadow.owners === 1 ? "endpoint" : "endpoints"}</span></p>
        <div className="discovery-overview-findings">
          <Finding label="Found by IP scan" count={shadow.ipScan} href={shadowLink({ discoveryApproach: ["IP Scan"] })} />
          <Finding label="Found in ARP tables" count={shadow.arp} href={shadowLink({ discoveryApproach: ["ARP Table"] })} />
          <Finding label="Last discovered >30 days" count={shadow.stale} href={shadowLink({}, STALE_DISCOVERY_AGES)} />
          <Finding label="Date not recorded" count={shadow.undated} href={shadowLink({}, [NOT_RECORDED])} />
          <Finding label="Source not recorded" count={shadow.missingSource} href={shadowLink({ discoveredBy: [NOT_RECORDED] })} />
          {shadow.afterSnapshot > 0 && <Finding label="Date after snapshot" count={shadow.afterSnapshot} href={shadowLink({}, ["After snapshot"])} />}
        </div>
      </section>
    </div>
    <details className="discovery-overview-method"><summary>Calculation notes</summary><div>
      <p>Coverage uses the saved tool-to-CI type mappings. Discovery age is measured against the selected snapshot; over 30 days is a review prompt and does not change coverage compliance.</p>
      <p>Software counts represent individual installations, including repeated products on different endpoints.</p>
      <p>ARP owner endpoints supply the observation table; they are distinct from the unidentified IP nodes. Shadow IT includes observations associated with selected systems through these owners.</p>
    </div></details>
  </div>;
}
