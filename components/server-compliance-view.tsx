"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FindingsDataTable } from "@/components/findings-data-table";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { severityBarColors } from "@/components/findings-duration-panel";
import { findingDurationDays } from "@/lib/findings-duration";
import type { ExplorerColumn } from "@/lib/explorer-table";
import type { AssetComplianceModel } from "@/lib/server-compliance";

type Measure = AssetComplianceModel["complianceOverview"]["measures"][number];
type ComplianceFinding = Measure["findings"][number];
type DiscoveryTool = AssetComplianceModel["discoveryCompliance"]["tools"][number];
const tabs = [{ id: "overview", label: "Security Posture" }, { id: "findings", label: "Findings" },
  { id: "discovery", label: "Discovery Coverage" }] as const;
type ComplianceTab = typeof tabs[number]["id"];
const number = (value: number) => value.toLocaleString("en-AU");
const displayValue = (value: string | null | undefined) => value?.trim() || "Not provided";
const evidenceText = (items: Measure["evidence"]) => items.map(item => `${item.key}: ${item.value}`).join(" | ");

function StatusPill({ status }: { status: string }) {
  const tone = ["Compliant", "Covered", "closed"].includes(status) ? "good"
    : ["Non-compliant", "Missing"].includes(status) ? "bad" : "unknown";
  return <span className={`asset-compliance-pill asset-compliance-${tone}`}>{status}</span>;
}

function ComplianceBar({ score, counts, labels = ["Compliant", "Non-compliant", "Unknown"], scoredTotal }: {
  score: number; counts: [number, number, number]; labels?: [string, string, string]; scoredTotal?: number;
}) {
  const total = counts.reduce((sum, value) => sum + value, 0);
  const scoreLabel = (scoredTotal ?? total) > 0 ? `${score}%` : "N/A";
  return <div className="asset-compliance-bar">
    <div className="asset-compliance-bar-track" role="img" aria-label={`${scoreLabel}; ${counts.map((value, i) => `${labels[i]}: ${value}`).join(", ")}`}>
      {counts.map((value, index) => <span key={labels[index]} className={`asset-compliance-segment-${index}`} style={{ width: `${total ? value / total * 100 : 0}%` }} />)}
      <strong>{scoreLabel}</strong>
    </div>
    <ul>{counts.map((value, index) => <li key={labels[index]}><i className={`asset-compliance-segment-${index}`} />{labels[index]} <b>{number(value)}</b></li>)}</ul>
  </div>;
}

function Evidence({ items }: { items: Measure["evidence"] }) {
  return items.length ? <dl className="asset-compliance-evidence">{items.map((item, index) =>
    <div key={`${item.key}-${index}`}><dt>{item.key}</dt><dd>{item.value}</dd></div>)}</dl> : <p>No evaluation evidence recorded.</p>;
}

const measureColumns: ExplorerColumn<Measure>[] = [
  { key: "spi", label: "SPI", value: row => row.label },
  { key: "status", label: "Observed Result", value: row => row.status },
  { key: "score", label: "Compliance", value: row => row.total ? `${row.score}%` : "N/A",
    range: { value: row => row.total ? row.score : null, unit: "%", min: 0, step: 1, sortable: true } },
  { key: "open", label: "Open Findings", value: row => row.openFindings.length,
    range: { value: row => row.openFindings.length, unit: "findings", min: 0, step: 1, sortable: true } },
  { key: "reason", label: "Non-Compliance Reason", value: row => row.topReasons.join(" | ") || "None recorded" }
];
const toolColumns: ExplorerColumn<DiscoveryTool>[] = [
  { key: "name", label: "Discovery Tool", value: row => row.name },
  { key: "status", label: "Coverage", value: row => row.status },
  { key: "value", label: "Source Value", value: row => row.value ?? "Not available" },
  { key: "owner", label: "EL2 Owner", value: row => displayValue(row.el2Owner) },
  { key: "manager", label: "EL2 Operations Manager", value: row => displayValue(row.el2OperationsManager) }
];

