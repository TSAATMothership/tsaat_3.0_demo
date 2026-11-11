"use client";

import { useId, useMemo, useState } from "react";
import Papa from "papaparse";
import { CmdbDeviceName } from "@/components/cmdb-drill-through";
import { FindingsDataTable } from "@/components/findings-data-table";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { lifecycleAttention, lifecycleLagLabel, type LifeCycleManagementModel, type LifecycleAsset, type LifecycleSoftware } from "@/lib/life-cycle-management";
import type { ExplorerColumn } from "@/lib/explorer-table";

const number = (value: number) => value.toLocaleString("en-AU");
const tabs = [{ id: "servers", label: "Servers to prioritise" }, { id: "hardware", label: "Hardware warranties" },
  { id: "software", label: "Software support" }, { id: "os", label: "Operating systems" }] as const;
type View = typeof tabs[number]["id"];
type Focus = "issues" | "all" | "unknown" | "n-2";
const serverColumns: ExplorerColumn<LifecycleAsset>[] = [
  { key: "priority", label: "Attention", value: lifecycleAttention },
  { key: "name", label: "Server", value: row => row.name },
  { key: "system", label: "System / environment", value: row => `${row.system} · ${row.environment}${row.critical ? " · Critical system" : ""}` },
  { key: "warranty", label: "Hardware warranty", value: row => row.warranty },
  { key: "software", label: "Unsupported software", value: row => row.unsupportedSoftware, range: { value: row => row.unsupportedSoftware, min: 0, step: 1, sortable: true, unit: "installations" } },
  { key: "os", label: "Operating system", value: row => `${row.osName} ${row.osVersion} · ${lifecycleLagLabel(row.nMinus)} · ${row.osSupport}` },
  { key: "action", label: "Recommended next steps", value: row => row.actions.join("; ") || "Maintain lifecycle records" }
];
const hardwareColumns: ExplorerColumn<LifecycleAsset>[] = [
  { key: "name", label: "Asset", value: row => row.name }, { key: "type", label: "CI type", value: row => row.typeLabel },
  { key: "model", label: "Model", value: row => row.model }, { key: "warranty", label: "Warranty", value: row => row.warranty },
  { key: "network", label: "Managed network", value: row => row.network }, { key: "system", label: "ICT system", value: row => row.system },
  { key: "domain", label: "Security domain", value: row => row.domain }
];
const softwareColumns: ExplorerColumn<LifecycleSoftware>[] = [
  { key: "name", label: "Software", value: row => row.name }, { key: "version", label: "Installed version", value: row => row.version },
  { key: "support", label: "Support status", value: row => row.support }, { key: "device", label: "Endpoint", value: row => row.device },
  { key: "type", label: "CI type", value: row => row.type }, { key: "system", label: "ICT system", value: row => row.system },
  { key: "network", label: "Managed network", value: row => row.network }
];
const osColumns: ExplorerColumn<LifecycleAsset>[] = [
  { key: "name", label: "Asset", value: row => row.name }, { key: "type", label: "CI type", value: row => row.typeLabel },
  { key: "os", label: "Operating system", value: row => `${row.osName} ${row.osVersion}` },
  { key: "distance", label: "Version distance", value: row => lifecycleLagLabel(row.nMinus), range: { value: row => row.nMinus, min: 0, step: 1, sortable: true, unit: "versions behind" } },
  { key: "support", label: "OS support", value: row => row.osSupport }, { key: "system", label: "ICT system", value: row => row.system },
  { key: "network", label: "Managed network", value: row => row.network }
];
function Status({ text, issue = false }: { text: string; issue?: boolean }) {
  return <span className={`lifecycle-status ${issue ? "is-issue" : text === "Unknown" || text === "Not recorded" ? "is-unknown" : "is-neutral"}`}>{text}</span>;
}
function exportRows<T>(rows: T[], columns: ExplorerColumn<T>[], view: string, date: string) {
  const csv = Papa.unparse(rows.map(row => Object.fromEntries(columns.map(column => [column.label, column.value(row) ?? "Not recorded"]))), { escapeFormulae: true });
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a"); link.href = url; link.download = `life-cycle-${view}-${date}.csv`;
  document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LifeCycleManagement({ model }: { model: LifeCycleManagementModel }) {
  const id = useId();
  const [view, setView] = useState<View>("servers");
  const [focus, setFocus] = useState<Focus>("issues");
  const selectView = (next: View, nextFocus: Focus = "issues") => { setView(next); setFocus(nextFocus); };
  const { totals } = model;
  const priority = model.servers.filter(row => row.issueCount > 0).slice(0, 3);
  const assetRows = useMemo(() => {
    const rows = view === "servers" ? model.servers : view === "hardware" ? model.hardware : model.operatingSystems;
    return rows.filter(row => focus === "all" || (focus === "n-2" ? row.nMinus !== null && row.nMinus >= 2
      : focus === "unknown" ? view === "hardware" ? row.warranty === "Unknown" : view === "os" ? row.nMinus === null || row.osSupport === "Unknown" : row.gaps.length > 0
      : view === "hardware" ? row.warrantyExpired : view === "os" ? row.osIssue : row.issueCount > 0));
  }, [view, focus, model]);
  const softwareRows = useMemo(() => model.software.filter(row => focus === "all" || row.support === (focus === "unknown" ? "Unknown" : "Out of support")), [focus, model.software]);
  const columns = view === "servers" ? serverColumns : view === "hardware" ? hardwareColumns : osColumns;
  const title = tabs.find(tab => tab.id === view)!.label;
  const tableKey = `${view}-${focus}`;
  const assetName = (row: LifecycleAsset) => <><CmdbDeviceName assetId={row.id} name={row.name} className="lifecycle-device" /><small>{row.id}</small></>;
  const exportButton = <T,>(rows: T[], tableColumns: ExplorerColumn<T>[]) => <button type="button" className="endpoint-export" disabled={!rows.length}
    onClick={() => exportRows(rows, tableColumns, view, model.snapshotDate)}>Export matching CSV</button>;

  return <div className="workspace-page lifecycle-page" data-lifecycle-page>
    <header className="lifecycle-hero"><div><p className="endpoint-eyebrow">Discovery / Asset assurance</p><h1>Life Cycle Management</h1>
      <p>Focus renewals and upgrades where ageing hardware, unsupported software and older operating systems overlap.</p>
      <div className="lifecycle-scope"><span>{number(totals.assets)} identified CIs</span><span>{number(totals.servers)} servers</span><span>Applied header scope</span></div>
    </div><div className="lifecycle-snapshot"><span>Inventory snapshot</span><strong>{model.snapshotDate}</strong><small>Lifecycle evidence at this date</small></div></header>

    <section className="lifecycle-metrics" aria-label="Lifecycle priorities in header scope">
      {[
        { key: "servers", label: "Servers needing attention", value: totals.serversAtRisk, detail: `${number(totals.compoundedServers)} with overlapping lifecycle issues`, tone: "rose", view: "servers" as const },
        { key: "warranty", label: "Out-of-warranty hardware", value: totals.warrantyExpired, detail: `${number(totals.warrantyUnknown)} with unknown warranty status`, tone: "amber", view: "hardware" as const },
        { key: "software", label: "Unsupported installations", value: totals.unsupportedInstallations, detail: `Across ${number(totals.unsupportedDevices)} endpoints`, tone: "violet", view: "software" as const },
        { key: "os", label: "OS at N-2 or older", value: totals.oldOperatingSystems, detail: `${number(totals.unknownOsLag)} with unknown version distance`, tone: "cyan", view: "os" as const }
      ].map(metric => <button type="button" key={metric.key} className={`lifecycle-metric tone-${metric.tone}`} data-lifecycle-metric={metric.key}
        onClick={() => selectView(metric.view, metric.key === "os" ? "n-2" : "issues")}><span>{metric.label}<i aria-hidden="true">↗</i></span><strong>{number(metric.value)}</strong><small>{metric.detail}</small></button>)}
    </section>

    <section className="lifecycle-priority" aria-labelledby={`${id}-priority-title`}>
      <header><div><p className="endpoint-eyebrow">Start here</p><h2 id={`${id}-priority-title`}>Servers requiring the most attention</h2></div><span className="lifecycle-priority-note">Highest priority in header scope</span></header>
      <p>Ranked by affected lifecycle areas, then critical system, production use, OS age and unsupported installation count.</p>
      {priority.length ? <div className="lifecycle-priority-cards">{priority.map((row, index) => <article key={row.id} className="lifecycle-priority-card" data-lifecycle-priority={row.id}>
        <div className="lifecycle-priority-heading"><span className="lifecycle-rank">0{index + 1}</span><span className="lifecycle-area-count">{row.issueCount} / 3 areas</span></div>
        <h3><CmdbDeviceName assetId={row.id} name={row.name} className="lifecycle-device" /></h3><p>{row.system} · {row.environment}{row.critical ? " · Critical system" : ""}</p>
        <ul className="lifecycle-signals">{row.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
        <p className="lifecycle-next-action">{row.actions[0]}</p>
      </article>)}</div> : <div className="lifecycle-no-priority"><strong>No confirmed server lifecycle issues in this scope.</strong><span>{totals.serversWithGaps ? `${number(totals.serversWithGaps)} servers still need missing evidence checked.` : "Choose another scope or snapshot to review more assets."}</span></div>}
      {totals.serversWithGaps > 0 && <button type="button" className="lifecycle-evidence-link" onClick={() => selectView("servers", "unknown")}>Review lifecycle evidence gaps on {number(totals.serversWithGaps)} servers <span aria-hidden="true">→</span></button>}
    </section>

    <section className="lifecycle-register" aria-label="Lifecycle evidence register">
      <WorkspaceTabs id={`${id}-views`} label="Lifecycle views" tabs={tabs} active={view} onChange={next => selectView(next)} />
      <div className="lifecycle-register-toolbar"><p>{view === "servers" ? "Three lifecycle areas: hardware warranty, installed software and operating system. OS age and support count as one area."
        : view === "hardware" ? "Recorded warranty status for servers, workstations, network, storage and printer devices."
        : view === "software" ? "One row per recorded installation. Support status comes from the selected inventory snapshot."
        : "N-2 means two versions behind the recorded current release. N-3 and older are included; unknown distance remains unknown."}</p>
        <label>Show<select aria-label="Lifecycle records" value={focus} onChange={event => setFocus(event.target.value as Focus)}>
          <option value="issues">Confirmed issues</option><option value="all">All records</option><option value="unknown">Missing data</option>{view === "os" && <option value="n-2">N-2 or older</option>}
        </select></label></div>
      <div id={`${id}-views-panel-${view}`} role="tabpanel" aria-labelledby={`${id}-views-tab-${view}`} tabIndex={0}>
        {view === "software" ? <FindingsDataTable key={tableKey} title={title} rows={softwareRows} columns={softwareColumns} defaultPageSize={25} className="lifecycle-table"
          emptyMessage={focus === "issues" ? "No unsupported software installations are recorded in this scope. Missing inventory is shown in the server evidence gaps." : "No software records match this view."}
          actions={rows => exportButton(rows, softwareColumns)} renderRow={row => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.version}</td><td><Status text={row.support} issue={row.support === "Out of support"} /></td>
            <td><CmdbDeviceName assetId={row.assetId} name={row.device} className="lifecycle-device" /><small>{row.assetId}</small></td><td>{row.type}</td><td>{row.system}</td><td>{row.network}</td></tr>} />
          : <FindingsDataTable key={tableKey} title={title} rows={assetRows} columns={columns} defaultPageSize={25} className="lifecycle-table"
            searchText={row => [row.id, row.network, row.domain, ...row.softwareNames, ...row.gaps].join(" ")} actions={rows => exportButton(rows, columns)}
            emptyMessage={focus === "issues" || focus === "n-2" ? "No confirmed issues match this view. Select All records or Missing data to check the remaining evidence." : "No assets match this view in the selected scope."}
            renderRow={row => <tr key={row.id} data-lifecycle-row={row.id} className={view === "servers" && row.issueCount >= 2 ? "lifecycle-row-priority" : undefined}>
              {view === "servers" ? <><td><Status text={lifecycleAttention(row)} issue={row.issueCount >= 2} /><small>{row.gaps.length ? `${row.gaps.length} evidence gaps` : ""}</small></td><td>{assetName(row)}</td>
                <td>{row.system}<small>{row.environment}{row.critical ? " · Critical system" : ""}</small></td><td><Status text={row.warranty} issue={row.warrantyExpired} /></td>
                <td><strong>{number(row.unsupportedSoftware)}</strong>{row.softwareNames.length > 0 && <details className="lifecycle-software-detail"><summary>View software</summary><ul>{row.softwareNames.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul></details>}{!row.softwareCount && <small>Inventory not recorded</small>}</td>
                <td>{row.osName} {row.osVersion}<small><Status text={lifecycleLagLabel(row.nMinus)} issue={row.nMinus !== null && row.nMinus >= 2} /> <Status text={row.osSupport} issue={row.osSupport === "Out of support"} /></small></td>
                <td><ul className="lifecycle-actions">{(row.actions.length ? row.actions : ["Maintain lifecycle records"]).map(action => <li key={action}>{action}</li>)}</ul>{row.gaps.length > 0 && <small>Missing: {row.gaps.join("; ")}</small>}</td></>
                : view === "hardware" ? <><td>{assetName(row)}</td><td>{row.typeLabel}</td><td>{row.model}</td><td><Status text={row.warranty} issue={row.warrantyExpired} /></td><td>{row.network}</td><td>{row.system}</td><td>{row.domain}</td></>
                : <><td>{assetName(row)}</td><td>{row.typeLabel}</td><td>{row.osName} {row.osVersion}</td><td><Status text={lifecycleLagLabel(row.nMinus)} issue={row.nMinus !== null && row.nMinus >= 2} /></td>
                  <td><Status text={row.osSupport} issue={row.osSupport === "Out of support"} /></td><td>{row.system}</td><td>{row.network}</td></>}
            </tr>} />}
      </div>
    </section>
    <details className="lifecycle-method"><summary>How lifecycle attention is assessed</summary><div>
      <p>Confirmed warranty, software and OS issues are counted across three independent areas. Unsupported OS and N-2-or-older OS count together as one area. Missing data is flagged separately and never counted as a confirmed issue. Servers with more affected areas rank first; ties use system criticality, production use, OS version distance, unsupported installation count and name.</p>
      <p>Warranty expiry dates and physical/virtual classification are not present in the inventory. Hardware views use the identified device categories and recorded warranty status; they do not infer an expiry date or a physical chassis from a model name. Unidentified IP nodes are excluded. Operating system distance uses the recorded N-minus value, not subtraction of release years.</p>
      <p>All results use the applied network or ICT system, security domains and resolved snapshot. Counts describe inventory evidence, not a live vendor lookup or a compliance score. Existing SPI definitions and configured risk/priority rules remain unchanged.</p>
    </div></details>
  </div>;
}
