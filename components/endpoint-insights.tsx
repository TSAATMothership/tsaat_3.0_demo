import Image from "next/image";
import Link from "@/components/persona-link";
import { InsightsReportButton } from "@/components/insights-report-button";
import { inventoryInsightsReportHref } from "@/lib/inventory-insights-report-links";
import type { CSSProperties, ReactNode } from "react";
import { ENDPOINT_COLUMNS, NOT_RECORDED, endpointFacetCounts, type EndpointRecord, type EndpointColumn, type EndpointFilters, type DiscoveryAge } from "@/lib/endpoint-explorer";
import { STALE_DISCOVERY_AGES, type DiscoveryOverviewModel } from "@/lib/discovery-overview";
import { discoveryExplorerHref } from "@/lib/discovery-explorer-links";
import type { DiscoveryComplianceFilters } from "@/lib/discovery-compliance-explorer";
import type { DiscoveryOverviewData } from "@/lib/discovery-overview-data";
import type { WorkspaceSearchParams } from "@/lib/workspace-navigation";

const number = (value: number) => value.toLocaleString("en-AU");
const percent = (value: number | null) => value === null ? "N/A" : `${number(value)}%`;
function Evidence({ href, count, children }: { href: string; count?: number; children: ReactNode }) {
  return <Link prefetch={false} href={href} className="insight-link" data-endpoint-insight-count={count}>{children}<span aria-hidden="true">↗</span></Link>;
}
function Bar({ count, total, tone = "cyan" }: { count: number; total: number; tone?: string }) {
  return <div className={`insight-progress is-${tone}`} aria-hidden="true"><span style={{ width: `${total ? count / total * 100 : 0}%` }} /></div>;
}
function Chapter({ index, label, title, children }: { index: string; label: string; title: string; children: ReactNode }) {
  return <header className="insight-chapter-heading"><span className="insight-chapter-index">{index}</span><div><p className="insight-kicker">{label}</p><h2>{title}</h2><p>{children}</p></div></header>;
}

