"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { DatabaseSettingsPanel } from "@/components/database-settings-panel";
import { PasswordSettingsPanel } from "@/components/password-settings-panel";
import { SettingsTabs, type SettingsTabId } from "@/components/settings-tabs";
import { MeasuresSettingsMatrix } from "@/components/measures-settings-matrix";
import { DiscoveryToolsSettingsPanel } from "@/components/discovery-tools-settings-panel";
import type { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";

type SpiRiskSettings = ComponentProps<typeof MeasuresSettingsMatrix>;

type DatabaseSettings = ComponentProps<typeof DatabaseSettingsPanel>["initialSettings"];

export function SettingsPopup({ onClose, initialTab = "database-settings" }: {
  onClose: () => void;
  initialTab?: SettingsTabId;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [settings, setSettings] = useState<DatabaseSettings | null>(null);
  const [discoverySettings, setDiscoverySettings] = useState<DiscoveryToolsSettings | null>(null);
  const [spiRiskSettings, setSpiRiskSettings] = useState<SpiRiskSettings | null>(null);
  const [spiRiskError, setSpiRiskError] = useState("");
  const [spiRiskRetry, setSpiRiskRetry] = useState(0);
  const [discoveryError, setDiscoveryError] = useState("");
  const [discoveryRetry, setDiscoveryRetry] = useState(0);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

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
    const controller = new AbortController();
    setError("");
    fetch("/api/settings/database", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load database settings.");
        const payload = await response.json() as { settings: DatabaseSettings };
        if (!controller.signal.aborted) setSettings(payload.settings);
      })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [retry]);

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

  useEffect(() => {
    if (activeTab !== "spi-risk-matrix" || spiRiskSettings) return;
    const controller = new AbortController();
    setSpiRiskError("");
    fetch("/api/measures/settings", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load SPI risk matrix settings.");
        const payload = await response.json() as Omit<SpiRiskSettings, "initialSettings"> & { settings: SpiRiskSettings["initialSettings"] };
        if (!controller.signal.aborted) setSpiRiskSettings({ initialSettings: payload.settings,
          spiDefinitions: payload.spiDefinitions, severityDefinitions: payload.severityDefinitions, priorityDefinitions: payload.priorityDefinitions });
      })
      .catch((reason: Error) => { if (!controller.signal.aborted) setSpiRiskError(reason.message); });
    return () => controller.abort();
  }, [activeTab, spiRiskSettings, spiRiskRetry]);

  if (!mounted) return null;
  return createPortal(
    <dialog ref={dialogRef} className="settings-popup" aria-labelledby="settings-popup-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="settings-popup-frame">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-sky-300/20 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Application configuration</p>
            <h2 id="settings-popup-title" className="mt-1 text-2xl font-semibold">Settings</h2>
          </div>
          <button type="button" autoFocus onClick={onClose} className="rounded border border-sky-300/35 px-3 py-2 text-sm hover:bg-sky-500/10" aria-label="Close settings">Close</button>
        </header>
        <div className="shrink-0 px-5 pt-4"><SettingsTabs activeTab={activeTab} onSelect={setActiveTab} /></div>
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div role="tabpanel" id="settings-panel-database-settings" aria-labelledby="settings-tab-database-settings" hidden={activeTab !== "database-settings"}>
            {settings ? <DatabaseSettingsPanel initialSettings={settings} /> : error ? (
              <div className="panel p-5"><p role="alert">{error}</p><button type="button" className="mt-3 rounded border border-sky-300/35 px-3 py-2" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>
            ) : <p role="status" className="flex items-center gap-3 p-5"><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />Loading settings...</p>}
          </div>
          <div role="tabpanel" id="settings-panel-password-settings" aria-labelledby="settings-tab-password-settings" hidden={activeTab !== "password-settings"}>
            <PasswordSettingsPanel />
          </div>
          <div role="tabpanel" id="settings-panel-discovery-tools-settings" aria-labelledby="settings-tab-discovery-tools-settings" hidden={activeTab !== "discovery-tools-settings"} className="h-full min-h-[420px]">
            {discoverySettings ? <DiscoveryToolsSettingsPanel initialSettings={discoverySettings} /> : discoveryError ? (
              <div className="panel p-5"><p role="alert">{discoveryError}</p><button type="button" className="mt-3 rounded border border-sky-300/35 px-3 py-2" onClick={() => setDiscoveryRetry((value) => value + 1)}>Retry</button></div>
            ) : <p role="status" className="p-5">Loading discovery tools settings...</p>}
          </div>
          <div role="tabpanel" id="settings-panel-spi-risk-matrix" aria-labelledby="settings-tab-spi-risk-matrix" hidden={activeTab !== "spi-risk-matrix"} className="h-full min-h-[360px]">
            {spiRiskSettings ? <MeasuresSettingsMatrix {...spiRiskSettings} /> : spiRiskError ? (
              <div className="panel p-5"><p role="alert">{spiRiskError}</p><button type="button" className="mt-3 rounded border border-sky-300/35 px-3 py-2" onClick={() => setSpiRiskRetry((value) => value + 1)}>Retry</button></div>
            ) : <p role="status" className="p-5">Loading SPI risk matrix settings...</p>}
          </div>
        </div>
      </div>
    </dialog>, document.body
  );
}
