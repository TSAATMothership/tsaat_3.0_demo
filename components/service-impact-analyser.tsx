"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { FindingsDataTable } from "@/components/findings-data-table";
import { useCmdbDrillThrough } from "@/components/cmdb-drill-through";
import { severityBarColors } from "@/components/findings-duration-panel";
import { ServiceImpactFindingsPanel, ServiceImpactTabs, downloadImpactCsv, type ServiceImpactDetailTab } from "@/components/service-impact-findings-panel";
import { compareServiceImpact, impactCounts, selectServiceImpact, serviceImpactRows,
  type ServiceImpactCounts, type ServiceImpactFinding, type ServiceImpactModel, type ServiceImpactRow } from "@/lib/service-impact";
import type { ExplorerColumn } from "@/lib/explorer-table";
import type { Filters } from "@/lib/types";

const number = (value: number) => value.toLocaleString("en-AU");
const sameIds = (left: string[] | null, right: string[]) => left?.length === right.length && left.every((id, index) => id === right[index]);
const scopeTabs = [{ id: "business", label: "Business services" }, { id: "mission", label: "Mission capabilities" }] as const;
const pageTabs = [{ id: "scope", label: "Scope & Selection" }, { id: "analysis", label: "Explore the Impact" }] as const;
const analysisTabs = [{ id: "spi", label: "SPI findings" }, { id: "servers", label: "Server risk heatmap" },
  { id: "environment", label: "Environments" }, { id: "impact", label: "Service & mission impact" }] as const;
type ScopeKind = typeof scopeTabs[number]["id"];
type SystemRow = ServiceImpactModel["systems"][number] & ServiceImpactCounts;
type BarRow = ServiceImpactCounts & { id: string; name: string; note?: string; findingRows: ServiceImpactFinding[] };

const countColumns = <T extends ServiceImpactCounts>(): ExplorerColumn<T>[] => [
  { key: "critical", label: "Critical", value: row => row.critical, range: { value: row => row.critical, unit: "findings", min: 0, step: 1, sortable: true } },
  { key: "high", label: "High", value: row => row.high, range: { value: row => row.high, unit: "findings", min: 0, step: 1, sortable: true } },
  { key: "findings", label: "Open findings", value: row => row.findings, range: { value: row => row.findings, unit: "findings", min: 0, step: 1, sortable: true } },
  { key: "cis", label: "Affected CIs", value: row => row.affectedCis, range: { value: row => row.affectedCis, unit: "CIs", min: 0, step: 1, sortable: true } }
];
const entityColumns: ExplorerColumn<ServiceImpactRow>[] = [
  { key: "name", label: "Name", value: row => row.name }, { key: "criticality", label: "Criticality", value: row => row.criticality },
  { key: "systems", label: "ICT Systems", value: row => row.systemIds.length, range: { value: row => row.systemIds.length, unit: "systems", min: 0, step: 1, sortable: true } },
  ...countColumns<ServiceImpactRow>()
];
const systemColumns: ExplorerColumn<SystemRow>[] = [
  { key: "name", label: "ICT System", value: row => row.name }, { key: "appId", label: "APP-ID", value: row => row.appId || "Not provided" },
  { key: "criticality", label: "Criticality", value: row => row.criticality }, ...countColumns<SystemRow>()
];
const entitySearch = (row: ServiceImpactRow) => row.id;
const systemSearch = (row: SystemRow) => row.id;
const impactCsv = (row: ServiceImpactCounts & { name: string; criticality: string }) => ({ Name: row.name, Criticality: row.criticality,
  "Critical Exposure": row.critical, "High Risk": row.high, "Open findings": row.findings, "Affected CIs": row.affectedCis });

