"use client";
import { useEffect, useState } from "react";
interface StoreInfo { provider: string; directory: string; snapshots: Array<{ id: number; date: string; file: string }> }
export function JsonStorageSettingsPanel() {
  const [info, setInfo] = useState<StoreInfo | null>(null), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings/storage", { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Unable to read JSON data store information.");
      const value = await response.json() as StoreInfo; if (!controller.signal.aborted) setInfo(value);
    }).catch(reason => { if (!controller.signal.aborted) setError(String(reason)); });
    return () => controller.abort();
  }, []);
  return <section className="panel space-y-4 p-5">
    <h2 className="text-lg font-semibold">JSON Data Files</h2>
    <p className="text-sm text-slate-300">This is the No-SQL build. Data and saved settings are stored on the app server as JSON files.</p>
    {error ? <p role="alert">{error}</p> : !info ? <p role="status">Loading data store…</p> : <>
      <dl className="space-y-3 text-sm"><div><dt className="text-slate-400">Data directory</dt><dd className="break-all">{info.directory}</dd></div>
        <div><dt className="text-slate-400">Snapshots available</dt><dd>{info.snapshots.length}</dd></div>
        <div><dt className="text-slate-400">Latest snapshot</dt><dd>{info.snapshots.at(-1)?.date}</dd></div></dl>
      <p className="text-sm text-slate-300">Risk, priority and discovery settings saved here apply to all users of this data store and persist after restart. Back up the data directory before replacing data files.</p>
    </>}
  </section>;
}
