"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type Dispatch, type SetStateAction, type PointerEvent, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { CmdbDeviceName } from "@/components/cmdb-drill-through";
import { FindingsDataTable } from "@/components/findings-data-table";
import { FilterHeader } from "@/components/inventory-explorer-controls";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { useImpactGraphLayout } from "@/components/use-impact-graph-layout";
import { ImpactGraphNodeVisual, impactGraphNodeRadius } from "@/components/impact-graph-node-visual";
import { emptyTopologyLookup, layoutTopology, lookupTopology, traceTopology, traceTopologySelection, parseTopologyMode, TOPOLOGY_KINDS, TOPOLOGY_MODES,
  type TopologyExplorerModel, type TopologyExplorerNode, type TopologyLookup, type TopologyMode, type TopologyExplorerEdge } from "@/lib/topology-explorer";
import { TopologyImpactReportButton } from "@/components/topology-impact-report-button";
import { topologyImpactReportJob } from "@/lib/topology-impact-report";
import type { ExplorerColumn } from "@/lib/explorer-table";
import type { ImpactLayout, ImpactNodePosition } from "@/lib/topology-layout";
import { TOPOLOGY_FILTER_COLUMNS, filterTopologyNodes, parseTopologyColumnFilters, serializeTopologyColumnFilters, topologyFacetCounts, topologyNameLabel,
  type TopologyColumnFilters, type TopologyFilterColumn } from "@/lib/topology-lookup-filters";

const nodeColumns: ExplorerColumn<TopologyExplorerNode>[] = [
  { key: "name", label: "CI name", value: row => row.name }, { key: "type", label: "CI type", value: row => row.type },
  { key: "sourceId", label: "CI ID", value: row => row.sourceId }, { key: "domain", label: "Security domain", value: row => row.domain || "Not applicable" }
];
type RelationshipRow = TopologyExplorerEdge & { sourceName: string; targetName: string; environment: string };
const relationshipColumns: ExplorerColumn<RelationshipRow>[] = [
  { key: "source", label: "Source CI", value: row => row.sourceName },
  { key: "relationship", label: "Relationship", value: row => row.label },
  { key: "target", label: "Target CI", value: row => row.targetName },
  { key: "environment", label: "Environment", value: row => row.environment }
];
const number = (n: number) => n.toLocaleString("en-AU");
function compactLabel(name: string): string[] {
  if (name.length <= 22) return [name];
  const boundary = name.lastIndexOf(" ", 22);
  const split = boundary > 0 ? boundary : 22;
  const rest = name.slice(split).trim();
  return [name.slice(0, split), rest.length > 22 ? `${rest.slice(0, 20).trimEnd()}…` : rest];
}
function saveLookup(legacy: TopologyLookup, filters: TopologyColumnFilters, ci: string, mode: TopologyMode, allResults = false) {
  const query = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(legacy)) { if (value) query.set(`topology_${key}`, value); else query.delete(`topology_${key}`); }
  const encoded = serializeTopologyColumnFilters(filters);
  if (encoded) query.set("topology_filters", encoded); else query.delete("topology_filters");
  if (ci && !allResults) query.set("topologyCi", ci); else query.delete("topologyCi");
  if (allResults) query.set("topologyAll", "1"); else query.delete("topologyAll");
  if (mode === "dependencies") query.set("topologyMode", mode); else query.delete("topologyMode");
  window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
}

