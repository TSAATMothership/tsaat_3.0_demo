"use client";

import React, { useEffect, useId, useRef } from "react";

export const DEFAULT_LOADING_MESSAGE = "Applying filters...";
export const DEFAULT_LOADING_INITIAL_PROGRESS = 8;

export function nextLoadingProgressValue(current: number): number {
  if (current >= 92) {
    return current + 1;
  }
  if (current >= 78) {
    return current + 2;
  }
  if (current >= 55) {
    return current + 3;
  }
  return current + 5;
}

export function LoadingOverlay({
  progress,
  message,
  className = "fixed inset-0 z-[9999]",
  blocking = false,
  onCancel,
  cancelling = false
}: {
  progress: number;
  message: string;
  className?: string;
  blocking?: boolean;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const messageId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!blocking || !dialog) return;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [blocking]);

  const pane = (
    <div className={`${className} cursor-wait bg-slate-950/60`}>
      <div className="absolute left-1/2 top-1/2 w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-sky-300/35 bg-slate-900 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.7)]">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-200">Loading</p>
          <p className="mt-1 text-2xl font-semibold text-sky-100">{progress}%</p>
        </div>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-700" role="progressbar"
          aria-label="Loading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div
            className="h-full rounded-full bg-sky-300 transition-[width] duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-5 flex items-center justify-center gap-3 text-xs text-slate-200">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-cyan-100" />
          <span id={messageId} role="status">{message}</span>
        </div>
        {onCancel && <div className="mt-5 text-center">
          <button type="button" autoFocus onClick={onCancel} disabled={cancelling}
            className="cursor-pointer rounded-md border border-sky-300/40 px-4 py-2 text-sm text-sky-100 hover:bg-sky-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-200 disabled:cursor-wait disabled:opacity-60">
            {cancelling ? "Cancelling..." : "Cancel"}
          </button>
        </div>}
      </div>
    </div>
  );
  return blocking ? (
    <dialog ref={dialogRef} className="loading-modal" aria-label="Loading view" aria-describedby={messageId}
      onCancel={(event) => { event.preventDefault(); if (!cancelling) onCancel?.(); }}>
      {pane}
    </dialog>
  ) : pane;
}
