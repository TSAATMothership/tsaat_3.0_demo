"use client";

import { PersonaPopup } from "@/components/persona-popup";

import { PersonaPopupButton } from "@/components/persona-popup-button";

import Link from "@/components/persona-link";
import { useCallback, useMemo, useState } from "react";
import { FindingsDataTable } from "@/components/findings-data-table";
import { ServiceImpactGraph } from "@/components/service-impact-graph";
import { ServiceImpactFindingsPanel, ServiceImpactTabs, downloadImpactCsv, type ServiceImpactDetailTab } from "@/components/service-impact-findings-panel";
import { compareServiceImpact, impactCounts, selectServiceImpact, serviceImpactRows,
  type ServiceImpactCounts, type ServiceImpactFinding, type ServiceImpactModel, type ServiceImpactRow } from "@/lib/service-impact";
import type { ExplorerColumn } from "@/lib/explorer-table";
import type { Filters } from "@/lib/types";

const number = (value: number) => value.toLocaleString("en-AU");
const sameIds = (left: string[] | null, right: string[]) => left?.length === right.length && left.every((id, index) => id === right[index]);
const scopeTabs = [{ id: "business", label: "Business services" }, { id: "mission", label: "Mission capabilities" }] as const;
type ScopeKind = typeof scopeTabs[number]["id"];
type SystemRow = ServiceImpactModel["systems"][number] & ServiceImpactCounts;

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

