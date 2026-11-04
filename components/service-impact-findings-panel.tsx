"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Papa from "papaparse";
import { FindingsDataTable } from "@/components/findings-data-table";
import { CmdbDeviceName } from "@/components/cmdb-drill-through";
import { severityBarColors } from "@/components/findings-duration-panel";
import { formatAssetTypeLabel } from "@/lib/asset-taxonomy";
import { findingsByDuration } from "@/lib/findings-duration";
import type { ExplorerColumn } from "@/lib/explorer-table";
import type { ServiceImpactAsset, ServiceImpactFinding, ServiceImpactModel } from "@/lib/service-impact";
import { WorkspaceTabs as ServiceImpactTabs } from "@/components/workspace-tabs";

export { ServiceImpactTabs };

export function downloadImpactCsv(name: string, rows: object[]) {
  const url = URL.createObjectURL(new Blob([Papa.unparse(rows, { escapeFormulae: true })], { type: "text/csv;charset=utf-8;" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const impactDeviceColumns: ExplorerColumn<ServiceImpactAsset>[] = [
  { key: "name", label: "Device Name", value: row => row.name },
  { key: "ip", label: "Device IP", value: row => row.ip },
  { key: "model", label: "Device Model", value: row => row.model },
  { key: "lastDiscovered", label: "Last Discovered Date", value: row => row.lastDiscovered },
  { key: "discoveredBy", label: "Discovered By", value: row => row.discoveredBy },
  { key: "type", label: "Asset Type", value: row => formatAssetTypeLabel(row.type) }
];
export const impactDeviceCsv = (row: ServiceImpactAsset) => Object.fromEntries(impactDeviceColumns.map(column => [column.label, column.value(row)]));

const tabs = [{ id: "findings", label: "Findings" }, { id: "devices", label: "Affected CIs" },
  { id: "vulnerabilities", label: "High-risk CVEs" }, { id: "duration", label: "Finding duration" }] as const;
export type ServiceImpactDetailTab = typeof tabs[number]["id"];

export function ServiceImpactFindingsPanel({ title, findings, model, onClose, initialTab = "findings" }: {
  title: string; findings: ServiceImpactFinding[]; model: ServiceImpactModel; onClose: () => void;
  initialTab?: ServiceImpactDetailTab;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [tab, setTab] = useState<ServiceImpactDetailTab>(initialTab);
  const assets = useMemo(() => { const ids = new Set(findings.map(finding => finding.assetId)); return model.assets.filter(asset => ids.has(asset.id)); }, [findings, model.assets]);
  const byId = useMemo(() => new Map(assets.map(asset => [asset.id, asset])), [assets]);
  const cves = useMemo(() => assets.flatMap(asset => asset.vulnerabilities.map(cve => ({ ...cve, asset }))), [assets]);
  const duration = useMemo(() => findingsByDuration(findings.map(row => ({ ...row, status: "open" as const })), model.snapshotDate), [findings, model.snapshotDate]);
  const columns = useMemo<ExplorerColumn<ServiceImpactFinding>[]>(() => [
    { key: "spi", label: "SPI", value: row => `SPI-${row.spiId} - ${row.spiName}` },
    { key: "priority", label: "Priority", value: row => row.priority > 0 ? `P${row.priority}` : "Not assigned" },
    { key: "severity", label: "Severity", value: row => row.severity },
    { key: "device", label: "Device Name", value: row => byId.get(row.assetId)?.name ?? row.assetId },
    { key: "environment", label: "Environment", value: row => row.environment },
    { key: "duration", label: "Duration", value: row => row.duration === null ? "Unknown" : `${row.duration} days`,
      range: { value: row => row.duration, unit: "days", min: 0, step: 1, sortable: true } }
  ], [byId]);
  const cveColumns: ExplorerColumn<typeof cves[number]>[] = [
    { key: "cve", label: "CVE", value: row => row.cve }, { key: "device", label: "Device Name", value: row => row.asset.name },
    { key: "criticality", label: "Criticality", value: row => row.criticality }, { key: "exploitability", label: "Exploitability", value: row => row.exploitability },
    { key: "description", label: "Description", value: row => row.description }, { key: "remediation", label: "Remediation", value: row => row.remediationGuidance }
  ];
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const node = dialog.current; node?.showModal();
    return () => { node?.close(); document.body.style.overflow = overflow; trigger?.focus(); };
  }, []);
  const device = (asset: ServiceImpactAsset) => <CmdbDeviceName assetId={asset.id} name={asset.name} className="service-impact-link" />;
  return createPortal(<dialog ref={dialog} className="measure-scope-panel service-impact-findings" aria-labelledby={`${id}-title`}
    onKeyDown={event => { if (event.key === "Escape" && !event.currentTarget.querySelector(".endpoint-filter-popup")) { event.preventDefault(); onClose(); } }}
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="measure-scope-content"><header><div><p className="endpoint-eyebrow">Service Impact / Snapshot {model.snapshotDate}</p>
      <h2 id={`${id}-title`}>{title}</h2></div><button type="button" autoFocus onClick={onClose}>Close</button></header>
      <p className="discovery-overview-note">{findings.length.toLocaleString("en-AU")} open findings · {assets.length.toLocaleString("en-AU")} affected CIs. Select a device to open its CMDB record.</p>
      <ServiceImpactTabs id={id} label="Impact finding details" tabs={tabs} active={tab} onChange={setTab} />
      <div id={`${id}-panel-findings`} role="tabpanel" aria-labelledby={`${id}-tab-findings`} hidden={tab !== "findings"} className="service-impact-detail-table">
        <FindingsDataTable title="Open Findings" rows={findings} columns={columns} paginate={false}
          actions={rows => <button className="endpoint-export" disabled={!rows.length} onClick={() => downloadImpactCsv(`service-impact-findings-${model.snapshotDate}.csv`, rows.map(row => ({
            SPI: `SPI-${row.spiId} - ${row.spiName}`, Priority: row.priority, Severity: row.severity, "Device Name": byId.get(row.assetId)?.name,
            "Device IP": byId.get(row.assetId)?.ip, "Device Model": byId.get(row.assetId)?.model,
            "Last Discovered Date": byId.get(row.assetId)?.lastDiscovered, "Discovered By": byId.get(row.assetId)?.discoveredBy,
            Environment: row.environment, "Duration (days)": row.duration ?? "", Timestamp: row.timestamp,
            Finding: row.title, "Remediation action": row.recommendedAction }))) }>Export CSV</button>}
          renderRow={row => <tr key={row.id}><td><details><summary>SPI-{row.spiId} — {row.spiName}</summary><p>{row.title}</p>
            <p><strong>Remediation action</strong><br />{row.recommendedAction || "Not provided"}</p></details></td>
            <td>{row.priority > 0 ? `P${row.priority}` : "Not assigned"}</td><td><span className="service-impact-severity" style={{ borderColor: severityBarColors[row.severity] ?? "#94a3b8" }}>{row.severity}</span></td>
            <td>{byId.has(row.assetId) ? device(byId.get(row.assetId)!) : row.assetId}</td><td>{row.environment}</td><td>{row.duration === null ? "Unknown" : `${row.duration} days`}</td></tr>} />
      </div>
      <div id={`${id}-panel-devices`} role="tabpanel" aria-labelledby={`${id}-tab-devices`} hidden={tab !== "devices"} className="service-impact-detail-table">
        <FindingsDataTable title="Affected CIs" rows={assets} columns={impactDeviceColumns} paginate={false}
          actions={rows => <button className="endpoint-export" disabled={!rows.length} onClick={() => downloadImpactCsv(`service-impact-cis-${model.snapshotDate}.csv`, rows.map(impactDeviceCsv))}>Export CSV</button>}
          renderRow={asset => <tr key={asset.id}><td>{device(asset)}</td>{impactDeviceColumns.slice(1).map(column => <td key={column.key}>{column.value(asset)}</td>)}</tr>} />
      </div>
      <div id={`${id}-panel-vulnerabilities`} role="tabpanel" aria-labelledby={`${id}-tab-vulnerabilities`} hidden={tab !== "vulnerabilities"} className="service-impact-detail-table">
        <FindingsDataTable title="High-risk CVEs" rows={cves} columns={cveColumns} paginate={false} emptyMessage="No high-risk CVEs recorded for these CIs."
          actions={rows => <button className="endpoint-export" disabled={!rows.length} onClick={() => downloadImpactCsv(`service-impact-cves-${model.snapshotDate}.csv`, rows.map(row => Object.fromEntries(cveColumns.map(column => [column.label, column.value(row)]))))}>Export CSV</button>}
          renderRow={(row, index) => <tr key={`${row.asset.id}:${row.cve}:${index}`}>{cveColumns.map(column => <td key={column.key}>{column.key === "device" ? device(row.asset) : column.value(row)}</td>)}</tr>} />
      </div>
      <div id={`${id}-panel-duration`} role="tabpanel" aria-labelledby={`${id}-tab-duration`} hidden={tab !== "duration"} className="service-impact-duration">
        <h3>Open findings by duration</h3><p className="discovery-overview-note">Calendar days open at the selected snapshot.</p>
        {duration.map(bucket => <div key={bucket.label}><span>{bucket.label}</span><div className="service-impact-bar-track">{model.severities.map(severity =>
          <span key={severity.key} title={`${severity.label}: ${bucket.severities[severity.key] ?? 0}`} style={{ width: `${(bucket.severities[severity.key] ?? 0) / Math.max(1, ...duration.map(item => item.total)) * 100}%`, backgroundColor: severityBarColors[severity.key] ?? "#94a3b8" }} />)}</div><strong>{bucket.total}</strong></div>)}
        <ul className="measures-duration-legend">{model.severities.map(severity => <li key={severity.key}><span style={{ backgroundColor: severityBarColors[severity.key] ?? "#94a3b8" }} />{severity.label}</li>)}</ul>
      </div>
    </div>
  </dialog>, document.body);
}
