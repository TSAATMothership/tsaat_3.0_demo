"use client";
import { useState } from "react";
export function DiscoveryOverviewReportButton({ href, snapshotDate }: { href: string; snapshotDate: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function download() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(href, { cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw Error("Unable to generate the report. Please retry.");
      const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
      link.href = url; link.download = "discovery-overview-" + snapshotDate + ".pdf";
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("Unable to generate the report. Please retry."); }
    finally { setBusy(false); }
  }
  return <div className="discovery-overview-report" aria-busy={busy}>
    <button type="button" className="endpoint-export" onClick={download} disabled={busy} data-overview-report={href}>
      {busy ? "Generating PDF..." : "Download overview PDF"}
    </button>
    <span role="status" className="sr-only">{busy ? "Generating Discovery Overview report" : ""}</span>
    {error && <p role="alert" className="endpoint-export-error">{error}</p>}
  </div>;
}
