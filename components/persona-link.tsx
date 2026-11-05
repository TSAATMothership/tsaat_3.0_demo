"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { usePersonaAccess } from "@/components/persona-provider";

/** With no href or click handler, a disabled destination cannot open via keyboard or a new tab. */
export default function PersonaLink({ href, children, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const { canNavigate } = usePersonaAccess();
  if (canNavigate(href)) return <Link {...props} href={href}>{children}</Link>;
  return <a role="link" aria-disabled="true" tabIndex={-1} className={props.className} style={props.style}
    aria-label={props["aria-label"]} title="Unavailable for the active persona" data-persona-disabled="true">{children}</a>;
}
