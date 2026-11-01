"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useMemo, useRef, useState } from "react";
import { FindingsDataTable } from "@/components/findings-data-table";
import { FindingsDurationPanel, severityBarColors } from "@/components/findings-duration-panel";
import { NetworkRiskTrend } from "@/components/network-risk-trend";
import { networkRiskHref, type NetworkRiskProfileModel, type NetworkRiskRow } from "@/lib/network-risk-profile";
import type { ExplorerColumn } from "@/lib/explorer-table";
import type { Filters } from "@/lib/types";

const number = (value: number) => value.toLocaleString("en-AU");
const score = (value: number | null) => value === null ? "No assessments" : `${value}%`;
type Review = "all" | "severe" | "ageing" | "discovery" | "unassessed";
const tabs = [{ id: "profile", label: "Network Risk Profile" }, { id: "explorer", label: "Network Explorer" }] as const;
type NetworkRiskTab = typeof tabs[number]["id"];

function CoverageBar({ label, counts }: { label: string; counts: NetworkRiskRow["spi"] }) {
  const description = `${number(counts.compliant)} compliant, ${number(counts.nonCompliant)} non-compliant and ${number(counts.unknown)} unknown of ${number(counts.total)} checks`;
  return <div className="measures-compliance-bar" role={counts.total ? "meter" : "img"} aria-label={label}
    aria-valuemin={counts.total ? 0 : undefined} aria-valuemax={counts.total ? 100 : undefined} aria-valuenow={counts.percent ?? undefined}
    aria-valuetext={counts.total ? description : "No assessments"} title={counts.total ? description : "No assessments"}>
    <span className="measures-compliance-good" style={{ width: `${counts.total ? counts.compliant / counts.total * 100 : 0}%` }} />
    <span className="measures-compliance-gap" style={{ width: `${counts.total ? counts.nonCompliant / counts.total * 100 : 0}%` }} />
    <span className="measures-compliance-value">{counts.percent === null ? "N/A" : `${counts.percent}%`}</span>
  </div>;
}

const columns: ExplorerColumn<NetworkRiskRow>[] = [
  { key: "network", label: "Network", value: row => row.name },
  { key: "status", label: "Posture", value: row => row.status },
  { key: "cis", label: "CIs", value: row => row.ciCount },
  { key: "spi", label: "SPI compliance", value: row => score(row.spi.percent) },
  { key: "discovery", label: "Discovery coverage", value: row => score(row.discovery.percent) },
  { key: "findings", label: "Open findings", value: row => row.openFindings, range: { value: row => row.openFindings, unit: "findings", min: 0, step: 1, sortable: true } },
  { key: "severe", label: "Critical / High", value: row => `${row.critical} / ${row.high}` },
  { key: "ageing", label: "Over 90 days", value: row => row.overdue, range: { value: row => row.overdue, unit: "findings", min: 0, step: 1, sortable: true } },
  { key: "modelled", label: "Modelled", value: row => row.modellingStatus ? "Yes" : "No" }
];

