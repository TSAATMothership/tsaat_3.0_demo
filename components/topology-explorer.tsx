"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type Dispatch, type SetStateAction, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { CmdbDeviceName } from "@/components/cmdb-drill-through";
import { FindingsDataTable } from "@/components/findings-data-table";
import { FilterHeader } from "@/components/inventory-explorer-controls";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { useImpactGraphLayout } from "@/components/use-impact-graph-layout";
import { ImpactGraphNodeVisual, impactGraphNodeRadius } from "@/components/impact-graph-node-visual";
import { emptyTopologyLookup, layoutTopology, lookupTopology, traceTopology, parseTopologyMode, TOPOLOGY_KINDS, TOPOLOGY_MODES,
  type TopologyExplorerModel, type TopologyExplorerNode, type TopologyLookup, type TopologyMode, type TopologyCommunication } from "@/lib/topology-explorer";
import type { ExplorerColumn } from "@/lib/explorer-table";
import type { ImpactLayout, ImpactNodePosition } from "@/lib/topology-layout";
import { TOPOLOGY_FILTER_COLUMNS, filterTopologyNodes, parseTopologyColumnFilters, serializeTopologyColumnFilters, topologyFacetCounts, topologyNameLabel,
  type TopologyColumnFilters, type TopologyFilterColumn } from "@/lib/topology-lookup-filters";

const nodeColumns: ExplorerColumn<TopologyExplorerNode>[] = [
  { key: "name", label: "CI name", value: row => row.name }, { key: "type", label: "CI type", value: row => row.type },
  { key: "sourceId", label: "CI ID", value: row => row.sourceId }, { key: "domain", label: "Security domain", value: row => row.domain || "Not applicable" }
];
type CommunicationRow = TopologyCommunication & { source: string; target: string; sourceName: string; targetName: string };
const communicationColumns: ExplorerColumn<CommunicationRow>[] = [
  { key: "source", label: "Source CI", value: row => row.sourceName }, { key: "target", label: "Target CI", value: row => row.targetName },
  { key: "protocol", label: "Protocol", value: row => row.protocol || "Not recorded" },
  { key: "sourcePort", label: "Source port", value: row => row.sourcePort?.toString() ?? "Not recorded" },
  { key: "targetPort", label: "Target port", value: row => row.targetPort?.toString() ?? "Not recorded" },
  { key: "method", label: "Observation method", value: row => row.observationMethod || "Not recorded" },
  { key: "observedAt", label: "Observed at (UTC)", value: row => row.observedAt || "Not recorded" }
];
const number = (n: number) => n.toLocaleString("en-AU");
function compactLabel(name: string): string[] {
  if (name.length <= 22) return [name];
  const boundary = name.lastIndexOf(" ", 22);
  const split = boundary > 0 ? boundary : 22;
  const rest = name.slice(split).trim();
  return [name.slice(0, split), rest.length > 22 ? `${rest.slice(0, 20).trimEnd()}…` : rest];
}
function saveLookup(legacy: TopologyLookup, filters: TopologyColumnFilters, ci: string, mode: TopologyMode) {
  const query = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(legacy)) { if (value) query.set(`topology_${key}`, value); else query.delete(`topology_${key}`); }
  const encoded = serializeTopologyColumnFilters(filters);
  if (encoded) query.set("topology_filters", encoded); else query.delete("topology_filters");
  if (ci) query.set("topologyCi", ci); else query.delete("topologyCi");
  if (mode === "dependencies") query.set("topologyMode", mode); else query.delete("topologyMode");
  window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
}

