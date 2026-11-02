"use client";

import { useRef } from "react";

/** Keyboard-accessible tabs using the risk profile and discovery page styles. */
export function WorkspaceTabs<T extends string>({ id, label, tabs, active, onChange }: {
  id: string; label: string; tabs: ReadonlyArray<{ id: T; label: string }>; active: T; onChange: (tab: T) => void;
}) {
  const refs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  return <div className="network-risk-tabs service-impact-tabs" role="tablist" aria-label={label}>{tabs.map((tab, index) =>
    <button key={tab.id} ref={node => { refs.current[tab.id] = node; }} id={`${id}-tab-${tab.id}`} type="button" role="tab"
      aria-controls={`${id}-panel-${tab.id}`} aria-selected={active === tab.id} tabIndex={active === tab.id ? 0 : -1}
      onClick={() => onChange(tab.id)} onKeyDown={event => {
        const target = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1)
          : event.key === "ArrowRight" ? tabs[(index + 1) % tabs.length] : event.key === "ArrowLeft" ? tabs[(index - 1 + tabs.length) % tabs.length] : null;
        if (target) { event.preventDefault(); onChange(target.id); refs.current[target.id]?.focus(); }
      }}>{tab.label}</button>)}</div>;
}
