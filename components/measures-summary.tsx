import Link from "next/link";
import { FindingsDurationPanel, severityBarColors } from "@/components/findings-duration-panel";
import { IndicatorReviewScroll } from "@/components/indicator-review-scroll";
import { OpenSettingsButton } from "@/components/open-settings-button";
import { measuresHref, measuresFindingsHref, type MeasureRecord, type MeasureFilters } from "@/lib/measures-explorer";
import type { MeasuresSummaryModel } from "@/lib/measures-summary";
import type { Filters } from "@/lib/types";

const number = (value: number) => value.toLocaleString("en-AU");
const resultFilter = (result: string): MeasureFilters => ({ search: "", columns: { result: [result] } });
const idFilter = (id: string): MeasureFilters => ({ search: "", columns: { id: [id] } });
function Arrow() { return <span aria-hidden="true">↗</span>; }
function ComplianceBar({ label, percent, compliant, nonCompliant, unknown, total }: {
  label: string; percent: number | null; compliant: number; nonCompliant: number; unknown: number; total: number;
}) {
  if (!total || percent === null) return <div className="measures-compliance-bar" role="img" aria-label={`${label}: no assessments`} title="No assessments">
    <span className="measures-compliance-value">N/A</span>
  </div>;
  const description = `${percent}% compliant; ${number(compliant)} compliant, ${number(nonCompliant)} non-compliant, ${number(unknown)} unknown out of ${number(total)} assessments.`;
  return <div className="measures-compliance-bar" role="meter" aria-label={`${label} compliance`} aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={percent} aria-valuetext={description} title={description}>
    <span className="measures-compliance-good" style={{ width: `${compliant / total * 100}%` }} aria-hidden="true" />
    <span className="measures-compliance-gap" style={{ width: `${nonCompliant / total * 100}%` }} aria-hidden="true" />
    <span className="measures-compliance-value" aria-hidden="true">{percent}%</span>
  </div>;
}
function IndicatorReview({ rows, href }: { rows: MeasureRecord[]; href: (id: string) => string }) {
  return rows.length ? <div className="measures-summary-review"><table><thead><tr><th scope="col">Indicator</th><th scope="col">Compliance</th><th scope="col">Non-compliant</th><th scope="col">Unknown</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link prefetch={false} href={href(row.id)}><span>{row.id}</span> {row.name} <Arrow /></Link></td><td data-label="Compliance"><ComplianceBar label={row.id} percent={row.scorePercent} compliant={row.compliant} nonCompliant={row.nonCompliant} unknown={row.unknown} total={row.total} /></td><td data-label="Non-compliant" className="measure-gap">{number(row.nonCompliant)}</td><td data-label="Unknown" className="measure-unknown">{number(row.unknown)}</td></tr>)}</tbody></table></div> : <p className="discovery-overview-empty">No non-compliant or unknown results are recorded for these indicators.</p>;
}
export function MeasuresSummary({ model, filters, snapshotDate, allSpiReportHref }: {
  model: MeasuresSummaryModel; filters: Filters; snapshotDate: string; allSpiReportHref: string;
}) {
  const href = (tab: "measures-kpi" | "measures-spi", selection?: MeasureFilters) => measuresHref(tab, filters, snapshotDate, selection);
  const kpiGap = href("measures-kpi", resultFilter("Non-compliant"));
  const spiGap = href("measures-spi", resultFilter("Non-compliant"));
  const unknown = href("measures-spi", resultFilter("Unknown"));
  const findings = measuresFindingsHref(filters, snapshotDate);
  return <div className="workspace-page discovery-overview measures-summary">
    <header className="endpoint-hero discovery-overview-hero"><div><h1>Measures Summary</h1><div className="discovery-overview-context"><span><strong>{number(model.totalCis)}</strong> CIs in scope</span><span><strong>{model.kpis.total}</strong> KPIs / <strong>{model.spis.total}</strong> SPIs</span><span>Executive review of performance, posture and priorities</span></div></div><div className="discovery-overview-snapshot"><span>Snapshot</span><strong>{snapshotDate}</strong></div></header>
    <section className="discovery-overview-metrics" aria-label="Executive measure findings">{[
      { label: "KPIs with non-compliance", value: model.kpis.nonCompliant, note: `${model.kpis.fullyCompliant} fully compliant / ${model.kpis.total} indicators`, href: kpiGap, tone: "amber" },
      { label: "SPIs with non-compliance", value: model.spis.nonCompliant, note: `${number(model.affectedCis)} distinct CIs affected`, href: spiGap, tone: "cyan" },
      { label: "SPIs with unknown results", value: model.spis.unknown, note: `${number(model.unknownCis)} CIs need assessment evidence`, href: unknown, tone: "violet" },
      { label: "Open findings", value: model.openFindings, note: `${number(model.openUnknownFindings)} relate to unknown results`, href: findings, tone: "teal" }
    ].map((tile) => <Link prefetch={false} key={tile.label} href={tile.href} className={`discovery-overview-metric tone-${tile.tone}`}><strong>{number(tile.value)}</strong><div><span>{tile.label}</span><small>{tile.note}</small></div><Arrow /></Link>)}</section>
    <div className="discovery-overview-primary">
      <section className="discovery-overview-panel" aria-labelledby="summary-kpi-title"><header><h2 id="summary-kpi-title">KPI performance</h2><Link prefetch={false} href={href("measures-kpi")}>All KPIs <Arrow /></Link></header>
        <div className="measures-summary-coverage">
          <div><span>Compliant KPI assessments</span><span>{number(model.kpiAssessment.compliant)} / {number(model.kpiAssessment.assessed)} ICT system checks</span></div>
          <ComplianceBar label="Overall KPI" percent={model.kpiAssessment.percent} compliant={model.kpiAssessment.compliant}
            nonCompliant={model.kpiAssessment.nonCompliant} unknown={model.kpiAssessment.unknown} total={model.kpiAssessment.assessed} />
        </div>
        <div className="measures-summary-status"><Link prefetch={false} href={href("measures-kpi", resultFilter("Fully compliant"))}>{model.kpis.fullyCompliant} fully compliant</Link><Link prefetch={false} href={href("measures-kpi", resultFilter("Unknown"))}>{model.kpis.unknown} with unknowns</Link><Link prefetch={false} href={href("measures-kpi", resultFilter("No assessments"))}>{model.kpis.unassessed} unassessed</Link></div>
        <IndicatorReviewScroll labelledBy="summary-kpi-title"><IndicatorReview rows={model.kpis.review} href={(id) => href("measures-kpi", idFilter(id))} /></IndicatorReviewScroll>
      </section>
      <section className="discovery-overview-panel" aria-labelledby="summary-spi-title"><header><h2 id="summary-spi-title">Security posture</h2><Link prefetch={false} href={href("measures-spi")}>All SPIs <Arrow /></Link></header>
        <div className="measures-summary-coverage">
          <div><span>Compliant SPI assessments</span><span>{number(model.spiAssessment.compliant)} / {number(model.spiAssessment.assessed)} CI checks</span></div>
          <ComplianceBar label="Overall SPI" percent={model.spiAssessment.percent} compliant={model.spiAssessment.compliant}
            nonCompliant={model.spiAssessment.nonCompliant} unknown={model.spiAssessment.unknown} total={model.spiAssessment.assessed} />
        </div>
        <div className="measures-summary-status"><Link prefetch={false} href={href("measures-spi", resultFilter("Fully compliant"))}>{model.spis.fullyCompliant} fully compliant</Link><Link prefetch={false} href={href("measures-spi", resultFilter("No assessments"))}>{model.spis.unassessed} unassessed</Link><a href={allSpiReportHref} target="_blank" rel="noreferrer">All-SPI report <Arrow /></a></div>
        <IndicatorReviewScroll labelledBy="summary-spi-title"><IndicatorReview rows={model.spis.review} href={(id) => href("measures-spi", idFilter(id))} /></IndicatorReviewScroll>
      </section>
    </div>
    <div className="discovery-overview-explorers measures-summary-lower">
      <section className="discovery-overview-panel" aria-labelledby="summary-severity-title"><header className="flex-wrap"><h2 id="summary-severity-title">Open finding by severity</h2><div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1"><Link prefetch={false} href={findings} className="text-[.73rem] text-[#82d9e9] hover:underline">Findings <Arrow /></Link><OpenSettingsButton tab="spi-risk-matrix">SPI Risk Matrix <Arrow /></OpenSettingsButton></div></header><p className="discovery-overview-note">Observed classifications in the selected scope.</p>
        <div className="measures-severity-bars">{model.severities.map((group) => <Link prefetch={false} href={measuresFindingsHref(filters, snapshotDate, { severity: group.key })} key={group.key}><span>{group.label}</span><div aria-hidden="true"><span style={{ width: `${model.openFindings ? group.count / model.openFindings * 100 : 0}%`, backgroundColor: severityBarColors[group.key] }} /></div><strong>{number(group.count)}</strong><Arrow /></Link>)}</div>
        {!model.openFindings && <p className="discovery-overview-note">No open findings in this scope.</p>}
      </section>
      <section className="discovery-overview-panel" aria-labelledby="summary-priority-title"><header><h2 id="summary-priority-title">Priority focus</h2><OpenSettingsButton tab="spi-priority-matrix">SPI Priority Matrix <Arrow /></OpenSettingsButton></header><p className="discovery-overview-note">Configured SPI priority, then open non-compliant finding count.</p>
        <div className="measures-priority-focus">{model.priorityFocus.slice(0, 5).map((row) => <Link prefetch={false} href={href("measures-spi", idFilter(row.id))} key={row.id}><span className="endpoint-type-badge">{row.priority}</span><span><strong>{row.id}</strong> {row.name}</span><b>{number(row.nonCompliant)}</b><Arrow /></Link>)}</div>
        {!model.priorityFocus.length && <p className="discovery-overview-empty">No open non-compliant SPI findings to prioritise.</p>}
        <p className="discovery-overview-note">Global matrix saved {model.settingsUpdatedAt.slice(0, 10) || "date unavailable"}. Settings apply across the estate.</p>
      </section>
      <FindingsDurationPanel model={model} filters={filters} snapshotDate={snapshotDate} />
    </div>
    <details className="discovery-overview-method"><summary>How to interpret this summary</summary><div><p>Overall bars include all KPI or SPI assessments in scope, including fully compliant indicators omitted from the review tables. KPI compliance is compliant ICT system checks divided by all applicable KPI checks; each system contributes one check per KPI. SPI compliance is compliant CI assessments divided by all applicable SPI assessments. Both totals include unknown results. A scope with no assessments shows N/A.</p><p>A CI can fail several indicators or have both non-compliant and unknown results. Distinct CI counts are deduplicated; indicator and finding counts must not be added together.</p><p>Open findings use observed severity and priority classifications. The SPI Risk Matrix shows the saved global severity-by-CI-type settings; the SPI Priority Matrix shows the saved global priorities. Unknown findings can retain their separate classification. Severity filtering affects findings-based metrics; SPI assessment scores follow the other page filters.</p></div></details>
  </div>;
}