function ExploreControl({ href, onClick, className, children }: { href?: string; onClick: () => void; className: string; children: ReactNode }) {
  // A scope change intentionally reloads the document to reset graph/popups.
  return href ? <a href={href} className={className}>{children}</a>
    : <button type="button" className={className} onClick={onClick}>{children}</button>;
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
  const allNodes = model.dependencyContext?.nodes ?? model.nodes;
  const lookupIds = useMemo(() => new Set(model.nodes.map(node => node.id)), [model.nodes]);
  const names = useMemo(() => new Map(allNodes.map(node => [node.id, topologyNameLabel(node)])), [allNodes]);
  const valueLabel = (column: TopologyFilterColumn, value: string) => column === "name" ? names.get(value) ?? value : value;
  const [selectedId, setSelectedId] = useState(params.get("topologyCi") ?? "");
  const [page, setPage] = useState(1);
  const legacyRows = useMemo(() => lookupTopology(model.nodes, legacy), [model.nodes, legacy]);
  const matches = useMemo(() => filterTopologyNodes(legacyRows, filters), [legacyRows, filters]);
  const facets = useMemo(() => TOPOLOGY_FILTER_COLUMNS.map(column => ({ ...column,
    options: topologyFacetCounts(lookupTopology(model.nodes, { ...legacy, [column.key]: "" }), filters, column.key) })), [model.nodes, legacy, filters]);
  const root = model.nodes.find(node => node.id === selectedId);
  const trace = useMemo(() => traceTopology(model, selectedId, mode), [model, selectedId, mode]);
  const communicationRows = useMemo(() => trace.edges.flatMap(edge => (edge.observations ?? []).map(observation => ({ ...observation,
    source: edge.source, target: edge.target, sourceName: names.get(edge.source) ?? edge.source, targetName: names.get(edge.target) ?? edge.target }))), [trace, names]);
  const pageCount = Math.max(1, Math.ceil(matches.length / 50)), currentPage = Math.min(page, pageCount);
  const hrefFor = (id: string) => {
    if (lookupIds.has(id)) return;
    const node = allNodes.find(node => node.id === id);
    if (!node?.scope) return;
    const query = new URLSearchParams({ discoveryView: "topology", topologyCi: id, topologyMode: mode, dataDate: model.snapshotDate });
    for (const [key, value] of Object.entries(node.scope)) if (value) query.set(key, value);
    for (const value of params.getAll("securityDomain")) query.append("securityDomain", value);
    return `/discovery-coverage?${query}`;
  };
  const choose = (id: string) => {
    if (!lookupIds.has(id)) return;
    setSelectedId(id); saveLookup(legacy, filters, id, mode);
  };
  const changeMode = (next: TopologyMode) => { setMode(next); saveLookup(legacy, filters, selectedId, next); };
  const update = (column: TopologyFilterColumn, values: string[]) => {
    const next = { ...filters, [column]: values }, nextLegacy = { ...legacy, [column]: "" };
    setFilters(next); setLegacy(nextLegacy); setPage(1); saveLookup(nextLegacy, next, selectedId, mode);
  };
  const clearLegacy = (key: TopologyFilterColumn) => { const next = { ...legacy, [key]: "" }; setLegacy(next); setPage(1); saveLookup(next, filters, selectedId, mode); };
  const clearAll = () => { const next = emptyTopologyLookup(); setLegacy(next); setFilters({}); setPage(1); setOpenColumn(null); saveLookup(next, {}, selectedId, mode); };
  const activeFilters = TOPOLOGY_FILTER_COLUMNS.filter(({ key }) => filters[key]?.length || legacy[key]);
  return <article className="topology-explorer" data-snapshot={model.snapshotDate} data-topology-mode={mode}>
    <header className="topology-hero panel">
      <div><p className="endpoint-eyebrow">Discovery / Recorded relationships</p><h1>Topology Explorer</h1>
        <p>Find a CI. Follow its connections from infrastructure to the services and capabilities it supports.</p></div>
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
        <header><h2>Matching CIs</h2><span role="status">{number(matches.length)} results</span></header>
        <ul>{matches.slice((currentPage - 1) * 50, currentPage * 50).map(node => <li key={node.id}><button type="button" data-topology-result={node.id}
          aria-pressed={node.id === selectedId} onClick={() => choose(node.id)}>
          <i style={{ background: TOPOLOGY_KINDS[node.kind].color }}>{TOPOLOGY_KINDS[node.kind].short}</i>
          <span><strong>{node.name}</strong><small>{node.type}{node.ip ? ` · ${node.ip}` : ""}</small><small>{node.sourceId}</small></span><b aria-hidden="true">→</b>
        </button></li>)}</ul>
        {!matches.length && <div className="topology-empty"><h3>{model.nodes.length ? "No matching CIs" : "No CIs in this scope"}</h3><p>{model.nodes.length ? "Adjust or clear the lookup filters." : "Choose a different network, ICT system, security domain or snapshot."}</p></div>}
        {matches.length > 50 && <footer><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} / {pageCount}</span><button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></footer>}
      </aside>
      <section className="topology-main topology-impact-graph panel" aria-label="Topology graph">
        {root ? <TopologyGraph key={root.id} graph={trace} root={root} onExplore={choose} hrefFor={hrefFor} lookupIds={lookupIds} snapshotDate={model.snapshotDate} modeId={modeId} onModeChange={changeMode} />
         : <><header className="impact-graph-header"><div><h2>Impact Topology</h2></div><div className="impact-graph-view-actions topology-graph-actions">
           <WorkspaceTabs id={modeId} label="Topology mode" tabs={TOPOLOGY_MODES} active={mode} onChange={changeMode} />
         </div></header><div className="topology-welcome" id={`${modeId}-panel-${mode}`} role="tabpanel" aria-labelledby={`${modeId}-tab-${mode}`}><div aria-hidden="true" className="topology-welcome-symbol">◎</div><p className="endpoint-eyebrow">Start with a CI</p><h2>See how the pieces connect</h2>
          <p>Select a lookup result to draw its recorded paths.</p><div className="topology-guide"><p><strong>Business Impact</strong><span>View related networks, ICT systems, business services and mission capabilities above and below the selected CI.</span></p><p><strong>Dependencies</strong><span>View direct communication in either direction. Model CIs use their member endpoints; each peer retains its business context.</span></p></div>
          {selectedId && <p role="status">The previously selected CI is unavailable in this scope or snapshot.</p>}</div></>}
      </section>
    </div>
    {root && mode === "dependencies" && <details className="topology-communications topology-evidence panel"><summary>Communication evidence ({number(communicationRows.length)} observations)</summary>
      <FindingsDataTable key={root.id} title="Communication observations" rows={communicationRows} columns={communicationColumns} defaultPageSize={25}
        renderRow={(row, index) => <tr key={`${row.source}:${row.target}:${row.id}:${index}`}>
          <td><ExploreControl href={hrefFor(row.source)} className="topology-text-button" onClick={() => choose(row.source)}>{row.sourceName}{!lookupIds.has(row.source) && " · Outside lookup scope"}</ExploreControl></td>
          <td><ExploreControl href={hrefFor(row.target)} className="topology-text-button" onClick={() => choose(row.target)}>{row.targetName}{!lookupIds.has(row.target) && " · Outside lookup scope"}</ExploreControl></td>
          <td>{row.protocol || "Not recorded"}</td><td>{row.sourcePort ?? "Not recorded"}</td><td>{row.targetPort ?? "Not recorded"}</td>
          <td>{row.observationMethod || "Not recorded"}</td><td>{row.observedAt || "Not recorded"}</td></tr>} />
    </details>}
    {root && <details className="topology-evidence panel"><summary>Explore all path CIs and relationships</summary>
      <FindingsDataTable key={root.id} title="Path CIs" rows={trace.nodes} columns={nodeColumns} defaultPageSize={25}
        renderRow={node => <tr key={node.id}><td><ExploreControl href={hrefFor(node.id)} className="topology-text-button" onClick={() => choose(node.id)}>{node.name}{!lookupIds.has(node.id) && " · Outside lookup scope"}</ExploreControl></td><td>{node.type}</td><td>{node.sourceId}</td><td>{node.domain || "Not applicable"}</td></tr>} />
      <ul className="topology-relationship-list">{trace.edges.map(edge => <li key={edge.id}><strong>{trace.nodes.find(node => node.id === edge.source)?.name}</strong><span>{edge.label} →</span><strong>{trace.nodes.find(node => node.id === edge.target)?.name}</strong></li>)}</ul>
      {!trace.edges.length && <p>No recorded relationships are available for this CI within the applied scope.</p>}
    </details>}
    <p className="topology-method">Lookup and Business Impact use the header scope. Dependencies adds direct peers and their model context across network/system boundaries, within the selected Security Domains and snapshot. Grey arrows show model relationships; cyan dashed arrows show source-to-target communication observations. ARP links do not prove communication or membership. These views do not predict outages.</p>
  </article>;
}

