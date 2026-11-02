import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SettingsTabId } from "@/components/settings-tabs";
import { MeasuresSettingsMatrix } from "@/components/measures-settings-matrix";
import { DiscoveryToolsSettingsPanel } from "@/components/discovery-tools-settings-panel";
import * as data from "./data-loader";
import { demoPackage } from "./package";
import { router } from "./navigation";
async function settingsData() {
  return { initialSettings: await data.loadMeasuresSettings(), spiDefinitions: await data.loadSpiDefinitions(),
    severityDefinitions: await data.loadSeverityDefinitions(), priorityDefinitions: await data.loadFindingPriorityDefinitions(), discovery: await data.loadDiscoveryToolsSettings() };
}
export function SettingsPopup({ onClose, initialTab }: { onClose: () => void; initialTab?: SettingsTabId }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState(initialTab ?? "demo-data");
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof settingsData>>>();
  const [error, setError] = useState("");
  useEffect(() => { settingsData().then(setSettings).catch(e => setError(String(e))); }, []);
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => element.close(); }, []);
  const tabs = [{ id: "demo-data", label: "Demo Data" }, { id: "discovery-tools-settings", label: "Discovery Tools" }, { id: "spi-risk-matrix", label: "SPI Risk Matrix" }, { id: "spi-priority-matrix", label: "SPI Priority Matrix" }];
  return createPortal(<dialog ref={dialog} className="settings-popup" aria-labelledby="demo-settings-title" onCancel={onClose} onClick={e => { if (e.target === dialog.current) onClose(); }}>
    <div className="settings-popup-frame">
      <div className="flex items-center justify-between border-b border-slate-500/30 p-5"><div><p className="text-xs uppercase text-sky-300">Offline demo</p><h2 id="demo-settings-title" className="text-2xl">Settings</h2></div><button className="rounded border px-4 py-2" onClick={onClose}>Close</button></div>
      <div className="flex flex-wrap gap-2 border-b border-slate-500/30 p-3" role="tablist" aria-label="Settings">
        {tabs.map(item => <button key={item.id} id={"settings-tab-" + item.id} role="tab" tabIndex={tab === item.id ? 0 : -1} aria-selected={tab === item.id} aria-controls={"settings-panel-" + item.id}
          className={"rounded px-4 py-2 " + (tab === item.id ? "bg-sky-900 text-white" : "text-slate-300")} onClick={() => setTab(item.id)} onKeyDown={event => {
            const index = tabs.findIndex(value => value.id === item.id);
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : -1;
            if (next < 0) return;
            event.preventDefault(); setTab(tabs[next].id);
            document.getElementById("settings-tab-" + tabs[next].id)?.focus();
          }}>{item.label}</button>)}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {error && <p role="alert">{error}</p>}
        {tab === "demo-data" && <div id="settings-panel-demo-data" role="tabpanel" aria-labelledby="settings-tab-demo-data" className="panel space-y-4 p-6">
          <h3 className="text-xl">TSAAT standalone demo</h3>
          <p>This copy uses synthetic JSON data packaged in the HTML file. It runs entirely in this browser, including calculations and PDF/workbook downloads.</p>
          <p>{demoPackage().snapshots.length} snapshots, ending {demoPackage().snapshots.at(-1)?.date}. No SQL connection or sign-in is required.</p>
          <p>Saved risk, priority and discovery settings affect this demo immediately. They are stored only in this browser and do not change the operational app.</p>
          <p>{data.storageNotice || "Settings persist in this browser when local storage is available. Moving the file or using another browser may create a separate settings store."}</p>
          <button className="rounded border border-sky-300/50 px-4 py-2" onClick={async () => { data.resetDemoSettings(); setSettings(await settingsData()); router.refresh(); }}>Reset demo settings</button>
        </div>}
        {!settings && !error && <p role="status">Loading settings…</p>}
        {settings && <><div id="settings-panel-discovery-tools-settings" role="tabpanel" aria-labelledby="settings-tab-discovery-tools-settings" hidden={tab !== "discovery-tools-settings"}><DiscoveryToolsSettingsPanel key={settings.discovery.updatedAt} initialSettings={settings.discovery} /></div>
          <MeasuresSettingsMatrix key={settings.initialSettings.updatedAt} {...settings} activeMatrix={tab === "spi-risk-matrix" ? "severity" : tab === "spi-priority-matrix" ? "priority" : null} /></>}
      </div>
    </div>
  </dialog>, document.body);
}
