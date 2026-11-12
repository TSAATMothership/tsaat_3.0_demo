"use client";

import { useId } from "react";
import { usePersona } from "@/components/persona-provider";

export function PersonaSelector() {
  const id = useId();
  const { activePersona, selectPersona, selectionError, settings, error, loading, reload } = usePersona();
  const options = settings?.personas ?? [];
  const activeLabel = options.find(persona => persona.id === activePersona)?.label ?? "All sections (no persona)";
  return <div className="persona-selector workspace-persona">
    <label htmlFor={id} className="workspace-field-label">Persona</label>
    <select id={id} aria-label="Active persona" title={activeLabel} disabled={!settings} value={activePersona ?? ""} aria-describedby={selectionError ? `${id}-error` : undefined}
      onChange={event => selectPersona(options.some(persona => persona.id === event.target.value) ? event.target.value : null)}>
      <option value="">All sections (no persona)</option>
      {options.map(persona => <option key={persona.id} value={persona.id}>{persona.label}</option>)}
    </select>
    <span className="sr-only" role="status" data-active-persona>{options.find(persona => persona.id === activePersona)?.label ?? (loading && !settings ? "Loading personas..." : "All sections (no persona)")}</span>
    {selectionError && <p id={`${id}-error`} role="status" className="text-xs text-amber-200">{selectionError}</p>}
    {error && <button type="button" className="persona-action" disabled={loading} onClick={reload}>Retry loading personas</button>}
  </div>;
}
