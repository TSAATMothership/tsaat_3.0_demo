"use client";

import { PersonaPopup } from "@/components/persona-popup";
import { DocumentDownloadButton } from "@/components/document-download-button";

import Link from "@/components/persona-link";
import Papa from "papaparse";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ComplianceHeatmap } from "@/components/compliance-heatmap";
import { FindingsDataTable } from "@/components/findings-data-table";
import { FindingsDurationPanel, severityBarColors } from "@/components/findings-duration-panel";
import { NetworkRiskTrend } from "@/components/network-risk-trend";
import { NetworkDetailsPanel } from "@/components/network-details-panel";
import { IctSystemDetailsPanel } from "@/components/ict-system-details-panel";
import { riskProfileHref, type RiskProfileModel, type RiskProfileRow, type RiskProfileKind } from "@/lib/risk-profile";
import type { ExplorerColumn } from "@/lib/explorer-table";
import type { Filters } from "@/lib/types";

const number = (value: number) => value.toLocaleString("en-AU");
const score = (value: number | null) => value === null ? "No assessments" : `${value}%`;
type Review = "all" | "severe" | "ageing" | "discovery" | "unassessed";
type RiskProfileTab = "profile" | "explorer" | "heatmap";

function ExplorerDrillThrough({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return <Link href={href} target="_blank" rel="noopener noreferrer" prefetch={false}
    aria-label={label + " (opens in a new tab)"}>{children}</Link>;
}

function CoverageBar({ label, counts }: { label: string; counts: RiskProfileRow["spi"] }) {
  const description = `${number(counts.compliant)} compliant, ${number(counts.nonCompliant)} non-compliant and ${number(counts.unknown)} unknown of ${number(counts.total)} checks`;
  return <div className="measures-compliance-bar" role={counts.total ? "meter" : "img"} aria-label={label}
    aria-valuemin={counts.total ? 0 : undefined} aria-valuemax={counts.total ? 100 : undefined} aria-valuenow={counts.percent ?? undefined}
    aria-valuetext={counts.total ? description : "No assessments"} title={counts.total ? description : "No assessments"}>
    <span className="measures-compliance-good" style={{ width: `${counts.total ? counts.compliant / counts.total * 100 : 0}%` }} />
    <span className="measures-compliance-gap" style={{ width: `${counts.total ? counts.nonCompliant / counts.total * 100 : 0}%` }} />
    <span className="measures-compliance-value">{counts.percent === null ? "N/A" : `${counts.percent}%`}</span>
  </div>;
}

const profileColumns = (kind: RiskProfileKind): ExplorerColumn<RiskProfileRow>[] => [
  { key: kind, label: kind === "system" ? "ICT System" : "Network", value: row => row.name },
  { key: "status", label: "Posture", value: row => row.status },
  { key: "cis", label: "CIs", value: row => row.ciCount },
  { key: "spi", label: "SPI compliance", value: row => score(row.spi.percent) },
  { key: "discovery", label: "Discovery coverage", value: row => score(row.discovery.percent) },
  { key: "findings", label: "Open findings", value: row => row.openFindings, range: { value: row => row.openFindings, unit: "findings", min: 0, step: 1, sortable: true } },
  { key: "severe", label: "Critical / High", value: row => `${row.critical} / ${row.high}` },
  { key: "ageing", label: "Over 90 days", value: row => row.overdue, range: { value: row => row.overdue, unit: "findings", min: 0, step: 1, sortable: true } },
  ...(kind === "system" ? [{ key: "ato", label: "ATO", value: (row: RiskProfileRow) => row.atoNumber || "Not provided" },
    { key: "diis", label: "DIIS", value: (row: RiskProfileRow) => row.diisId || "Not provided" },
    { key: "appId", label: "APP-ID", value: (row: RiskProfileRow) => row.systemDetails?.apmNumber || "Not provided" }] : []),
  { key: "modelled", label: "Modelled", value: row => row.modellingStatus ? "Yes" : "No" }
];

export function RiskProfile({ model, filters, initialNetworkId, initialSystemId }: { model: RiskProfileModel; filters: Filters; initialNetworkId?: string; initialSystemId?: string }) {
  const isSystem = model.kind === "system";
  const entityLabel = isSystem ? "ICT System" : "Network";
  const entities = isSystem ? "ICT systems" : "networks";
  const title = `${entityLabel} Risk Profile`;
  const explorerTitle = `${entityLabel} Explorer`;
  const idPrefix = isSystem ? "ict-system-risk" : "network-risk";
  const tabs = [{ id: "profile", label: title }, { id: "explorer", label: explorerTitle }, { id: "heatmap", label: "Compliance Heatmap" }] as const;
  const columns = useMemo(() => profileColumns(model.kind), [model.kind]);
  const initialDetails = model.rows.find(row => row.id === (isSystem ? initialSystemId : initialNetworkId))?.[isSystem ? "systemDetails" : "networkDetails"];
  const [activeTab, setActiveTab] = useState<RiskProfileTab>(initialDetails ? "explorer" : "profile");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(initialDetails?.id ?? null);
  const selectedRow = model.rows.find(row => row.id === selectedEntityId);
  const [review, setReview] = useState<Review>("all");
  const [order, setOrder] = useState("risk");
  const tabButtons = useRef<Record<RiskProfileTab, HTMLButtonElement | null>>({ profile: null, explorer: null, heatmap: null });
  const selectTab = (tab: RiskProfileTab, moveFocus = false) => {
    setActiveTab(tab);
    if (moveFocus) tabButtons.current[tab]?.focus();
  };
  const href = (path: string, entityId?: string, extra?: Record<string, string>) => riskProfileHref(path, filters, model.snapshotDate, model.kind, entityId, extra);
  const detailsHref = (entityId: string) => href(isSystem ? "/ict-system-risk-profile" : "/network-risk-profile", entityId,
    { [isSystem ? "systemDetails" : "networkDetails"]: entityId });
  const findingsHref = (entityId?: string, extra?: Record<string, string>) => href("/findings", entityId, { findingsTab: "open", asOf: model.snapshotDate, ...extra });
  const views = useMemo(() => [
    { id: "all" as const, label: `All ${entities}`, rows: model.rows },
    { id: "severe" as const, label: "Critical / high findings", rows: model.rows.filter(row => row.critical + row.high > 0) },
    { id: "ageing" as const, label: "Findings over 90 days", rows: model.rows.filter(row => row.overdue > 0) },
    { id: "discovery" as const, label: "Discovery gaps", rows: model.rows.filter(row => row.discovery.nonCompliant + row.discovery.unknown > 0) },
    { id: "unassessed" as const, label: "Missing SPI assessments", rows: model.rows.filter(row => row.spi.total === 0 || row.unassessedCis > 0) }
  ], [model.rows, entities]);
  const selected = views.find(view => view.id === review)!;
  const rows = useMemo(() => [...selected.rows].sort((a, b) => order === "name" ? a.name.localeCompare(b.name)
    : order === "compliance" ? (a.spi.percent ?? 101) - (b.spi.percent ?? 101) || a.name.localeCompare(b.name)
    : order === "findings" ? b.openFindings - a.openFindings || a.name.localeCompare(b.name) : 0), [selected.rows, order]);
  const focus = (view: Review) => { setReview(view); selectTab("explorer", true); };
  const exportCsv = (matching: RiskProfileRow[]) => {
    const csv = Papa.unparse(matching.map(row => ({ [entityLabel]: row.name, "Security Domain": row.securityDomain, ...(!isSystem ? { Classification: row.classification } : {}), Criticality: row.criticality,
      Posture: row.status, CIs: row.ciCount, ...(isSystem ? { "Networks hosting CIs": row.networkCount, ATO: row.atoNumber, DIIS: row.diisId, "APP-ID": row.systemDetails?.apmNumber ?? "" } : { "ICT systems using CIs": row.systemCount }), "CIs without SPI assessments": row.unassessedCis, "SPI compliance (%)": row.spi.percent ?? "",
      "Discovery coverage (%)": row.discovery.percent ?? "", "Open findings": row.openFindings, "Critical Exposure": row.critical,
      "High Risk": row.high, "Open over 90 days": row.overdue, "Oldest open finding (days)": row.oldestDays ?? "",
      Modelled: row.modellingStatus ? "Yes" : "No", ...(isSystem ? { "Managed networks": row.context } : { "Discovery status": row.discoveryStatus }), Owner: row.owner, Snapshot: model.snapshotDate })));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${isSystem ? "ict-system" : "network"}-risk-profile-${model.snapshotDate}.csv`;
    document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className={`workspace-page discovery-overview network-risk-page${isSystem ? " ict-system-risk-page" : ""}`}>
    <header className="endpoint-hero discovery-overview-hero"><div><p className="endpoint-eyebrow">Cyber Security / {isSystem ? "ICT Systems" : "Networks"}</p><h1>{title}</h1>
      <div className="discovery-overview-context"><span><strong>{number(model.entityCount)}</strong> {entities}</span><span><strong>{number(model.ciCount)}</strong> CIs</span><span><strong>{number(isSystem ? model.networkCount : model.systemCount)}</strong> {isSystem ? "networks hosting these CIs" : "ICT systems using these CIs"}</span></div></div>
      <div className="network-risk-header-actions"><div className="discovery-overview-snapshot"><span>Snapshot</span><strong>{model.snapshotDate}</strong></div>
        <DocumentDownloadButton className="report-generate" href={href(isSystem ? "/api/systems/remediation-report" : "/api/networks/remediation-report")}>Remediation report <span aria-hidden="true">↗</span></DocumentDownloadButton></div>
    </header>
    <div className="network-risk-tabs" role="tablist" aria-label={`${entityLabel} risk views`}>
      {tabs.map(tab => <button key={tab.id} ref={element => { tabButtons.current[tab.id] = element; }} type="button" role="tab"
        id={`${idPrefix}-tab-${tab.id}`} aria-controls={`${idPrefix}-panel-${tab.id}`} aria-selected={activeTab === tab.id}
        tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => selectTab(tab.id)} onKeyDown={event => {
          const position = tabs.findIndex(item => item.id === tab.id);
          const next = event.key === "Home" ? tabs[0].id : event.key === "End" ? tabs[tabs.length - 1].id
            : event.key === "ArrowLeft" ? tabs[(position + tabs.length - 1) % tabs.length].id
            : event.key === "ArrowRight" ? tabs[(position + 1) % tabs.length].id : null;
          if (next) { event.preventDefault(); selectTab(next, true); }
        }}>{tab.label}</button>)}
    </div>
    <section className="network-risk-profile-panel" role="tabpanel" id={`${idPrefix}-panel-profile`} aria-labelledby={`${idPrefix}-tab-profile`} hidden={activeTab !== "profile"} tabIndex={0}>
    {!model.entityCount ? <section className="discovery-overview-panel"><h2>No {isSystem ? "ICT systems" : "managed networks"} in this scope</h2><p className="discovery-overview-note">Choose {isSystem ? "an ICT system" : "a managed network"} in the header or select a different snapshot.</p></section> : <>
      <section className="discovery-overview-metrics" aria-label={`${entityLabel} risk highlights`}>{[
        { label: `${entityLabel}s in scope`, value: model.entityCount, note: `${number(model.compliantCount)} assessed and compliant`, view: "all" as const, tone: "cyan" },
        { label: "Critical & high findings", value: model.severeFindings, note: `${number(model.openFindings)} open findings overall`, view: "severe" as const, tone: "amber" },
        { label: "Open over 90 days", value: model.overdueFindings, note: "Review long-running findings", view: "ageing" as const, tone: "violet" },
        { label: "CIs with discovery gaps", value: model.discovery.nonCompliant + model.discovery.unknown, note: `${number(model.discovery.unknown)} without an assessment`, view: "discovery" as const, tone: "teal" }
      ].map(tile => <button key={tile.view} type="button" className={`discovery-overview-metric tone-${tile.tone}`} onClick={() => focus(tile.view)} aria-label={`${tile.label}: ${number(tile.value)}. Open ${explorerTitle} for matching ${entities}`}>
        <strong>{number(tile.value)}</strong><div><span>{tile.label}</span><small>{tile.note}</small></div><span aria-hidden="true">→</span>
      </button>)}</section>
      <div className="network-risk-overview-grid">
        <section className="discovery-overview-panel" aria-labelledby="network-risk-coverage-title"><header><h2 id="network-risk-coverage-title">Posture &amp; coverage</h2><Link href={href("/measures")} prefetch={false}>Measures ↗</Link></header>
          {[{ label: "SPI compliance", counts: model.spi, note: "CI and SPI assessments" }, { label: "Discovery coverage", counts: model.discovery, note: "CI discovery assessments" }].map(item => <div className="network-risk-coverage" key={item.label}>
            <div><strong>{item.label}</strong><span>{number(item.counts.compliant)} / {number(item.counts.total)} {item.note}</span></div><CoverageBar label={item.label} counts={item.counts} />
            <p>{number(item.counts.nonCompliant)} non-compliant · {number(item.counts.unknown)} unknown</p>
          </div>)}
          {model.unassessedCis > 0 && <p className="discovery-overview-note">{number(model.unassessedCis)} CIs have no SPI assessments and are excluded from the SPI percentage.</p>}
          <div className="network-risk-metadata">{model.metadata.map(item => <span key={item.label}><strong>{number(item.count)} / {number(item.total)}</strong> {item.label}</span>)}</div>
        </section>
        <section className="discovery-overview-panel" aria-labelledby="network-risk-severity-title"><header><h2 id="network-risk-severity-title">Open findings by severity</h2><Link href={findingsHref()} prefetch={false}>Findings ↗</Link></header>
          <p className="discovery-overview-note">{number(model.openFindings)} open findings · {number(model.p1p2)} at priority P1 or P2.</p>
          <div className="measures-severity-bars">{model.severities.map(severity => <Link prefetch={false} key={severity.key} href={findingsHref(undefined, { severity: severity.key })}>
            <span>{severity.label}</span><div aria-hidden="true"><span style={{ width: `${model.openFindings ? severity.count / model.openFindings * 100 : 0}%`, backgroundColor: severityBarColors[severity.key] ?? "#94a3b8" }} /></div><strong>{number(severity.count)}</strong><span aria-hidden="true">↗</span>
          </Link>)}</div>{!model.openFindings && <p className="discovery-overview-empty">No open findings in this scope.</p>}
        </section>
        <FindingsDurationPanel model={model} filters={filters} snapshotDate={model.snapshotDate} />
        <NetworkRiskTrend model={model} active={activeTab === "profile"} />
      </div>
      <details className="discovery-overview-method"><summary>How to read this profile</summary><div>
        <p>All summaries use the {entities} and snapshot selected in the header. Explorer focus, search, ordering and column filters apply to the {isSystem ? "ICT system" : "network"} table; CSV exports include all matching rows. The remediation report uses the full header scope.</p>
        <p>SPI compliance is compliant CI and SPI assessments divided by all recorded assessments, including unknowns. CIs with no SPI assessments are reported separately; no assessments show N/A. Discovery coverage is the share of scoped CIs meeting discovery requirements; CIs missing an evaluation show as unknown. Green shows compliance, red shows non-compliance and grey shows unknowns.</p>
        <p>Risk priority orders {entities} by critical findings, high findings, findings over 90 days, then all open findings. A CI can produce several findings. Age is measured in UTC calendar days at the snapshot. Trends reconstruct recorded opening and closure dates; they are not historical snapshots of previous severity settings.</p>
        {isSystem && <p>CI assessments and findings use the recorded ICT system association, matching the linked findings and endpoint explorers. CIs without a recorded ICT system are excluded. ATO, DIIS and APP-ID show the stored identifiers; missing values are not treated as provided.</p>}
      </div></details>
    </>}
    </section>
      <section className="network-risk-explorer" role="tabpanel" id={`${idPrefix}-panel-explorer`} aria-labelledby={`${idPrefix}-tab-explorer`} hidden={activeTab !== "explorer"} tabIndex={0}>
        <header><div><h2 id="network-risk-explorer-title">{explorerTitle}</h2><p>Drill-throughs open in new tabs with the selected {isSystem ? "ICT system" : "network"}, snapshot and matching filters.</p></div>
          <label>Order <select className="report-sort" aria-label={`Order ${entities}`} value={order} onChange={event => setOrder(event.target.value)}><option value="risk">Risk priority</option><option value="compliance">Lowest SPI compliance</option><option value="findings">Most open findings</option><option value="name">{entityLabel} name A–Z</option></select></label>
        </header>
        <div className="network-risk-views" role="group" aria-label={`${entityLabel} review focus`}>{views.map(view => <button type="button" key={view.id} aria-pressed={view.id === review} onClick={() => setReview(view.id)}>{view.label} <span>{number(view.rows.length)}</span></button>)}</div>
        <div className="network-risk-table-host"><FindingsDataTable key={`${review}:${order}`} title={isSystem ? "ICT Systems" : "Networks"} rows={rows} columns={columns} paginate={false}
          className={`network-risk-table${isSystem ? " ict-system-risk-table" : ""}`} searchText={row => `${row.id} ${row.securityDomain} ${row.classification} ${row.criticality} ${row.context} ${row.owner} ${row.description} ${row.atoNumber ?? ""} ${row.diisId ?? ""}`}
          emptyMessage={`No ${entities} match this review focus. Choose All ${entities} to see the selected scope. Define the scope in the header if none are available.`}
          actions={matching => <button type="button" className="endpoint-export" disabled={!matching.length} onClick={() => exportCsv(matching)}>Export CSV</button>}
          renderRow={row => <tr key={row.id}>
            <td className="network-risk-name"><ExplorerDrillThrough label={`Open ${entityLabel} Details for ${row.name}`} href={detailsHref(row.id)}>{row.name} <span aria-hidden="true">↗</span></ExplorerDrillThrough>
              <small>Security Domain: {row.securityDomain} · {row.criticality}</small>{!isSystem && <small>Classification: {row.classification}</small>}<small>{row.context}</small></td>
            <td><span className={`network-risk-status ${row.status === "Compliant" ? "is-good" : row.status === "Non-compliant" ? "is-gap" : "is-unknown"}`}>{row.status}</span></td>
            <td><ExplorerDrillThrough label={`${row.name}: ${row.ciCount} CIs`} href={href("/discovery-coverage", row.id, { discoveryView: "endpoints" })}>{number(row.ciCount)}</ExplorerDrillThrough></td>
            <td className="network-risk-score"><ExplorerDrillThrough label={`Review ${row.name} SPI compliance`} href={href("/measures", row.id, { measuresTab: "measures-spi" })}><CoverageBar label={`${row.name} SPI compliance`} counts={row.spi} /></ExplorerDrillThrough></td>
            <td className="network-risk-score"><ExplorerDrillThrough label={`Review ${row.name} discovery coverage`} href={href("/discovery-coverage", row.id, { discoveryView: "compliance" })}><CoverageBar label={`${row.name} discovery coverage`} counts={row.discovery} /></ExplorerDrillThrough></td>
            <td><ExplorerDrillThrough label={`${row.name}: ${row.openFindings} open findings`} href={findingsHref(row.id)}>{number(row.openFindings)}</ExplorerDrillThrough></td>
            <td className="network-risk-severe"><ExplorerDrillThrough label={`${row.name}: ${row.critical} critical exposure findings`} href={findingsHref(row.id, { severity: "Critical Exposure" })}>{number(row.critical)}</ExplorerDrillThrough><span> / </span><ExplorerDrillThrough label={`${row.name}: ${row.high} high risk findings`} href={findingsHref(row.id, { severity: "High Risk" })}>{number(row.high)}</ExplorerDrillThrough></td>
            <td><ExplorerDrillThrough label={`${row.name}: ${row.overdue} findings over 90 days`} href={findingsHref(row.id, { durationMin: "91" })}>{number(row.overdue)}</ExplorerDrillThrough></td>
            {isSystem && <><td>{row.atoNumber || "Not provided"}</td><td>{row.diisId || "Not provided"}</td><td>{row.systemDetails?.apmNumber || "Not provided"}</td></>}
            <td>{row.modellingStatus ? "Yes" : "No"}</td>
          </tr>} /></div>
      </section>
      <section role="tabpanel" id={`${idPrefix}-panel-heatmap`} aria-labelledby={`${idPrefix}-tab-heatmap`} hidden={activeTab !== "heatmap"}>
        <ComplianceHeatmap model={model.heatmap} active={activeTab === "heatmap"} />
      </section>
      {!isSystem && selectedRow?.networkDetails && <PersonaPopup popup="network-details"><NetworkDetailsPanel network={selectedRow.networkDetails} snapshotDate={model.snapshotDate} securityDomain={filters.securityDomain} onClose={() => setSelectedEntityId(null)} /></PersonaPopup>}
      {isSystem && selectedRow?.systemDetails && <PersonaPopup popup="ict-system-details"><IctSystemDetailsPanel system={selectedRow.systemDetails} snapshotDate={model.snapshotDate} securityDomain={filters.securityDomain} onClose={() => setSelectedEntityId(null)} /></PersonaPopup>}
  </div>;
}
