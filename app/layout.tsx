import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import "./globals.css";
import { CmdbDrillThroughProvider } from "@/components/cmdb-drill-through";
import { FilterLoadingOverlay } from "@/components/filter-loading-overlay";
import { MenuNavigation } from "@/components/menu-navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { PersonaProvider } from "@/components/persona-provider";
import { APP_NAME } from "@/lib/constants";

const bodyFontClass = "font-['Segoe_UI','Trebuchet_MS','Arial',sans-serif]";
const headingFontClass = "font-['Bahnschrift','Arial_Narrow','Arial',sans-serif]";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Cyberspace situational awareness dashboard for TSAAT posture and risk reporting."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFontClass} antialiased`}>
        <div className="app-bg" />
        <div className="topography-overlay" />
        <PersonaProvider><div className="app-workspace-shell">
          <header className="workspace-header no-print">
            <div className="w-full px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex shrink-0 items-center gap-3">
                  <Image src="/tsaat-logo.png" alt="TSAAT logo" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" priority />
                  <div>
                    <p className={`${headingFontClass} text-xl uppercase tracking-[0.14em] text-slate-100`}>TSAAT</p>
                    <p className="text-xs text-slate-300/75">Threat Surface Area Assessment Tool</p>
                  </div>
                </div>
                <div className="min-w-0">
                  <Suspense fallback={<div className="h-[38px]" />}>
                    <MenuNavigation />
                  </Suspense>
                </div>
              </div>
            </div>
          </header>

          <Suspense fallback={null}>
            <WorkspaceShell><CmdbDrillThroughProvider>{children}</CmdbDrillThroughProvider></WorkspaceShell>
          </Suspense>
        </div></PersonaProvider>
        <Suspense fallback={null}>
          <FilterLoadingOverlay />
        </Suspense>

      </body>
    </html>
  );
}
