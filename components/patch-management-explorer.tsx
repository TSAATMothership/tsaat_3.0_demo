"use client";

import { useCallback, useState } from "react";
import { FindingsDataTable } from "@/components/findings-data-table";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { CmdbDeviceName } from "@/components/cmdb-drill-through";
import { emptyExplorerTableFilters, type ExplorerTableFilters } from "@/lib/explorer-table";
import { PATCH_VIEWS, patchColumnsForView, patchSearchText, patchValue, type PatchColumn, type PatchManagementRow, type PatchView } from "@/lib/patch-management-explorer";

const charts: Record<PatchView, { key: PatchColumn; title: string; subtitle: string; tone: string }[]> = {
  posture: [
    { key: "status", title: "Patch status", subtitle: "Deployment and verification across servers", tone: "tone-cyan" },
    { key: "priority", title: "Next focus", subtitle: "Recorded evidence and overdue actions", tone: "tone-blue" },
    { key: "osSupportStatus", title: "OS support", subtitle: "Operating system lifecycle risk", tone: "tone-violet" },
    { key: "environment", title: "Environment", subtitle: "Distribution across server environments", tone: "tone-teal" }
  ],
  restarts: [
    { key: "status", title: "Patch status", subtitle: "Deployment and verification across servers", tone: "tone-cyan" },
    { key: "restartRequired", title: "Restart requirement", subtitle: "Complete the maintenance cycle", tone: "tone-blue" },
    { key: "evidenceStatus", title: "Assessment evidence", subtitle: "Freshness at the selected snapshot", tone: "tone-violet" },
    { key: "source", title: "Evidence source", subtitle: "Provenance of the recorded assessment", tone: "tone-teal" }
  ],
  planning: [
    { key: "status", title: "Patch status", subtitle: "Deployment and verification across servers", tone: "tone-cyan" },
    { key: "networkName", title: "Managed network", subtitle: "Distribution across managed networks", tone: "tone-blue" },
    { key: "owner", title: "Patch owner", subtitle: "Teams responsible for maintenance", tone: "tone-violet" },
    { key: "exceptionStatus", title: "Exceptions", subtitle: "Recorded maintenance exceptions", tone: "tone-teal" }
  ]
};

export function PatchManagementExplorer({ rows, snapshotDate, scope, initialFilters }: {
  rows: PatchManagementRow[]; snapshotDate: string; scope: { network: string[]; system: string[]; securityDomain?: string; dataDate: string };
  initialFilters?: ExplorerTableFilters;
}) {
  const [view, setView] = useState<PatchView>("posture");
  const [filters, setFilters] = useState<Record<PatchView, ExplorerTableFilters>>(() => ({ posture: initialFilters ?? emptyExplorerTableFilters(), restarts: emptyExplorerTableFilters(), planning: emptyExplorerTableFilters() }));
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState("");
  const columns = patchColumnsForView(view);
  const handleFiltersChange = useCallback((next: ExplorerTableFilters) => setFilters(current => ({ ...current, [view]: next })), [view]);
  const patched = rows.filter(row => row.status === "Patched").length;
  const exportRows = async () => {
    if (exporting) return;
    setExporting(true); setExportError("");
    try {
      const response = await fetch("/api/discovery-coverage/patch-management/export", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, view, filters: filters[view] }), cache: "no-store" });
      if (!response.ok) throw new Error("The patch workbook could not be created. Please retry.");
      const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
      link.href = url; link.download = `patch-management-explorer-${snapshotDate}.xlsx`;
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setExportError(error instanceof Error ? error.message : "Unable to export patch records."); }
    finally { setExporting(false); }
  };
  return <div className="endpoint-explorer patch-management-explorer">
    <header className="endpoint-hero"><div><p className="endpoint-eyebrow">Discovery / Server maintenance</p><h1>Patch Management Explorer</h1>
      <p className="endpoint-description">Track patch deployment, overdue updates, restart requirements and verification across your servers.</p>
      <p className="endpoint-scope-facts">In scope: {patched.toLocaleString("en-AU")} patched &amp; verified {rows.length ? `(${(patched / rows.length * 100).toFixed(1)}%)` : "(N/A)"} · {rows.filter(row => row.daysOverdue > 0).length.toLocaleString("en-AU")} overdue actions</p></div>
      <div className="endpoint-total"><span>Servers in scope</span><strong>{rows.length.toLocaleString("en-AU")}</strong><small>Snapshot · {snapshotDate}</small></div></header>
    <div className="patch-view-toolbar">
      <div className="endpoint-summary-caption"><span>Server maintenance at a glance</span><span>Click a chart bar to filter · Counts respect other filters</span></div>
      <WorkspaceTabs id="patch-explorer" label="Patch management views" tabs={PATCH_VIEWS} active={view} onChange={setView} />
    </div>
    <section id={`patch-explorer-panel-${view}`} role="tabpanel" aria-labelledby={`patch-explorer-tab-${view}`} className="patch-table-panel">
      {exportError && <p role="alert" className="endpoint-export-error">{exportError}</p>}
      <FindingsDataTable key={view} title="Server patch records" rows={rows} columns={columns} initialFilters={filters[view]}
        summaryCharts={charts[view]} summaryTitle=""
        searchText={patchSearchText}
        onFiltersChange={handleFiltersChange} className="patch-results inventory-results"
        emptyMessage="No servers are recorded for this scope and snapshot."
        actions={matching => <button type="button" className="endpoint-export" onClick={exportRows} disabled={exporting || !matching.length}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5" /></svg>
          {exporting ? "Exporting..." : "Export Excel"}</button>}
        renderRow={row => <tr key={row.assetId}>{columns.map(({ key }) => <td key={key} className={key === "serverName" ? "endpoint-name" : ""}>
          {key === "serverName" ? <><CmdbDeviceName assetId={row.assetId} name={row.serverName} /><small>{row.assetId}</small></>
            : key === "status" ? <span className="patch-status" data-status={row.status}>{row.status}</span>
            : key === "daysOverdue" && row.daysOverdue > 0 ? <strong className="patch-overdue">{row.daysOverdue}</strong> : patchValue(row, key as PatchColumn)}
        </td>)}</tr>} />
    </section>
    <details className="explorer-guidance">
      <summary>Patch evidence and export details</summary>
      <p>Patched requires current assessment evidence, zero missing security/critical updates, a successful installation verified after patching and no required restart. A patch-level label alone is not proof. Due dates and evidence validity come from the recorded policy; exceptions do not remove overdue actions. Uptime is informational. CVE observations include all installed software and do not establish that an OS patch is missing. Excel exports every matching server with fields from all three views.</p>
    </details>
  </div>;
}
