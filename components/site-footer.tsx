"use client";

import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();

  if (pathname?.startsWith("/cyber-cop")) {
    return null;
  }

  return (
    <footer className="app-footer no-print mt-8 border-t border-sky-300/15 bg-slate-950/40">
      <div className="mx-auto max-w-[1400px] px-5 py-3 text-center text-xs text-slate-300/70">
        TSAAT Operational Reporting Layer | Snapshot-aligned analytics and mission impact context.
      </div>
    </footer>
  );
}