function ComplianceFindingsTable({ findings, snapshotDate, onMeasure }: {
  findings: ComplianceFinding[]; snapshotDate: string; onMeasure?: (spiId: number) => void;
}) {
  const columns = useMemo<ExplorerColumn<ComplianceFinding>[]>(() => [
    ...(onMeasure ? [{ key: "spi", label: "SPI", value: (row: ComplianceFinding) => row.measureLabel }] : []),
    { key: "priority", label: "Priority", value: row => row.priorityRank > 0 ? `P${row.priorityRank}` : "Not assigned" },
    { key: "severity", label: "Severity", value: row => row.severity },
    { key: "finding", label: "Finding & Evidence", value: row => row.title },
    { key: "status", label: "Status", value: row => row.status },
    { key: "timestamp", label: "Timestamp", value: row => row.timestampLabel },
    { key: "duration", label: "Duration", value: row => {
      const days = findingDurationDays(row, snapshotDate); return days === null ? row.status === "closed" ? "Closed" : "Unknown" : `${days} days`;
    }, range: { value: row => findingDurationDays(row, snapshotDate), unit: "days", min: 0, step: 1, sortable: true } }
  ], [snapshotDate, onMeasure]);
  return <div className="asset-compliance-table asset-compliance-findings-table">
    <FindingsDataTable title="Findings and evidence" rows={findings} columns={columns} paginate={false}
      initialFilters={{ search: "", columns: findings.some(row => row.status === "open") ? { status: ["open"] } : {} }}
      searchText={row => `${row.id} ${row.recommendedAction} ${evidenceText(row.evidence)} ${row.evidencePreview}`}
      emptyMessage="No findings were generated in this scope. SPI evaluations are shown on the Security Posture tab."
      renderRow={row => <tr key={row.id}>
        {onMeasure && <td><button type="button" className="asset-compliance-link" onClick={() => onMeasure(row.spiId)}>{row.measureLabel}</button></td>}
        <td>{row.priorityRank > 0 ? `P${row.priorityRank}` : "Not assigned"}</td>
        <td><span className="asset-compliance-severity" style={{ borderColor: severityBarColors[row.severity] ?? "#94a3b8" }}>{row.severity}</span></td>
        <td><details className="asset-compliance-finding"><summary>{row.title}</summary>
          <p className="asset-compliance-muted">Finding {row.id}{row.status === "closed" && row.closedTimestampLabel ? ` · Closed ${row.closedTimestampLabel}` : ""}</p>
          <h4>Evidence</h4><Evidence items={row.evidence} />
          <h4>Remediation action</h4><p>{row.recommendedAction || "No remediation action recorded."}</p>
        </details></td>
        <td><StatusPill status={row.status} /></td><td className="asset-compliance-nowrap">{row.timestampLabel}</td>
        <td className="asset-compliance-nowrap">{columns[columns.length - 1].value(row)}</td>
      </tr>} />
  </div>;
}

