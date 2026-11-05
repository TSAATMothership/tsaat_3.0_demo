"use client";

import { forwardRef, type ComponentProps } from "react";
import { usePersonaAccess } from "@/components/persona-provider";
import type { PersonaPopupId } from "@/lib/personas";

export const PersonaPopupButton = forwardRef<HTMLButtonElement, ComponentProps<"button"> & { popup: PersonaPopupId }>(
  function PersonaPopupButton({ popup, disabled, title, ...props }, ref) {
    const { canOpenPopup } = usePersonaAccess();
    const allowed = canOpenPopup(popup);
    return <button {...props} ref={ref} disabled={disabled || !allowed} data-persona-popup={popup}
      data-persona-disabled={!allowed || undefined} title={allowed ? title : "Unavailable for the active persona"} />;
  }
);
