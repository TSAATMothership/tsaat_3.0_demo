"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-3 rounded-md border border-sky-300/40 bg-slate-900/70 px-4 py-2 text-sm text-slate-100"
    >
      Print / Save PDF
    </button>
  );
}
