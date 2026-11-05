"use client";

import { useState } from "react";
import { PersonaSelector } from "@/components/persona-selector";
import { usePersona } from "@/components/persona-provider";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { PERSONAS, PERSONA_PAGES, PERSONA_POPUPS, PERSONA_SECTIONS, parsePersonaSettings, personaShowsPage, type PersonaId, type PersonaSettings } from "@/lib/personas";

const permissionTabs = [...PERSONA_SECTIONS.map(({ id, label }) => ({ id, label })), { id: "popups", label: "Popups" }];
const compactPageSize = 3;

export function PersonasSettingsPanel() {
  const { activePersona, settings, error, loading, reload, acceptSettings } = usePersona();
  const [draft, setDraft] = useState<PersonaSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [message, setMessage] = useState("");
  const [permissionView, setPermissionView] = useState(permissionTabs[0].id);
  const [permissionPage, setPermissionPage] = useState(0);
  const value = draft ?? settings;
  const persona = PERSONAS.find(persona => persona.id === activePersona);
  const entry = value?.personas.find(entry => entry.id === activePersona);
  const pages = value && persona ? PERSONA_PAGES.filter(page => personaShowsPage(value, persona.id, page.id)).map(page => page.id) : [];
  const visibleCount = permissionView === "popups" ? PERSONA_POPUPS.length : PERSONA_SECTIONS.find(section => section.id === permissionView)!.pages.length;
  const selectPermissionView = (view: string) => { setPermissionView(view); setPermissionPage(0); };
  function changePersona(id: PersonaId, changes: Partial<PersonaSettings["personas"][number]>) {
    if (!value) return;
    setDraft({ ...value, personas: value.personas.map(persona => persona.id === id ? { ...persona, ...changes } : persona) });
    setSaveError(""); setMessage("");
  }
  function changePages(id: PersonaId, pages: string[]) {
    changePersona(id, { pages, sections: PERSONA_SECTIONS.filter(section => section.pages.some(page => pages.includes(page.id))).map(section => section.id) });
  }
  async function save() {
    if (!value) return;
    setSaving(true); setSaveError(""); setMessage("");
    try {
      const response = await fetch("/api/settings/personas", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save personas. Please retry.");
      acceptSettings(parsePersonaSettings(payload.settings));
      setDraft(null); setMessage("Personas saved.");
    } catch (reason) { setSaveError(reason instanceof Error ? reason.message : "Unable to save personas. Please retry."); }
    finally { setSaving(false); }
  }
  return <section className="panel personas-settings" aria-labelledby="personas-title">
    <div className="personas-intro">
      <div>
        <h3 id="personas-title">Personas</h3>
        <p>Choose a section to configure its pages, or select Popups.</p>
      </div>
      <PersonaSelector />
    </div>
    {error && <div className="personas-load-error"><p role="alert">{error}</p><button type="button" disabled={loading} className="persona-action" onClick={reload}>Retry loading personas</button></div>}
    {loading && !value && <p role="status">Loading personas...</p>}
    {value && <>
      {persona && entry ? <fieldset key={persona.id} className="persona-card" disabled={saving}>
        <legend>{persona.label}</legend>
        <div className="persona-card-toolbar">
          <p>{pages.length}/{PERSONA_PAGES.length} pages · {entry.popups.length}/{PERSONA_POPUPS.length} popups enabled</p>
          <div>
            <button type="button" data-persona-show-all className="persona-action" onClick={() => changePersona(persona.id, { sections: PERSONA_SECTIONS.map(section => section.id), pages: PERSONA_PAGES.map(page => page.id), popups: PERSONA_POPUPS.map(popup => popup.id) })}>Show all<span className="sr-only"> for {persona.label}</span></button>
            <button type="button" data-persona-hide-all className="persona-action" onClick={() => changePersona(persona.id, { sections: [], pages: [], popups: [] })}>Hide all<span className="sr-only"> for {persona.label}</span></button>
          </div>
        </div>
        <div className="persona-permission-tabs"><WorkspaceTabs id="persona-permissions" label="Persona sections and popups" tabs={permissionTabs} active={permissionView} onChange={selectPermissionView} /></div>
        <label className="persona-permission-picker">Configure
          <select aria-label="Configure persona permissions" value={permissionView} onChange={event => selectPermissionView(event.target.value)}>
            {permissionTabs.map(tab => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
          </select>
        </label>
        {PERSONA_SECTIONS.map(section => {
          const count = section.pages.filter(page => pages.includes(page.id)).length;
          return <div key={section.id} id={`persona-permissions-panel-${section.id}`} role="tabpanel" aria-label={`${section.label} pages`} hidden={permissionView !== section.id} className="persona-permission-panel">
            <div className="persona-permission-heading">
              <label className="persona-section-check font-semibold">
                <input type="checkbox" checked={count === section.pages.length} ref={node => { if (node) node.indeterminate = count > 0 && count < section.pages.length; }}
                  aria-label={`${persona.label}: ${section.label}`} onChange={event => changePages(persona.id, event.target.checked
                    ? [...new Set([...pages, ...section.pages.map(page => page.id)])] : pages.filter(id => !section.pages.some(page => page.id === id)))} />
                <span>{section.label}</span>
              </label>
              <span>{count}/{section.pages.length} pages enabled</span>
            </div>
            <div className="persona-permission-grid">{section.pages.map((page, index) => <label key={page.id} className="persona-section-check" data-compact-page={Math.floor(index / compactPageSize)} data-current-page={Math.floor(index / compactPageSize) === permissionPage}>
              <input type="checkbox" checked={pages.includes(page.id)} aria-label={`${persona.label}: ${section.label} / ${page.label}`}
                onChange={event => changePages(persona.id, event.target.checked ? [...pages, page.id] : pages.filter(id => id !== page.id))} />
              <span>{page.label}</span>
            </label>)}</div>
          </div>;
        })}
        <div id="persona-permissions-panel-popups" role="tabpanel" aria-label="Popup permissions" hidden={permissionView !== "popups"} className="persona-permission-panel">
          <p className="persona-popup-help">Popup access is independent of sidebar pages.</p>
          <div className="persona-permission-grid">{PERSONA_POPUPS.map((popup, index) => <label key={popup.id} className="persona-section-check" data-compact-page={Math.floor(index / compactPageSize)} data-current-page={Math.floor(index / compactPageSize) === permissionPage}>
            <input type="checkbox" checked={entry.popups.includes(popup.id)} aria-label={`${persona.label}: Popup / ${popup.label}`}
              onChange={event => changePersona(persona.id, { popups: event.target.checked ? [...entry.popups, popup.id] : entry.popups.filter(id => id !== popup.id) })} />
            <span>{popup.label}</span>
          </label>)}</div>
        </div>
        {visibleCount > compactPageSize && <div className="persona-permission-pagination">
          <button type="button" className="persona-action" aria-label="Previous permissions" disabled={permissionPage === 0} onClick={() => setPermissionPage(page => page - 1)}>Previous</button>
          <span role="status">{permissionPage * compactPageSize + 1}–{Math.min((permissionPage + 1) * compactPageSize, visibleCount)} of {visibleCount}</span>
          <button type="button" className="persona-action" aria-label="Next permissions" disabled={(permissionPage + 1) * compactPageSize >= visibleCount} onClick={() => setPermissionPage(page => page + 1)}>Next</button>
        </div>}
      </fieldset> : <p className="persona-empty">All sections (no persona) keeps every page and popup available. Select an active persona to configure its permissions.</p>}
      <div className="personas-save-bar">
        <button type="button" data-save-personas className="persona-action bg-sky-500/20" disabled={!draft || saving} onClick={() => void save()}>{saving ? "Saving..." : "Save personas"}</button>
        <button type="button" className="persona-action" disabled={!draft || saving} onClick={() => { setDraft(null); setSaveError(""); setMessage("Unsaved changes discarded."); }}>Discard changes</button>
        <p role="status">{message || (draft ? "Unsaved persona changes" : "")}</p>
      </div>
    </>}
    {saveError && <p role="alert" className="personas-save-error">{saveError}</p>}
    <p className="personas-footnote">Edits stay when switching views or personas. Save updates shared settings. Direct URLs and data access are unchanged.</p>
  </section>;
}
