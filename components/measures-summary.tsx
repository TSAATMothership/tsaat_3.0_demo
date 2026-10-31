import Link from "next/link";
import { OpenSettingsButton } from "@/components/open-settings-button";
import { measuresHref, measuresFindingsHref, type MeasureRecord, type MeasureFilters } from "@/lib/measures-explorer";
import type { MeasuresSummaryModel } from "@/lib/measures-summary";
import type { Filters } from "@/lib/types";

const number = (value: number) => value.toLocaleString("en-AU");
const resultFilter = (result: string): MeasureFilters => ({ search: "", columns: { result: [result] } });
const idFilter = (id: string): MeasureFilters => ({ search: "", columns: { id: [id] } });
function Arrow() { return <span aria-hidden="true">↗</span>; }
function IndicatorReview({ rows, href }: { rows: MeasureRecord[]; href: (id: string) => string }) {
  return rows.length ? <div className="measures-summary-review"><table><thead><tr><th scope="col">Indicator</th><th scope="col">Compliance</th><th scope="col">Non-compliant</th><th scope="col">Unknown</th></tr></thead><tbody>{rows.slice(0, 5).map((row) => <tr key={row.id}><td><Link prefetch={false} href={href(row.id)}><span>{row.id}</span> {row.name} <Arrow /></Link></td><td data-label="Compliance">{row.total ? `${row.scorePercent}%` : "N/A"}</td><td data-label="Non-compliant" className="measure-gap">{number(row.nonCompliant)}</td><td data-label="Unknown" className="measure-unknown">{number(row.unknown)}</td></tr>)}</tbody></table></div> : <p className="discovery-overview-empty">No non-compliant or unknown results are recorded for these indicators.</p>;
}
export function MeasuresSummary({ model, filters, snapshotDate, allSpiReportHref }: {
  model: MeasuresSummaryModel; filters: Filters; snapshotDate: string; allSpiReportHref: string;
}) {
  const href = (tab: "measures-kpi" | "measures-spi", selection?: MeasureFilters) => measuresHref(tab, filters, snapshotDate, selection);
  const kpiGap = href("measures-kpi", resultFilter("Non-compliant"));
  const spiGap = href("measures-spi", resultFilter("Non-compliant"));
  const unknown = href("measures-spi", resultFilter("Unknown"));
  const findings = measuresFindingsHref(filters, snapshotDate);
  const actions = [
    { title: "Request plans for KPI exceptions", detail: "Review the success measures and assign follow-up for performance exceptions.", count: model.kpis.nonCompliant, unit: "KPIs", href: kpiGap },
    { title: "Prioritise posture remediation", detail: `${number(model.affectedCis)} affected CIs across ${number(model.affectedNetworks)} networks and ${number(model.affectedSystems)} ICT systems.`, count: model.spis.nonCompliant, unit: "SPIs", href: spiGap },
    { title: "Close gaps in assessment evidence", detail: `${number(model.unknownCis)} CIs have at least one unknown SPI result.`, count: model.spis.unknown, unit: "SPIs", href: unknown },
    { title: "Review unassessed KPIs", detail: "Confirm applicability and collection coverage before interpreting performance.", count: model.kpis.unassessed, unit: "KPIs", href: href("measures-kpi", resultFilter("No assessments")) },
    { title: "Review unassessed SPIs", detail: "Confirm applicability and collection coverage before interpreting posture.", count: model.spis.unassessed, unit: "SPIs", href: href("measures-spi", resultFilter("No assessments")) }
  ].filter((action) => action.count > 0);
  return <div className="workspace-page discovery-overview measures-summary">
    <header className="endpoint-hero discovery-overview-hero"><div><h1>Measures Summary</h1><div className="discovery-overview-context"><span><strong>{number(model.totalCis)}</strong> CIs in scope</span><span><strong>{model.kpis.total}</strong> KPIs / <strong>{model.spis.total}</strong> SPIs</span><span>Executive review of performance, posture and priorities</span></div></div><div className="discovery-overview-snapshot"><span>Snapshot</span><strong>{snapshotDate}</strong></div></header>
    <section className="discovery-overview-metrics" aria-label="Executive measure findings">{[
      { label: "KPIs with non-compliance", value: model.kpis.nonCompliant, note: `${model.kpis.fullyCompliant} fully compliant / ${model.kpis.total} indicators`, href: kpiGap, tone: "amber" },
      { label: "SPIs with non-compliance", value: model.spis.nonCompliant, note: `${number(model.affectedCis)} distinct CIs affected`, href: spiGap, tone: "cyan" },
      { label: "SPIs with unknown results", value: model.spis.unknown, note: `${number(model.unknownCis)} CIs need assessment evidence`, href: unknown, tone: "violet" },
      { label: "Open findings", value: model.openFindings, note: `${number(model.openUnknownFindings)} relate to unknown results`, href: findings, tone: "teal" }
    ].map((tile) => <Link prefetch={false} key={tile.label} href={tile.href} className={`discovery-overview-metric tone-${tile.tone}`}><strong>{number(tile.value)}</strong><div><span>{tile.label}</span><small>{tile.note}</small></div><Arrow /></Link>)}</section>
    <div className="discovery-overview-primary">
      <section className="discovery-overview-panel" aria-labelledby="summary-kpi-title"><header><h2 id="summary-kpi-title">KPI performance</h2><Link prefetch={false} href={href("measures-kpi")}>All KPIs <Arrow /></Link></header><p className="discovery-overview-note">Largest non-compliant populations first; each KPI retains its own assessment basis.</p>
        <div className="measures-summary-status"><Link prefetch={false} href={href("measures-kpi", resultFilter("Fully compliant"))}>{model.kpis.fullyCompliant} fully compliant</Link><Link prefetch={false} href={href("measures-kpi", resultFilter("Unknown"))}>{model.kpis.unknown} with unknowns</Link><Link prefetch={false} href={href("measures-kpi", resultFilter("No assessments"))}>{model.kpis.unassessed} unassessed</Link></div>
        <IndicatorReview rows={model.kpis.review} href={(id) => href("measures-kpi", idFilter(id))} />
        {model.kpis.review.length > 5 && <p className="discovery-overview-note">Showing 5 of {model.kpis.review.length} indicators requiring review.</p>}
      </section>
      <section className="discovery-overview-panel" aria-labelledby="summary-spi-title"><header><h2 id="summary-spi-title">Security posture</h2><Link prefetch={false} href={href("measures-spi")}>All SPIs <Arrow /></Link></header>
        <div className="discovery-overview-coverage-total"><strong>{model.spiAssessment.percent === null ? "N/A" : `${model.spiAssessment.percent}%`}</strong><span>compliant SPI assessments</span><p>{number(model.spiAssessment.compliant)} / {number(model.spiAssessment.assessed)} CI checks</p></div>
        <div className="measures-summary-status"><Link prefetch={false} href={href("measures-spi", resultFilter("Fully compliant"))}>{model.spis.fullyCompliant} fully compliant</Link><Link prefetch={false} href={href("measures-spi", resultFilter("No assessments"))}>{model.spis.unassessed} unassessed</Link><a href={allSpiReportHref} target="_blank" rel="noreferrer">All-SPI report <Arrow /></a></div>
        <IndicatorReview rows={model.spis.review} href={(id) => href("measures-spi", idFilter(id))} />
        {model.spis.review.length > 5 && <p className="discovery-overview-note">Showing 5 of {model.spis.review.length} indicators requiring review.</p>}
      </section>
    </div>
    <div className="discovery-overview-explorers measures-summary-lower">
      <section className="discovery-overview-panel" aria-labelledby="summary-severity-title"><header className="flex-wrap"><h2 id="summary-severity-title">Open finding by severity</h2><div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1"><Link prefetch={false} href={findings} className="text-[.73rem] text-[#82d9e9] hover:underline">Findings <Arrow /></Link><OpenSettingsButton tab="spi-risk-matrix">SPI Risk Matrix <Arrow /></OpenSettingsButton></div></header><p className="discovery-overview-note">Observed classifications in the selected scope.</p>
        <div className="measures-severity-bars">{model.severities.map((group) => <Link prefetch={false} href={measuresFindingsHref(filters, snapshotDate, { severity: group.key })} key={group.key}><span>{group.label}</span><div aria-hidden="true"><span style={{ width: `${model.openFindings ? group.count / model.openFindings * 100 : 0}%` }} /></div><strong>{number(group.count)}</strong><Arrow /></Link>)}</div>
        {!model.openFindings && <p className="discovery-overview-note">No open findings in this scope.</p>}
      </section>
      <section className="discovery-overview-panel" aria-labelledby="summary-priority-title"><header><h2 id="summary-priority-title">Priority focus</h2><OpenSettingsButton tab="spi-risk-matrix">SPI Risk Matrix <Arrow /></OpenSettingsButton></header><p className="discovery-overview-note">Configured SPI priority, then open non-compliant finding count.</p>
        <div className="measures-priority-focus">{model.priorityFocus.slice(0, 5).map((row) => <Link prefetch={false} href={href("measures-spi", idFilter(row.id))} key={row.id}><span className="endpoint-type-badge">{row.priority}</span><span><strong>{row.id}</strong> {row.name}</span><b>{number(row.nonCompliant)}</b><Arrow /></Link>)}</div>
        {!model.priorityFocus.length && <p className="discovery-overview-empty">No open non-compliant SPI findings to prioritise.</p>}
        <p className="discovery-overview-note">Global matrix saved {model.settingsUpdatedAt.slice(0, 10) || "date unavailable"}. Settings apply across the estate.</p>
      </section>
      <section className="discovery-overview-panel discovery-overview-actions" aria-labelledby="summary-actions-title"><header><h2 id="summary-actions-title">Executive review queue</h2></header>
        {actions.length ? <ol>{actions.map((action) => <li key={action.title}><Link prefetch={false} href={action.href}><div className="discovery-overview-action-heading"><h3>{action.title}</h3><span className="discovery-overview-action-count"><strong>{number(action.count)}</strong><small>{action.unit}</small><Arrow /></span></div><p>{action.detail}</p></Link></li>)}</ol> : <p className="discovery-overview-empty">{model.kpis.total || model.spis.total ? "No exceptions in these checks. Review indicator definitions and trend reports for further context." : "No indicator results are available for this scope and snapshot."}</p>}
      </section>
    </div>
    <details className="discovery-overview-method"><summary>How to interpret this summary</summary><div><p>KPI populations can represent different entities, so KPI percentages are shown individually. SPI compliance is compliant CI assessments divided by all applicable SPI assessments, including unknown results. An unassessed indicator shows N/A.</p><p>A CI can fail several indicators or have both non-compliant and unknown results. Distinct CI counts are deduplicated; indicator and finding counts must not be added together.</p><p>Open findings use observed severity and priority classifications. The SPI Risk Matrix shows the saved global severity-by-CI-type and priority settings. Unknown findings can retain their separate classification. Severity filtering affects findings-based metrics; SPI assessment scores follow the other page filters.</p></div></details>
  </div>;
}
