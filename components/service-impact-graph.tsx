"use client";

import { PersonaPopup } from "@/components/persona-popup";

import { PersonaPopupButton } from "@/components/persona-popup-button";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { ServiceImpactFindingsPanel } from "@/components/service-impact-findings-panel";
import { useImpactGraphLayout } from "@/components/use-impact-graph-layout";
import { buildServiceImpactGraph, generateImpactCoordinates, impactGraphNeighbours, impactGraphTotals, layoutServiceImpactGraph, serviceImpactRiskView, serviceImpactScene,
  type ImpactCircularMode, type ImpactDirection, type ImpactGraphNode, type ImpactLayout, type ImpactNodeKind, type ImpactNodePosition } from "@/lib/service-impact-graph";
import { selectServiceImpact, type ServiceImpactModel } from "@/lib/service-impact";

const categories: Record<ImpactNodeKind, { name: string; short: string; color: string }> = {
  business: { name: "Business service", short: "BS", color: "#bba0ff" },
  mission: { name: "Mission capability", short: "MC", color: "#53d7c0" },
  system: { name: "ICT system", short: "SYS", color: "#79bfff" },
  asset: { name: "Affected CI", short: "CI", color: "#f1cb80" }
};
const radius = (node: ImpactGraphNode) => node.kind === "asset" ? 20 : node.kind === "system" ? 29 : 25;
const number = (value: number) => value.toLocaleString("en-AU");