function ImpactBars({ rows, model, label, onOpen }: { rows: BarRow[]; model: ServiceImpactModel; label: string; onOpen: (title: string, findings: ServiceImpactFinding[]) => void }) {
  const maximum = Math.max(1, ...rows.map(row => row.findings));
  return <div className="service-impact-bars" role="group" aria-label={label}>
    {rows.map(row => <button type="button" key={row.id} onClick={() => onOpen(row.name, row.findingRows)} aria-label={`${row.name}: ${number(row.findings)} open findings. View findings.`}>
      <span className="service-impact-bar-heading"><span><strong>{row.name}</strong>{row.note && <small>{row.note}</small>}</span><strong>{number(row.findings)}</strong></span>
      <span className="service-impact-bar-track" aria-hidden="true"><span className="service-impact-bar-stack" style={{ width: `${row.findings / maximum * 100}%` }}>
        {model.severities.map(severity => <span key={severity.key} title={`${severity.label}: ${row.severities[severity.key] ?? 0}`}
          style={{ width: `${(row.severities[severity.key] ?? 0) / Math.max(1, row.findings) * 100}%`, backgroundColor: severityBarColors[severity.key] ?? "#94a3b8" }} />)}
      </span></span>
      <span className="service-impact-bar-note">{number(row.critical)} critical · {number(row.high)} high · {number(row.affectedCis)} affected CIs</span>
    </button>)}
    {!rows.length && <div className="endpoint-empty"><strong>No open findings in this view</strong><p>Change the selection or clear table filters to broaden the analysis.</p></div>}
  </div>;
}

