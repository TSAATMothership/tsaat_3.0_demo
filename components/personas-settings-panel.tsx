"use client";

import { useState } from "react";
import { PersonaSelector } from "@/components/persona-selector";
import { usePersona } from "@/components/persona-provider";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { PERSONA_PAGES, PERSONA_POPUPS, PERSONA_SECTIONS, personaShowsPage, type PersonaId } from "@/lib/personas";

const permissionTabs = [...PERSONA_SECTIONS.map(({ id, label }) => ({ id, label })), { id: "popups", label: "Popups" }];
const compactPageSize = 3;

export function PersonasSettingsPanel() {
  const { activePersona, selectPersona, settings, error, loading, reload } = usePersona();
  const [permissionView, setPermissionView] = useState(permissionTabs[0].id);
  const [permissionPage, setPermissionPage] = useState(0);
  const persona = settings?.personas.find(persona => persona.id === activePersona);
  const pages = settings && persona ? PERSONA_PAGES.filter(page => personaShowsPage(settings, persona.id, page.id)).map(page => page.id) : [];
  const visibleCount = permissionView === "popups" ? PERSONA_POPUPS.length : PERSONA_SECTIONS.find(section => section.id === permissionView)!.pages.length;
  const selectPermissionView = (view: string) => { setPermissionView(view); setPermissionPage(0); };
  const choosePersona = (id: PersonaId | null) => { selectPersona(id); setPermissionPage(0); };

  return <section className="panel personas-settings" aria-labelledby="personas-title">
    <div className="personas-intro">
      <div><h3 id="personas-title">Personas</h3><p>Read-only configuration. Choose an existing persona to use and view its saved pages and popups.</p></div>
      <div className="persona-catalogue-controls"><PersonaSelector onSelect={choosePersona} /></div>
    </div>
    {error && <div className="personas-load-error"><p role="alert">{error}</p><button type="button" disabled={loading} className="persona-action" onClick={reload}>Retry loading personas</button></div>}
    {loading && !settings && <p role="status">Loading personas...</p>}
    {settings && (persona ? <fieldset key={persona.id} className="persona-card">
      <legend className="sr-only">{persona.label} saved permissions</legend>
      <div className="persona-configuration-header">
        <p className="font-semibold" data-persona-name>{persona.label}</p>
        <div className="persona-card-toolbar"><p>{pages.length}/{PERSONA_PAGES.length} pages · {persona.popups.length}/{PERSONA_POPUPS.length} popups enabled</p></div>
      </div>
      <div className="persona-permission-tabs"><WorkspaceTabs id="persona-permissions" label="Persona sections and popups" tabs={permissionTabs} active={permissionView} onChange={selectPermissionView} /></div>
      <label className="persona-permission-picker">View
        <select aria-label="View persona permissions" value={permissionView} onChange={event => selectPermissionView(event.target.value)}>
          {permissionTabs.map(tab => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
        </select>
      </label>
      {PERSONA_SECTIONS.map(section => {
        const count = section.pages.filter(page => pages.includes(page.id)).length;
        return <div key={section.id} id={`persona-permissions-panel-${section.id}`} role="tabpanel" aria-label={`${section.label} pages`} hidden={permissionView !== section.id} className="persona-permission-panel">
          <div className="persona-permission-heading">
            <label className="persona-section-check font-semibold">
              <input type="checkbox" disabled checked={count === section.pages.length} ref={node => { if (node) node.indeterminate = count > 0 && count < section.pages.length; }} aria-label={`${persona.label}: ${section.label}`} />
              <span>{section.label}</span>
            </label>
            <span>{count}/{section.pages.length} pages enabled</span>
          </div>
          <div className="persona-permission-grid">{section.pages.map((page, index) => <label key={page.id} className="persona-section-check" data-compact-page={Math.floor(index / compactPageSize)} data-current-page={Math.floor(index / compactPageSize) === permissionPage}>
            <input type="checkbox" disabled checked={pages.includes(page.id)} aria-label={`${persona.label}: ${section.label} / ${page.label}`} />
            <span>{page.label}</span>
          </label>)}</div>
        </div>;
      })}
      <div id="persona-permissions-panel-popups" role="tabpanel" aria-label="Popup permissions" hidden={permissionView !== "popups"} className="persona-permission-panel">
        <p className="persona-popup-help">Popup access is independent of sidebar pages.</p>
        <div className="persona-permission-grid">{PERSONA_POPUPS.map((popup, index) => <label key={popup.id} className="persona-section-check" data-compact-page={Math.floor(index / compactPageSize)} data-current-page={Math.floor(index / compactPageSize) === permissionPage}>
          <input type="checkbox" disabled checked={persona.popups.includes(popup.id)} aria-label={`${persona.label}: Popup / ${popup.label}`} />
          <span>{popup.label}</span>
        </label>)}</div>
      </div>
      {visibleCount > compactPageSize && <div className="persona-permission-pagination">
        <button type="button" className="persona-action" aria-label="Previous permissions" disabled={permissionPage === 0} onClick={() => setPermissionPage(page => page - 1)}>Previous</button>
        <span role="status">{permissionPage * compactPageSize + 1}–{Math.min((permissionPage + 1) * compactPageSize, visibleCount)} of {visibleCount}</span>
        <button type="button" className="persona-action" aria-label="Next permissions" disabled={(permissionPage + 1) * compactPageSize >= visibleCount} onClick={() => setPermissionPage(page => page + 1)}>Next</button>
      </div>}
    </fieldset> : <p className="persona-empty">All sections (no persona) keeps every page and popup available. Select an existing persona to view its saved permissions.</p>)}
    <p className="personas-footnote">Selecting a persona changes this browser&apos;s view. Saved names, pages and popup permissions are read-only.</p>
  </section>;
}
