"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isPersonaId, parsePersonaSettings, personaAllowsHref, personaAllowsPopup, type PersonaId, type PersonaPopupId, type PersonaSettings } from "@/lib/personas";

const storageKey = "tsaat.active-persona";
interface PersonaContextValue {
  activePersona: PersonaId | null;
  selectPersona: (value: PersonaId | null) => void;
  selectionError: string;
  settings: PersonaSettings | null;
  error: string;
  loading: boolean;
  reload: () => void;
  acceptSettings: (value: PersonaSettings) => void;
}
const PersonaContext = createContext<PersonaContextValue | null>(null);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [activePersona, setActivePersona] = useState<PersonaId | null>(null);
  const [selectionError, setSelectionError] = useState("");
  const [settings, setSettings] = useState<PersonaSettings | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const reload = useCallback(() => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    fetch("/api/settings/personas", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load personas.");
        const value = parsePersonaSettings(payload.settings);
        if (!controller.signal.aborted) setSettings(value);
      })
      .catch(() => { if (!controller.signal.aborted) setError("Persona settings are unavailable. Retry to load the saved visibility."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, []);
  const acceptSettings = useCallback((value: PersonaSettings) => {
    request.current?.abort();
    setSettings(value); setError(""); setLoading(false);
  }, []);
  useEffect(() => {
    const readSelection = () => {
      try {
        const value = window.localStorage.getItem(storageKey);
        setActivePersona(isPersonaId(value) ? value : null);
      } catch { setSelectionError("Your browser cannot remember persona selections. Changes apply for this visit."); }
    };
    readSelection(); reload();
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) readSelection(); };
    // Pick up other sessions' saved configurations without discarding an open Settings draft.
    const onFocus = () => { if (!document.querySelector("dialog[open]")) reload(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => { request.current?.abort(); window.removeEventListener("storage", onStorage); window.removeEventListener("focus", onFocus); };
  }, [reload]);
  const selectPersona = (value: PersonaId | null) => {
    setActivePersona(value);
    try {
      if (value) window.localStorage.setItem(storageKey, value); else window.localStorage.removeItem(storageKey);
      setSelectionError("");
    } catch { setSelectionError("Your browser cannot remember persona selections. Changes apply for this visit."); }
  };
  return <PersonaContext.Provider value={{ activePersona, selectPersona, selectionError, settings, error, loading, reload, acceptSettings }}>
    {children}
  </PersonaContext.Provider>;
}

export function usePersona() {
  const context = useContext(PersonaContext);
  if (!context) throw new Error("Persona controls require PersonaProvider.");
  return context;
}

/** Navigation/popup preferences only; API access and report downloads retain their existing model. */
export function usePersonaAccess() {
  const { settings, activePersona, loading } = usePersona();
  return {
    canNavigate: (href: string) => !settings || personaAllowsHref(settings, activePersona, href),
    canOpenPopup: (popup: PersonaPopupId) => !settings ? !loading : personaAllowsPopup(settings, activePersona, popup)
  };
}