function ServerHeatmap({ model, systemIds }: { model: ServiceImpactModel; systemIds: string[] }) {
  const { openCmdbDrillThrough } = useCmdbDrillThrough();
  const [query, setQuery] = useState(""); const [environment, setEnvironment] = useState("all"); const [domain, setDomain] = useState("all");
  const [size, setSize] = useState(40);
  const selection = useMemo(() => selectServiceImpact(model, systemIds), [model, systemIds]);
  const servers = useMemo(() => selection.assets.filter(asset => asset.type === "server").map(asset => ({ ...asset,
    ...impactCounts(selection.findingRows.filter(finding => finding.assetId === asset.id)) })).sort(compareServiceImpact), [selection]);
  const environments = [...new Set(servers.map(asset => asset.environment))].sort();
  const domains = [...new Set(servers.map(asset => asset.securityDomain))].sort();
  const selectedEnvironment = environments.includes(environment) ? environment : "all";
  const selectedDomain = domains.includes(domain) ? domain : "all";
  const filtered = servers.filter(asset => (selectedEnvironment === "all" || asset.environment === selectedEnvironment)
    && (selectedDomain === "all" || asset.securityDomain === selectedDomain)
    && `${asset.name} ${asset.ip} ${asset.systemName} ${asset.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div className="service-impact-server-view">
    <header><div><h3>Server risk heatmap</h3><p className="discovery-overview-note">Select a server to open its CMDB details. Highest critical and high finding counts appear first.</p></div>
      <span className="service-impact-count">{number(filtered.length)} / {number(servers.length)} servers</span></header>
    <div className="service-impact-server-controls"><input type="search" aria-label="Search servers" placeholder="Search device, IP or ICT system..." value={query} onChange={event => setQuery(event.target.value)} />
      <label>Environment<select value={selectedEnvironment} onChange={event => setEnvironment(event.target.value)}><option value="all">All environments</option>{environments.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Security domain<select value={selectedDomain} onChange={event => setDomain(event.target.value)}><option value="all">All domains</option>{domains.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Square size <input type="range" min={24} max={64} step={4} value={size} onChange={event => setSize(Number(event.target.value))} /><span>{size}px</span></label>
      <button type="button" className="endpoint-export" onClick={() => { setQuery(""); setEnvironment("all"); setDomain("all"); setSize(40); }}>Reset view</button></div>
    <ul className="measures-duration-legend"><li><span style={{ backgroundColor: "#ef4444" }} />Critical exposure</li><li><span style={{ backgroundColor: "#f97316" }} />High risk</li><li><span style={{ backgroundColor: "#496778" }} />No critical or high findings</li></ul>
    <div className="service-impact-server-grid" style={{ gridTemplateColumns: `repeat(auto-fill, ${size}px)` }}>
      {filtered.map(asset => <button type="button" key={asset.id} style={{ height: size, backgroundColor: asset.critical ? "#a72935" : asset.high ? "#ad4b18" : "#294553",
        borderColor: asset.critical ? "#ff7683" : asset.high ? "#ffb070" : "#668797" }} onClick={() => openCmdbDrillThrough(asset.id, asset.name)}
        aria-label={`${asset.name}: ${asset.critical} critical, ${asset.high} high. Open CMDB details.`}
        title={`${asset.name}\n${asset.ip} · ${asset.systemName}\n${asset.environment} · ${asset.securityDomain}\n${asset.critical} critical · ${asset.high} high · ${asset.findings} open findings`}>
        {asset.critical + asset.high}</button>)}
    </div>
    {!filtered.length && <div className="endpoint-empty"><strong>No matching servers</strong><p>Try clearing the server filters or select other ICT systems.</p></div>}
    <p className="discovery-overview-note">Numbers show critical plus high findings. A zero does not imply full compliance.</p>
  </div>;
}

export function ServiceImpactAnalyser({ model, filters }: { model: ServiceImpactModel; filters: Filters }) {
  const [pageTab, setPageTab] = useState<typeof pageTabs[number]["id"]>("scope");
  const [kind, setKind] = useState<ScopeKind>("business");
  const [entityId, setEntityId] = useState<string | null>(null);
  const [focus, setFocus] = useState<"all" | "severe">("severe");
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [entityMatches, setEntityMatches] = useState<string[] | null>(null);
  const [systemMatches, setSystemMatches] = useState<string[] | null>(null);
  const [reset, setReset] = useState(0);
  const [tab, setTab] = useState<typeof analysisTabs[number]["id"]>("spi");
  const [drillThrough, setDrillThrough] = useState<{ title: string; findings: ServiceImpactFinding[]; initialTab: ServiceImpactDetailTab } | null>(null);
  const allEntities = useMemo(() => serviceImpactRows(model[kind], model.findings), [model, kind]);
  const entityRows = useMemo(() => allEntities.filter(row => focus === "all" || row.critical + row.high > 0), [allEntities, focus]);
  const visibleEntities = useMemo(() => entityRows.filter(row => !entityMatches || entityMatches.includes(row.id)), [entityRows, entityMatches]);
  const selectedEntity = visibleEntities.find(row => row.id === entityId);
  const systemRows = useMemo(() => {
    // An untouched entity table includes systems without service/capability links.
    const allowed = selectedEntity ? new Set(selectedEntity.systemIds)
      : entityMatches && entityMatches.length !== entityRows.length ? new Set(visibleEntities.flatMap(entity => entity.systemIds)) : null;
    return model.systems.filter(system => !allowed || allowed.has(system.id)).map(system => ({ ...system,
      ...impactCounts(model.findings.filter(finding => finding.systemId === system.id)) }))
      .filter(row => focus === "all" || row.critical + row.high > 0).sort(compareServiceImpact);
  }, [model, selectedEntity, entityMatches, entityRows.length, visibleEntities, focus]);
  const visibleSystems = useMemo(() => systemRows.filter(row => !systemMatches || systemMatches.includes(row.id)), [systemRows, systemMatches]);
  const activeSelected = useMemo(() => visibleSystems.filter(row => selectedSystems.includes(row.id)), [visibleSystems, selectedSystems]);
  const activeSystemIds = useMemo(() => (activeSelected.length ? activeSelected : visibleSystems).map(row => row.id), [activeSelected, visibleSystems]);
  const selection = useMemo(() => selectServiceImpact(model, activeSystemIds), [model, activeSystemIds]);
  const onEntitiesFiltered = useCallback((rows: ServiceImpactRow[]) => {
    const ids = rows.map(row => row.id); setEntityMatches(current => sameIds(current, ids) ? current : ids);
    setEntityId(current => current && ids.includes(current) ? current : null);
  }, []);
  const onSystemsFiltered = useCallback((rows: SystemRow[]) => {
    const ids = rows.map(row => row.id); setSystemMatches(current => sameIds(current, ids) ? current : ids);
    setSelectedSystems(current => { const next = current.filter(id => ids.includes(id)); return sameIds(current, next) ? current : next; });
  }, []);
  const resetSelection = () => { setEntityId(null); setSelectedSystems([]); setEntityMatches(null); setSystemMatches(null); setReset(value => value + 1); };
  const changeKind = (next: ScopeKind) => { setKind(next); resetSelection(); };
  const selectEntity = (id: string) => { setEntityId(current => current === id ? null : id); setSelectedSystems([]); setSystemMatches(null); };
  const toggleSystem = (id: string) => setSelectedSystems(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const open = (title: string, findings: ServiceImpactFinding[], initialTab: ServiceImpactDetailTab = "findings") => setDrillThrough({ title, findings, initialTab });
  const groups = (key: "spiId" | "environment"): BarRow[] => {
    const map = new Map<string, ServiceImpactFinding[]>();
    for (const finding of selection.findingRows) { const id = String(finding[key]); const rows = map.get(id) ?? []; rows.push(finding); map.set(id, rows); }
    return [...map].map(([id, rows]) => ({ id, name: key === "spiId" ? `SPI-${id} — ${rows[0].spiName}` : id,
      findingRows: rows, ...impactCounts(rows) })).sort(compareServiceImpact);
  };
  const impactRows = (rows: ServiceImpactRow[]): BarRow[] => rows.filter(row => row.critical > 0).map(row => ({ ...row,
    note: `${row.systemIds.length} ICT systems · ${row.criticality}`, findingRows: selection.findingRows.filter(finding => row.systemIds.includes(finding.systemId)) }));
  const scopeParams = new URLSearchParams({ dataDate: model.snapshotDate });
  if (filters.managedNetwork) scopeParams.set("network", filters.managedNetwork);
  if (filters.ictSystem) scopeParams.set("system", filters.ictSystem);
  return <div className="workspace-page discovery-overview service-impact-page" data-service-impact-page>
    <header className="endpoint-hero discovery-overview-hero"><div><p className="endpoint-eyebrow">Cyber Security / Service impact</p><h1>Service Impact Analyser</h1>
      <p className="service-impact-intro">Trace open findings from business services and mission capabilities to the ICT systems and devices they depend on.</p>
      <div className="discovery-overview-context"><span><strong>{number(model.business.length)}</strong> business services</span><span><strong>{number(model.mission.length)}</strong> mission capabilities</span><span><strong>{number(model.systems.length)}</strong> ICT systems in header scope</span></div></div>
      <div className="discovery-overview-snapshot"><span>Snapshot</span><strong>{model.snapshotDate}</strong></div></header>
    <ServiceImpactTabs id="service-impact-view" label="Service Impact Analyser views" tabs={pageTabs} active={pageTab} onChange={setPageTab} />
    <section id="service-impact-view-panel-scope" role="tabpanel" aria-labelledby="service-impact-view-tab-scope" hidden={pageTab !== "scope"} tabIndex={0} className="service-impact-page-panel">
    <section className="service-impact-selection discovery-overview-panel"><div><strong>Analysis scope</strong><p role="status">{selectedEntity?.name ?? "All matching services and capabilities"} · {number(activeSystemIds.length)} {activeSelected.length ? "selected" : "matching"} ICT systems</p></div>
      <div className="service-impact-selection-actions"><label>Show<select value={focus} onChange={event => { setFocus(event.target.value as "all" | "severe"); resetSelection(); }}><option value="severe">Critical / high impact</option><option value="all">All systems</option></select></label>
        <button className="endpoint-export" type="button" onClick={resetSelection}>Reset selection</button></div></section>
    <section className="discovery-overview-metrics" aria-label="Current service impact summary">
      {[{ label: "Open findings", value: selection.findings, note: "Unique findings in analysis scope", tone: "cyan", rows: selection.findingRows },
        { label: "Critical exposure", value: selection.critical, note: "Highest severity findings", tone: "red", rows: selection.findingRows.filter(row => row.severity === "Critical Exposure") },
        { label: "High risk", value: selection.high, note: "High severity findings", tone: "orange", rows: selection.findingRows.filter(row => row.severity === "High Risk") },
        { label: "Affected CIs", value: selection.affectedCis, note: "Distinct devices with open findings", tone: "teal", rows: selection.findingRows }].map(tile =>
        <button className={`discovery-overview-metric tone-${tile.tone}`} type="button" key={tile.label} disabled={!tile.value} onClick={() => open(tile.label, tile.rows, tile.label === "Affected CIs" ? "devices" : "findings")}>
          <strong>{number(tile.value)}</strong><div><span>{tile.label}</span><small>{tile.note}</small></div><span aria-hidden="true">↗</span></button>)}
    </section>
    <div className="service-impact-selectors">
      <section className="service-impact-selector"><header><div><p className="endpoint-eyebrow">1 / Choose a service or capability</p><p>Select a name to focus the systems table. Search and column filters also narrow the scope.</p></div></header>
        <ServiceImpactTabs id="service-impact-scope" label="Service or mission scope" tabs={scopeTabs} active={kind} onChange={changeKind} />
        {scopeTabs.map(item => <div key={item.id} id={`service-impact-scope-panel-${item.id}`} role="tabpanel" aria-labelledby={`service-impact-scope-tab-${item.id}`} hidden={kind !== item.id}>
          {kind === item.id && <FindingsDataTable key={`${kind}:${reset}`} title={kind === "business" ? "Business Services" : "Mission Capabilities"} rows={entityRows} columns={entityColumns}
            paginate={false} searchText={entitySearch} className="service-impact-entity-table" onFilteredRowsChange={onEntitiesFiltered}
            emptyMessage="No services or capabilities match the current impact focus. Choose All systems to include those without severe findings."
            actions={rows => <button type="button" className="endpoint-export" disabled={!rows.length} onClick={() => downloadImpactCsv(`service-impact-${kind}-${model.snapshotDate}.csv`, rows.map(row => ({ ...impactCsv(row), "ICT Systems": row.systemIds.length })))}>Export CSV</button>}
            renderRow={row => <tr key={row.id} className={selectedEntity?.id === row.id ? "is-selected" : ""}><td><button type="button" className="service-impact-link" aria-pressed={selectedEntity?.id === row.id} onClick={() => selectEntity(row.id)}>{row.name}</button></td>
              <td>{row.criticality}</td><td>{number(row.systemIds.length)}</td><td className="service-impact-critical">{number(row.critical)}</td><td className="service-impact-high">{number(row.high)}</td><td>{number(row.findings)}</td><td>{number(row.affectedCis)}</td></tr>} />}
        </div>)}
      </section>
      <section className="service-impact-selector"><header><div><p className="endpoint-eyebrow">2 / Refine the ICT systems</p><p>Select systems for comparison, or leave none selected to analyse all matching rows.</p></div></header>
        <div className="service-impact-system-actions"><span>{number(activeSelected.length)} selected / {number(visibleSystems.length)} matching</span><button type="button" className="endpoint-export" disabled={!visibleSystems.length} onClick={() => setSelectedSystems(visibleSystems.map(row => row.id))}>Select matching</button>
          <button type="button" className="endpoint-export" disabled={!selectedSystems.length} onClick={() => setSelectedSystems([])}>Clear selection</button>
          <button type="button" className="endpoint-export" onClick={() => {
            setPageTab("analysis");
            requestAnimationFrame(() => {
              const target = document.getElementById("service-impact-view-tab-analysis");
              target?.focus({ preventScroll: true });
              target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
          }}>Explore selection →</button></div>
        <FindingsDataTable key={`${kind}:${entityId}:${reset}`} title="ICT Systems" rows={systemRows} columns={systemColumns} paginate={false}
          searchText={systemSearch} className="service-impact-system-table" onFilteredRowsChange={onSystemsFiltered}
          emptyMessage="No ICT systems match this selection. Clear table filters, reset the selection or choose All systems."
          actions={rows => <button type="button" className="endpoint-export" disabled={!rows.length} onClick={() => downloadImpactCsv(`service-impact-systems-${model.snapshotDate}.csv`, rows.map(row => ({ ...impactCsv(row), "APP-ID": row.appId })))}>Export CSV</button>}
          renderRow={row => <tr key={row.id} className={selectedSystems.includes(row.id) ? "is-selected" : ""}><td><label className="service-impact-system-check"><input type="checkbox" checked={selectedSystems.includes(row.id)} aria-label={`Select ${row.name}`} onChange={() => toggleSystem(row.id)} /><span>{row.name}</span></label></td>
            <td>{row.appId || "Not provided"}</td><td>{row.criticality}</td><td className="service-impact-critical">{number(row.critical)}</td><td className="service-impact-high">{number(row.high)}</td><td>{number(row.findings)}</td><td>{number(row.affectedCis)}</td></tr>} />
      </section>
    </div>
    <details className="discovery-overview-method"><summary>How this analysis works</summary><div><p>The header defines the network or ICT system scope and snapshot. Select a service or capability, then optionally select ICT systems. Charts follow the selected systems, or all matching system rows when none are selected.</p>
      <p>The initial focus is systems with critical or high findings. Choose All systems to include lower-severity findings and systems with no open findings. Zero findings does not confirm compliance.</p>
      <p>Only open findings on CIs with a recorded ICT system association are included. Each finding and affected CI is counted once in the summary. Shared services and capabilities can contain the same finding.</p>
      {model.unattributedFindings > 0 && <p>{number(model.unattributedFindings)} open findings in the header scope have no in-scope ICT system association. Review them in the <Link href={`/findings?${scopeParams}`} prefetch={false}>Findings Register</Link>.</p>}</div></details>
    </section>
    <section id="service-impact-view-panel-analysis" role="tabpanel" aria-labelledby="service-impact-view-tab-analysis" hidden={pageTab !== "analysis"} tabIndex={0} className="service-impact-page-panel discovery-overview-panel service-impact-analysis"><header><div><p className="endpoint-eyebrow">Explore the impact</p><h2>Findings across {number(activeSystemIds.length)} ICT systems</h2><p className="discovery-overview-note">{selectedEntity?.name ?? "All matching services and capabilities"}</p></div>
      <button type="button" className="endpoint-export" disabled={!selection.findings} onClick={() => open("All findings in analysis scope", selection.findingRows)}>View findings ↗</button></header>
      <ServiceImpactTabs id="service-impact-analysis" label="Impact analysis views" tabs={analysisTabs} active={tab} onChange={setTab} />
      {tab !== "servers" && <ul className="measures-duration-legend" aria-label="Finding severity legend">{model.severities.map(severity => <li key={severity.key}><span style={{ backgroundColor: severityBarColors[severity.key] ?? "#94a3b8" }} />{severity.label}</li>)}</ul>}
      {analysisTabs.map(item => <div key={item.id} id={`service-impact-analysis-panel-${item.id}`} role="tabpanel" aria-labelledby={`service-impact-analysis-tab-${item.id}`} hidden={tab !== item.id} tabIndex={0}>
        {item.id === "spi" && <><p className="discovery-overview-note">Open findings grouped by SPI, highest critical and high impact first. Select a bar to review findings, affected CIs and CVEs.</p><ImpactBars rows={groups("spiId")} label="Findings by SPI" model={model} onOpen={open} /></>}
        {item.id === "servers" && tab === "servers" && <ServerHeatmap model={model} systemIds={activeSystemIds} />}
        {item.id === "environment" && <><p className="discovery-overview-note">Open findings across the environments used by the selected systems.</p><ImpactBars rows={groups("environment")} label="Findings by environment" model={model} onOpen={open} /></>}
        {item.id === "impact" && <><p className="discovery-overview-note">Services and capabilities exposed to critical findings in the current analysis scope. A finding can affect multiple services; these rows must not be added together.</p>
          <div className="service-impact-consequences"><section><h3>Business services</h3><ImpactBars rows={impactRows(selection.business)} label="Business service impact" model={model} onOpen={open} /></section>
            <section><h3>Mission capabilities</h3><ImpactBars rows={impactRows(selection.mission)} label="Mission capability impact" model={model} onOpen={open} /></section></div></>}
      </div>)}
    </section>
    <footer className="service-impact-footer">TSAAT | Cyber Operations Compliance Reporting.</footer>
    {drillThrough && <ServiceImpactFindingsPanel title={drillThrough.title} findings={drillThrough.findings} initialTab={drillThrough.initialTab} model={model} onClose={() => setDrillThrough(null)} />}
  </div>;
}