type TopologyGraphProps = { graph: ReturnType<typeof traceTopology>; root: TopologyExplorerNode; onExplore: (id: string) => void; hrefFor: (id: string) => string | undefined; lookupIds: Set<string> };
type TopologyGraphView = { layout: ImpactLayout; selected: string; search: string; camera: { x: number; y: number; zoom: number }; moved: Map<string, ImpactNodePosition> };
const initialTopologyView = (rootId: string): TopologyGraphView => ({ layout: "hierarchical", selected: rootId, search: "", camera: { x: 0, y: 0, zoom: 1 }, moved: new Map() });

function TopologyGraph({ snapshotDate, modeId, onModeChange, ...props }: TopologyGraphProps & { snapshotDate: string; modeId: string; onModeChange: (mode: TopologyMode) => void }) {
  const { root, graph } = props, titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null), toggle = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
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
    <header className="impact-graph-header topology-trace-heading"><div><p className="endpoint-eyebrow">{graph.mode === "business-impact" ? "Business Impact / Upstream & downstream" : "Dependencies / Incoming & outgoing"}</p><h2 id={titleId}>Impact Topology</h2>
      <p>{root.name} · Snapshot {snapshotDate}</p></div><div className="impact-graph-view-actions topology-graph-actions">
      <WorkspaceTabs id={modeId} label="Topology mode" tabs={TOPOLOGY_MODES} active={graph.mode} onChange={changeMode} />
      <span className="topology-type">{root.type}</span>
      <button ref={toggle} type="button" className="endpoint-export" data-topology-fullscreen aria-pressed={fullScreen} aria-haspopup="dialog"
        aria-label={fullScreen ? "Exit full screen" : "Enter full screen"} onClick={() => setFullScreen(current => !current)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d={fullScreen ? "M9 3v6H3m12-6v6h6M3 15h6v6m12-6h-6v6" : "M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"} />
        </svg>{fullScreen ? "Exit full screen" : "Full screen"}
      </button></div></header>
    <div className="topology-graph-mode-panel" id={`${modeId}-panel-${graph.mode}`} role="tabpanel" aria-labelledby={`${modeId}-tab-${graph.mode}`}>
    <div className={`impact-graph-summary${graph.mode === "dependencies" ? " topology-communication-summary" : ""}`} role="status"><span><strong>{number(graph.nodes.length)}</strong> CIs</span><span><strong>{number(graph.edges.length)}</strong> recorded relationships</span>
      {graph.mode === "dependencies" && <><span><strong>{number(graph.communicationCount)}</strong> communication observations</span><span><strong>{number(graph.peerCount)}</strong> {root.kind === "asset" ? "direct peers" : "peers outside member endpoints"}</span>
        {root.kind !== "asset" && <span><strong>{number(graph.memberCount)}</strong> member endpoints in lookup scope</span>}</>}</div>
    <TopologyDiagram key={graph.mode} {...props} view={view} setView={setView} />
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

function TopologyDiagram({ graph, root, onExplore, hrefFor, lookupIds, view, setView }: TopologyGraphProps & { view: TopologyGraphView; setView: Dispatch<SetStateAction<TopologyGraphView>> }) {
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
    <svg ref={svg} className={`topology-canvas${compact ? " is-compact" : ""}`} tabIndex={0} role="group" aria-label={`${graph.mode === "business-impact" ? "Business Impact" : "Dependencies"} topology for ${root.name}`} aria-describedby={`${id}-help`}
      viewBox={`${bounds.x + camera.x + bounds.width * (1 - 1 / camera.zoom) / 2} ${bounds.y + camera.y + bounds.height * (1 - 1 / camera.zoom) / 2} ${bounds.width / camera.zoom} ${bounds.height / camera.zoom}`}
      onPointerDown={event => startDrag(event, null)} onPointerMove={moveDrag} onPointerUp={() => { suppressClick.current = Boolean(drag.current?.moved); drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0"].includes(event.key)) return;
        event.preventDefault();
        if (event.key === "0") fit(); else if (event.key === "+" || event.key === "=") zoom(1.25); else if (event.key === "-") zoom(1 / 1.25);
        else setCamera(current => ({ ...current, x: current.x + (event.key === "ArrowLeft" ? -40 : event.key === "ArrowRight" ? 40 : 0) / current.zoom, y: current.y + (event.key === "ArrowUp" ? -40 : event.key === "ArrowDown" ? 40 : 0) / current.zoom }));
      }}>
      <defs>{[["arrow", "#7893a8"], ["communication", "#67e8f9"]].map(([name, color]) => <marker key={name} id={`${id}-${name}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={color} /></marker>)}</defs>
      {graph.edges.map(edge => {
        const a = positions.get(edge.source)!, b = positions.get(edge.target)!, length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const highlighted = edge.source === selected || edge.target === selected;
        const communication = edge.kind === "communication";
        const sourceRadius = impactGraphNodeRadius(nodeById.get(edge.source)!.kind) + 8, targetRadius = impactGraphNodeRadius(nodeById.get(edge.target)!.kind) + 8;
        const x1 = a.x + (b.x - a.x) * sourceRadius / length, y1 = a.y + (b.y - a.y) * sourceRadius / length;
        const x2 = b.x - (b.x - a.x) * targetRadius / length, y2 = b.y - (b.y - a.y) * targetRadius / length;
        const curve = `M ${x1} ${y1} Q ${(a.x + b.x) / 2 - (b.y - a.y) * 45 / length} ${(a.y + b.y) / 2 + (b.x - a.x) * 45 / length} ${x2} ${y2}`;
        return <g key={edge.id} data-topology-edge-kind={edge.kind} data-source={edge.source} data-target={edge.target}
          className={`impact-graph-edge topology-edge${highlighted ? " is-active is-selected" : ""}${communication ? " is-communication" : ""}`} opacity={highlighted ? 1 : .2}>
          <title>{`${graph.nodes.find(node => node.id === edge.source)?.name} → ${graph.nodes.find(node => node.id === edge.target)?.name}: ${edge.label}${communication ? ` (${edge.observations?.length} observations)` : ""}`}</title>
          {communication ? <path d={curve} markerEnd={`url(#${id}-communication)`} /> : <line x1={x1} y1={y1} x2={x2} y2={y2} markerEnd={`url(#${id}-arrow)`} />}
          {(highlighted || graph.edges.length <= 12) && <text x={(a.x + b.x) / 2 - (communication ? (b.y - a.y) * 22.5 / length : 0)} y={(a.y + b.y) / 2 + (communication ? (b.x - a.x) * 22.5 / length : 0) - 7}>{edge.label}</text>}
        </g>;
      })}
      {graph.nodes.map(item => {
        const point = positions.get(item.id)!; const category = TOPOLOGY_KINDS[item.kind], r = impactGraphNodeRadius(item.kind);
        return <g key={item.id} data-topology-node={item.id} data-outside-scope={!lookupIds.has(item.id) || undefined} transform={`translate(${point.x} ${point.y})`} role="button" tabIndex={0} aria-label={`${item.type}: ${item.name}${!lookupIds.has(item.id) ? ", outside lookup scope" : ""}`} aria-pressed={item.id === selected}
          className={`impact-graph-node topology-node${item.id === selected ? " is-selected" : ""}${item.id === root.id ? " is-root" : ""}${!lookupIds.has(item.id) ? " is-context" : ""}`} opacity={item.id === selected || connected.has(item.id) ? 1 : .28} onPointerDown={event => startDrag(event, item.id)}
          onClick={() => { if (!suppressClick.current) setSelected(item.id); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setSelected(item.id); } }}>
          <title>{`${item.name} — ${item.type}`}</title>{item.id === root.id && <circle r={r + 11} className="topology-root-ring" />}
          <ImpactGraphNodeVisual name={item.name} color={category.color} glyph={category.short} radius={r} badge={number(connectionCounts.get(item.id) ?? 0)} labelLines={compact ? compactLabel(item.name) : undefined} />
          {!lookupIds.has(item.id) && <circle r={r} className="topology-context-ring" />}
        </g>;
      })}
    </svg></div>
    <div className="impact-graph-legend topology-legend">{Object.entries(TOPOLOGY_KINDS).filter(([kind]) => graph.nodes.some(item => item.kind === kind)).map(([kind, category]) => <span key={kind}><i style={{ background: category.color }} />{category.label}</span>)}
      {graph.mode === "dependencies" && <><span><i className="topology-line-key" />Model relationship</span><span><i className="topology-line-key is-communication" />Communication →</span></>}</div>
    <p id={`${id}-help`} className="impact-graph-help">Scroll up to zoom in or down to zoom out. Drag to pan or move nodes. Focus the graph and use arrow keys to pan, +/− to zoom, 0 to fit. Select nodes to inspect their connections.</p>
    <p className="impact-graph-status">Badges count connected CIs in this graph. The outer ring marks the starting CI.</p>
    {graph.nodes.some(item => !lookupIds.has(item.id)) && <p className="impact-graph-status">Dashed node outlines indicate CIs outside the lookup scope. Explore in this CI’s scope opens its network or ICT systems.</p>}
    {!availableServices && <p className="topology-notice">No business service or mission capability association is recorded within this scope for the displayed CIs.</p>}
    {graph.mode === "dependencies" && !graph.communicationCount && <p className="topology-notice" role="status">No recorded communication in this scope and snapshot{root.kind === "asset" ? " for this CI" : " involving this CI’s member endpoints"}. Available business context is still shown. This does not establish that the CI has no dependencies.</p>}
    {!graph.edges.length && <p className="topology-notice">No recorded paths in this scope. The selected CI is shown on its own.</p>}
    </div><aside className="impact-graph-inspector topology-inspector">
    <label className="impact-graph-search">Find in this graph<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="CI name, ID, type or IP" /></label>
    {search.trim() && <div className="impact-graph-search-results"><p role="status">{number(searchMatches.length)} matching CIs{searchMatches.length > 50 ? " · First 50 shown; refine your search" : ""}</p>{searchMatches.slice(0, 50).map(item => <button type="button" key={item.id} aria-pressed={item.id === selected} onClick={() => setSelected(item.id)}>{item.name}<small>{item.type}</small></button>)}</div>}
    <section className="impact-graph-node-detail" aria-label="Selected node details"><div><p className="endpoint-eyebrow" style={{ color: TOPOLOGY_KINDS[node.kind].color }}>{node.type}{node.id === root.id ? " / Starting CI" : " / Selected node"}</p><h3>{node.name}</h3><p>{node.sourceId}{node.domain ? ` · ${node.domain}` : ""}{node.ip ? ` · ${node.ip}` : ""}</p></div>
      <dl><div><dt>Connected CIs</dt><dd>{number(connected.size)}</dd></div><div><dt>Relationships</dt><dd>{number(connections.length)}</dd></div></dl>
      {!lookupIds.has(node.id) && <p className="topology-context-note">Outside lookup scope · Related context only</p>}
      <div className="topology-inspector-actions">{(node.kind === "asset" || node.kind === "business" || node.kind === "mission") && <span>CMDB: <CmdbDeviceName assetId={node.sourceId} name={node.name}
        ciType={node.kind === "business" ? "business-service" : node.kind === "mission" ? "mission-capability" : undefined}
        topologyNetworkId={!lookupIds.has(node.id) ? node.scope?.network : undefined}
        topologySystemIds={!lookupIds.has(node.id) ? node.scope?.system : undefined} /></span>}{node.id !== root.id && <ExploreControl href={hrefFor(node.id)} className="endpoint-export" onClick={() => onExplore(node.id)}>{lookupIds.has(node.id) ? "Explore from this CI" : "Explore in this CI’s scope"}</ExploreControl>}</div>
      {!!(node.software.length || node.cves.length) && <details><summary>Software and CVE evidence ({node.software.length} software versions, {node.cves.length} CVE codes)</summary><p>{node.software.join(" · ") || "No installed software recorded"}</p><p>{node.cves.join(" · ") || "No CVE observations recorded"}</p></details>}
      <h4>Connected nodes <span>{number(connected.size)}</span></h4>
      {!connections.length && <p>No recorded connections in this graph.</p>}
      <ul className="impact-graph-connections">{connections.map(edge => {
        const other = graph.nodes.find(item => item.id === (edge.source === node.id ? edge.target : edge.source))!;
        return <li key={edge.id}><button type="button" onClick={() => setSelected(other.id)}><i style={{ background: TOPOLOGY_KINDS[other.kind].color }} /><span>{other.name}<small>{edge.kind === "communication" ? `${edge.source === node.id ? "Communicates with →" : "Receives from ←"} (${edge.observations?.length} observations)` : edge.source === node.id ? edge.label : `${edge.label} ←`}</small></span><span aria-hidden="true">→</span></button></li>;
      })}</ul>
    </section></aside></div>
  </>;
}
