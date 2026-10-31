"use client";

import { useRef, useState, type ReactNode } from "react";
import { SettingsPopup } from "@/components/settings-popup";
import type { SettingsTabId } from "@/components/settings-tabs";

/** Open a specific Settings tab without navigating away from the current workspace. */
export function OpenSettingsButton({ tab, children }: { tab: SettingsTabId; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={trigger} type="button" className="settings-open-button" aria-haspopup="dialog" onClick={() => setOpen(true)}>{children}</button>
    {open && <SettingsPopup initialTab={tab} onClose={() => {
      setOpen(false);
      window.requestAnimationFrame(() => trigger.current?.focus());
    }} />}
  </>;
}