export function NetworkRiskProfile({ model, filters }: { model: NetworkRiskProfileModel; filters: Filters }) {
  const [activeTab, setActiveTab] = useState<NetworkRiskTab>("profile");
  const [review, setReview] = useState<Review>("all");
  const [order, setOrder] = useState("risk");
  const tabButtons = useRef<Record<NetworkRiskTab, HTMLButtonElement | null>>({ profile: null, explorer: null });
  const selectTab = (tab: NetworkRiskTab, moveFocus = false) => {
    setActiveTab(tab);
    if (moveFocus) tabButtons.current[tab]?.focus();
  };
  const href = (path: string, networkId?: string, extra?: Record<string, string>) => networkRiskHref(path, filters, model.snapshotDate, networkId, extra);
  const findingsHref = (networkId?: string, extra?: Record<string, string>) => href("/findings", networkId, { findingsTab: "open", asOf: model.snapshotDate, ...extra });
  const views = useMemo(() => [
    { id: "all" as const, label: "All networks", rows: model.rows },
    { id: "severe" as const, label: "Critical / high findings", rows: model.rows.filter(row => row.critical + row.high > 0) },
    { id: "ageing" as const, label: "Findings over 90 days", rows: model.rows.filter(row => row.overdue > 0) },
    { id: "discovery" as const, label: "Discovery gaps", rows: model.rows.filter(row => row.discovery.nonCompliant + row.discovery.unknown > 0) },
    { id: "unassessed" as const, label: "Missing SPI assessments", rows: model.rows.filter(row => row.spi.total === 0 || row.unassessedCis > 0) }
  ], [model.rows]);
  const selected = views.find(view => view.id === review)!;
  const rows = useMemo(() => [...selected.rows].sort((a, b) => order === "name" ? a.name.localeCompare(b.name)
    : order === "compliance" ? (a.spi.percent ?? 101) - (b.spi.percent ?? 101) || a.name.localeCompare(b.name)
    : order === "findings" ? b.openFindings - a.openFindings || a.name.localeCompare(b.name) : 0), [selected.rows, order]);
  const focus = (view: Review) => { setReview(view); selectTab("explorer", true); };
  const exportCsv = (matching: NetworkRiskRow[]) => {
    const csv = Papa.unparse(matching.map(row => ({ Network: row.name, Classification: row.classification, Criticality: row.criticality,
      Posture: row.status, CIs: row.ciCount, "ICT systems using CIs": row.systemCount, "CIs without SPI assessments": row.unassessedCis, "SPI compliance (%)": row.spi.percent ?? "",
      "Discovery coverage (%)": row.discovery.percent ?? "", "Open findings": row.openFindings, "Critical Exposure": row.critical,
      "High Risk": row.high, "Open over 90 days": row.overdue, "Oldest open finding (days)": row.oldestDays ?? "",
      Modelled: row.modellingStatus ? "Yes" : "No", "Discovery status": row.discoveryStatus, Owner: row.owner, Snapshot: model.snapshotDate })));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `network-risk-profile-${model.snapshotDate}.csv`;
    document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="workspace-page discovery-overview network-risk-page">
    <header className="endpoint-hero discovery-overview-hero"><div><p className="endpoint-eyebrow">Cyber Security / Networks</p><h1>Network Risk Profile</h1>
      <div className="discovery-overview-context"><span><strong>{number(model.networkCount)}</strong> networks</span><span><strong>{number(model.ciCount)}</strong> CIs</span><span><strong>{number(model.systemCount)}</strong> ICT systems using these CIs</span></div></div>
      <div className="network-risk-header-actions"><div className="discovery-overview-snapshot"><span>Snapshot</span><strong>{model.snapshotDate}</strong></div>
        <a className="report-generate" href={href("/api/networks/remediation-report")} target="_blank" rel="noreferrer">Remediation report <span aria-hidden="true">↗</span></a></div>
    </header>
    <div className="network-risk-tabs" role="tablist" aria-label="Network risk views">
      {tabs.map(tab => <button key={tab.id} ref={element => { tabButtons.current[tab.id] = element; }} type="button" role="tab"
        id={`network-risk-tab-${tab.id}`} aria-controls={`network-risk-panel-${tab.id}`} aria-selected={activeTab === tab.id}
        tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => selectTab(tab.id)} onKeyDown={event => {
          const next = event.key === "Home" ? "profile" : event.key === "End" ? "explorer"
            : event.key === "ArrowLeft" || event.key === "ArrowRight" ? tab.id === "profile" ? "explorer" : "profile" : null;
          if (next) { event.preventDefault(); selectTab(next, true); }
        }}>{tab.label}</button>)}
    </div>
    <section className="network-risk-profile-panel" role="tabpanel" id="network-risk-panel-profile" aria-labelledby="network-risk-tab-profile" hidden={activeTab !== "profile"} tabIndex={0}>
    {!model.networkCount ? <section className="discovery-overview-panel"><h2>No managed networks in this scope</h2><p className="discovery-overview-note">Choose a managed network in the header or select a different snapshot.</p></section> : <>
      <section className="discovery-overview-metrics" aria-label="Network risk highlights">{[
        { label: "Networks in scope", value: model.networkCount, note: `${number(model.compliantNetworks)} assessed and compliant`, view: "all" as const, tone: "cyan" },
        { label: "Critical & high findings", value: model.severeFindings, note: `${number(model.openFindings)} open findings overall`, view: "severe" as const, tone: "amber" },
        { label: "Open over 90 days", value: model.overdueFindings, note: "Review long-running findings", view: "ageing" as const, tone: "violet" },
        { label: "CIs with discovery gaps", value: model.discovery.nonCompliant + model.discovery.unknown, note: `${number(model.discovery.unknown)} without an assessment`, view: "discovery" as const, tone: "teal" }
      ].map(tile => <button key={tile.view} type="button" className={`discovery-overview-metric tone-${tile.tone}`} onClick={() => focus(tile.view)} aria-label={`${tile.label}: ${number(tile.value)}. Open Network Explorer for matching networks`}>
        <strong>{number(tile.value)}</strong><div><span>{tile.label}</span><small>{tile.note}</small></div><span aria-hidden="true">→</span>
      </button>)}</section>
      <div className="network-risk-overview-grid">
        <section className="discovery-overview-panel" aria-labelledby="network-risk-coverage-title"><header><h2 id="network-risk-coverage-title">Posture &amp; coverage</h2><Link href={href("/measures")} prefetch={false}>Measures ↗</Link></header>
          {[{ label: "SPI compliance", counts: model.spi, note: "CI and SPI assessments" }, { label: "Discovery coverage", counts: model.discovery, note: "CI discovery assessments" }].map(item => <div className="network-risk-coverage" key={item.label}>
            <div><strong>{item.label}</strong><span>{number(item.counts.compliant)} / {number(item.counts.total)} {item.note}</span></div><CoverageBar label={item.label} counts={item.counts} />
            <p>{number(item.counts.nonCompliant)} non-compliant · {number(item.counts.unknown)} unknown</p>
          </div>)}
          {model.unassessedCis > 0 && <p className="discovery-overview-note">{number(model.unassessedCis)} CIs have no SPI assessments and are excluded from the SPI percentage.</p>}
          <div className="network-risk-metadata"><span><strong>{number(model.modelled)} / {number(model.networkCount)}</strong> networks modelled</span><span><strong>{number(model.discoveryEnabled)} / {number(model.networkCount)}</strong> discovery enabled</span></div>
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
        <p>All summaries use the networks and snapshot selected in the header. Explorer focus, search, ordering and column filters apply to the network table; CSV exports include all matching rows. The remediation report uses the full header scope.</p>
        <p>SPI compliance is compliant CI and SPI assessments divided by all recorded assessments, including unknowns. CIs with no SPI assessments are reported separately; no assessments show N/A. Discovery coverage is the share of scoped CIs meeting discovery requirements; CIs missing an evaluation show as unknown. Green shows compliance, red shows non-compliance and grey shows unknowns.</p>
        <p>Risk priority orders networks by critical findings, high findings, findings over 90 days, then all open findings. A CI can produce several findings. Age is measured in UTC calendar days at the snapshot. Trends reconstruct recorded opening and closure dates; they are not historical snapshots of previous severity settings.</p>
      </div></details>
    </>}
    </section>
      <section className="network-risk-explorer" role="tabpanel" id="network-risk-panel-explorer" aria-labelledby="network-risk-tab-explorer" hidden={activeTab !== "explorer"} tabIndex={0}>
        <header><div><h2 id="network-risk-explorer-title">Network Explorer</h2><p>Review networks, then follow counts to their findings and devices.</p></div>
          <label>Order <select className="report-sort" aria-label="Order networks" value={order} onChange={event => setOrder(event.target.value)}><option value="risk">Risk priority</option><option value="compliance">Lowest SPI compliance</option><option value="findings">Most open findings</option><option value="name">Network name A–Z</option></select></label>
        </header>
        <div className="network-risk-views" role="group" aria-label="Network review focus">{views.map(view => <button type="button" key={view.id} aria-pressed={view.id === review} onClick={() => setReview(view.id)}>{view.label} <span>{number(view.rows.length)}</span></button>)}</div>
        <div className="network-risk-table-host"><FindingsDataTable key={`${review}:${order}`} title="Networks" rows={rows} columns={columns} paginate={false}
          className="network-risk-table" searchText={row => `${row.id} ${row.classification} ${row.criticality} ${row.discoveryStatus} ${row.owner} ${row.description}`}
          emptyMessage="No networks match this review focus. Choose All networks to see the selected scope."
          actions={matching => <button type="button" className="endpoint-export" disabled={!matching.length} onClick={() => exportCsv(matching)}>Export CSV</button>}
          renderRow={row => <tr key={row.id}>
            <td className="network-risk-name"><Link href={href(`/networks/${encodeURIComponent(row.id)}`, row.id)} prefetch={false}>{row.name} ↗</Link><small>{row.classification} · {row.criticality}</small><small>{row.discoveryStatus}</small></td>
            <td><span className={`network-risk-status ${row.status === "Compliant" ? "is-good" : row.status === "Non-compliant" ? "is-gap" : "is-unknown"}`}>{row.status}</span></td>
            <td><Link aria-label={`${row.name}: ${row.ciCount} CIs`} href={href("/discovery-coverage", row.id, { discoveryView: "endpoints" })} prefetch={false}>{number(row.ciCount)}</Link></td>
            <td className="network-risk-score"><Link aria-label={`Review ${row.name} SPI compliance`} href={href("/measures", row.id, { measuresTab: "measures-spi" })} prefetch={false}><CoverageBar label={`${row.name} SPI compliance`} counts={row.spi} /></Link></td>
            <td className="network-risk-score"><Link aria-label={`Review ${row.name} discovery coverage`} href={href("/discovery-coverage", row.id, { discoveryView: "compliance" })} prefetch={false}><CoverageBar label={`${row.name} discovery coverage`} counts={row.discovery} /></Link></td>
            <td><Link aria-label={`${row.name}: ${row.openFindings} open findings`} href={findingsHref(row.id)} prefetch={false}>{number(row.openFindings)}</Link></td>
            <td className="network-risk-severe"><Link aria-label={`${row.name}: ${row.critical} critical exposure findings`} href={findingsHref(row.id, { severity: "Critical Exposure" })} prefetch={false}>{number(row.critical)}</Link><span> / </span><Link aria-label={`${row.name}: ${row.high} high risk findings`} href={findingsHref(row.id, { severity: "High Risk" })} prefetch={false}>{number(row.high)}</Link></td>
            <td><Link aria-label={`${row.name}: ${row.overdue} findings over 90 days`} href={findingsHref(row.id, { durationMin: "91" })} prefetch={false}>{number(row.overdue)}</Link></td>
            <td>{row.modellingStatus ? "Yes" : "No"}</td>
          </tr>} /></div>
      </section>
  </div>;
}
