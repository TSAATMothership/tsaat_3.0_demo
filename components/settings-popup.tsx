"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SettingsTabs, type SettingsTabId } from "@/components/settings-tabs";
import { DiscoveryToolsSettingsPanel } from "@/components/discovery-tools-settings-panel";
import { PersonasSettingsPanel } from "@/components/personas-settings-panel";
import type { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";


export function SettingsPopup({ onClose, initialTab = "personas" }: {
  onClose: () => void;
  initialTab?: SettingsTabId;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [discoverySettings, setDiscoverySettings] = useState<DiscoveryToolsSettings | null>(null);
  const [discoveryError, setDiscoveryError] = useState("");
  const [discoveryRetry, setDiscoveryRetry] = useState(0);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!mounted || !dialog) return;
    // Native modal dialogs keep focus inside and make the workspace inert.
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  useEffect(() => {
    if (activeTab !== "discovery-tools-settings" || discoverySettings) return;
    const controller = new AbortController();
    setDiscoveryError("");
    fetch("/api/discovery-tools/settings", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load discovery tools settings.");
        const payload = await response.json() as { settings: DiscoveryToolsSettings };
        if (!controller.signal.aborted) setDiscoverySettings(payload.settings);
      })
      .catch((reason: Error) => { if (!controller.signal.aborted) setDiscoveryError(reason.message); });
    return () => controller.abort();
  }, [activeTab, discoverySettings, discoveryRetry]);

  if (!mounted) return null;
  return createPortal(
    <dialog ref={dialogRef} className={`settings-popup${activeTab === "personas" ? " is-personas" : ""}`} aria-labelledby="settings-popup-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="settings-popup-frame">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-sky-300/20 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Application configuration</p>
            <h2 id="settings-popup-title" className="mt-1 text-2xl font-semibold">Settings</h2>
          </div>
          <button type="button" autoFocus onClick={onClose} className="rounded border border-sky-300/35 px-3 py-2 text-sm hover:bg-sky-500/10" aria-label="Close settings">Close</button>
        </header>
        <div className="settings-popup-tabs shrink-0 px-5 pt-4"><SettingsTabs activeTab={activeTab} onSelect={setActiveTab} /></div>
        <div className="settings-popup-body min-h-0 flex-1 overflow-auto p-5">
          <div role="tabpanel" id="settings-panel-personas" aria-labelledby="settings-tab-personas" hidden={activeTab !== "personas"}>
            <PersonasSettingsPanel />
          </div>
          <div role="tabpanel" id="settings-panel-discovery-tools-settings" aria-labelledby="settings-tab-discovery-tools-settings" hidden={activeTab !== "discovery-tools-settings"} className="h-full min-h-[420px]">
            {discoverySettings ? <DiscoveryToolsSettingsPanel initialSettings={discoverySettings} /> : discoveryError ? (
              <div className="panel p-5"><p role="alert">{discoveryError}</p><button type="button" className="mt-3 rounded border border-sky-300/35 px-3 py-2" onClick={() => setDiscoveryRetry((value) => value + 1)}>Retry</button></div>
            ) : <p role="status" className="p-5">Loading discovery tools settings...</p>}
          </div>
        </div>
      </div>
    </dialog>, document.body
  );
}
