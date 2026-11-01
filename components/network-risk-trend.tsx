"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { severityBarColors } from "@/components/findings-duration-panel";
import type { RiskProfileModel } from "@/lib/risk-profile";

type TrendPoints = RiskProfileModel["trend"]["points"];

function TrendPeriod({ days, onChange, expanded = false }: { days: number; onChange: (days: number) => void; expanded?: boolean }) {
  return <select className="report-sort" aria-label={expanded ? "Expanded risk trend period" : "Risk trend period"} value={days} onChange={event => onChange(Number(event.target.value))}>
    <option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 12 months</option>
  </select>;
}

function TrendLegend() {
  return <ul className="measures-duration-legend" aria-label="Trend legend">
    <li><span style={{ background: severityBarColors["Critical Exposure"] }} />Critical Exposure</li>
    <li><span style={{ background: severityBarColors["High Risk"] }} />High Risk</li>
  </ul>;
}

function TrendChart({ points, snapshotDate }: { points: TrendPoints; snapshotDate: string }) {
  return <div className="network-risk-trend" role="img" aria-label={`Daily open critical and high findings from ${points[0]?.date} to ${snapshotDate}`}>
    <ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ top: 8, right: 12, bottom: 2, left: -18 }}>
      <CartesianGrid stroke="#294454" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="date" minTickGap={42} tickFormatter={date => String(date).slice(5)} tick={{ fill: "#91adbf", fontSize: 11 }} axisLine={false} tickLine={false} />
      <YAxis allowDecimals={false} tick={{ fill: "#91adbf", fontSize: 11 }} axisLine={false} tickLine={false} />
      <Tooltip contentStyle={{ background: "#0f2535", border: "1px solid #4b7187", borderRadius: 8, color: "#d1e5f1", fontSize: 12 }} />
      <Line type="stepAfter" dataKey="critical" name="Critical Exposure" stroke={severityBarColors["Critical Exposure"]} strokeWidth={2} dot={false} isAnimationActive={false} />
      <Line type="stepAfter" dataKey="high" name="High Risk" stroke={severityBarColors["High Risk"]} strokeWidth={2} dot={false} isAnimationActive={false} />
    </LineChart></ResponsiveContainer>
  </div>;
}

function UndatedFindings({ count }: { count: number }) {
  return count > 0 ? <p className="discovery-overview-note">{count.toLocaleString("en-AU")} {count === 1 ? "finding lacks" : "findings lack"} reliable opening or closure dates and {count === 1 ? "is" : "are"} excluded from the trend.</p> : null;
}

function TrendPopup({ model, points, days, onChange, onClose }: {
  model: RiskProfileModel; points: TrendPoints; days: number; onChange: (days: number) => void; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<dialog ref={dialogRef} className="settings-popup network-risk-trend-popup" aria-labelledby="network-risk-trend-popup-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')]
        .filter(control => !control.matches(":disabled") && control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <div className="settings-popup-frame">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-sky-300/20 p-5">
        <div><p className="text-xs uppercase tracking-[0.14em] text-slate-400">{model.kind === "system" ? "ICT System" : "Network"} Risk Profile</p>
          <h2 id="network-risk-trend-popup-title" className="mt-1 text-2xl font-semibold">Critical &amp; high findings over time</h2></div>
        <button type="button" autoFocus onClick={onClose} className="rounded border border-sky-300/35 px-3 py-2 text-sm hover:bg-sky-500/10" aria-label="Close expanded risk trend chart">Close</button>
      </header>
      <div className="network-risk-trend-popup-body">
        <div className="network-risk-trend-popup-controls">
          <p className="discovery-overview-note">{model.entityCount.toLocaleString("en-AU")} {model.kind === "system" ? "ICT system" : "network"}{model.entityCount === 1 ? "" : "s"} in scope · Snapshot {model.snapshotDate}</p>
          <label>Period <TrendPeriod days={days} onChange={onChange} expanded /></label>
        </div>
        <p className="discovery-overview-note">Recorded opening and closure dates, ending at the selected snapshot.</p>
        <TrendLegend />
        <TrendChart points={points} snapshotDate={model.snapshotDate} />
        <UndatedFindings count={model.trend.undated} />
      </div>
    </div>
  </dialog>, document.body);
}

export function NetworkRiskTrend({ model, active }: { model: RiskProfileModel; active: boolean }) {
  const [days, setDays] = useState(90);
  const [expanded, setExpanded] = useState(false);
  const points = model.trend.points.slice(-days);
  return <section className="discovery-overview-panel" aria-labelledby="network-risk-trend-title">
    <header><h2 id="network-risk-trend-title">Critical &amp; high findings over time</h2>
      <div className="network-risk-trend-actions"><TrendPeriod days={days} onChange={setDays} />
        <button type="button" className="settings-open-button" aria-haspopup="dialog" aria-expanded={expanded && active}
          aria-label="Expand critical and high findings chart" onClick={() => setExpanded(true)}>Expand chart <span aria-hidden="true">↗</span></button>
      </div></header>
    <p className="discovery-overview-note">Recorded opening and closure dates, ending at the selected snapshot.</p>
    <TrendLegend />
    {active && <TrendChart points={points} snapshotDate={model.snapshotDate} />}
    <UndatedFindings count={model.trend.undated} />
    {expanded && active && <TrendPopup model={model} points={points} days={days} onChange={setDays} onClose={() => setExpanded(false)} />}
  </section>;
}
