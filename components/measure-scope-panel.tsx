"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { FindingsDataTable } from "@/components/findings-data-table";
import type { ExplorerColumn } from "@/lib/explorer-table";
import type { MeasureScopeItem } from "@/lib/measures-explorer";

const scopeColumns: ExplorerColumn<MeasureScopeItem>[] = [
  { key: "name", label: "Name", value: (item) => item.name },
  { key: "id", label: "ID", value: (item) => item.id },
  { key: "atoNumber", label: "ATO", value: (item) => item.atoNumber?.trim() || "Not provided" },
  { key: "diisId", label: "DIIS", value: (item) => item.diisId?.trim() || "Not provided" }
];

export function MeasureScopePanel({ indicatorId, mode = "kpi", kind, items, onClose }: {
  indicatorId: string; mode?: "kpi" | "spi"; kind: "ictSystems" | "networks"; items: MeasureScopeItem[]; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const label = kind === "ictSystems" ? "ICT Systems" : "Networks";
  const columns = useMemo(() => kind === "ictSystems" ? scopeColumns : scopeColumns.slice(0, 2), [kind]);
  const rows = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), [items]);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialogRef} className={`measure-scope-panel${kind === "ictSystems" ? " measure-scope-panel-systems" : ""}`} aria-labelledby="measure-scope-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')]
        .filter((control) => !control.matches(":disabled") && control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="measure-scope-content">
      <header><div><p className="endpoint-eyebrow">{indicatorId} / In scope</p><h2 id="measure-scope-title">{label} <span>{items.length.toLocaleString("en-AU")}</span></h2></div>
        <button type="button" onClick={onClose} aria-label={`Close ${label} panel`}>Close</button></header>
      <p>{mode === "spi"
        ? kind === "ictSystems" ? "ICT systems associated with the CIs assessed by this SPI. Each system is listed once; compliance is calculated per CI." : "Managed networks containing the CIs assessed by this SPI. Each network is listed once; compliance is calculated per CI."
        : kind === "ictSystems" ? "Each ICT system is counted once in this KPI's compliance calculation." : "Managed networks in the selected scope. Compliance is calculated for ICT systems using their infrastructure."}</p>
      <FindingsDataTable key={kind} title={label} rows={rows} columns={columns} className="measure-scope-table"
        defaultPageSize={25} pageSizeOptions={[10, 25, 50, 100]} emptyMessage={`No ${label.toLowerCase()} in scope.`}
        renderRow={(item) => <tr key={item.id}>{columns.map((column) => <td key={column.key}>{column.value(item)}</td>)}</tr>} />
    </div>
  </dialog>, document.body);
}
