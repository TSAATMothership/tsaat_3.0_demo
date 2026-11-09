"use client";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cancelDocumentGeneration, dismissDocumentGeneration, getDocumentGenerationState, getServerDocumentGenerationState, retryDocumentGeneration, subscribeToDocumentGeneration } from "@/lib/documents/client";

const stages = ["loading", "preparing", "generating", "saving"] as const;
const labels = ["Load evidence", "Prepare layout", "Generate document", "Save download"];

export function DocumentGenerationDialog() {
  const state = useSyncExternalStore(subscribeToDocumentGeneration, getDocumentGenerationState, getServerDocumentGenerationState);
  const dialog = useRef<HTMLDialogElement>(null), origin = useRef<HTMLElement | null>(null);
  const titleId = useId(), detailId = useId(), open = state.active || Boolean(state.error);
  useEffect(() => {
    const node = dialog.current;
    if (!node || !open) return;
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!node.open) node.showModal();
    return () => { node.close(); const trigger = origin.current; if (trigger?.isConnected) window.requestAnimationFrame(() => trigger.focus()); };
  }, [open]);
  const progress = state.progress;
  if (!open || !progress) return state.progress?.stage === "complete" ? <span className="sr-only" role="status">Your document has been downloaded.</span> : null;
  const step = stages.indexOf(progress.stage as typeof stages[number]);
  const measured = progress.total !== undefined && progress.completed !== undefined && progress.total > 0;
  return createPortal(<dialog ref={dialog} className="document-generation-dialog" aria-labelledby={titleId} aria-describedby={detailId}
    onCancel={event => { event.preventDefault(); if (state.active) cancelDocumentGeneration(); else dismissDocumentGeneration(); }}>
    <div className="document-generation-content">
      <div className={`document-generation-icon${state.error ? " is-error" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 5h16l8 9v29H13zM29 5v10h8M19 23h12M19 29h12M19 35h8" /></svg>
        {!state.error && <span className="document-generation-orbit" />}
      </div>
      <p className="document-generation-eyebrow">TSAAT / Document export</p>
      <h2 id={titleId}>{state.error ? "Document unavailable" : "Generating Document"}</h2>
      <p className="document-generation-title">{progress.title}</p>
      {!state.error && <ol className="document-generation-stages" aria-label="Document generation stages">
        {labels.map((label, index) => <li key={label} className={index < step ? "is-complete" : index === step ? "is-current" : ""} aria-current={index === step ? "step" : undefined}>
          <span aria-hidden="true">{index < step ? "✓" : index + 1}</span>{label}
        </li>)}
      </ol>}
      <p id={detailId} role={state.error ? "alert" : "status"} aria-live="polite" className="document-generation-detail">{state.error || progress.message}</p>
      {!state.error && <div className="document-generation-track" role="progressbar" aria-label="Document generation progress"
        aria-valuemin={measured ? 0 : undefined} aria-valuemax={measured ? progress.total : undefined} aria-valuenow={measured ? progress.completed : undefined}
        aria-valuetext={measured ? `${progress.completed} of ${progress.total}: ${progress.message}` : progress.message}>
        <span className={measured ? "is-measured" : "is-indeterminate"} style={measured ? { width: `${Math.min(100, Math.max(0, progress.completed! / progress.total! * 100))}%` } : undefined} />
      </div>}
      <div className="document-generation-actions">{state.error ? <>
        <button type="button" autoFocus className="endpoint-export" onClick={() => void retryDocumentGeneration()}>Try again</button>
        <button type="button" onClick={dismissDocumentGeneration}>Close</button>
      </> : <button type="button" autoFocus onClick={cancelDocumentGeneration}>Cancel</button>}</div>
    </div>
  </dialog>, document.body);
}