/** A briefing of the existing Explorer facets and Discovery Insights measures, not a new quality score. */
export function EndpointInsights({ rows, model, scope, scopeLabels }: {
  rows: EndpointRecord[]; model: DiscoveryOverviewModel; scope: WorkspaceSearchParams; scopeLabels: DiscoveryOverviewData["scopeLabels"];
}) {
  const { endpoints, coverage, shadow, snapshotDate } = model;
  const endpointLink = (columns: EndpointFilters["columns"] = {}, recency: DiscoveryAge[] = []) => discoveryExplorerHref("endpoints", scope, snapshotDate, { search: "", columns, recency });
  const complianceLink = (columns: DiscoveryComplianceFilters["columns"] = {}) => discoveryExplorerHref("compliance", scope, snapshotDate, { search: "", columns });
  const facets = (key: EndpointColumn) => endpointFacetCounts(rows, key);
  const fields = ENDPOINT_COLUMNS.map(({ key, label }) => ({ key, label,
    missing: key === "lastDiscoveredDate" ? endpoints.undated : facets(key).find(row => row.value === NOT_RECORDED)?.count ?? 0,
    href: key === "lastDiscoveredDate" ? endpointLink({}, [NOT_RECORDED]) : endpointLink({ [key]: [NOT_RECORDED] }) }));
  const unknownDomains = facets("securityDomain").find(row => row.value === "UNKNOWN")?.count ?? 0;
  const priorities = [
    { title: "Restore identity details", detail: "Review the missing IP address, MAC address and device model facets. Confirm applicability before filling a field.", href: "#endpoint-insights-gaps" },
    { title: "Refresh discovery evidence", detail: "Investigate old, missing and future-dated observations, then confirm the collection source.", href: "#endpoint-insights-freshness" },
    { title: "Close visibility gaps", detail: "Check missing required tools and investigate unidentified IP nodes in the surrounding scope.", href: "#endpoint-insights-coverage" }
  ];
  const distribution = (key: EndpointColumn, title: string, subtitle: string, tone = "cyan") => <div className="insight-card"><p className="insight-kicker">{subtitle}</p><h3>{title}</h3>
    <ul className="discovery-insight-bars endpoint-insight-distribution">{facets(key).map(({ value, count }) => <li key={value}><Evidence href={endpointLink({ [key]: [value] })} count={count}><span>{value}</span><strong>{number(count)}</strong></Evidence><Bar count={count} total={rows.length} tone={tone} /></li>)}</ul>
    {!rows.length && <p>No endpoint records in this selection.</p>}</div>;

  return <article className="workspace-page endpoint-insights" aria-label="End Point Insights briefing">
    <header className="insight-masthead" id="endpoint-insights-top"><div><p className="insight-kicker">Governance / End Point Insights</p><span>Endpoint evidence briefing</span></div><div className="insight-masthead-actions"><div className="insight-edition"><span className="insight-status-dot" />Snapshot <time dateTime={snapshotDate}>{snapshotDate}</time></div><InsightsReportButton href={inventoryInsightsReportHref("endpoints", scope, snapshotDate)} filename={`end-point-insights-${snapshotDate}.pdf`} title="End Point Insights" /></div></header>
    <section className="insight-hero" aria-labelledby="endpoint-insights-title"><div className="insight-hero-copy">
      <div className="insight-brand"><Image src="/tsaat-logo.png" width={34} height={34} alt="TSAAT" /><span>Identify. Observe. Understand.</span></div>
      <h1 id="endpoint-insights-title">End Point<br /><em>Insights.</em></h1><p className="insight-lead">Every endpoint has a story.<br />The gaps matter as much as the records.</p>
      <p className="insight-hero-description">See what is known about the estate, where identity is incomplete, and how discovery evidence supports confidence in the inventory.</p>
      <a className="insight-primary-link" href="#endpoint-insights-gaps">Find the missing evidence <span aria-hidden="true">↗</span></a></div>
      <figure className="insight-hero-art"><Image src="/endpoint-evidence.svg" width={620} height={480} alt="Conceptual endpoint evidence card connecting identity, discovery and coverage; not measured data." /><figcaption><span>01 / Identity</span><span>02 / Evidence</span><span>03 / Coverage</span></figcaption></figure>
      <div className="insight-scope"><span>Applied scope</span><p>{[...scopeLabels.networks, ...scopeLabels.systems].join(" · ")}</p><div>{scopeLabels.domains.map(domain => <span className="insight-domain" key={domain}>{domain}</span>)}</div></div>
    </section>
    {!rows.length && <div className="insight-card discovery-insights-empty" role="status"><h2>No endpoint records in this scope</h2><p>Select another network, ICT system, security domain or snapshot. An empty inventory does not establish complete discovery or absence of devices.</p></div>}
    <section className="insight-headline-metrics" aria-label="Endpoint evidence at a glance">{[
      { label: "Endpoint records", value: endpoints.total, detail: "Same inventory as End Point Explorer", tone: "cyan" },
      { label: "Older discoveries", value: endpoints.stale, detail: "Last seen more than 30 days before snapshot", tone: "amber" },
      { label: "Discovery date gaps", value: endpoints.undated, detail: "Missing or invalid discovery dates", tone: "amber" },
      { label: "Discovery source gaps", value: endpoints.missingSource, detail: "No collection source recorded", tone: "rose" }
    ].map(metric => <div className={`insight-metric is-${metric.tone}`} key={metric.label}><span>{metric.label}</span><strong>{number(metric.value)}</strong><small>{metric.detail}</small></div>)}</section>
    <nav className="insight-chapters" aria-label="End point insights sections">{[["inventory", "The estate"], ["gaps", "Missing details"], ["freshness", "Discovery evidence"], ["coverage", "Coverage context"], ["actions", "Next steps"]].map(([id, label], index) => <a key={id} href={`#endpoint-insights-${id}`}><span>0{index + 1}</span>{label}</a>)}</nav>

    <section className="insight-chapter" id="endpoint-insights-inventory"><Chapter index="01" label="The recorded estate" title="Understand what is in view.">These are the scoped CMDB records shown in End Point Explorer, including every CI type it contains. They are not a count of all devices that may exist.</Chapter>
      <div className="insight-two-column">{distribution("ciType", "The shape of the inventory", "CI composition")}{distribution("managedNetwork", "Where the records belong", "Managed networks", "mint")}</div>
      <div className="endpoint-insight-context"><p>Explore individual records to inspect their CMDB details, or follow a chart to the matching inventory.</p><Evidence href={endpointLink()} count={endpoints.total}>Explore all {number(endpoints.total)} endpoint records</Evidence></div>
    </section>

    <section className="insight-chapter" id="endpoint-insights-gaps"><Chapter index="02" label="Identity and context" title="A record can exist without the details you need.">Each card shows a field-level gap in the displayed inventory. Missing fields can overlap on the same CI; these counts must not be added into an endpoint issue total.</Chapter>
      <div className="endpoint-insight-fields">{fields.map(field => <div className={`insight-card endpoint-insight-field ${field.missing ? "has-gap" : ""}`} key={field.key}><p className="insight-kicker">{field.label}</p><div><strong>{number(field.missing)}</strong><span>{field.key === "lastDiscoveredDate" ? "missing or invalid" : "not recorded"}</span></div>
        <Bar count={rows.length - field.missing} total={rows.length} tone="mint" /><p>{number(rows.length - field.missing)} of {number(rows.length)} {field.key === "lastDiscoveredDate" ? "have a parseable date" : "have a displayed value"}</p><Evidence href={field.href} count={field.missing}>Inspect missing {field.label.toLowerCase()}</Evidence></div>)}</div>
      <p className="insight-callout">Presence is not validation. Some fields may not apply to every CI type. Names and network labels can fall back to identifiers; a populated value does not prove a descriptive name, valid address or verified classification.</p>
      <div className="endpoint-insight-context"><p><strong>{number(unknownDomains)}</strong> records have security domain UNKNOWN. This is an explicit value, separate from an empty field.</p><Evidence href={endpointLink({ securityDomain: ["UNKNOWN"] })} count={unknownDomains}>Review unclassified records</Evidence></div>
    </section>

    <section className="insight-chapter" id="endpoint-insights-freshness"><Chapter index="03" label="Discovery evidence" title="Ask when it was seen, and who saw it.">Age is measured against {snapshotDate}. More than 30 days is a review prompt, not a change to coverage compliance. An undated record cannot establish freshness.</Chapter>
      <div className="insight-two-column"><div className="insight-card"><p className="insight-kicker">Time since discovery</p><h3>The age of the evidence</h3><ul className="discovery-insight-bars endpoint-insight-distribution">{endpoints.ages.map(({ age, count }, index) => <li key={age}><Evidence href={endpointLink({}, [age])} count={count}><span>{age}</span><strong>{number(count)}</strong></Evidence><Bar count={count} total={rows.length} tone={index < 2 ? "mint" : "amber"} /></li>)}</ul><Evidence href={endpointLink({}, STALE_DISCOVERY_AGES)} count={endpoints.stale}>Review {number(endpoints.stale)} older discoveries</Evidence></div>
      {distribution("discoveredBy", "Trace each record to its source", "Recorded collection source", "mint")}</div>
      <div className="endpoint-insight-context"><p><strong>{number(endpoints.afterSnapshot)}</strong> discovery dates occur after the snapshot. Investigate timing or import issues; these do not count as recent evidence.</p><Evidence href={endpointLink({}, ["After snapshot"])} count={endpoints.afterSnapshot}>Inspect future-dated records</Evidence></div>
    </section>

    <section className="insight-chapter" id="endpoint-insights-coverage"><Chapter index="04" label="The surrounding discovery picture" title="Being recorded is only part of being visible.">Required tool coverage uses the Discovery Compliance CI inventory in the applied scope, including its configured CI types. It describes required tool checks, not the number of devices still undiscovered.</Chapter>
      <div className="insight-card insight-coverage-card"><div className="insight-ring" style={{ "--coverage": `${coverage.percent ?? 0}%` } as CSSProperties} role="img" aria-label={`${percent(coverage.percent)} required CI tool coverage`}><div><strong>{percent(coverage.percent)}</strong><span>required CI tool<br />checks covered</span></div></div>
        <div><p className="insight-kicker">Scoped CI coverage</p><h3>{number(coverage.coveredChecks)} of {number(coverage.applicableChecks)} required checks covered</h3><p>{number(coverage.total)} CIs in the compliance inventory · {number(coverage.missingChecks)} missing tool-to-CI checks.</p><Evidence href={complianceLink({ compliant: ["Coverage gaps"] })} count={coverage.gaps}>Inspect {number(coverage.gaps)} CIs with coverage gaps</Evidence><p className="insight-note">{number(coverage.unmapped)} CIs have no required tool mapping. They are outside the percentage denominator and count as compliant because no tool is required. No applicable checks means N/A.</p></div></div>
      <div className="discovery-insight-tools">{coverage.tools.map(tool => <div className="insight-card" key={tool.id}><p className="insight-kicker">Required discovery tool</p><h3>{tool.label}</h3><div className="discovery-insight-tool-value"><strong>{percent(tool.coveragePercent)}</strong><span>{number(tool.covered)} / {number(tool.applicable)} CIs</span></div><Bar count={tool.covered} total={tool.applicable} tone="mint" /><Evidence href={complianceLink({ missingTools: [tool.label] })} count={tool.missing}>Review {number(tool.missing)} missing CIs</Evidence></div>)}</div>
      {!coverage.tools.length && <p className="insight-callout">No required tool checks are available for this selection. Review the scope and saved Discovery Tools mappings before drawing conclusions.</p>}
      <div className="insight-card endpoint-insight-blindspot"><div className="insight-big-number is-amber">{number(shadow.total)}<span>unidentified IP nodes</span></div><div><h3>What still needs an identity?</h3><p>Shadow IT holds IP scan and ARP observations for follow-up. This is a separate observation inventory; do not add it to endpoint totals or infer the number of unseen devices from it.</p><Evidence href={discoveryExplorerHref("shadow-it", scope, snapshotDate)} count={shadow.total}>Investigate unidentified nodes</Evidence></div></div>
    </section>

    <section className="insight-decisions" id="endpoint-insights-actions"><Chapter index="05" label="From gaps to follow-up" title="Make the next discovery more useful.">Use the evidence above to guide review. Zero missing values do not establish correctness, complete coverage or absence of undiscovered devices.</Chapter>
      <div className="insight-decision-grid">{priorities.map((action, index) => <div className="insight-decision" key={action.title}><span className="insight-decision-number">0{index + 1}</span><h3>{action.title}</h3><p>{action.detail}</p><a className="insight-link" href={action.href}>Review this chapter <span aria-hidden="true">↑</span></a></div>)}</div>
      <details className="discovery-insight-method"><summary>How to read this briefing</summary><p>Counts and links use the resolved snapshot and applied header network or ICT-system scope and security domains. Local Explorer filters do not carry into the briefing. The inventory excludes records outside real managed networks, matching End Point Explorer.</p><p>Field presence uses the Explorer’s displayed values and Not recorded facets. The date gap uses the existing missing or invalid discovery-age bucket. Future dates remain separate. UNKNOWN is recorded classification evidence, not a blank value.</p><p>Charts use the existing endpoint facets and Discovery Insights measures, including saved tool applicability mappings. There is no new completeness score, inferred device population or risk ranking. Source labels are recorded text and may represent more than one collection tool.</p></details>
    </section>
    <footer className="insight-footer"><div><Image src="/tsaat-logo.png" width={30} height={30} alt="TSAAT" /><p>Better evidence.<br /><strong>A clearer endpoint estate.</strong></p><a href="#endpoint-insights-top">Back to top ↑</a></div><p className="insight-note">The illustration is conceptual. Follow the evidence links to inspect the underlying records.</p></footer>
  </article>;
}