export function TopologyExplorer({ model }: { model: TopologyExplorerModel }) {
  const params = useSearchParams();
  const modeId = useId();
  const [mode, setMode] = useState(() => parseTopologyMode(params.get("topologyMode")));
  const [legacy, setLegacy] = useState<TopologyLookup>(() => ({ name: params.get("topology_name")?.slice(0, 200) ?? "", software: params.get("topology_software")?.slice(0, 200) ?? "",
    cve: params.get("topology_cve")?.slice(0, 200) ?? "", ip: params.get("topology_ip")?.slice(0, 200) ?? "",
    kind: Object.hasOwn(TOPOLOGY_KINDS, params.get("topology_kind") ?? "") ? params.get("topology_kind")! : "" }));
  const [filters, setFilters] = useState<TopologyColumnFilters>(() => parseTopologyColumnFilters(params.get("topology_filters")));
  const [openColumn, setOpenColumn] = useState<TopologyFilterColumn | null>(null);
  const allNodes = model.nodes;
  const lookupIds = useMemo(() => new Set(model.nodes.map(node => node.id)), [model.nodes]);
  const names = useMemo(() => new Map(allNodes.map(node => [node.id, topologyNameLabel(node)])), [allNodes]);
  const valueLabel = (column: TopologyFilterColumn, value: string) => column === "name" ? names.get(value) ?? value : value;
  const [allResults, setAllResults] = useState(params.get("topologyAll") === "1");
  const [selectedId, setSelectedId] = useState(params.get("topologyCi") ?? "");
  const [page, setPage] = useState(1);
  const legacyRows = useMemo(() => lookupTopology(model.nodes, legacy), [model.nodes, legacy]);
  const matches = useMemo(() => filterTopologyNodes(legacyRows, filters), [legacyRows, filters]);
  const facets = useMemo(() => TOPOLOGY_FILTER_COLUMNS.map(column => ({ ...column,
    options: topologyFacetCounts(lookupTopology(model.nodes, { ...legacy, [column.key]: "" }), filters, column.key) })), [model.nodes, legacy, filters]);
  const root = allResults ? matches[0] : model.nodes.find(node => node.id === selectedId);
  const trace = useMemo(() => traceTopologySelection(model, allResults ? matches.map(node => node.id) : [selectedId], mode), [model, selectedId, allResults, matches, mode]);
  const selectionKey = allResults ? `all:${JSON.stringify(trace.rootIds)}` : selectedId;
  const selectionLabel = allResults ? `All matching CIs (${number(matches.length)})` : root?.name ?? "";
  const reportContext = { model, query: params.toString(), filters: TOPOLOGY_FILTER_COLUMNS.flatMap(({ key, label }) => [
    ...(filters[key]?.length ? [`${label}: ${filters[key]!.map(value => valueLabel(key, value)).join("; ")}`] : []),
    ...(legacy[key] ? [`${label} search: ${legacy[key]}`] : [])
  ]) };
  const relationshipRows = useMemo(() => trace.edges.map(edge => ({ ...edge,
    sourceName: names.get(edge.source) ?? edge.source, targetName: names.get(edge.target) ?? edge.target,
    environment: edge.environments ? edge.environments.join(", ") || "Not recorded" : "Not applicable" })), [trace, names]);
  const pageCount = Math.max(1, Math.ceil(matches.length / 50)), currentPage = Math.min(page, pageCount);
  const choose = (id: string) => {
    if (!lookupIds.has(id)) return;
    setAllResults(false); setSelectedId(id); saveLookup(legacy, filters, id, mode);
  };
  const showAll = () => { setAllResults(true); setSelectedId(""); saveLookup(legacy, filters, "", mode, true); };
  const changeMode = (next: TopologyMode) => { setMode(next); saveLookup(legacy, filters, selectedId, next, allResults); };
  const update = (column: TopologyFilterColumn, values: string[]) => {
    const next = { ...filters, [column]: values }, nextLegacy = { ...legacy, [column]: "" };
    setFilters(next); setLegacy(nextLegacy); setPage(1); saveLookup(nextLegacy, next, selectedId, mode, allResults);
  };
  const clearLegacy = (key: TopologyFilterColumn) => { const next = { ...legacy, [key]: "" }; setLegacy(next); setPage(1); saveLookup(next, filters, selectedId, mode, allResults); };
  const clearAll = () => { const next = emptyTopologyLookup(); setLegacy(next); setFilters({}); setPage(1); setOpenColumn(null); saveLookup(next, {}, selectedId, mode, allResults); };
  const activeFilters = TOPOLOGY_FILTER_COLUMNS.filter(({ key }) => filters[key]?.length || legacy[key]);
  return <article className="topology-explorer" data-snapshot={model.snapshotDate} data-topology-mode={mode} data-topology-selection={allResults ? "all" : "single"}>
    <header className="topology-hero panel">
      <div><p className="endpoint-eyebrow">Discovery / Recorded relationships</p><h1>Topology Explorer</h1>
        <p>Find a CI. Follow its connections from infrastructure to the services and mission services it supports.</p></div>
      <div className="topology-snapshot"><span>Applied scope · Snapshot</span><strong>{model.snapshotDate}</strong><span>{number(model.nodes.length)} searchable CIs</span></div>
    </header>
    <section className="topology-lookup panel" aria-labelledby="topology-lookup-title">
      <div className="topology-section-heading"><h2 id="topology-lookup-title">Find a configuration item</h2><button type="button" className="endpoint-export" onClick={clearAll}>Clear filters</button></div>
      <div className="topology-filter-grid">{facets.map(column => <div className="topology-filter-control" key={column.key}>
        <FilterHeader column={column} selected={filters[column.key] ?? []} options={column.options} open={openColumn === column.key} valueLabel={value => valueLabel(column.key, value)}
          onOpen={open => setOpenColumn(open ? column.key : null)} onChange={values => update(column.key, values)} />
      </div>)}</div>
      {!!activeFilters.length && <div className="endpoint-active-filters" aria-label="Active topology filters"><span>Filtered by</span>
        {activeFilters.map(({ key, label }) => <span key={key} className="topology-filter-chips">
          {!!filters[key]?.length && <button type="button" aria-label={`Clear ${label} filter`} onClick={() => update(key, [])}>
            {label}: {filters[key]!.length === 1 ? valueLabel(key, filters[key]![0]) : `${filters[key]!.length} selected`} <span aria-hidden="true">×</span></button>}
          {legacy[key] && <button type="button" aria-label={`Clear ${label} bookmark search`} onClick={() => clearLegacy(key)}>
            {label} search: {key === "kind" ? Object.entries(TOPOLOGY_KINDS).find(([kind]) => kind === legacy.kind)?.[1].label : legacy[key]} <span aria-hidden="true">×</span></button>}
        </span>)}
      </div>}
      <p>Search a filter menu, then select matching values. Selections within a field combine with OR; different fields combine with AND. Counts show matching CIs and respect the other filters. Software, CVE and IP filters use endpoint evidence only.</p>
    </section>
    <div className="topology-workspace">
      <aside className="topology-results panel" aria-label="CI lookup results">
        <header><div><h2>Matching CIs</h2><span role="status">{number(matches.length)} results</span></div>
          <button type="button" className="topology-text-button topology-show-all" data-topology-show-all aria-pressed={allResults} disabled={!matches.length} onClick={showAll}>Show all results in Impact Topology</button></header>
        <ul>{matches.slice((currentPage - 1) * 50, currentPage * 50).map(node => <li key={node.id}><button type="button" data-topology-result={node.id}
          aria-pressed={allResults || node.id === selectedId} onClick={() => choose(node.id)}>
          <i style={{ background: TOPOLOGY_KINDS[node.kind].color }}>{TOPOLOGY_KINDS[node.kind].short}</i>
          <span><strong>{node.name}</strong><small>{node.type}{node.ip ? ` · ${node.ip}` : ""}</small><small>{node.sourceId}</small></span><b aria-hidden="true">→</b>
        </button></li>)}</ul>
        {!matches.length && <div className="topology-empty"><h3>{model.nodes.length ? "No matching CIs" : "No CIs in this scope"}</h3><p>{model.nodes.length ? "Adjust or clear the lookup filters." : "Choose a different network, ICT system, security domain or snapshot."}</p></div>}
        {matches.length > 50 && <footer><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} / {pageCount}</span><button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></footer>}
      </aside>
      <section className="topology-main topology-impact-graph panel" aria-label="Topology graph">
        {root ? <TopologyGraph key={selectionKey} graph={trace} root={root} selectionLabel={selectionLabel} allResults={allResults} reportContext={reportContext} onExplore={choose} snapshotDate={model.snapshotDate} modeId={modeId} onModeChange={changeMode} />
         : <><header className="impact-graph-header"><div><h2>Impact Topology</h2></div><div className="impact-graph-view-actions topology-graph-actions">
           <WorkspaceTabs id={modeId} label="Topology mode" tabs={TOPOLOGY_MODES} active={mode} onChange={changeMode} />
           <button type="button" className="endpoint-export" data-topology-impact-report disabled>Generate Impact Report</button>
         </div></header><div className="topology-welcome" id={`${modeId}-panel-${mode}`} role="tabpanel" aria-labelledby={`${modeId}-tab-${mode}`}><div aria-hidden="true" className="topology-welcome-symbol">◎</div><p className="endpoint-eyebrow">Start with a CI</p><h2>See how the pieces connect</h2>
          <p>Select a lookup result to draw its recorded paths.</p><div className="topology-guide"><p><strong>Business Impact</strong><span>View related networks, ICT systems, business services and mission services above and below the selected CI.</span></p><p><strong>Dependencies</strong><span>View recorded relationships between networks, ICT systems, business services, mission services and their member CIs.</span></p></div>
          {allResults ? <p role="status">No matching results are available for the graph. Adjust or clear the lookup filters.</p> : selectedId && <p role="status">The previously selected CI is unavailable in this scope or snapshot.</p>}</div></>}
      </section>
    </div>
    {root && mode === "dependencies" && <details className="topology-relationships topology-evidence panel"><summary>Relationship evidence ({number(relationshipRows.length)} relationships)</summary>
      <FindingsDataTable key={selectionKey} title="Recorded model relationships" rows={relationshipRows} columns={relationshipColumns} defaultPageSize={25}
        renderRow={row => <tr key={row.id}>
          <td><button type="button" className="topology-text-button" onClick={() => choose(row.source)}>{row.sourceName}</button></td>
          <td>{row.label}</td>
          <td><button type="button" className="topology-text-button" onClick={() => choose(row.target)}>{row.targetName}</button></td>
          <td>{row.environment}</td></tr>} />
    </details>}
    {root && <details className="topology-evidence panel"><summary>Explore all path CIs and relationships</summary>
      <FindingsDataTable key={selectionKey} title="Path CIs" rows={trace.nodes} columns={nodeColumns} defaultPageSize={25}
        renderRow={node => <tr key={node.id}><td><button type="button" className="topology-text-button" onClick={() => choose(node.id)}>{node.name}</button></td><td>{node.type}</td><td>{node.sourceId}</td><td>{node.domain || "Not applicable"}</td></tr>} />
      <ul className="topology-relationship-list">{trace.edges.map(edge => <li key={edge.id}><strong>{trace.nodes.find(node => node.id === edge.source)?.name}</strong><span>{edge.label} →</span><strong>{trace.nodes.find(node => node.id === edge.target)?.name}</strong></li>)}</ul>
      {!trace.edges.length && <p>No recorded relationships are available for this CI within the applied scope.</p>}
    </details>}
    <p className="topology-method">Both views use the header scope, selected Security Domains and snapshot. Dependencies shows recorded model relationships and member CIs. Business Impact shows the higher-level context; any ARP links are labelled observations. Services and mission services associate independently with ICT systems. These views do not predict outages.</p>
  </article>;
}

