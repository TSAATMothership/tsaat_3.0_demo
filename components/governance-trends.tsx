"use client";

import { useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Papa from "papaparse";
import { FindingsDataTable } from "@/components/findings-data-table";
import PersonaLink from "@/components/persona-link";
import type { ExplorerColumn } from "@/lib/explorer-table";
import { insightsHref } from "@/lib/governance-insights";
import { TREND_HISTORY_OPTIONS, trendMovement, type GovernanceTrendPoint, type GovernanceTrendsModel } from "@/lib/governance-trends";
import { startRouteLoading } from "@/lib/route-loading";

const number = (value: number) => value.toLocaleString("en-AU");
const percent = (value: number | null) => value === null ? "N/A" : `${value.toFixed(1)}%`;
const date = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
type Metric = "compliance" | "lifecycle" | "discovery";
const topics = [
  { key: "compliance", ordinal: "01", label: "Compliance", caption: "Recorded SPI checks compliant", direction: "Higher is better", higher: true },
  { key: "lifecycle", ordinal: "02", label: "Life cycle", caption: "Servers with lifecycle issues", direction: "Lower is better", higher: false },
  { key: "discovery", ordinal: "03", label: "Discovery", caption: "Required discovery checks covered", direction: "Higher is better", higher: true }
] as const;
const evidenceColumns: ExplorerColumn<GovernanceTrendPoint>[] = [
  { key: "date", label: "Snapshot", value: row => row.date },
  { key: "assets", label: "Scoped CIs", value: row => row.scopedAssets },
  { key: "compliance", label: "SPI compliance", value: row => percent(row.compliance) },
  { key: "unknown", label: "Unknown SPI checks", value: row => row.unknown },
  { key: "lifecycle", label: "Servers with issues / total", value: row => `${row.serversAtRisk} / ${row.servers}` },
  { key: "gaps", label: "Servers with evidence gaps", value: row => row.serversWithGaps },
  { key: "discovery", label: "Discovery coverage", value: row => percent(row.discovery) }
];

function Movement({ latest, baseline, higher = true }: { latest: number | null; baseline: number | null; higher?: boolean }) {
  const movement = trendMovement(latest, baseline, higher);
  return <span className={`executive-movement is-${movement.tone}`}>
    {movement.delta !== null && <b>{movement.delta > 0 ? "+" : ""}{movement.delta.toFixed(1)} pp</b>} {movement.label}
  </span>;
}

/** Date-spaced observed points; null evidence breaks the line instead of becoming zero. */
function TrendChart({ points, from, to, metric, title, compact = false, counts = false }: {
  from: string; to: string;
  points: GovernanceTrendPoint[]; metric: Metric | "warrantyExpired" | "unsupportedInstallations" | "oldOperatingSystems";
  title: string; compact?: boolean; counts?: boolean;
}) {
  const id = useId();
  const [selected, setSelected] = useState(points.length - 1);
  const firstTime = Date.parse(from), duration = Date.parse(to) - firstTime;
  const values = points.map(point => point[metric]);
  const max = counts ? Math.max(2, Math.ceil(Math.max(...values.map(value => value ?? 0)) / 2) * 2) : 100;
  const x = (index: number) => duration ? 12 + (Date.parse(points[index].date) - firstTime) / duration * 500 : 262;
  const y = (value: number) => 132 - value / max * 112;
  const paths: string[] = [];
  let segment = "";
  points.forEach((point, index) => {
    const value = point[metric];
    if (value === null) { if (segment) paths.push(segment); segment = ""; }
    else segment += `${segment ? " L" : "M"}${x(index)},${y(value)}`;
  });
  if (segment) paths.push(segment);
  const current = points[selected];
  const format = (value: number | null) => value === null ? "N/A" : counts ? number(value) : percent(value);
  return <div className={`executive-chart${compact ? " is-compact" : ""}`}>
    <div className="executive-chart-plot">
    {!compact && <div className="executive-chart-axis" aria-hidden="true">{[max, max / 2, 0].map(tick => <span key={tick} style={{ top: `${y(tick) / 148 * 100}%` }}>{tick}{!counts && "%"}</span>)}</div>}
    <svg viewBox="0 0 524 148" preserveAspectRatio={compact ? "none" : "xMidYMid meet"} role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-description`}>{points.length} recorded snapshots in the period {date(from)} to {date(to)}. Latest observation: {date(points.at(-1)!.date)}, {format(values.at(-1)!)}. Points are spaced by date. Missing values break the line. {compact ? "Exact values are available in the evidence CSV." : "Choose a snapshot below to inspect its value."}</desc>
      {[0, max / 2, max].map(tick => <line key={tick} x1="12" x2="512" y1={y(tick)} y2={y(tick)} className="executive-chart-grid" />)}
      {paths.map((path, index) => <path key={index} d={path} fill="none" className="executive-chart-line" />)}
      {!compact && current[metric] !== null && <line x1={x(selected)} x2={x(selected)} y1="16" y2="132" className="executive-chart-cursor" />}
      {points.map((point, index) => point[metric] !== null && <circle key={point.date} cx={x(index)} cy={y(point[metric]!)} r={!compact && index === selected ? 5 : 3} className="executive-chart-point">
        <title>{`${date(point.date)}: ${format(point[metric])}`}</title></circle>)}
    </svg>
    </div>
    {!compact && <div className="executive-chart-dates" aria-hidden="true"><span>{date(from)}</span><span>{date(to)}</span></div>}
    {!compact && <div className="executive-chart-inspect"><label htmlFor={`${id}-snapshot`}>Inspect snapshot <select id={`${id}-snapshot`} aria-label={`Inspect ${title.toLowerCase()} snapshot`} value={selected} onChange={event => setSelected(Number(event.target.value))}>
      {points.map((point, index) => <option key={point.date} value={index}>{date(point.date)}</option>)}
    </select></label><strong role="status">{format(current[metric])}</strong></div>}
  </div>;
}

function exportEvidence(model: GovernanceTrendsModel) {
  const rows = model.points.map(point => ({
    "Snapshot": point.date, "History period": model.history === "week" ? "1 week" : "1 month", "Period start": model.from, "Requested through": model.cutoff,
    "Network IDs": model.scope.network.join(", "), "System IDs": model.scope.system.join(", "),
    "Security domains": model.scopeLabels.domains.join(", "), "Scoped CIs": point.scopedAssets,
    "SPI compliance (%)": point.compliance ?? "N/A", "Compliant checks": point.compliant, "Non-compliant checks": point.nonCompliant,
    "Unknown checks": point.unknown, "Recorded checks": point.checks, "Identified CIs without recorded checks": point.uncheckedAssets,
    "Servers with lifecycle issues (%)": point.lifecycle ?? "N/A", "Servers with issues": point.serversAtRisk, "Servers": point.servers,
    "Servers with multiple issue areas": point.compoundedServers, "Servers with lifecycle evidence gaps": point.serversWithGaps,
    "Out-of-warranty devices": point.warrantyExpired, "Unknown warranty devices": point.warrantyUnknown,
    "Unsupported software installations": point.unsupportedInstallations, "Devices with unsupported software": point.unsupportedDevices,
    "OS N-2+ devices": point.oldOperatingSystems, "Unknown OS version distance": point.unknownOsLag,
    "Discovery coverage (%)": point.discovery ?? "N/A", "Covered discovery checks": point.covered, "Required discovery checks": point.required,
    "CIs missing required coverage": point.discoveryGaps, "CIs without required discovery tools": point.unmapped, "Unidentified IP nodes": point.unidentified
  }));
  const url = URL.createObjectURL(new Blob([Papa.unparse(rows, { escapeFormulae: true })], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a"); link.href = url; link.download = `cyber-terrain-trends-${model.history}-${model.cutoff}.csv`;
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function GovernanceTrends({ model }: { model: GovernanceTrendsModel }) {
  const router = useRouter(), params = useSearchParams();
  const latest = model.points.at(-1), baseline = model.points.length > 1 ? model.points[0] : undefined;
  const movements = topics.map(topic => trendMovement(latest?.[topic.key] ?? null, baseline?.[topic.key] ?? null, topic.higher));
  const worse = movements.filter(movement => movement.tone === "attention").length;
  const better = movements.filter(movement => movement.tone === "good").length;
  const comparable = movements.filter(movement => movement.delta !== null).length;
  const headline = !latest ? "Build the evidence. See the direction." : !baseline ? "Your baseline starts here." : !comparable ? "Close the evidence gaps." : worse ? "Focus attention where the trend is turning." : better ? "Progress is visible. Keep it moving." : "A steady trend. Keep the evidence current.";
  const link = (path: string, view?: string) => insightsHref(model.scope, path, view ? { key: "discoveryView", value: view } : undefined);
  return <article className="workspace-page governance-trends" data-trends-snapshot={latest?.date ?? ""} data-trends-history={model.history} data-trends-from={model.from} data-trends-through={model.cutoff}>
    <header className="executive-masthead"><span>GOVERNANCE <span aria-hidden="true">/</span> EXECUTIVE BRIEFING</span><div>
      <label>History <select aria-label="Trend history" value={model.history} onChange={event => {
        const next = new URLSearchParams(params.toString()); next.delete("trendSnapshots"); next.set("trendHistory", event.target.value);
        const href = `/governance/trends?${next}`; startRouteLoading({ href, message: "Loading trend evidence…" }); router.push(href, { scroll: false });
      }}>{TREND_HISTORY_OPTIONS.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      <button type="button" className="executive-button" disabled={!latest} onClick={() => exportEvidence(model)}>Download evidence <span aria-hidden="true">↓</span></button>
    </div></header>
    <section className="executive-hero" aria-labelledby="trends-title">
      <div className="executive-hero-copy"><p className="executive-eyebrow">CYBER TERRAIN · DIRECTION OF TRAVEL</p>
        <h1 id="trends-title">Trends<span>From evidence to action.</span></h1><p className="executive-hero-lead">{headline}</p>
        <p>Compliance, life cycle and discovery in one management briefing.</p>
        <div className="executive-scope">{[...model.scopeLabels.networks, ...model.scopeLabels.systems].map((label, index) => <span key={index}>{label}</span>)}<span>{model.scopeLabels.domains.join(" · ") || "No security domains selected"}</span></div>
      </div>
      <aside className="executive-window" aria-label="Reporting period"><span className="executive-eyebrow">OBSERVATION WINDOW</span>
        <strong>{model.points.length}<small>recorded snapshots</small></strong>
        <p>{date(model.from)} — {date(model.cutoff)}</p>
        <span>{model.history === "week" ? "1 week" : "1 month"} · {latest ? `Latest evidence ${date(latest.date)}` : "No snapshots in this period"}</span>
        <svg viewBox="0 0 300 32" role="img" aria-label="Snapshot dates in the selected period"><line x1="8" x2="292" y1="16" y2="16" />{model.points.map(point => <circle key={point.date} cx={8 + (Date.parse(point.date) - Date.parse(model.from)) / (Date.parse(model.cutoff) - Date.parse(model.from)) * 284} cy="16" r="4"><title>{date(point.date)}</title></circle>)}</svg>
      </aside>
    </section>
    {!latest ? <section className="executive-empty"><h2>No snapshots in this history period</h2><p>Choose a different history period or header date to see recorded trends. Older or future snapshots are not used to fill this gap.</p></section> : <>
      <div className="executive-context"><p>{baseline ? <><strong>{better} improving · {worse} needing attention</strong> across {comparable} comparable indicators.</> : <strong>One snapshot establishes a baseline; a second is needed to show change.</strong>}</p>
        <span>{number(latest.scopedAssets)} CIs in the latest scope{baseline && <> · {number(model.population.entered)} entered / {number(model.population.left)} left since baseline</>}</span>
      </div>
      {latest.scopedAssets === 0 && <p className="executive-notice" role="status">No inventory matches this scope in the latest snapshot. N/A means there is no applicable denominator; it does not indicate compliance.</p>}
      <div className="executive-scorecards">{topics.map(topic => <a key={topic.key} className={`executive-scorecard is-${topic.key}`} href={`#trend-${topic.key}`}>
        <div className="executive-card-title"><span>{topic.ordinal} / {topic.label}</span><span aria-hidden="true">↗</span></div>
        <strong className="executive-value">{percent(latest[topic.key])}</strong><span className="executive-metric-label">{topic.caption}</span>
        <TrendChart points={model.points} from={model.from} to={model.cutoff} metric={topic.key} title={`${topic.label} overview`} compact />
        <Movement latest={latest[topic.key]} baseline={baseline?.[topic.key] ?? null} higher={topic.higher} />
        <small>{topic.direction} · {topic.key === "compliance" ? `${number(latest.compliant)} / ${number(latest.checks)} checks` : topic.key === "lifecycle" ? `${number(latest.serversAtRisk)} / ${number(latest.servers)} servers` : `${number(latest.covered)} / ${number(latest.required)} checks`}</small>
      </a>)}</div>
      <p className="executive-comparison-note">{baseline ? `Changes compare ${date(latest.date)} with ${date(baseline.date)}. pp = percentage points.` : "No previous snapshot in this window; changes are not estimated."} Inventory changes and current configured rules can influence the direction. These are observations, not forecasts or targets.</p>

      <section className="executive-section is-compliance" id="trend-compliance" aria-labelledby="trend-compliance-title">
        <header><div><p className="executive-eyebrow">01 / COMPLIANCE</p><h2 id="trend-compliance-title">Is assurance improving?</h2><p>Compliant recorded SPI checks as a share of all recorded checks.</p></div><PersonaLink className="executive-link" href={link("/measures")}>Review compliance <span aria-hidden="true">↗</span></PersonaLink></header>
        <div className="executive-detail-grid"><div className="executive-chart-card"><div className="executive-chart-heading"><h3>Compliance over time</h3><span>Higher is better</span></div><TrendChart points={model.points} from={model.from} to={model.cutoff} metric="compliance" title="Compliance" /></div>
          <div className="executive-evidence-card"><h3>Behind the latest rate</h3><div className="executive-distribution" aria-hidden="true">{[[latest.compliant, "good"], [latest.nonCompliant, "attention"], [latest.unknown, "unknown"]].map(([count, tone]) => <span className={`is-${tone}`} key={tone} style={{ flexGrow: Number(count) }} />)}</div>
            <dl className="executive-counts"><div><dt><i className="is-good" />Compliant</dt><dd>{number(latest.compliant)}</dd></div><div><dt><i className="is-attention" />Non-compliant</dt><dd>{number(latest.nonCompliant)}</dd></div><div><dt><i className="is-unknown" />Unknown</dt><dd>{number(latest.unknown)}</dd></div></dl>
            <p className="executive-footnote">Unknown results stay in the denominator. {number(latest.uncheckedAssets)} identified CIs have no recorded SPI checks.</p>
          </div></div>
      </section>

      <section className="executive-section is-lifecycle" id="trend-lifecycle" aria-labelledby="trend-lifecycle-title">
        <header><div><p className="executive-eyebrow">02 / LIFE CYCLE</p><h2 id="trend-lifecycle-title">Is technical debt building?</h2><p>Servers with at least one confirmed warranty, software support or OS issue.</p></div><PersonaLink className="executive-link" href={link("/discovery-coverage", "life-cycle-management")}>Review life cycle <span aria-hidden="true">↗</span></PersonaLink></header>
        <div className="executive-detail-grid"><div className="executive-chart-card"><div className="executive-chart-heading"><h3>Servers needing attention</h3><span>Lower is better</span></div><TrendChart points={model.points} from={model.from} to={model.cutoff} metric="lifecycle" title="Life cycle" /></div>
          <div className="executive-evidence-card"><h3>Plan the next intervention</h3><div className="executive-callout"><strong>{number(latest.compoundedServers)}</strong><span>servers have issues in multiple lifecycle areas</span></div><p>Bundle replacement, software upgrades and OS migration where issues overlap.</p><p className="executive-footnote">{number(latest.serversWithGaps)} servers have incomplete lifecycle evidence. Zero confirmed issues does not prove supportability.</p></div></div>
        <div className="executive-mini-grid">{([{ key: "warrantyExpired", title: "Out of warranty", unit: "hardware devices" }, { key: "unsupportedInstallations", title: "Unsupported software", unit: "installed copies" }, { key: "oldOperatingSystems", title: "Operating systems N−2+", unit: "devices" }] as const).map(item => <div className="executive-mini-card" key={item.key}><h3>{item.title}</h3><div><strong>{number(latest[item.key])}</strong><span>{item.unit}</span></div><TrendChart points={model.points} from={model.from} to={model.cutoff} metric={item.key} title={item.title} compact counts /><p>{baseline ? `${latest[item.key] - baseline[item.key] > 0 ? "+" : ""}${number(latest[item.key] - baseline[item.key])} since baseline` : "Baseline only"}</p></div>)}</div>
        {model.priorities.length > 0 && <div className="executive-server-priorities"><h3>Servers to discuss first <small>Latest snapshot · up to three priorities</small></h3><ol>{model.priorities.map(server => <li key={server.id}><span><strong>{server.name}</strong><small>{server.system} · {server.environment}{server.critical && " · Critical system"}</small></span><span>{server.issueCount ? server.issues.join(" · ") : "Verify missing lifecycle evidence"}<small>{server.gaps.length > 0 && `${server.gaps.length} evidence gaps`}</small></span></li>)}</ol></div>}
      </section>

      <section className="executive-section is-discovery" id="trend-discovery" aria-labelledby="trend-discovery-title">
        <header><div><p className="executive-eyebrow">03 / DISCOVERY</p><h2 id="trend-discovery-title">Are visibility gaps closing?</h2><p>Covered checks across the tools required for each CI type.</p></div><PersonaLink className="executive-link" href={link("/discovery-coverage", "tools")}>Review discovery <span aria-hidden="true">↗</span></PersonaLink></header>
        <div className="executive-detail-grid"><div className="executive-chart-card"><div className="executive-chart-heading"><h3>Required tool coverage</h3><span>Higher is better</span></div><TrendChart points={model.points} from={model.from} to={model.cutoff} metric="discovery" title="Discovery" /></div>
          <div className="executive-evidence-card"><h3>Visibility still to establish</h3><div className="executive-callout"><strong>{number(latest.discoveryGaps)}</strong><span>CIs missing at least one required discovery tool</span></div><p>{number(latest.unidentified)} unidentified IP nodes need identification.</p><p className="executive-footnote">{number(latest.unmapped)} CIs have no required tool mapping and contribute no checks to the coverage rate.</p></div></div>
        <div className="executive-tools"><h3>Where coverage needs attention <small>Latest snapshot · tools ordered by missing checks</small></h3>{model.tools.length ? model.tools.map(tool => <div className="executive-tool" key={tool.id}><div><strong>{tool.label}</strong><span>{number(tool.covered)} / {number(tool.applicable)} required checks · {number(tool.missing)} missing</span></div><div className="executive-tool-bar"><span style={{ width: `${tool.percent ?? 0}%` }} /></div><strong>{percent(tool.percent)}</strong><Movement latest={tool.percent} baseline={tool.baseline} /></div>) : <p>No required discovery tools apply to the latest inventory in this scope.</p>}</div>
      </section>

      <section className="executive-decisions" aria-labelledby="executive-decisions-title"><header><p className="executive-eyebrow">THE MANAGEMENT CONVERSATION</p><h2 id="executive-decisions-title">Turn the trend into a decision.</h2><p>Use the latest evidence to agree an owner, a next action and a review date.</p></header><div>
        <article><span>01 / ASSURE</span><h3>Close the compliance loop</h3><p>Review {number(latest.nonCompliant)} non-compliant checks and resolve {number(latest.unknown)} unknown results. Confirm evidence before claiming improvement.</p><PersonaLink href={link("/measures")}>Open compliance evidence ↗</PersonaLink></article>
        <article><span>02 / RENEW</span><h3>Sequence lifecycle investment</h3><p>Review {number(latest.serversAtRisk)} affected servers. Start with overlapping issues, critical systems and production dependencies.</p><PersonaLink href={link("/discovery-coverage", "life-cycle-management")}>Open lifecycle priorities ↗</PersonaLink></article>
        <article><span>03 / DISCOVER</span><h3>Assign visibility gaps</h3><p>Review {number(latest.discoveryGaps)} CIs with coverage gaps. Confirm collection ownership and investigate unidentified devices.</p><PersonaLink href={link("/discovery-coverage", "tools")}>Open discovery evidence ↗</PersonaLink></article>
      </div></section>
      <details className="executive-methodology"><summary>How to read this briefing &amp; snapshot evidence</summary><div>
        <p>All charts use recorded snapshots within the selected period ending on the header date: seven days for 1 week, or one calendar month for 1 month. Both boundary dates are included; month-end dates clamp to the last valid day. The same network, system and security domain apply to each snapshot. Scope membership can change over time. Lines connect observations; they do not estimate missing snapshots. A missing denominator is N/A. One snapshot cannot establish a trend.</p>
        <p>Current configurable SPI rules and discovery tool mappings are applied by the shared data providers. Historical percentages are a view of the recorded inventory under those settings, not an immutable record of past policy. Changes in scope membership, inventory or settings can move these indicators without remediation. Each percentage uses its own denominator; the three rates are not a combined score.</p>
        <p>Lifecycle issues use recorded warranty/support status and recorded OS version distance: exactly N−2 and older, or an unsupported OS. Missing evidence is separate from confirmed issues. Counts overlap and use different units. Hardware inventory has no physical/virtual classification; this page does not infer one. Server priorities reuse the Life Cycle Management ordering: affected areas, critical systems, production, OS distance and unsupported software.</p>
        <FindingsDataTable title="Snapshot evidence" rows={model.points} columns={evidenceColumns} searchable={false} columnFilters={false} paginate={false}
          actions={() => <button type="button" className="executive-button" onClick={() => exportEvidence(model)}>Download full evidence CSV</button>}
          renderRow={point => <tr key={point.date}>{evidenceColumns.map(column => <td key={column.key}>{column.value(point)}</td>)}</tr>} />
      </div></details>
    </>}
    <footer className="executive-footer"><span>TSAAT / CYBER TERRAIN TRENDS</span><span>Recorded evidence. Clear direction. Accountable action.</span></footer>
  </article>;
}
