import Image from "next/image";
import Link from "@/components/persona-link";
import type { CSSProperties, ReactNode } from "react";
import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { insightsHref } from "@/lib/governance-insights";
import type { GovernanceInsightsData } from "@/lib/governance-insights-data";
import { GovernanceInsightsReportButton } from "@/components/governance-insights-report-button";

const number = (value: number) => value.toLocaleString("en-AU");
const percent = (value: number | null) => value === null ? "N/A" : `${number(value)}%`;
type IconName = "terrain" | "eye" | "shield" | "service" | "patch" | "arrow";
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    terrain: <><path d="m3 17 5-10 4 6 4-9 5 13M3 21h18" /><path d="m7 9 2 3m6-5 3 3" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    shield: <><path d="m12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5Z" /><path d="M12 7v6m0 3h.01" /></>,
    service: <><rect x="8" y="2" width="8" height="6" rx="1" /><rect x="2" y="16" width="7" height="6" rx="1" /><rect x="15" y="16" width="7" height="6" rx="1" /><path d="M12 8v4H5v4m7-4h7v4" /></>,
    patch: <><path d="M20 8a9 9 0 1 0 1 7M20 3v5h-5" /><path d="m8 12 3 3 5-6" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Destination({ href, children }: { href: string; children: ReactNode }) {
  return <Link prefetch={false} className="insight-link" href={href}>{children}<Icon name="arrow" /></Link>;
}
function Chapter({ index, label, title, children, icon }: { index: string; label: string; title: string; children: ReactNode; icon: IconName }) {
  return <header className="insight-chapter-heading"><span className="insight-chapter-index">{index}</span><div>
    <p className="insight-kicker"><Icon name={icon} />{label}</p><h2>{title}</h2><p>{children}</p></div></header>;
}
function Metric({ label, value, detail, tone = "cyan" }: { label: string; value: ReactNode; detail: string; tone?: string }) {
  return <div className={`insight-metric is-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
function Progress({ value, total, label, tone = "cyan" }: { value: number; total: number; label: string; tone?: string }) {
  return <div className={`insight-progress is-${tone}`} role="img" aria-label={`${label}: ${number(value)} of ${number(total)}`}>
    <span style={{ width: `${total ? Math.min(100, value / total * 100) : 0}%` }} /></div>;
}

export function GovernanceInsights({ data }: { data: GovernanceInsightsData }) {
  const { model, impact, insights, scope, scopeLabels } = data;
  const { coverage, endpoints, vulnerabilities, patches, software, shadow } = model;
  const discovery = (view: string) => insightsHref(scope, "/discovery-coverage", { key: "discoveryView", value: view });
  const impactLink = insightsHref(scope, "/cyber-cop", { key: "copView", value: "impact" });
  const scopeNames = [...scopeLabels.networks, ...scopeLabels.systems];
  const priorityServices = insights.services.filter(row => row.critical + row.high > 0).slice(0, 3);
  const patchColors: Record<string, string> = { Patched: "mint", "Not patched": "rose", Failed: "rose", "Restart required": "amber", "In progress": "cyan", Unknown: "slate" };
  const severityTone = (key: string) => key === "Critical Exposure" ? "rose" : key === "High Risk" ? "amber" : "slate";
  return <article className="workspace-page governance-insights" aria-label="Executive cyber terrain briefing" data-insights-snapshot={model.snapshotDate}>
    <header className="insight-masthead" id="insights-top"><div><p className="insight-kicker">Governance / Insights</p><span>Executive intelligence briefing</span></div>
      <div className="insight-masthead-actions"><div className="insight-edition"><span className="insight-status-dot" />Snapshot <time dateTime={model.snapshotDate}>{model.snapshotDate}</time></div>
        <GovernanceInsightsReportButton href={insightsHref(scope, "/api/governance/insights/report")} snapshotDate={model.snapshotDate} /></div></header>

    <section className="insight-hero" aria-labelledby="insights-title">
      <div className="insight-hero-copy"><div className="insight-brand"><Image src="/tsaat-logo.png" width={34} height={34} alt="TSAAT" /><span>Know the terrain. Direct the response.</span></div>
        <h1 id="insights-title">Cyber Terrain<br /><em>Posture.</em></h1>
        <p className="insight-lead">{insights.hasEvidence ? insights.headline : "No evidence is available in this selection."}</p>
        <p className="insight-hero-description">A connected view of visibility, exposure and operational resilience. From technical evidence to leadership priorities.</p>
        <a className="insight-primary-link" href="#insights-decisions">Read the leadership priorities<Icon name="arrow" /></a>
      </div>
      <figure className="insight-hero-art"><Image src="/cyber-terrain.svg" width={620} height={480} alt="Illustration of layered cyber terrain connecting endpoint infrastructure, ICT systems and services." priority />
        <figcaption><span>01 / Observe</span><span>02 / Understand</span><span>03 / Act</span></figcaption></figure>
      <div className="insight-scope"><span>Applied scope</span><p>{scopeNames.join(" · ")}</p><div>{scopeLabels.domains.map(domain => <span className="insight-domain" key={domain}>{domain}</span>)}</div></div>
    </section>

    {!insights.hasEvidence && <aside className="insight-empty" role="status"><Icon name="eye" /><div><strong>No records in this scope and snapshot</strong><p>Select another network, ICT system, security domain or snapshot to populate the briefing. Empty data does not establish a secure posture.</p></div></aside>}

    <section className="insight-headline-metrics" aria-label="Posture at a glance">
      <Metric label="Endpoints observed" value={number(endpoints.total)} detail="Inventory records in scope" />
      <Metric label="Priority findings" value={number(insights.priority)} detail="Critical Exposure + High Risk, system-linked" tone="rose" />
      <Metric label="CVE observations" value={number(vulnerabilities.total)} detail={`${number(vulnerabilities.distinctCves)} distinct CVE codes`} tone="amber" />
      <Metric label="Verified patched" value={percent(patches.verifiedPercent)} detail={`${number(patches.patched)} of ${number(patches.total)} servers`} tone="mint" />
    </section>

    <nav className="insight-chapters" aria-label="Briefing sections">{[["terrain", "Visibility"], ["exposure", "Exposure"], ["mission", "Service impact"], ["resilience", "Resilience"], ["decisions", "Priorities"]].map(([id, label], index) =>
      <a href={`#insights-${id}`} key={id}><span>0{index + 1}</span>{label}</a>)}</nav>

    <section className="insight-chapter" id="insights-terrain">
      <Chapter index="01" label="Terrain & visibility" title="You can only protect what you can see." icon="eye">Discovery coverage is the foundation of a defensible posture. Gaps in collection reduce the evidence available to decision-makers.</Chapter>
      <div className="insight-visibility-grid">
        <div className="insight-card insight-coverage-card"><div className="insight-ring" style={{ "--coverage": `${coverage.percent ?? 0}%` } as CSSProperties} role="img" aria-label={`Required discovery checks covered: ${percent(coverage.percent)}`}><div><strong>{percent(coverage.percent)}</strong><span>required checks<br />covered</span></div></div>
          <div><p className="insight-kicker">Visibility assurance</p><h3>{number(coverage.gaps)} CIs have coverage gaps</h3><p>{number(coverage.coveredChecks)} of {number(coverage.applicableChecks)} required tool checks are covered, using configured tool-to-CI mappings.</p><Destination href={discovery("compliance")}>Inspect coverage gaps</Destination></div></div>
        <div className="insight-card insight-terrain-mix"><p className="insight-kicker">The terrain in view</p><h3>{number(coverage.total)} configuration items</h3>
          <div className="insight-type-list">{coverage.ciTypes.map(row => <div key={row.type}><span>{formatAssetTypeLabel(row.type)}</span><strong>{number(row.inScope)}</strong><Progress value={row.inScope} total={coverage.total} label={formatAssetTypeLabel(row.type)} /></div>)}</div>
          {!coverage.ciTypes.length && <p>No CI types recorded in this selection.</p>}</div>
      </div>
      <div className="insight-tool-header"><h3>Discovery tool coverage</h3><Destination href={discovery("tools")}>Open tool coverage</Destination></div>
      <div className="insight-tool-grid">{coverage.tools.map(tool => <div className="insight-tool-card" key={tool.id}><div className="insight-tool-mark" aria-hidden="true"><Icon name="eye" /></div><div><h4>{tool.label}</h4><strong>{tool.applicable ? percent(tool.coveragePercent) : "N/A"}</strong></div><Progress value={tool.covered} total={tool.applicable} label={tool.label} /><p>{number(tool.covered)} / {number(tool.applicable)} applicable CIs covered · <b>{number(tool.missing)} gaps</b></p></div>)}</div>
      {!coverage.tools.length && <p className="insight-note">No applicable discovery tools are configured for this selection.</p>}
      <div className="insight-evidence-strip"><div><strong>{number(endpoints.stale)}</strong><span>endpoint discoveries over 30 days old</span></div><div><strong>{number(endpoints.undated)}</strong><span>endpoints without a discovery date</span></div><div><strong>{number(shadow.total)}</strong><span>unidentified IP nodes to investigate</span></div></div>
    </section>

    <section className="insight-chapter" id="insights-exposure">
      <Chapter index="02" label="Exposure & assurance" title="Separate the urgent from the underlying." icon="shield">Findings describe control exceptions. CVE observations describe recorded vulnerability exposure. Use both to target investigation and remediation.</Chapter>
      <div className="insight-two-column"><div className="insight-card insight-risk-card"><p className="insight-kicker">System-linked open findings</p><div className="insight-big-number is-rose">{number(insights.priority)}<span>critical / high</span></div>
        <p>Across <strong>{number(insights.prioritySystems)} ICT systems</strong>. Priority means Critical Exposure or High Risk under the configured finding classifications.</p>
        <div className="insight-severity-list">{insights.severities.map(row => <div key={row.key}><span><i className={`insight-dot is-${severityTone(row.key)}`} />{row.label}</span><b>{number(row.count)}</b><Progress value={row.count} total={insights.counts.findings} label={row.label} tone={severityTone(row.key)} /></div>)}</div>
        <p className="insight-note">{number(insights.counts.findings)} system-linked open findings. {number(impact.unattributedFindings)} additional open findings could not be attributed to an in-scope ICT system.</p><Destination href={insightsHref(scope, "/findings")}>Review the findings register</Destination></div>
        <div className="insight-card insight-vulnerability-card"><div className="insight-card-symbol"><Icon name="shield" /></div><p className="insight-kicker">Software vulnerability exposure</p><h3>{number(vulnerabilities.criticalHigh)} critical / high observations</h3><p>The full observation set covers {number(vulnerabilities.affectedEndpoints)} endpoints and {number(vulnerabilities.distinctCves)} distinct CVE codes across all severities.</p>
          <div className="insight-mini-metrics"><Metric label="All observations" value={number(vulnerabilities.total)} detail="CVE / endpoint records" tone="amber" /><Metric label="Missing action" value={number(vulnerabilities.missingRemediation)} detail="No remediation guidance recorded" tone="amber" /></div>
          <p className="insight-callout">Validate affected software and configuration before asserting exploitability. A CVE observation alone does not establish a missing OS patch.</p><Destination href={discovery("security-vulnerabilities")}>Explore CVE evidence</Destination></div></div>
    </section>

    <section className="insight-chapter insight-mission" id="insights-mission">
      <Chapter index="03" label="Business & mission context" title="Technical exposure has a service context." icon="service">Trace recorded associations from affected endpoints to ICT systems, business services and mission capabilities to guide the order of work.</Chapter>
      <div className="insight-impact-flow" aria-label="Recorded service associations"><div><Icon name="terrain" /><strong>{number(insights.priorityCis)}</strong><span>CIs with linked priority findings</span></div><Icon name="arrow" /><div><Icon name="service" /><strong>{number(insights.prioritySystems)}</strong><span>ICT systems with priority findings</span></div><Icon name="arrow" /><div><Icon name="shield" /><strong>{number(insights.exposedServices)}</strong><span>business services linked to priority findings</span></div></div>
      <div className="insight-two-column"><div className="insight-card"><p className="insight-kicker">Service concentration</p><h3>Start where priority findings concentrate</h3><ol className="insight-service-list">{priorityServices.map((row, index) => <li key={row.id}><span>0{index + 1}</span><div><strong>{row.name}</strong><small>{number(row.critical)} critical · {number(row.high)} high · {number(row.systemIds.length)} associated systems</small></div><b>{number(row.critical + row.high)}</b></li>)}</ol>
        {!priorityServices.length && <p>No business services are linked to critical/high findings in this selection.</p>}<p className="insight-note">Ranked by critical, then high findings. Shared findings can appear under several services; rows are not additive.</p></div>
        <div className="insight-card insight-mission-note"><div className="insight-card-symbol"><Icon name="service" /></div><p className="insight-kicker">Mission awareness</p><h3>{number(insights.exposedCapabilities)} capabilities linked to priority findings</h3><p>{number(impact.business.length)} business services and {number(impact.mission.length)} mission capabilities are represented in the selected system model.</p><p className="insight-callout">These are recorded relationships, not a prediction of outages. Use the impact graph and findings evidence to confirm operational consequences.</p><Destination href={impactLink}>Explore service impact</Destination></div></div>
    </section>

    <section className="insight-chapter" id="insights-resilience">
      <Chapter index="04" label="Patch & software assurance" title="Completion needs evidence, not intention." icon="patch">Track patch completion, restarts and verification together. Unknown status remains visible so incomplete evidence cannot look like progress.</Chapter>
      <div className="insight-two-column"><div className="insight-card"><p className="insight-kicker">Verified patch posture</p><div className="insight-big-number is-mint">{percent(patches.verifiedPercent)}<span>servers verified patched</span></div><Progress value={patches.patched} total={patches.total} label="Verified patched servers" tone="mint" />
        <p>{number(patches.patched)} of {number(patches.total)} in-scope servers. Unknown servers remain in the denominator.</p><div className="insight-patch-grid">{patches.statuses.map(row => <div key={row.status}><i className={`insight-dot is-${patchColors[row.status]}`} /><span>{row.status}</span><strong>{number(row.count)}</strong></div>)}</div><Destination href={discovery("patch-management")}>Open patch management</Destination></div>
        <div className="insight-card insight-maintenance-card"><p className="insight-kicker">Delivery priorities</p><div className="insight-mini-metrics"><Metric label="Overdue servers" value={number(patches.overdue)} detail="Beyond their recorded patch due date" tone="amber" /><Metric label="Unknown status" value={number(patches.unknown)} detail="Patch assurance is incomplete" tone="slate" /></div>
          <div className="insight-divider" /><h3>The software evidence behind the decision</h3><p><strong>{number(software.total)} installations</strong> across {number(software.endpoints)} endpoints and {number(software.products)} recorded product names.</p><p>{number(software.missingVersion)} installations have no version recorded, limiting the evidence available for vulnerability matching.</p><Destination href={discovery("installed-software")}>Inspect installed software</Destination></div></div>
    </section>

    <section className="insight-decisions" id="insights-decisions">
      <Chapter index="05" label="Leadership priorities" title="Turn the evidence into accountable action." icon="arrow">A focused agenda drawn from the current snapshot. Confirm ownership, agree the next milestone and review evidence of completion.</Chapter>
      <div className="insight-decision-grid">{insights.actions.map((action, index) => <div className="insight-decision" key={action.key}><span className="insight-decision-number">0{index + 1}</span><h3>{action.title}</h3><p>{action.detail}</p><Destination href={action.destination === "impact" ? impactLink : discovery(action.destination)}>Review supporting evidence</Destination></div>)}</div>
      {!insights.actions.length && <div className="insight-empty"><Icon name="eye" /><div><strong>{insights.hasEvidence ? "Maintain assurance and validate the remaining evidence" : "Establish the evidence base"}</strong><p>{insights.hasEvidence ? "No priority triggers were identified by this briefing. Review lower-severity findings and evidence completeness; this is not a declaration of compliance." : "Confirm discovery collection and the selected scope before drawing a posture conclusion."}</p><Destination href={discovery("overview")}>Open Discovery overview</Destination></div></div>}
    </section>

    <footer className="insight-footer"><div><Image src="/tsaat-logo.png" width={30} height={30} alt="TSAAT" /><p>Evidence-led decisions.<br /><strong>A clearer cyber terrain.</strong></p><a href="#insights-top">Back to top ↑</a></div>
      <details><summary>About this briefing and its evidence</summary><p>This is a snapshot briefing, not a trend or composite risk score. All counts use the applied network/system, security domains and resolved snapshot shown above. Existing Discovery and Service Impact definitions supply the measures; changing header filters refreshes the briefing.</p><p>Findings are deduplicated within the selected systems. CVE observations, discovery checks, configuration items and server patch records are different populations and must not be added together. Patch status follows recorded assessment, installation, restart and verification evidence. N/A means there is no applicable denominator.</p><p>The terrain illustration is conceptual. Services and capabilities use recorded associations. Empty results and zero findings do not establish compliance or absence of exposure.</p><div className="insight-footer-links"><Destination href={discovery("overview")}>Discovery overview</Destination><Destination href={discovery("shadow-it")}>Shadow IT Explorer</Destination><Destination href={insightsHref(scope, "/cyber-cop", { key: "copView", value: "ict-system-dependencies" })}>ICT System Dependencies</Destination></div></details>
    </footer>
  </article>;
}
