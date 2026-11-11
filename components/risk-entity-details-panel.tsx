"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { RiskEntityDetailsModel } from "@/lib/risk-entity-details";

const number = (value: number) => value.toLocaleString("en-AU");

function RecordLink({ url, children }: { url: string; children: string }) {
  let href: string | undefined;
  try { const parsed = new URL(url); if (["https:", "http:"].includes(parsed.protocol)) href = parsed.toString(); } catch { /* Missing or invalid stored URL. */ }
  return href ? <a href={href} target="_blank" rel="noreferrer">{children} <span aria-hidden="true">↗</span></a> : <span className="network-details-empty">Not provided</span>;
}

export function RiskEntityDetailsPanel({ details, entityLabel, snapshotDate, onClose, children, appId }: {
  details: RiskEntityDetailsModel; entityLabel: "Network" | "ICT System"; snapshotDate: string; onClose: () => void; children: ReactNode;
  appId?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = overflow; trigger?.focus(); };
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(<dialog ref={dialogRef} className={`measure-scope-panel network-details-panel${entityLabel === "ICT System" ? " ict-system-details-panel" : ""}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); return; }
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')]
        .filter(control => !control.matches(":disabled") && control.getClientRects().length > 0);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <div className="measure-scope-content">
      <header><div><p className="endpoint-eyebrow">{entityLabel} Details</p><h2 id={titleId}>{details.name}</h2>
        <p className="network-details-meta">{details.id} · Security Domain: {details.securityDomain} · Snapshot {snapshotDate}</p></div>
        <button type="button" autoFocus onClick={onClose} aria-label={`Close ${entityLabel} Details panel`}>Close</button></header>
      <div className={`network-details-body${appId !== undefined ? " network-details-with-app-id" : ""}`}>
        <section className="network-details-card network-details-wide"><h3>{entityLabel} Description</h3><p className="network-details-description">{details.description || "No description recorded."}</p></section>
        <section className="network-details-card network-details-wide"><h3>Operational Contacts</h3>
          <dl className="network-details-fields"><div><dt>Owner</dt><dd>{details.owner || "Not provided"}</dd></div>
            <div><dt>Support Email</dt><dd>{details.supportEmail
              ? <a href={`mailto:${encodeURIComponent(details.supportEmail)}`}>{details.supportEmail}</a> : "Not provided"}</dd></div>
            <div><dt>Service Catalogue</dt><dd><RecordLink url={details.serviceCatalogueUrl}>Open service catalogue</RecordLink></dd></div></dl>
        </section>
        <section className="network-details-card"><h3>ATO Details</h3><dl>
          <div><dt>ATO Number</dt><dd>{details.atoNumber || "Not provided"}</dd></div>
        </dl></section>
        <section className="network-details-card"><h3>DIIS Details</h3><dl>
          <div><dt>DIIS Number</dt><dd>{details.diisId || "Not provided"}</dd></div>
        </dl></section>
        {appId !== undefined && <section className="network-details-card"><h3>APP-ID</h3><dl>
          <div><dt>APP-ID Number</dt><dd>{appId || "Not provided"}</dd></div>
        </dl></section>}
        {children}
        <section className="network-details-card network-details-wide"><h3>Asset Footprint Summary <span>{number(details.assetCount)} CIs</span></h3>
          <p className="network-details-note">Devices belonging to this {entityLabel === "Network" ? "network" : "ICT system"} within the selected scope and snapshot.</p>
          <dl className="network-details-footprint">{details.assetFootprint.map(item => <div key={item.type}><dt>{item.label}</dt><dd>{number(item.count)}</dd></div>)}</dl>
        </section>
      </div>
    </div>
  </dialog>, document.body);
}
