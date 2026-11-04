"use client";

import { useEffect, useRef, useState } from "react";

export function GovernanceInsightsReportButton({ href, snapshotDate }: { href: string; snapshotDate: string }) {
  const inFlight = useRef(false);
  const button = useRef<HTMLButtonElement>(null), returnFocus = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    if (busy || !returnFocus.current) return;
    returnFocus.current = false;
    if (document.activeElement === document.body) button.current?.focus();
  }, [busy]);
  async function download() {
    if (inFlight.current) return;
    returnFocus.current = document.activeElement === button.current;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(href, { cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw new Error("PDF unavailable");
      const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
      link.href = url; link.download = `cyber-terrain-insights-${snapshotDate}.pdf`;
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("Unable to generate the Insights PDF. Please try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="insight-report-download" aria-busy={busy}>
    <button ref={button} type="button" className="endpoint-export" data-insights-report={href} disabled={busy} onClick={download}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>
      {busy ? "Generating PDF..." : "Generate PDF"}
    </button>
    <span role="status" className="sr-only">{busy ? "Generating Cyber Terrain Posture PDF" : ""}</span>
    {error && <p role="alert">{error}</p>}
  </div>;
}