export function ServerComplianceView({ assetId, assetName, systemId, dataDate,
  dataPath = "/api/cyber-cop/impact-analyser-2/compliance", onClose
}: { assetId: string; assetName: string; systemId?: string | null; dataDate?: string; dataPath?: string; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const measureTrigger = useRef<HTMLElement | null>(null);
  const detailOrigin = useRef<ComplianceTab>("overview");
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ComplianceTab>("overview");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [model, setModel] = useState<AssetComplianceModel | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [selectedMeasure, setSelectedMeasure] = useState<Measure | null>(null);
  const [findingsViewKey, setFindingsViewKey] = useState(0);
  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ assetId });
    if (dataDate) params.set("dataDate", dataDate);
    if (systemId) params.set("systemId", systemId);
    return `${dataPath}?${params.toString()}`;
  }, [assetId, dataDate, dataPath, systemId]);
  const sortedMeasures = useMemo(() => [...(model?.complianceOverview.measures ?? [])].sort(
    (left, right) => left.score - right.score || right.nonCompliant - left.nonCompliant || left.spiId - right.spiId
  ), [model]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const node = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    node?.showModal(); document.body.style.overflow = "hidden";
    return () => { node?.close(); document.body.style.overflow = overflow; trigger?.focus(); };
  }, [mounted]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading"); setModel(null); setErrorMessage(""); setSelectedMeasure(null); setActiveTab("overview");
    fetch(requestUrl, { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || `Unable to load asset compliance (${response.status}).`);
      }
      return response.json() as Promise<AssetComplianceModel>;
    }).then(payload => {
      if (!controller.signal.aborted) { setModel(payload); setLoadState("ready"); }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) { setErrorMessage(error instanceof Error ? error.message : "Unable to load asset compliance."); setLoadState("error"); }
    });
    return () => controller.abort();
  }, [requestUrl, retryKey]);

  useEffect(() => { if (selectedMeasure) backButton.current?.focus(); }, [selectedMeasure]);
  function openMeasureDetail(measure: Measure) {
    measureTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    detailOrigin.current = activeTab; setSelectedMeasure(measure); setActiveTab("overview");
  }
  function closeMeasureDetail() {
    setSelectedMeasure(null); setActiveTab(detailOrigin.current);
    requestAnimationFrame(() => measureTrigger.current?.focus());
  }
  function selectTab(tab: ComplianceTab) { setActiveTab(tab); setSelectedMeasure(null); }
  if (!mounted) return null;
  const overview = model?.complianceOverview;
  const discovery = model?.discoveryCompliance;

  return createPortal(<dialog ref={dialog} className="settings-popup asset-compliance-popup"
    data-server-compliance-view="true" data-asset-compliance-view="true" data-server-compliance-dialog="fixed" data-asset-compliance-dialog="fixed"
    data-asset-id={assetId} data-load-state={loadState} aria-labelledby={`${id}-title`}
    onCancel={event => { event.preventDefault(); if (selectedMeasure) closeMeasureDetail(); else onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="settings-popup-frame">
      <header className="asset-compliance-header"><div>
        <p className="endpoint-eyebrow">{model?.asset.assetTypeLabel ?? "Asset"} Compliance View</p>
        <h2 id={`${id}-title`}>{model?.asset.name || assetName}</h2>
        <p className="asset-compliance-muted">{model ? `${displayValue(model.asset.hostname)} · ${displayValue(model.asset.ipAddress)} · Snapshot ${model.snapshotDate}`
          : loadState === "loading" ? "Loading selected asset…" : dataDate ? `Snapshot ${dataDate}` : "Selected asset"}</p>
      </div><button type="button" className="asset-compliance-button" autoFocus onClick={onClose}>Close</button></header>
      <div className="asset-compliance-nav"><WorkspaceTabs id={id} label="Asset compliance views" tabs={tabs} active={activeTab} onChange={selectTab} /></div>
      <div className="asset-compliance-body" aria-busy={loadState === "loading"}>
        {loadState === "loading" && <div className="asset-compliance-placeholder" role="status">Loading compliance and discovery results…</div>}
        {loadState === "error" && <div className="asset-compliance-placeholder" role="alert"><h3>Unable to load compliance</h3><p>{errorMessage}</p>
          <button type="button" className="asset-compliance-button" onClick={() => setRetryKey(value => value + 1)}>Retry</button></div>}
        {loadState === "ready" && model && overview && discovery && <>
          <details hidden={!!selectedMeasure} className="asset-compliance-context"><summary>Asset context <span>{displayValue(model.asset.networkName)} · {displayValue(model.asset.systemName)}</span></summary>
            <dl><div><dt>Network</dt><dd>{displayValue(model.asset.networkName)}</dd></div><div><dt>ICT System</dt><dd>{displayValue(model.asset.systemName)}</dd></div>
              <div><dt>Environment</dt><dd>{displayValue(model.asset.environmentType)}</dd></div><div><dt>Security Domain</dt><dd>{displayValue(model.asset.securityDomain)}</dd></div></dl>
          </details>
          <div hidden={!!selectedMeasure} data-server-compliance-score-tiles="true" className="asset-compliance-summaries">
            <section><div className="asset-compliance-summary-title"><h3>Security posture</h3><button type="button" className="asset-compliance-link" onClick={() => { setFindingsViewKey(value => value + 1); selectTab("findings"); }}>{number(overview.openFindingCount)} open findings →</button></div>
              <ComplianceBar score={overview.score} counts={[overview.compliant, overview.nonCompliant, overview.unknown]} />
              <p>{number(overview.total)} SPI evaluations for this asset. Unknown results remain in the score.</p></section>
            <section><div className="asset-compliance-summary-title"><h3>Discovery coverage</h3><StatusPill status={discovery.total ? discovery.coverageCompliance ? "Compliant" : "Non-compliant" : "Not available"} /></div>
              <ComplianceBar score={discovery.score} counts={[discovery.covered, discovery.missing, discovery.notAvailable]} labels={["Covered", "Missing", "Not available"]} scoredTotal={discovery.covered + discovery.missing} />
              <p>Score uses covered and missing sources; unavailable values are excluded.</p></section>
          </div>

          <section id={`${id}-panel-overview`} role="tabpanel" aria-labelledby={`${id}-tab-overview`} hidden={activeTab !== "overview"} className="asset-compliance-tab-panel">
            <div hidden={!!selectedMeasure} className="asset-compliance-spi-list" data-server-compliance-spi-breakdown="true">
              <p className="asset-compliance-note">Security Posture Indicator breakdown · Lowest compliance first. Select an SPI to review its findings, evidence and remediation actions.</p>
              <div className="asset-compliance-table"><FindingsDataTable title="Security Posture Indicators" rows={sortedMeasures} columns={measureColumns} paginate={false}
                searchText={row => `${row.reasons.join(" ")} ${evidenceText(row.evidence)}`}
                emptyMessage="No SPI evaluations are available for this asset in the selected snapshot."
                renderRow={row => <tr key={row.spiId}><td><button type="button" className="asset-compliance-link" data-server-compliance-measure-action={row.spiId} onClick={() => openMeasureDetail(row)}>{row.label}</button></td>
                  <td><StatusPill status={row.status} /></td><td><ComplianceBar score={row.score} counts={[row.compliant, row.nonCompliant, row.unknown]} /></td>
                  <td><button type="button" className="asset-compliance-link" onClick={() => openMeasureDetail(row)} aria-label={`${row.openFindings.length} open findings for ${row.label}`}>{number(row.openFindings.length)}</button></td>
                  <td className="asset-compliance-reason">{row.topReasons[0] || "None recorded"}{row.reasons.length > 1 && <small>+{row.reasons.length - 1} more in SPI details</small>}</td></tr>} /></div>
            </div>
            {selectedMeasure && <section data-server-compliance-measure-detail="true" className="asset-compliance-detail" aria-label="SPI Findings and Evidence">
              <div className="asset-compliance-detail-heading"><button ref={backButton} type="button" className="asset-compliance-button" onClick={closeMeasureDetail}>← Back to {detailOrigin.current === "findings" ? "findings" : "SPIs"}</button>
                <h3>{selectedMeasure.label}</h3><StatusPill status={selectedMeasure.status} /></div>
              <details className="asset-compliance-evaluation"><summary>Evaluation evidence & non-compliance reasons</summary>
                <div><section><h4>Evaluation evidence</h4><Evidence items={selectedMeasure.evidence} /></section>
                  <section><h4>Non-compliance reasons</h4>{selectedMeasure.reasons.length ? <ul>{selectedMeasure.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul> : <p>No non-compliance reasons recorded.</p>}</section></div>
              </details>
              <p className="asset-compliance-note">Expand a finding for evidence and its remediation action. Use the Status column to include closed findings. Duration is days open at snapshot {model.snapshotDate}.</p>
              <ComplianceFindingsTable key={selectedMeasure.spiId} findings={selectedMeasure.findings} snapshotDate={model.snapshotDate} />
            </section>}
          </section>
          <section id={`${id}-panel-findings`} role="tabpanel" aria-labelledby={`${id}-tab-findings`} hidden={activeTab !== "findings"} className="asset-compliance-tab-panel">
            <p className="asset-compliance-note">Use column filters to include open or closed findings, narrow severity or priority, and filter or sort Duration. Expand a finding for evidence and remediation.</p>
            <ComplianceFindingsTable key={findingsViewKey} findings={overview.findings} snapshotDate={model.snapshotDate} onMeasure={spiId => {
              const measure = overview.measures.find(row => row.spiId === spiId); if (measure) openMeasureDetail(measure);
            }} />
          </section>
          <section id={`${id}-panel-discovery`} role="tabpanel" aria-labelledby={`${id}-tab-discovery`} hidden={activeTab !== "discovery"} className="asset-compliance-tab-panel">
            <p className="asset-compliance-note">Discovery sources applicable to this asset type. Filter Coverage to find missing or unavailable sources; ownership details identify who to contact.</p>
            <div className="asset-compliance-table"><FindingsDataTable title="Discovery source details" rows={discovery.tools} columns={toolColumns} paginate={false} searchText={row => row.description}
              emptyMessage="No discovery tools apply to this asset type."
              renderRow={row => <tr key={row.id}><td><strong>{row.name}</strong><small>{row.description || "No description recorded."}</small></td>
                <td><StatusPill status={row.status} /></td><td>{row.value ?? "Not available"}</td><td>{displayValue(row.el2Owner)}</td><td>{displayValue(row.el2OperationsManager)}</td></tr>} /></div>
          </section>
        </>}
      </div>
    </div>
  </dialog>, document.body);
}
