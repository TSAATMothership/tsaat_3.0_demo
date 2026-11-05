"use client";

import type { ReactNode } from "react";
import { usePersonaAccess } from "@/components/persona-provider";
import type { PersonaPopupId } from "@/lib/personas";

export function PersonaPopup({ popup, children }: { popup: PersonaPopupId; children: ReactNode }) {
  const { canOpenPopup } = usePersonaAccess();
  return canOpenPopup(popup) ? children : null;
}
