"use client";

import { useId } from "react";
import { usePersona } from "@/components/persona-provider";
import type { PersonaId, PersonaSettings } from "@/lib/personas";

export function PersonaSelector({ personas, value, onSelect, disabled = false }: {
  personas?: PersonaSettings["personas"]; value?: PersonaId | null; onSelect?: (value: PersonaId | null) => void; disabled?: boolean;
} = {}) {
  const id = useId();
  const { activePersona, selectPersona, selectionError, settings } = usePersona();
  const options = personas ?? settings?.personas ?? [];
  return <div className="persona-selector">
    <label htmlFor={id} className="workspace-field-label">Active persona</label>
    <select id={id} disabled={disabled || !settings} value={(value === undefined ? activePersona : value) ?? ""} aria-describedby={selectionError ? `${id}-error` : undefined}
      onChange={event => (onSelect ?? selectPersona)(options.some(persona => persona.id === event.target.value) ? event.target.value : null)}>
      <option value="">All sections (no persona)</option>
      {options.map(persona => <option key={persona.id} value={persona.id}>{persona.label}</option>)}
    </select>
    {selectionError && <p id={`${id}-error`} role="status" className="text-xs text-amber-200">{selectionError}</p>}
  </div>;
}