export function ServiceImpactAnalyser({ model, filters }: { model: ServiceImpactModel; filters: Filters }) {
  const [graphOpen, setGraphOpen] = useState(false);
  const [kind, setKind] = useState<ScopeKind>("business");
  const [entityId, setEntityId] = useState<string | null>(null);
  const [focus, setFocus] = useState<"all" | "severe">("severe");
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [entityMatches, setEntityMatches] = useState<string[] | null>(null);
  const [systemMatches, setSystemMatches] = useState<string[] | null>(null);
  const [reset, setReset] = useState(0);
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
  const scopeParams = new URLSearchParams({ dataDate: model.snapshotDate });
  if (filters.managedNetwork) scopeParams.set("network", filters.managedNetwork);
  if (filters.ictSystem) scopeParams.set("system", filters.ictSystem);
  if (filters.securityDomain) scopeParams.set("securityDomain", filters.securityDomain);
  return <div className="workspace-page discovery-overview service-impact-page" data-service-impact-page>
    <header className="endpoint-hero discovery-overview-hero"><div><p className="endpoint-eyebrow">Cyber Security / Service impact</p><h1>Service Impact Analyser</h1>
      <p className="service-impact-intro">Trace open findings from business services and mission capabilities to the ICT systems and devices they depend on.</p>
      <div className="discovery-overview-context"><span><strong>{number(model.business.length)}</strong> business services</span><span><strong>{number(model.mission.length)}</strong> mission capabilities</span><span><strong>{number(model.systems.length)}</strong> ICT systems in header scope</span></div></div>
      <div className="discovery-overview-snapshot"><span>Snapshot</span><strong>{model.snapshotDate}</strong></div></header>
    <section aria-labelledby="service-impact-scope-title" className="service-impact-page-panel">
    <h2 id="service-impact-scope-title" className="service-impact-scope-title">Scope &amp; Selection</h2>
    <section className="service-impact-selection discovery-overview-panel"><div><strong>Analysis scope</strong><p role="status">{selectedEntity?.name ?? "All matching services and capabilities"} · {number(activeSystemIds.length)} {activeSelected.length ? "selected" : "matching"} ICT systems</p></div>
      <div className="service-impact-selection-actions"><label>Show<select value={focus} onChange={event => { setFocus(event.target.value as "all" | "severe"); resetSelection(); }}><option value="severe">Critical / high impact</option><option value="all">All systems</option></select></label>
        <button className="endpoint-export" type="button" onClick={resetSelection}>Reset selection</button></div></section>
    <section className="discovery-overview-metrics" aria-label="Current service impact summary">
      {[{ label: "Open findings", value: selection.findings, note: "Unique findings in analysis scope", tone: "cyan", rows: selection.findingRows },
        { label: "Critical exposure", value: selection.critical, note: "Highest severity findings", tone: "red", rows: selection.findingRows.filter(row => row.severity === "Critical Exposure") },
        { label: "High risk", value: selection.high, note: "High severity findings", tone: "orange", rows: selection.findingRows.filter(row => row.severity === "High Risk") },
        { label: "Affected CIs", value: selection.affectedCis, note: "Distinct devices with open findings", tone: "teal", rows: selection.findingRows }].map(tile =>
        <PersonaPopupButton popup="impact-details" className={`discovery-overview-metric tone-${tile.tone}`} type="button" key={tile.label} disabled={!tile.value} onClick={() => open(tile.label, tile.rows, tile.label === "Affected CIs" ? "devices" : "findings")}>
          <strong>{number(tile.value)}</strong><div><span>{tile.label}</span><small>{tile.note}</small></div><span aria-hidden="true">↗</span></PersonaPopupButton>)}
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
          <PersonaPopupButton popup="impact-graph" type="button" className="endpoint-export" aria-haspopup="dialog" data-explore-service-impact onClick={() => setGraphOpen(true)}>Explore selection ↗</PersonaPopupButton></div>
        <FindingsDataTable key={`${kind}:${entityId}:${reset}`} title="ICT Systems" rows={systemRows} columns={systemColumns} paginate={false}
          searchText={systemSearch} className="service-impact-system-table" onFilteredRowsChange={onSystemsFiltered}
          emptyMessage="No ICT systems match this selection. Clear table filters, reset the selection or choose All systems."
          actions={rows => <button type="button" className="endpoint-export" disabled={!rows.length} onClick={() => downloadImpactCsv(`service-impact-systems-${model.snapshotDate}.csv`, rows.map(row => ({ ...impactCsv(row), "APP-ID": row.appId })))}>Export CSV</button>}
          renderRow={row => <tr key={row.id} className={selectedSystems.includes(row.id) ? "is-selected" : ""}><td><label className="service-impact-system-check"><input type="checkbox" checked={selectedSystems.includes(row.id)} aria-label={`Select ${row.name}`} onChange={() => toggleSystem(row.id)} /><span>{row.name}</span></label></td>
            <td>{row.appId || "Not provided"}</td><td>{row.criticality}</td><td className="service-impact-critical">{number(row.critical)}</td><td className="service-impact-high">{number(row.high)}</td><td>{number(row.findings)}</td><td>{number(row.affectedCis)}</td></tr>} />
      </section>
    </div>
    <details className="discovery-overview-method"><summary>How this analysis works</summary><div><p>The header defines the network or ICT system scope and snapshot. Select a service or capability, then optionally select ICT systems. The Impact Topology follows the selected systems, or all matching system rows when none are selected.</p>
      <p>The initial focus is systems with critical or high findings. Choose All systems to include lower-severity findings and systems with no open findings. Zero findings does not confirm compliance.</p>
      <p>Only open findings on CIs with a recorded ICT system association are included. Each finding and affected CI is counted once in the summary. Shared services and capabilities can contain the same finding.</p>
      {model.unattributedFindings > 0 && <p>{number(model.unattributedFindings)} open findings in the header scope have no in-scope ICT system association. Review them in the <Link href={`/findings?${scopeParams}`} prefetch={false}>Findings Register</Link>.</p>}</div></details>
    </section>
    <footer className="service-impact-footer">TSAAT | Cyber Operations Compliance Reporting.</footer>
    {graphOpen && <PersonaPopup popup="impact-graph"><ServiceImpactGraph model={model} systemIds={activeSystemIds} scopeLabel={selectedEntity?.name ?? "All matching services and capabilities"}
      focusLabel={focus === "severe" ? "Critical / high impact" : "All systems"} onClose={() => setGraphOpen(false)} /></PersonaPopup>}
    {drillThrough && <PersonaPopup popup="impact-details"><ServiceImpactFindingsPanel title={drillThrough.title} findings={drillThrough.findings} initialTab={drillThrough.initialTab} model={model} onClose={() => setDrillThrough(null)} /></PersonaPopup>}
  </div>;
}
