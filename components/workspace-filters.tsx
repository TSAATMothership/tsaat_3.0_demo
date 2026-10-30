"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { scopeIds, updateWorkspaceScope, workspaceLocationForScope } from "@/lib/workspace-navigation";

interface Option { id: string; label: string }
interface Options { networks: Option[]; systems: Option[] }

function ScopeSelect({ label, options, selected, pending, loading, error, onChange, allowSelectAll = false }: {
  label: string; options: Option[]; selected: string[]; pending: boolean; loading: boolean; error: string;
  onChange: (ids: string[]) => void;
  allowSelectAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const dismiss = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);
  const visible = options.filter((option) => `${option.label} ${option.id}`.toLowerCase().includes(query.toLowerCase().trim()));
  const summary = selected.length === 0 ? "none" : selected.length === 1 ? options.find((option) => option.id === selected[0])?.label ?? selected[0] : `${selected.length} selected`;
  const id = label === "Managed Network" ? "managed-network-options" : "ict-system-options";
  return <div className="workspace-scope-select" ref={container} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="workspace-scope-trigger" aria-expanded={open} aria-controls={id}
      aria-label={`${label}: ${summary}`} onClick={() => { setOpen(!open); setQuery(""); }}>
      <span className="min-w-0"><span className="workspace-field-label">{label}</span><span className="block truncate">{summary}</span></span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && <div id={id} className="workspace-scope-popover" role="group" aria-label={`${label} options`}>
      <input ref={search} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}...`} aria-label={`Search ${label}`} />
      <div className="flex items-center justify-between gap-3">
        <button type="button" className="workspace-scope-none" disabled={pending} onClick={() => onChange([])}>none — clear selection</button>
        {allowSelectAll && <button type="button" className="workspace-scope-none disabled:opacity-40"
          disabled={pending || loading || Boolean(error) || options.length === 0 || (selected.length === options.length && options.every((option) => selected.includes(option.id)))}
          title="Select all managed networks, including those hidden by the search"
          onClick={() => onChange(options.map((option) => option.id))}>Select All</button>}
      </div>
      <div className="workspace-scope-options" aria-busy={loading || pending}>
        {loading ? <p role="status">Loading options…</p> : error ? <p role="alert">{error}</p> : visible.length === 0 ? <p>No matches</p> : visible.map((option) => <label key={option.id}>
          <input type="checkbox" checked={selected.includes(option.id)} disabled={pending} onChange={(event) => onChange(event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id))} />
          <span>{option.label}</span>
        </label>)}
      </div>
      <p className="workspace-scope-help">Select multiple. Choosing this scope clears the other filter.</p>
    </div>}
  </div>;
}

export function WorkspaceFilters({ dataDate }: { dataDate: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [options, setOptions] = useState<Options>({ networks: [], systems: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/workspace-options?dataDate=${encodeURIComponent(dataDate)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Unable to load options. Try another date or check database settings."); return response.json() as Promise<Options>; })
      .then(setOptions)
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [dataDate]);
  const change = (kind: "network" | "system", ids: string[]) => {
    const params = updateWorkspaceScope(new URLSearchParams(searchParams?.toString()), kind, ids);
    params.set("dataDate", dataDate);
    const href = workspaceLocationForScope(pathname, params);
    startTransition(() => router.replace(href, { scroll: false }));
  };
  return <div className="flex min-w-0 flex-wrap gap-2" aria-busy={pending}>
    <ScopeSelect label="Managed Network" options={options.networks} selected={scopeIds(searchParams?.getAll("network"))} pending={pending} loading={loading} error={error} onChange={(ids) => change("network", ids)} allowSelectAll />
    <ScopeSelect label="ICT System" options={options.systems} selected={scopeIds(searchParams?.getAll("system"))} pending={pending} loading={loading} error={error} onChange={(ids) => change("system", ids)} />
    <span className="sr-only" role="status">{pending ? "Updating workspace" : ""}</span>
  </div>;
}
