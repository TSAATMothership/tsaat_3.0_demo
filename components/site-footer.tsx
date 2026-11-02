"use client";

import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname() ?? "/";
  const isCyberCopPage = Boolean(pathname?.startsWith("/cyber-cop"));
  const isMeasuresPage = Boolean(pathname?.startsWith("/measures"));
  const isDiscoveryCoveragePage = Boolean(pathname?.startsWith("/discovery-coverage"));
  const usesWideFooterLayout = isMeasuresPage || isDiscoveryCoveragePage;

  if (isCyberCopPage) {
    return null;
  }

  const footerContainerClass = usesWideFooterLayout
    ? "relative left-1/2 w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 px-5 py-3 text-center text-xs text-slate-300/70 md:w-[min(2100px,calc(100vw-3rem))]"
    : "mx-auto max-w-[1400px] px-5 py-3 text-center text-xs text-slate-300/70";

  return (
    <footer
      className={`app-footer no-print border-t border-sky-300/15 bg-slate-950/40 ${usesWideFooterLayout ? "mt-0" : "mt-8"}`}
    >
      <div className={footerContainerClass}>TSAAT | Cyber Operations Compliance Reporting.</div>
    </footer>
  );
}