type TopologyGraphProps = { graph: ReturnType<typeof traceTopology>; root: TopologyExplorerNode; selectionLabel: string; allResults: boolean; onExplore: (id: string) => void };
type TopologyGraphView = { layout: ImpactLayout; selected: string; search: string; camera: { x: number; y: number; zoom: number }; moved: Map<string, ImpactNodePosition> };
const initialTopologyView = (rootId: string): TopologyGraphView => ({ layout: "hierarchical", selected: rootId, search: "", camera: { x: 0, y: 0, zoom: 1 }, moved: new Map() });

function TopologyGraph({ snapshotDate, modeId, onModeChange, reportContext, ...props }: TopologyGraphProps & { snapshotDate: string; modeId: string; onModeChange: (mode: TopologyMode) => void; reportContext: { model: TopologyExplorerModel; query: string; filters: string[] } }) {
  const { root, graph, selectionLabel, allResults } = props, titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null), toggle = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const displayedPositions = useRef(new Map<string, ImpactNodePosition>());
  const [fullScreen, setFullScreen] = useState(false);
  // Keep the user's graph view here while the canvas moves between inline and modal rendering.
  const [view, setView] = useState<TopologyGraphView>(() => initialTopologyView(root.id));
  const changeMode = (next: TopologyMode) => {
    if (next !== graph.mode) setView(initialTopologyView(root.id));
    onModeChange(next);
  };
  useEffect(() => {
    if (!fullScreen) {
      if (restoreFocus.current) { toggle.current?.focus(); restoreFocus.current = false; }
      return;
    }
    restoreFocus.current = true;
    const panel = dialog.current, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel?.showModal(); toggle.current?.focus();
    return () => { panel?.close(); document.body.style.overflow = overflow; };
  }, [fullScreen]);
  const content = <>
    <header className="impact-graph-header topology-trace-heading"><div><p className="endpoint-eyebrow">{graph.mode === "business-impact" ? "Business Impact / Upstream & downstream" : "Dependencies / Recorded model relationships"}</p><h2 id={titleId}>Impact Topology</h2>
      <p>{selectionLabel} · Snapshot {snapshotDate}</p></div><div className="impact-graph-view-actions topology-graph-actions">
      <WorkspaceTabs id={modeId} label="Topology mode" tabs={TOPOLOGY_MODES} active={graph.mode} onChange={changeMode} />
      <span className="topology-type">{allResults ? `${number(graph.rootIds.length)} starting CIs` : root.type}</span>
      <TopologyImpactReportButton createJob={() => topologyImpactReportJob(reportContext.model, graph, selectionLabel, new URLSearchParams(reportContext.query), reportContext.filters, view.layout, displayedPositions.current)} />
      <button ref={toggle} type="button" className="endpoint-export" data-topology-fullscreen aria-pressed={fullScreen} aria-haspopup="dialog"
        aria-label={fullScreen ? "Exit full screen" : "Enter full screen"} onClick={() => setFullScreen(current => !current)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d={fullScreen ? "M9 3v6H3m12-6v6h6M3 15h6v6m12-6h-6v6" : "M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"} />
        </svg>{fullScreen ? "Exit full screen" : "Full screen"}
      </button></div></header>
    <div className="topology-graph-mode-panel" id={`${modeId}-panel-${graph.mode}`} role="tabpanel" aria-labelledby={`${modeId}-tab-${graph.mode}`}>
    <div className="impact-graph-summary" role="status"><span><strong>{number(graph.nodes.length)}</strong> CIs</span><span><strong>{number(graph.edges.length)}</strong> recorded relationships</span>
      {graph.mode === "dependencies" && (allResults || root.kind !== "asset") && <span><strong>{number(graph.memberCount)}</strong> member endpoints in scope</span>}</div>
    <TopologyDiagram key={graph.mode} {...props} view={view} setView={setView} displayedPositions={displayedPositions} />
    </div>
  </>;
  return fullScreen ? createPortal(<dialog ref={dialog} className="topology-main topology-impact-graph topology-fullscreen panel" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); setFullScreen(false); }}
    onKeyDown={event => {
      if (event.key !== "Tab" || !(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement | SVGElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'))
        .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>{content}</dialog>, document.body) : content;
}

function TopologyDiagram({ graph, root, selectionLabel, allResults, onExplore, view, setView, displayedPositions }: TopologyGraphProps & { view: TopologyGraphView; setView: Dispatch<SetStateAction<TopologyGraphView>>; displayedPositions: MutableRefObject<Map<string, ImpactNodePosition>> }) {
  const startingIds = useMemo(() => new Set(graph.rootIds), [graph.rootIds]);
  const id = useId(), svg = useRef<SVGSVGElement>(null);
  const { layout, selected, search, camera, moved } = view;
  const setLayout = (layout: ImpactLayout) => setView(current => ({ ...current, layout }));
  const setSelected = (selected: string) => setView(current => ({ ...current, selected }));
  const setSearch = (search: string) => setView(current => ({ ...current, search }));
  const setCamera = (update: (camera: TopologyGraphView["camera"]) => TopologyGraphView["camera"]) => setView(current => ({ ...current, camera: update(current.camera) }));
  const setMoved = (update: (moved: TopologyGraphView["moved"]) => TopologyGraphView["moved"]) => setView(current => ({ ...current, moved: update(current.moved) }));
  const [canvasWidth, setCanvasWidth] = useState(800);
  useEffect(() => {
    const element = svg.current; if (!element) return;
    const observer = new ResizeObserver(entries => setCanvasWidth(entries[0].contentRect.width));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const compact = canvasWidth < 480;
  const target = useMemo(() => layoutTopology(graph, layout, compact), [graph, layout, compact]);
  const { positions: animated, animating } = useImpactGraphLayout(target, `${layout}:${compact}`);
  const positions = useMemo(() => new Map([...animated].map(([key, point]) => [key, moved.get(key) ?? point])), [animated, moved]);
  useEffect(() => { displayedPositions.current = positions; }, [positions, displayedPositions]);
  const drag = useRef<{ pointer: number; id: string | null; x: number; y: number; origin: ImpactNodePosition; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const bounds = useMemo(() => {
    const points = [...animated.values()];
    const x = Math.min(...points.map(p => p.x)) - 120, y = Math.min(...points.map(p => p.y)) - 80;
    return { x, y, width: Math.max(400, Math.max(...points.map(p => p.x)) - x + 120), height: Math.max(300, Math.max(...points.map(p => p.y)) - y + 100) };
  }, [animated]);
  const fit = () => { setMoved(() => new Map()); setCamera(() => ({ x: 0, y: 0, zoom: 1 })); };
  const zoom = useCallback((factor: number) => setView(current => ({ ...current,
    camera: { ...current.camera, zoom: Math.min(6, Math.max(.3, current.camera.zoom * factor)) } })), [setView]);
  useEffect(() => {
    const canvas = svg.current;
    if (!canvas) return;
    const wheel = (event: WheelEvent) => {
      if (!Number.isFinite(event.deltaY) || event.deltaY === 0 || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, [zoom]);
  const startDrag = (event: PointerEvent<SVGElement>, nodeId: string | null) => {
    if (event.button !== 0 || animating) return;
    event.stopPropagation(); suppressClick.current = false;
    drag.current = { pointer: event.pointerId, id: nodeId, x: event.clientX, y: event.clientY, origin: nodeId ? positions.get(nodeId)! : camera, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    const active = drag.current, matrix = svg.current?.getScreenCTM();
    if (!active || active.pointer !== event.pointerId || !matrix) return;
    if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 4) active.moved = true;
    if (!active.moved) return;
    if (active.id) {
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      setMoved(current => new Map(current).set(active.id!, { x: point.x, y: point.y }));
    } else setCamera(current => ({ ...current, x: active.origin.x - (event.clientX - active.x) / matrix.a, y: active.origin.y - (event.clientY - active.y) / matrix.d }));
  };
  const node = graph.nodes.find(item => item.id === selected) ?? root;
  const connections = graph.edges.filter(edge => edge.source === node.id || edge.target === node.id);
  const connected = new Set(connections.map(edge => edge.source === node.id ? edge.target : edge.source));
  const nodeById = useMemo(() => new Map(graph.nodes.map(item => [item.id, item])), [graph.nodes]);
  const connectionCounts = useMemo(() => {
    const peers = new Map(graph.nodes.map(item => [item.id, new Set<string>()]));
    for (const edge of graph.edges) { peers.get(edge.source)?.add(edge.target); peers.get(edge.target)?.add(edge.source); }
    return new Map([...peers].map(([key, values]) => [key, values.size]));
  }, [graph.nodes, graph.edges]);
  const searchMatches = search.trim() ? graph.nodes.filter(item => `${item.name} ${item.sourceId} ${item.type} ${item.ip}`.toLowerCase().includes(search.trim().toLowerCase())) : [];
  const availableServices = graph.nodes.some(item => item.kind === "business" || item.kind === "mission");
  return <>
    <div className="impact-graph-controls topology-controls" role="group" aria-label="Layout and navigation">
      <label className="topology-layout-control">Layout<select aria-label="Topology layout" value={layout} onChange={event => { setLayout(event.target.value as ImpactLayout); fit(); }}>
      <option value="hierarchical">Hierarchical</option><option value="force" disabled={graph.nodes.length > 140}>Force-directed</option><option value="circular">Radial</option></select></label>
      <div className="impact-graph-toolbar"><div role="group" aria-label="Topology graph navigation"><button type="button" aria-label="Zoom out" onClick={() => zoom(1 / 1.25)}>−</button><span aria-live="polite">{Math.round(camera.zoom * 100)}%</span><button type="button" aria-label="Zoom in" onClick={() => zoom(1.25)}>+</button><button type="button" onClick={fit}>Fit graph</button></div></div>
    </div>
    <div className="impact-graph-workspace"><div className="impact-graph-main">
    <div className="impact-graph-canvas topology-graph-canvas" style={compact && layout === "hierarchical" ? { minHeight: Math.max(430, bounds.height * canvasWidth / bounds.width) } : undefined}>
    <svg ref={svg} className={`topology-canvas${compact ? " is-compact" : ""}`} tabIndex={0} role="group" aria-label={`${graph.mode === "business-impact" ? "Business Impact" : "Dependencies"} topology for ${selectionLabel}`} aria-describedby={`${id}-help`}
      viewBox={`${bounds.x + camera.x + bounds.width * (1 - 1 / camera.zoom) / 2} ${bounds.y + camera.y + bounds.height * (1 - 1 / camera.zoom) / 2} ${bounds.width / camera.zoom} ${bounds.height / camera.zoom}`}
      onPointerDown={event => startDrag(event, null)} onPointerMove={moveDrag} onPointerUp={() => { suppressClick.current = Boolean(drag.current?.moved); drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0"].includes(event.key)) return;
        event.preventDefault();
        if (event.key === "0") fit(); else if (event.key === "+" || event.key === "=") zoom(1.25); else if (event.key === "-") zoom(1 / 1.25);
        else setCamera(current => ({ ...current, x: current.x + (event.key === "ArrowLeft" ? -40 : event.key === "ArrowRight" ? 40 : 0) / current.zoom, y: current.y + (event.key === "ArrowUp" ? -40 : event.key === "ArrowDown" ? 40 : 0) / current.zoom }));
      }}>
      <defs><marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7893a8" /></marker></defs>
      {graph.edges.map(edge => {
        const a = positions.get(edge.source)!, b = positions.get(edge.target)!, length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const highlighted = edge.source === selected || edge.target === selected;
        const sourceRadius = impactGraphNodeRadius(nodeById.get(edge.source)!.kind) + 8, targetRadius = impactGraphNodeRadius(nodeById.get(edge.target)!.kind) + 8;
        const x1 = a.x + (b.x - a.x) * sourceRadius / length, y1 = a.y + (b.y - a.y) * sourceRadius / length;
        const x2 = b.x - (b.x - a.x) * targetRadius / length, y2 = b.y - (b.y - a.y) * targetRadius / length;
        return <g key={edge.id} data-topology-edge-kind={edge.kind} data-source={edge.source} data-target={edge.target}
          className={`impact-graph-edge topology-edge${highlighted ? " is-active is-selected" : ""}`} opacity={highlighted ? 1 : .2}>
          <title>{`${graph.nodes.find(node => node.id === edge.source)?.name} → ${graph.nodes.find(node => node.id === edge.target)?.name}: ${edge.label}`}</title>
          <line x1={x1} y1={y1} x2={x2} y2={y2} markerEnd={`url(#${id}-arrow)`} />
          {(highlighted || graph.edges.length <= 12) && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 7}>{edge.label}</text>}
        </g>;
      })}
      {graph.nodes.map(item => {
        const point = positions.get(item.id)!; const category = TOPOLOGY_KINDS[item.kind], r = impactGraphNodeRadius(item.kind);
        return <g key={item.id} data-topology-node={item.id} transform={`translate(${point.x} ${point.y})`} role="button" tabIndex={0} aria-label={`${item.type}: ${item.name}`} aria-pressed={item.id === selected}
          className={`impact-graph-node topology-node${item.id === selected ? " is-selected" : ""}${startingIds.has(item.id) ? " is-root" : ""}`} opacity={item.id === selected || connected.has(item.id) ? 1 : .28} onPointerDown={event => startDrag(event, item.id)}
          onClick={() => { if (!suppressClick.current) setSelected(item.id); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setSelected(item.id); } }}>
          <title>{`${item.name} — ${item.type}`}</title>{startingIds.has(item.id) && <circle r={r + 11} className="topology-root-ring" />}
          <ImpactGraphNodeVisual name={item.name} color={category.color} glyph={category.short} radius={r} badge={number(connectionCounts.get(item.id) ?? 0)} labelLines={compact ? compactLabel(item.name) : undefined} />
        </g>;
      })}
    </svg></div>
    <div className="impact-graph-legend topology-legend">{Object.entries(TOPOLOGY_KINDS).filter(([kind]) => graph.nodes.some(item => item.kind === kind)).map(([kind, category]) => <span key={kind}><i style={{ background: category.color }} />{category.label}</span>)}
      {graph.mode === "dependencies" && <span><i className="topology-line-key" />Model relationship</span>}</div>
    <p id={`${id}-help`} className="impact-graph-help">Scroll up to zoom in or down to zoom out. Drag to pan or move nodes. Focus the graph and use arrow keys to pan, +/− to zoom, 0 to fit. Select nodes to inspect their connections.</p>
    <p className="impact-graph-status">Badges count connected CIs in this graph. Outer rings mark the starting CIs.</p>
    {!availableServices && <p className="topology-notice">No business service or mission service association is recorded within this scope for the displayed CIs.</p>}
    {!graph.edges.length && <p className="topology-notice">No recorded paths in this scope. The selected CI is shown on its own.</p>}
    </div><aside className="impact-graph-inspector topology-inspector">
    <label className="impact-graph-search">Find in this graph<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="CI name, ID, type or IP" /></label>
    {search.trim() && <div className="impact-graph-search-results"><p role="status">{number(searchMatches.length)} matching CIs{searchMatches.length > 50 ? " · First 50 shown; refine your search" : ""}</p>{searchMatches.slice(0, 50).map(item => <button type="button" key={item.id} aria-pressed={item.id === selected} onClick={() => setSelected(item.id)}>{item.name}<small>{item.type}</small></button>)}</div>}
    <section className="impact-graph-node-detail" aria-label="Selected node details"><div><p className="endpoint-eyebrow" style={{ color: TOPOLOGY_KINDS[node.kind].color }}>{node.type}{startingIds.has(node.id) ? " / Starting CI" : " / Selected node"}</p><h3>{node.name}</h3><p>{node.sourceId}{node.domain ? ` · ${node.domain}` : ""}{node.ip ? ` · ${node.ip}` : ""}</p></div>
      <dl><div><dt>Connected CIs</dt><dd>{number(connected.size)}</dd></div><div><dt>Relationships</dt><dd>{number(connections.length)}</dd></div></dl>
      <div className="topology-inspector-actions">{(node.kind === "asset" || node.kind === "business" || node.kind === "mission") && <span>CMDB: <CmdbDeviceName assetId={node.sourceId} name={node.name}
        ciType={node.kind === "business" ? "business-service" : node.kind === "mission" ? "mission-capability" : undefined}
        /></span>}{(allResults || node.id !== root.id) && <button type="button" className="endpoint-export" onClick={() => onExplore(node.id)}>Explore from this CI</button>}</div>
      {!!(node.software.length || node.cves.length) && <details><summary>Software and CVE evidence ({node.software.length} software versions, {node.cves.length} CVE codes)</summary><p>{node.software.join(" · ") || "No installed software recorded"}</p><p>{node.cves.join(" · ") || "No CVE observations recorded"}</p></details>}
      <h4>Connected nodes <span>{number(connected.size)}</span></h4>
      {!connections.length && <p>No recorded connections in this graph.</p>}
      <ul className="impact-graph-connections">{connections.map(edge => {
        const other = graph.nodes.find(item => item.id === (edge.source === node.id ? edge.target : edge.source))!;
        return <li key={edge.id}><button type="button" onClick={() => setSelected(other.id)}><i style={{ background: TOPOLOGY_KINDS[other.kind].color }} /><span>{other.name}<small>{edge.source === node.id ? edge.label : `${edge.label} ←`}</small></span><span aria-hidden="true">→</span></button></li>;
      })}</ul>
    </section></aside></div>
  </>;
}
