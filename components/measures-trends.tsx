"use client";

import { useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Papa from "papaparse";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { FindingsDataTable } from "@/components/findings-data-table";
import PersonaLink from "@/components/persona-link";
import { insightsHref } from "@/lib/governance-insights";
import { startRouteLoading } from "@/lib/route-loading";
import { MEASURE_HISTORY_OPTIONS, measureChartGeometry, measureMovement, measureTrendTab, type MeasureTrendPoint, type MeasureTrendSeries, type MeasuresTrendsModel } from "@/lib/measures-trends";
import type { ExplorerColumn } from "@/lib/explorer-table";

const number = (value: number) => value.toLocaleString("en-AU");
const percent = (value: number | null | undefined) => value == null ? "N/A" : `${value.toFixed(1)}%`;
const date = (value: string) => new Date(value + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const columns: ExplorerColumn<MeasureTrendPoint>[] = [
  { key: "date", label: "Snapshot", value: row => row.date }, { key: "rate", label: "Compliance", value: row => percent(row.percent) },
  { key: "compliant", label: "Compliant", value: row => row.compliant }, { key: "nonCompliant", label: "Non-compliant", value: row => row.nonCompliant },
  { key: "unknown", label: "Unknown", value: row => row.unknown }, { key: "total", label: "Applicable", value: row => row.total }
];
function Movement({ points }: { points: MeasureTrendPoint[] }) {
  const movement = measureMovement(points);
  return <span className={`measure-trend-movement is-${movement.tone}`}>
    {movement.delta !== null && <b>{movement.delta > 0 ? "+" : ""}{movement.delta.toFixed(1)} pp </b>}{movement.label}
  </span>;
}
function Chart({ series, from, to, compact = false, selected }: { series: MeasureTrendSeries; from: string; to: string; compact?: boolean; selected?: string }) {
  const id = useId(), { plotted, paths } = measureChartGeometry(series.points, from, to);
  const current = plotted.find(point => point.date === selected);
  return <svg className={compact ? "measure-trend-spark" : "measure-trend-chart"} viewBox="0 0 720 240" preserveAspectRatio={compact ? "none" : "xMidYMid meet"}
    role={compact ? undefined : "img"} aria-hidden={compact || undefined} aria-labelledby={compact ? undefined : `${id}-title ${id}-description`}>
    {!compact && <><title id={`${id}-title`}>{`${series.id} compliance trend`}</title>
      <desc id={`${id}-description`}>{series.points.length} observed snapshots, from {date(from)} through {date(to)}. Points are spaced by date. Missing results break the line; no observations are filled in. Choose a snapshot below or open the evidence table for exact values.</desc>
      {[0, 25, 50, 75, 100].map(value => <g key={value}><line x1="40" x2="680" y1={210 - value * 1.8} y2={210 - value * 1.8} className="measure-trend-grid" />
        <text x="30" y={215 - value * 1.8} textAnchor="end">{value}%</text></g>)}</>}
    {paths.map((path, index) => <path key={index} d={path} className="measure-trend-line" />)}
    {current?.y != null && !compact && <line x1={current.x} x2={current.x} y1="30" y2="210" className="measure-trend-cursor" />}
    {plotted.map(point => point.y !== null && <circle key={point.date} cx={point.x} cy={point.y} r={!compact && point.date === selected ? 6 : 3.5} className="measure-trend-point">
      <title>{`${date(point.date)}: ${percent(point.percent)} (${point.compliant}/${point.total})`}</title></circle>)}
  </svg>;
}
function download(model: MeasuresTrendsModel, series: MeasureTrendSeries[], tab: string) {
  const rows = series.flatMap(measure => measure.points.map(point => ({
    "Measure": measure.id, "Name": measure.name, "Snapshot": point.date, "Period": MEASURE_HISTORY_OPTIONS.find(option => option.value === model.history)!.label,
    "Period start": model.from, "Through": model.cutoff, "Network IDs": model.scope.network.join(", "), "System IDs": model.scope.system.join(", "),
    "Security domains": model.domains.join(", "), "Compliance (%)": point.percent ?? "N/A", "Compliant": point.compliant,
    "Non-compliant": point.nonCompliant, "Unknown": point.unknown, "Applicable": point.total, "Unit": measure.unit, "Result recorded": point.recorded
  })));
  const url = URL.createObjectURL(new Blob([Papa.unparse(rows, { escapeFormulae: true })], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a"); link.href = url; link.download = `measures-trends-${tab}-${model.history}-${model.cutoff}.csv`;
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function MeasureDetail({ series, model, tab }: { series: MeasureTrendSeries; model: MeasuresTrendsModel; tab: "kpi" | "spi" }) {
  const [selectedDate, setSelectedDate] = useState(series.points.at(-1)?.date ?? "");
  const current = series.points.find(point => point.date === selectedDate), latest = series.points.at(-1), first = series.points[0];
  const id = useId();
  const destination = new URL(insightsHref({ ...model.scope, dataDate: selectedDate || model.cutoff }, "/measures", { key: "measuresTab", value: `measures-${tab}` }), "http://localhost");
  if (tab === "spi") destination.searchParams.set("spi", series.id.replace("SPI-", ""));
  return <section className="measure-trend-detail" aria-label={`${series.id} trend details`} data-measure-id={series.id}>
    <header><span className="measure-trend-id">{series.id}</span><h2>{series.name}</h2><p>{series.description}</p></header>
    <div className="measure-trend-stats">
      <div><span>Latest compliance</span><strong>{percent(latest?.percent)}</strong><small>{latest ? date(latest.date) : "No observation"}</small></div>
      <div><span>Change over observations</span><Movement points={series.points} /><small>{first && latest && series.points.length > 1 ? `${date(first.date)} → ${date(latest.date)}` : "Two comparable observations needed"}</small></div>
      <div><span>Applicable {series.unit.toLowerCase()}</span><strong>{latest?.recorded ? number(latest.total) : "N/A"}</strong><small>{first && series.points.length > 1 ? `First observation: ${number(first.total)}` : "Latest observed population"}</small></div>
    </div>
    {series.points.length ? <>
      <div className="measure-trend-chart-caption"><span>Compliance over time</span><span>Higher is better · 0–100%</span></div>
      <Chart series={series} from={model.from} to={model.cutoff} selected={selectedDate} />
      <div className="measure-trend-axis-dates"><span>{date(model.from)}</span><span>{date(model.cutoff)}</span></div>
      {!series.points.some(point => point.percent !== null) && <p className="measure-trend-notice">No applicable results in this scope. N/A is not zero compliance.</p>}
      <div className="measure-trend-inspector"><label htmlFor={`${id}-snapshot`}>Inspect snapshot<select id={`${id}-snapshot`} aria-label="Inspect measure snapshot" value={selectedDate} onChange={event => setSelectedDate(event.target.value)}>
        {series.points.map(point => <option key={point.date} value={point.date}>{date(point.date)}</option>)}</select></label>
        <strong role="status">{percent(current?.percent)}</strong>
        <PersonaLink className="software-evidence-link" href={destination.pathname + destination.search}>Open observed measures <span aria-hidden="true">↗</span></PersonaLink>
      </div>
      {current && <div className="measure-trend-breakdown" aria-label={`Results for ${current.date}`}>
        {[{ label: "Compliant", value: current.compliant, tone: "good" }, { label: "Non-compliant", value: current.nonCompliant, tone: "bad" }, { label: "Unknown", value: current.unknown, tone: "unknown" }].map(item =>
          <div key={item.label}><span><i className={`is-${item.tone}`} />{item.label}</span><strong>{current.recorded ? number(item.value) : "Not recorded"}</strong></div>)}
      </div>}
    </> : <div className="measure-trend-empty"><h3>No snapshots in this period</h3><p>Choose a longer range or a different header date to view recorded evidence.</p></div>}
    <div className="measure-trend-definition"><span>Success measure</span><p>{series.successMeasure}</p></div>
    {series.points.length > 0 && <details className="measure-trend-evidence"><summary>Snapshot evidence · {series.points.length} observations</summary>
      <FindingsDataTable title={`${series.id} snapshot evidence`} rows={series.points} columns={columns} searchable={false} columnFilters={false} defaultPageSize={25}
        renderRow={point => <tr key={point.date}><td>{date(point.date)}</td><td>{percent(point.percent)}</td><td>{point.recorded ? number(point.compliant) : "—"}</td><td>{point.recorded ? number(point.nonCompliant) : "—"}</td><td>{point.recorded ? number(point.unknown) : "—"}</td><td>{point.recorded ? number(point.total) : "—"}</td></tr>} />
    </details>}
  </section>;
}
export function MeasuresTrends({ model }: { model: MeasuresTrendsModel }) {
  const router = useRouter(), params = useSearchParams();
  const tab = measureTrendTab(params.get("measureTrendTab") ?? undefined), series = model[tab];
  const [search, setSearch] = useState("");
  const selected = series.find(measure => measure.id === params.get("measureId")) ?? series[0];
  const visible = series.filter(measure => `${measure.id} ${measure.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  const localSelection = (key: string, value: string) => {
    const query = new URLSearchParams(params.toString()); query.set(key, value);
    if (key === "measureTrendTab") { query.delete("measureId"); setSearch(""); }
    window.history.replaceState(null, "", "/measures/trends?" + query);
  };
  const rangeSelection = (value: string) => {
    if (value === model.history) return;
    const query = new URLSearchParams(params.toString()); query.set("measureHistory", value);
    const href = "/measures/trends?" + query;
    startRouteLoading({ href, message: "Loading Measures Trends…" }); router.push(href, { scroll: false });
  };
  return <article className="workspace-page measures-trends" data-measure-history={model.history} data-measure-tab={tab} data-measure-from={model.from} data-measure-cutoff={model.cutoff}>
    <header className="measure-trends-hero"><div><p className="software-kicker">Observed Measures / History</p><h1>Measures Trends</h1>
      <p>Follow performance. See what changed. Inspect the evidence.</p></div><div className="measure-trends-through"><span>Evidence through</span><strong>{date(model.cutoff)}</strong><small>{model.dates.length} snapshots in this period</small></div></header>
    <div className="measure-trends-period"><fieldset><legend>Trend period</legend><div>{MEASURE_HISTORY_OPTIONS.map(option => <label key={option.value}>
      <input type="radio" name="measure-history" value={option.value} checked={model.history === option.value} onChange={() => rangeSelection(option.value)} /><span>{option.label}</span>
    </label>)}</div></fieldset><p><strong>{date(model.from)} — {date(model.cutoff)}</strong><span>Scope and security domains follow the header.</span></p></div>
    <WorkspaceTabs id="measure-trends" label="Measure type" tabs={[{ id: "kpi", label: `KPIs (${model.kpi.length})` }, { id: "spi", label: `SPIs (${model.spi.length})` }]} active={tab} onChange={value => localSelection("measureTrendTab", value)} />
    <section id={`measure-trends-panel-${tab}`} role="tabpanel" aria-labelledby={`measure-trends-tab-${tab}`} tabIndex={0}>
      <div className="measure-trends-coverage"><p>{model.dates.length ? <>Recorded observations: <strong>{date(model.dates[0])} — {date(model.dates.at(-1)!)}</strong>. {model.dates[0] > model.from ? "Earlier dates in this period have no snapshots. " : ""}{model.dates.at(-1)! < model.cutoff ? "No snapshot is recorded at the requested cutoff. " : ""}Charts show available evidence only.</> : "No recorded snapshots fall within the selected period."}</p>
        <button className="endpoint-export" type="button" disabled={!model.dates.length || !series.length} onClick={() => download(model, series, tab)}>Export {tab.toUpperCase()} trends</button></div>
      <div className="measure-trends-layout">
        <aside className="measure-trend-picker" aria-label={`Choose a ${tab.toUpperCase()}`}><header><h2>{tab === "kpi" ? "Performance indicators" : "Security posture indicators"}</h2><p>Select a measure to explore its history.</p>
          <label className="sr-only" htmlFor="measure-trend-search">Find an indicator</label><input id="measure-trend-search" type="search" placeholder="Find an indicator…" value={search} maxLength={200} onChange={event => setSearch(event.target.value)} /></header>
          <div className="measure-trend-options">{visible.map(measure => <button key={measure.id} type="button" className="measure-trend-option" aria-pressed={selected?.id === measure.id} aria-label={`View ${measure.id}: ${measure.name}`} onClick={() => localSelection("measureId", measure.id)}>
            <span className="measure-trend-option-top"><b>{measure.id}</b><strong>{percent(measure.points.at(-1)?.percent)}</strong></span><span className="measure-trend-option-name">{measure.name}</span>
            <span className="measure-trend-option-bottom"><Movement points={measure.points} /><Chart series={measure} from={model.from} to={model.cutoff} compact /></span>
          </button>)}{!visible.length && <p className="measure-trend-notice">{series.length ? "No indicators match your search." : "No indicators are configured."}</p>}</div>
        </aside>
        {selected ? <MeasureDetail key={`${tab}:${selected.id}:${model.history}`} series={selected} model={model} tab={tab} /> : <div className="measure-trend-empty">No {tab.toUpperCase()} definitions are available.</div>}
      </div>
    </section>
    <details className="measure-trends-method"><summary>How to read these trends</summary><p>Compliance uses each indicator’s configured calculation. KPIs assess ICT systems; SPIs assess applicable CI checks. Unknown SPI results remain in the denominator. An empty denominator is N/A.</p>
      <p>Change is the percentage-point difference between the first and last observations in the selected period. One observation or a missing endpoint cannot establish a comparison. Population changes and current measure definitions can affect results; a change does not by itself prove remediation. Lines connect recorded observations only, with no forecast or filled history.</p></details>
  </article>;
}