function GraphNumberInput({ label, value, min, max, disabled = false, onValueChange }: {
  label: string; value: number; min: number; max: number; disabled?: boolean; onValueChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  return <input type="number" aria-label={label} min={min} max={max} step={1} disabled={disabled} value={draft} onChange={event => {
    const raw = event.target.value; setDraft(raw);
    // Clearing a field while typing must not temporarily reset the other range endpoint.
    if (!raw.trim() || !Number.isFinite(Number(raw))) return;
    const next = Math.min(max, Math.max(min, Math.round(Number(raw))));
    setDraft(String(next)); onValueChange(String(next));
  }} onBlur={() => setDraft(String(value))} />;
}

export function ServiceImpactGraph({ model, systemIds, scopeLabel, focusLabel, onClose }: {
  model: ServiceImpactModel; systemIds: string[]; scopeLabel: string; focusLabel: string; onClose: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const fullScreenButton = useRef<HTMLButtonElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const baseGraph = useMemo(() => buildServiceImpactGraph(model, systemIds), [model, systemIds]);
  const scopeSummary = useMemo(() => selectServiceImpact(model, systemIds), [model, systemIds]);
  const severityOptions = useMemo(() => [...new Map([...model.severities, ...model.findings.map(row => ({ key: row.severity,
    label: model.severities.find(option => option.key === row.severity)?.label ?? row.severity }))].map(option => [option.key, option])).values()], [model]);
  const [severityKeys, setSeverityKeys] = useState<string[] | null>(null);
  const severities = useMemo(() => severityKeys ?? severityOptions.filter(option => option.key === "Critical Exposure" || option.key === "High Risk").map(option => option.key), [severityKeys, severityOptions]);
  const [countRange, setCountRange] = useState<{ min: number; max: number | null }>({ min: 1, max: null });
  const { graph, minimum, maximum, maxCount, observedMaximum } = useMemo(() =>
    serviceImpactRiskView(baseGraph, severities, countRange), [baseGraph, severities, countRange]);
  const selectedSeverityOptions = severityOptions.filter(option => severities.includes(option.key));
  const severityLabel = !severities.length ? "No severities" : severities.length === severityOptions.length ? "All severities"
    : selectedSeverityOptions.map(option => option.label).join(" + ");
  const rangeDisabled = !severities.length || !maxCount;
  const summary = useMemo(() => impactGraphTotals(graph), [graph]);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(() => baseGraph.nodes.filter(node => node.kind === "asset").length <= 12 ? [...systemIds] : []);
  const affectedSystemIds = useMemo(() => [...new Set(baseGraph.nodes.filter(node => node.kind === "asset").flatMap(node => node.systemIds))], [baseGraph]);
  const allCisExpanded = affectedSystemIds.length > 0 && affectedSystemIds.every(systemId => expanded.includes(systemId));
  const hasMatchingCis = graph.nodes.some(node => node.kind === "asset");
  const [details, setDetails] = useState<ImpactGraphNode | "all" | null>(null);
  const [moved, setMoved] = useState<Map<string, ImpactNodePosition>>(new Map());
  const [layoutKind, setLayoutKind] = useState<ImpactLayout>("hierarchical");
  const [direction, setDirection] = useState<ImpactDirection>("top-down");
  const [circularMode, setCircularMode] = useState<ImpactCircularMode>("circle");
  const generatedCoordinates = useMemo(() => generateImpactCoordinates(baseGraph), [baseGraph]);
  const [customCoordinates, setCustomCoordinates] = useState<Map<string, ImpactNodePosition>>(new Map());
  const coordinates = useMemo(() => new Map([...generatedCoordinates, ...customCoordinates]), [generatedCoordinates, customCoordinates]);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ pointer: number; id: string | null; x: number; y: number; origin: ImpactNodePosition; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const selected = graph.nodes.find(node => node.id === selectedId);
  const activeSelectedId = selected?.id ?? null;
  const scene = useMemo(() => serviceImpactScene(graph, expanded, activeSelectedId, focus), [graph, expanded, activeSelectedId, focus]);
  const layout = useMemo(() => layoutServiceImpactGraph(scene, { kind: layoutKind, direction, circularMode, coordinates }), [scene, layoutKind, direction, circularMode, coordinates]);
  const layoutKey = `${layoutKind}:${layoutKind === "hierarchical" ? direction : layoutKind === "circular" ? circularMode : ""}`;
  const { positions: animatedPositions, animating, recordPosition } = useImpactGraphLayout(layout, layoutKey);
  const positions = useMemo(() => new Map([...animatedPositions].map(([key, point]) => [key, moved.get(key) ?? point])), [animatedPositions, moved]);
  const neighbours = useMemo(() => activeSelectedId ? impactGraphNeighbours(graph, activeSelectedId) : new Set<string>(), [graph, activeSelectedId]);
  const connections = graph.nodes.filter(node => node.id !== selectedId && neighbours.has(node.id));
  const matches = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return search ? graph.nodes.filter(node => `${node.name} ${node.sourceId} ${node.description} ${categories[node.kind].name}`.toLocaleLowerCase().includes(search)) : [];
  }, [graph, query]);
  const bounds = useMemo(() => {
    const points = [...animatedPositions.values()];
    if (!points.length) return { x: 0, y: 0, width: 960, height: 600 };
    const x = Math.min(...points.map(point => point.x)) - 105, y = Math.min(...points.map(point => point.y)) - 80;
    return { x, y, width: Math.max(300, Math.max(...points.map(point => point.x)) - x + 105),
      height: Math.max(250, Math.max(...points.map(point => point.y)) - y + 95) };
  }, [animatedPositions]);
  const viewBox = `${bounds.x + camera.x + bounds.width * (1 - 1 / camera.zoom) / 2} ${bounds.y + camera.y + bounds.height * (1 - 1 / camera.zoom) / 2} ${bounds.width / camera.zoom} ${bounds.height / camera.zoom}`;
  const resetCamera = () => setCamera({ x: 0, y: 0, zoom: 1 });
  const clearGraphSelection = () => { setSelectedId(null); setFocus(false); resetCamera(); };
  const resetRiskFilters = () => { setSeverityKeys(null); setCountRange({ min: 1, max: null }); clearGraphSelection(); };
  const changeSeverities = (keys: string[]) => {
    setSeverityKeys(keys); setCountRange({ min: keys.length === severityOptions.length ? 0 : 1, max: null }); clearGraphSelection();
  };
  const changeMinimum = (value: string) => {
    if (!Number.isFinite(Number(value))) return;
    const next = Math.min(maxCount, Math.max(0, Math.round(Number(value))));
    setCountRange({ min: next, max: countRange.max === null ? null : Math.max(next, maximum) }); clearGraphSelection();
  };
  const changeMaximum = (value: string) => {
    if (!Number.isFinite(Number(value))) return;
    const next = Math.min(maxCount, Math.max(0, Math.round(Number(value))));
    setCountRange({ min: Math.min(minimum, next), max: next === maxCount ? null : next }); clearGraphSelection();
  };
  const prepareLayout = () => { setMoved(new Map()); resetCamera(); };
  const setCoordinate = (nodeId: string, point: ImpactNodePosition) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    setCustomCoordinates(current => new Map(current).set(nodeId, point));
    setMoved(current => new Map(current).set(nodeId, point)); recordPosition(nodeId, point);
  };
  const choose = (nodeId: string) => setSelectedId(nodeId);
  const zoom = (factor: number) => setCamera(current => ({ ...current, zoom: Math.max(.4, Math.min(5, current.zoom * factor)) }));
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = dialog.current; node?.showModal();
    return () => { node?.close(); document.body.style.overflow = overflow; trigger?.focus(); };
  }, [mounted]);
  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12); };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [mounted, scene.nodes.length]);
  const point = (event: PointerEvent<SVGElement>) => {
    const matrix = svg.current?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : new DOMPoint();
  };
  const startDrag = (event: PointerEvent<SVGElement>, nodeId: string | null) => {
    if (event.button !== 0 || animating) return;
    event.stopPropagation();
    const origin = nodeId ? positions.get(nodeId) : { x: camera.x, y: camera.y };
    if (!origin) return;
    drag.current = { pointer: event.pointerId, id: nodeId, x: event.clientX, y: event.clientY, origin, moved: false };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 4) active.moved = true;
    if (!active.moved) return;
    if (active.id) {
      const next = point(event);
      const position = { x: next.x, y: next.y };
      if (layoutKind === "spatial") setCoordinate(active.id, position);
      else { setMoved(current => new Map(current).set(active.id!, position)); recordPosition(active.id, position); }
    } else {
      const matrix = svg.current?.getScreenCTM();
      if (matrix) setCamera(current => ({ ...current, x: active.origin.x - (event.clientX - active.x) / matrix.a,
        y: active.origin.y - (event.clientY - active.y) / matrix.d }));
    }
  };
  const endDrag = () => { suppressClick.current = drag.current?.moved ?? false; drag.current = null; };
  if (!mounted) return null;
  return createPortal(<>
    <dialog ref={dialog} className={`settings-popup service-impact-graph-popup${fullScreen ? " is-fullscreen" : ""}${controlsExpanded ? "" : " is-controls-minimised"}`} aria-labelledby={`${id}-title`} data-impact-layout={layoutKind} data-impact-animating={animating}
      onCancel={event => {
        event.preventDefault();
        if (fullScreen) { setFullScreen(false); fullScreenButton.current?.focus(); }
        else onClose();
      }}>
      <div className="settings-popup-frame">
        <header className="impact-graph-header"><div><p className="endpoint-eyebrow">Service Impact / Explore selection</p><h2 id={`${id}-title`}>Impact graph</h2>
          <p>{scopeLabel} · {focusLabel} · Snapshot {model.snapshotDate}</p></div>
          <div className="impact-graph-view-actions">
            <button type="button" className="endpoint-export" data-impact-toggle-controls aria-expanded={controlsExpanded} aria-controls={`${id}-controls`}
              onClick={() => setControlsExpanded(current => !current)}>{controlsExpanded ? "Hide filters & layout" : "Show filters & layout"}</button>
            <button ref={fullScreenButton} type="button" className="endpoint-export" data-impact-fullscreen aria-pressed={fullScreen}
              aria-label={fullScreen ? "Exit full screen" : "Enter full screen"} onClick={() => setFullScreen(current => !current)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d={fullScreen ? "M9 3v6H3m12-6v6h6M3 15h6v6m12-6h-6v6" : "M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"} />
              </svg>{fullScreen ? "Exit full screen" : "Full screen"}
            </button>
            <button type="button" autoFocus className="endpoint-export" aria-label="Close impact graph" onClick={onClose}>Close</button>
          </div></header>
        <div className="impact-graph-summary" aria-label="Filtered graph totals">
          <span><strong>{number(summary.systems)}</strong> ICT systems</span><span><strong>{number(summary.findings)}</strong> matching findings</span>
          <span className="service-impact-critical"><strong>{number(summary.critical)}</strong> critical</span><span className="service-impact-high"><strong>{number(summary.high)}</strong> high</span>
          <span><strong>{number(summary.affectedCis)}</strong> affected CIs</span>
          <button type="button" className="service-impact-link" disabled={!summary.findings} onClick={() => setDetails("all")}>View filtered findings ↗</button>
        </div>
        <div id={`${id}-controls`} className="impact-graph-controls" aria-label="Risk filters and layout" hidden={!controlsExpanded}>
          <section className="impact-graph-control-group impact-graph-filter-group" aria-labelledby={`${id}-filters`}>
            <header><h3 id={`${id}-filters`}>Filters</h3><button type="button" className="service-impact-link" data-impact-reset-filters onClick={resetRiskFilters}>Reset filters</button></header>
            <div className="impact-graph-filter-fields">
            <div className="impact-graph-severity-field"><span className="impact-graph-control-label" id={`${id}-severity-label`}>Risk severity</span>
          <details className="impact-graph-severity-filter" onKeyDown={event => {
            if (event.key === "Escape" && event.currentTarget.open) { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
          }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
            <summary aria-label={`Risk severity: ${severityLabel}`} title={severityLabel}><strong>{severities.length <= 1 || severities.length === severityOptions.length ? severityLabel : `${severities.length} severities selected`}</strong></summary>
            <fieldset><legend>Select risk severities</legend><div className="impact-graph-severity-actions"><button type="button" onClick={() => changeSeverities(severityOptions.map(option => option.key))}>Select all</button><button type="button" onClick={() => changeSeverities([])}>Clear</button></div>
              <p className="impact-graph-severity-note">Counts below are findings in the selected scope.</p>
              {severityOptions.map(option => <label key={option.key}><input type="checkbox" value={option.key} checked={severities.includes(option.key)} onChange={event => changeSeverities(event.target.checked ? [...severities, option.key] : severities.filter(key => key !== option.key))} /><span>{option.label}</span><small>{number(scopeSummary.severities[option.key] ?? 0)}</small></label>)}
              {!severityOptions.length && <p>No recorded severity categories.</p>}
            </fieldset>
          </details>
          <button type="button" className="impact-graph-expand-all" data-impact-expand-all aria-pressed={allCisExpanded} disabled={!hasMatchingCis}
            onClick={() => { setExpanded(allCisExpanded ? [] : affectedSystemIds); clearGraphSelection(); }}>
            {allCisExpanded ? "Collapse all affected CIs" : "Expand all affected CIs"}
          </button>
          </div>
          <fieldset className="impact-graph-range" aria-describedby={`${id}-range-context`}><legend>Findings per node</legend><div>
            <label>Min<GraphNumberInput label="Minimum matching findings" min={0} max={maxCount} value={minimum} disabled={rangeDisabled} onValueChange={changeMinimum} /></label>
            <input type="range" aria-label="Minimum matching findings slider" min={0} max={maxCount} step={1} value={minimum} disabled={rangeDisabled} onChange={event => changeMinimum(event.target.value)} />
            <label>Max<GraphNumberInput label="Maximum matching findings" min={0} max={maxCount} value={maximum} disabled={rangeDisabled} onValueChange={changeMaximum} /></label>
            <input type="range" aria-label="Maximum matching findings slider" min={0} max={maxCount} step={1} value={maximum} disabled={rangeDisabled} onChange={event => changeMaximum(event.target.value)} />
          </div></fieldset>
          </div>
          <p className="impact-graph-range-context" id={`${id}-range-context`} role="status">Counts: <strong>{severityLabel}</strong> · Maximum per node: {number(observedMaximum)}</p>
          </section>
          <section className="impact-graph-control-group impact-graph-layout-group" aria-labelledby={`${id}-layout`}>
          <header><h3 id={`${id}-layout`}>Layout &amp; view</h3><span role="status">{animating ? "Arranging layout…" : ""}</span></header>
          <div className="impact-graph-layout-options"><label>Layout<select aria-label="Impact graph layout" value={layoutKind} onChange={event => { prepareLayout(); setLayoutKind(event.target.value as ImpactLayout); }}>
            <option value="force">Force-Directed</option><option value="hierarchical">Hierarchical</option><option value="circular">Circular / Radial</option><option value="spatial">Coordinate / Spatial</option>
          </select></label>
          {layoutKind === "hierarchical" && <label>Direction<select aria-label="Hierarchy direction" value={direction} onChange={event => { prepareLayout(); setDirection(event.target.value as ImpactDirection); }}>
            <option value="left-right">Left to right</option><option value="right-left">Right to left</option><option value="top-down">Top down</option><option value="bottom-up">Bottom up</option>
          </select></label>}
          {layoutKind === "circular" && <label>Arrangement<select aria-label="Circular arrangement" value={circularMode} onChange={event => { prepareLayout(); setCircularMode(event.target.value as ImpactCircularMode); }}><option value="circle">Single circle</option><option value="radial">Radial rings</option></select></label>}
          {layoutKind === "spatial" && <button type="button" className="endpoint-export" onClick={() => { setCustomCoordinates(new Map()); prepareLayout(); }}>Reset coordinates</button>}
          </div>
            <div className="impact-graph-toolbar"><div role="group" aria-label="Graph navigation">
              <button type="button" aria-label="Zoom out" onClick={() => zoom(1 / 1.25)}>−</button><span aria-live="polite">{Math.round(camera.zoom * 100)}%</span>
              <button type="button" aria-label="Zoom in" onClick={() => zoom(1.25)}>+</button>
              <button type="button" onClick={() => { setMoved(new Map()); resetCamera(); }}>Fit graph</button></div>
            </div>
          </section>
        </div>
        <p className="impact-graph-filter-context" role="status">{number(graph.nodes.length)} / {number(baseGraph.nodes.length)} nodes match · {number(summary.findings)} / {number(scopeSummary.findings)} scoped findings</p>
        <div className="impact-graph-workspace">
          <div className="impact-graph-main">
            <div className="impact-graph-canvas">
              <button type="button" className="impact-graph-focus" data-impact-focus disabled={!selected} aria-pressed={focus}
                onClick={() => { setFocus(current => !current); resetCamera(); }}>{focus ? "Show scope" : "Focus connections"}</button>
              {scene.nodes.length ? <svg ref={svg} viewBox={viewBox} tabIndex={0} role="group" aria-label="Service impact relationship graph" aria-describedby={`${id}-help`}
                onPointerDown={event => startDrag(event, null)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
                onKeyDown={event => {
                  if (event.target !== event.currentTarget) return;
                  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0"].includes(event.key)) event.preventDefault();
                  if (event.key === "+" || event.key === "=") zoom(1.25);
                  else if (event.key === "-") zoom(1 / 1.25);
                  else if (event.key === "0") { setMoved(new Map()); resetCamera(); }
                  else if (event.key.startsWith("Arrow")) setCamera(current => ({ ...current,
                    x: current.x + (event.key === "ArrowRight" ? 50 : event.key === "ArrowLeft" ? -50 : 0) / current.zoom,
                    y: current.y + (event.key === "ArrowDown" ? 50 : event.key === "ArrowUp" ? -50 : 0) / current.zoom }));
                }}>
                <defs><marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7893a8" /></marker></defs>
                {scene.edges.map(edge => {
                  const a = positions.get(edge.source)!, b = positions.get(edge.target)!;
                  const length = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
                  const endRadius = radius(scene.nodes.find(node => node.id === edge.target)!) + 8;
                  const end = { x: b.x - (b.x - a.x) / length * endRadius, y: b.y - (b.y - a.y) / length * endRadius };
                  const active = edge.source === activeSelectedId || edge.target === activeSelectedId;
                  return <g key={edge.id} className={`impact-graph-edge${active ? " is-active" : ""}`} opacity={activeSelectedId && !active ? .2 : 1}>
                    <line x1={a.x} y1={a.y} x2={end.x} y2={end.y} markerEnd={`url(#${id}-arrow)`} />
                    {(active || scene.edges.length <= 12) && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 7}>{edge.label}</text>}
                  </g>;
                })}
                {scene.nodes.map(node => {
                  const position = positions.get(node.id)!, category = categories[node.kind], r = radius(node);
                  const badge = number(node.findings), badgeWidth = Math.max(24, badge.length * 6 + 12);
                  return <g key={node.id} transform={`translate(${position.x},${position.y})`} className={`impact-graph-node${node.id === selectedId ? " is-selected" : ""}`}
                    role="button" tabIndex={0} aria-pressed={node.id === selectedId} data-impact-node={node.id} data-impact-kind={node.kind} data-impact-findings={node.findings}
                    aria-label={`${category.name}: ${node.name}. ${node.findings} matching findings, ${node.critical} critical, ${node.high} high. Inspect connections.`}
                    opacity={activeSelectedId && !neighbours.has(node.id) ? .28 : 1}
                    onPointerDown={event => startDrag(event, node.id)} onClick={() => { if (!suppressClick.current) choose(node.id); }}
                    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(node.id); } }}>
                    <title>{node.name} — {category.name}\n{node.description}\n{badge} matching findings · {severityLabel}</title>
                    <circle className="impact-graph-halo" r={r + 6} stroke={node.critical ? "#f97285" : node.high ? "#fbad69" : "#4e6577"} />
                    <circle className="impact-graph-disc" r={r} fill={category.color} />
                    <text className="impact-graph-glyph" y="4">{category.short}</text>
                    <text className="impact-graph-label" y={r + 24}>{node.name.length > 24 ? `${node.name.slice(0, 22)}…` : node.name}</text>
                    <rect x={r - 1 - badgeWidth / 2} y={-r - 11} width={badgeWidth} height={24} rx={12} fill="#132a3a" stroke={category.color} />
                    <text className="impact-graph-count" x={r - 1} y={-r + 5}>{badge}</text>
                  </g>;
                })}
              </svg> : <div className="endpoint-empty"><strong>{baseGraph.nodes.length ? "No nodes match these risk filters" : "No ICT systems in this selection"}</strong>
                <p>{baseGraph.nodes.length ? "Change the selected severities or finding-count range." : "Close the graph and adjust the Scope & Selection filters."}</p>
                {baseGraph.nodes.length > 0 && <button type="button" className="endpoint-export" onClick={resetRiskFilters}>Reset risk filters</button>}</div>}
            </div>
            <div className="impact-graph-legend" aria-label="Graph legend">{Object.entries(categories).map(([key, category]) =>
              <span key={key}><i style={{ background: category.color }} />{category.name}</span>)}<span><i className="impact-graph-risk-key" />Critical / high risk ring</span></div>
            <p id={`${id}-help`} className="impact-graph-help">Drag to pan or move nodes. Scroll or use + / − to zoom. Keyboard: Tab to a node, Enter to inspect; arrow keys pan the graph. Badges count findings in the selected severities.</p>
            <p className="impact-graph-status" role="status">{number(scene.nodes.length)} of {number(graph.nodes.length)} nodes in scene{focus ? " · Connections focus" : ""}{scene.omitted ? ` · ${number(scene.omitted)} more nodes: search to inspect them` : ""}{scene.collapsed && !focus ? " · Select a system to expand its affected CIs" : ""}</p>
          </div>
          <aside className="impact-graph-inspector" aria-label="Graph search and node details">
            <label className="impact-graph-search">Find in this scope<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Service, system, device or domain…" /></label>
            {query.trim() && <div className="impact-graph-search-results"><p role="status">{number(matches.length)} matching nodes{matches.length > 50 ? " · First 50 shown; refine your search" : ""}</p>
              <ul>{matches.slice(0, 50).map(node => <li key={node.id}><button type="button" onClick={() => choose(node.id)} aria-pressed={selectedId === node.id}><span style={{ color: categories[node.kind].color }}>{categories[node.kind].name}</span>{node.name}</button></li>)}</ul></div>}
            {selected ? <section className="impact-graph-node-detail" aria-label="Selected node details"><p className="endpoint-eyebrow" style={{ color: categories[selected.kind].color }}>{categories[selected.kind].name}</p><h3>{selected.name}</h3><p>{selected.description}</p>
              {layoutKind === "spatial" && <fieldset className="impact-graph-coordinate-fields"><legend>Workspace coordinates</legend>{(["x", "y"] as const).map(axis => <label key={axis}>{axis.toUpperCase()}<GraphNumberInput label={`Node ${axis.toUpperCase()} coordinate`} min={-100000} max={100000} value={Math.round(coordinates.get(selected.id)?.[axis] ?? 0)} onValueChange={raw => {
                setCoordinate(selected.id, { ...coordinates.get(selected.id)!, [axis]: Number(raw) });
              }} /></label>)}</fieldset>}
              <dl><div><dt>Matching findings</dt><dd data-impact-selected-findings>{number(selected.findings)}</dd></div><div><dt>Affected CIs</dt><dd>{number(selected.affectedCis)}</dd></div></dl>
              <dl className="impact-graph-severity-breakdown" aria-label="Selected severity findings">{selectedSeverityOptions.map(option =>
                <div key={option.key}><dt>{option.label}</dt><dd>{number(selected.severities[option.key] ?? 0)}</dd></div>)}</dl>
              <PersonaPopupButton popup="impact-details" type="button" className="endpoint-export" disabled={!selected.findings} onClick={() => setDetails(selected)}>View findings &amp; CIs ↗</PersonaPopupButton>
              {selected.kind === "system" && <button type="button" className="endpoint-export" disabled={!selected.affectedCis || focus} aria-pressed={expanded.includes(selected.sourceId)} onClick={() => {
                setExpanded(current => current.includes(selected.sourceId) ? current.filter(value => value !== selected.sourceId) : [...current, selected.sourceId]); resetCamera();
              }}>{expanded.includes(selected.sourceId) ? "Collapse" : "Expand"} affected CIs ({number(selected.affectedCis)})</button>}
              <h4>Connected nodes <span>{number(connections.length)}</span></h4><ul className="impact-graph-connections">{connections.map(node => <li key={node.id}><button type="button" onClick={() => choose(node.id)}><i style={{ background: categories[node.kind].color }} /><span>{node.name}<small>{categories[node.kind].name} · {node.findings} findings</small></span><span aria-hidden="true">→</span></button></li>)}</ul>
              {!connections.length && <p>No recorded connections in this scope.</p>}
            </section> : <div className="impact-graph-guide"><p className="endpoint-eyebrow">Follow the impact</p><h3>Explore recorded relationships</h3><p>Select a node to see its findings and connected services, capabilities, systems or devices.</p><p>Search includes collapsed devices that match the risk filters.</p></div>}
            {layoutKind === "spatial" && <p className="impact-graph-method">Generated X/Y positions remain stable as you filter. Adjust a node here or drag it; positions last until this popup closes. These are workspace coordinates, not geographic locations.</p>}
            <p className="impact-graph-method">Counts and finding details follow the risk filters; layout and connection focus do not change totals. The inclusive range applies to each node, so filtered neighbours and their links may disappear. Set Min to 0 to include nodes with no matching findings. Links show recorded associations, not predicted outages. Shared findings are deduplicated in totals. Zero findings does not confirm compliance.</p>
          </aside>
        </div>
      </div>
    </dialog>
    {details && <PersonaPopup popup="impact-details"><ServiceImpactFindingsPanel title={details === "all" ? "Findings matching graph risk filters" : details.name} findings={details === "all" ? summary.findingRows : details.findingRows} model={model} onClose={() => setDetails(null)} /></PersonaPopup>}
  </>, document.body);
}
