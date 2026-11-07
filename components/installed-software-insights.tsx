"use client";

import type { ReactNode } from "react";
import Link from "@/components/persona-link";
import { SoftwareInsightsBriefing } from "@/components/software-insights-briefing";
import { discoveryExplorerHref } from "@/lib/discovery-explorer-links";
import { NOT_RECORDED, type DiscoveryAge } from "@/lib/endpoint-explorer";
import { emptySoftwareFilters, type SoftwareColumn, type SoftwareFilters } from "@/lib/installed-software-explorer";
import type { InstalledSoftwareInsightsModel } from "@/lib/installed-software-insights";
import { type WorkspaceSearchParams } from "@/lib/workspace-navigation";

const number = (value: number) => value.toLocaleString("en-AU");
const percent = (value: number | null) => value === null ? "N/A" : `${value}%`;
type Count = { value: string; count: number };

function EvidenceLink({ href, children, count }: { href: string; children: ReactNode; count?: number }) {
  return <Link href={href} prefetch={false} className="software-evidence-link" data-software-count={count}>{children}<span aria-hidden="true">↗</span></Link>;
}
function Bars({ rows, total, href, tone = "cyan" }: { rows: Count[]; total: number; href: (value: string) => string; tone?: string }) {
  const shown = rows.slice(0, 6), remaining = total - shown.reduce((sum, row) => sum + row.count, 0);
  return <><ul className={`software-bars is-${tone}`}>{shown.map(row => <li key={row.value}>
    <Link href={href(row.value)} prefetch={false} data-software-count={row.count} aria-label={`${row.value}: ${number(row.count)} installations. Open in Explorer`}>
      <span className="software-bar-label">{row.value}</span><strong>{number(row.count)}</strong>
      <span className="software-bar-track" aria-hidden="true"><span style={{ width: `${total ? row.count / total * 100 : 0}%` }} /></span>
    </Link></li>)}</ul>{remaining > 0 && <p className="software-note">{number(remaining)} other installations outside these groups.</p>}</>;
}
function Card({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <section className="software-card"><header><h2>{title}</h2><p>{subtitle}</p></header>{children}</section>;
}
function Ring({ model }: { model: InstalledSoftwareInsightsModel }) {
  const coverage = model.total ? model.knownVersion / model.total * 100 : 0;
  return <div className="software-ring"><svg viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="9" />
    <circle className="software-ring-fill" cx="60" cy="60" r="50" fill="none" strokeWidth="9" pathLength="100" strokeDasharray={`${coverage} ${100 - coverage}`} transform="rotate(-90 60 60)" />
  </svg><div><strong>{percent(model.versionPercent)}</strong><span>version recorded</span></div></div>;
}
export function InstalledSoftwareDashboard({ model, scope }: { model: InstalledSoftwareInsightsModel; scope: WorkspaceSearchParams }) {
  const href = (filters?: SoftwareFilters) => discoveryExplorerHref("installed-software", scope, model.snapshotDate, filters);
  const columnHref = (column: SoftwareColumn, value: string) => href({ ...emptySoftwareFilters(), columns: { [column]: [value] } });
  const recencyHref = (value: string) => href({ ...emptySoftwareFilters(), recency: [value as DiscoveryAge] });
  return <article className="software-insights is-dashboard" data-software-snapshot={model.snapshotDate} data-software-total={model.total}>
    <header className="software-insights-hero">
      <div><p className="software-kicker">Discovery / Software intelligence</p><h1>Installed Software Dashboard</h1></div>
      <div className="software-dashboard-context"><span>Snapshot <time dateTime={model.snapshotDate}>{model.snapshotDate}</time></span>
        <EvidenceLink href={href()}>Open Installed Software Explorer</EvidenceLink></div>
    </header>
    {!model.total ? <SoftwareEmptyState /> : <div className="software-dashboard-body">
        <div className="software-metrics" aria-label="Software inventory summary">
          {[{ label: "Installations", value: model.total, detail: "Software / endpoint entries" },
            { label: "Named products", value: model.products.length, detail: "Distinct recorded product names" },
            { label: "Endpoints represented", value: model.endpoints, detail: "Endpoints with software records" },
            { label: "Products with multiple versions", value: model.versionSpread.length, detail: "Two or more recorded versions" }].map((metric, index) => <div className="software-metric" key={metric.label}>
              <span className="software-metric-index" aria-hidden="true">0{index + 1}</span><span>{metric.label}</span><strong>{number(metric.value)}</strong><small>{metric.detail}</small></div>)}
        </div>
        <div className="software-dashboard-grid">
          <Card title="Most installed products" subtitle="Top 6 products · share of all installations">
            <Bars rows={model.products} total={model.total} href={value => columnHref("softwareName", value)} />
          </Card>
          <Card title="How fresh is the evidence?" subtitle="Discovery age at snapshot · installations">
            <Bars rows={model.recency} total={model.total} href={recencyHref} tone="amber" />
          </Card>
          <Card title="Version visibility" subtitle="Installations with a recorded version">
            <div className="software-version-coverage"><Ring model={model} /><div><strong>{number(model.knownVersion)} of {number(model.total)}</strong><p>installations have a version recorded.</p>
              <EvidenceLink href={columnHref("softwareVersion", NOT_RECORDED)} count={model.missingVersion}>{number(model.missingVersion)} missing versions</EvidenceLink></div></div>
          </Card>
          <Card title="Version variation" subtitle="Top 5 products · ranked by version count">
            <ol className="software-version-list">{model.versionSpread.slice(0, 5).map(row => <li key={row.value}><div><EvidenceLink href={columnHref("softwareName", row.value)} count={row.count}>{row.value}</EvidenceLink><small>{number(row.count)} installations · {number(row.endpoints)} endpoints</small></div><strong>{number(row.versions)}<small>versions</small></strong></li>)}</ol>
            {!model.versionSpread.length && <p className="software-note">No named product has multiple recorded versions in this selection. Missing versions are excluded.</p>}
            {model.versionSpread.length > 5 && <p className="software-note">Showing 5 of {number(model.versionSpread.length)} products with version variation.</p>}
          </Card>
          <Card title="Host operating systems" subtitle="Installations by host OS · top 6 groups">
            <Bars rows={model.operatingSystems} total={model.total} href={value => columnHref("osName", value)} tone="violet" />
          </Card>
          <Card title="Where the evidence comes from" subtitle="Installations by discovery source · top 6 groups">
            <Bars rows={model.sources} total={model.total} href={value => columnHref("discoveredBy", value)} tone="mint" />
          </Card>
        </div>
    </div>}
    <SoftwareMethodology unnamed={model.unnamed} />
  </article>;
}

export function InstalledSoftwareInsights({ model, scope }: { model: InstalledSoftwareInsightsModel; scope: WorkspaceSearchParams }) {
  return <article className="software-insights is-story" data-software-snapshot={model.snapshotDate} data-software-total={model.total}>
    <header className="software-insights-hero is-briefing"><div><p className="software-kicker">Governance / Software intelligence</p><h1>Installed Software Insights</h1></div></header>
    {model.total ? <SoftwareInsightsBriefing model={model} scope={scope} /> : <SoftwareEmptyState />}
    <SoftwareMethodology unnamed={model.unnamed} />
  </article>;
}

function SoftwareEmptyState() {
  return <section className="software-card software-empty"><p className="software-kicker">No inventory records</p><h2>No installed software in this selection</h2><p>Choose another network, ICT system, security domain or snapshot. An empty inventory does not confirm that no software is installed.</p></section>;
}

function SoftwareMethodology({ unnamed }: { unnamed: number }) {
  return <footer className="software-insights-footer"><details><summary>How to read these insights</summary><p>This page uses the same scoped software records and resolved snapshot as Installed Software Explorer. Counts describe recorded installations, not licences, all endpoints, vulnerability exposure or support compliance. Named products exclude missing names ({number(unnamed)} installations); version variation excludes missing names and versions. Names are not merged across spelling or case differences.</p><p>A version entry alone does not establish support status, currency or absence of vulnerabilities. Discovery age is measured against the snapshot, not today. Missing or invalid dates and dates after the snapshot remain separate. Charts show counts and links to matching records. Empty selections show no evidence rather than an assurance score.</p></details></footer>;
}
