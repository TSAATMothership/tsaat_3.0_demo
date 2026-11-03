"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { activeWorkspaceItem, sameWorkspaceScope, scopeIds, updateWorkspaceScope, workspaceHref, workspaceScopeUpdateHref } from "@/lib/workspace-navigation";
import { buildLocationKey } from "@/lib/location-key";
import { startRouteLoading } from "@/lib/route-loading";
import { matchesSecurityDomain, SECURITY_DOMAINS, securityDomainSelection, type SecurityDomain } from "@/lib/security-domain.mjs";

interface Option { id: string; label: string; securityDomain?: SecurityDomain }
interface Options { networks: Option[]; systems: Option[] }
type ScopeKind = "network" | "system" | "securityDomain";
interface ScopeDraft { locationKey: string; query: string; edited: ScopeKind }

function ScopeSelect({ label, options, selected, pending, loading, error, onChange, onUpdate, allowSelectAll = false }: {
  label: string; options: Option[]; selected: string[]; pending: boolean; loading: boolean; error: string;
  onChange: (ids: string[]) => void;
  onUpdate?: () => void;
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
  const allSelected = selected.length === options.length && options.every(option => selected.includes(option.id));
  const visible = options.filter((option) => `${option.label} ${option.id}`.toLowerCase().includes(query.toLowerCase().trim()));
  const summary = selected.length === 0 ? "none" : selected.length === 1 ? options.find((option) => option.id === selected[0])?.label ?? selected[0] : `${selected.length} selected`;
  const id = label === "Managed Network" ? "managed-network-options" : label === "Security Domain" ? "security-domain-options" : "ict-system-options";
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
        {allowSelectAll && <button type="button" className="workspace-scope-none disabled:opacity-40 aria-disabled:opacity-40"
          disabled={pending || loading || Boolean(error) || options.length === 0} aria-disabled={allSelected || undefined}
          title={`Select all ${label.toLowerCase()} options, including those hidden by the search`}
          onClick={() => { if (!allSelected) onChange(options.map((option) => option.id)); }}>Select All</button>}
      </div>
      <div className="workspace-scope-options" aria-busy={loading || pending}>
        {loading ? <p role="status">Loading options…</p> : error ? <p role="alert">{error}</p> : visible.length === 0 ? <p>No matches</p> : visible.map((option) => <label key={option.id}>
          <input type="checkbox" checked={selected.includes(option.id)} disabled={pending} onChange={(event) => onChange(event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id))} />
          <span>{option.label}</span>
        </label>)}
      </div>
      {onUpdate && <div className="workspace-scope-update-row">
        <span role="status">Changes not applied</span>
        <button type="button" className="workspace-scope-update" disabled={pending}
          aria-label={`Update ${label} filter`} onClick={() => {
            onUpdate();
            setOpen(false);
            trigger.current?.focus();
          }}>Update</button>
      </div>}
      <p className="workspace-scope-help">{label === "Security Domain" ? "Select multiple. Applies alongside the network or ICT system scope." : "Select multiple. Choosing this scope clears the other scope filter."}</p>
    </div>}
  </div>;
}

export function WorkspaceFilters({ dataDate }: { dataDate: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const query = searchParams?.toString() ?? "";
  const locationKey = buildLocationKey(pathname, query);
  const appliedParams = new URLSearchParams(query);
  const [draft, setDraft] = useState<ScopeDraft | null>(null);
  // Discard unapplied edits after navigation, Back/Forward, or a date change.
  if (draft && draft.locationKey !== locationKey) setDraft(null);
  const currentDraft = draft?.locationKey === locationKey ? draft : null;
  const selectedParams = new URLSearchParams(currentDraft?.query ?? query);
  const selectedDomains = securityDomainSelection(selectedParams.has("securityDomain") ? selectedParams.getAll("securityDomain") : undefined);
  const [pending, startTransition] = useTransition();
  const [options, setOptions] = useState<Options>({ networks: [], systems: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/workspace-options?dataDate=${encodeURIComponent(dataDate)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Unable to load options. Try another date or check database settings."); return response.json() as Promise<Options>; })
      .then((nextOptions) => { if (!controller.signal.aborted) setOptions(nextOptions); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [dataDate]);
  const change = (kind: ScopeKind, ids: string[]) => {
    const params = updateWorkspaceScope(selectedParams, kind, ids);
    if (sameWorkspaceScope(params, selectedParams)) return;
    params.set("dataDate", dataDate);
    if (activeWorkspaceItem(pathname, appliedParams)) {
      setDraft(sameWorkspaceScope(params, appliedParams) ? null : { locationKey, query: params.toString(), edited: kind });
      return;
    }
    // Before a sidebar view is selected, keep the workspace empty.
    startTransition(() => router.replace(workspaceHref("/", params), { scroll: false }));
  };
  const applyDraft = () => {
    if (!currentDraft || pending) return;
    const href = workspaceScopeUpdateHref(pathname, selectedParams);
    const cancelHref = window.location.pathname + window.location.search + window.location.hash;
    startRouteLoading({ href, cancelHref, message: "Updating workspace filters..." });
    startTransition(() => router.replace(href, { scroll: false }));
  };
  return <div className="flex min-w-0 flex-wrap gap-2" aria-busy={pending}>
    <ScopeSelect label="Security Domain" options={SECURITY_DOMAINS.map(domain => ({ id: domain, label: domain }))} selected={selectedDomains} pending={pending} loading={false} error="" onChange={ids => change("securityDomain", ids)} onUpdate={currentDraft?.edited === "securityDomain" ? applyDraft : undefined} allowSelectAll />
    <ScopeSelect label="Managed Network" options={options.networks.filter(option => matchesSecurityDomain(option.securityDomain, selectedDomains) || scopeIds(selectedParams.getAll("network")).includes(option.id))} selected={scopeIds(selectedParams.getAll("network"))} pending={pending} loading={loading} error={error} onChange={(ids) => change("network", ids)} onUpdate={currentDraft?.edited === "network" ? applyDraft : undefined} allowSelectAll />
    <ScopeSelect label="ICT System" options={options.systems.filter(option => matchesSecurityDomain(option.securityDomain, selectedDomains) || scopeIds(selectedParams.getAll("system")).includes(option.id))} selected={scopeIds(selectedParams.getAll("system"))} pending={pending} loading={loading} error={error} onChange={(ids) => change("system", ids)} onUpdate={currentDraft?.edited === "system" ? applyDraft : undefined} />
    <span className="sr-only" role="status">{pending ? "Updating workspace" : ""}</span>
  </div>;
}
