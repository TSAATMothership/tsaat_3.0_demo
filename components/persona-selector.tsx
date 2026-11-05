"use client";

import { useId } from "react";
import { usePersona } from "@/components/persona-provider";
import { PERSONAS, isPersonaId } from "@/lib/personas";

export function PersonaSelector() {
  const id = useId();
  const { activePersona, selectPersona, selectionError } = usePersona();
  return <div className="persona-selector">
    <label htmlFor={id} className="workspace-field-label">Active persona</label>
    <select id={id} value={activePersona ?? ""} aria-describedby={selectionError ? `${id}-error` : undefined}
      onChange={event => selectPersona(isPersonaId(event.target.value) ? event.target.value : null)}>
      <option value="">All sections (no persona)</option>
      {PERSONAS.map(persona => <option key={persona.id} value={persona.id}>{persona.label}</option>)}
    </select>
    {selectionError && <p id={`${id}-error`} role="status" className="text-xs text-amber-200">{selectionError}</p>}
  </div>;
}
