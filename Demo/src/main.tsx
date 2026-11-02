import React, { Component, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import MeasuresPage from "@/app/measures/page";
import FindingsPage from "@/app/findings/page";
import DiscoveryPage from "@/app/discovery-coverage/page";
import NetworkPage from "@/app/network-risk-profile/page";
import SystemPage from "@/app/ict-system-risk-profile/page";
import ImpactPage from "@/app/cyber-cop/page";
import ReportPage from "@/app/report/page";
import SettingsPage from "@/app/settings/page";
import { WorkspaceShell } from "@/components/workspace-shell";
import { WorkspaceFilters } from "@/components/workspace-filters";
import { CmdbDrillThroughProvider } from "@/components/cmdb-drill-through";
import { SettingsPopup } from "./settings-popup";
import { demoPackage } from "./package";
import { currentUrl, useLocationVersion, router, demoHref } from "./navigation";
import { NextRequest } from "./server";
import { dispatch } from "demo:api";

const pages = new Map<string, (props: { searchParams: Record<string, string> }) => ReactNode | Promise<ReactNode>>([
  ["/measures", MeasuresPage], ["/findings", FindingsPage], ["/discovery-coverage", DiscoveryPage],
  ["/network-risk-profile", NetworkPage], ["/ict-system-risk-profile", SystemPage],
  ["/cyber-cop", ImpactPage], ["/report", ReportPage], ["/settings", SettingsPage]
]);
const latestDate = demoPackage().snapshots.at(-1)!.date;
if (!window.location.hash.startsWith("#/")) router.replace("/measures?network=net-1&dataDate=" + latestDate);
window.fetch = async (input, init) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, "https://demo.local");
  if (url.origin !== "https://demo.local" || !url.pathname.startsWith("/api/")) throw new Error("The offline demo cannot request: " + raw);
  if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const request = new NextRequest(url, init);
  return dispatch(request);
};
let notifyDownload: (message: string) => void = () => {};
async function download(href: string) {
  notifyDownload("Generating report…");
  try {
    const response = await fetch(href);
    if (!response.ok) throw new Error(await response.text());
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? "TSAAT-demo-report";
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    notifyDownload("Report downloaded.");
  } catch (error) { notifyDownload("Report could not be generated: " + String(error)); }
}
document.addEventListener("click", event => {
  const anchor = (event.target as Element).closest?.("a");
  if (!anchor || event.defaultPrevented || anchor.hasAttribute("download")) return;
  const href = anchor.getAttribute("href") ?? "";
  let path = href.startsWith("/") ? href : href.includes("#/") ? href.slice(href.indexOf("#/") + 1) : "";
  if (!path) return;
  if (path.startsWith("/api/")) { event.preventDefault(); void download(path); return; }
  if (anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey) { anchor.href = demoHref(path); return; }
  event.preventDefault(); router.push(path);
});
class PageBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <div role="alert" className="panel p-6"><h2>Unable to display this view</h2><p>{this.state.error}</p></div> : this.props.children; }
}
function DemoApp() {
  const revision = useLocationVersion();
  const [page, setPage] = useState<ReactNode>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");
  notifyDownload = setDownloadMessage;
  const url = currentUrl();
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    const pageFunction = pages.get(currentUrl().pathname);
    const params = Object.fromEntries(currentUrl().searchParams);
    Promise.resolve().then(() => { if (!pageFunction) throw new Error("Unknown demo page."); return pageFunction({ searchParams: params }); })
      .then(result => { if (active) setPage(result); }).catch(e => { if (active) setError(String(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  return <><div className="app-bg" /><div className="topography-overlay" /><div className="app-workspace-shell">
    <header className="workspace-header no-print"><div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-3"><img src={demoPackage().logo} width={48} height={48} alt="TSAAT logo" className="h-12 w-12 object-contain" /><div><p className="text-xl tracking-widest">TSAAT</p><p className="text-xs text-slate-300">Offline demo · Sample data</p></div></div>
      <div className="workspace-header-controls"><WorkspaceFilters dataDate={url.searchParams.get("dataDate") ?? latestDate} />
      <label className="workspace-date"><span className="workspace-field-label">Snapshot</span><select aria-label="Data date" value={url.searchParams.get("dataDate") ?? latestDate} onChange={event => {
        const next = currentUrl(); next.searchParams.set("dataDate", event.target.value); router.push(next.pathname + next.search);
      }}>{demoPackage().snapshots.map(item => <option key={item.date} value={item.date}>{item.date}</option>)}</select></label>
      <button className="rounded border border-sky-300/40 px-4 py-2" onClick={() => setSettings(true)}>Menu / Settings</button></div>
    </div></header>
    <WorkspaceShell><CmdbDrillThroughProvider><PageBoundary key={revision}>
      {loading ? <div className="panel p-6" role="status">Loading view…</div> : error ? <div className="panel p-6" role="alert">{error}</div> : <div data-demo-ready={url.pathname} data-demo-query={url.pathname + url.search}>{page}</div>}
    </PageBoundary></CmdbDrillThroughProvider></WorkspaceShell>
  </div>{downloadMessage && <div role="status" className="demo-toast"><span>{downloadMessage}</span><button aria-label="Dismiss report status" onClick={() => setDownloadMessage("")}>×</button></div>}
  {settings && <SettingsPopup onClose={() => setSettings(false)} />}</>;
}
createRoot(document.getElementById("root")!).render(<DemoApp />);
