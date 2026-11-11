"use client";

import Image from "next/image";
import Link from "@/components/persona-link";
import type { CSSProperties, ReactNode } from "react";
import { discoveryExplorerHref } from "@/lib/discovery-explorer-links";
import { DISCOVERY_AGE_BUCKETS, NOT_RECORDED, type DiscoveryAge } from "@/lib/endpoint-explorer";
import { emptySoftwareFilters, type SoftwareColumn, type SoftwareFilters } from "@/lib/installed-software-explorer";
import type { InstalledSoftwareInsightsModel } from "@/lib/installed-software-insights";
import { scopeIds, type WorkspaceSearchParams } from "@/lib/workspace-navigation";
import { securityDomainSelection } from "@/lib/security-domain.mjs";
import { insightsHref } from "@/lib/insights-navigation";
import { InsightsReportButton } from "@/components/insights-report-button";

const number = (value: number) => value.toLocaleString("en-AU");
const percent = (value: number | null) => value === null ? "N/A" : `${value}%`;
type Symbol = "package" | "layers" | "endpoint" | "arrow";
function Icon({ name }: { name: Symbol }) {
  const paths: Record<Symbol, ReactNode> = {
    package: <><path d="m12 2 9 5v10l-9 5-9-5V7Z" /><path d="m3 7 9 5 9-5M12 12v10M7 4.8l9 5V15" /></>,
    layers: <><path d="m12 3 10 5-10 5L2 8Z" /><path d="m2 12 10 5 10-5M2 16l10 5 10-5" /></>,
    endpoint: <><rect x="3" y="3" width="18" height="13" rx="2" /><path d="M8 21h8m-4-5v5M7 7h10M7 11h6" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Evidence({ href, count, children }: { href: string; count?: number; children: ReactNode }) {
  return <Link href={href} prefetch={false} className="insight-link" data-software-count={count}>{children}<Icon name="arrow" /></Link>;
}
function Chapter({ index, label, title, children, icon }: { index: string; label: string; title: string; children: ReactNode; icon: Symbol }) {
  return <header className="insight-chapter-heading"><span className="insight-chapter-index">{index}</span><div>
    <p className="insight-kicker"><Icon name={icon} />{label}</p><h2>{title}</h2><p>{children}</p></div></header>;
}

/** Shared visual system for the retained Insights; the existing software model remains authoritative. */
export function SoftwareInsightsBriefing({ model, scope }: { model: InstalledSoftwareInsightsModel; scope: WorkspaceSearchParams }) {
  const href = (filters?: SoftwareFilters) => discoveryExplorerHref("installed-software", scope, model.snapshotDate, filters);
  const columnHref = (column: SoftwareColumn, value: string) => href({ ...emptySoftwareFilters(), columns: { [column]: [value] } });
  const recencyHref = (value: DiscoveryAge) => href({ ...emptySoftwareFilters(), recency: [value] });
  const scopeText = [...scopeIds(scope.network).map(id => `Network ${id}`), ...scopeIds(scope.system).map(id => `ICT system ${id}`)].join(" · ");
  const concentration = model.total ? Math.round(model.topThree / model.total * 100) : null;
  const actions = [
    { title: "Identify the version", count: model.missingVersion, detail: "installations have no version recorded. Complete the version evidence before precise software matching.", href: columnHref("softwareVersion", NOT_RECORDED) },
    { title: "Refresh older observations", count: model.stale, detail: "discoveries are over 30 days old at this snapshot. Confirm the inventory still reflects the endpoint.", href: href({ ...emptySoftwareFilters(), recency: [DISCOVERY_AGE_BUCKETS[2], DISCOVERY_AGE_BUCKETS[3]] }) },
    { title: "Restore discovery dates", count: model.undated, detail: "installations have missing or invalid discovery dates. Establish when each record was observed.", href: recencyHref(NOT_RECORDED) },
    { title: "Check future-dated evidence", count: model.afterSnapshot, detail: "discovery dates fall after this snapshot. Review the timestamp and snapshot alignment.", href: recencyHref("After snapshot") },
    { title: "Record the source", count: model.missingSource, detail: "installations have no discovery source recorded. Confirm which collection tool supplied the evidence.", href: columnHref("discoveredBy", NOT_RECORDED) },
    { title: "Locate the installation", count: model.missingPath, detail: "installations have no file path recorded. Add location evidence where the discovery tool can supply it.", href: columnHref("filePath", NOT_RECORDED) }
  ];
  return <div className="software-insights-briefing" aria-label="Software inventory briefing">
    <header className="insight-masthead" id="software-briefing-top"><div><p className="insight-kicker">Governance / Installed software insights</p><span>Inventory intelligence briefing</span></div>
      <div className="insight-masthead-actions"><div className="insight-edition"><span className="insight-status-dot" />Snapshot <time dateTime={model.snapshotDate}>{model.snapshotDate}</time></div>
        <InsightsReportButton href={insightsHref({ ...scope, dataDate: model.snapshotDate }, "/api/discovery/installed-software-insights/report")} filename={`software-insights-${model.snapshotDate}.pdf`} title="Software Insights" />
      </div></header>
    <section className="insight-hero" aria-labelledby="software-briefing-title">
      <div className="insight-hero-copy"><div className="insight-brand"><Image src="/tsaat-logo.png" width={34} height={34} alt="TSAAT" /><span>Know the footprint. Strengthen the evidence.</span></div>
        <h1 id="software-briefing-title">Software<br /><em>Insights.</em></h1>
        <p className="insight-lead">Understand what is installed.<br />Decide where to look next.</p>
        <p className="insight-hero-description">A connected view of software footprint, product concentration and version variation. From inventory records to focused evidence improvement.</p>
        <a className="insight-primary-link" href="#software-briefing-evidence">Read the evidence priorities<Icon name="arrow" /></a></div>
      <figure className="insight-hero-art"><Image src="/software-terrain.svg" width={620} height={480} alt="Conceptual layers connecting software products, versions and endpoints; not a measured topology." />
        <figcaption><span>01 / Discover</span><span>02 / Understand</span><span>03 / Verify</span></figcaption></figure>
      <div className="insight-scope"><span>Applied scope</span><p>{scopeText}</p><div>{securityDomainSelection(scope.securityDomain).map(domain => <span className="insight-domain" key={domain}>{domain}</span>)}</div></div>
    </section>
    <section className="insight-headline-metrics" aria-label="Software at a glance">
      {[{ label: "Recorded installations", value: number(model.total), detail: "Software / endpoint entries", tone: "cyan" },
        { label: "Named products", value: number(model.products.length), detail: "Distinct recorded product names", tone: "mint" },
        { label: "Endpoints represented", value: number(model.endpoints), detail: "Endpoints with software records", tone: "cyan" },
        { label: "Version recorded", value: percent(model.versionPercent), detail: `${number(model.knownVersion)} of ${number(model.total)} installations`, tone: "amber" }].map(metric =>
        <div className={`insight-metric is-${metric.tone}`} key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div>)}
    </section>
    <nav className="insight-chapters" aria-label="Software insights sections">{[["footprint", "Footprint"], ["concentration", "Concentration"], ["variation", "Version variation"], ["evidence", "Evidence priorities"]].map(([id, label], index) =>
      <a href={`#software-briefing-${id}`} key={id}><span>0{index + 1}</span>{label}</a>)}</nav>

    <section className="insight-chapter software-briefing-chapter" id="software-briefing-footprint">
      <Chapter index="01" label="The software footprint" title="One inventory. Many installations." icon="package">Start with the scale of the recorded inventory. Product, installation and endpoint counts describe different parts of the footprint.</Chapter>
      <div className="insight-impact-flow" aria-label="Software footprint"><div><Icon name="package" /><strong>{number(model.products.length)}</strong><span>named software products</span></div><Icon name="arrow" />
        <div><Icon name="layers" /><strong>{number(model.total)}</strong><span>recorded installations</span></div><Icon name="arrow" /><div><Icon name="endpoint" /><strong>{number(model.endpoints)}</strong><span>endpoints represented</span></div></div>
      <div className="insight-two-column"><div className="insight-card"><p className="insight-kicker">Inventory in context</p><h3>The footprint follows the evidence</h3><p>Multiple installations on one endpoint remain separate records. Endpoints without software inventory are outside this view, so these counts do not measure overall endpoint coverage.</p><Evidence href={href()} count={model.total}>Explore all {number(model.total)} installations</Evidence></div>
        <div className="insight-card insight-mission-note"><div className="insight-card-symbol"><Icon name="endpoint" /></div><p className="insight-kicker">Identity matters</p><h3>{number(model.unnamed)} installations without a product name</h3><p>Missing product names remain in the installation total. They are excluded from named-product counts, concentration and version variation.</p><Evidence href={columnHref("softwareName", NOT_RECORDED)} count={model.unnamed}>Inspect unnamed installations</Evidence></div></div>
    </section>

    <section className="insight-chapter software-briefing-chapter" id="software-briefing-concentration">
      <Chapter index="02" label="Product concentration" title="Start where the footprint is largest." icon="layers">Widely installed products are a useful starting point for software reviews. Concentration describes the inventory, not a risk or licensing score.</Chapter>
      <div className="insight-two-column"><div className="insight-card"><p className="insight-kicker">Share of recorded installations</p><div className="insight-big-number is-cyan">{percent(concentration)}<span>in the three leading products</span></div>
        <p>{number(model.topThree)} of {number(model.total)} installations belong to the three most installed named products, or all named products when fewer than three are recorded.</p>
        <p className="insight-callout">Review widely installed products with their owners. A change can affect many installations; confirm the actual deployment context before acting.</p></div>
        <div className="insight-card"><p className="insight-kicker">Leading products</p><h3>{model.products[0] ? `${model.products[0].value} leads the footprint` : "Product names are missing"}</h3>
          <ol className="software-briefing-products">{model.products.slice(0, 3).map((row, index) => <li key={row.value}><span className="software-briefing-rank">0{index + 1}</span><div><Evidence href={columnHref("softwareName", row.value)} count={row.count}>{row.value}</Evidence><div className="insight-progress is-cyan" aria-hidden="true"><span style={{ width: `${model.total ? row.count / model.total * 100 : 0}%` }} /></div></div><strong>{number(row.count)}</strong></li>)}</ol>
          {!model.products.length && <p>No named products are recorded in this selection.</p>}<p className="insight-note">Bars show each product’s share of all installations. {number(model.total - model.topThree)} installations are outside these leading named products.</p></div></div>
    </section>

    <section className="insight-chapter software-briefing-chapter" id="software-briefing-variation">
      <Chapter index="03" label="Version consistency" title={model.versionSpread.length ? "One product can mean several versions." : "No recorded version split in this scope."} icon="layers">Use recorded version variation to focus a consistency review. Different versions do not, by themselves, establish obsolescence or vulnerability.</Chapter>
      <div className="insight-two-column"><div className="insight-card insight-mission-note"><div className="insight-card-symbol"><Icon name="layers" /></div><p className="insight-kicker">Products to examine</p><div className="insight-big-number is-mint">{number(model.versionSpread.length)}<span>with multiple recorded versions</span></div>
        <p>Each has at least two distinct, non-missing versions. Compare deployment purpose and ownership before deciding whether a common version is appropriate.</p><p className="insight-callout">Names and versions use the Explorer’s trimmed recorded values. Missing versions never count as an additional version, and spelling or case variants are not merged.</p></div>
        <div className="insight-card"><p className="insight-kicker">Version variation</p><h3>Follow the recorded differences</h3><ol className="insight-service-list">{model.versionSpread.slice(0, 3).map((row, index) => <li key={row.value}><span>0{index + 1}</span><div><Evidence href={columnHref("softwareName", row.value)} count={row.count}>{row.value}</Evidence><small>{number(row.count)} installations · {number(row.endpoints)} endpoints</small></div><b>{number(row.versions)}<small>versions</small></b></li>)}</ol>
          {!model.versionSpread.length && <p>No named product has multiple recorded versions. Missing version evidence is still reviewed separately.</p>}
          <p className="insight-note">Showing {Math.min(3, model.versionSpread.length)} of {number(model.versionSpread.length)} products with version variation, ordered by distinct version count.</p></div></div>
    </section>

    <section className="insight-decisions software-briefing-chapter" id="software-briefing-evidence">
      <Chapter index="04" label="Evidence priorities" title="Make the next decision easier to support." icon="arrow">Use the gaps below to choose the next collection or verification task. These counts can overlap and must not be added together.</Chapter>
      <div className="insight-card insight-coverage-card"><div className="insight-ring" style={{ "--coverage": `${model.versionPercent ?? 0}%` } as CSSProperties} role="img" aria-label={`Installations with a recorded version: ${percent(model.versionPercent)}`}><div><strong>{percent(model.versionPercent)}</strong><span>version<br />recorded</span></div></div>
        <div><p className="insight-kicker">Version evidence</p><h3>{number(model.knownVersion)} of {number(model.total)} installations have a version</h3><p>{model.missingVersion ? "Missing versions limit precise software matching." : "Every recorded installation has a version."} A version entry alone does not establish support status, currency or absence of vulnerabilities.</p></div></div>
      <div className="insight-decision-grid software-briefing-actions">{actions.map((action, index) => <div className="insight-decision" key={action.title}><span className="insight-decision-number">0{index + 1}</span><h3>{action.title}</h3><p><strong>{number(action.count)}</strong> {action.detail}</p><Evidence href={action.href} count={action.count}>Review {number(action.count)} records</Evidence></div>)}</div>
    </section>
    <footer className="insight-footer"><div><Image src="/tsaat-logo.png" width={30} height={30} alt="TSAAT" /><p>Evidence-led decisions.<br /><strong>A clearer software footprint.</strong></p><a href="#software-briefing-top">Back to top ↑</a></div><p className="insight-note">This is a snapshot briefing. The illustration is conceptual; all counts and links use the selected inventory evidence.</p></footer>
  </div>;
}
